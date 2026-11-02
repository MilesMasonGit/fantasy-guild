import { workspaceReport } from './ledgerReport.js';
import { snapshotOf } from './ledgerCompare.js';
import { runGate } from './packGate.js';
import { workspaceBalance } from './ledgerBalance.js';

/**
 * The ledger's slow jobs (the whole report takes about a third of a second on today's content),
 * run in the ledger's Web Worker (`ledgerWorker.js`), or here directly where there is no Worker.
 * - `snapshot` `{ workspace }`: the ledger's snapshot of a workspace (`ledgerCompare.js`)
 * - `gate` `{ workspace, pack }`: the agent gate (`packGate.js`)
 * - `balance` `{ workspace }`: the balancing preview (`ledgerBalance.js`), several seconds
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
