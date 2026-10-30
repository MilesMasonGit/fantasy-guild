import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Flags from '../systems/board/Flags.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as OutputRules from '../systems/board/OutputRules.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { registerTokenTypes, getTokenType, tokenName } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { cardLifecycle, liveCardSources } from '../ui/components/board/tokenCard.js';
import { lifecycleLines } from '../ui/components/drawer/lifecycleLines.js';
import { clearMat, placeAt } from './fixtures/mat.js';

/**
 * Mining (brief 230 S3; owner, 2026-10-24). A vein rests when it runs out and refills all at once;
 * while it rests it is drawn as one shared empty rock (its type's `respawn.restingSprite`) and its
 * card names the ore. A Mine in reach gives the vein's ore (not its gems) about a 25 % chance to
 * come out doubled, stacking to a sure double at four. A Minecart in reach cuts the vein's work
 * time, stacking down to the 80 % floor.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const ORE = 'fixture_copper_ore';
const GEM = 'mine_fixture_gem';
const EMPTY_ROCK = 't_vein_stone';

registerItems({
    [GEM]: { id: GEM, name: 'Fixture Gem', type: 'material', stackable: true, equipSlot: '', sprite: 'gem_ruby', tags: [], value: 1 }
});

const provides = (id, type, bucket, value, target, extra = {}) => ({
    id: `stm_${id}`, keyword: 'provides', to: { mode: 'id', value: target }, reach: 'nearby',
    payload: { type, bucket, value, ...extra }
});

const mining = (cycleTimeMs, outputs) => ({ skill: 'mining', skillRequired: 1, cycleTimeMs, xp: 1, inputs: [], outputs });

registerTokenTypes({
    mine_vein: {
        id: 'mine_vein', name: 'Fixture Copper Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 5, sprite: 't_ore_vein_copper', staysPut: true,
        respawn: { mode: 'refill', afterMs: 60000, restingSprite: EMPTY_ROCK },
        config: mining(2000, [{ itemId: ORE, quantity: 1, chance: 100 }])
    },
    /** A rich vein for counting doubles: ore and a gem every cycle, plenty of charges. */
    mine_rich_vein: {
        id: 'mine_rich_vein', name: 'Fixture Rich Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 1000, sprite: 't_ore_vein_copper',
        config: mining(1000, [{ itemId: ORE, quantity: 1, chance: 100 }, { itemId: GEM, quantity: 1, chance: 100 }])
    },
    mine_slow_vein: {
        id: 'mine_slow_vein', name: 'Fixture Slow Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 1000, sprite: 't_ore_vein_copper', config: mining(10000, [{ itemId: ORE, quantity: 1, chance: 100 }])
    },
    /** A refill with no resting sprite: drawn as today (its own art, greyed). */
    mine_plain_refill: {
        id: 'mine_plain_refill', name: 'Fixture Plain Refill', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 't_ore_vein_copper', respawn: { mode: 'refill', afterMs: 12000 },
        config: mining(2000, [{ itemId: ORE, quantity: 1, chance: 100 }])
    },
    /** A regrow ignores a resting sprite: it becomes another Token, which has its own art. */
    mine_regrow: {
        id: 'mine_regrow', name: 'Fixture Regrow', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 't_ore_vein_copper', respawn: { mode: 'regrow', into: 'mine_slow_vein', restingSprite: EMPTY_ROCK },
        config: mining(2000, [{ itemId: ORE, quantity: 1, chance: 100 }])
    },
    mine_mine: {
        id: 'mine_mine', name: 'Fixture Copper Mine', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_mine_copper',
        statements: [provides('mine_mine', EFFECT_TYPES.DOUBLE_DROP, 'flat', 25, 'mine_rich_vein', { category: ORE })]
    },
    mine_cart: {
        id: 'mine_cart', name: 'Fixture Minecart', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_minecart_copper',
        statements: [provides('mine_cart', EFFECT_TYPES.WORK_TIME, 'percentage', -0.2, 'mine_slow_vein')]
    }
});

