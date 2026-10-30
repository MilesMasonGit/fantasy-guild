// Fantasy Guild — enemy moves: the few attacks an enemy picks from at random, one each swing
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the Token
// editor's Moves block and the audits read the shapes from here. Keep it free of data loading.

import { isTypeOrGroupId, PLAIN_ENEMY_HIT_TYPE } from './damageTypes.js';

/**
 * An enemy may list a few moves (owner, brief 280: a chicken's Peck, Stab; Scratch, Slash; Flutter,
 * +50 % Physical resistance for one attack). Each swing makes one, picked at random by weight. An
 * enemy with none swings as it always has: a plain Physical hit.
 *
 * ```json
 * "moves": [
 *   { "name": "Peck", "damageType": "stab" },
 *   { "name": "Scratch", "damageType": "slash" },
 *   { "name": "Flutter", "hits": false, "effectId": "effect_flutter", "target": "self", "lasts": "attack" }
 * ]
 * ```
 *
 *   `name`        what the fight screen calls it.
 *   `hits`        false for a move that deals no damage and rolls nothing (Flutter); a hit otherwise.
 *   `damageType`  a hit's type or group (the enemy's hit, in this type); Physical when absent.
 *   `effectId`    a library effect the move lands, a status included.
 *   `target`      `self` (as the move is made) or `hero` (with the hit that lands, or as a move that
 *                 does not hit is made). The hero when absent.
 *   `lasts`       `attack` (until the next attack on its bearer is over, hit or miss), `swing` (this
 *                 swing; on itself only, a heavy strike), `fight`. The fight when absent. A status
 *                 keeps its own lifetime.
 *   `weight`      how likely, against the others' (1 when absent).
 */

export const MOVE_TARGETS = Object.freeze(['self', 'hero']);
export const MOVE_LASTS = Object.freeze(['attack', 'swing', 'fight']);

export const DEFAULT_MOVE_TARGET = 'hero';
export const DEFAULT_MOVE_LASTS = 'fight';
export const DEFAULT_MOVE_WEIGHT = 1;

