/**
 * A fight object is mutated in place while combat runs, so the UI — which
 * compares by reference — cannot see that anything changed. Bumping this
 * counter gives it something that does change.
 *
 * Its only callers are `CombatProcessor` and `CombatResolutionProcessor`.
 */

/** Bump a fight's revision counter so ref-based UI reads see a change. */
export function bumpFightRev(fight) {
    if (fight) fight._rev = (fight._rev || 0) + 1;
}
