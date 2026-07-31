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
        description: 'Unlock another Bank tab (and Card Binder tab) for organizing.',
        maxRank: 15,               // 5 base + 15 = 20 tabs (owner design 2026-07-14)
        costBase: 250,
        costGrowth: 1.6,
        statLabel: rank => `${5 + rank} tabs`
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
        id: 'quest_slots',
        name: 'Quest Slots',
        description: 'Each locked area runs one more quest at a time.',
        maxRank: 9,                // 3 base + 9 = 12 slots (quest_system_concept.md §2)
        costBase: 300,
        costGrowth: 1.7,
        statLabel: rank => `${3 + rank} quest slots`
    },
    {
        id: 'roster_size',
        name: 'Roster Size',
        description: 'Field one more active hero at a time.',
        maxRank: 5,                // 5 base + 5 = 10 active heroes
        costBase: 500,
        costGrowth: 2.0,
        statLabel: rank => `${5 + rank} heroes`
    },
    // --- Universal cards (D-51) -------------------------------------------
    // Ranked nodes that grant copies into the Universal Bucket: rank N = N
    // owned copies, capped at 4 (D-52). Deliberately the same mechanism
    // Outpost cards will use in C-12 (D-37), so the pattern is proven once.
    //
    // Because the cap is a flat 4 while the world keeps growing, universals
    // get RELATIVELY scarcer as areas are added — that scarcity is the point
    // (see the note under D-52), not an oversight.
    {
        id: 'universal_rest',
        name: 'Rest Cards',
        description: 'Add a Rest card to the Universal Bucket — usable in any area.',
        maxRank: 4,                // D-52: universals cap at 4 like any card
        costBase: 200,
        costGrowth: 2.2,
        grantsUniversal: 'task_rest',
        statLabel: rank => `${rank} Rest card${rank === 1 ? '' : 's'}`
    }
];

/** Upgrade nodes whose rank grants copies of a universal card (D-51). */
export const UNIVERSAL_GRANT_UPGRADES = GUILD_UPGRADES.filter(u => u.grantsUniversal);

export function getUpgradeDef(id) {
    return GUILD_UPGRADES.find(u => u.id === id) || null;
}

/** Gold cost of the NEXT rank (rank = ranks already owned). */
export function getUpgradeCost(def, rank) {
    return Math.round(def.costBase * Math.pow(def.costGrowth, rank));
}
