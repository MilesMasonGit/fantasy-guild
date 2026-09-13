// Fantasy Guild — when a statement spends its charges (Unified Effects P2)

/**
 * The moments at which a rule may spend the charges of the Token carrying it.
 *
 * ## Why this is a registry and not two branches in an `if`
 * Same reason as `TRIGGER_EVENTS`: adding a row here makes the moment available
 * in the CMS with **no CMS change**, and the game consumes the same list. The
 * editor renders whatever is declared.
 *
 * ## ⚠️ Only moments that something actually spends on (owner ruling, Q5)
 * Two moments exist today because two readers exist today.
 *
 * ⚠️ **P5 added `CYCLE_START` and deliberately did NOT add a row here**, which
 * is worth saying because the plan expected one. `CYCLE_START` turned out to be
 * a *firing* moment rather than a spending one: a rule that reacts to it carries
 * a `When` clause, so it already spends through `on_fire` when it fires. A row
 * reading "at the start of the cycle" would sit beside `per_cycle` as a second
 * way to spend once per cycle — exactly the two-ways-to-say-one-thing this
 * registry exists to prevent. P6's engagement deserves the same look before it
 * assumes it needs a row.
 *
 * They are deliberately **not** listed in advance. An authorable option that
 * nothing reads is the "authored but inert" failure the effect system map named
 * as this project's most expensive recurring bug — the author writes a rule, the
 * CMS accepts it, the game stores it, and nothing ever asks for it. A row
 * arrives with its reader or not at all.
 *
 * ## Zero is the always-on setting (UE-20)
 * A rule that costs nothing wears nothing, whatever moment it names. That is how
 * a permanent aura is authored, and it is the default for every rule that does
 * not fire — see `DEFAULT_CHARGE_DELTA_BY_MOMENT` below.
 */

export const CHARGE_MOMENT = Object.freeze({
    ON_FIRE: 'on_fire',
    PER_CYCLE: 'per_cycle'
});

/**
 * @type {Array<{id: string, label: string, requiresTrigger: boolean, hint: string}>}
 */
export const CHARGE_MOMENTS = Object.freeze([
    {
        id: CHARGE_MOMENT.ON_FIRE,
        label: 'Each time it fires',
        // How the Rules Line's cost strip says it, mid-phrase: "spends 1 charge each time it fires".
        phrase: 'each time it fires',
        requiresTrigger: true,
        hint: 'Spent when the rule’s When clause fires. A rule that cannot afford its own cost does not fire at all — it never fires on credit.'
    },
    {
        /**
         * ⚠️ Requires the Token to **have** a cycle.
         *
         * The spend happens inside `Charges.planCycle`, which only runs for a
         * Token that completes a work cycle. A pure buff Token has no cycles, so
         * a per-cycle cost on one is never charged — the hint says so, because
         * silently free is exactly the kind of quiet the audit exists to break.
         */
        id: CHARGE_MOMENT.PER_CYCLE,
        label: 'Every cycle of this Token',
        phrase: 'every cycle of this Token',
        requiresTrigger: false,
        hint: 'Spent alongside the Token’s own work cost, each cycle it completes. A Token with no work cycle never completes one, so a cost here is never charged.'
    }
]);

/** One moment's declaration, or null. */
export function getChargeMoment(id) {
    return CHARGE_MOMENTS.find(m => m.id === id) || null;
}

/** The moments a statement may legally use, given whether it carries a trigger. */
export function chargeMomentsFor(hasTrigger) {
    return CHARGE_MOMENTS.filter(m => (hasTrigger ? true : !m.requiresTrigger));
}

/**
 * ## ⚠️ The default cost depends on the moment, and that is load-bearing
 *
 * Every statement authored before P2 carries no `chargeWhen` and most carry no
 * `chargeDelta` either. Giving both a single default would change what shipped
 * content does:
 *
 * * A **firing** rule has always spent 1 when its `chargeDelta` was absent
 *   ("charge burns on service", CMS-26). Defaulting `on_fire` to anything else
 *   would silently make every triggered Token in the game free to run.
 * * A **per-cycle** rule has never spent anything, because the moment did not
 *   exist. Defaulting it to −1 would silently start wearing down every Token
 *   carrying an aura — content the owner authored on the understanding that an
 *   aura is free.
 *
 * So the default is per moment: firing costs one, everything else costs nothing.
 * An author who wants otherwise writes a number, and an explicit `0` remains
 * distinguishable from a blank exactly as it was.
 */
export const DEFAULT_CHARGE_DELTA_BY_MOMENT = Object.freeze({
    [CHARGE_MOMENT.ON_FIRE]: -1,
    [CHARGE_MOMENT.PER_CYCLE]: 0
});

/**
 * The moment a statement spends at.
 *
 * Derived from the statement's own shape when unauthored: a rule with a `When`
 * clause fires, and a rule without one does not. That inference is what lets
 * every statement written before this phase keep behaving exactly as it did.
 */
export function chargeMomentOf(statement) {
    const authored = statement?.chargeWhen;
    if (getChargeMoment(authored)) return authored;
    return statement?.when ? CHARGE_MOMENT.ON_FIRE : CHARGE_MOMENT.PER_CYCLE;
}
