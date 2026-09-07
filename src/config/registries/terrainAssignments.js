// Fantasy Guild — Which Maps and Tokens paint which terrain.

import { isTerrainId } from './terrainRegistry.js';
import { allMaps } from './mapRegistry.js';

/**
 * Who paints what (roadmap P0, decisions D-T4 through D-T7).
 *
 * `terrainRegistry.js` says what a terrain type *is*. This says which one a
 * Token lays down when it is placed. It is the table the owner edits when a
 * tile looks wrong, so it is kept plain: two objects and a resolver.
 *
 * ## Every Token paints (D-T4)
 *
 * Not only place-like ones. Dropping a Copper Pickaxe re-terraforms the ground
 * under it exactly as an Ore Vein does. The owner chose this over a rule that
 * exempted tools and buffs, on the grounds that one rule with no exceptions is
 * easier to hold in your head than a category list.
 *
 * ## Where a Token's terrain comes from, in order (D-T5)
 *
 *   1. `TOKEN_TERRAIN[typeId]` — an explicit override, if one is authored.
 *   2. The terrain the **Map stamped on the instance when it burst** (D-T6).
 *   3. The terrain of the only Map that lists it, if exactly one does.
 *   4. `DEFAULT_TERRAIN`.
 *
 * ⚠️ Step 3 was added on 2026-09-06 and is not cosmetic. A pooled Token has no
 * override *and* no stamp whenever it was created by any route other than a
 * burst — the QA panel's "Fill Tray", a test fixture, a future crafting recipe —
 * and every one of those was painting the default. On a board filled from the
 * QA panel that meant Shrimp Coast laying down grass, which reads as the
 * feature being broken rather than as a Token having no provenance.
 *
 * ## ⚠️ Why the Map has to stamp rather than be looked up (D-T6)
 *
 * `concept_dynamic_playmat_terrain.md` §10A reads as though a Token's Map can
 * be discovered from the Token. It cannot, and this was checked against the
 * shipped content on 2026-09-06:
 *
 *   * **Only 25 of the 75 Tokens appear in any Map pool.** The other 50 are
 *     crafted, bought or otherwise never come from a Map, so there is nothing
 *     to inherit from — hence `TOKEN_TERRAIN` below covers all 50 (D-T7).
 *   * **Six of those appear in two pools.** `token_coal_vein` is in both
 *     `map_bronze_hills` and `map_test_map`, so its "region" is genuinely
 *     ambiguous and only the Map that actually produced *this* Token knows it.
 *
 * So the burst writes the terrain onto the Token instance and it travels with
 * it, surviving a trip through the Vault. That plumbing is P1; this file is
 * only the lookup it will consult.
 */

/** What a Token paints when nothing else decides — plain grass. */
export const DEFAULT_TERRAIN = 'meadow';

/**
 * The terrain each Map stamps onto the Tokens it bursts.
 *
 * All seven authored Maps are covered. `map_test_map` is a developer grab-bag
 * whose pool is ores and kilns, so it stamps `hills` like the mining Map it
 * most resembles.
 */
export const MAP_TERRAIN = Object.freeze({
    map_bronze_hills: 'hills',
    map_cozy_hamlet: 'hamlet',
    map_golden_farmland: 'farmland',
    map_guild_hall_map: 'meadow',
    map_oak_forest: 'forest',
    map_sandbar_shores: 'shore',
    map_test_map: 'hills'
});

/**
 * Per-Token terrain, overriding whatever Map produced the Token.
 *
 * **These are first-pass guesses, seeded from each Token's name and type on
 * 2026-09-06 and expected to be corrected.** Nothing here is a considered
 * design decision; change any line freely.
 *
 * ⚠️ **Only Tokens that need it are listed.** The 25 Tokens that come out of a
 * Map pool are deliberately absent, so they follow their Map — that is what
 * makes `token_wishing_well` `farmland` when Golden Farmland produced it and
 * `hills` when Test Map did. Adding one of them here would silence that.
 * `src/tests/TerrainRegistry.test.js` fails if a pool-less Token is missing
 * from this table, and also if a pooled one is added to it.
 *
 * Rough shape of the guesses:
 *   * Ore veins read as deep rock (`mountain`); rubble and tools read as the
 *     workings around them (`hills`).
 *   * Timber trees are `forest`; orchard fruit is `farmland`; tropical fruit is
 *     `desert`, which is the sand substrate under a different prop set.
 *   * Berry bushes are open ground (`meadow`).
 *   * Buildings and workbenches are `hamlet`.
 *   * A Map Token paints the terrain of the Map it opens, so a Map you have not
 *     spent yet already shows you where it goes.
 */
