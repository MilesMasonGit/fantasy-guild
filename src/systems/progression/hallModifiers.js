// what the Guild Hall's stars register guild-wide, worked out from the stars and their ranks alone

import { KEYWORD } from '../effects/statements.js';
import { auraSourceId } from '../effects/GuildModifiers.js';
import { filtersOf, getFilterKind, FILTER_NEEDS } from '../../config/registries/filterRegistry.js';
import { rankOf } from '../../config/hallStars.js';

/**
 * Pure: `HallRules.apply` registers these, and the progression ledger's rate calculator can read
 * them the same way (as it reads a Region's, `regionModifiers.js`).
 *
 * A star's held rank gives its rank record's rules (`hallStars.js`). Each `Provides` becomes a
 * modifier under its own source:
 * - **guild-wide** when it names no Tokens: into the guild aggregator, narrowed only by its
 *   `category` (a skill: "+10 % XP, but only for Mining work"; for Loadout Slots, a loadout kind);
 * - **aimed** when it names some (`to` by id, tag or kind, with filters that read a definition):
 *   added to each matching Token's own aggregator ("−20 % Grow Time to Copper Veins").
 *
 * A rule's reach means nothing here: a star reaches the whole guild. A rule the guild cannot carry
 * is skipped and reported, never widened: another keyword, a triggered rule, no number, or a filter
 * that reads live state (charges, who works it), which nothing would ever refresh.
 */

/** A rule's Token selector when it names only some Tokens, else null. */
function aimOf(statement) {
    const to = statement?.to;
    if (!to || typeof to !== 'object') return null;
    const named = (!!to.mode && to.mode !== 'all') || filtersOf(to).length > 0;
    return named ? to : null;
}

/** Whether a selector's filters read only a Token's definition. */
function readsDefinitionOnly(to) {
    return filtersOf(to).every(f => getFilterKind(f.kind).needs === FILTER_NEEDS.DEF);
}

/**
 * @param {object[]} stars authored stars, normalised (`hallStars.normaliseStar`)
 * @param {Record<string, number>} ranks the guild's ranks (`progress.guildUpgrades`)
 * @returns {{
 *   modifiers: object[],
 *   aimed: Array<{to: object, modifier: object}>,
 *   ignored: Array<{starId: string, rank: number, index: number, reason: string}>,
 *   held: Array<{starId: string, rank: number, statement: object}>
 * }} `held` is every rule of a held rank, carried or not (what the Effects list shows)
 */
export function hallRulesOf(stars, ranks) {
    const modifiers = [];
    const aimed = [];
    const ignored = [];
    const held = [];
    for (const star of stars || []) {
        const rank = Math.floor(Number(ranks?.[star?.id]) || 0);
        const record = rankOf(star, rank);
        if (!record) continue;
        record.rules.forEach((statement, index) => {
            const skip = (reason) => ignored.push({ starId: star.id, rank, index, reason });
            if (statement?.keyword !== KEYWORD.PROVIDES) return skip('not a Provides');
            if (statement.when?.event) return skip('triggered');
            const payload = statement.payload;
            const value = Number(payload?.value);
            if (!payload?.type || !Number.isFinite(value)) return skip('no axis or value');
            const to = aimOf(statement);
            if (to && !readsDefinitionOnly(to)) return skip('a filter that reads live state');
            held.push({ starId: star.id, rank, statement });
            // As `TileModifiers.rebuildToken` registers a Token's own: the payload's flat `category`
            // becomes the aggregator's nested `target.category`.
            const { category, ...rest } = payload;
            const modifier = {
                ...rest,
                value,
                source: auraSourceId(`hall:${star.id}#${index}`, statement.id || 'rule'),
                ...(category ? { target: { category } } : {})
            };
            if (to) aimed.push({ to, modifier });
            else modifiers.push(modifier);
        });
    }
    return { modifiers, aimed, ignored, held };
}

/**
 * Every Passive Production line the held ranks pay, merged per item: `[{ itemId, quantity }]`,
 * each lap of the Guild Hall's timer, beside the Wishing Well's Water.
 */
export function hallLinesOf(stars, ranks) {
    const byItem = new Map();
    for (const star of stars || []) {
        const record = rankOf(star, ranks?.[star?.id]);
        for (const line of record?.lines || []) {
            byItem.set(line.itemId, (byItem.get(line.itemId) || 0) + line.quantity);
        }
    }
    return [...byItem].map(([itemId, quantity]) => ({ itemId, quantity }));
}
