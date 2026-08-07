// Fantasy Guild — Map definitions (7×7 Playmat rework, Phase 8)

/**
 * The Cartographer's catalogue — the game's progression system (D-99) and its
 * primary gold sink (D-96), which are deliberately the same thing.
 *
 * ## The curve: steps between themes, flat within one (D-166)
 * **A theme's price never rises, however many times you buy it.** This is what
 * lets one curve do two jobs without them fighting:
 *
 * * **Restocking stays cheap and predictable forever.** A player grinding
 *   Woodland Maps for supply is never punished for it.
 * * **Advancing to the next theme is a genuine saving-up**, and the gap reads
 *   as a milestone rather than a slightly larger number.
 *
 * Rising-per-purchase pricing was rejected: it discourages spamming one Map,
 * but makes restocking progressively punishing, which is directly against the
 * supply role D-153 gave Maps when it retired packs.
 *
 * ## ⚠️ PLACEHOLDER PRICES AND POOLS
 * Phase 9 replaces the contents entirely with authored kits. The **shape** is
 * the thing to preserve — flat within a theme, ×10 between them (owner
 * decision 2026-08-06, calibrated against ~1,200 g/hr for one hero on a Forest
 * selling raw output). Tune the numbers freely; do not make the price rise
 * within a theme.
 *
 * ## A Map's pool is a complete kit (D-139)
 * Producers, their Context Tokens, their Buff Tokens, **their Manager**, and
 * the enemies that belong there. Buying a Map is buying access to a
 * self-contained set — a strategic commitment rather than a lottery ticket, and
 * one purchase eventually yields everything needed to run that theme properly,
 * including the automation that lets it survive unattended.
 *
 * **A Map's loot pool is the only meaning "biome" has.** There are no biome
 * systems, bonuses or mechanics anywhere in the game. Names are flavour.
 *
 * ## Maps sit outside the rarity system entirely (D-132)
 * Never Common, never Mythic: always consumable, always bought, never placed to
 * produce. `weight` here is drop frequency **within this pool**, which is what
 * rarity means now (D-175) — it is not a power tier.
 */

/** @type {Record<string, object>} */
const MAPS = {
    map_woodland: {
        id: 'map_woodland',
        name: 'Woodland Map',
        theme: 'woodland',
        // Flat forever (D-166). ~10 seconds of one hero's output: shopping is
        // meant to be frequent and cheap (D-167), not occasional and momentous.
        price: 200,
        // Mainly gold plus a SMALL material component (D-100). Pulled
        // automatically from the Bank (D-150) exactly as Token inputs are —
        // one consistent way the game consumes items, and no inventory
        // management on a purchase.
        materials: [{ itemId: 'item_oak_wood', quantity: 5 }],
        pool: [
            { kind: 'token', refId: 'token_forest', weight: 30 },
            { kind: 'token', refId: 'token_ore_vein', weight: 15 },
            { kind: 'token', refId: 'token_sawmill', weight: 12 },
            { kind: 'token', refId: 'token_tool_rack', weight: 12 },
            { kind: 'token', refId: 'token_helmet_schematic', weight: 8 },
            { kind: 'token', refId: 'token_plank_schematic', weight: 8 },
            { kind: 'token', refId: 'token_forge', weight: 6 },
            { kind: 'token', refId: 'token_campfire', weight: 5 },
            { kind: 'token', refId: 'token_bear', weight: 10 },
            { kind: 'token', refId: 'token_cow_pasture', weight: 8 },
            // The Manager belongs in its own theme's kit (D-139) — this is what
            // makes one Map eventually yield the automation that lets the theme
            // survive unattended.
            { kind: 'token', refId: 'token_lumber_camp', weight: 3 },
            { kind: 'token', refId: 'token_hunters_blind', weight: 3 },
            { kind: 'token', refId: 'token_lumber_market', weight: 4 },
            { kind: 'item', refId: 'item_oak_wood', quantity: 12, weight: 20 },
            { kind: 'item', refId: 'item_coal', quantity: 4, weight: 10 }
        ]
    },

    map_river: {
        id: 'map_river',
        name: 'River Map',
        theme: 'river',
        // ×10 — the step reads as a milestone rather than a bigger number.
        price: 2000,
        materials: [{ itemId: 'item_coal', quantity: 3 }],
        pool: [
            { kind: 'token', refId: 'token_fishing_hole', weight: 30 },
            { kind: 'token', refId: 'token_still', weight: 15 },
            { kind: 'token', refId: 'token_deep_kiln', weight: 10 },
            { kind: 'token', refId: 'token_wind_trap', weight: 12 },
            { kind: 'token', refId: 'token_shrine', weight: 6 },
            { kind: 'token', refId: 'token_skeleton', weight: 10 },
            // A Mythic in the pool, so the burst has a top end. One copy may be
            // placed at a time (D-177), but several may be owned.
            { kind: 'token', refId: 'token_heartwood', weight: 1 },
            { kind: 'item', refId: 'item_water', quantity: 10, weight: 20 },
            { kind: 'item', refId: 'item_glowcap', quantity: 3, weight: 12 }
        ]
    }
};

/** A Map definition by id, or null. */
export function getMap(mapId) {
    return MAPS[mapId] || null;
}

/**
 * Every Map **in price order** (D-101).
 *
 * Ordering does the teaching: one affordable option at the top and a descending
 * ladder of ambitions beneath it. Nothing is ever locked (D-99) — cost is the
 * only gate, so ambition is *expensive* rather than *forbidden*, and there are
 * no greyed-out nodes and no recommendations.
 */
export function listMaps() {
    return Object.values(MAPS).sort((a, b) => a.price - b.price);
}

/** Total weight of a Map's pool, for the roll. */
export function poolWeight(mapId) {
    return (getMap(mapId)?.pool || []).reduce((sum, entry) => sum + (entry.weight || 0), 0);
}
