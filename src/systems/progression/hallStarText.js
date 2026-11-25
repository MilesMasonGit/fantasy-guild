// the Guild Hall's stars in words: a rank's rules and Passive Production lines

import { renderStatement, effectParts, effectHead } from '../effects/statementText.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { getCategoryInfo } from '../../config/registries/equipmentCategories.js';
import { doseKindsPhrase } from '../../config/registries/carriedKinds.js';
import { BANK_TAB_SLOTS, ROSTER_STAR, BANK_TABS_STAR, rankEffectLabel } from '../../config/guildUpgrades.js';
import { toolNamer } from '../effects/toolNames.js';
import { REACH } from '../../config/registries/reachRegistry.js';
import { getAllTokenTypes, tokenName } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { PASSIVE_LAP_BASE_MS } from '../../config/registries/tokenConstants.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import { passiveLapMs } from '../board/workTime.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { hallRulesOf, hallSourceOf } from './hallModifiers.js';
import { rankOf } from '../../config/hallStars.js';
import { getPaletteEntry } from '../../config/registries/modifierPalette.js';
import { getSkill, COMBAT_SKILL_IDS } from '../../config/registries/skillRegistry.js';
import { damageTypeLabel } from '../../config/registries/damageTypes.js';
import { lengthText } from '../../utils/Formatters.js';

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
 * One rule of a star, in words, led by its effect's name and number ("Speed +5% on every Mining
 * Token on the board."). A combat star names the fighters it helps.
 */
export function hallRuleSentence(statement, names = hallNames()) {
    if (isFighterRule(statement) && Number(statement?.payload?.value)) {
        // A type row names its type in words, as its rule line does ("10% more Fire damage").
        const type = statement.payload.type;
        if (type === EFFECT_TYPES.TYPE_DAMAGE || type === EFFECT_TYPES.TYPE_RESIST) {
            return `Gives every ${styleSubject(statement)} ${fighterAmount(statement, names)} in combat.`;
        }
        return `${effectHead(statement, names)} for every ${styleSubject(statement)} in combat.`;
    }
    return renderStatement(asGuildRule(statement), names);
}

/**
 * One Passive Production line, in words: "10 Copper Ore a lap". The lap's length is said once, by
 * the Hall's effects, since a star can change it.
 */
export function hallLineText(line, names = hallNames()) {
    return `${line.quantity} ${names.item(line.itemId)} a lap`;
}

/** The lap one Lap Time rule gives on its own, from the base lap. */
export function lapOfRule(statement) {
    const agg = new ModifierAggregator('hall:lap');
    agg.addModifier({ ...statement.payload, value: Number(statement.payload?.value) || 0, source: 'lap' });
    return passiveLapMs(agg.resolveAxis(EFFECT_TYPES.PASSIVE_LAP, PASSIVE_LAP_BASE_MS));
}

/**
 * The lap with `star` at `rank`, every other Lap Time rule the guild holds (another star, a
 * Region's) still in force: the rules sum, so a rank's lap depends on the rest.
 */
