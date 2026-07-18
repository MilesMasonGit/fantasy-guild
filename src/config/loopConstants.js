// Fantasy Guild - Area Deck Loop Tunables (Deck Loop rework, Phase 3)
//
// Every gameplay number for the loop engine lives here so it can be tuned
// in one place. All times are in milliseconds.

/**
 * Draw Time — the pause between finishing one card and starting the next
 * (concept doc §2: 1–2 seconds; fixed midpoint keeps loops deterministic).
 */
export const DRAW_TIME_MS = 1500;

/**
 * Shuffle Time — the longer pause when the loop wraps from the last slot
 * back to the first (concept doc §2: 5–10 seconds).
 */
export const SHUFFLE_TIME_MS = 7500;

/**
 * Consumption Time — how long a hero spends at a consumable slot, whether
 * or not the item is in stock (concept doc §4: the empty-slot penalty).
 */
export const CONSUMPTION_TIME_MS = 3000;

/**
 * Energy Draw Cost — flat energy paid by the hero each time a card is drawn
 * (§3D). [DECISION 2026-07-07] A single global constant, not per-card data:
 * no card in the CMS has an authored energy cost, and a global knob is
 * enough until balancing calls for per-card costs. If the hero can't pay,
 * the loop pauses and auto-resumes once passive regen refills enough.
 */
export const ENERGY_DRAW_COST = 2;

/**
 * Craft Energy Cost — flat energy a hero spends to begin each craft in
 * Stationed Mode when the recipe doesn't author its own `energyCost`
 * (owner decision 2026-07-16: recipes decide, flat default until tuned).
 * Below this, the station auto-drinks from its Drink slot; with no drink it
 * pauses ('paused_no_energy') and auto-resumes once energy is available.
 */
export const DEFAULT_CRAFT_ENERGY = 15;

/**
 * Defeat penalties (§3F). [DECISION 2026-07-07] Placeholder numbers,
 * approved by the project owner for tuning later.
 */
export const DEFEAT_PENALTY = {
    /** Portion of each slotted consumable's banked stack destroyed on defeat. */
    CONSUMABLE_LOSS_RATIO: 0.25,
    /** Chance, per equipped gear piece, that it is permanently lost on defeat. */
    GEAR_LOSS_CHANCE: 0.10,
    /** Equipment slots exempt from gear loss. Empty since hero-carried
     *  food/drink was retired (CR-029) — kept as the tuning hook. */
    GEAR_LOSS_EXEMPT_SLOTS: []
};

/**
 * How often (in engine ticks) running areas publish an `area:progress`
 * event for the ref-based progress bars (Phase 6 §D). The engine ticks
 * 10×/second, so 3 ≈ every 300ms.
 */
export const PROGRESS_EVENT_TICK_INTERVAL = 3;

/**
 * Unified Booster Pack economy (Phase 5 §5F). [DECISION 2026-07-08]
 * Placeholder numbers, owner-informed, tuned later: the roadmap assumed a
 * global pack cost already existed, but the old cost curve was per-area
 * (`packBaseGoldCost` + per-area scaling). The unified pack uses one global
 * curve over `collection.globalPacksBought` instead.
 */
export const UNIFIED_PACK = {
    /** Gold cost of the first pack. */
    BASE_COST: 50,
    /** Extra gold per pack already bought (linear scaling). */
    COST_SCALING: 10
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
