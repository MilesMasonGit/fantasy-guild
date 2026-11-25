import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Charges from '../systems/board/Charges.js';
import * as CycleSavings from '../systems/board/CycleSavings.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { getPaletteEntry, MODIFIER_SHAPES } from '../config/registries/modifierPalette.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Motherlode (brief 800 P1, Mining 99): a vein worked by a hero holding it never rests. The perk
 * is Can't Run Out (`NEVER_RUNS_OUT`, one effect with Faith's blessing) narrowed to Mining, a chance
 * read once by the cycle before it spends (`CycleSavings.neverRunsOut`): on a hit the cycle spends
 * none of the vein's charges, so its end roll (860 R1) is never drawn. At 100 % that is every cycle
 * and draws nothing; below 100 it is one draw a cycle that would spend. A Token that counts down is
 * kept the same way, since what is skipped is the whole spend.
 */

const mining = {
    skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 1,
    inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }]
};
const logging = {
    skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 1,
    inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
};
const resource = (id, extra) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_industry', ...extra
});

const keepsGoing = (id, value, category = 'mining') => ({
    id, name: id,
    statements: [{
        id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
        payload: { type: EFFECT_TYPES.NEVER_RUNS_OUT, bucket: 'flat', value, ...(category ? { category } : {}) }
    }]
});

registerTokenTypes({
    ml_vein: resource('ml_vein', { uses: 5, config: mining, respawn: { mode: 'refill', afterMs: 5000 } }),
    ml_plain_vein: resource('ml_plain_vein', { uses: 3, config: mining }),
    ml_tree: resource('ml_tree', { uses: 5, sprite: 's_nature', config: logging, respawn: { mode: 'regrow', into: 'ml_stump' } }),
    ml_stump: resource('ml_stump', { uses: null, sprite: 's_nature', config: null, grows: { into: 'ml_tree', afterMs: 60000 } }),
    ml_shrine: {
        id: 'ml_shrine', name: 'ML Shrine', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: false,
        statements: keepsGoing('ml_shrine_rule', 100).statements
    }
});

registerEffects({
    ml_motherlode: keepsGoing('ml_motherlode', 100),
    ml_half: keepsGoing('ml_half', 50)
});

function hero(id, mining) {
    return {
        id, name: id, status: 'idle', level: 10, hp: { current: 100, max: 100 },
        skills: { mining: { level: mining, xp: 0 }, forestry: { level: mining, xp: 0 } }
    };
}

const AT = { x: 800, y: 500 };
const rollsAt = (value) => vi.spyOn(Math, 'random').mockReturnValue(value);

beforeAll(() => { Flags.init(); TimedChanges.init(); });
afterAll(() => {
    registerSkillPerks({ mining: { perks: [] } });
    Flags.teardown();
});
afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
    vi.clearAllMocks();
    registerSkillPerks({ mining: { perks: [{ level: 99, effectId: 'ml_motherlode' }] } });
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [hero('master', 99), hero('novice', 10)];
    GameState.state.inventory.maxSlots = 50;
});

describe('the effect: Can\'t Run Out, a chance on a skill the CMS offers', () => {
    it('is a chance narrowed to the work\'s skill, and the effect editor lists it', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.NEVER_RUNS_OUT);
        expect(entry).toMatchObject({ shape: MODIFIER_SHAPES.PROC, categories: 'skill', scales: 'value' });
        expect(entry.explains).toMatch(/run out/i);
        expect(paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type)).toContain(EFFECT_TYPES.NEVER_RUNS_OUT);
    });
});

