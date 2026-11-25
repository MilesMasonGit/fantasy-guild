// context crafting

import { neighbourIds } from './nearby.js';
import { getTokenType, hasAdjacencyEffect, getProvidedTagsWithTiers } from '../../config/registries/tokenRegistry.js';
import { recipesForToken, contextTagsOf, contextRequirementsOf } from '../../config/registries/recipePoolRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import * as InputCost from './InputCost.js';
import * as StationRecipe from './StationRecipe.js';
import * as Fields from './Fields.js';
import * as BoardState from './BoardState.js';
import * as Hideouts from './Hideouts.js';
import * as Laboratories from './Laboratories.js';
import { paidTestFor } from './BlockUpkeep.js';

/**
 * The player chooses what a station makes; adjacency decides whether it can.
 *
 * A station carries `selectedRecipeId`, which the player sets (`StationRecipe.js` owns that field).
 * A new station has none and waits, saying Choose a recipe. This module validates that selection
 * rather than discovering one: are its context requirements met? (Items are `InputAllocator`'s
 * answer and charges are `Charges`'; `BoardRunner` asks all three in turn.) A context Token is a
 * plain recipe input, and an unmet one is a missing input like any other.
 *
 * A context Token with nothing relevant nearby is inert: it costs a tile and does nothing until
 * something it can use arrives. A context Token serves EVERY nearby station: one rack between two
 * Forges serves both, and it never wears for it: help is free (owner, 2026-10-24; `wearRule.js`).
 * Numerical buffs remain a light layer on top, deliberately small.
 *
 * Beside means Near. Every nearby question here (the context around a station and which stations
 * a context Token serves) is
 * `nearby.neighbourIds()`: Tokens whose centres are within the standard reach, named by instance id.
 * Acts as and recipe context carry no reach field of their own; they are Near. The neighbour ids
 * are cached per instance in `nearby.js`; the tag maps built from them are not.
 */

/** Resolution outcomes for a station. */
export const RECIPE = {
    /** The selected recipe's context requirements are met — this is what it makes. */
    OK: 'ok',
    /** It cannot run its selection right now, or it has no pool to select from. */
    NONE: 'none'
};

/**
 * Context tags and highest provided tiers supplied by the Tokens near a Token. Presence only,
 * highest tier per tag wins. Each Token is named once, by instance id.
 */
export function contextTiersAround(instanceId) {
    const tiers = {};

    for (const id of neighbourIds(instanceId)) {
        const instance = BoardState.getTokenById(id);
        if (!instance) continue;
        for (const [tag, tier] of Object.entries(providedBy(instance))) {
            tiers[tag] = Math.max(tiers[tag] || 0, tier);
        }
    }
    return tiers;
}

/**
 * The context tags and tiers one Token on the mat hands its neighbours now, `{ [tag]: tier }`.
 * An `Acts as` whose upkeep is unpaid is off until stock returns, as an aura is.
 */
export function providedBy(instance) {
    const def = getTokenType(instance?.typeId);
    if (!def) return {};
    return getProvidedTagsWithTiers(def, paidTestFor(instance));
}

/**
 * Which context tags a recipe still wants, at the tier it wants them.
 *
 * ⚠️ EVERY requirement must be met, not any: this is what lets a recipe be gated on a COMBINATION
 * of context, e.g. a Pie Tin and a Berry Cookbook together being what a Kitchen needs to bake a
 * pie.
 *
 * Tier is compared rather than mere presence, so a Tier 2 Anvil satisfies a requirement for Tier 1
 * and a Tier 1 does not satisfy Tier 2.
 */
export function unmetContext(instanceId, recipe) {
    const required = contextRequirementsOf(recipe);
    if (!required.length) return [];
    const tiers = contextTiersAround(instanceId);
    return required.filter(req => (tiers[req.tag] || 0) < req.minTier);
}

