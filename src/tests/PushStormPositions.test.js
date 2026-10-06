import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { EventBus } from '../systems/core/EventBus.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import S4 from '../../bench/scenarios/s4-push-storm.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

// The scenario hashes the board after each stage with the bench's
// `tokensHash`, which includes Token ids (and an id carries the wall clock and
// a random suffix). Here the same checkpoints hash arrival order, type and
// exact point only, so the golden depends on nothing but the placement maths.
vi.mock('../../bench/lib/fingerprint.mjs', async (importOriginal) => {
    const real = await importOriginal();
    const BS = await import('../systems/board/BoardState.js');
    return {
        ...real,
        tokensHash: () => real.fnv1a(BS.tokens().map(t => `${t.placedAt}|${t.typeId}|${t.x}|${t.y}`).join('\n'))
    };
});

/**
 * ⭐ A position golden for the push solver and the nudge search, taken on
 * `main` BEFORE either is made faster.
 */

/** The bench's seeded generator (bench/lib/prelude.mjs, mulberry32). */
function seeded(seed = 1) {
    let state = seed | 0;
    return () => {
        state = (state + 0x6D2B79F5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

describe('⭐ the S4 push storm lands every Token on the same point (CR3-003, CR3-150 golden)', () => {
    const seen = {};

    beforeAll(async () => {
        vi.spyOn(Math, 'random').mockImplementation(seeded(1));
        vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
        vi.spyOn(console, 'log').mockImplementation(() => {});
        resetMatTuning();
        SettingsManager.init();
        EngineBootstrap.init();
        GameLoop.stop();
        GameState.initNew();
        InventoryManager.init();

        const ctx = { fixtures, setMatTuning, now: () => 0 };
        await S4.build(ctx);
        TileModifiers.rebuildAll();
        EventBus.publish('state_changed');

        const result = await S4.custom(ctx);
        seen.identity = result.identity;
        seen.tokens = BoardState.tokens().length;
    }, 30000);

    afterAll(() => {
        vi.restoreAllMocks();
        resetMatTuning();
    });

    it('does the same work as the bench baseline: every count and the measured rim', () => {
        const id = seen.identity;
        expect(seen.tokens).toBe(135);
        expect(id.clustered).toBe(24);
        expect(id.arrivalsLanded).toBe(50);
        expect(id.refusedDropsLanded).toBe(0);
        expect([id.landingPlaced, id.landingNudged, id.landingRefused, id.landingRestocked]).toEqual([0, 50, 0, 0]);
        expect(id.rimRadius).toBe(310.8058415243332);
    });

    // Literals taken on from main (cbaa58f) plus this branch's test-only
    // commits,.
    it('after the 50 arrivals (the push solver, CR3-003)', () => {
        expect(seen.identity.positionsAfterArrivals).toBe('3d42fba4');
    });

    it('after the 50 landing drops (the nudge search, CR3-150)', () => {
        expect(seen.identity.positionsAfterDrops).toBe('97ff6156');
    });

    it('after the shrink from 20 steps to 6', () => {
        expect(seen.identity.positionsAfterShrink).toBe('4eff6cb1');
    });
});
