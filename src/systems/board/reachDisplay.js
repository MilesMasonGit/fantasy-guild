// which Tokens show a reach ring

import { getTokenType, getProvidedTagsWithTiers } from '../../config/registries/tokenRegistry.js';
import { recipesForToken, contextTagsOf } from '../../config/registries/recipePoolRegistry.js';
import { caresAboutNeighbours } from '../effects/statements.js';

/**
 * Whether a Token shows its Near ring when hovered or dragged: whenever it acts on or depends on
 * what is near it. A plain resource, a Map or the Guild Hall shows none.
 *
 * Four places say a Token cares, because content carries two generations of fields:
 * 1. its rules (`caresAboutNeighbours`)
 * 2. a legacy `provides` tool list
 * 3. `acceptedTokens` (Requires a nearby Pickaxe on an ore vein)
 * 4. a station recipe that needs context Tokens beside it
 */
export function showsNearRing(typeId) {
    const def = getTokenType(typeId);
    if (!def) return false;
    if (caresAboutNeighbours(def)) return true;
    if (Object.keys(getProvidedTagsWithTiers(def)).length > 0) return true;
    if (def.acceptedTokens?.length) return true;
    return recipesForToken(def).some(recipe => contextTagsOf(recipe).length > 0);
}
