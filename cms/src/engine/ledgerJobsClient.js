/**
 * Runs the ledger's slow jobs (`ledgerJobs.js`) in a Web Worker, off the page's thread, so an edit
 * never waits for the report. Where there is no Worker (the tests) a job runs in this thread, after
 * the current task.
 */

let worker = null;
let nextId = 1;
const waiting = new Map();

function workerOrNull() {
    if (typeof Worker === 'undefined') return null;
    if (!worker) {
        worker = new Worker(new URL('./ledgerWorker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (event) => {
            const { id, result, error } = event.data || {};
            const job = waiting.get(id);
            if (!job) return;
            waiting.delete(id);
            if (error) job.reject(new Error(error));
            else job.resolve(result);
        };
        worker.onerror = (event) => {
            const err = new Error(event?.message || 'The ledger worker failed');
            for (const job of waiting.values()) job.reject(err);
            waiting.clear();
            worker = null;
        };
    }
    return worker;
}

/** Whether jobs run in a Worker here. */
export function hasLedgerWorker() {
    return typeof Worker !== 'undefined';
}

/** Run one job: a promise of its result. */
export function runLedgerJob(type, payload) {
    const w = workerOrNull();
    if (!w) return import('./ledgerJobs.js').then((m) => new Promise((resolve) => setTimeout(resolve, 0)).then(() => m.runLedgerJobNow(type, payload)));
    const id = nextId++;
    return new Promise((resolve, reject) => {
        waiting.set(id, { resolve, reject });
        w.postMessage({ id, type, payload });
    });
}
