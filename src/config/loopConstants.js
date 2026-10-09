// Fantasy Guild - Engine Tunables
// Gameplay numbers that the engine imports, so they can be tuned in one place.
// All times are in milliseconds.
// ⚠️ Only put a value here if code actually imports it: tuning an unread value changes nothing.

/** Milliseconds between game ticks (100 = 10 ticks/sec). Read by `GameLoop`. */
export const TICK_INTERVAL_MS = 100;

/**
 * Upper bound on the game-time a SINGLE tick may advance. Read by
 * `TimeManager.update()`; anything past it is caught up (`CatchUp`) rather
 * than discarded.
 *
 * **Why 1000 ms.** `BoardRunner.tick` floors every work cycle at
 * `Math.max(1000, …)` and completes **at most one** cycle per tick, so a tick
 * carrying more than 1000 ms of game time cannot be fully credited to the board.
 *
 * It is also 10× a normal frame, which is ample headroom for a slow machine, a
 * heavy render, or a hidden tab whose timer Chrome has throttled to ~1/second.
 * A suspended tab or a sleeping laptop returns deltas orders of magnitude
 * larger, so those are what this catches.
 */
export const MAX_TICK_DELTA_MS = 1000;

/**
 * Catching up on time the game was not running (`CatchUp.js`): a closed game's time away on load,
 * and a gap the live loop could not deliver (a sleeping PC, a background browser tab).
 */
export const CATCH_UP = Object.freeze({
    /** The most time away that is played; anything beyond is dropped. */
    CAP_MS: 24 * 60 * 60 * 1000,
    /**
     * One step of the whole engine. The largest safe step is the live tick's own ceiling: a work
     * cycle completes at most once a tick and is floored at 1000 ms.
     */
    STEP_MS: MAX_TICK_DELTA_MS,
    /** Steps run in slices of about this much work, yielding between them so the page can draw. */
    SLICE_MS: 50,
    /**
     * A gap the live loop missed of at least this much is caught up with the loading bar and the
     * summary; a shorter one (a background tab woken once a minute) is played quietly.
     */
    SHOW_GAP_MS: 2 * 60 * 1000
});

/**
 * Consume Threshold — the fraction of max HP/Energy below which a hero
 * reaches for supplies on their own (the 25% rule).
 *
 * Food and drink are need-driven, not scheduled: consumption becomes a
 * SUPPLY-CHAIN concern (keep the Guild Bank stocked) rather than a timing
 * one, which is the right shape for an idle game.
 */
export const CONSUME_THRESHOLD = 0.25;

/**
 * Defeat penalties. Placeholder numbers, to be tuned.
 */
export const DEFEAT_PENALTY = {
    /** Portion of each slotted consumable's banked stack destroyed on defeat. */
    CONSUMABLE_LOSS_RATIO: 0.25,
    /** Chance, per equipped gear piece, that it is permanently lost on defeat. */
    GEAR_LOSS_CHANCE: 0.10
};
