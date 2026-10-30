import fs from 'fs';
import path from 'path';
import { validatePack } from './src/engine/changePacks.js';

/**
 * The change-pack inbox (`cms/incoming/`) and its archive (`cms/incoming/applied/`). Agents write
 * packs into the inbox; the CMS's review page reads them, and finishing a review moves a pack into
 * the archive with a record of what was applied, so it can be undone. Never touches `data/`.
 */

const PACK_FILE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}\.json$/;

/** The absolute path of `file` in `dir`, or null when it is not a plain pack file name. ⚠️ The only gate between a request and the disk. */
export function packFilePath(dir, file) {
    if (typeof file !== 'string' || !PACK_FILE.test(file)) return null;
    const root = path.resolve(dir);
    const full = path.resolve(root, file);
    return path.dirname(full) === root ? full : null;
}

/** Read and check one pack file: `{ pack }` or `{ errors }` (each a readable reason). */
export function readPackFile(full) {
    let pack;
    try {
        pack = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (err) {
        return { errors: ['Not valid JSON: ' + err.message] };
    }
    const check = validatePack(pack, { fileName: path.basename(full) });
    return check.ok ? { pack } : { errors: check.errors, pack };
}

function summary(file, read, stat) {
    const pack = read.pack;
    const base = { file, modifiedAt: stat.mtimeMs };
    if (read.errors) return { ...base, id: pack?.id ?? null, asked: pack?.asked ?? null, errors: read.errors };
    return {
        ...base,
        id: pack.id,
        asked: pack.asked,
        createdAt: pack.createdAt,
        entries: pack.entries.length,
        // The gate the agent ran (`changePackTool.mjs gate --write`); the review page runs it again on open.
        ...(pack.gate && typeof pack.gate === 'object' ? { gate: { verdict: pack.gate.verdict, summary: pack.gate.summary, workspaceFingerprint: pack.gate.workspaceFingerprint, toolVersion: pack.gate.toolVersion, at: pack.gate.at } } : {}),
        ...(Array.isArray(pack.intent?.stages) && pack.intent.stages.length ? { declares: pack.intent.stages.length } : {}),
        ...(pack.review ? { review: { finishedAt: pack.review.finishedAt, applied: (pack.review.entries || []).filter((e) => e.applied).length } } : {}),
    };
}

function listDir(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((f) => PACK_FILE.test(f))
        .map((f) => {
            const full = path.join(dir, f);
            return summary(f, readPackFile(full), fs.statSync(full));
        })
        .sort((a, b) => b.modifiedAt - a.modifiedAt || a.file.localeCompare(b.file));
}

/** Every pack waiting for review, and every archived one; a malformed pack is listed with its reasons. */
export function listPacks(inboxDir) {
    return { inbox: listDir(inboxDir), applied: listDir(path.join(inboxDir, 'applied')) };
}

/** `{ status, body }` for one pack from the inbox, or from the archive with `archived`. */
export function getPack(inboxDir, file, { archived = false } = {}) {
    const full = packFilePath(archived ? path.join(inboxDir, 'applied') : inboxDir, file);
    if (!full) return { status: 400, body: { error: 'Not a pack file name: ' + file } };
    if (!fs.existsSync(full)) return { status: 404, body: { error: 'No such pack: ' + file } };
    const read = readPackFile(full);
    if (read.errors) return { status: 422, body: { error: 'This pack is malformed', errors: read.errors } };
    return { status: 200, body: read.pack };
}

/**
 * Finish a review: write the pack, with `review` (what was accepted and applied, and the values
 * before and after, for undo), into the archive and remove it from the inbox.
 */
export function archivePack(inboxDir, file, review) {
    const from = packFilePath(inboxDir, file);
    if (!from) return { status: 400, body: { error: 'Not a pack file name: ' + file } };
    if (!fs.existsSync(from)) return { status: 404, body: { error: 'No such pack in the inbox: ' + file } };
    if (!review || typeof review !== 'object' || !Array.isArray(review.entries)) {
        return { status: 400, body: { error: 'Missing the review record' } };
    }
    const read = readPackFile(from);
    if (read.errors) return { status: 422, body: { error: 'This pack is malformed', errors: read.errors } };
    const archiveDir = path.join(inboxDir, 'applied');
    fs.mkdirSync(archiveDir, { recursive: true });
    const to = packFilePath(archiveDir, file);
    fs.writeFileSync(to, JSON.stringify({ ...read.pack, review: { ...review, finishedAt: review.finishedAt || new Date().toISOString() } }, null, 2));
    fs.unlinkSync(from);
    return { status: 200, body: { success: true } };
}

/**
 * Undo's last step: move an archived pack back to the inbox for another review. Its review record
 * moves into `history`, so the pack reads as unreviewed again.
 */
export function restorePack(inboxDir, file, { undone = [] } = {}) {
    const archiveDir = path.join(inboxDir, 'applied');
    const from = packFilePath(archiveDir, file);
    if (!from) return { status: 400, body: { error: 'Not a pack file name: ' + file } };
    if (!fs.existsSync(from)) return { status: 404, body: { error: 'No such archived pack: ' + file } };
    const to = packFilePath(inboxDir, file);
    if (fs.existsSync(to)) return { status: 409, body: { error: 'A pack with this name is already in the inbox: ' + file } };
    const read = readPackFile(from);
    if (read.errors) return { status: 422, body: { error: 'This pack is malformed', errors: read.errors } };
    const { review, ...pack } = read.pack;
    const history = [...(pack.history || []), { ...review, undoneAt: new Date().toISOString(), undone }];
    fs.writeFileSync(to, JSON.stringify({ ...pack, history }, null, 2));
    fs.unlinkSync(from);
    return { status: 200, body: { success: true } };
}
