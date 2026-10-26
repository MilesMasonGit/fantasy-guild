import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as Fields from '../systems/board/Fields.js';
import * as Growth from '../systems/board/Growth.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { listRecipes } from '../config/registries/recipePoolRegistry.js';
import { setUpFarmingScene, giveSageSeeds, farmingReadout, QA_FARMING as T, QA_ITEMS, FARMING_SPOTS, FIELD_ART } from '../ui/dev/farmingDev.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The QA panel's Farming button (brief 230 S4): the owner's way to see the Farming rulings by
 * clicking. It lays its Tokens out, and the engine does the rest.
 */

beforeAll(() => { BoardRunner.init(); Flags.init(); TimedChanges.init(); });

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    Growth.resetGrowthAlerts();
    clearMat();
    GameState.state.inventory.maxSlots = 50;
});

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const at = (p) => BoardState.tokensAtPoint(p.x, p.y)[0] ?? null;
const stage = (p) => Fields.stageOf(at(p));

describe('the Farming scene', () => {
    it('⭐ shows every ruling by itself', () => {
        expect(setUpFarmingScene()).toEqual({ ok: true });
        const s = FARMING_SPOTS;
        expect(at(s.wild).typeId).toBe(T.WILD);
        expect(at(s.beehive).typeId).toBe(T.BEEHIVE);
        // The shipped Farming recipes stay beside the QA crops.
        expect(listRecipes().filter(r => r.skill === 'farming').length).toBeGreaterThan(2);
        // A QA Field is a Field, so it offers the shipped crop of its kind as well as its QA one.
        expect(StationRecipe.poolFor(getTokenType(T.FIELD)).map(r => r.id)).toEqual(['recipe_wheat', T.WHEAT]);
        expect(StationRecipe.poolFor(getTokenType(T.HERB_GARDEN)).map(r => r.id)).toEqual(['recipe_lavender', T.SAGE]);

        // The first tick: one Field sows, the Herb Garden stops; the wild patch and the other Field are ripe.
        run(100);
        expect(stage(s.wild)).toBe('ripe');
        expect(stage(s.growing)).toBe('growing');
        expect(stage(s.ripe)).toBe('ripe');
        expect(Fields.loadLeft(at(s.ripe))).toBe(6);
        expect(stage(s.herbGarden)).toBe('empty');
        expect(Growth.growthAlertOf(at(s.herbGarden).id)).toEqual({ alert: 'grow_needs_item', needs: [QA_ITEMS.SAGE_SEED] });
        expect(stage(s.empty)).toBe('empty');
        expect(Fields.stateSpriteOf(at(s.ripe))).toBe(FIELD_ART.WHEAT);
        expect(Fields.stateSpriteOf(at(s.growing))).toBe(FIELD_ART.GROWING);
        // The Well halves the growth.
        expect(Fields.nextRipening(at(s.growing)).totalMs).toBe(60000);

        const text = () => farmingReadout().join('\n');
        expect(text()).toMatch(/QA Wild Wheat: ripe QA Wheat, 4 of 4 harvests left/);
        expect(text()).toMatch(/QA Field: growing QA Wheat, ripe in 1:00 \(grows 1:00, authored 2:00\)/);
        expect(text()).toMatch(/QA Field: ripe QA Wheat, 6 of 6 harvests left \(the crop's load is 4\)/);
        expect(text()).toMatch(/QA Herb Garden: stopped, needs QA Sage Seed to sow QA Sage/);
        expect(text()).toMatch(/QA Field: empty, nothing picked/);

        // The farmer harvests the ripe Field, sows it again, and goes on to the others.
        run(30000);
        expect(text()).toMatch(/Since the scene: [1-9]\d* Wheat/);
        expect(stage(s.ripe)).not.toBe('ripe');

        // Seeds for the Herb Garden: it sows.
        giveSageSeeds();
        run(200);
        expect(stage(s.herbGarden)).toBe('growing');
    });
});