function lapWithRank(star, rank) {
    const agg = new ModifierAggregator('hall:lap');
    for (const [source, modifiers] of getGlobalAggregator().modifiers) {
        if (hallSourceOf(source)?.starId === star.id) continue;
        for (const m of modifiers) if (m.type === EFFECT_TYPES.PASSIVE_LAP) agg.addModifier(m);
    }
    for (const m of hallRulesOf([star], { [star.id]: rank }).modifiers) {
        if (m.type === EFFECT_TYPES.PASSIVE_LAP) agg.addModifier(m);
    }
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

/** What Bunk Beds and Bank Tabs do by id, in a sentence: no rule says it. */
const BY_ID_SENTENCE = {
    [BANK_TABS_STAR]: `Every rank opens another Bank tab, room for ${BANK_TAB_SLOTS} more kinds of items.`,
    [ROSTER_STAR]: 'Every rank makes room for one more hero.'
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

/** Whether a rule is on a combat axis a hero reads from the guild (`fromGuild`): a star gives it fighters. */
function isFighterRule(statement) {
    return !!getPaletteEntry(statement?.payload?.type)?.fromGuild;
}

/** A type row's damage type by name, or "every type" when it names none. */
const typeName = (payload) => (payload.category ? damageTypeLabel(payload.category) : 'every type');

/**
 * A fighter rule's number with its words: "10% more Fire damage", "a 5% Slash weakness", "5 more
 * crit chance". Null when it cannot be said.
 */
function fighterAmount(statement, names) {
    const payload = statement?.payload || {};
    const n = Number(payload.value) || 0;
    if (payload.type === EFFECT_TYPES.TYPE_DAMAGE) return `${Math.abs(n)}% ${n < 0 ? 'less' : 'more'} ${typeName(payload)} damage`;
    if (payload.type === EFFECT_TYPES.TYPE_RESIST) return n < 0 ? `a ${-n}% ${typeName(payload)} weakness` : `${n}% ${typeName(payload)} resistance`;
    const parts = effectParts(asGuildRule(statement), names);
    return parts ? `${parts.size} ${parts.after}`.trim() : null;
}

/** What a type row's fighters do, when it helps them and when it hinders them. */
function typePhrase(payload) {
    const type = typeName(payload);
    const helps = Number(payload.value) > 0;
    if (payload.type === EFFECT_TYPES.TYPE_DAMAGE) return helps ? `hit harder with ${type}` : `hit softer with ${type}`;
    return helps ? `take less from ${type}` : `take more from ${type}`;
}

/** Who a combat star's rule helps: "Melee fighter", or "hero" when it names no style. */
function styleSubject(statement) {
    const id = String(statement?.payload?.category || '').toLowerCase();
    return COMBAT_SKILL_IDS.includes(id) ? `${getSkill(id)?.name || id} fighter` : 'hero';
}

/** What a combat star's fighters do, by axis, when it helps them and when it hinders them. */
const STYLE_PHRASES = {
    [EFFECT_TYPES.DAMAGE]: ['hit harder', 'hit softer'],
    [EFFECT_TYPES.SWING_TIME]: ['attack faster', 'attack slower'],
    [EFFECT_TYPES.ACCURACY]: ['miss less', 'miss more'],
    [EFFECT_TYPES.DODGE]: ['dodge more', 'dodge less'],
    [EFFECT_TYPES.CRIT_CHANCE]: ['crit more often', 'crit less often']
};

/** Who a star's rule reaches, as a singular noun after "Every": "Forestry Token", "Logging Camp", "hero". */
function ruleSubject(statement, names) {
    const entry = getPaletteEntry(statement?.payload?.type);
    if (entry?.guildOnly || entry?.heroOrGuild) return 'hero';
    if (isFighterRule(statement)) return styleSubject(statement);
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
 * ("work faster"), `amount` its name and number ("Speed +6%"). Null for a rule that cannot be said
 * that way.
 */
function ruleEffect(statement, names, lapMs = null) {
    const payload = statement?.payload || {};
    if (payload.type === EFFECT_TYPES.PASSIVE_LAP) {
        // The Guild Hall is the subject, and the amount is the lap itself, not its percentage.
        return {
            phrase: 'lap',
            amount: `outputs every ${lengthText(lapMs ?? lapOfRule(statement))}`,
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
    if (payload.type === EFFECT_TYPES.LONG_LASTING_BREWS || payload.type === EFFECT_TYPES.STRONG_DRINK) {
        const parts = effectParts(asGuildRule(statement), names);
        if (!parts) return null;
        const kinds = doseKindsPhrase(payload.category);
        const down = Number(payload.value) < 0;
        const longer = payload.type === EFFECT_TYPES.LONG_LASTING_BREWS;
        // The kinds ride in the phrase, so a drinks rule and an elixirs rule of one size are two lines.
        return {
            phrase: longer ? `make ${kinds} last ${down ? 'less long' : 'longer'}` : `make ${kinds} ${down ? 'weaker' : 'stronger'}`,
            amount: effectHead(statement, names),
            sentence: longer
                ? `Every hero's ${kinds} last ${down ? 'less long' : 'longer'}.`
                : `The effects of every hero's ${kinds} are ${down ? 'weaker' : 'stronger'}.`
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
    if (payload.type === EFFECT_TYPES.TYPE_DAMAGE || payload.type === EFFECT_TYPES.TYPE_RESIST) {
        const amount = fighterAmount(statement, names);
        return amount ? { phrase: typePhrase(payload), amount } : null;
    }
    const parts = effectParts(asGuildRule(statement), names);
    if (!parts) return null;
    const style = STYLE_PHRASES[payload.type];
    if (style && isFighterRule(statement)) {
        const helps = (Number(payload.value) > 0) !== !!getPaletteEntry(payload.type)?.inverted;
        return { phrase: helps ? style[0] : style[1], amount: effectHead(statement, names) };
    }
    // The amount is the rule's lead, as its badge writes it ("Speed +6%"); the phrase says what it
    // does with no number, for the star's sentence ("works faster").
    const amount = effectHead(asGuildRule(statement), names);
    if (parts.before) return { phrase: `${parts.before} ${parts.after}`.trim(), amount };
    // An axis with no verb of its own reads "7% more yield": the star "gives more yield".
    const direction = parts.size.split(' ').pop();
    return { phrase: `give ${direction} ${parts.after}`.trim(), amount };
}

/** A rank's rules grouped by what they do, each with the subjects it reaches, in the rules' order. */
function effectGroups(record, names, lapMs = null) {
    const groups = [];
    for (const statement of record?.rules || []) {
        const effect = ruleEffect(statement, names, lapMs);
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
 * What a star does in one plain sentence with no numbers: what Bunk Beds or Bank Tabs does by id,
 * then what its first rank's rules and lines do ("Every Forestry Token works faster.").
 */
export function starSentence(def, names = hallNames()) {
    if (!def) return '';
    const own = BY_ID_SENTENCE[def.id];
    if (!def.star) return own || def.description || '';
    const first = rankOf(def.star, 1);
    if (!first) return own || def.description || '';
    const parts = effectGroups(first, names).map(g => g.sentence || `Every ${subjectsText(g.subjects)} ${singular(g.phrase)}.`);
    if (own) parts.unshift(own);
    if (first.lines.length) {
        parts.push(`The Guild Hall draws ${andList(first.lines.map(l => names.item(l.itemId)))} every lap, no hero needed.`);
    }
    if (def.star.opensRing) parts.push(RING_STAR_TEXT.sentence);
    return parts.join(' ') || def.description || '';
}

/**
 * What a star gives at a rank, as brief numbers ("6% faster", "2 Oak Wood", "3 heroes"), or null at
 * rank 0 (Bank Tabs says its one tab). A figure several rules share (Green Thumb's Oak and Fir) is
 * said once.
 */
export function starAmount(def, rank, names = hallNames()) {
    const r = Math.floor(Number(rank) || 0);
    if (!def) return null;
    const own = rankEffectLabel(def.id, r);
    if (r <= 0) return own;
    if (!def.star) return def.statLabel(r);
    const record = rankOf(def.star, r);
    if (!record) return own;
    const lapMs = record.rules.some(s => s?.payload?.type === EFFECT_TYPES.PASSIVE_LAP) ? lapWithRank(def.star, r) : null;
    const amounts = [...(own ? [own] : []), ...new Set(effectGroups(record, names, lapMs).map(g => g.amount))];
    for (const line of record.lines) amounts.push(`${line.quantity} ${names.item(line.itemId)}`);
    if (def.star.opensRing) amounts.push(RING_STAR_TEXT.amount);
    return amounts.join(', ') || null;
}
