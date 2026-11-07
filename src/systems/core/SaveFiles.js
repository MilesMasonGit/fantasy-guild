/**
 * The desktop build's saves: one file per slot in the saves folder (`src-tauri/src/saves.rs`), so
 * a save can be copied, kept or edited outside the game. The app writes each save whole or not at
 * all (a temp file, flushed to the disk, renamed over the old one) and keeps the save it replaced
 * as the slot's backup. The browser and dev builds keep their saves in localStorage
 * (`SaveManager`), and nothing here is active there.
 *
 * A slot is read fresh from the disk when it is opened. The slot screen reads a copy of each
 * slot's save, taken at boot (`init`) and again whenever the window regains focus there
 * (`refreshAll`), so a file copied in while the game is open shows up.
 *
 * Writes go out in order, one at a time per slot; a write still waiting when a newer one comes is
 * replaced by it, since only the newest game needs to reach the disk.
 */

/** Sent to the page by the app when its window is asked to close (`saves.rs`). */
export const CLOSE_REQUESTED_EVENT = 'fg-close-requested';

/** The app's commands, through Tauri's `invoke`. */
export function tauriBackend(invoke) {
    return {
        async read(slot, backup) {
            const out = await invoke('save_read', { slot, backup });
            return out == null ? null : new TextDecoder().decode(out);
        },
        // Sent as bytes: a large save is not escaped into JSON on the way.
        write: (slot, text, { rollBackup }) => invoke('save_write', new TextEncoder().encode(text), {
            headers: { 'fg-slot': String(slot), 'fg-roll-backup': rollBackup ? '1' : '0' }
        }),
        remove: (slot) => invoke('save_delete', { slot }),
        folder: () => invoke('saves_folder'),
        openFolder: () => invoke('open_saves_folder'),
        claimCloseSave: () => invoke('claim_close_save'),
        closeWindow: () => invoke('close_after_save')
    };
}

/** The desktop build's backend; null in a browser, a dev build or a test. */
export function detectBackend(win = globalThis.window, env = import.meta.env) {
    if (env?.DEV) return null;
    const invoke = win?.__TAURI__?.core?.invoke;
    return typeof invoke === 'function' ? tauriBackend(invoke) : null;
}

let backend = detectBackend();
let slotCount = 0;
let folder = null;
/** slot -> { text: string|null, unreadable: boolean }: what the slot screen reads. */
const copies = new Map();
/** slot -> { running, next, idle, version } */
const queues = new Map();
const listeners = new Set();

/** Whether saves are files (the desktop build). */
export function isActive() {
    return backend !== null;
}

/** Swap the file backend: a test's fake file system, or null for localStorage. */
export function useBackend(next) {
    backend = next;
    slotCount = 0;
    folder = null;
    copies.clear();
    queues.clear();
}

/** Read every slot's save for the slot screen, and where the folder is. Never rejects. */
export async function init(count) {
    slotCount = count;
    if (!backend) return;
    try {
        folder = await backend.folder();
    } catch (err) {
        console.error('[SaveFiles] Could not find the saves folder:', err);
    }
    await refreshAll();
}

/** The saves folder's path, once `init` has found it. */
export function folderPath() {
    return folder;
}

/** Called after the copies the slot screen reads have changed under it. */
export function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function changed() {
    for (const fn of listeners) {
        try {
            fn();
        } catch (err) {
            console.error('[SaveFiles] A listener failed:', err);
        }
    }
}

function queueFor(slot) {
    let q = queues.get(slot);
    if (!q) {
        q = { running: false, next: null, idle: null, version: 0 };
        queues.set(slot, q);
    }
    return q;
}

/** Resolves once every write and delete asked of `slot` so far has finished. */
async function settled(slot) {
    const q = queues.get(slot);
    while (q?.idle) await q.idle;
}

/** Resolves once every write and delete asked so far has finished, every slot. */
export async function flush() {
    for (;;) {
        const busy = [...queues.values()].map(q => q.idle).filter(Boolean);
        if (!busy.length) return;
        await Promise.all(busy);
    }
}

/**
 * Re-read one slot's save into the copy the slot screen reads. A file that cannot be read at all
 * is marked unreadable, so the slot shows as damaged rather than empty and is never overwritten
 * by a new game.
 */
export async function refresh(slot) {
    if (!backend) return false;
    await settled(slot);
    return readCopy(slot);
}

