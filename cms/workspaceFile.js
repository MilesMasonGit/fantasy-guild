import fs from 'fs';
import path from 'path';
import process from 'node:process';

/**
 * The CMS workspace on disk (`cms/workspace/workspace.json`): the one authoritative copy of the
 * owner's authored content and the simulator's dials. The CMS page reads it on start and writes it
 * about a second after each change (`src/engine/diskWorkspace.js`); the command line (`cli.mjs`)
 * reads and writes the same file. The browser's localStorage is only a cache of it.
 *
 * Every write carries the revision it was made from, and the file refuses a write made from an
 * older one: two writers (two tabs, or a tab and the command line) can never silently overwrite
 * each other. A refused write from the CMS page is kept as a backup, so nothing typed is lost.
 *
 * Node only (the CMS's server plugin and its command line import it).
 */

export const WORKSPACE_FORMAT = 'fantasy-guild-cms-workspace';
export const WORKSPACE_VERSION = 1;
export const WORKSPACE_FILE = 'workspace.json';

/** The workspace's collections, in the order the file lists them. */
export const WORKSPACE_KEYS = Object.freeze([
    'items', 'tokens', 'effects', 'recipePools', 'starterCamp', 'skillPerks',
    'hallConstellations', 'hallStars', 'world', 'planSettings',
]);
const KEYED_COLLECTIONS = new Set(['items', 'tokens', 'effects', 'recipePools']);

/** Which entity the page has open: a tab's own state, kept in that browser and never on disk. */
export const UI_KEYS = Object.freeze(['activeEntityId', 'activeEntityType']);

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The workspace in the file's order: the known collections first (an absent keyed collection as
 * `{}`, any other as null), then anything else alphabetically. The records inside keep their own
 * order, which is the sidebar's: sorting them would reorder the owner's lists.
 */
export function orderedWorkspace(workspace = {}) {
    const out = {};
    for (const key of WORKSPACE_KEYS) {
        const value = workspace?.[key];
        out[key] = value === undefined ? (KEYED_COLLECTIONS.has(key) ? {} : null) : value;
    }
    for (const key of Object.keys(workspace || {}).sort()) {
        if (key in out || UI_KEYS.includes(key) || typeof workspace[key] === 'function') continue;
        out[key] = workspace[key];
    }
    return out;
}

/** The file's text: fixed field order, two-space indent, a closing newline, so a diff of it reads. */
export function serializeWorkspaceFile({ revision, savedAt, savedBy = null, simDials = null, workspace }) {
    return JSON.stringify({
        format: WORKSPACE_FORMAT,
        version: WORKSPACE_VERSION,
        revision,
        savedAt,
        savedBy,
        simDials: simDials ?? null,
        workspace: orderedWorkspace(workspace),
    }, null, 2) + '\n';
}

/**
 * Read the file: `{ exists: false, revision: 0 }`, or `{ exists: true, revision, savedAt, savedBy,
 * simDials, workspace }`. ⚠️ Throws on a file that is there but cannot be read, so no caller ever
 * mistakes a damaged file for a missing one and writes over it.
 */
export function readWorkspaceFile(file) {
    if (!fs.existsSync(file)) return { exists: false, revision: 0, savedAt: null, savedBy: null, simDials: null, workspace: null };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isObject(parsed) || parsed.format !== WORKSPACE_FORMAT || !isObject(parsed.workspace)) {
        throw new Error(`${file} is not a CMS workspace file (format "${WORKSPACE_FORMAT}")`);
    }
    return {
        exists: true,
        revision: Number.isInteger(parsed.revision) ? parsed.revision : 0,
        savedAt: parsed.savedAt ?? null,
        savedBy: parsed.savedBy ?? null,
        simDials: isObject(parsed.simDials) ? parsed.simDials : null,
        workspace: parsed.workspace,
    };
}

/** Whether a JSON value is a workspace file rather than a bare workspace (a backup, an autosave). */
export function isWorkspaceFile(value) {
    return isObject(value) && value.format === WORKSPACE_FORMAT && isObject(value.workspace);
}

/** The first half of `writeAtomically`: the text in a temporary file beside `file`. Returns the temporary file's path. */
export function writeTemp(file, text) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, text, 'utf8');
    return temp;
}

/** The second half: the temporary file renamed over `file`. */
export function replaceWithTemp(temp, file, text) {
    try {
        fs.renameSync(temp, file);
    } catch (err) {
        // Windows refuses a rename over a file another program holds open; write it in place instead.
        fs.writeFileSync(file, text, 'utf8');
        try { fs.unlinkSync(temp); } catch { /* already gone */ }
        if (!fs.existsSync(file)) throw err;
    }
}

/** Write through a temporary file and a rename, so a crash mid-write never leaves half a workspace. */
export function writeAtomically(file, text) {
    replaceWithTemp(writeTemp(file, text), file, text);
}

/** `2026-11-06T22-40-00-123Z`: sorts by time and survives the backup route's name filter. */
export function stamp(now = new Date()) {
    return now.toISOString().replace(/[:.]/g, '-');
}

