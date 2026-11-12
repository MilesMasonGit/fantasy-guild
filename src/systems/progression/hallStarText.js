// the Guild Hall's stars in words: a rank's rules and Passive Production lines

import { renderStatement, effectParts } from '../effects/statementText.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { getCategoryInfo } from '../../config/registries/equipmentCategories.js';
import { wishingWellWater, WISHING_WELL_ITEM, BANK_TAB_SLOTS } from '../../config/guildUpgrades.js';
import { toolNamer } from '../effects/toolNames.js';
import { REACH } from '../../config/registries/reachRegistry.js';
import { getAllTokenTypes, tokenName } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { PASSIVE_LAP_BASE_MS } from '../../config/registries/tokenConstants.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import { passiveLapMs } from '../board/workTime.js';
import { rankOf } from '../../config/hallStars.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { getSkill, COMBAT_SKILL_IDS } from '../../config/registries/skillRegistry.js';

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
    if (isStyleRule(statement)) {
        const parts = effectParts(asGuildRule(statement), names);
        if (parts) return `Gives every ${styleSubject(statement)} ${`${parts.size} ${parts.after}`.trim()} in combat.`;
    }
    const text = renderStatement(asGuildRule(statement), names);
    const category = statement?.payload?.category;
    if (!category || getPaletteEntry(statement.payload.type)?.categories !== 'skill') return text;
    const skill = getSkill(category)?.name || category;
    if (text.includes(`${skill} work`)) return text;
    return text.endsWith('.') ? `${text.slice(0, -1)}, but only for ${skill} work.` : `${text}, but only for ${skill} work`;
}

/**
 * One Passive Production line, in words: "10 Copper Ore a lap". The lap's length is said once, by
 * the Hall's effects, since a star can change it.
 */
export function hallLineText(line, names = hallNames()) {
    return `${line.quantity} ${names.item(line.itemId)} a lap`;
}

