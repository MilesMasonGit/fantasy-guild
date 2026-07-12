// Fantasy Guild — Guild Hall upgrade definitions (UI overhaul Phase 4).
//
// Starter tree approved by the owner 2026-07-11: the three bank capacity
// paths (each its own stat, per the Phase 3 decisions) + Roster Size.
// Gold-only costs (owner decision — Influence may be cut as a mechanic).
//
// COST CURVES ARE PLACEHOLDERS awaiting balancing — the shape (base ×
// growth^rank) is the standard idle-game curve; tune base/growth freely.
// `apply` documents which live stat each rank drives; the actual write
// happens in GuildUpgradeManager.recompute() so it can re-run on load.

export const GUILD_UPGRADES = [
    {
        id: 'bank_tabs',
        name: 'Bank Tabs',
        description: 'Add another tab to the Bank and Card Binder for organizing.',
        maxRank: 19,               // 1 base + 19 = 20 tabs (spec cap)
        costBase: 250,
        costGrowth: 1.6,
        statLabel: rank => `${1 + rank} tabs`
    },
    {
        id: 'bank_slots',
        name: 'Bank Slots',
        description: 'Store 10 more kinds of items in the Bank.',
        maxRank: 18,               // 20 base + 180 = 200 stacks
        costBase: 150,
        costGrowth: 1.45,
        statLabel: rank => `${20 + rank * 10} slots`
    },
    {
        id: 'stack_size',
        name: 'Stack Size',
        description: 'Each item stack holds 50 more before it overflows.',
        maxRank: 10,
        costBase: 200,
        costGrowth: 1.5,
        statLabel: rank => `+${rank * 50} per stack`
    },
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

export function getUpgradeDef(id) {
    return GUILD_UPGRADES.find(u => u.id === id) || null;
}

/** Gold cost of the NEXT rank (rank = ranks already owned). */
export function getUpgradeCost(def, rank) {
    return Math.round(def.costBase * Math.pow(def.costGrowth, rank));
}
