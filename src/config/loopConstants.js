// Fantasy Guild - Engine Tunables
//
// Gameplay numbers that the engine imports, so they can be tuned in one place.
// All times are in milliseconds.
//
// ⚠️ Only put a value here if code actually imports it. This file used to hold
// twelve exports, nine of which nothing read — a museum of the retired deck
// loop and the retired pack economy — so tuning most of it changed nothing.
// The deck-loop and pack constants were deleted on 2026-08-24 (CR2-065); the
// two Energy constants below are the deliberate exception and say so.

/** Milliseconds between game ticks (100 = 10 ticks/sec). Read by `GameLoop`. */
export const TICK_INTERVAL_MS = 100;

/**
 * Consume Threshold — the fraction of max HP/Energy below which a hero
 * reaches for supplies on their own (D-17, the "25% rule").
 *
 * Food and drink are need-driven, not scheduled: consumption becomes a
 * SUPPLY-CHAIN concern (keep the Guild Bank stocked) rather than a timing
 * one, which is the right shape for an idle game.
 */
export const CONSUME_THRESHOLD = 0.25;

/**
 * ⚠️ ENERGY IS CUT (D-183/D-184). Both constants below now have **zero
 * consumers** and are kept only as a record of what the costs were.
 *
 * The cut landed for free rather than needing a removal pass, which is worth
 * understanding before anyone "restores" it: Energy only ever had two sinks —
 * a flat cost per **card draw**, and a flat cost per **Outpost craft**. A board
 * has no draws and no Outposts, so both stranded themselves the moment the deck
 * loop was deleted.
 *
 * The hero's `energy` pool, the Drink item category and
 * `ConsumptionSystem.tryDrink` all still exist and are **dormant, not deleted**
 * (roadmap G-8) — removing them is ~180 references across ~45 files with no
 * player-visible payoff, and that is exactly the kind of broad change a branch
 * with no feature flag cannot verify. Logged in roadmap Appendix A-2.
 *
 * ⚠️ Do not give Energy a new board-side sink without reopening D-183. §6.1 is
 * explicit that there is **no continuous upkeep drain** — Tokens consume
 * resources when they work, not per second.
 */
export const ENERGY_DRAW_COST = 2;
export const DEFAULT_CRAFT_ENERGY = 15;

/**
 * Defeat penalties (§3F). [DECISION 2026-07-07] Placeholder numbers,
 * approved by the project owner for tuning later.
 */
export const DEFEAT_PENALTY = {
    /** Portion of each slotted consumable's banked stack destroyed on defeat. */
    CONSUMABLE_LOSS_RATIO: 0.25,
    /** Chance, per equipped gear piece, that it is permanently lost on defeat. */
    GEAR_LOSS_CHANCE: 0.10
    // GEAR_LOSS_EXEMPT_SLOTS is gone (C-9): it was an empty array left from a
    // retired system, iterated on every defeat to exempt nothing. Equipment
    // categories are data-driven, so re-adding an exemption is a two-line
    // change if one is ever wanted.
};

/**
 * Time Bank (Phase 8 — essentials). [DECISION 2026-07-08, owner-approved]
 * Replaces the deferred offline-simulation approach: instead of math-only
 * fast-forwarding the world while closed, time spent away is banked (up to a
 * cap) and later "played out" by accelerating the LIVE engine — combat,
 * crafting, RNG and all just run faster, so there is no parallel simulation
 * to maintain.
 *
 * Accounting model (owner-confirmed, approximate — tunable later): the bank
 * holds game-time to replay. While fast-forwarding at Nx, the bank drains by
 * the full game-time advanced each tick (realDelta × N). A full 24h bank
 * therefore plays out in ~24h/N of real time: ~14 min at 100x, ~2.4h at 10x.
 *
 * Presets cap at 10x for now: every loop duration is ≥1s, so at the engine's
 * 10 ticks/second a ≤10x time-scale still gives ≥1 tick per action and stays
 * correct without raising the tick frequency. True 100x needs the deferred
 * "tick faster / catch-up" work.
 */
export const TIME_BANK = {
    /** Maximum bankable time (24 hours). Offline time past this is lost. */
    MAX_MS: 24 * 60 * 60 * 1000,
    /** Selectable fast-forward multipliers. */
    PRESETS: [2, 5, 10]
};
