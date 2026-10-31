// the Guild Hall's stars in words: a rank's rules and Passive Production lines

import { renderStatement } from '../effects/statementText.js';
import { toolNamer } from '../effects/toolNames.js';
import { REACH } from '../../config/registries/reachRegistry.js';
import { getAllTokenTypes, tokenName } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { PASSIVE_PRODUCTION_MS } from '../../config/registries/tokenConstants.js';
import { rankOf } from '../../config/hallStars.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { getSkill } from '../../config/registries/skillRegistry.js';

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

/**
 * One rule of a star, in words. A skill boost always says its skill: the renderer leaves the scope
 * out of an axis that words its own sentence ("award 10% more XP"), and on a star it is the point.
 */
export function hallRuleSentence(statement, names = hallNames()) {
    const text = renderStatement(asGuildRule(statement), names);
    const category = statement?.payload?.category;
    if (!category || getPaletteEntry(statement.payload.type)?.categories !== 'skill') return text;
    const skill = getSkill(category)?.name || category;
    if (text.includes(`${skill} work`)) return text;
    return text.endsWith('.') ? `${text.slice(0, -1)}, but only for ${skill} work.` : `${text}, but only for ${skill} work`;
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
