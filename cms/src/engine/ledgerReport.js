import { buildLedger, parseKey, HOW } from '../../../src/systems/atlas/ledgerEngine.js';

/**
 * The ledger's engines over the CMS workspace (`src/systems/atlas/ledgerEngine.js`): every entry's
 * reach and any item's tree. Planned stubs are in the workspace, so they come back marked Planned.
 *
 * Effort runs at the records' own cycle times, which every Recalculate writes from the simulator;
 * hand it a `recalculateEconomy` result as `sim` to use that run's times for anything edited since.
 * ⚠️ A workspace that never loaded a Starter Camp (`starterCamp: null`) has nothing placed at the
 * start, so almost everything reads "never" until Backups → Restore from Game brings the camp in.
 */

/** The work whose cycle the simulator times: a Token's own work, water, a recipe. */
const TIMED = new Set([HOW.WORK, HOW.CATCH, HOW.CRAFT]);

export function workspaceLedger(state = {}, { sim = null } = {}) {
    const cycleTimes = sim?.sim?.cycleTimes ?? sim?.cycleTimes ?? null;
    const cycleTimeOf = cycleTimes
        ? (rule) => (TIMED.has(rule.how) && rule.via ? cycleTimes.get(parseKey(rule.via).id) ?? null : null)
        : null;
    return buildLedger({
        items: state.items,
        tokens: state.tokens,
        recipePools: state.recipePools,
        effects: state.effects,
        starterCamp: state.starterCamp,
    }, { cycleTimeOf });
}
