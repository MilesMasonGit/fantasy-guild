// The CMS's table of renamed ids (shape)

/**
 * In the CMS an item's, a Token's or a library effect's id follows its name, so correcting a name
 * changes the id. The CMS keeps each rename, and its Sync writes them to `data/renames.json` as one
 * table, old id to the id it has now, per kind:
 *
 * ```json
 * { "items": { "item_oak_wood": "item_oak_logs" }, "tokens": {}, "effects": {} }
 * ```
 *
 * A save is written with the ids of its day; loading it follows this table (`followRenames.js`).
 * An id the data still defines is never followed: a name used again belongs to what has it now.
 *
 * Pure: the game's loader and the CMS both read the table through here.
 */

/** The kinds of content whose ids follow their names in the CMS. */
export const RENAME_KINDS = Object.freeze(['items', 'tokens', 'effects']);

/** The file the CMS writes the table to, in `data/`. */
export const RENAMES_FILE = 'renames.json';

/** A table with no renames. */
export function emptyRenames() {
    return { items: {}, tokens: {}, effects: {} };
}

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A table from whatever a file holds: each kind a map of non-empty strings; anything else is dropped. */
export function normaliseRenames(raw) {
    const out = emptyRenames();
    if (!isPlainObject(raw)) return out;
    for (const kind of RENAME_KINDS) {
        const map = raw[kind];
        if (!isPlainObject(map)) continue;
        for (const [from, to] of Object.entries(map)) {
            if (typeof to === 'string' && to && from && to !== from) out[kind][from] = to;
        }
    }
    return out;
}

/** How many renames a table holds, all kinds together. */
export function renameCount(table) {
    return RENAME_KINDS.reduce((n, kind) => n + Object.keys(table?.[kind] || {}).length, 0);
}

/**
 * The id `id` now goes by: the first id along its renames that `isDefined` knows, or null when `id`
 * is defined itself, has no rename, or its renames lead nowhere defined (deleted since). A chain
 * (renamed twice) is followed; a loop stops where it comes round.
 *
 * @param {Record<string, string>} map one kind's renames
 * @param {string} id
 * @param {(id: string) => boolean} isDefined
 * @returns {string|null}
 */
export function followRename(map, id, isDefined) {
    if (!map || typeof id !== 'string' || !id || isDefined(id)) return null;
    const seen = new Set([id]);
    let current = id;
    while (Object.prototype.hasOwnProperty.call(map, current)) {
        const next = map[current];
        if (typeof next !== 'string' || !next || seen.has(next)) return null;
        if (isDefined(next)) return next;
        seen.add(next);
        current = next;
    }
    return null;
}
