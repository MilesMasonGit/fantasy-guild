// Fantasy Guild — Map registry (loader)

/**
 * The Cartographer's catalogue — the game's progression system (D-99) and its
 * primary gold sink (D-96), which are deliberately the same thing.
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
import { GUILD_HALL_MAPS } from './guildHallMaps.js';

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

    // Merge exclusive Guild Hall tutorial maps
    Object.assign(maps, GUILD_HALL_MAPS);

    return maps;
}

/** @type {Record<string, object>} */
const MAPS = loadJsonMaps();

/** A Map definition by id, or null. */
export function getMap(mapId) {
    return MAPS[mapId] || null;
}

/**
 * Every purchasable Map in price order (D-101).
 *
 * Excludes the Guild Hall tutorial Maps by **id**, which is what the exclusion
 * is actually about. It used to read `m.theme !== 'guild_hall'`; `theme` was a
 * retired concept (`concept_audit.md` §A) and that test was in any case already
 * covered by `price > 0`, since every Guild Hall Map alias shares one
 * definition priced at 0. Checking the ids says what is meant and does not
 * depend on a Map staying free. Changed 2026-08-24 (CR2-125).
 */
export function listMaps() {
    return Object.values(MAPS)
        .filter(m => !GUILD_HALL_MAPS[m.id] && m.price > 0)
        .sort((a, b) => a.price - b.price);
}

/** Total weight of a Map's pool, for the roll. */
export function poolWeight(mapId) {
    return (getMap(mapId)?.pool || []).reduce((sum, entry) => sum + (entry.weight || 0), 0);
}