const VEIN = { x: 800, y: 600 };
/** `n` points on a 150 u ring round the vein: all within Near (164 u). */
const ring = (n, c = VEIN) => Array.from({ length: n }, (_, i) => ({
    x: Math.round(c.x + 150 * Math.cos((2 * Math.PI * i) / n)),
    y: Math.round(c.y + 150 * Math.sin((2 * Math.PI * i) / n))
}));

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    return hero;
}

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

/** What a run made, banked or lying on the mat. */
const made = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => clearMat());

describe('a resting vein shows the shared empty rock', () => {
    it('its resting sprite is the authored one only while it rests', () => {
        const vein = placeAt('mine_vein', VEIN.x, VEIN.y);
        expect(Respawn.restingSpriteOf(vein)).toBeNull();
        vein.usesRemaining = 0;
        expect(Respawn.restingSpriteOf(vein)).toBe(EMPTY_ROCK);
        vein.usesRemaining = 5;
        expect(Respawn.restingSpriteOf(vein)).toBeNull();
    });

    it('a refill without one, a regrow, and a Token that never respawns have none', () => {
        const plainRefill = placeAt('mine_plain_refill', VEIN.x, VEIN.y);
        plainRefill.usesRemaining = 0;
        expect(Respawn.isResting(plainRefill)).toBe(true);
        expect(Respawn.restingSpriteOf(plainRefill)).toBeNull();

        const regrow = BoardState.createTokenInstance('mine_regrow', 0);
        expect(Respawn.restingSpriteOf(regrow)).toBeNull();

        const slow = BoardState.createTokenInstance('mine_slow_vein', 0);
        expect(Respawn.restingSpriteOf(slow)).toBeNull();
        expect(Respawn.restingSpriteOf(null)).toBeNull();
    });

    it('a blank or non-text sprite is none', () => {
        expect(Respawn.restingSpriteOf({ typeId: 'x', usesRemaining: 0 }, { respawn: { mode: 'refill', restingSprite: '  ' } })).toBeNull();
        expect(Respawn.restingSpriteOf({ typeId: 'x', usesRemaining: 0 }, { respawn: { mode: 'refill', restingSprite: 7 } })).toBeNull();
        expect(Respawn.restingSpriteOf({ typeId: 'x', usesRemaining: 0 }, { respawn: { mode: 'refill', restingSprite: ' t_vein_stone ' } })).toBe(EMPTY_ROCK);
    });

    it('the inspection state carries it, and the card and the inspection name the ore while it rests', () => {
        const vein = placeAt('mine_vein', VEIN.x, VEIN.y);
        vein.usesRemaining = 0;
        vein.clocks = { [Respawn.CLOCK]: 18000 };
        expect(Respawn.respawnState(vein)).toMatchObject({ mode: 'refill', resting: true, inMs: 42000, restingSprite: EMPTY_ROCK });

        const line = cardLifecycle(vein, getTokenType('mine_vein'), liveCardSources()).find(l => l.icon === 'regrow');
        expect(line).toMatchObject({ text: '0:42', tip: 'Fixture Copper Vein: resting, refills in 0:42' });

        const lines = lifecycleLines(vein, { typeOf: getTokenType, tokenName, respawn: Respawn.respawnState });
        expect(lines.find(l => l.label === 'Resting')).toEqual({ label: 'Resting', value: 'Fixture Copper Vein: resting, refills in 42 s' });
    });

    it('a resting Token without one keeps today\'s words', () => {
        const t = placeAt('mine_plain_refill', VEIN.x, VEIN.y);
        t.usesRemaining = 0;
        const line = cardLifecycle(t, getTokenType('mine_plain_refill'), liveCardSources()).find(l => l.icon === 'regrow');
        expect(line.tip).toBe('Resting: refills in 12 s');
    });
});

describe('a vein refills all at once', () => {
    it('five ore, then a minute\'s rest at 0, then all five back in one step', () => {
        const vein = placeAt('mine_vein', VEIN.x, VEIN.y);
        Orders.orderAt('hero_1', VEIN);
        const charges = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TOKEN_CHARGES_CHANGED, (p) => { if (p.instanceId === vein.id) charges.push(p.remaining); });
        run(15000);
        expect(vein.usesRemaining).toBe(0);
        expect(Respawn.restingSpriteOf(vein)).toBe(EMPTY_ROCK);
        run(60000);
        off();
        expect(charges).toContain(0);
        // From 0 straight to 5: no charge in between.
        const back = charges.indexOf(5, charges.indexOf(0));
        expect(back).toBe(charges.indexOf(0) + 1);
        expect(made(ORE)).toBeGreaterThanOrEqual(5);
    });
});

