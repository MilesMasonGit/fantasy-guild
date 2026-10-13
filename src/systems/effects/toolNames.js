import { getProvidedTagsWithTiers } from './statements.js';
import { foundationTierOf } from '../../config/registries/tokenConstants.js';

/**
 * The player's words for a tool or Foundation requirement. The game never prints a tier number:
 * a requirement above the bottom rung names the first Token that meets it ("an Iron Pickaxe or
 * better"), so the ladder is learnt from the chain itself. The CMS keeps its numbers.
 *
 * Pure: the caller hands in the Token dictionary (the registry in the game, the CMS store's
 * expanded Tokens on the way to `data/`).
 */

/** `fishing_net` → `fishing net`. */
export const tagWords = (tag) => String(tag || '').replace(/_/g, ' ').trim();

/** "a" or "an", for the phrase that follows it. */
export const articleOf = (phrase) => (/^[aeiou]/i.test(String(phrase || '')) ? 'an' : 'a');

/** The phrase with its article: "an Iron Pickaxe". */
export const withArticle = (phrase) => `${articleOf(phrase)} ${phrase}`;

/** Total quantity of a Token's Shop price; a Token not sold sorts after every sold one. */
const priceWeight = (def) => {
    const price = def?.shop?.price;
    if (!Array.isArray(price) || !price.length) return Infinity;
    return price.reduce((n, line) => n + (Number(line?.quantity) || 0), 0);
};

/** The lowest rung that reaches `minTier`, cheapest then alphabetical within it; its name or null. */
function firstQualifying(candidates, minTier) {
    const best = candidates
        .filter(c => c.tier >= minTier)
        .sort((a, b) => a.tier - b.tier
            || priceWeight(a.def) - priceWeight(b.def)
            || String(a.def.name || '').localeCompare(String(b.def.name || '')))[0];
    return best ? (best.def.name || null) : null;
}

/**
 * The phrase for "a tool with `tag`, at `minTier` or better", without its article:
 * `pickaxe` at the bottom rung, `Iron Pickaxe or better` above it.
 *
 * @param {Record<string, object>} tokens  Token defs with their statements expanded
 * @returns {(tag: string, minTier?: number) => string}
 */
export function toolNamer(tokens = {}) {
    return (tag, minTier = 1) => {
        const words = tagWords(tag);
        if (!(Number(minTier) > 1)) return words;
        const candidates = [];
        for (const def of Object.values(tokens || {})) {
            const tier = getProvidedTagsWithTiers(def)[tag];
            if (tier) candidates.push({ def, tier });
        }
        const name = firstQualifying(candidates, Number(minTier));
        return name ? `${name} or better` : `stronger ${words}`;
    };
}

/**
 * "a Stone Foundation or better" for a building recipe above the bottom Foundation rung, or null
 * when any Foundation of its kinds will do.
 *
 * @param {Record<string, object>} tokens
 * @param {object} recipe  carries `foundationKinds` and `foundationMinTier`
 * @param {number} minTier  the recipe's minimum, already read by `foundationMinTierOf`
 */
export function foundationPhrase(tokens, recipe, minTier) {
    const kinds = recipe?.foundationKinds || [];
    if (!kinds.length || !(minTier > 1)) return null;
    const candidates = Object.values(tokens || {})
        .filter(def => def?.foundation && kinds.includes(def.foundation.kind))
        .map(def => ({ def, tier: foundationTierOf(def) }));
    const name = firstQualifying(candidates, minTier);
    return name ? `${withArticle(name)} or better` : 'a stronger Foundation';
}
