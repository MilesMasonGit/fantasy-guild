import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { resetMatTuning } from '../config/matTuning.js';
import { setUpWorkConsumablesScene, workConsumablesReadout, QA_WORK } from '../ui/dev/workConsumablesDev.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The QA panel's work consumables button (brief 230 S6b): the owner's way to see, by clicking, a
 * forester drink a Birdwatcher each Forestry cycle and a Coffee every ten, and a miner keep theirs.
 */

beforeAll(() => { BoardRunner.init(); Flags.init(); LoadoutMoments.init(); });
afterAll(() => { Flags.teardown(); LoadoutMoments.teardown(); resetMatTuning(); });

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [];
});

describe('the work consumables scene', () => {
    it('a forester drinks a Birdwatcher each Forestry cycle and a Coffee for ten; the miner keeps theirs', () => {
        expect(setUpWorkConsumablesScene()).toEqual({ ok: true });
        for (const typeId of [QA_WORK.TREE, QA_WORK.VEIN]) {
            expect(BoardState.tokens().some(t => t.typeId === typeId), typeId).toBe(true);
        }
        const before = workConsumablesReadout();
        expect(before[0]).toBe('Bank: 20 QA Birdwatchers, 3 QA Coffees');
        expect(before[2]).toMatch(/^ {2}a cycle every 8\.0 s; carrying now: nothing$/);

        for (let t = 0; t < 30_000; t += 100) BoardRunner.tick(100);
        const after = workConsumablesReadout();
        const cycles = Number(after[1].match(/(\d+) Oak cycles/)[1]);
        expect(cycles).toBeGreaterThanOrEqual(5);
        // One Birdwatcher a Forestry cycle started (the one running now included), one Coffee so far.
        const drunk = Number(after[1].match(/(\d+) Birdwatchers and/)[1]);
        expect(drunk === cycles || drunk === cycles + 1).toBe(true);
        expect(after[1]).toContain('1 Coffees drunk');
        expect(after[1]).toMatch(/Coffee \d of 10 cycles left/);
        expect(after[0]).toBe(`Bank: ${20 - drunk} QA Birdwatchers, 2 QA Coffees`);
        expect(after[4]).toMatch(/^QA Miner: 0 Birdwatchers drunk/);
    });
});