describe('a Mine doubles its vein\'s ore, never its gems', () => {
    const rate = (veinId, itemId, n = 4000) => {
        let doubled = 0;
        for (let i = 0; i < n; i++) if (OutputRules.doubleItemDrop(veinId, itemId, 1) === 2) doubled++;
        return doubled / n;
    };

    it('one Mine in reach: about 25 % on the ore, 0 on the gem; two: about half; four: every time', () => {
        const vein = placeAt('mine_rich_vein', VEIN.x, VEIN.y);
        const spots = ring(4);
        placeAt('mine_mine', spots[0].x, spots[0].y);
        TileModifiers.rebuildAll();
        const one = rate(vein.id, ORE);
        expect(one).toBeGreaterThan(0.21);
        expect(one).toBeLessThan(0.29);
        expect(rate(vein.id, GEM)).toBe(0);

        placeAt('mine_mine', spots[1].x, spots[1].y);
        TileModifiers.rebuildAll();
        const two = rate(vein.id, ORE);
        expect(two).toBeGreaterThan(0.45);
        expect(two).toBeLessThan(0.55);

        placeAt('mine_mine', spots[2].x, spots[2].y);
        placeAt('mine_mine', spots[3].x, spots[3].y);
        TileModifiers.rebuildAll();
        expect(rate(vein.id, ORE)).toBe(1);
        expect(rate(vein.id, GEM)).toBe(0);
    });

    it('a Mine out of reach gives nothing', () => {
        const vein = placeAt('mine_rich_vein', VEIN.x, VEIN.y);
        placeAt('mine_mine', VEIN.x + 400, VEIN.y);
        TileModifiers.rebuildAll();
        expect(rate(vein.id, ORE)).toBe(0);
    });

    it('worked by a miner with four Mines round it: every ore comes out twice, every gem once', () => {
        const vein = placeAt('mine_rich_vein', VEIN.x, VEIN.y);
        for (const p of ring(4)) placeAt('mine_mine', p.x, p.y);
        TileModifiers.rebuildAll();
        Orders.orderAt('hero_1', VEIN);
        let cycles = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.instanceId === vein.id) cycles++; });
        run(12000);
        off();
        expect(cycles).toBeGreaterThanOrEqual(5);
        expect(made(ORE)).toBe(2 * cycles);
        expect(made(GEM)).toBe(cycles);
    });
});

describe('a Minecart shortens its vein\'s work time', () => {
    /** The cycle time the runner works the vein at, as its progress events report it. */
    function workedCycleMs(vein, ms = 3000) {
        let seen = null;
        const off = EventBus.subscribe(BOARD_EVENTS.PROGRESS, (p) => {
            if (p?.instanceId === vein.id && p.cycleTimeMs != null) seen = p.cycleTimeMs;
        });
        run(ms);
        off();
        return seen;
    }

    it.each([[0, 10000], [1, 8000], [2, 6000], [4, 2000], [5, 2000]])('%i Minecarts in reach: a 10 s vein works in %i ms (stacking, held at 80 % off)', (carts, cycle) => {
        const vein = placeAt('mine_slow_vein', VEIN.x, VEIN.y);
        for (const p of ring(Math.max(carts, 1)).slice(0, carts)) placeAt('mine_cart', p.x, p.y);
        TileModifiers.rebuildAll();
        Orders.orderAt('hero_1', VEIN);
        expect(workedCycleMs(vein)).toBe(cycle);
    });

    it('a Minecart out of reach does nothing', () => {
        const vein = placeAt('mine_slow_vein', VEIN.x, VEIN.y);
        placeAt('mine_cart', VEIN.x + 400, VEIN.y);
        TileModifiers.rebuildAll();
        Orders.orderAt('hero_1', VEIN);
        expect(workedCycleMs(vein)).toBe(10000);
    });
});