/** @returns {Promise<boolean>} whether the copy changed */
async function readCopy(slot) {
    const q = queueFor(slot);
    const version = q.version;
    let entry;
    try {
        entry = { text: await backend.read(slot, false), unreadable: false };
    } catch (err) {
        console.error(`[SaveFiles] Slot ${slot} could not be read:`, err);
        entry = { text: null, unreadable: true };
    }
    // A write asked for while this read was out is newer than what it read.
    if (q.version !== version) return false;
    const before = copies.get(slot);
    copies.set(slot, entry);
    return before?.text !== entry.text || before?.unreadable !== entry.unreadable;
}

/** Re-read every slot (`refresh`), and tell the listeners if any changed. */
export async function refreshAll() {
    if (!backend) return;
    const slots = Array.from({ length: slotCount }, (_, i) => i);
    const changes = await Promise.all(slots.map(refresh));
    if (changes.some(Boolean)) changed();
}

/** Whether the slot holds a save, as last read or written; an unreadable file counts. */
export function hasSave(slot) {
    const entry = copies.get(slot);
    return !!entry && (entry.unreadable || !!entry.text);
}

/**
 * The slot's save as last read or written, or null when it has none.
 * ⚠️ Throws for a file that could not be read, which the slot screen shows as damaged.
 */
export function savedText(slot) {
    const entry = copies.get(slot);
    if (entry?.unreadable) throw new Error(`Slot ${slot}'s save could not be read`);
    return entry?.text ?? null;
}

/**
 * The slot's save (or its backup), read now from the disk, after any write still going; null
 * when there is no such file. Rejects when the file cannot be read.
 */
export async function readSave(slot, { backup = false } = {}) {
    await settled(slot);
    const q = queueFor(slot);
    const version = q.version;
    const text = await backend.read(slot, backup);
    if (!backup && q.version === version) copies.set(slot, { text, unreadable: false });
    return text;
}

async function pump(slot, q) {
    q.running = true;
    let finish;
    q.idle = new Promise(resolve => { finish = resolve; });
    try {
        while (q.next) {
            const job = q.next;
            q.next = null;
            let result;
            try {
                if (job.kind === 'remove' || job.removeFirst) await backend.remove(slot);
                if (job.kind === 'write') await backend.write(slot, job.text, { rollBackup: job.rollBackup });
                result = { ok: true };
            } catch (error) {
                console.error(`[SaveFiles] Slot ${slot}: the ${job.kind} failed:`, error);
                result = { ok: false, error };
            }
            // The copy follows the disk again, not the write that failed (unless a newer one waits).
            if (!result.ok && !q.next) {
                await readCopy(slot);
                changed();
            }
            for (const resolve of job.waiters) resolve(result);
        }
    } finally {
        q.running = false;
        q.idle = null;
        finish();
    }
}

function enqueue(slot, job) {
    const q = queueFor(slot);
    q.version++;
    const waiting = q.next;
    if (waiting) {
        // The newer job replaces the one still waiting; its callers hear the newer one's result.
        job.waiters.push(...waiting.waiters);
        if (job.kind === 'write') {
            job.removeFirst = waiting.kind === 'remove' || waiting.removeFirst;
            // ⚠️ A write that was to keep the backup still keeps it, so a damaged save is never
            // rolled over the good backup it was loaded from.
            if (waiting.kind === 'write' && !waiting.rollBackup) job.rollBackup = false;
        }
    }
    const result = new Promise(resolve => job.waiters.push(resolve));
    q.next = job;
    if (!q.running) pump(slot, q);
    return result;
}

/**
 * Write the slot's save. The copy the slot screen reads changes at once; the file follows. With
 * `rollBackup`, the save it replaces becomes the slot's backup first. Resolves `{ ok, error }`,
 * never rejects.
 */
export function writeSave(slot, text, { rollBackup = true } = {}) {
    copies.set(slot, { text, unreadable: false });
    return enqueue(slot, { kind: 'write', text, rollBackup, removeFirst: false, waiters: [] });
}

/** Remove the slot's save and its backup. Resolves `{ ok, error }`, never rejects. */
export function deleteSave(slot) {
    copies.set(slot, { text: null, unreadable: false });
    return enqueue(slot, { kind: 'remove', waiters: [] });
}

/** Show the saves folder in the system's file browser. Resolves false if it could not. */
export async function openFolder() {
    if (!backend) return false;
    try {
        await backend.openFolder();
        return true;
    } catch (err) {
        console.error('[SaveFiles] Could not open the saves folder:', err);
        return false;
    }
}

/** From now on the app asks the page to save before its window closes (`CLOSE_REQUESTED_EVENT`). */
export function claimCloseSave() {
    return backend?.claimCloseSave().catch(err => console.error('[SaveFiles] Could not claim the close:', err));
}

/** Close the window, once the page has saved. */
export function closeWindow() {
    return backend?.closeWindow().catch(err => console.error('[SaveFiles] Could not close the window:', err));
}
