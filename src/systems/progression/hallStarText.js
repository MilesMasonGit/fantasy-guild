// the Guild Hall's stars in words: a rank's rules and Passive Production lines

import { renderStatement } from '../effects/statementText.js';
import { toolNamer } from '../effects/toolNames.js';
import { REACH } from '../../config/registries/reachRegistry.js';
import { getAllTokenTypes, tokenName } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { PASSIVE_PRODUCTION_MS } from '../../config/registries/tokenConstants.js';
import { rankOf } from '../../config/hallStars.js';

const ALL_TOKENS = Object.freeze({ mode: 'all', value: '' });

/** The registries' names, as the sentence renderer takes them. */
export function hallNames() {
    return {
        token: id => tokenName(id) || id,
        item: id => getItem(id)?.name || id,
        tool: toolNamer(getAllTokenTypes())
    };
}

/**
 * A star's rule as it holds: on the whole mat, every Token unless it names some. Its authored reach
 * means nothing for a star (`hallModifiers.js`), so it never reads "nearby".
 */
export function asGuildRule(statement) {
    return {
        ...statement,
        reach: REACH.BOARD,
        to: statement?.to?.mode || statement?.to?.filters?.length ? statement.to : ALL_TOKENS
    };
}

/** One rule of a star, in words. */
export function hallRuleSentence(statement, names = hallNames()) {
    return renderStatement(asGuildRule(statement), names);
}

const LAP_MINUTES = Math.round(PASSIVE_PRODUCTION_MS / 60000);

/** One Passive Production line, in words: "10 Copper Ore / 5 min". */
export function hallLineText(line, names = hallNames()) {
    return `${line.quantity} ${names.item(line.itemId)} / ${LAP_MINUTES} min`;
}

/** What a star gives at a rank, in words: its rules, then its lines; empty at rank 0. */
export function describeStarRank(star, rank, names = hallNames()) {
    const record = rankOf(star, rank);
    if (!record) return '';
    return [
        ...record.rules.map(s => hallRuleSentence(s, names)),
        ...record.lines.map(l => hallLineText(l, names))
    ].join(' ');
}
