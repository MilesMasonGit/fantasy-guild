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
import { effectBreakdown, EFFECT_KEY } from '../systems/board/EffectBreakdown.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { getUpgradeDef } from '../config/guildUpgrades.js';
import { resetMatTuning } from '../config/matTuning.js';
import { setUpGiantHarvestScene } from '../ui/dev/giantHarvestScene.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The Giant Harvest eye-check scene (brief 620 E1): one click lays out a vein, its miner and a Hall
 * star at 50 %, so the owner sees a Giant Harvest and its celebration within a few cycles.
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

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

describe('the Giant Harvest scene', () => {
    it('lays out a worked vein the QA star reaches, and a Giant Harvest is celebrated within a few cycles', () => {
        const scene = setUpGiantHarvestScene();
        expect(scene).toMatchObject({ ok: true });
        const vein = BoardState.getTokenById(scene.instanceId);
        expect(vein).toBeTruthy();
        expect(BoardState.workerOf(vein.id)).toBe(scene.heroId);
        expect(getUpgradeDef('qa_giant_star')).toBeTruthy();
        expect(effectBreakdown(vein.id).effects.find(b => b.key === EFFECT_KEY.GIANT_HARVEST)).toMatchObject({ total: 50 });

        const giants = [];
        let cycles = 0;
        const offs = [
            EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (e) => { if (e.giant) giants.push(e.instanceId); }),
            EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (e) => { if (e.instanceId === vein.id) cycles += 1; })
        ];
        // Walk over and ten cycles of 2 s.
        run(40_000);
        offs.forEach(off => off());
        expect(cycles).toBeGreaterThanOrEqual(8);
        expect(giants.length).toBeGreaterThan(0);
        expect(giants.every(id => id === vein.id)).toBe(true);
        // Roughly half the cycles, never all of them.
        expect(giants.length).toBeLessThan(cycles);
    });
});
