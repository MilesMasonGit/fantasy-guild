// Fantasy Guild - Engine Tunables
// Gameplay numbers that the engine imports, so they can be tuned in one place.
// All times are in milliseconds.
// ⚠️ Only put a value here if code actually imports it: tuning an unread value changes nothing.

/** Milliseconds between game ticks (100 = 10 ticks/sec). Read by `GameLoop`. */
export const TICK_INTERVAL_MS = 100;

/**
 * Upper bound on the game-time a SINGLE tick may advance. Read by
 * `TimeManager.update()`; anything past it is routed to the Time Bank rather
 * than discarded.
 *
 * **Why 1000 ms — it is not a new number.** Two places already fix it:
 *  - `BoardRunner.tick` floors every work cycle at `Math.max(1000, …)` and
 *    completes **at most one** cycle per tick, so a tick carrying more than
 *    1000 ms of game time cannot be fully credited to the board.
 *  - `TIME_BANK` below caps fast-forward at 10× on exactly that reasoning:
 *    "every loop duration is ≥1s, so at the engine's 10 ticks/second a ≤10x
 *    time-scale still gives ≥1 tick per action". 10 × the 100 ms tick is
 *    1000 ms of game time — the same ceiling, stated from the other side.
 *
 * It is also 10× a normal frame, which is ample headroom for a slow machine, a
 * heavy render, or a hidden tab whose timer Chrome has throttled to ~1/second.
 * A suspended tab or a sleeping laptop returns deltas orders of magnitude
 * larger, so those are what this catches.
 */
export const MAX_TICK_DELTA_MS = 1000;

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
 * ⚠️ ENERGY IS CUT. Both constants below have zero consumers and are kept only as a record.
 *
 * The hero `energy` pool, Drink category and `ConsumptionSystem.tryDrink` still exist but are dormant.
 *
 * ⚠️ Do not give Energy a new board-side sink: Tokens consume resources when they work, not per second.
 */
export const ENERGY_DRAW_COST = 2;
export const DEFAULT_CRAFT_ENERGY = 15;

/**
 * Defeat penalties. Placeholder numbers, to be tuned.
 */
export const DEFEAT_PENALTY = {
    /** Portion of each slotted consumable's banked stack destroyed on defeat. */
    CONSUMABLE_LOSS_RATIO: 0.25,
    /** Chance, per equipped gear piece, that it is permanently lost on defeat. */
    GEAR_LOSS_CHANCE: 0.10
};

/**
 * Time Bank. Time spent away is banked (up to a cap) and later played out by accelerating the LIVE engine, so there is no parallel simulation to maintain.
 *
 * Accounting: the bank holds game-time to replay. While fast-forwarding at Nx, the bank drains by
 * holds game-time to replay. While fast-forwarding at Nx, the bank drains by
 * the full game-time advanced each tick (realDelta × N). A full 24h bank
 * therefore plays out in ~24h/N of real time (~2.4h at 10x).
 *
 * Presets cap at 10x for now: every loop duration is ≥1s, so at the engine's
 * 10 ticks/second a ≤10x time-scale still gives ≥1 tick per action and stays
 * correct without raising the tick frequency.
 */
export const TIME_BANK = {
    /** Maximum bankable time (24 hours). Offline time past this is lost. */
    MAX_MS: 24 * 60 * 60 * 1000,
    /** Selectable fast-forward multipliers. */
    PRESETS: [2, 5, 10]
};
