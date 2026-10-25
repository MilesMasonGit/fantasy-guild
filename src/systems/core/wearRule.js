// Stations and supports never wear out.

import { KEYWORD, statementsOf, stationSkillOf, getProvidedTagsWithTiers } from '../effects/statements.js';
import { REACH, reachOf } from '../../config/registries/reachRegistry.js';

/**
 * The one rule behind "this Token never wears out", shared by the engine (`tokenStartingUses`,
 * `Charges.isUnlimited`, `RecipeResolver.wearNearbySupport`), the content audit
 * (`lifecycleAudit`) and the CMS Token editor, so all of them name the same Tokens.
 *
 * Owner rulings (2026-10-24): stations never wear out, like gear; supports never wear out either:
 * build once, help forever. So a Token of either kind is unlimited whatever charges its type
 * authors or a saved copy holds.
 *
 * ## Who never wears
 * * **A station**: a Token with a `Works as` rule (Grandma's Kitchen, the Furnace).
 * * **A support**: a Token whose rules help the Tokens near it by standing there: an `Acts as`
 *   capability (the Copper Anvil), or a standing `Provides` or `Grants` that reaches past itself
 *   (the Windmill's double loot to Fields, a Forest's faster regrowth, a Minecart's faster veins).
 *
 * ## Who still wears
 * * **A gathering node**, aura or not: a Token whose own work cycle makes something from nothing
 *   (a vein, a tree, a bush). Its charges are what is gathered, not wear (the Blackberry Bush's
 *   bonus drops to its neighbours do not make its berries endless).
 * * **An enemy**: its charges are the kills that clear it.
 * * A Token whose rules reach only itself, or fire on a moment (a triggered rule's charge cost is
 *   an authored price, not wear), and everything else with no help rule.
 *
 * ⚠️ The definition must be **expanded** (its effect references resolved into statements): a
 * station's `Works as` and a support's rules live in the effect library. The game's registry stores
 * Tokens expanded; the CMS stores references, so CMS callers expand first.
 *
 * ⚠️ Kept free of the Token registry (and of `enemyProfile`, which reads it): the registry's
 * `tokenStartingUses` reads this rule.
 */

/** Why a Token never wears out. */
export const NEVER_WEARS = Object.freeze({ STATION: 'station', SUPPORT: 'support' });

/** Whether a Token's own work cycle makes something from nothing: what it holds is gathered. */
function isGatheringNode(def) {
    const config = def?.config;
    if (!config || typeof config !== 'object') return false;
    const outputs = Array.isArray(config.outputs) ? config.outputs : [];
    const inputs = Array.isArray(config.inputs) ? config.inputs : [];
    return outputs.length > 0 && inputs.length === 0;
}

/** A standing `Provides` or `Grants` that reaches a Token other than its own. */
function helpsByStanding(statement) {
    if (!statement || statement.when?.event) return false;
    if (statement.keyword !== KEYWORD.PROVIDES && statement.keyword !== KEYWORD.GRANTS) return false;
    return reachOf(statement) !== REACH.SELF;
}

/**
 * Why a Token type never wears out (`NEVER_WEARS.STATION` or `.SUPPORT`), or null when its charges
 * count.
 *
 * @param {object} def a Token definition, expanded
 * @returns {string|null}
 */
export function neverWearsReason(def) {
    if (!def || typeof def !== 'object') return null;
    // Mirrors `enemyProfile.isEnemyDef`, read here directly (see the note above).
    if (def.enemy?.level != null) return null;
    if (stationSkillOf(def)) return NEVER_WEARS.STATION;
    if (isGatheringNode(def)) return null;
    if (Object.keys(getProvidedTagsWithTiers(def)).length > 0) return NEVER_WEARS.SUPPORT;
    if (statementsOf(def).some(helpsByStanding)) return NEVER_WEARS.SUPPORT;
    return null;
}

/** Whether a Token type never wears out, its authored charges ignored. */
export function neverWearsOut(def) {
    return neverWearsReason(def) != null;
}

/** What the CMS and the audit say about one, by reason. */
export const NEVER_WEARS_WHY = Object.freeze({
    [NEVER_WEARS.STATION]: 'It works as a station, and stations never wear out.',
    [NEVER_WEARS.SUPPORT]: 'It helps the Tokens near it, and supports never wear out.'
});
