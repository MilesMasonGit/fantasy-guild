import * as TileModifiers from './TileModifiers.js';
import * as InputAllocator from './InputAllocator.js';
import { workConfigOf } from './StationRecipe.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { roundByChance, mostByChance } from '../../utils/RNG.js';

/**
 * What a cycle's inputs cost once Efficiency (`INPUT_COST`) reaches its Token: each authored
 * quantity widened by the Token's neighbours, the guild's stars and its hero.
 *
 * A fractional cost is made whole by chance as the cycle pays (owner, 2026-11-11): 10 Coal at −12 %
 * is 8.8, so 9 Coal four times in five and 8 one time in five; an increase rounds the same way.
 * There is no minimum of 1: a 1-Coal input at −20 % takes nothing one time in five.
 *
 * A check before paying asks for the most a cycle can take (the cost rounded up), so the roll can
 * never make a cycle it let through unaffordable.
 *
 * ⚠️ The bench's work check pins the `Math.random` stream: a cost draws only when it has a
 * fraction, so content without Efficiency (every cost whole) draws nothing.
 */

/**
 * The exact cost of an input authored at `quantity` (missing: 1) at Token `instanceId`, for work of
 * `skill`: unrounded, never below 0. Draws nothing. What a cycle pays on average.
 */
export function exactInputQuantity(instanceId, quantity, skill) {
    return Math.max(0, TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.INPUT_COST, quantity || 1, skill));
}

/**
 * A cycle's inputs costed at Token `instanceId`: each with its exact cost (`exact`) and the most a
 * cycle can take of it (`quantity`, the exact cost rounded up), less any that cost nothing. What a
 * check before paying asks for (`InputAllocator.checkInputs`). Draws nothing.
 */
export function costedInputs(instanceId, inputs, skill) {
    const out = [];
    for (const input of inputs || []) {
        const exact = exactInputQuantity(instanceId, input?.quantity, skill);
        const most = mostByChance(exact);
        if (most > 0) out.push({ ...input, exact, quantity: most });
    }
    return out;
}

/**
 * Whether the Bank (and the floor) can pay the most a cycle of Token `instance` can take: the
 * check before a cycle starts and the work plate's "missing" list, asked as `completeCycle` asks
 * it. The skill is the Token's work skill (a Foundation's build skill). Draws nothing.
 * @returns {{ok: boolean, missing: Array<{itemId, needed, available}>}}
 */
export function checkCost(instance, inputs) {
    const skill = workConfigOf(getTokenType(instance?.typeId), instance)?.skill;
    return InputAllocator.checkInputs(costedInputs(instance?.id, inputs, skill));
}

/**
 * What a cycle pays for its costed inputs: each cost made whole by chance (one draw for a fraction,
 * none for a whole cost), in order, less any that come to nothing.
 */
export function rolledInputs(costed, random = Math.random) {
    const out = [];
    for (const { exact, ...input } of costed || []) {
        const quantity = roundByChance(exact, random);
        if (quantity > 0) out.push({ ...input, quantity });
    }
    return out;
}
