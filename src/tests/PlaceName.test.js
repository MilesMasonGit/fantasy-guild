import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { flavourName } from '../systems/atlas/regionNames.js';
import * as World from '../systems/world/World.js';
import { resetMatTuning } from '../config/matTuning.js';

/**
 * The world map names a place before the guild has been there, from the cell's seed; settling
 * writes its Region from the first layout seed in which everything fits, which can be a later
 * one. The Region must still take the name the map showed.
 */

// Every cell's own layout seed "does not fit", so settling moves on to a later seed.
const ownSeeds = vi.hoisted(() => new Set());
vi.mock('../systems/atlas/Atlas.js', async (importOriginal) => {
    const real = await importOriginal();
    return {
        ...real,
        preview: (recipes, options = {}) => {
            const plan = real.preview(recipes, options);
            return ownSeeds.has(options.seed) ? { ...plan, fits: false } : plan;
        }
    };
});
vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});
beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
    World.createWorld({ seed: 77 });
});
afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a place keeps the name the world map showed', () => {
    it('even when its layout moved on to a later seed', () => {
        const cell = World.currentWorld().cells.find(c => c.id === '1,0');
        ownSeeds.add(cell.seed >>> 0);
        const written = World.writePlace(cell, { cellId: cell.id });
        expect(written.success).toBe(true);
        expect(written.region.seed).not.toBe(cell.seed >>> 0);
        expect(flavourName(written.region.seed)).not.toBe(World.placeName(cell));
        expect(written.region.flavourName).toBe(World.placeName(cell));
    });
});
