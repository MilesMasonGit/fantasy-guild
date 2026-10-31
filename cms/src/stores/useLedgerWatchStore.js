import { create } from 'zustand';
import { useEntityStore } from './useEntityStore';
import { runLedgerJob, hasLedgerWorker } from '../engine/ledgerJobsClient';

/**
 * The ledger's before-and-after baselines (`engine/ledgerCompare.js`): a snapshot of the workspace
 * worked out again in the ledger's Worker after every edit (`current`, and `previous`, the one
 * before the last edit), and one of what the last Sync wrote (`sync`, from `data/` and the plan
 * file). Never persisted: they are worked out again when the CMS opens.
 */
export const useLedgerWatchStore = create((set) => ({
    current: null,
    previous: null,
    sync: null,
    syncError: null,
    syncLoading: false,
    error: null,
    busy: false,

    /** Work out the snapshot of what the last Sync wrote. */
    loadSync: async () => {
        set({ syncLoading: true, syncError: null });
        try {
            const res = await fetch('/api/load-game-data');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const snapshot = await runLedgerJob('snapshot', { workspace: await res.json() });
            set({ sync: snapshot, syncLoading: false });
        } catch (err) {
            set({ syncError: err.message, syncLoading: false });
        }
    },
}));

const CONTENT = ['items', 'tokens', 'effects', 'recipePools', 'starterCamp', 'skillPerks', 'planSettings'];

/** The workspace's content, as the ledger takes it. */
export function workspaceContent(state) {
    return Object.fromEntries(CONTENT.map((k) => [k, state[k] ?? null]));
}

const changed = (a, b) => CONTENT.some((k) => a[k] !== b[k]);

/**
 * Watch the workspace: after each edit (once it has been quiet for `debounceMs`) work its snapshot
 * out again in the Worker, keeping the one before as `previous`. One job at a time; edits made
 * while one runs are taken by the next. Returns a function that stops watching.
 */
export function startLedgerWatch({ debounceMs = 800, run = runLedgerJob } = {}) {
    let timer = null;
    let running = false;
    let again = false;
    let stopped = false;

    const work = async () => {
        if (running) { again = true; return; }
        running = true;
        useLedgerWatchStore.setState({ busy: true });
        try {
            const snapshot = await run('snapshot', { workspace: workspaceContent(useEntityStore.getState()) });
            if (stopped) return;
            const { current } = useLedgerWatchStore.getState();
            useLedgerWatchStore.setState({ previous: current, current: snapshot, error: null });
        } catch (err) {
            if (!stopped) useLedgerWatchStore.setState({ error: err.message });
        } finally {
            running = false;
            if (!stopped) useLedgerWatchStore.setState({ busy: false });
            if (again && !stopped) { again = false; work(); }
        }
    };
    const soon = () => {
        clearTimeout(timer);
        timer = setTimeout(work, debounceMs);
    };

    const unsubscribe = useEntityStore.subscribe((state, prev) => { if (changed(state, prev)) soon(); });
    work();
    return () => {
        stopped = true;
        clearTimeout(timer);
        unsubscribe();
    };
}

/** Start watching where the ledger has its Worker (not in the tests). */
export function startLedgerWatchIfWorker() {
    return hasLedgerWorker() ? startLedgerWatch() : () => {};
}
