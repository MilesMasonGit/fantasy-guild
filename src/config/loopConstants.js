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
 * Defeat penalties (§3F). [DECISION 2026-07-07] Placeholder numbers,
 * approved by the project owner for tuning later.
 */
export const DEFEAT_PENALTY = {
    /** Portion of each slotted consumable's banked stack destroyed on defeat. */
    CONSUMABLE_LOSS_RATIO: 0.25,
    /** Chance, per equipped gear piece, that it is permanently lost on defeat. */
    GEAR_LOSS_CHANCE: 0.10,
    /** Equipment slots exempt from gear loss (consumable loadout, not gear). */
    GEAR_LOSS_EXEMPT_SLOTS: ['food', 'drink']
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