/**
 * Whether a station can run the recipe it is set to.
 *
 * Validation, not discovery: the recipe is whatever `selectedRecipeId` says (nothing is picked for
 * the player); this only answers whether the board around it currently satisfies it.
 *
 * A Token with no recipes at all is not a station (a Forest makes Wood regardless of its
 * neighbours), so it resolves `OK` with a null recipe and its own authored outputs stand.
 *
 * The pool is the station's declared skill: `recipesForToken` returns every recipe of the skill
 * named in the Token's `Works as` statement. A Token without that statement gets an empty list, the
 * not-a-station case above.
 *
 * The selected recipe is returned even when it cannot run, so callers can say what is missing
 * rather than only that something is.
 *
 * @returns {{status: string, recipe: object|null, reason?: string, missingContext?: object[]}}
 */
export function resolveRecipe(instanceId, instance) {
    const def = getTokenType(instance?.typeId);

    // A Hideout runs no recipe: it robs the camp its player chose, while it may (`Hideouts.js`).
    if (Hideouts.isHideout(def)) {
        const theft = Hideouts.theftOf(instance);
        return theft.ok ? { status: RECIPE.OK, recipe: null } : { status: RECIPE.NONE, recipe: null, reason: theft.reason };
    }
    // A Laboratory runs no recipe: it studies the node its player chose, while it can (`Laboratories.js`).
    if (Laboratories.isLaboratory(def)) {
        const study = Laboratories.studyOf(instance);
        return study.ok ? { status: RECIPE.OK, recipe: null } : { status: RECIPE.NONE, recipe: null, reason: study.reason };
    }

    const recipes = recipesForToken(def);

    // Not a station: its config's own inputs/outputs apply.
    if (!recipes.length) return { status: RECIPE.OK, recipe: null };

    // Nothing is ever picked for the player: until they choose, a station has nothing to run. A
    // selection no longer in the pool reads the same way (and is kept). A Field works the
    // crop in its ground, which a change of pick does not dig up (`Fields.js`).
    const recipe = Fields.isField(def)
        ? (Fields.plantedCrop(instance, def) || StationRecipe.validateSelection(instance, def))
        : StationRecipe.validateSelection(instance, def);
    if (!recipe) {
        return { status: RECIPE.NONE, recipe: null, reason: def?.foundation ? 'choose_build' : 'choose_recipe' };
    }

    const missing = unmetContext(instanceId, recipe);
    if (missing.length) {
        return { status: RECIPE.NONE, recipe, reason: 'missing_context', missingContext: missing };
    }

    return { status: RECIPE.OK, recipe };
}

/**
 * What a Token is actually running with right now: inputs, outputs, and how long the cycle takes.
 * Collapses authored on the Token and decided by nearby context into one answer, so callers never
 * have to know which kind of Token they hold.
 *
 * Cycle time and XP come from the recipe when it defines them (its own `durationMs`); a Token
 * running no recipe falls back to the flat `config.cycleTimeMs` on its own definition. The returned
 * key stays `cycleTimeMs` because `BoardRunner` and `TileProgressBar` read it by that name for both
 * kinds of Token.
 */
export function effectiveIO(instanceId, instance) {
    const def = getTokenType(instance?.typeId);
    const { status, recipe, reason } = resolveRecipe(instanceId, instance);

    if (status !== RECIPE.OK) return { status, reason, inputs: [], outputs: [] };

    // A Hideout's cycle is a theft: its camp's steal table in place of outputs, and the table's XP
    // where it writes one (a camp worth more to rob teaches more). `steal` tells the runner to roll
    // the caught odds and the table's own rare finds.
    if (Hideouts.isHideout(def)) {
        const { camp, robbed } = Hideouts.theftOf(instance);
        return {
            status,
            recipe: null,
            inputs: [],
            outputs: robbed.steal.outputs,
            cycleTimeMs: def?.config?.cycleTimeMs,
            xp: robbed.steal.xp ?? def?.config?.xp,
            steal: { campId: camp.id, campTypeId: camp.typeId, enemyTypeId: robbed.typeId, table: robbed.steal }
        };
    }

    // A Laboratory's cycle is a study: no outputs, and what a gathering cycle at its node would take
    // (a ripe Field's seed still owed). `study` tells the runner which node to wear and which kind learns.
    if (Laboratories.isLaboratory(def)) {
        const { node, kind } = Laboratories.studyOf(instance);
        return {
            status,
            recipe: null,
            inputs: Laboratories.studyInputsOf(node),
            outputs: [],
            cycleTimeMs: def?.config?.cycleTimeMs,
            xp: def?.config?.xp,
            study: { nodeId: node.id, kind }
        };
    }

    return {
        status,
        recipe,
        // A crop's inputs are its seed, paid once per sowing by its first harvest (`Fields.js`).
        inputs: Fields.isField(def) ? Fields.seedOwedOf(instance, def) : (recipe?.inputs ?? def?.config?.inputs ?? []),
        outputs: recipe?.outputs ?? def?.config?.outputs ?? [],
        cycleTimeMs: recipe?.durationMs ?? def?.config?.cycleTimeMs,
        xp: recipe?.xp ?? def?.config?.xp
    };
}

