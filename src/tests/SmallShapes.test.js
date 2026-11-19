import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Shapes the CMS can author and no shipped content uses yet: each test authors the shape on a
 * fixture and checks the game does what the sentence says.
 */

/** Test layout only: spots 160 u apart, inside the shipped Near. */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

const BONUS = 'fixture_control_item';
const ORE = 'fixture_copper_ore';
const WOOD = 'fixture_oak_wood';

function place(spot, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, C(spot));
    TileModifiers.rebuildAround([instance]);
    return instance;
}

const run = (ms, step) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

/** A grant that names itself, so every firing is heard as `EFFECT_FIRED`. */
const grantOn = (id, when) => ({
    id, keyword: 'grants', effectTitle: id,
    payload: { type: 'BONUS_DROP', itemId: BONUS, quantity: 1, chance: 100 },
    chargeDelta: 0, to: null, reach: null, target: null, when
});

const producer = (id, cycleTimeMs, statements = []) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_nature',
    requiresHero: false,
    config: {
        skill: 'forestry', skillRequired: 1, cycleTimeMs, xp: 0,
        inputs: [], outputs: [{ itemId: WOOD, quantity: 1, chance: 100 }]
    },
    statements
});

const listener = (id, cooldownMs) => ({
    id, name: id, tokenType: 'support', rarity: 'common', sprite: 's_nature', requiresHero: false,
    statements: [grantOn(`stm_${id}`, { event: 'CYCLE_COMPLETE', scope: 'nearby', cooldownMs })]
});

const selfTimed = (id, cycleTimeMs, cooldownMs) => producer(id, cycleTimeMs,
    [grantOn(`stm_${id}`, { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs })]);

registerTokenTypes({
    fixture_ss_cd_2400: selfTimed('fixture_ss_cd_2400', 2500, 2400),
    fixture_ss_cd_2500: selfTimed('fixture_ss_cd_2500', 2700, 2500),
    fixture_ss_cd_4500: selfTimed('fixture_ss_cd_4500', 2200, 4500),
    fixture_ss_plain_2500: producer('fixture_ss_plain_2500', 2500),
    fixture_ss_listen_3000: listener('fixture_ss_listen_3000', 3000),
    fixture_ss_listen_2200: listener('fixture_ss_listen_2200', 2200),
    fixture_ss_bank_sigil: {
        id: 'fixture_ss_bank_sigil', name: 'Ore Sigil', tokenType: 'support', rarity: 'common',
        sprite: 's_mining', requiresHero: false,
        statements: [{
            id: 'stm_ss_bank_sigil', keyword: 'converts', effectTitle: 'stm_ss_bank_sigil',
            payload: { type: 'CONVERT', consumes: [{ itemId: ORE, quantity: 1 }], produces: [{ itemId: BONUS, quantity: 1 }], chance: 100 },
            chargeDelta: 0, to: { mode: 'all', value: '' }, reach: null, target: null,
            when: { event: 'ITEM_THRESHOLD', scope: 'global', watchItemId: ORE, threshold: 1, cooldownMs: 2500 },
            upkeep: null
        }]
    }
});

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    TriggerSystem.teardown();
    TileModifiers.teardown();
});

/** How many times the rules on the mat fired, playing `ms` in steps of `step`. */
function firings(lay, ms, step) {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.init();
    GameState.state.inventory.maxSlots = 50;
    lay();
    let n = 0;
    const off = EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, () => { n += 1; });
    run(ms, step);
    off();
    return n;
}

describe('a rule with a cooldown fires as often away as watched', () => {
    const WATCHED = 100;
    const AWAY = 1000;

    it('a 2.4 s cooldown on a 2.5 s cycle fires on every cycle', () => {
        const lay = () => place(0, 'fixture_ss_cd_2400');
        expect(firings(lay, 30000, WATCHED)).toBe(12);
        expect(firings(lay, 30000, AWAY)).toBe(12);
    });

    it('a 2.5 s cooldown on a 2.7 s cycle fires on every cycle', () => {
        const lay = () => place(0, 'fixture_ss_cd_2500');
        const watched = firings(lay, 27000, WATCHED);
        expect(watched).toBe(10);
        expect(firings(lay, 27000, AWAY)).toBe(watched);
    });

    it('a cooldown still running at the moment refuses it, though it ends later in the same step', () => {
        // Fires at 2.2 s; ready again at 6.7 s, so 4.4 s and 6.6 s are refused and 8.8 s fires.
        const lay = () => place(0, 'fixture_ss_cd_4500');
        const watched = firings(lay, 30000, WATCHED);
        expect(watched).toBe(5);
        expect(firings(lay, 30000, AWAY)).toBe(watched);
    });

    it('a neighbour heard after the Token that worked counts its cooldown from the moment', () => {
        // Fires at 2.5 s; ready again at 5.5 s, so 5.0 s is refused and 7.5 s fires.
        const lay = () => { place(0, 'fixture_ss_plain_2500'); place(1, 'fixture_ss_listen_3000'); };
        const watched = firings(lay, 30000, WATCHED);
        expect(watched).toBe(6);
        expect(firings(lay, 30000, AWAY)).toBe(watched);
    });

    it('a neighbour heard after the Token that worked is ready if its cooldown ended before the moment', () => {
        const lay = () => { place(0, 'fixture_ss_plain_2500'); place(1, 'fixture_ss_listen_2200'); };
        const watched = firings(lay, 30000, WATCHED);
        expect(watched).toBe(12);
        expect(firings(lay, 30000, AWAY)).toBe(watched);
    });

    it('a neighbour heard before the Token that worked counts it the same way', () => {
        const lay = () => { place(1, 'fixture_ss_listen_3000'); place(0, 'fixture_ss_plain_2500'); };
        const watched = firings(lay, 30000, WATCHED);
        expect(watched).toBe(6);
        expect(firings(lay, 30000, AWAY)).toBe(watched);
    });

    it('an On Bank Holds whose cooldown ends mid-step fires from the moment it ended', () => {
        const lay = () => {
            place(0, 'fixture_ss_bank_sigil');
            InventoryManager.addItem(ORE, 100);
        };
        const watched = firings(lay, 30000, WATCHED);
        expect(watched).toBe(12);
        expect(firings(lay, 30000, AWAY)).toBe(watched);
    });
});
