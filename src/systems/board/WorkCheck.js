// can this Token run for this hero?

import { ALERT } from './boardEvents.js';
import * as RecipeResolver from './RecipeResolver.js';
import { RECIPE } from './RecipeResolver.js';
import * as InputAllocator from './InputAllocator.js';
import * as Charges from './Charges.js';
import * as Respawn from './Respawn.js';
import * as Demolition from './Demolition.js';
import * as SkillSystem from '../hero/SkillSystem.js';

/**
 * One answer to why a Token can't run, shared by the board runner (while a hero works a Token) and
 * `Flags` (while a flag chooses which Token to work). The two must agree or heroes get sent to
 * Tokens that then sit stuck; `WorkCheck.test.js` pins it.
 *
 * ⚠️ Pure: it never publishes, never notes starvation, never charges. The runner keeps the side
 * effects (the alert mark, `TILE_EVENT_ALERT`, the starvation tally) because they describe a hero
 * actually standing there; a flag merely considering a Token must not raise them.
 */

/** Reasons a player can fix from the board: these keep a red badge. */
export const FIXABLE = new Set([ALERT.INPUTS, ALERT.CHARGES, ALERT.NO_RECIPE, ALERT.CHOOSE_BUILD, ALERT.CHOOSE_RECIPE]);

/**
 * Why `heroId` cannot work a Token with this `config`, or null if they can.
 *
 * Two gates, in order: possession, then level. Possession is checked even when the Token sets no
 * level requirement.
 *
 * A Token naming no `skill` needs nothing but a body here; whether such a Token is workable at all
 * is `Flags`' question.
 *
 * @returns {'access'|'unskilled'|null} an `ALERT` reason, or null
 */
export function heroReason(heroId, config) {
    if (!config?.skill) return null;
    if (!heroId) return ALERT.UNSKILLED;

    const failure = SkillSystem.requirementFailure(heroId, {
        skill: config.skill,
        level: config.skillRequired || 0
    });

    if (failure === 'POSSESSION') return ALERT.UNSKILLED;
    if (failure === 'LEVEL') return ALERT.ACCESS;
    return null;
}

/**
 * Why the Token itself cannot run a cycle right now — whoever works it — as
 * `{ reason, io, inputCheck? }`. `reason` is null when it can. Every reason but `resting` is
 * fixable.
 *
 * In the runner's order: the Token must not be resting, the recipe must resolve, then the inputs
 * must be available, then the charges must be affordable. `io` is returned so the runner does
 * not resolve the recipe twice (null for a resting Token, which resolves nothing).
 *
 * Resting comes first: a Token that ran out and is waiting to respawn cannot run whatever else
 * is true of it, and it is not a problem to fix, so it must not surface as one of the reasons
 * below (`ALERT.RESTING` is not in {@link FIXABLE}).
 *
 * ⚠️ Before even that, a Token marked for demolition always can: demolishing needs no recipe,
 * inputs or charges, and a resting Token can still be cleared away. `io` is null; the runner
 * advances a demolition on its own path and never reads it.
 */
export function fixableReason(instanceId, instance) {
    if (Demolition.isMarked(instance)) return { reason: null, io: null };
    if (Respawn.isResting(instance)) return { reason: ALERT.RESTING, io: null };

    const io = RecipeResolver.effectiveIO(instanceId, instance);

    if (io.status === RECIPE.NONE) {
        // A Foundation with nothing picked says so in its own words rather than as a missing Token.
        if (io.reason === 'choose_build') return { reason: ALERT.CHOOSE_BUILD, io };
        // A station with nothing picked likewise.
        if (io.reason === 'choose_recipe') return { reason: ALERT.CHOOSE_RECIPE, io };
        return { reason: ALERT.NO_RECIPE, io };
    }

    if (io.inputs?.length) {
        const inputCheck = InputAllocator.checkInputs(io.inputs);
        if (!inputCheck.ok) return { reason: ALERT.INPUTS, io, inputCheck };
    }

    if (!Charges.planCycle(instanceId, instance, io).ok) return { reason: ALERT.CHARGES, io };

    return { reason: null, io };
}

/**
 * The first reason `heroId` cannot run Token `instanceId` — the hero's gate
 * first, then the Token's — or null if they can. What a flag records as a skip.
 */
export function whyCannotRun(instanceId, instance, heroId, config) {
    const hero = heroReason(heroId, config);
    if (hero) return hero;
    return fixableReason(instanceId, instance).reason;
}
