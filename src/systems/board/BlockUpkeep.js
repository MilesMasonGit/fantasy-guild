// Fantasy Guild — statement upkeep (CMS rework Phase 5; re-keyed Phase 1 of the
// effect authoring redesign)

import { statementsOf } from '../effects/statements.js';
import { InventoryManager } from '../inventory/InventoryManager.js';

/**
 * A statement can cost items to sustain, on **its own clock** (CMS-60).
 *
 * ## Why this is separate from production
 * An aura's upkeep — 1 Incense every 30s — is not folded into the Token's
 * production inputs and is not tied to its cycle time. A Token can therefore
 * produce on one rhythm and sustain an effect on an entirely different one, and
 * a Token with **no** production at all can still have upkeep.
 *
 * ## Unpaid means OFF, not degraded (CMS-97)
 * When the Bank cannot pay, the statement stops applying and resumes the moment
 * stock returns. This mirrors how a station with missing inputs behaves — it
 * waits, it does not run slower (D-127) — so "the thing it needs isn't there"
 * has one meaning across the whole board.
 *
 * Deliberately NOT: accruing debt (an effect that works while unpaid makes the
 * cost decorative), destroying the Token (depletion is the one wear mechanic,
 * and it is charges — D-118), or scaling to a fraction paid (partial effects
 * contradict D-127 and the modifier system has no shape for them).
 *
 * ## ⚠️ State is keyed by statement id, not by position
 * Timers are per Token **copy** — two Shrines burn their own incense — so they
 * live on the board instance and are saved with it. They used to be keyed by
 * `{0: …, 1: …}`, the index into the block array, which meant **reordering a
 * Token's rules in the CMS silently remapped a live save's upkeep onto the
 * wrong rule**. Statements are sentences and reordering them is the normal
 * thing to want, so the key is now the statement's own stable id.
 *
 * Numeric keys left over from the old shape are dropped on first touch rather
 * than remapped by position: the statements they pointed at no longer exist —
 * old-shape effect data is not migrated (see `ContentAudit`) — so a positional
 * guess would attach a real save's timer to a rule that was never the same one.
 * Losing a partial upkeep clock costs at most one cadence; guessing wrong is a
 * silently mispriced aura.
 */

/** Statements that cost something to sustain. */
function costedStatements(def) {
    return statementsOf(def).filter(s => s?.upkeep?.items?.length && s.upkeep.cadenceMs > 0);
}

/**
 * Per-statement upkeep state on an instance, created on first use.
 *
 * `{ [statementId]: { elapsedMs, paid } }` — `paid` starts true so a statement
 * works from the moment it is placed and only lapses if a later charge fails.
 * Placing a Token and having its aura be dead until the first tick would read
 * as broken.
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

/** Whether a statement on this instance is currently paid up. */
export function isStatementPaid(instance, statementId) {
    const state = instance?.blockUpkeep?.[statementId];
    return state ? state.paid !== false : true;
}

/**
 * Advance every costed statement's clock on one Token, charging when due.
 *
 * Returns true when any statement's paid/unpaid state CHANGED, so the caller
 * can rebuild the tile's modifiers — an aura switching off has to actually stop
 * applying, which means the aggregator must be rebuilt, not just flagged.
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
        const affordable = statement.upkeep.items.every(
            it => InventoryManager.getItemCount(it.itemId) >= (it.quantity || 1)
        );

        if (affordable) {
            for (const it of statement.upkeep.items) {
                InventoryManager.removeItem(it.itemId, it.quantity || 1);
            }
        }

        if (entry.paid !== affordable) {
            entry.paid = affordable;
            changed = true;
        }
    }

    return changed;
}

/** Whether any statement on this Token costs upkeep at all. */
export function hasUpkeep(def) {
    return costedStatements(def).length > 0;
}
