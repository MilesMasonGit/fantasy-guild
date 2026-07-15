// Fantasy Guild — Quest System v2 tunables (quest_system_concept.md).
// Every balance knob for the quest boards lives here. ⚠ = placeholder value.

/** Global refresh clock. 5 min for now; the shipped game will use ~4 hours. ⚠ */
export const QUEST_REFRESH_MS = 5 * 60 * 1000;

/** Pay-gold instant refresh: cost = BASE × GROWTH^usesSinceNaturalRefresh. ⚠ */
export const INSTANT_REFRESH_BASE = 50;
export const INSTANT_REFRESH_GROWTH = 2.0;

/** Quest slots per locked area: BASE + quest_slots upgrade rank (cap 12). */
export const BASE_QUEST_SLOTS = 3;

/** Procedural GATHER quests: required ≈ VALUE_BUDGET / item.baseValue. ⚠ */
export const GATHER_VALUE_BUDGET = 60;
export const GATHER_MIN = 5;
export const GATHER_MAX = 30;

/** Procedural DEFEAT quests: required ≈ KILL_BUDGET / enemy level. ⚠ */
export const DEFEAT_KILL_BUDGET = 12;
export const DEFEAT_MIN = 3;
export const DEFEAT_MAX = 15;

/** Rewards. Gather gold = value × required × MARGIN; defeat gold = level × kills × PER_KILL. ⚠ */
export const REWARD_MARGIN = 1.5;
export const DEFEAT_GOLD_PER_KILL_LEVEL = 3;

/** Chance a generated quest carries a bonus item (rolled from the same pool). ⚠ */
export const BONUS_ITEM_CHANCE = 0.15;

/**
 * Unlock thresholds: procedural quests completed to open each area
 * (scaling by depth — owner decision 2026-07-14). Reads from the area set's
 * `unlockThreshold` first (CMS-authorable later); these are the fallbacks. ⚠
 */
export const UNLOCK_THRESHOLDS = {
    area_whispering_woods: 20,
    area_misty_mountains: 30,
    area_sunken_bog: 40
};
export const DEFAULT_UNLOCK_THRESHOLD = 30;

export function getUnlockThreshold(areaSet) {
    if (!areaSet) return DEFAULT_UNLOCK_THRESHOLD;
    return areaSet.unlockThreshold
        ?? UNLOCK_THRESHOLDS[areaSet.id]
        ?? DEFAULT_UNLOCK_THRESHOLD;
}
