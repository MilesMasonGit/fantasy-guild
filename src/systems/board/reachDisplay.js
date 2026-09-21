// Fantasy Guild — which Tokens show a reach ring (owner ruling, 2026-09-21)

import { getTokenType, getProvidedTagsWithTiers } from '../../config/registries/tokenRegistry.js';
import { recipesForToken } from '../../config/registries/recipePoolRegistry.js';
import { caresAboutNeighbours } from '../effects/statements.js';

/**
 * ⭐ Whether a Token shows its Near ring when hovered or dragged.
 *
 * The owner: *"Only tokens that care about reach should show their reach"*,
 * and chose the broad reading — a ring whenever the Token acts on **or depends
 * on** what is near it. A plain resource, a Map or the Guild Hall shows none.
 *
 * Four places say a Token cares, because the content still carries two
 * generations of fields:
 * 1. its **rules** (`caresAboutNeighbours` — Provides, Acts as, Requires,
 *    Restocks, Cannot, nearby moments and counts);
 * 2. a legacy **`provides`** tool list (`getProvidedTagsWithTiers` reads both
 *    it and `Acts as`);
 * 3. **`acceptedTokens`** — "Requires a nearby Pickaxe" on an ore vein;
 * 4. a **station recipe** that needs context Tokens beside it.
 */
export function showsNearRing(typeId) {
    const def = getTokenType(typeId);
    if (!def) return false;
    if (caresAboutNeighbours(def)) return true;
    if (Object.keys(getProvidedTagsWithTiers(def)).length > 0) return true;
    if (def.acceptedTokens?.length) return true;
    return recipesForToken(def).some(recipe => recipe?.requiresContext?.length > 0);
}