describe('read once, before the cycle spends', () => {
    function runUntil(done, ms) {
        for (let t = 0; t < ms; t += 100) {
            if (done()) return true;
            BoardRunner.tick(100);
        }
        return done();
    }
    /** `typeId` placed at the work spot and worked by `heroId`. */
    function worked(typeId, heroId) {
        const token = placeAt(typeId, AT.x, AT.y);
        TileModifiers.rebuildAround([AT]);
        Orders.orderAt(heroId, AT);
        expect(runUntil(() => BoardState.workerOf(token.id) === heroId, 5000)).toBe(true);
        return token;
    }

    it('at 100 the cycle keeps every charge, and the keep draws nothing', () => {
        const vein = worked('ml_vein', 'master');
        const spy = vi.spyOn(Math, 'random');
        expect(CycleSavings.neverRunsOut(vein.id, 'mining')).toBe(true);
        expect(spy).not.toHaveBeenCalled();
    });

    it('a hero without it keeps nothing, and nothing is drawn for it', () => {
        const vein = worked('ml_vein', 'novice');
        const spy = vi.spyOn(Math, 'random');
        expect(CycleSavings.neverRunsOut(vein.id, 'mining')).toBe(false);
        expect(spy).not.toHaveBeenCalled();
    });

    it('at half, one draw: under 50 keeps the cycle\'s charges, 50 or over spends them', () => {
        registerSkillPerks({ mining: { perks: [{ level: 99, effectId: 'ml_half' }] } });
        const vein = worked('ml_vein', 'master');
        let spy = rollsAt(0.3);
        expect(CycleSavings.neverRunsOut(vein.id, 'mining')).toBe(true);
        expect(spy).toHaveBeenCalledTimes(1);
        vi.restoreAllMocks();
        spy = rollsAt(0.6);
        expect(CycleSavings.neverRunsOut(vein.id, 'mining')).toBe(false);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('a Mining perk keeps no tree: a tree the same hero fells still falls', () => {
        const tree = worked('ml_tree', 'master');
        expect(CycleSavings.neverRunsOut(tree.id, 'forestry')).toBe(false);
    });

    it('a Token that counts down spends nothing either: the whole spend is skipped', () => {
        const plain = worked('ml_plain_vein', 'master');
        const left = plain.usesRemaining;
        let cycles = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.instanceId === plain.id) cycles += 1; });
        expect(runUntil(() => cycles >= left + 2, 20000)).toBe(true);
        off();
        expect(BoardState.getTokenById(plain.id)).toBe(plain);
        expect(plain.usesRemaining).toBe(left);
    });

    it('a Token in reach carrying it keeps the veins around it, whoever works them', () => {
        placeAt('ml_shrine', AT.x + 120, AT.y);
        const vein = worked('ml_vein', 'novice');
        expect(CycleSavings.neverRunsOut(vein.id, 'mining')).toBe(true);
    });

    it('a spend outside a cycle is not kept: the end roll itself reads no rule', () => {
        const vein = worked('ml_vein', 'master');
        rollsAt(0);
        expect(Charges.applyDelta(vein, -1, { heroId: 'master' })).toMatchObject({ applied: -1, remaining: 0, depleted: true });
        expect(Respawn.isResting(vein)).toBe(true);
    });
});

describe('on the mat', () => {
    function runUntil(done, ms) {
        for (let t = 0; t < ms; t += 100) {
            if (done()) return true;
            BoardRunner.tick(100);
        }
        return done();
    }
    const ore = () => InventoryManager.getItemCount('fixture_copper_ore') + SpriteLayer.countOnBoard('fixture_copper_ore');

    it('the master\'s vein never rests, every roll under its chance; the novice\'s rests each time', () => {
        const FAR = { x: AT.x + 700, y: AT.y };
        const mastered = placeAt('ml_vein', AT.x, AT.y);
        const other = placeAt('ml_vein', FAR.x, FAR.y);
        TileModifiers.rebuildAround([AT, FAR]);
        Orders.orderAt('master', AT);
        Orders.orderAt('novice', FAR);
        const rested = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TOKEN_RESTING, (p) => rested.push(p.instanceId));
        rollsAt(0);
        expect(runUntil(() => ore() >= 25, 60000)).toBe(true);
        off();
        expect(BoardState.workerOf(mastered.id)).toBe('master');
        expect(rested).not.toContain(mastered.id);
        expect(Respawn.isResting(mastered)).toBe(false);
        expect(rested.filter(id => id === other.id).length).toBeGreaterThan(0);
    });
});
