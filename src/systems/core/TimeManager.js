import { MAX_TICK_DELTA_MS } from '../../config/loopConstants.js';

/**
 * TimeManager: measures the delta between ticks. The game's own clock is `time.gameTimeMs` in the
 * save (`EngineBootstrap`'s time_tracking handler), not anything here.
 */

class TimeManagerClass {
    constructor() {
        this.lastTickTime = 0;
        /**
         * Game-time this tick could not deliver because it exceeded
         * MAX_TICK_DELTA_MS. Read and zeroed by `GameLoop` via
         * `consumeOverflow()`, which hands it to the catch-up (`CatchUp`).
         */
        this.overflowMs = 0;
    }

    /** Start measuring from now. */
    init() {
        // `performance.now()`, not `Date.now()` — see `update()`.
        this.lastTickTime = performance.now();
        this.overflowMs = 0;
    }

    /**
     * Update time tracking - called at start of each tick.
     *
     * Reads `performance.now()`, not `Date.now()`: the OS can step the wall clock
     * (manual change, NTP, DST), which made working Tokens' `cycleElapsedMs` go
     * negative so `BoardRunner` replayed `CYCLE_START` every tick. The wall clock
     * stays for *time away* (`SaveManager`'s `savedAt`, the catch-up on load),
     * which only it can answer.
     *
     * The returned delta is CLAMPED to `MAX_TICK_DELTA_MS` (a sleeping laptop or
     * suspended tab would otherwise hand the next tick the whole gap as time
     * played) and FLOORED at 0 (a negative delta must never reach a handler).
     * The clipped remainder is parked on `overflowMs` for `GameLoop` to hand to
     * the catch-up, which plays it.
     *
     * @returns {number} Delta time in milliseconds, at most MAX_TICK_DELTA_MS, at least 0
     */
    update() {
        const now = performance.now();

        // Floor at 0 first so a backward step can neither produce a negative delta
        // nor subtract from `overflowMs` below.
        const elapsed = Math.max(0, now - this.lastTickTime);
        const delta = Math.min(elapsed, MAX_TICK_DELTA_MS);
        this.overflowMs += elapsed - delta;
        this.lastTickTime = now;

        return delta;
    }

    /**
     * Take the accumulated overflow, zeroing it. Called once per tick by
     * `GameLoop`, which publishes it for the catch-up to play.
     * @returns {number} Un-delivered game time in milliseconds
     */
    consumeOverflow() {
        const overflow = this.overflowMs;
        this.overflowMs = 0;
        return overflow;
    }
}

// Export singleton instance
export const TimeManager = new TimeManagerClass();
