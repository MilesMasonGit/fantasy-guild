import { isPlanned, PLAN_STATUS } from '../../../src/systems/progression/ledger/plan.js';
import { ledgerRows } from './ledgerRows.js';

/**
 * The workspace with its Planned entries read as Live, for `ledger --with-planned`: every engine
 * then times them like any other work. A copy: the workspace handed in is left as it was, and only
 * the records that were Planned are new objects. `keys` holds their ledger keys, so the read-out can
 * keep marking them Planned.
 * ⚠️ For the read-out only: nothing built from this copy may be saved or synced.
 */
export function liftPlanned(state = {}) {
    const keys = new Set(ledgerRows(state).filter((r) => r.status === PLAN_STATUS.PLANNED).map((r) => r.ledgerKey));
    const live = (def) => (def && typeof def === 'object' && isPlanned(def) ? { ...def, plan: { ...def.plan, status: PLAN_STATUS.LIVE } } : def);
    const mapValues = (obj) => (obj && typeof obj === 'object' ? Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, live(v)])) : obj);
    const recipePools = state.recipePools && typeof state.recipePools === 'object'
        ? Object.fromEntries(Object.entries(state.recipePools).map(([skill, pool]) => [skill, Array.isArray(pool) ? pool.map(live) : pool]))
        : state.recipePools;
    return { state: { ...state, items: mapValues(state.items), tokens: mapValues(state.tokens), recipePools }, keys };
}
