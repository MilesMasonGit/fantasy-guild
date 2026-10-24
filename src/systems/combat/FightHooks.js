// the fight moments' doorway out of the combat engine

/**
 * The combat engine says when a fighter swings, lands a hit or loses health; the board runs the
 * rules waiting on that moment (`board/FightMoments.js`).
 *
 * ⚠️ Injected, not imported: the board's runner reaches the verbs, which reach `BoardCombat`, which
 * imports this engine, so an import would be a cycle. Until the board wires it nothing runs, and a
 * fight is plain swings.
 */

/** Which side of a fight a moment belongs to. */
export const SIDE = Object.freeze({ HERO: 'hero', ENEMY: 'enemy' });

let runner = null;

/** Wired once by the board (`FightMoments.init`). */
export function setFightMomentRunner(fn) {
    runner = typeof fn === 'function' ? fn : null;
}

/**
 * A fight moment happened to `side` of `fight`.
 * @param {object} fight the live fight
 * @param {'hero'|'enemy'} side
 * @param {string} momentId a `FIGHT_MOMENT` id
 * @param {number} [count] the swing or hit's number in this fight, for "every Nth"
 */
export function fightMoment(fight, side, momentId, count = 0) {
    if (runner) runner(fight, side, momentId, count);
}

/**
 * A fight's per-engagement tallies: swings and hits by side, the health each side was last seen
 * at, and which "On Health Below" rules have fired. Started fresh with every enemy engaged.
 */
export function talliesOf(fight) {
    const combat = fight.combat;
    if (!combat.moments) {
        combat.moments = {
            swings: { hero: 0, enemy: 0 },
            hits: { hero: 0, enemy: 0 },
            seenHp: { hero: null, enemy: null },
            healthFired: {}
        };
    }
    return combat.moments;
}

/** Forget the tallies: the next enemy is a new fight. */
export function resetTallies(fight) {
    if (fight?.combat) fight.combat.moments = null;
}
