import { runLedgerJobNow } from './ledgerJobs.js';

/** The ledger's Web Worker: one job per message, answered with its id (`ledgerJobsClient.js`). */
self.onmessage = (event) => {
    const { id, type, payload } = event.data || {};
    try {
        self.postMessage({ id, result: runLedgerJobNow(type, payload) });
    } catch (err) {
        self.postMessage({ id, error: err?.message || String(err) });
    }
};