export const TOKEN_TERRAIN = Object.freeze({
    // --- Maps: each paints the place it leads to -------------------------
    token_bronze_hills_map: 'hills',
    token_cozy_hamlet_map: 'hamlet',
    token_golden_farmland_map: 'farmland',
    token_guild_hall_map: 'meadow',
    token_oak_forest_map: 'forest',
    token_sandbar_shores_map: 'shore',
    token_test_map: 'hills',

    // --- Buffs and structures --------------------------------------------
    token_forge_2: 'hills',
    token_forge_altar: 'hills',
    token_guild_hall: 'meadow',
    token_wizard_academy: 'hamlet',
    token_workbench: 'hamlet',

    // --- Tools: bare worked earth -----------------------------------------
    //
    // A tool is a thing somebody was using, so the ground under it is dug over
    // rather than wild. Every tool paints the same `diggings` whatever it is
    // for, which also makes dirt easy to get hold of — it was otherwise
    // reachable only through Golden Farmland and Cozy Hamlet.
    token_adamantium_pickaxe: 'diggings',
    token_copper_pickaxe: 'diggings',
    token_darkmetal_pickaxe: 'diggings',
    token_iron_pickaxe: 'diggings',
    token_mythril_pickaxe: 'diggings',
    token_copper_woodaxe: 'diggings',

    // ⚠️ These two DO come out of a Map pool, so overriding them deliberately
    // silences map inheritance for them (D-T5). That is the intent: a tool
    // should read as a tool wherever it came from, and two of the seven
    // behaving differently from the rest would look like an oversight.
    token_rusty_pickaxe: 'diggings',
    token_rusty_woodaxe: 'diggings',

    // --- Water ------------------------------------------------------------
    //
    // ⚠️ Both are pooled and both are deliberately overridden. Sandbar Shores
    // stamps `shore` on everything it produces, which made every coastal Token
    // paint the same sand and left the water substrate unused entirely — so a
    // coast had no coastline in it. The Coast itself and the net that fishes
    // it are the sea; the shrimp beds and the market are the beach, and those
    // two still follow the Map.
    token_coast: 'ocean',
    token_fishing_net: 'ocean',

    // --- Markets ----------------------------------------------------------
    token_shrimp_market: 'shore',

    // --- Ore and stone ----------------------------------------------------
    token_adamantine_ore_vein: 'mountain',
    token_adamantium_ore: 'mountain',
    token_darkmetal_ore_vein: 'mountain',
    token_gold_ore_vein: 'mountain',
    token_iron_ore_vein: 'mountain',
    token_mythril_ore_vein: 'mountain',
    token_silver_ore_vein: 'mountain',
    token_copper_rubble: 'hills',

    // --- Timber -----------------------------------------------------------
    //
    // Broadleaf goes to the oak wood, conifer to the fir wood. The two are the
    // same ground in different light, so placing a stand of firs beside a stand
    // of oaks is what the tone fade exists to make look right.
    token_birch_forest: 'forest',
    token_birch_tree: 'forest',
    token_ebony_tree: 'forest',
    token_mahogany_forest: 'forest',
    token_mahogany_tree: 'forest',
    token_maple_forest: 'forest',
    token_maple_tree: 'forest',
    token_cedar_tree: 'fir_forest',
    token_fir_forest: 'fir_forest',

    // ⚠️ Pooled, and deliberately overridden. Oak Forest produces Fir Trees, so
    // without this a fir would lay down oak wood — the one Token whose own name
    // contradicts the Map it comes out of.
    token_fir_tree: 'fir_forest',

    // --- Orchard and field ------------------------------------------------
    token_cherry_tree: 'farmland',
    token_grapevine: 'farmland',
    token_lemon_tree: 'farmland',
    token_lime_tree: 'farmland',
    token_orange_tree: 'farmland',
    token_peach_tree: 'farmland',
    token_watermelon_patch: 'farmland',

    // --- Tropical ---------------------------------------------------------
    token_banana_tree: 'desert',
    token_coconut_tree: 'desert',
    token_pineapple_bush: 'desert',

    // --- Open ground ------------------------------------------------------
    token_blackberry_bush: 'meadow',
    token_blueberry_bush: 'meadow',
    token_raspberry_bush: 'meadow',
    token_strawberry_bush: 'meadow'
});

/**
 * The terrain of the sole Map that lists a Token, for Tokens listed by only one.
 *
 * Derived rather than authored, so it cannot drift from the Map pools. Tokens in
 * two pools are deliberately absent: `token_coal_vein` is in both Bronze Hills
 * and Test Map, and guessing between them is exactly what the burst stamp exists
 * to avoid — those fall through to the default instead.
 */
const SINGLE_POOL_TERRAIN = (() => {
    const seen = new Map();   // typeId -> Set of map ids
    for (const [mapId, def] of Object.entries(allMaps())) {
        for (const entry of def?.pool || []) {
            if (entry?.kind !== 'token' || !entry.refId) continue;
            if (!seen.has(entry.refId)) seen.set(entry.refId, new Set());
            seen.get(entry.refId).add(mapId);
        }
    }
    const out = {};
    for (const [typeId, mapIds] of seen) {
        if (mapIds.size !== 1) continue;
        const terrainId = MAP_TERRAIN[[...mapIds][0]];
        if (terrainId) out[typeId] = terrainId;
    }
    return Object.freeze(out);
})();

/** The terrain a Map stamps on what it bursts. Null if the Map is unknown. */
export function terrainForMap(mapId) {
    const terrainId = MAP_TERRAIN[mapId];
    return terrainId && isTerrainId(terrainId) ? terrainId : null;
}

/**
 * The terrain a Token paints, resolving the D-T5 precedence.
 *
 * @param {string} typeId The Token's type id, e.g. `token_coal_vein`.
 * @param {string|null} [stampedTerrainId] The terrain the Map wrote onto this
 *   Token instance when it burst (D-T6).
 * @returns {string} A terrain id that is always real.
 */
export function terrainForToken(typeId, stampedTerrainId = null) {
    const override = TOKEN_TERRAIN[typeId];
    if (override && isTerrainId(override)) return override;
    if (stampedTerrainId && isTerrainId(stampedTerrainId)) return stampedTerrainId;

    const fromSolePool = SINGLE_POOL_TERRAIN[typeId];
    if (fromSolePool && isTerrainId(fromSolePool)) return fromSolePool;

    return DEFAULT_TERRAIN;
}
