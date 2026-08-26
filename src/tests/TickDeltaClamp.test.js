import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { TimeManager } from '../systems/core/TimeManager.js';
import { TimeBankManager } from '../systems/core/TimeBankManager.js';
import { MAX_TICK_DELTA_MS, TIME_BANK } from '../config/loopConstants.js';

// CR2-041: a single tick used to carry the whole gap since the last one, so a
// sleeping laptop added its entire sleep to `meta.totalPlaytime` and
// `time.gameTimeMs` while producing nothing. The delta is now clamped, and the
// remainder is routed to the Time Bank (owner decision 4, 2026-08-19) rather
// than discarded.

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(),
    error: vi.fn(), getQueue: vi.fn(() => [])
}));

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

/** Freeze the clock so deltas are exact rather than "about 100ms". */
let clock = 1_000_000_000_000;
const advance = ms => { clock += ms; };

describe('Tick delta clamp (CR2-041)', () => {
    let nowSpy;
    let wasRunning;

    beforeEach(() => {
        clock = 1_000_000_000_000;
        nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => clock);

        GameState.initNew();
        TimeBankManager.isSpending = false;
        TimeBankManager.activeMultiplier = 1;
        TimeManager.setTimeScale(1);
        TimeManager.init();
        GameState.state.time.timeBankMs = 0;
        GameState.state.meta.totalPlaytime = 0;
        GameState.state.time.gameTimeMs = 0;

        wasRunning = GameLoop.isRunning;
    });

    afterEach(() => {
        GameLoop.isRunning = wasRunning;
        nowSpy.mockRestore();
    });

    // ------------------------------------------------------------------
    // The clock itself
    // ------------------------------------------------------------------

    it('clamps an eight-hour gap to the maximum tick delta', () => {
        advance(EIGHT_HOURS_MS);
        expect(TimeManager.update()).toBe(MAX_TICK_DELTA_MS);
    });

    it('passes a normal frame delta through unchanged', () => {
        advance(100);
        expect(TimeManager.update()).toBe(100);
        expect(TimeManager.consumeOverflow()).toBe(0);
    });

    it('passes a slow frame well under the ceiling through unchanged', () => {
        advance(750);
        expect(TimeManager.update()).toBe(750);
        expect(TimeManager.consumeOverflow()).toBe(0);
    });

    it('does not advance game time by eight hours', () => {
        advance(EIGHT_HOURS_MS);
        TimeManager.update();
        expect(TimeManager.getGameTime()).toBe(MAX_TICK_DELTA_MS);
    });

    it('parks the undelivered remainder as overflow, once', () => {
        advance(EIGHT_HOURS_MS);
        TimeManager.update();
        expect(TimeManager.consumeOverflow()).toBe(EIGHT_HOURS_MS - MAX_TICK_DELTA_MS);
        // Taken, not left lying around for the next tick to bank again.
        expect(TimeManager.consumeOverflow()).toBe(0);
    });

    it('produces no overflow while paused', () => {
        TimeManager.pause();
        advance(EIGHT_HOURS_MS);
        expect(TimeManager.update()).toBe(0);
        expect(TimeManager.consumeOverflow()).toBe(0);
        TimeManager.resume();
    });

    // ------------------------------------------------------------------
    // The saved fields — the symptom the ticket reproduced
    // ------------------------------------------------------------------

    describe('through the shipped time_tracking handler', () => {
        let unregister = false;

        beforeEach(() => {
            // The real handler EngineBootstrap registers, reproduced here so
            // the assertion is about the two SAVED fields and not about the
            // clock in isolation. Kept in step with
            // `EngineBootstrap._registerTickHandlers`.
            GameLoop.onTick('test_time_tracking', (delta) => {
                GameState.updateTime({
                    gameTimeMs: GameState.time.gameTimeMs + delta,
                    lastTickAt: Date.now()
                });
                GameState.state.meta.totalPlaytime =
                    (GameState.state.meta.totalPlaytime || 0) + delta;
            });
            unregister = true;
            GameLoop.isRunning = true;
        });

        afterEach(() => {
            if (unregister) GameLoop.offTick('test_time_tracking');
            unregister = false;
        });

        it('an eight-hour gap adds at most one clamped tick of playtime', () => {
            advance(EIGHT_HOURS_MS);
            GameLoop.tick();

            expect(GameState.state.meta.totalPlaytime).toBe(MAX_TICK_DELTA_MS);
            expect(GameState.state.time.gameTimeMs).toBe(MAX_TICK_DELTA_MS);
            expect(GameState.state.meta.totalPlaytime).toBeLessThan(EIGHT_HOURS_MS);
        });

        it('normal ticks still accumulate playtime as before', () => {
            for (let i = 0; i < 5; i++) {
                advance(100);
                GameLoop.tick();
            }
            expect(GameState.state.meta.totalPlaytime).toBe(500);
            expect(GameState.state.time.gameTimeMs).toBe(500);
        });
    });

    // ------------------------------------------------------------------
    // Where the excess goes
    // ------------------------------------------------------------------

    describe('routing the excess to the Time Bank', () => {
        beforeEach(() => {
            TimeBankManager.init();     // idempotent; wires the subscription
            GameLoop.isRunning = true;
        });

        it('banks the time the clamp refused to deliver', () => {
            advance(EIGHT_HOURS_MS);
            GameLoop.tick();

            expect(TimeBankManager.getBankedMs())
                .toBe(EIGHT_HOURS_MS - MAX_TICK_DELTA_MS);
        });

        it('banks nothing on a normal tick', () => {
            advance(100);
            GameLoop.tick();
            expect(TimeBankManager.getBankedMs()).toBe(0);
        });

        it('still honours the 24-hour bank cap', () => {
            advance(TIME_BANK.MAX_MS * 3);
            GameLoop.tick();
            expect(TimeBankManager.getBankedMs()).toBe(TIME_BANK.MAX_MS);
        });

        it('does not double-bank on the following tick', () => {
            advance(EIGHT_HOURS_MS);
            GameLoop.tick();
            const afterFirst = TimeBankManager.getBankedMs();

            advance(100);
            GameLoop.tick();
            expect(TimeBankManager.getBankedMs()).toBe(afterFirst);
        });
    });
});
