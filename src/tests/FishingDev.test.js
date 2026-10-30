import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { setUpFishingScene, fishingReadout, QA_FISHING } from '../ui/dev/fishingDev.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The QA panel's fishing button (brief 230 S5): the owner's way to see, by clicking, a lake fished
 * with a rod and worms beside a Dock, a river fished with a rod and no bait, and a sea fished with a
 * net.
 */

beforeAll(() => { BoardRunner.init(); Flags.init(); });
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [];
});

describe('the fishing scene', () => {
    it('lays out three waters and a Dock, each fisher fishing their own way, the worms running out', () => {
        expect(setUpFishingScene()).toEqual({ ok: true });
        for (const typeId of [QA_FISHING.LAKE, QA_FISHING.RIVER, QA_FISHING.SEA, QA_FISHING.DOCK]) {
            expect(BoardState.tokens().some(t => t.typeId === typeId), typeId).toBe(true);
        }
        const lines = fishingReadout();
        expect(lines[0]).toMatch(/^QA Lake: QA Angler, Fishing Rod and QA Worm \(5 left\); a catch every 7\.0 s \(10\.0 s authored, sped by the Dock; never under 2\.0 s\)/);
        expect(lines[1]).toMatch(/^QA River: QA Plain Angler, Fishing Rod, no bait: the basic pool; a catch every 10\.0 s; never runs out/);
        expect(lines[2]).toMatch(/^QA Sea: QA Netter, Fishing Net, no bait: the basic pool; a catch every 10\.0 s/);

        for (let t = 0; t < 60_000; t += 100) BoardRunner.tick(100);
        const after = fishingReadout();
        expect(after[0]).toMatch(/Fishing Rod, no bait: the basic pool/);
        expect(InventoryManager.getItemCount(QA_FISHING.WORM)).toBe(0);
        expect(after.filter(l => l.startsWith('  last catches:'))).toHaveLength(3);
        expect(after.find(l => /^ {2}last catches:/.test(l) && /Raw Shrimp|QA Lobster/.test(l))).toBeTruthy();
    });
});
