import { workspaceReport } from './ledgerReport.js';
import { snapshotOf } from './ledgerCompare.js';
import { runGate } from './packGate.js';
import { workspaceBalance } from './ledgerBalance.js';

/**
 * The ledger's slow jobs (a whole report takes many seconds on today's content, nearly all of it the
 * pace's level tracks), run in the ledger's Web Worker (`ledgerWorker.js`), or here directly where
 * there is no Worker.
 * - `snapshot` `{ workspace }`: the ledger's snapshot of a workspace (`ledgerCompare.js`)
 * - `gate` `{ workspace, pack }`: the agent gate (`packGate.js`), two reports
 * - `balance` `{ workspace }`: the balancing preview (`ledgerBalance.js`), a pace for every trial
 */
export function workspaceSnapshot(workspace) {
    return snapshotOf(workspaceReport(workspace));
}

export function runLedgerJobNow(type, payload) {
    if (type === 'snapshot') return workspaceSnapshot(payload.workspace);
    if (type === 'gate') return runGate(payload.workspace, payload.pack, workspaceSnapshot);
    if (type === 'balance') return workspaceBalance(payload.workspace);
    throw new Error('Unknown ledger job: ' + type);
}
