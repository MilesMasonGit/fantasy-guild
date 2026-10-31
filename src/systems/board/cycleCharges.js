// what one cycle costs a Token in charges, from its definition alone

import { DEFAULT_STATEMENT_CHARGE_DELTA, statementsOf } from '../effects/statements.js';
import { CHARGE_MOMENT, chargeDeltaOf } from '../../config/registries/chargeMomentRegistry.js';

/** Pure: the charges engine (`Charges.js`) and the progression ledger's rate calculator share it. */

/** What a station spends per cycle when its recipe does not say. */
export const DEFAULT_STATION_CHARGE_COST = 1;

/**
 * The charge delta a statement applies at its moment.
 *
 * ⚠️ An absent `chargeDelta` does not mean one thing: it means -1 for a rule that fires and 0 for a
 * rule that does not, because those are what the two kinds of rule have always cost (see
 * `DEFAULT_CHARGE_DELTA_BY_MOMENT`). A single default in either direction would silently re-cost
 * authored content.
 *
 * An authored number always wins, `0` included.
 */
export function statementChargeDelta(statement) {
    // One reading, shared with the CMS cost strip: see `chargeDeltaOf`.
    return chargeDeltaOf(statement, DEFAULT_STATEMENT_CHARGE_DELTA);
}

/**
 * What this Token's own rules cost it per completed cycle.
 *
 * Only rules that name the per-cycle moment, and only ever a cost: a positive delta is a restore,
 * and a rule that hands its Token charges back every cycle is a perpetual-motion machine rather
 * than an effect. Restores stay on a firing, where something had to happen first.
 *
 * @returns {number} charges per cycle, 0 or more
 */
export function statementCycleCost(def) {
    let cost = 0;
    for (const statement of statementsOf(def)) {
        // ⚠️ The moment must be AUTHORED, not inferred, to cost anything. An ambient `Grants` (no
        // `When` clause) can carry a dormant `chargeDelta: -1` that nothing ever spends, because
        // the only reader of that number is `TriggerSystem.fireStatement`. Inferring per-cycle from
        // the absence of a `When` clause would turn that dormant -1 into a live cost. So a
        // per-cycle cost is opt-in: the author picks the moment, the editor writes `chargeWhen`
        // beside the number, and content that predates the field costs nothing.
        if (statement?.chargeWhen !== CHARGE_MOMENT.PER_CYCLE) continue;
        const delta = statementChargeDelta(statement);
        if (delta < 0) cost += -delta;
    }
    return cost;
}

/**
 * A Token's own charge spend per cycle: what its recipe costs to run (`stationChargeCost`, or
 * {@link DEFAULT_STATION_CHARGE_COST}) plus what its own rules charge it for being on. A Token whose
 * charges are unlimited pays none of it (`Charges.isUnlimited`).
 */
export function ownCycleCost(def, recipe = null) {
    return (recipe?.stationChargeCost ?? DEFAULT_STATION_CHARGE_COST) + statementCycleCost(def);
}
