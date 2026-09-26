// Fantasy Guild — Map registry (loader)

/**
 * The Map catalogue, authored in the CMS. ⚠️ Since Token Lifecycle 9.1 no Map
 * bursts and none is sold: a Map Token that is still in the game is an ordinary
 * Explore producer (slice 7.6). What still reads this file: the terrain
 * assignment (`terrainAssignments.js`), the boot content audit, and the random
 * quest bounties. It was the Cartographer's catalogue (D-99).
 *
 * ## Definitions live in `data/`, not here (CMS rework Phase 0, CMS-82)
 * Map definitions used to be a hand-authored object literal in this file. They
 * now load from `data/maps.json` (plus an optional `data/maps/**` folder), so
 * the CMS has somewhere to write. This file is now a loader plus accessors.
 *
 * ⚠️ **The design commentary that used to sit inline here moved to
 * [`token_content_notes.md`](../../../token_content_notes.md)** (CMS-88) —
 * Part 4 covers the price curve, the complete-kit rule and why `uses: 1`
 * matters; Part 5 covers the per-entry pool weighting. **Read it before
 * retuning a Map.**
 *
 * The rule that most needs restating here: **a Map's price never rises,
 * however many times you buy it** (D-166). Tune the numbers freely; do not
 * make repeat purchases cost more. That half is the rule, not the number.
 * (D-166 was written in terms of a Map's "theme"; theme was retired as a
 * concept — `concept_audit.md` §A — so the rule is stated per Map here.)
 *
 * ⚠️ **Never hand-edit `data/maps.json` once the CMS is live** (CMS-53).
 */

import { DatabaseManager } from '../DatabaseManager.js';

/** Merge every Map JSON source into one keyed object. Mirrors the Token loader. */
function loadJsonMaps() {
    const maps = {};

    for (const source of [DatabaseManager.mapFilesSingle, DatabaseManager.mapFilesGlob]) {
        for (const [path, module] of Object.entries(source || {})) {
            try {
                const data = module.default || module;
                for (const [mapId, def] of Object.entries(data)) {
                    if (!def.id) def.id = mapId;
                    maps[mapId] = def;
                }
            } catch (error) {
                console.warn(`[MapRegistry] Error loading map JSON from ${path}:`, error);
            }
        }
    }

    return maps;
}

/** @type {Record<string, object>} */
const MAPS = loadJsonMaps();

/**
 * Every Map, including the ones `listMaps` filters out.
 *
 * `listMaps` is the *shop's* list — priced, non-tutorial. Anything that needs to
 * reason about Maps as content rather than as purchases (terrain assignment,
 * content audits) needs all of them.
 */
export function allMaps() {
    return MAPS;
}

/** A Map definition by id, or null. */
export function getMap(mapId) {
    return MAPS[mapId] || null;
}

/**
 * Every purchasable Map in price order (D-101).
 *
 * Excludes the Guild Hall tutorial Maps by **id**, which is what the exclusion
 * is actually about (CR2-125). The code-side Guild Hall Map aliases
 * (`guildHallMaps.js`) were deleted with the Map bursts (Token Lifecycle 9.1),
 * so the test is the id prefix, the same one the CMS simulator uses
 * (`mapPass.isGuildHallMap`).
 *
 * ⚠️ Since 9.1 nothing sells or bursts a Map. This list is still read by the
 * random quest bounties (to size a target, until slice 9.5) and by the content
 * audit.
 */
export function listMaps() {
    return Object.values(MAPS)
        .filter(m => !String(m.id).startsWith('map_guild_hall') && m.price > 0)
        .sort((a, b) => a.price - b.price);
}