/**
 * Every nearby Token (by instance id, arrival order) that this context or buff Token serves: a
 * station whose active recipe it supplies, or anything that runs beside a buff.
 * Serving costs it nothing (help is free).
 */
export function servesFrom(contextId) {
    const instance = BoardState.getTokenById(contextId);
    const def = getTokenType(instance?.typeId);
    const providedTags = Object.keys(getProvidedTagsWithTiers(def, paidTestFor(instance)));
    const isBuff = hasAdjacencyEffect(def);
    if (!providedTags.length && !isBuff) return [];

    const served = [];

    for (const id of neighbourIds(contextId)) {
        const nInstance = BoardState.getTokenById(id);
        if (!nInstance) continue;

        // A buff Token serves anything that runs beside it. A context Token
        // serves only stations whose active recipe it actually contributes to.
        if (isBuff) {
            if (runsBeside(nInstance)) served.push(id);
            continue;
        }
        if (servesStation(providedTags, nInstance)) served.push(id);
    }
    return served;
}

/**
 * Whether a Token on the mat runs: a work cycle OR a fight. One kill is one cycle, so a Weapon Rack
 * beside an enemy Token must wear exactly as a Tool Rack beside a Forge does. Checking only for
 * `config` would exempt combat from the economy, because enemy Tokens carry an `enemyId` instead.
 */
function runsBeside(instance) {
    const def = getTokenType(instance?.typeId);
    return !!def?.config || def?.tokenType === 'enemy';
}

/**
 * Whether a Token handing out the context tags `providedTags` serves the station `instance` when it
 * stands beside it: the station runs and its chosen recipe wants one of those tags.
 */
export function servesStation(providedTags, instance) {
    if (!providedTags?.length || !runsBeside(instance)) return false;
    const { recipe } = resolveRecipe(instance.id, instance);
    return !!recipe && contextTagsOf(recipe).some(tag => providedTags.includes(tag));
}

/**
 * Returns missing requirements for a Token with strict priority:
 * 1. Tokens priority: the selected recipe's context Tokens are missing.
 * 2. Items priority: Only once all token requirements are satisfied and recipe is resolved.
 *
 * @returns {{ type: 'tokens'|'items'|null, items: string[] }}
 */
export function getMissingRequirements(instanceId, instance) {
    if (!instance?.typeId) return { type: null, items: [] };
    const def = getTokenType(instance.typeId);
    if (!def) return { type: null, items: [] };

    // 1. Check the context the SELECTED recipe asks for. Only that one recipe's requirements are
    // listed: the station has already chosen, and listing the rest would tell the player to fetch
    // Tokens for work they did not ask for.
    const { recipe } = resolveRecipe(instanceId, instance);
    const missingContext = unmetContext(instanceId, recipe);
    if (missingContext.length) {
        return {
            type: 'tokens',
            items: missingContext.map(req =>
                req.tag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            )
        };
    }

    // 2. Tokens are satisfied! Now check missing input Items
    const io = effectiveIO(instanceId, instance);
    if (io.inputs?.length) {
        const check = InputCost.checkCost(instance, io.inputs);
        if (!check.ok) {
            const missingItems = check.missing.map(m => {
                const item = getItem(m.itemId);
                return item?.name || m.itemId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            });
            return {
                type: 'items',
                items: missingItems
            };
        }
    }

    return { type: null, items: [] };
}
