import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as FixedTokens from '../systems/board/FixedTokens.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { setUpMiningScene, miningReadout, QA_MINING as T, MINING_SPOTS, EMPTY_ROCK } from '../ui/dev/miningDev.js';
import { clearMat } from './fixtures/mat.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

// The QA Miner is Mining 10: the shipped perks are content, not the Mining rulings shown here.
withoutShippedPerks();

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The QA panel's Mining button (brief 230 S3): the owner's way to see the Mining rulings by
 * clicking. It lays its Tokens out, and the engine does the rest.
 */

beforeAll(() => { BoardRunner.init(); Flags.init(); });

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    clearMat();
});

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const at = (p) => BoardState.tokensAtPoint(p.x, p.y)[0] ?? null;

describe('the Mining scene', () => {
    it('⭐ shows every ruling by itself: the vein works fast, rests as the rock, refills all at once; the empty iron vein is the same rock', () => {
        expect(setUpMiningScene()).toEqual({ ok: true });
        const copper = BoardState.tokens().find(t => t.typeId === T.COPPER_VEIN);
        const iron = BoardState.tokens().find(t => t.typeId === T.IRON_VEIN);
        expect(at(MINING_SPOTS.copper)).toBe(copper);
        expect(copper.typeId).toBe(T.COPPER_VEIN);
        expect(iron.typeId).toBe(T.IRON_VEIN);
        expect(FixedTokens.isFixed(copper)).toBe(true);

        // The iron vein starts as the rock; the copper vein as its ore.
        expect(Respawn.restingSpriteOf(iron)).toBe(EMPTY_ROCK);
        expect(Respawn.restingSpriteOf(copper)).toBeNull();
        expect(miningReadout().join('\n')).toMatch(/Works in 2\.0 s .*doubles Copper Ore 50 %, Quartz 0 %/);

        // Five ore at 2 s, then it rests as the rock.
        run(14000);
        expect(copper.usesRemaining).toBe(0);
        expect(Respawn.restingSpriteOf(copper)).toBe(EMPTY_ROCK);
        expect(miningReadout()[0]).toMatch(/^QA Copper Vein: resting, refills in/);

        // A minute later, all five back at once.
        run(60000);
        expect(copper.usesRemaining).toBeGreaterThan(0);
        expect(miningReadout().join('\n')).toMatch(/Since the scene: \d+ Copper Ore/);
    });
});