/** "8:00", "10:00": a lap's length as the Hall's effects say it. */
export function lapClock(ms) {
    const total = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** The lap one Lap Time rule gives on its own, from the base lap: what a lap star's rank says. */
export function lapOfRule(statement) {
    const agg = new ModifierAggregator('hall:lap');
    agg.addModifier({ ...statement.payload, value: Number(statement.payload?.value) || 0, source: 'lap' });
    return passiveLapMs(agg.resolveAxis(EFFECT_TYPES.PASSIVE_LAP, PASSIVE_LAP_BASE_MS));
}

/** What a star gives at a rank, in words: its rules, then its lines; empty at rank 0. */
export function describeStarRank(star, rank, names = hallNames()) {
    const record = rankOf(star, rank);
    if (!record) return '';
    return [
        ...record.rules.map(s => hallRuleSentence(s, names)),
        ...record.lines.map(l => hallLineText(l, names)),
        ...(star.opensRing ? [RING_STAR_TEXT.amount] : [])
    ].join(' ');
}

/** A built-in track's sentence: it has no rules to build one from. */
const BUILT_IN_SENTENCE = {
    bank_tabs: `Every rank opens another Bank tab, room for ${BANK_TAB_SLOTS} more kinds of items.`,
    roster_size: 'Every rank makes room for one more hero.',
    wishing_well: 'The Guild Hall draws Water every lap, no hero needed.'
};

/** A ring star's words (`hallStars.opensRing`): no ring numbers for the player, only the next border. */
export const RING_STAR_TEXT = Object.freeze({
    sentence: 'The guild may settle the lands past the next border of the world map.',
    amount: 'Lands past the next border'
});

/** "work" → "works", "carry" → "carries": the verb after "Every …". */
function verbS(word) {
    if (word === 'have') return 'has';
    if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
    if (/(s|sh|ch|x|o)$/.test(word)) return `${word}es`;
    return `${word}s`;
}

/** A plural-verb phrase for one subject: "grow and refill faster" → "grows and refills faster". */
function singular(phrase) {
    const words = phrase.split(' ');
    if (words[0]) words[0] = verbS(words[0]);
    if (words[1] === 'and' && words[2]) words[2] = verbS(words[2]);
    return words.join(' ');
}

/** "a", "a and b", "a, b and c". */
function andList(list) {
    if (list.length <= 1) return list[0] || '';
    return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** Whether a rule is on a combat axis a star gives fighters (Damage, Swing Time, Accuracy). */
function isStyleRule(statement) {
    return getPaletteEntry(statement?.payload?.type)?.categories === 'combatStyle';
}

/** Who a combat star's rule helps: "Melee fighter", or "hero" when it names no style. */
function styleSubject(statement) {
    const id = String(statement?.payload?.category || '').toLowerCase();
    return COMBAT_SKILL_IDS.includes(id) ? `${getSkill(id)?.name || id} fighter` : 'hero';
}

/** What a combat star's fighters do, by axis, when it helps them and when it hinders them. */
const STYLE_PHRASES = {
    [EFFECT_TYPES.DAMAGE]: ['hit harder', 'hit softer'],
    [EFFECT_TYPES.SWING_TIME]: ['swing faster', 'swing slower'],
    [EFFECT_TYPES.ACCURACY]: ['miss less', 'miss more']
};

/** Who a star's rule reaches, as a singular noun after "Every": "Forestry Token", "Logging Camp", "hero". */
function ruleSubject(statement, names) {
    if (getPaletteEntry(statement?.payload?.type)?.guildOnly) return 'hero';
    if (isStyleRule(statement)) return styleSubject(statement);
    const to = statement?.to || {};
    if (to.mode === 'tag' && to.value) return `${to.value} Token`;
    if (to.mode === 'id' && to.value) return names.token(to.value);
    const category = statement?.payload?.category;
    const vocabulary = category ? getPaletteEntry(statement.payload.type)?.categories : null;
    // Preservation may name a skill or a carried thing: only a skill narrows the Tokens it reaches.
    const skill = vocabulary === 'skill' ? getSkill(category)?.name || category
        : vocabulary === 'skillOrCarried' ? getSkill(category)?.name || null
            : null;
    return skill ? `${skill} Token` : 'Token';
}

/** "Oak Token", "Fir Token" → "Oak and Fir Token"; any other mix is listed whole. */
function subjectsText(subjects) {
    const tokens = subjects.filter(s => s.endsWith(' Token'));
    if (tokens.length === subjects.length && tokens.length > 1) {
        return `${andList(tokens.map(s => s.slice(0, -' Token'.length)))} Token`;
    }
    return andList(subjects);
}

/**
 * One rule's effect as a sentence part and an amount: `phrase` says what it does without its number
 * ("work faster"), `amount` the number with its words ("6% faster"). Null for a rule that cannot be
 * said that way.
 */
function ruleEffect(statement, names) {
    const payload = statement?.payload || {};
    if (payload.type === EFFECT_TYPES.PASSIVE_LAP) {
        // The Guild Hall is the subject, and the amount is the lap itself, not its percentage.
        return {
            phrase: 'lap',
            amount: `outputs every ${lapClock(lapOfRule(statement))}`,
            sentence: 'The Guild Hall\'s outputs arrive more often: its lap is shorter.'
        };
    }
    if (payload.type === EFFECT_TYPES.XP_FOR_EVERYONE) {
        const xp = Math.max(0, Math.round(Number(payload.value) || 0));
        return {
            phrase: 'get XP in every skill',
            amount: `${xp} XP in every skill`,
            sentence: 'Every hero gets XP in every skill, once a rank; recruits arrive with it.'
        };
    }
    if (payload.type === EFFECT_TYPES.LOADOUT_SLOTS) {
        const n = Number(payload.value) || 0;
        const kind = getCategoryInfo(payload.category)?.label || payload.category || 'item';
        return {
            phrase: `get ${n < 0 ? 'fewer' : 'more'} ${kind} slots`,
            amount: `${Math.abs(n)} ${n < 0 ? 'fewer' : 'more'} ${kind} ${Math.abs(n) === 1 ? 'slot' : 'slots'}`
        };
    }
    const parts = effectParts(asGuildRule(statement), names);
    if (!parts) return null;
    const style = STYLE_PHRASES[payload.type];
    if (style && isStyleRule(statement)) {
        const helps = (Number(payload.value) > 0) !== !!getPaletteEntry(payload.type)?.inverted;
        return { phrase: helps ? style[0] : style[1], amount: `${parts.size} ${parts.after}`.trim() };
    }
    if (parts.before) return { phrase: `${parts.before} ${parts.after}`.trim(), amount: `${parts.size} ${parts.after}`.trim() };
    // An axis with no verb of its own reads "7% more yield": the star "gives more yield".
    const direction = parts.size.split(' ').pop();
    return { phrase: `give ${direction} ${parts.after}`.trim(), amount: `${parts.size} ${parts.after}`.trim() };
}

/** A rank's rules grouped by what they do, each with the subjects it reaches, in the rules' order. */
function effectGroups(record, names) {
    const groups = [];
    for (const statement of record?.rules || []) {
        const effect = ruleEffect(statement, names);
        if (!effect) continue;
        const subject = ruleSubject(statement, names);
        const group = groups.find(g => g.phrase === effect.phrase && g.amount === effect.amount);
        if (group) {
            if (!group.subjects.includes(subject)) group.subjects.push(subject);
        } else {
            groups.push({ ...effect, subjects: [subject] });
        }
    }
    return groups;
}

/**
 * What a star does in one plain sentence with no numbers, built from its first rank's rules and
 * lines ("Every Forestry Token works faster."), or a built-in track's own sentence.
 */
export function starSentence(def, names = hallNames()) {
    if (!def) return '';
    if (!def.authored) return BUILT_IN_SENTENCE[def.id] || def.description || '';
    const first = rankOf(def.star, 1);
    if (!first) return def.description || '';
    const parts = effectGroups(first, names).map(g => g.sentence || `Every ${subjectsText(g.subjects)} ${singular(g.phrase)}.`);
    if (first.lines.length) {
        parts.push(`The Guild Hall draws ${andList(first.lines.map(l => names.item(l.itemId)))} every lap, no hero needed.`);
    }
    if (def.star.opensRing) parts.push(RING_STAR_TEXT.sentence);
    return parts.join(' ') || def.description || '';
}

/**
 * What a star gives at a rank, as brief numbers ("6% faster", "2 Oak Wood"), or null at rank 0. A
 * figure several rules share (Green Thumb's Oak and Fir) is said once.
 */
export function starAmount(def, rank, names = hallNames()) {
    const r = Math.floor(Number(rank) || 0);
    if (!def || r <= 0) return def?.id === 'bank_tabs' ? def.statLabel(0) : null;
    if (!def.authored) {
        if (def.id === 'wishing_well') return `${wishingWellWater(r)} ${names.item(WISHING_WELL_ITEM)}`;
        return def.statLabel(r);
    }
    const record = rankOf(def.star, r);
    if (!record) return null;
    const amounts = [...new Set(effectGroups(record, names).map(g => g.amount))];
    for (const line of record.lines) amounts.push(`${line.quantity} ${names.item(line.itemId)}`);
    if (def.star.opensRing) amounts.push(RING_STAR_TEXT.amount);
    return amounts.join(', ') || null;
}
