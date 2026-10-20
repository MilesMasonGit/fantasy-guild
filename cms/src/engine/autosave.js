/**
 * The workspace's autosave to disk: every few minutes, if anything changed, the whole workspace
 * goes to `cms/backups/autosave_<time>.json` through the server's backup route, which keeps the
 * last five. The workspace otherwise lives only in this browser, and agents writing change packs
 * read this copy to see the owner's unsynced work (`cms/incoming/README.md`).
 */

export const AUTOSAVE_EVERY_MS = 3 * 60 * 1000;
const COLLECTIONS = ['items', 'tokens', 'effects', 'recipePools', 'starterCamp'];

/** `autosave_2026-10-20T15-04-05-123Z`: sorts by time, and the server's name filter keeps it intact. */
export function autosaveName(now = new Date()) {
    return 'autosave_' + now.toISOString().replace(/[:.]/g, '-');
}

/**
 * Start autosaving a zustand store. `snapshot(state)` picks what a workspace file holds.
 * Returns `{ stop, saveNow }`; `saveNow` saves even when nothing changed.
 */
export function startAutosave(store, snapshot, { everyMs = AUTOSAVE_EVERY_MS, fetchFn = (...a) => fetch(...a), now = () => new Date() } = {}) {
    let dirty = false;
    let saving = false;
    const unsubscribe = store.subscribe((state, prev) => {
        if (COLLECTIONS.some((k) => state[k] !== prev[k])) dirty = true;
    });

    const saveNow = async () => {
        if (saving) return false;
        saving = true;
        dirty = false;
        try {
            const res = await fetchFn('/api/backups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: autosaveName(now()), data: snapshot(store.getState()), isAutoSave: true }),
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return true;
        } catch (err) {
            dirty = true;
            console.warn('[CMS] Autosave failed; trying again next time:', err.message);
            return false;
        } finally {
            saving = false;
        }
    };

    const timer = setInterval(() => {
        if (dirty) saveNow();
    }, everyMs);

    return {
        saveNow,
        stop: () => {
            clearInterval(timer);
            unsubscribe();
        },
    };
}
