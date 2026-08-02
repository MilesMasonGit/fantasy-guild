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
        description: 'Unlock another Bank tab for organizing.',   // binder tabs retired, D-41
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
    },

    // --- Outpost banners (D-21, D-35) -------------------------------------
    // How many Outpost banners the guild runs. Scarce on purpose: the auras
    // are global, so scarcity is the whole balancing force (D-21). Each rank
    // also GRANTS the card named in `grantsCardOnUnlock` (D-35) so a new
    // banner is never an empty frame.
    {
        id: 'outpost_slots',
        name: 'Outpost Banners',
        description: 'Establish another Outpost — a standalone banner holding one card whose effect is guild-wide.',
        maxRank: 3,                // 1 starting + 3 = 4 banners (D-21: ~3-4)
        costBase: 2000,
        costGrowth: 3.0,
        grantsOutpostBanner: true,
        grantsCardOnUnlock: 'station_wood_kiln',
        statLabel: rank => `${1 + rank} Outpost${rank === 0 ? '' : 's'}`
    },

    // --- Outpost cards (D-34, D-36, D-37) ---------------------------------
    // Outpost cards are NOT crafted, dropped or pulled from packs — they are
    // guild tree nodes (D-34). Rank N grants N copies (D-37), which is what
    // supplies D-23's additive aura stacking, and the escalating rank cost is
    // the brake on specialising too hard.
    //
    // `requiresArea` gates a node's VISIBILITY behind an area unlock (D-36),
    // pacing the Outpost layer against exploration without a second system.
    {
        id: 'outpost_wood_kiln',
        name: 'Wood Kiln',
        description: 'Fire raw timber into charcoal and treated wood.',
        maxRank: 2,
        costBase: 800,
        costGrowth: 2.5,
        grantsStation: 'station_wood_kiln',
        statLabel: rank => `${rank} card${rank === 1 ? '' : 's'}`
    },
    {
        id: 'outpost_woodland_kitchen',
        name: 'Woodland Kitchen',
        description: 'Cook gathered ingredients into hearty meals.',
        maxRank: 2,
        costBase: 900,
        costGrowth: 2.5,
        grantsStation: 'station_woodland_kitchen',
        requiresArea: 'area_whispering_woods',
        statLabel: rank => `${rank} card${rank === 1 ? '' : 's'}`
    },
    {
        id: 'outpost_smelting_furnace',
        name: 'Smelting Furnace',
        description: 'Smelt raw ores into refined ingots.',
        maxRank: 2,
        costBase: 1500,
        costGrowth: 2.5,
        grantsStation: 'station_smelting_furnace',
        requiresArea: 'area_misty_mountains',
        statLabel: rank => `${rank} card${rank === 1 ? '' : 's'}`
    },
    {
        id: 'outpost_blacksmith_forge',
        name: 'Blacksmith Forge',
        description: 'Hammer ingots into weapons, armor and tools. Carries a small Smithing aura.',
        maxRank: 2,
        costBase: 2500,
        costGrowth: 2.5,
        grantsStation: 'station_blacksmith_forge',
        requiresArea: 'area_misty_mountains',
        statLabel: rank => `${rank} card${rank === 1 ? '' : 's'}`
    },
    {
        id: 'outpost_guild_smithy',
        name: 'Guild Smithy',
        description: 'A Passive Outpost: crafts nothing, but speeds Mining in every area. Stacks with itself.',
        maxRank: 3,                // stacking is the point (D-23)
        costBase: 3000,
        costGrowth: 2.8,
        grantsStation: 'station_guild_smithy',
        requiresArea: 'area_misty_mountains',
        statLabel: rank => `${rank} card${rank === 1 ? '' : 's'}`
    },
    {
        id: 'outpost_wayfarers_rest',
        name: "Wayfarer's Rest",
        description: 'A Passive Outpost that runs unstaffed — a small boost to every task, at no cost to your roster.',
        maxRank: 2,
        costBase: 4000,
        costGrowth: 3.0,
        grantsStation: 'station_wayfarers_rest',
        requiresArea: 'area_whispering_woods',
        statLabel: rank => `${rank} card${rank === 1 ? '' : 's'}`
    },
    {
        id: 'outpost_surveyors_post',
        name: "Surveyor's Post",
        description: 'A Passive Outpost carrying two auras at once: Woodcutting and Fishing, everywhere.',
        maxRank: 2,
        costBase: 5000,
        costGrowth: 3.0,
        grantsStation: 'station_surveyors_post',
        requiresArea: 'area_sunken_bog',
        statLabel: rank => `${rank} card${rank === 1 ? '' : 's'}`
    }
];

/** Upgrade nodes whose rank grants copies of a universal card (D-51). */
export const UNIVERSAL_GRANT_UPGRADES = GUILD_UPGRADES.filter(u => u.grantsUniversal);

/** Upgrade nodes whose rank grants copies of an Outpost (station) card (D-34/D-37). */
export const STATION_GRANT_UPGRADES = GUILD_UPGRADES.filter(u => u.grantsStation);

/**
 * Is this node visible yet? Nodes gated by `requiresArea` stay hidden until
 * that region is unlocked (D-36), which paces the Outpost layer against
 * exploration without inventing a second gating system.
 *
 * @param {object} def
 * @param {string[]} unlockedAreaIds
 */
export function isUpgradeVisible(def, unlockedAreaIds = []) {
    if (!def?.requiresArea) return true;
    return unlockedAreaIds.includes(def.requiresArea);
}

export function getUpgradeDef(id) {
    return GUILD_UPGRADES.find(u => u.id === id) || null;
}

/** Gold cost of the NEXT rank (rank = ranks already owned). */
export function getUpgradeCost(def, rank) {
    return Math.round(def.costBase * Math.pow(def.costGrowth, rank));
}
