// statement upkeep

import { statementsOf } from '../effects/statements.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as Shrines from './Shrines.js';

/**
 * A statement can cost items to sustain, on its own clock: not folded into the Token's production
 * inputs or cycle time, so a Token with no production can still have upkeep.
 *
 * Unpaid means OFF, not degraded: when the Bank cannot pay, the statement stops applying and
 * resumes when stock returns, like a station with missing inputs. Deliberately not debt accrual,
 * Token destruction or a fraction paid.
 *
 * ⚠️ State is keyed by statement id, not by position. Timers are per Token copy and live on the
 * board instance, saved with it. Reordering a Token's rules in the CMS must not remap a live save's
 * upkeep onto the wrong rule. Numeric keys left over from the old positional shape are dropped on
 * first touch rather than remapped: the statements they pointed at no longer exist, and a wrong
 * guess would silently misprice an aura.
 */

/** Statements that cost something to sustain. */
function costedStatements(def) {
    return statementsOf(def).filter(s => s?.upkeep?.items?.length && s.upkeep.cadenceMs > 0);
}

/**
 * An upkeep's lines summed by item, in first-named order, so one item named on two lines is
 * checked against the Bank as their total rather than line by line.
 */
function costByItem(items) {
    const total = new Map();
    for (const it of items) total.set(it?.itemId, (total.get(it?.itemId) || 0) + (it?.quantity || 1));
    return [...total].map(([itemId, quantity]) => ({ itemId, quantity }));
}

/**
 * Per-statement upkeep state on an instance, created on first use: `{ [statementId]: { elapsedMs,
 * paid } }`. `paid` starts true so a statement works from the moment it is placed.
 */
function upkeepState(instance) {
    if (!instance.blockUpkeep) instance.blockUpkeep = {};
    // Drop retired positional keys. `0` is a legal array index and never a
    // legal statement id, so the test is exact rather than heuristic.
    for (const key of Object.keys(instance.blockUpkeep)) {
        if (/^\d+$/.test(key)) delete instance.blockUpkeep[key];
    }
    return instance.blockUpkeep;
}

/**
 * Whether a statement on this instance is currently paid up. A shrine that is out pays for none of
 * its rules: they are its blessing, kept by offerings rather than the Bank (`Shrines.js`), and every
 * rule reader asks here, so its blessing goes out everywhere at once.
 */
export function isStatementPaid(instance, statementId) {
    const state = instance?.blockUpkeep?.[statementId];
    if (state && state.paid === false) return false;
    return !Shrines.isOut(instance);
}

/**
 * The paid test for one Token copy's statements, as a predicate, or null when every rule is paid (a
 * copy never charged, and no shrine), so the common case builds nothing.
 */
export function paidTestFor(instance) {
    if (!instance?.blockUpkeep && !Shrines.isOut(instance)) return null;
    return (statement) => isStatementPaid(instance, statement?.id);
}

/**
 * Advance every costed statement's clock on one Token, charging when due.
 *
 * Returns true when any statement's paid/unpaid state CHANGED, so the caller can rebuild the tile's
 * modifiers: an aura switching off must actually stop applying.
 */
export function tickUpkeep(instance, def, delta) {
    const statements = costedStatements(def);
    if (!statements.length) return false;

    const state = upkeepState(instance);
    let changed = false;

    for (const statement of statements) {
        const key = statement.id;
        if (!key) continue;
        if (!state[key]) state[key] = { elapsedMs: 0, paid: true };
        const entry = state[key];

        entry.elapsedMs += delta;
        if (entry.elapsedMs < statement.upkeep.cadenceMs) continue;

        entry.elapsedMs -= statement.upkeep.cadenceMs;

        // Check the whole cost before spending any of it — the same pay-first,
        // all-or-nothing discipline production uses, so a statement can never
        // half-consume its upkeep and still lapse.
        const cost = costByItem(statement.upkeep.items);
        const affordable = cost.every(it => InventoryManager.getItemCount(it.itemId) >= it.quantity);

        if (affordable) {
            for (const it of cost) InventoryManager.removeItem(it.itemId, it.quantity);
        }

        if (entry.paid !== affordable) {
            entry.paid = affordable;
            changed = true;
        }
    }

    return changed;
}
