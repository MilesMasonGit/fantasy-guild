// Fantasy Guild — Map registry (loader)

/**
 * The Map catalogue, authored in the CMS and loaded from `data/maps.json`. ⚠️ No Map bursts and none is sold: a Map Token still in the game is an
 * ordinary Explore producer. Only the boot content audit reads this file.
 *
 * ⚠️ **Never hand-edit `data/maps.json`.** The CMS writes it wholesale.
 */

import { DatabaseManager } from '../DatabaseManager.js';

/** Merge every Map JSON source into one keyed object. Mirrors the Token loader. */
function loadJsonMaps() {
    const maps = {};

    for (const source of [DatabaseManager.mapFilesSingle]) {
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
 * Every purchasable Map in price order.
 *
 * Excludes the Guild Hall tutorial Maps by **id** prefix, the same test the CMS simulator uses
 * (`mapPass.isGuildHallMap`).
 *
 * ⚠️ Nothing in the game calls this any more: Maps are no longer sold.
 */
export function listMaps() {
    return Object.values(MAPS)
        .filter(m => !String(m.id).startsWith('map_guild_hall') && m.price > 0)
        .sort((a, b) => a.price - b.price);
}

