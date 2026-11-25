import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Flags from '../systems/board/Flags.js';
import * as Fishing from '../systems/board/Fishing.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { getPaletteEntry, MODIFIER_SHAPES } from '../config/registries/modifierPalette.js';
import { registerTokenTypes, getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Master Angler (brief 800 P2, Fishing 99): a catch sometimes comes from the next tier. Brief
 * 850 retired the bait ladder the row was written for (one Bait now; a lure picks the fish), so the
 * next tier is read as the **next fish up** the pool the hero fishes: the fish of the lowest Fishing
 * level above the one that bit, among those the hero's level allows. The Bait spent is the fish
 * that bit's, never the better one's; a lure still picks, and may still break; a pool with nothing
 * above (the top fish, a Trap's one catch) lands what bit and draws nothing. As a chance (Better
 * Catch), drawn once after the pick and only when there is a fish above.
 */

const fish = (id, name, block) => ({ id, name, type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw', fish: block });
const carried = (id, name, extra = {}) => ({ id, name, type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait', ...extra });
const tool = (id, name, kind) => ({ id, name, type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_rod_wood', tool: { kind, tier: 1 } });

registerItems({
    ma_trout: fish('ma_trout', 'Trout', { level: 1, cycleMs: 2000, bait: 1 }),
    ma_tuna: fish('ma_tuna', 'Tuna', { level: 5, cycleMs: 3000, bait: 2 }),
    ma_salmon: fish('ma_salmon', 'Salmon', { level: 20, cycleMs: 5000, bait: 3 }),
    ma_shrimp: fish('ma_shrimp', 'Raw Shrimp', { level: 1, cycleMs: 1000 }),
    ma_bait: carried('ma_bait', 'Bait'),
    ma_trout_lure: carried('ma_trout_lure', 'Trout Lure', { lure: { fish: ['ma_trout'], breakChance: 50 } }),
    ma_rod: tool('ma_rod', 'Rod', 'fishing_rod'),
    ma_trap: tool('ma_trap', 'Trap', 'fishing_trap')
});

registerTokenTypes({
    ma_lake: {
        id: 'ma_lake', name: 'MA Lake', tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 't_lake_small',
        requiresHero: true, uses: null, tags: ['water'],
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        catchPools: [
            // Written out of level order: "next up" is by the fish's level, not the pool's order.
            { tool: 'fishing_rod', bait: 'ma_bait', catches: [
                { itemId: 'ma_salmon', weight: 1 }, { itemId: 'ma_trout', weight: 3 }, { itemId: 'ma_tuna', weight: 1 }
            ] },
            { tool: 'fishing_trap', catches: [{ itemId: 'ma_shrimp', weight: 1 }] }
        ]
    }
});

const angles = (id, value) => ({
    id, name: id,
    statements: [{
        id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
        payload: { type: EFFECT_TYPES.BETTER_CATCH, bucket: 'flat', value, category: 'fishing' }
    }]
});
registerEffects({ ma_master_angler: angles('ma_master_angler', 100), ma_half: angles('ma_half', 50) });

const AT = { x: 600, y: 500 };

function hero(id, grid, fishing) {
    const equipment = Array.from({ length: 9 }, (_, i) => grid[i] || null);
    const heldCopies = equipment.map(itemId => !!itemId && getAllItems()[itemId]?.equipSlot === 'hand');
    return { id, name: id, status: 'idle', level: 10, skills: { fishing: { level: fishing, xp: 0 } },
        hp: { current: 100, max: 100 }, equipment, heldCopies };
}

function lake() {
    const instance = BoardState.createTokenInstance('ma_lake', tokenStartingUses('ma_lake'));
    expect(Placement.placeTokenAt(instance, AT)?.success).not.toBe(false);
    return instance;
}
const def = () => getTokenType('ma_lake');

/** `Math.random` answering `values` in turn (then 0.99). */
function rolls(...values) {
    return vi.spyOn(Math, 'random').mockImplementation(() => (values.length ? values.shift() : 0.99));
}
// The rod pool's weights in its order (Salmon 1, Trout 3, Tuna 1, of 5): a roll picks by where it falls.
const PICK = { salmon: 0.1, trout: 0.5, tuna: 0.9 };

beforeAll(() => Flags.init());
afterAll(() => {
    registerSkillPerks({ fishing: { perks: [] } });
    Flags.teardown();
    resetMatTuning();
});
afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    registerSkillPerks({ fishing: { perks: [{ level: 99, effectId: 'ma_master_angler' }] } });
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [];
});

describe('the effect: Better Catch, a chance on a skill the CMS offers', () => {
    it('is a chance narrowed to the work\'s skill, and the effect editor lists it', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.BETTER_CATCH);
        expect(entry).toMatchObject({ shape: MODIFIER_SHAPES.PROC, categories: 'skill', scales: 'value' });
        expect(entry.explains).toMatch(/next fish/i);
        expect(paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type)).toContain(EFFECT_TYPES.BETTER_CATCH);
    });
});

describe('a catch from the next fish up', () => {
    it('a Trout that bites lands as the Tuna, the next level up; the Trout\'s one Bait is spent', () => {
        const water = lake();
        GameState.state.heroes = [hero('master', ['ma_rod', 'ma_bait'], 99)];
        InventoryManager.addItem('ma_bait', 10);
        const spy = rolls(PICK.trout);
        const caught = Fishing.catchOf(water.id, def(), 'master');
        expect(caught).toMatchObject({ itemId: 'ma_tuna', baitSpent: 1 });
        expect(InventoryManager.getItemCount('ma_bait')).toBe(9);
        // The pick, and nothing more: at 100 % the better catch is sure.
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('a Tuna lands as the Salmon; the Salmon, the top fish, stays itself and draws nothing more', () => {
        const water = lake();
        GameState.state.heroes = [hero('master', ['ma_rod', 'ma_bait'], 99)];
        InventoryManager.addItem('ma_bait', 10);
        rolls(PICK.tuna);
        expect(Fishing.catchOf(water.id, def(), 'master')).toMatchObject({ itemId: 'ma_salmon', baitSpent: 2 });
        vi.restoreAllMocks();
        const spy = rolls(PICK.salmon);
        expect(Fishing.catchOf(water.id, def(), 'master')).toMatchObject({ itemId: 'ma_salmon', baitSpent: 3 });
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('without it, what bites lands', () => {
        const water = lake();
        GameState.state.heroes = [hero('novice', ['ma_rod', 'ma_bait'], 98)];
        InventoryManager.addItem('ma_bait', 10);
        rolls(PICK.trout);
        expect(Fishing.catchOf(water.id, def(), 'novice')).toMatchObject({ itemId: 'ma_trout', baitSpent: 1 });
    });

    it('the next fish must be one the hero\'s level allows: at Fishing 10 a Tuna stays a Tuna', () => {
        // Held from gear at a lower level: the Salmon (20) is above them.
        registerSkillPerks({ fishing: { perks: [{ level: 5, effectId: 'ma_master_angler' }] } });
        const water = lake();
        GameState.state.heroes = [hero('apprentice', ['ma_rod', 'ma_bait'], 10)];
        InventoryManager.addItem('ma_bait', 10);
        // At level 10 the pool they roll is Trout 3 and Tuna 1: 0.9 picks the Tuna.
        const spy = rolls(0.9);
        expect(Fishing.catchOf(water.id, def(), 'apprentice')).toMatchObject({ itemId: 'ma_tuna' });
        expect(spy).toHaveBeenCalledTimes(1);
        vi.restoreAllMocks();
        rolls(0.1);
        expect(Fishing.catchOf(water.id, def(), 'apprentice')).toMatchObject({ itemId: 'ma_tuna' });
    });

    it('a lure still picks its fish, and may still break: the Trout it picked lands as the Tuna', () => {
        const water = lake();
        GameState.state.heroes = [hero('master', ['ma_rod', 'ma_bait', 'ma_trout_lure'], 99)];
        InventoryManager.addItem('ma_bait', 10);
        InventoryManager.addItem('ma_trout_lure', 2);
        // One fish to pick (no draw), then the lure's break roll: 0.2 is under its 50.
        const spy = rolls(0.2);
        expect(Fishing.catchOf(water.id, def(), 'master')).toMatchObject({ itemId: 'ma_tuna', lure: 'ma_trout_lure', lureBroke: true, baitSpent: 1 });
        expect(spy).toHaveBeenCalledTimes(1);
        expect(InventoryManager.getItemCount('ma_trout_lure')).toBe(1);
    });

    it('a Trap\'s one catch has nothing above it: it lands and draws nothing', () => {
        const water = lake();
        GameState.state.heroes = [hero('master', ['ma_trap'], 99)];
        const spy = rolls();
        expect(Fishing.catchOf(water.id, def(), 'master')).toMatchObject({ itemId: 'ma_shrimp' });
        expect(spy).not.toHaveBeenCalled();
    });

    it('at half, one draw after the pick: under 50 lands the next fish, over it what bit', () => {
        registerSkillPerks({ fishing: { perks: [{ level: 99, effectId: 'ma_half' }] } });
        const water = lake();
        GameState.state.heroes = [hero('master', ['ma_rod', 'ma_bait'], 99)];
        InventoryManager.addItem('ma_bait', 10);
        let spy = rolls(PICK.trout, 0.4);
        expect(Fishing.catchOf(water.id, def(), 'master').itemId).toBe('ma_tuna');
        expect(spy).toHaveBeenCalledTimes(2);
        vi.restoreAllMocks();
        spy = rolls(PICK.trout, 0.6);
        expect(Fishing.catchOf(water.id, def(), 'master').itemId).toBe('ma_trout');
        expect(spy).toHaveBeenCalledTimes(2);
    });
});

describe('on the mat', () => {
    it('a master angler\'s catches land a fish up, and the Bait spent is what bit', () => {
        lake();
        GameState.state.heroes = [hero('master', ['ma_rod', 'ma_bait'], 99)];
        InventoryManager.addItem('ma_bait', 200);
        Orders.orderAt('master', AT);
        const landed = [];
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => landed.push(...p.produced));
        for (let t = 0; t < 120_000; t += 100) BoardRunner.tick(100);
        off();
        expect(landed.length).toBeGreaterThan(10);
        // Nothing lands as the Trout: every Trout that bites comes up a Tuna.
        expect(landed).not.toContain('ma_trout');
        expect(new Set(landed)).toEqual(new Set(['ma_tuna', 'ma_salmon']));
    });
});
