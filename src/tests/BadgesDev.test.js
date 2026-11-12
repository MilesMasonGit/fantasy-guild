import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Flags from '../systems/board/Flags.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { effectBreakdown } from '../systems/board/EffectBreakdown.js';
import { tokenCardModel, CARD_BLOCK } from '../ui/components/board/tokenCard.js';
import { setUpBadgeScene, QA_BADGES } from '../ui/dev/badgesDev.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The QA panel's Effect badges button (brief 600 B3): one click lays out Tokens whose cards show
 * each of the brief's card checks, so the owner's eye-check needs no console.
 */

beforeAll(() => { BoardRunner.init(); Flags.init(); LoadoutMoments.init(); });
afterAll(() => { Flags.teardown(); LoadoutMoments.teardown(); resetMatTuning(); });

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    registerHallSky(null);
    HallRules.apply({});
});

const instanceOf = (typeId) => BoardState.tokens().find(t => t.typeId === typeId);
const keys = (out) => out.effects.map(b => b.key);

describe('the badge scene', () => {
    it('the Furnace, the held Mine and the Goblin each show their badges', () => {
        expect(setUpBadgeScene()).toEqual({ ok: true });
        const furnace = effectBreakdown(instanceOf(QA_BADGES.FURNACE).id);
        expect(keys(furnace)).toEqual(['speed', 'xp', 'preservation', 'refresh', 'lucky']);
        expect(furnace.effects[0].sources.map(s => s.name)).toEqual([
            'QA Badge Forge nearby', 'Hall star QA Badge Training I', 'QA Badge Smith\'s QA Quick Cap'
        ]);
        expect(furnace.effects[0].total).toBeCloseTo(23);
        expect(furnace.hero).toMatchObject({ name: 'QA Badge Smith' });
        expect(furnace.outputs.map(l => l.itemId)).toEqual(['item_copper_ingot']);
        expect(furnace.inputs.map(l => l.itemId)).toEqual(['item_copper_ore']);
        const recipe = tokenCardModel(QA_BADGES.FURNACE, instanceOf(QA_BADGES.FURNACE).id).blocks.find(b => b.id === CARD_BLOCK.RECIPE);
        expect(recipe.needs[0].need).toBe(9);
        expect(recipe.rare.rows.map(r => r.itemId)).toEqual(['item_quartz', 'item_gold_ore']);

        const mine = effectBreakdown(instanceOf(QA_BADGES.MINE).id);
        expect(mine.effects[0]).toMatchObject({ key: 'speed', held: true });

        const goblin = effectBreakdown(instanceOf(QA_BADGES.GOBLIN).id);
        expect(keys(goblin)).toEqual(['xp', 'doubleLoot']);
        expect(goblin.outputs[0]).toMatchObject({ itemId: 'item_bones' });
    });
});
