import { getAllTokenTypes, tokenName, outputRange } from '../../../config/registries/tokenRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { contextRequirementsOf } from '../../../config/registries/recipePoolRegistry.js';
import { foundationMinTierOf } from '../../../config/registries/tokenConstants.js';
import { toolNamer, foundationPhrase } from '../../../systems/effects/toolNames.js';
import { unmetContext } from '../../../systems/board/RecipeResolver.js';
import { availableOf } from '../../../systems/board/InputAllocator.js';
import { toolTokenFor } from './tokenCard.js';

/**
 * One recipe row of the list as plain data: what the row draws, left to right. Every engine read
 * comes through `src`, so a test can pin a row without a mat.
 */

export function liveRowSources() {
    return {
        allTypes: getAllTokenTypes,
        itemName: (id) => getItem(id)?.name || id,
        tokenName: (id) => tokenName(id) || id,
        available: availableOf,
        unmetContext
    };
}

const chanceOf = (o) => (o?.chance == null ? 100 : Number(o.chance));

/** An output as the row draws it: an item or, for a building, a Token, with its range and chance. */
function outputOf(o, src) {
    const { min, max } = outputRange(o);
    const chance = chanceOf(o);
    return {
        itemId: o.tokenId ? null : o.itemId,
        tokenId: o.tokenId || null,
        name: o.tokenId ? src.tokenName(o.tokenId) : src.itemName(o.itemId),
        min,
        max,
        chance: chance < 100 ? chance : null
    };
}

/**
 * The row for one recipe.
 *
 * The main output is the first certain one (the first at all when none is certain); the rest are
 * byproducts. Requirements are the context Tokens it needs beside it, then a Foundation rung above
 * the bottom; `met` is null where it cannot be judged (no instance, or a Foundation rung, which
 * the pool already filtered by).
 *
 * @returns {{ id, level, inputs: object[], requirements: object[], main: object|null,
 *   byproducts: object[], xp: number, durationMs: number }}
 */
export function recipeRowOf(recipe, level, instanceId = null, src = liveRowSources()) {
    const inputs = (recipe?.inputs || [])
        .filter(i => i?.itemId && Number(i.quantity ?? 1) > 0)
        .map(i => {
            const need = Number(i.quantity ?? 1);
            const have = Math.floor(src.available(i.itemId) || 0);
            return { itemId: i.itemId, name: src.itemName(i.itemId), need, have, short: have < need };
        });

    const types = src.allTypes();
    const tool = toolNamer(types);
    const unmet = instanceId != null ? new Set(src.unmetContext(instanceId, recipe).map(r => r.tag)) : null;
    const requirements = contextRequirementsOf(recipe).map(req => ({
        key: `ctx:${req.tag}`,
        name: tool(req.tag, req.minTier),
        typeId: toolTokenFor(req.tag, req.minTier, types),
        met: unmet ? !unmet.has(req.tag) : null
    }));
    if (recipe?.foundationKinds?.length) {
        const phrase = foundationPhrase(types, recipe, foundationMinTierOf(recipe));
        if (phrase) requirements.push({ key: 'foundation', name: phrase.replace(/^an? /, ''), typeId: null, met: null });
    }

    const outputs = (recipe?.outputs || []).filter(o => (o?.itemId || o?.tokenId) && !o.currency);
    const mainIndex = Math.max(0, outputs.findIndex(o => chanceOf(o) >= 100));
    const main = outputs.length ? outputOf(outputs[mainIndex], src) : null;
    const byproducts = outputs.filter((_, i) => i !== mainIndex).map(o => outputOf(o, src));

    return {
        id: recipe?.id,
        level,
        inputs,
        requirements,
        main,
        byproducts,
        xp: Number(recipe?.xp) || 0,
        durationMs: Number(recipe?.durationMs) || 0
    };
}
