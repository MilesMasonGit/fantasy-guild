// Fortune, a shrine's blessing: every so many finished cycles, a Token's rarest drop for certain

import { chanceOf } from './CycleSavings.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { rareTableOf, rarestEntry } from '../../config/registries/rareTables.js';

/**
 * Fortune (owner 2026-11-25, the Shrine of Fortune): each finished work cycle of a Token it reaches
 * counts the rule's number, in percent, toward a sure find; the cycle that fills the count to 100
 * gives the Token's **rarest drop** for certain, and the count starts again with what was over
 * (25 is every fourth cycle). Blessings add up: two shrines of 25 count 50 a cycle. Lucky raises the
 * odds of a find; Fortune promises one.
 *
 * * **The rarest drop** ({@link rarestDropOf}) is the lowest-chance entry of the rare table the cycle
 *   rolls (a theft's, its camp's steal table's), or with no rare table the lowest-chance item line
 *   under 100 % among the cycle's outputs. A Token whose every line drops for certain, and no table,
 *   has none: Fortune counts nothing there and the count does not move.
 * * **Counted**: a work cycle that did not fail and is no build (`BoardRunner.completeCycle`). An Echo
 *   is no cycle of its own and counts nothing; a kill never counts.
 * * **The sure cycle** lands its rarest drop without rolling for it: the table is not rolled (its
 *   chance and its pick are not drawn), or the line's chance is not drawn. Everything else of the
 *   cycle rolls as ever.
 *
 * Saved on the Token as `fortune` (the count, 0 to under 100); absent is 0.
 *
 * ⚠️ The bench's work check pins the `Math.random` stream. Counting draws nothing, and a Token with no
 * Fortune reaching it, or no rarest drop, never reads the axis; only the sure cycle draws less.
 */

/** The count a sure find takes. */
export const FULL = 100;

const EPSILON = 1e-9;

/**
 * A cycle's rarest drop: `{ entry }`, the lowest-chance entry of `block`'s rare table, or `{ line }`,
 * the lowest-chance item line under 100 % among `outputs` (the first of equals), or null with neither.
 * A line at 0 % never drops and is no drop. Pure.
 * @param {object} block what the cycle's rare table is read off: the Token's type, or a steal table
 * @param {Array<object>} outputs the cycle's own lines
 */
export function rarestDropOf(block, outputs) {
    const table = rareTableOf(block);
    if (table) return { entry: rarestEntry(table) };
    let best = null;
    for (const line of outputs || []) {
        if (!line?.itemId) continue;
        const chance = line.chance ?? 100;
        if (!(chance > 0) || !(chance < 100)) continue;
        if (!best || chance < (best.chance ?? 100)) best = line;
    }
    return best ? { line: best } : null;
}

/** Token `instance`'s count toward its sure find, 0 to under {@link FULL}. */
export function countOf(instance) {
    const n = Number(instance?.fortune);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * A finished cycle of `skill` at Token `instance`, whose rarest drop is `rarest`: count its Fortune
 * (every scope, resolved at the Token), and answer `rarest` when this cycle fills the count, else
 * null. No rarest drop, or no Fortune reaching it: nothing is read or counted. Draws nothing.
 */
export function countCycle(instance, skill, rarest) {
    if (!rarest || !instance) return null;
    const points = chanceOf(instance.id, EFFECT_TYPES.FORTUNE, skill);
    if (!(points > 0)) return null;
    const count = countOf(instance) + points;
    if (count < FULL - EPSILON) {
        instance.fortune = count;
        return null;
    }
    // What was over carries on, held under a whole find: at 100 or more a cycle, every cycle is one.
    const over = Math.min(FULL - EPSILON, count - FULL);
    if (over > EPSILON) instance.fortune = over;
    else delete instance.fortune;
    return rarest;
}
