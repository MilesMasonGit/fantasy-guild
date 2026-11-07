import { create } from 'zustand';

/**
 * The CMS page's side of the workspace on disk (`cms/workspace/workspace.json`, served by
 * `/api/workspace`, see `cms/workspaceFile.js`). The disk copy is the authority; this browser's
 * localStorage is a cache of it, read only when the disk cannot be reached.
 *
 * - `workspaceStorage` is the entity store's persist storage. Until `connectDiskWorkspace` has
 *   run it behaves exactly like localStorage (tests, and a page whose server has no disk route).
 *   Once connected, every change is written to the cache at once and to the disk about a second
 *   after the last one, together with the simulator's dials.
 * - Each disk write names the revision it was made from; the server refuses one made from an older
 *   revision (another tab or the command line wrote since), and the page then shows a banner
 *   instead of overwriting. The refused copy is kept in Backups.
 *
 * ⚠️ The owner's work must survive the move from the browser: on the first start with no file on
 * disk, the browser's copy seeds the file (and the server keeps a `migrated_<time>` backup), and
 * nothing anywhere clears localStorage.
 */

export const ENTITY_KEY = 'fantasy-guild-cms-v2';
export const GLOBALS_KEY = 'fantasy-guild-cms-globals';
/** Beside the cache: the disk revision it was loaded from, and whether it holds edits the disk has not had yet. */
export const DISK_META_KEY = 'fantasy-guild-cms-disk';
export const SAVE_DELAY_MS = 1000;
const RETRY_MS = 5000;
const UI_KEYS = ['activeEntityId', 'activeEntityType'];

/** What the page shows about the disk copy (`WorkspaceStatus`, `WorkspaceBanner`). */
export const useDiskWorkspace = create(() => ({
    /** 'starting' | 'disk' | 'browser' (no disk: edits stay in this browser only) */
    mode: 'starting',
    revision: null,
    savedAt: null,
    saving: false,
    /** Set when the disk changed elsewhere: `{ refusedBackup }` (null when nothing of this tab's was refused yet). */
    conflict: null,
    /** A one-off note from the start (the move to disk, edits found in the browser), or null. */
    notice: null,
    error: null,
}));
const setStatus = (patch) => useDiskWorkspace.setState(patch);

