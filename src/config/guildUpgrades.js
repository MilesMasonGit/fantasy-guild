// Fantasy Guild — Guild Hall upgrade definitions.
//
// The tree lives on the Guild Hall tile — the permanent centre of the 7×7 board
// (D-106). Gold-only costs (owner decision 2026-07-11).
//
// COST CURVES ARE PLACEHOLDERS awaiting balancing — the shape (base ×
// growth^rank) is the standard idle-game curve; tune base/growth freely.
// `statLabel` documents which live stat each rank drives; the actual write
// happens in GuildUpgradeManager.recompute() so it can re-run on load.
//
// ## Trimmed by the 7×7 playmat rework, Phase 1 §G (decision G-10)
// Nine of the original fourteen nodes granted deck-loop content and went with
// it: `universal_rest` (a Universal card), `outpost_slots` (Outpost banners) and
// seven `outpost_*` station-card grants. `stack_size` was retired separately —
// it added +50 to a stack ceiling of 1e12 (`DEFAULT_MAX_STACK`), so it had been
// buying a rounding error, and D-137's "stacks are never capped" is already true
// in practice.
//
// ## Two of §11's four tracks are deliberately absent
// The design asks for Storage / Roster / Aura / Economy. **Aura** (bonuses to
// the Guild Hall's 8 neighbours, D-121) and **Economy** (sell rates, Tray size)
// are deferred — see roadmap Appendix A-1. Aura is no longer blocked: Phase 5's
// adjacency work gives it a delivery path, so it is a small later addition.

export const GUILD_UPGRADES = [
    // --- Storage (D-137) ---------------------------------------------------
    // Two independent lines, because the item Bank and the Token Bank cap
    // different things and a player may be short of one and not the other.
    {
        id: 'bank_tabs',
        name: 'Bank Tabs',
        description: 'Unlock another Bank tab for organizing.',
        maxRank: 15,               // 5 base + 15 = 20 tabs (owner design 2026-07-14)
        costBase: 250,
        costGrowth: 1.6,
        statLabel: rank => `${5 + rank} tabs`
    },
    {
        id: 'bank_slots',
        name: 'Bank Slots',
        description: 'Store 10 more kinds of items in the Bank.',
        maxRank: 18,               // 20 base + 180 = 200 distinct types
        costBase: 150,
        costGrowth: 1.45,
        statLabel: rank => `${20 + rank * 10} slots`
    },
    {
        // D-137's second line, and the one the board actually feels: this is the
        // stock a Manager draws from, so it is the difference between a board
        // that survives one theme unattended and one that survives three.
        id: 'token_bank_slots',
        name: 'Token Vault',
        description: 'Store 4 more kinds of Token in the Vault.',
        maxRank: 12,               // 12 base + 48 = 60 distinct types
        costBase: 200,
        costGrowth: 1.5,
        statLabel: rank => `${12 + rank * 4} slots`
    },

    // --- Roster ------------------------------------------------------------
    // The most powerful thing gold can buy: roster size is the production
    // ceiling, because the number of actively worked tiles equals the number of
    // placed heroes (D-181). Tiles are abundant; people are not.
    {
        id: 'roster_size',
        name: 'Roster Size',
        description: 'Field one more active hero at a time.',
        maxRank: 5,                // 5 base + 5 = 10 active heroes
        costBase: 500,
        costGrowth: 2.0,
        statLabel: rank => `${5 + rank} heroes`
    }
];

/** Look up an upgrade definition by id. */
export function getUpgradeDef(id) {
    return GUILD_UPGRADES.find(u => u.id === id) || null;
}

/** Gold cost of the NEXT rank (`rank` = ranks already owned). */
export function getUpgradeCost(def, rank) {
    return Math.round(def.costBase * Math.pow(def.costGrowth, rank));
}

/**
 * Whether an upgrade should be shown.
 *
 * Every remaining node is global, so everything is always visible. The old
 * signature took the player's unlocked areas — areas are deleted, and the
 * parameter is kept only so callers need not change.
 */
export function isUpgradeVisible(_def, _unlockedAreaSets) {
    return true;
}