/** The lifetimes worth offering for an effect on `target`: one landed on the hero "for the swing" is over before it can matter. */
export function moveLastsFor(target) {
    return target === 'self' ? MOVE_LASTS : MOVE_LASTS.filter(l => l !== 'swing');
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const hasText = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * One move as the engine reads it. A hit with an unknown type hits as Physical; an unknown target is
 * the hero, an unknown lifetime the fight, a weight that is not above 0 is 1. The audits name each.
 * @returns {{name: string, hits: boolean, type: string|null, effectId: string|null, target: string, lasts: string, weight: number}}
 */
export function normaliseMove(raw) {
    const hits = raw.hits !== false;
    const weight = Number(raw.weight);
    return {
        name: hasText(raw.name) ? raw.name.trim() : '',
        hits,
        type: hits ? (isTypeOrGroupId(raw.damageType) ? raw.damageType : PLAIN_ENEMY_HIT_TYPE) : null,
        effectId: hasText(raw.effectId) ? raw.effectId : null,
        target: MOVE_TARGETS.includes(raw.target) ? raw.target : DEFAULT_MOVE_TARGET,
        lasts: MOVE_LASTS.includes(raw.lasts) ? raw.lasts : DEFAULT_MOVE_LASTS,
        weight: Number.isFinite(weight) && weight > 0 ? weight : DEFAULT_MOVE_WEIGHT
    };
}

const NO_MOVES = Object.freeze([]);

/**
 * An enemy block's moves as the engine reads them, in authored order; anything not a move is dropped.
 * ⚠️ The profile is built every tick: an enemy without moves gets one shared empty list, no copy.
 */
export function enemyMovesOf(enemy) {
    const raw = enemy?.moves;
    return Array.isArray(raw) && raw.length ? raw.filter(isPlainObject).map(normaliseMove) : NO_MOVES;
}

/**
 * The move a swing makes: by weight among `moves`, null with none.
 *
 * ⚠️ One `Math.random()` only when there is a choice (two moves or more), none for one move or none
 * at all: an enemy without moves draws exactly what it drew before moves existed, and the bench's
 * identical-work gate and a catch-up's replay depend on that.
 */
export function pickMove(moves, random = Math.random) {
    if (!Array.isArray(moves) || moves.length === 0) return null;
    if (moves.length === 1) return moves[0];
    const total = moves.reduce((sum, m) => sum + m.weight, 0);
    let roll = random() * total;
    for (const move of moves) {
        roll -= move.weight;
        if (roll < 0) return move;
    }
    return moves[moves.length - 1];
}

/**
 * What is wrong with an enemy's authored moves, one sentence each, for the audits.
 * @param {*} raw `enemy.moves`
 * @param {{hasEffect?: (id: string) => boolean, isStatus?: (id: string) => boolean}} [library] what the
 *   effect library holds; without it, effects are not checked
 * @returns {string[]}
 */
export function moveProblems(raw, { hasEffect = null, isStatus = null } = {}) {
    if (raw == null) return [];
    if (!Array.isArray(raw)) return ['its moves are not a list — it swings a plain Physical hit. Author its moves again in the CMS'];
    const out = [];
    raw.forEach((move, i) => {
        if (!isPlainObject(move)) {
            out.push(`its move ${i + 1} is not a move — it is never made. Author it again in the CMS`);
            return;
        }
        const label = hasText(move.name) ? `"${move.name.trim()}"` : `${i + 1}`;
        if (!hasText(move.name)) out.push(`its move ${i + 1} has no name — the fight screen calls it "Attack". Name it in the CMS`);
        const hits = move.hits !== false;
        if (move.hits != null && typeof move.hits !== 'boolean') {
            out.push(`its move ${label} says it hits "${move.hits}", which is neither yes nor no — it hits. Tick or untick Hits in the CMS`);
        }
        if (hits && move.damageType != null && move.damageType !== '' && !isTypeOrGroupId(move.damageType)) {
            out.push(`its move ${label} hits with "${move.damageType}", which is not a damage type or group — it hits as Physical. Pick its type again in the CMS`);
        }
        const effectId = hasText(move.effectId) ? move.effectId : null;
        if (!hits && !effectId) out.push(`its move ${label} neither hits nor lands an effect — the swing does nothing. Tick Hits or pick an effect in the CMS`);
        if (effectId && hasEffect && !hasEffect(effectId)) {
            out.push(`its move ${label} lands the effect "${effectId}", which is not in the effect library — it lands nothing. Pick the effect again in the CMS`);
        }
        if (move.target != null && !MOVE_TARGETS.includes(move.target)) {
            out.push(`its move ${label} aims its effect at "${move.target}", which is neither itself nor the hero — it lands on the hero. Pick its target again in the CMS`);
        }
        if (move.lasts != null && !MOVE_LASTS.includes(move.lasts)) {
            out.push(`its move ${label} lasts "${move.lasts}", which is not one attack, the swing or the fight — it lasts the fight. Pick how long again in the CMS`);
        }
        const target = MOVE_TARGETS.includes(move.target) ? move.target : DEFAULT_MOVE_TARGET;
        if (effectId && target === 'hero' && move.lasts === 'swing' && !(isStatus && isStatus(effectId))) {
            out.push(`its move ${label} puts its effect on the hero for the swing, which is over before it can matter — it does nothing. Make it last one attack or the fight in the CMS`);
        }
        if (move.weight != null && move.weight !== '' && !(Number.isFinite(Number(move.weight)) && Number(move.weight) > 0)) {
            out.push(`its move ${label} has the weight "${move.weight}" — a weight is a number above 0, so it counts as 1. Type it again in the CMS`);
        }
    });
    return out;
}