const local = {
    read(name) {
        try {
            const raw = globalThis.localStorage?.getItem(name);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },
    write(name, value) {
        try {
            globalThis.localStorage?.setItem(name, JSON.stringify(value));
        } catch {
            // A full or missing localStorage costs only the cache once the disk holds the workspace.
        }
    },
    remove(name) {
        try {
            globalThis.localStorage?.removeItem(name);
        } catch {
            // Nothing cached.
        }
    },
};

/** The workspace as the disk holds it: the store's persisted state without the open-entity selection, which is each tab's own. */
export function diskContent(state) {
    const out = {};
    for (const [key, value] of Object.entries(state || {})) {
        if (!UI_KEYS.includes(key) && typeof value !== 'function') out[key] = value;
    }
    return out;
}

/** Whether a stored workspace holds anything worth keeping. */
export function holdsContent(state) {
    if (!state || typeof state !== 'object') return false;
    const keyed = (v) => v && typeof v === 'object' && Object.values(v).some((x) => (Array.isArray(x) ? x.length > 0 : x != null));
    return keyed(state.items) || keyed(state.tokens) || keyed(state.effects) || keyed(state.recipePools)
        || state.starterCamp != null || state.skillPerks != null || state.hallStars != null || state.world != null;
}

/** The connection to the disk, once made. */
let session = null;

export const workspaceStorage = {
    getItem(name) {
        // ⚠️ Once connected, a store created again (a module reload) must read what the disk handed over and every edit since, never an older cache.
        if (session && name === ENTITY_KEY && session.current) return { state: { ...session.current }, version: 1 };
        return local.read(name);
    },
    setItem(name, value) {
        local.write(name, value);
        if (session && name === ENTITY_KEY) {
            session.current = value?.state ?? null;
            changed();
        }
    },
    removeItem(name) {
        local.remove(name);
    },
};

function writeMeta(dirty) {
    local.write(DISK_META_KEY, { file: session.file, revision: session.revision, dirty });
}

function changed() {
    session.changes += 1;
    writeMeta(true);
    schedule();
}

function schedule(delay = SAVE_DELAY_MS) {
    if (!session) return;
    clearTimeout(session.timer);
    session.timer = setTimeout(() => { flush(); }, delay);
}

function payloadText(s) {
    return JSON.stringify({ workspace: diskContent(s.current), simDials: s.getDials() ?? null });
}

async function putWorkspace(s, body) {
    const res = await s.fetchFn('/api/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    const out = await res.json().catch(() => ({}));
    return { res, out };
}

/** Send the workspace to the disk now, if it changed since the last send. Resolves when done. */
async function flush() {
    const s = session;
    if (!s || !s.current) return;
    clearTimeout(s.timer);
    s.timer = null;
    if (s.inFlight) {
        s.again = true;
        return s.inFlight;
    }
    const content = payloadText(s);
    if (content === s.lastSent) {
        if (s.changes === s.sentChanges) writeMeta(false);
        return;
    }
    const mark = s.changes;
    setStatus({ saving: true });
    s.inFlight = (async () => {
        try {
            const body = `{"baseRevision":${s.revision},"clientId":${JSON.stringify(s.clientId)},${content.slice(1)}`;
            const { res, out } = await putWorkspace(s, body);
            if (res.status === 409) {
                // Never written over: the banner asks for a reload, and each refusal refreshes this tab's backup.
                setStatus({ conflict: { refusedBackup: out.refusedBackup || null }, error: null });
                return;
            }
            if (!res.ok) throw new Error(out.error || 'HTTP ' + res.status);
            s.revision = out.revision;
            s.lastSent = content;
            s.sentChanges = mark;
            writeMeta(s.changes !== mark);
            setStatus({ revision: out.revision, savedAt: out.savedAt, error: null });
        } catch (err) {
            setStatus({ error: 'Not saved to disk yet: ' + err.message });
            s.again = true;
            s.retryDelay = RETRY_MS;
        } finally {
            setStatus({ saving: false });
        }
    })();
    try {
        await s.inFlight;
    } finally {
        s.inFlight = null;
        if (s.again) {
            s.again = false;
            schedule(s.retryDelay || 0);
            s.retryDelay = 0;
        }
    }
}

/** Write any change waiting for its second now (New workspace, a test). */
export async function saveWorkspaceNow() {
    if (!session) return false;
    await flush();
    while (session?.inFlight) await session.inFlight;
    return !useDiskWorkspace.getState().conflict;
}

/** Whether the disk moved on since this page loaded it (the command line, another tab); checked whenever the page comes back into view. */
async function checkDisk() {
    const s = session;
    if (!s || s.inFlight || useDiskWorkspace.getState().conflict) return;
    try {
        const res = await s.fetchFn('/api/workspace?meta=1');
        if (!res.ok) return;
        const meta = await res.json();
        if (session === s && !s.inFlight && meta.revision !== s.revision) setStatus({ conflict: { refusedBackup: null } });
    } catch {
        // The next save reports it.
    }
}

async function postBackup(fetchFn, name, workspace, simDials) {
    const res = await fetchFn('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data: { ...diskContent(workspace), ...(simDials ? { simDials } : {}) }, isAutoSave: false }),
    });
    if (!res.ok) throw new Error('the backup could not be written');
    return (await res.json().catch(() => ({}))).name || name;
}

const stampOf = (date) => date.toISOString().replace(/[:.]/g, '-');

/**
 * Load the workspace from disk into the stores and keep the disk up to date from then on. Call
 * once, before the page draws. Resolves with the status; on a server without the disk route (or
 * a damaged file) the page carries on with this browser's copy and says so.
 * @param {{ store, globalStore, fetchFn?, now?, win? }} options the entity store (persisted through
 *        `workspaceStorage`) and the globals store holding `simDials`
 */
export async function connectDiskWorkspace(options = {}) {
    try {
        return await connect(options);
    } catch (err) {
        if (!session) setStatus({ mode: 'browser', error: `The workspace on disk could not be connected (${err.message}), so edits are kept in this browser only.` });
        else setStatus({ error: err.message });
        return useDiskWorkspace.getState();
    }
}

async function connect({ store, globalStore, fetchFn = (...a) => fetch(...a), now = () => new Date(), win = globalThis.window } = {}) {
    // The browser's copies are read before anything can write over them.
    const cached = local.read(ENTITY_KEY);
    const cachedDials = local.read(GLOBALS_KEY)?.state?.simDials ?? null;
    const storedMeta = local.read(DISK_META_KEY);

    const getDisk = async () => {
        const res = await fetchFn('/api/workspace');
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || typeof body.exists !== 'boolean') throw new Error(body?.error || 'HTTP ' + res.status);
        return body;
    };

    let disk;
    try {
        disk = await getDisk();
    } catch (err) {
        setStatus({ mode: 'browser', error: `The workspace on disk could not be read (${err.message}), so edits are kept in this browser only.` });
        return useDiskWorkspace.getState();
    }

    const s = {
        fetchFn,
        getDials: () => globalStore?.getState().simDials ?? null,
        clientId: stampOf(now()),
        file: disk.file ?? null,
        revision: 0,
        current: null,
        lastSent: null,
        changes: 0,
        sentChanges: 0,
        timer: null,
        inFlight: null,
        again: false,
        retryDelay: 0,
    };
    let notice = null;
    // ⚠️ The cache belongs to one workspace file: two checkouts can serve this port in turn, and one's unsent edits must never be pushed into the other's.
    const meta = storedMeta && storedMeta.file === s.file ? storedMeta : null;

    if (!disk.exists && holdsContent(cached?.state)) {
        // The move from the browser: its copy becomes the file, with a backup kept first.
        const { res, out } = await putWorkspace(s, JSON.stringify({ seed: true, workspace: diskContent(cached.state), simDials: cachedDials }));
        if (res.ok) {
            s.revision = out.revision;
            s.current = cached.state;
            s.lastSent = JSON.stringify({ workspace: diskContent(cached.state), simDials: cachedDials });
            notice =`Your workspace moved from this browser to disk (cms/workspace/workspace.json). A copy is in Backups as ${out.backup}.`;
        } else if (res.status === 409) {
            disk = await getDisk();
        } else {
            setStatus({ mode: 'browser', error: `The workspace could not be moved to disk (${out.error || 'HTTP ' + res.status}), so edits are kept in this browser only.` });
            return useDiskWorkspace.getState();
        }
    }

    let useDisk = disk.exists && !s.current;
    if (useDisk && cached?.state) {
        const content = (state) => JSON.stringify(diskContent(state));
        if (meta?.dirty && meta.revision === disk.revision) {
            // Edits from the last visit that never reached the disk (the tab closed within a second of them), and the disk has not moved since: they are the newest copy.
            useDisk = false;
            s.revision = disk.revision;
            s.current = cached.state;
            s.changes = 1;
            notice = 'Edits from your last visit had not reached the disk yet; they were saved now.';
        } else if (holdsContent(cached.state) && (meta?.dirty || !meta) && content(cached.state) !== content(disk.workspace)) {
            // Both moved, or this copy was written by a CMS that did not know the disk: the disk wins and the browser's copy is kept.
            try {
                const name = await postBackup(fetchFn, `${meta ? 'unsent' : 'browser'}_${stampOf(now())}`, cached.state, cachedDials);
                notice = meta
                    ? `Edits from your last visit had not reached the disk, and the disk changed since. The disk's copy is open; yours is in Backups as ${name}.`
                    : `This browser held a different copy of the workspace from the one on disk. The disk's copy is open; the browser's is in Backups as ${name}.`;
            } catch (err) {
                setStatus({ mode: 'browser', error: `This browser's copy differs from the disk's and could not be backed up (${err.message}), so nothing was replaced. Edits are kept in this browser only.` });
                return useDiskWorkspace.getState();
            }
        }
    }

    if (useDisk) {
        const ui = Object.fromEntries(UI_KEYS.map((k) => [k, cached?.state?.[k] ?? null]));
        s.revision = disk.revision;
        s.current = { ...disk.workspace, ...ui };
        s.lastSent = JSON.stringify({ workspace: disk.workspace, simDials: disk.simDials ?? null });
        local.write(ENTITY_KEY, { state: s.current, version: 1 });
        if (disk.simDials && globalStore) {
            globalStore.setState((g) => ({ simDials: { ...g.simDials, ...disk.simDials } }));
        }
    } else if (!disk.exists && !s.current) {
        // Nothing anywhere yet: the first edit makes the file.
        s.revision = 0;
    }

    session = s;
    writeMeta(s.changes > 0);
    if (useDisk) await store.persist.rehydrate();
    if (!s.current && store) s.current = store.persist.getOptions().partialize({ ...store.getState() });

    globalStore?.subscribe((next, prev) => {
        if (next.simDials !== prev.simDials && session === s) changed();
    });
    if (win?.addEventListener) {
        win.addEventListener('focus', () => { checkDisk(); });
        // A tab being hidden or closed sends what is waiting rather than its second.
        win.addEventListener('pagehide', () => { if (s.timer) flush(); });
        win.document?.addEventListener?.('visibilitychange', () => { if (win.document.visibilityState === 'hidden' && s.timer) flush(); });
    }

    setStatus({ mode: 'disk', revision: s.revision, savedAt: disk.exists ? disk.savedAt : null, notice, error: null });
    if (s.changes > 0) await flush();
    return useDiskWorkspace.getState();
}

/** Forget the connection (tests). */
export function disconnectDiskWorkspace() {
    if (session) clearTimeout(session.timer);
    session = null;
    useDiskWorkspace.setState({ mode: 'starting', revision: null, savedAt: null, saving: false, conflict: null, notice: null, error: null });
}
