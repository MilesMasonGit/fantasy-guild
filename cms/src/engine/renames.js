import { RENAME_KINDS, RENAMES_FILE, emptyRenames, normaliseRenames, renameCount } from '../../../src/config/renameTable.js';

/**
 * Renames, from the editor to the game's `data/renames.json` (the shape: `src/config/renameTable.js`).
 *
 * An item's, a Token's or a library effect's id follows its name, so a corrected name is a new id,
 * and a save holding the old one would lose the thing. The workspace keeps a **record** of what
 * moved since the last Sync: for each entity that moved, the id it had at the last Sync → the id it
 * has now. One entry per entity, however many keystrokes the new name took: the ids it passed
 * through on the way were never in `data/`, so no save holds them.
 *
 * Sync sends the record beside the files (`RENAMES_SYNC_KEY`, like the plan) and the server adds
 * it to the table already in `data/renames.json` ({@link mergeRenameTables}); once the Sync has
 * landed, the record starts again from the ids it wrote ({@link settleSyncedRenames}). Restore from
 * Game starts an empty record: `data/` is then where every id stands.
 *
 * Pure.
 */

export { RENAME_KINDS, RENAMES_FILE, emptyRenames, renameCount };

/** The key the record rides under among the files a Sync builds; the server merges it into {@link RENAMES_FILE}. */
export const RENAMES_SYNC_KEY = '__renames__';

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** The workspace's record from a stored or imported workspace (none: empty). */
export function workspaceRenamesFrom(raw) {
    return normaliseRenames(raw);
}

/**
 * The record after an entity of `kind` moved from id `from` to `to`.
 * - It had moved before: its entry now ends at `to`, and goes when `to` is the id it started at.
 * - `from` is the starting id of another entity, which has moved on: the one moving now was made
 *   since the last Sync, so no save holds it under `from`, and nothing is recorded.
 * - Otherwise `from` is where it stood at the last Sync: a new entry.
 */
export function recordRename(record, kind, from, to) {
    if (!RENAME_KINDS.includes(kind) || !from || !to || from === to) return record;
    const map = record?.[kind] || {};
    const start = Object.keys(map).find((k) => map[k] === from);
    let next;
    if (start !== undefined) {
        next = { ...map };
        if (start === to) delete next[start];
        else next[start] = to;
    } else if (has(map, from)) {
        return record;
    } else {
        next = { ...map, [from]: to };
    }
    return { ...emptyRenames(), ...(record || {}), [kind]: next };
}

/** The record after the entity at `id` was deleted: a deleted thing is not followed anywhere. */
export function forgetRenamesTo(record, kind, id) {
    const map = record?.[kind] || {};
    const starts = Object.keys(map).filter((k) => map[k] === id);
    if (!starts.length) return record;
    const next = { ...map };
    for (const k of starts) delete next[k];
    return { ...emptyRenames(), ...(record || {}), [kind]: next };
}

/**
 * The record once a Sync that sent `sent` has landed: each sent entry is the data's now. An entity
 * renamed again while the Sync was on its way keeps that last move, counted from the id the Sync wrote.
 */
export function settleSyncedRenames(record, sent) {
    const out = { ...emptyRenames(), ...(record || {}) };
    for (const kind of RENAME_KINDS) {
        const map = { ...(out[kind] || {}) };
        for (const [from, to] of Object.entries(sent?.[kind] || {})) {
            if (!has(map, from)) continue;
            const now = map[from];
            delete map[from];
            if (now !== to) map[to] = now;
        }
        out[kind] = map;
    }
    return out;
}

/** The file each kind's ids are in. */
const FILE_OF_KIND = Object.freeze({ items: 'items.json', tokens: 'tokens.json', effects: 'effects.json' });

/** Per kind, the set of ids `files` define; a kind whose file is not among them takes `fallback`'s. */
export function idsByKind(files, fallback = null) {
    const out = {};
    for (const kind of RENAME_KINDS) {
        const file = files?.[FILE_OF_KIND[kind]];
        out[kind] = file && typeof file === 'object'
            ? new Set(Object.keys(file))
            : fallback?.[kind] ?? new Set();
    }
    return out;
}

/**
 * What `data/renames.json` holds after a Sync.
 * - `onDisk`: the table in `data/` now, every rename an earlier Sync recorded;
 * - `sent`: the workspace's record, what moved since the last Sync;
 * - `before`: per kind, the ids in `data/` now; `after`: per kind, the ids this Sync writes.
 *
 * 1. A sent rename counts only when its old id is in `data/` now: an id the game never had is in no
 *    save. (A stale record, sent again, names ids `data/` no longer has, and changes nothing.)
 * 2. The table's renames stay; a later one carries them on (renamed twice: the first old id leads
 *    to the end).
 * 3. An id this Sync writes is never renamed away: a name used again belongs to what has it now.
 * 4. Each old id points straight at the end of its chain; a loop is dropped.
 */
export function mergeRenameTables({ onDisk, sent, before, after }) {
    const disk = normaliseRenames(onDisk);
    const fresh = normaliseRenames(sent);
    const out = emptyRenames();
    for (const kind of RENAME_KINDS) {
        const had = before?.[kind] || new Set();
        const live = after?.[kind] || new Set();
        const merged = { ...disk[kind] };
        for (const [from, to] of Object.entries(fresh[kind])) {
            if (had.has(from)) merged[from] = to;
        }
        for (const id of Object.keys(merged)) {
            if (live.has(id)) delete merged[id];
        }
        for (const from of Object.keys(merged)) {
            const seen = new Set([from]);
            let end = merged[from];
            let loop = false;
            while (has(merged, end)) {
                if (seen.has(end)) { loop = true; break; }
                seen.add(end);
                end = merged[end];
            }
            if (!loop && end !== from) out[kind][from] = end;
        }
    }
    return out;
}
