// which Tokens show a reach ring

import { getTokenType, getProvidedTagsWithTiers } from '../../config/registries/tokenRegistry.js';
import { recipesForToken, contextTagsOf } from '../../config/registries/recipePoolRegistry.js';
import { caresAboutNeighbours } from '../effects/statements.js';
import { isEnemyDef } from '../../config/registries/enemyProfile.js';
import { campOf } from '../../config/registries/tokenConstants.js';
import { reachRadius, tokensWithin } from './nearby.js';
import * as BoardState from './BoardState.js';

/**
 * Whether a Token shows the reach ring (and its dots) when hovered or dragged: an unbuilt
 * Foundation, a work camp, or a Token that acts on or depends on what is near it. A plain resource, a Map or the Guild Hall shows none, and nor does an enemy
 * camp (a spawner of enemies), whatever its rules: no enemy acts on what is near its camp.
 *
 * Four places say a Token cares, because content carries two generations of fields:
 * 1. its rules (`caresAboutNeighbours`)
 * 2. a legacy `provides` tool list
 * 3. `acceptedTokens` (Requires a nearby Pickaxe on an ore vein)
 * 4. a station recipe that needs context Tokens beside it
 */
export function showsNearRing(typeId) {
    const def = getTokenType(typeId);
    if (!def || isEnemyCampDef(def)) return false;
    // A Foundation shows the reach of whatever it will become; a work camp hands out work in it.
    if (def.foundation || campOf(def)) return true;
    if (caresAboutNeighbours(def)) return true;
    if (Object.keys(getProvidedTagsWithTiers(def)).length > 0) return true;
    if (def.acceptedTokens?.length) return true;
    return recipesForToken(def).some(recipe => contextTagsOf(recipe).length > 0);
}

/**
 * The Tokens that wear an in-reach dot while a ring is drawn at `point`: every Token on the mat
 * within the standard reach, `except` the one the ring belongs to. ⚠️ This is the engine's own
 * test (`nearby.tokensWithin`, the one `Camps.reaches` and every `nearby` rule measure with), so a
 * dot can never disagree with what is worked; never write a second distance test here. Heroes
 * and floor loot are not Tokens on the mat, so they never get one.
 * @returns {Array<{id: string, x: number, y: number}>}
 */
export function reachDotsAt(point, except = null, radius = reachRadius()) {
    const out = [];
    for (const id of tokensWithin(point, radius, except)) {
        const t = BoardState.getTokenById(id);
        if (t) out.push({ id, x: t.x, y: t.y });
    }
    return out;
}

/** Whether a Token type is a spawner of enemies. */
function isEnemyCampDef(def) {
    const spawns = def?.spawner?.spawns;
    return Array.isArray(spawns) && spawns.some(entry => isEnemyDef(getTokenType(entry?.typeId)));
}
