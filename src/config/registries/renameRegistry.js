// The CMS's renamed ids (loader)

import { DatabaseManager } from '../DatabaseManager.js';
import { normaliseRenames } from '../renameTable.js';

/**
 * The renames the CMS has recorded, read from `data/renames.json` (shape: `renameTable.js`). The
 * file is absent until a Sync first records one: the table is then empty and a save loads with
 * the ids it holds.
 *
 * ⚠️ Never hand-edit `data/renames.json`: the CMS's Sync writes it, adding to what it holds.
 */

function loadAuthored() {
    const raw = {};
    for (const [path, module] of Object.entries(DatabaseManager.renameFilesSingle || {})) {
        try {
            Object.assign(raw, module.default || module);
        } catch (error) {
            console.warn(`[RenameRegistry] Error loading renames from ${path}:`, error);
        }
    }
    return raw;
}

const fromFile = normaliseRenames(loadAuthored());
let override = null;

/** The renames in force, per kind (`{ items, tokens, effects }`, old id to new id). */
export function renameTable() {
    return override ?? fromFile;
}

/**
 * Use `raw` as the renames table (null: back to the file's). **For test fixtures only**, like
 * `setEventsForTests`; nothing in `src/systems` or `src/ui` may call it.
 */
export function setRenamesForTests(raw) {
    override = raw == null ? null : normaliseRenames(raw);
}

/** Undo {@link setRenamesForTests}. */
export function resetRenamesForTests() {
    setRenamesForTests(null);
}
