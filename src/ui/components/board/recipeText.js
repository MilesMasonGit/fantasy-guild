import { getItem } from '../../../config/registries/itemRegistry.js';
import { getSkill } from '../../../config/registries/skillRegistry.js';
import { tokenName, getAllTokenTypes } from '../../../config/registries/tokenRegistry.js';
import { contextRequirementsOf } from '../../../config/registries/recipePoolRegistry.js';
import { foundationMinTierOf } from '../../../config/registries/tokenConstants.js';
import { toolNamer, foundationPhrase, withArticle } from '../../../systems/effects/toolNames.js';

// a recipe in one line of words, for the gear badge hover

/** An item's display name, falling back to its id so an unauthored item still reads. */
export const itemLabel = (itemId) => getItem(itemId)?.name || itemId;

/** A skill's display name, falling back to its id. */
export const skillLabel = (skillId) => getSkill(skillId)?.name || skillId || 'Unknown';

/** "2× Oak Wood, 1× Wheat" — a recipe's item inputs in one line, or null. */
export function inputSummary(recipe) {
    const parts = (recipe?.inputs || []).map(i => `${i.quantity ?? 1}× ${itemLabel(i.itemId)}`);
    return parts.length ? parts.join(', ') : null;
}

/** "an anvil, an Iron Pickaxe or better" — the context Tokens a recipe needs beside it, or null. */
export function contextSummary(recipe) {
    const requirements = contextRequirementsOf(recipe);
    if (!requirements.length) return null;
    const tool = toolNamer(getAllTokenTypes());
    return requirements.map(c => withArticle(tool(c.tag, c.minTier))).join(', ');
}

/** "Needs a Stone Foundation or better" for a building recipe above the bottom Foundation rung, or null. */
export function foundationTierSummary(recipe) {
    if (!recipe?.foundationKinds?.length) return null;
    const phrase = foundationPhrase(getAllTokenTypes(), recipe, foundationMinTierOf(recipe));
    return phrase ? `Needs ${phrase}` : null;
}

/** "1× Charcoal" — a recipe's outputs, chances included when they are not certain. */
export function outputSummary(recipe) {
    const parts = (recipe?.outputs || []).map(o => {
        const min = o.minQty ?? 1;
        const max = o.maxQty ?? min;
        const qty = min === max ? `${min}` : `${min}–${max}`;
        const chance = (o.chance == null || o.chance >= 100) ? '' : ` (${o.chance}%)`;
        // A building recipe outputs a Token.
        const label = o.tokenId ? (tokenName(o.tokenId) || o.tokenId) : itemLabel(o.itemId);
        return `${qty}× ${label}${chance}`;
    });
    return parts.length ? parts.join(', ') : null;
}
