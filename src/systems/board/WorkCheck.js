// Fantasy Guild — "Can this Token run for this hero?" (Free Playmat slice 1.4b)

import { ALERT } from './boardEvents.js';
import * as RecipeResolver from './RecipeResolver.js';
import { RECIPE } from './RecipeResolver.js';
import * as InputAllocator from './InputAllocator.js';
import * as Charges from './Charges.js';
import * as SkillSystem from '../hero/SkillSystem.js';

/**
 * ⭐ **One answer to "why can't this Token run?", shared by the two things that
 * ask it** — the board runner, while a hero works a Token, and `Flags`, while a
 * flag chooses which Token to work.
 *
 * They used to be one inline block in `BoardRunner.tick`. A flag that skipped a
 * Token for a reason the runner would not have raised (or the reverse) would
 * send heroes to Tokens that then sit stuck, or past Tokens that would have run
 * — so the check was lifted here rather than copied. `WorkCheck.test.js` pins
 * that both callers agree.
 *
 * ⚠️ **Pure: it never publishes, never notes starvation, never charges.** The
 * runner keeps the side effects (the alert mark, `TILE_EVENT_ALERT`, the risk-13
 * starvation tally) because they describe a hero actually standing there; a flag
 * merely *considering* a Token must not raise them.
 */

/** Reasons a player can fix from the board (FP-69): these keep a red badge. */
export const FIXABLE = new Set([ALERT.INPUTS, ALERT.CHARGES, ALERT.NO_RECIPE]);

/**
 * Why `heroId` cannot work a Token with this `config` — or null if they can.
 *
 * **Two gates, in order: possession, then level.** Possession is checked even
 * when the Token sets no level requirement; the old version returned early on
 * `skillRequired <= 0` and let a hero who did not hold the skill work anyway.
 *
 * A Token naming no `skill` needs nothing but a body *here* — whether such a
 * Token is workable at all is `Flags`' question (FP-47), not this one's.
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
 * `{ reason, io, inputCheck? }`. `reason` is null when it can.
 *
 * In the runner's order: the recipe must resolve, then the inputs must be
 * available, then the charges must be affordable. `io` is returned so the
 * runner does not resolve the recipe twice.
 */
export function fixableReason(tile, instance) {
    const io = RecipeResolver.effectiveIO(tile, instance);

    if (io.status === RECIPE.NONE) return { reason: ALERT.NO_RECIPE, io };

    if (io.inputs?.length) {
        const inputCheck = InputAllocator.checkInputs(io.inputs);
        if (!inputCheck.ok) return { reason: ALERT.INPUTS, io, inputCheck };
    }

    if (!Charges.planCycle(tile, instance, io).ok) return { reason: ALERT.CHARGES, io };

    return { reason: null, io };
}

/**
 * The first reason `heroId` cannot run the Token on `tile` — the hero's gate
 * first, then the Token's — or null if they can. What a flag records as a skip.
 */
export function whyCannotRun(tile, instance, heroId, config) {
    const hero = heroReason(heroId, config);
    if (hero) return hero;
    return fixableReason(tile, instance).reason;
}