/** Keep a workspace in the backups folder, as the File Manager lists and loads them (a bare workspace). Returns the backup's name. */
export function writeBackup(backupsDir, name, workspace, simDials = null) {
    const safe = String(name).replace(/[^a-z0-9_-]/gi, '_');
    fs.mkdirSync(backupsDir, { recursive: true });
    const data = { ...orderedWorkspace(workspace), ...(simDials ? { simDials } : {}) };
    fs.writeFileSync(path.join(backupsDir, `${safe}.json`), JSON.stringify(data, null, 2), 'utf8');
    return safe;
}

export class RevisionConflict extends Error {
    constructor(diskRevision, baseRevision) {
        super(`The workspace on disk is at revision ${diskRevision}, but this change was made from revision ${baseRevision}: it changed elsewhere in the meantime.`);
        this.diskRevision = diskRevision;
        this.baseRevision = baseRevision;
    }
}

/**
 * Write the workspace as the next revision, provided the disk is still at `baseRevision` (0 when
 * there is no file yet). `simDials` undefined keeps the dials the file holds.
 * @returns {{ revision: number, savedAt: string }}
 * @throws {RevisionConflict} when the disk moved on since `baseRevision`
 */
export function saveWorkspaceFile(file, workspace, { baseRevision, simDials, savedBy = null, now = new Date() } = {}) {
    if (!isObject(workspace)) throw new Error('A workspace must be an object of collections');
    const current = readWorkspaceFile(file);
    if (baseRevision !== current.revision) throw new RevisionConflict(current.revision, baseRevision);
    const revision = current.revision + 1;
    const savedAt = now.toISOString();
    writeAtomically(file, serializeWorkspaceFile({
        revision, savedAt, savedBy, workspace,
        simDials: simDials === undefined ? current.simDials : simDials,
    }));
    return { revision, savedAt };
}

/**
 * `PUT /api/workspace` from the CMS page, as `{ status, body }`.
 * - `{ seed: true, workspace, simDials }`: the first start after the move to disk. Writes a
 *   `migrated_<time>` backup first, then the file as revision 1; refused (409) if a file is already
 *   there (another tab moved first).
 * - `{ baseRevision, workspace, simDials, clientId }`: a save. Refused (409) unless the disk is at
 *   `baseRevision`; the refused workspace is then kept as the backup `refused_<clientId>`, rewritten
 *   by each later refusal from the same tab, so a tab that kept typing loses nothing.
 */
export function putWorkspace(file, body, { backupsDir, now = new Date() } = {}) {
    if (!isObject(body) || !isObject(body.workspace)) return { status: 400, body: { error: 'Missing the workspace' } };
    const simDials = isObject(body.simDials) ? body.simDials : body.simDials === null ? null : undefined;
    let current;
    try {
        current = readWorkspaceFile(file);
    } catch (err) {
        return { status: 500, body: { error: 'The workspace file on disk cannot be read, so nothing was written over it: ' + err.message } };
    }

    if (body.seed === true) {
        if (current.exists) return { status: 409, body: { error: 'A workspace is already on disk', revision: current.revision, savedAt: current.savedAt } };
        const backup = writeBackup(backupsDir, `migrated_${stamp(now)}`, body.workspace, simDials ?? null);
        const saved = saveWorkspaceFile(file, body.workspace, { baseRevision: 0, simDials: simDials ?? null, savedBy: 'cms (moved from the browser)', now });
        return { status: 200, body: { ...saved, backup } };
    }

    if (!Number.isInteger(body.baseRevision) || body.baseRevision < 0) return { status: 400, body: { error: 'Missing the revision this change was made from' } };
    if (body.baseRevision !== current.revision) {
        const clientId = typeof body.clientId === 'string' && body.clientId ? body.clientId : stamp(now);
        const refusedBackup = writeBackup(backupsDir, `refused_${clientId}`, body.workspace, simDials ?? null);
        return {
            status: 409,
            body: { error: 'The workspace on disk changed elsewhere; reload to see it', revision: current.revision, savedAt: current.savedAt, refusedBackup },
        };
    }
    const saved = saveWorkspaceFile(file, body.workspace, { baseRevision: body.baseRevision, simDials, savedBy: typeof body.savedBy === 'string' ? body.savedBy : 'cms', now });
    return { status: 200, body: saved };
}

/** `GET /api/workspace` as `{ status, body }`; with `meta`, everything but the workspace itself. */
export function getWorkspace(file, { meta = false } = {}) {
    let current;
    try {
        current = readWorkspaceFile(file);
    } catch (err) {
        return { status: 500, body: { error: 'The workspace file on disk cannot be read: ' + err.message } };
    }
    // `file` tells the page which workspace its cache belongs to: two checkouts can serve the same port in turn.
    if (meta || !current.exists) {
        const { exists, revision, savedAt, savedBy } = current;
        return { status: 200, body: { exists, revision, savedAt, savedBy, file } };
    }
    return { status: 200, body: { ...current, file } };
}
