// what a Region's rules register guild-wide, worked out from the rules alone

import { KEYWORD } from '../effects/statements.js';
import { auraSourceId } from '../effects/GuildModifiers.js';

/** Pure: `RegionRules.apply` registers these, and the progression ledger's rate calculator reads them the same way. */

/** Whether a rule names only some Tokens: by id, type or tag, or through a filter. */
function narrowed(statement) {
    const to = statement?.to;
    if (!to || typeof to !== 'object') return false;
    return (!!to.mode && to.mode !== 'all') || (Array.isArray(to.filters) && to.filters.length > 0);
}

/**
 * The modifiers a Region's rules register, each under its own source: two copies of one map stack,
 * as two copies of a buffing Token do.
 *
 * @param {object[]} rules  the Region's `rules`
 * @param {string} regionId
 * @returns {{modifiers: object[], ignored: {index: number, reason: string}[]}}
 */
export function modifiersOf(rules, regionId) {
    const modifiers = [];
    const ignored = [];
    (Array.isArray(rules) ? rules : []).forEach((statement, index) => {
        const skip = (reason) => ignored.push({ index, reason });
        if (statement?.keyword !== KEYWORD.PROVIDES) return skip('not a Provides');
        if (statement.when?.event) return skip('triggered');
        if (narrowed(statement)) return skip('aimed at some Tokens only');
        const payload = statement.payload;
        if (!payload?.type || !Number.isFinite(Number(payload.value))) return skip('no axis or value');
        // As `TileModifiers.rebuildToken` registers a Token's own: the payload's flat `category`
        // becomes the aggregator's nested `target.category`.
        const { category, ...rest } = payload;
        modifiers.push({
            ...rest,
            value: Number(payload.value),
            source: auraSourceId(`region:${regionId}#${index}`, statement.id || 'rule'),
            ...(category ? { target: { category } } : {})
        });
    });
    return { modifiers, ignored };
}
