import { KEYWORD, WHEN, getKeyword, statementsOf, effectEntryOf, firingChanceOf } from './statements.js';
import { statusBlockOf } from './effectLibrary.js';
import { MODIFIER_SHAPES } from '../../config/registries/modifierPalette.js';
import { getTriggerEvent, isFightMoment, everyOf, healthBelowOf } from '../../config/registries/triggerRegistry.js';
import { getRestrictionKind, limitOf } from '../../config/registries/restrictionPalette.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { getJob } from '../../config/registries/jobRegistry.js';
import { REACH, reachOf } from '../../config/registries/reachRegistry.js';
import { getRole } from '../../config/registries/roleRegistry.js';
import { filtersPhrase } from '../../config/registries/filterRegistry.js';
import { magnitudeParts, MAGNITUDE_KIND } from '../../config/registries/magnitudeRegistry.js';
import { getPlacement, placementOf } from '../../config/registries/placementRegistry.js';
import { EFFECT_TYPES } from './constants.js';
import { articleOf } from './toolNames.js';
import { stationKindLabel } from '../../config/registries/tokenConstants.js';

/**
 * The rules text: generated, read-only, and the only text a Token has. The sentence IS the
 * rule, rendered: one function used by the CMS editor, the CMS rules panel and the in-game
 * tooltip, so a wrong statement reads wrong (a flipped sign says "work 5% slower", an
 * unfinished one says "…").
 *
 * The renderer builds a list of segments, not a string. A segment is part of the sentence
 * itself, or IS a decision and names the editor slot it lives in (`slotsOf`). The string
 * everyone else reads is those segments joined, so the editor can never show a sentence the
 * game would not print.
 *
 * ⚠️ A word is tagged with a slot only if that statement's editor HAS that slot (a `Converts`
 * rule says "nearby" but has no reach to change, so there it is plain text).
 * `RenderSegments.test.js` holds every tag to that.
 *
 * ⚠️ The text is pinned byte for byte by `RenderGolden.test.js`. Change a word on purpose and
 * that golden must be regenerated and its diff read.
 */

/** Names, supplied by whoever is rendering — the registries, or the CMS store. */
const DEFAULT_NAMES = {
    token: id => id || 'a Token',
    item: id => id || 'an item',
    // A library effect's own title. Resolved by the caller for the same reason
    // Token and item names are: this module never reaches into a registry.
    effect: id => id || 'an effect'
};

/**
 * A run of text: a decision when `slot` is given, part of the sentence when it
 * is not. A falsy slot is deliberate and common — it is how a word stays plain
 * text on a keyword whose editor has no slot for it.
 */
const d = (text, slot) => (slot ? { text, slot } : { text });

/**
 * Flatten parts into segments. A part may be a string (sentence text), a
 * segment, a nested array of parts, or nothing at all.
 */
function segs(...parts) {
    const out = [];
    const walk = (part) => {
        if (part == null || part === false || part === '') return;
        if (Array.isArray(part)) { part.forEach(walk); return; }
        if (typeof part === 'string') { out.push({ text: part }); return; }
        if (part.text) out.push(part);
    };
    parts.forEach(walk);
    return out;
}

/**
 * Make a segment list clean enough to click, without changing a character.
 *
 * * Whitespace at either end of a decision moves out into the sentence, so what
 *   an author clicks is the word and only the word.
 * * Nearby runs of the same kind merge — two literals, or two pieces of one
 *   decision — so one run of text is one click target, never several.
 */
function tidy(list) {
    const split = [];
    for (const seg of list) {
        if (!seg.text) continue;
        if (!seg.slot) { split.push({ text: seg.text }); continue; }
        const lead = seg.text.match(/^\s*/)[0];
        const rest = seg.text.slice(lead.length);
        const trail = rest.match(/\s*$/)[0];
        const core = rest.slice(0, rest.length - trail.length);
        if (lead) split.push({ text: lead });
        if (core) split.push({ text: core, slot: seg.slot });
        if (trail) split.push({ text: trail });
    }
    const merged = [];
    for (const seg of split) {
        const prev = merged[merged.length - 1];
        if (prev && (prev.slot || null) === (seg.slot || null)) prev.text += seg.text;
        else merged.push({ ...seg });
    }
    return merged;
}

const textOf = (list) => list.map(s => s.text).join('');

/**
 * Split a phrase built by someone else around the value WE handed it.
 *
 * `reads.up(n)` and `restriction.sentence(payload, subject)` are templates owned
 * by their registries. Calling them with a marker instead of the real value
 * shows exactly where that value lands, so the words either side can be tagged
 * with no second copy of the template living here.
 *
 * ⚠️ If a template ever transforms its argument rather than placing it, the
 * marker will not appear and this returns null — the caller then keeps the
 * whole phrase as one decision, and the golden test catches any text change.
 */
const MARK = '\u0000';
function around(phrase) {
    const at = phrase.indexOf(MARK);
    if (at < 0 || phrase.indexOf(MARK, at + 1) >= 0) return null;
    return [phrase.slice(0, at), phrase.slice(at + 1)];
}

/**
 * Which target slots this statement's editor actually has.
 *
 * Read from `KEYWORDS` — the same declarations `slotsOf` reads — so a keyword
 * gains or loses clickable target words by changing its declaration, never by
 * editing this file.
 */
function targetSlots(statement) {
    const keyword = getKeyword(statement?.keyword);
    const mode = statement?.to?.mode;
    return {
        R: keyword?.reach ? 'reach' : null,
        M: keyword?.filter ? 'filterMode' : null,
        V: keyword?.filter && (mode === 'tag' || mode === 'id') ? 'filterValue' : null,
        F: keyword?.filter ? 'filters' : null
    };
}

/** The keyword's own slot — the verb — if the keyword is one the editor knows. */
const verbSlot = (statement) => (getKeyword(statement?.keyword) ? 'keyword' : null);

/** `0.05` → `5%`, `-0.05` → `5%` (the direction word carries the sign). */
function asPercent(value) {
    return `${Math.abs(Math.round(Number(value) * 1000) / 10)}%`;
}

/** A number effect's magnitude, in the words of the bucket it pushes into. */
function magnitude(entry, payload) {
    const value = Number(payload?.value) || 0;
    if (entry?.shape === MODIFIER_SHAPES.PROC) return `${Math.abs(value)}%`;
    switch (payload?.bucket) {
        case 'flat': return `${Math.abs(value)}`;
        case 'multiplier': return `×${Math.abs(value)}`;
        default: return asPercent(value);
    }
}

/**
 * "work 5% faster", "3 more armor", "a 25% chance of double loot".
 *
 * ⚠️ An axis owns how it reads, in both directions: it may declare `reads.up` and
 * `reads.down`, as every filter in `filterRegistry` owns its positive and negative wording.
 * Negating mechanically produced "a 10% failure chance" for a rule that removes failure.
 *
 * ⚠️ This keeps the sign on chance-shaped axes: `magnitude()` takes `Math.abs`, so a PROC
 * axis would render -25 and +25 identically. An axis with `reads` picks the wording by sign
 * before the size is absolute-valued.
 */
function effectSegments(statement, names) {
    const entry = effectEntryOf(statement);
    const payload = statement?.payload || {};
    if (!entry) return segs(d('…', 'type'));
    const size = magnitude(entry, payload);

    /**
     * ⚠️ `BONUS_DROP` names its item (read from the payload; `TriggerSystem` honours
     * `modifier.itemId`). Always a percentage, whatever bucket it was authored in: the value
     * IS a chance. The item and quantity have no slot here, so they stay plain text.
     */
    if (payload.type === EFFECT_TYPES.BONUS_DROP) {
        const qty = Math.max(1, Number(payload.quantity) || 1);
        const item = payload.itemId ? names.item(payload.itemId) : '…';
        return segs('a ', d(`${Math.abs(Number(payload.value) || 0)}%`, 'value'), ` chance to drop ${qty} ${item}`);
    }

    // "a 10% chance of double Raw Beef": the item is the narrowing, so it reads inside the phrase.
    if (payload.type === EFFECT_TYPES.DOUBLE_DROP) {
        const item = payload.category ? names.item(payload.category) : 'any item';
        return segs('a ', d(size, 'value'), ' chance of double ', d(item, categorySlot(statement)));
    }

    // "50% more bites of Dolphin": the fish is the narrowing, so it reads inside the phrase.
    if (payload.type === EFFECT_TYPES.CATCH_WEIGHT) {
        const fish = payload.category ? names.item(payload.category) : 'any fish';
        const more = Number(payload.value) < 0 ? 'fewer' : 'more';
        return segs(d(`${size} ${more}`, 'value'), ' ', d('bites', 'type'), ' of ', d(fish, categorySlot(statement)));
    }

    const label = entry.label.toLowerCase();
    const value = Number(payload.value);

    if (!value) return segs('no change to ', d(label, 'type'));

    if (entry.reads) {
        const read = value < 0 ? entry.reads.down : entry.reads.up;
        const parts = around(read(MARK));
        return parts
            ? segs(d(parts[0], 'type'), d(size, 'value'), d(parts[1], 'type'))
            : segs(d(read(size), 'type'));
    }

    if (entry.shape === MODIFIER_SHAPES.PROC) return segs('a ', d(size, 'value'), ' ', d(label, 'type'));
    // "5 more" is one click: the number and its direction are one decision, the
    // sign of the value.
    return segs(d(`${size} ${value < 0 ? 'less' : 'more'}`, 'value'), ' ', d(label, 'type'));
}

/**
 * "Coast Tokens" / "Forges" / "Tokens": the filter as a plural noun, with no preposition.
 * `Cannot` and `Applies` need the same set as the object of different prepositions, so the
 * noun is built once rather than by string surgery on another phrase.
 */
function subjectSegments(statement, names) {
    const { M, V } = targetSlots(statement);
    const to = statement?.to;
    if (!to || !to.mode || to.mode === 'all') return segs(d('Tokens', M));
    switch (to.mode) {
        case 'tag':
            return segs(d(to.value || '…', V), ' ', d('Tokens', M));
        case 'id':
            return segs(d(to.value ? names.token(to.value) : '…', V), ' ', d('Tokens', M));
        case 'tokenType':
            // Retired from the editor, so the value has no slot to open.
            return to.value ? segs(`${to.value} `, d('Tokens', M)) : segs(d('Tokens', M));
        default:
            return segs(d('Tokens', M));
    }
}

/**
 * "Coast Token" / "Kiln": the filter as a singular noun. Built separately because `Converts`
 * reaches exactly one destination, and de-pluralising the other would break on an irregular
 * plural.
 */
function singularSegments(statement, names) {
    const { M, V } = targetSlots(statement);
    const to = statement?.to;
    if (!to || !to.mode || to.mode === 'all') return segs(d('Token', M));
    switch (to.mode) {
        case 'tag':
            return segs(d(to.value || '…', V), ' ', d('Token', M));
        case 'id':
            // A Token's own name is already the specific thing — "the nearest
            // nearby Kiln", not "the nearest nearby Kiln Token".
            return segs(d(to.value ? names.token(to.value) : '…', V));
        case 'tokenType':
            return to.value ? segs(`${to.value} `, d('Token', M)) : segs(d('Token', M));
        default:
            return segs(d('Token', M));
    }
}

/** " tagged Wet and not being worked" — the stacked filters, one decision. */
function filterSegments(spec, names, slot) {
    return segs(d(filtersPhrase(spec, names), slot));
}

/**
 * "to nearby Coast Tokens": the reach frame, carrying the filter noun.
 *
 * ⚠️ Reach and filter are one phrase in words and two fields in data: rendering them
 * separately would give "to nearby Coast Tokens, on the board", which reads as two different
 * sets. In segments they stay distinguishable ("nearby" opens the reach, "Coast" the tag).
 *
 * ⚠️ The preposition is a parameter so the same frame can be a target or a SUBJECT; deriving
 * the subject by trimming "to " off the target would be string surgery on a sentence.
 */
function reachFrameSegments(statement, names, prep = 'to') {
    const { R, M, V } = targetSlots(statement);
    const P = prep ? `${prep} ` : '';
    const reach = reachOf(statement);
    const to = statement?.to;
    const untargeted = !to || !to.mode || to.mode === 'all';

    if (reach === REACH.SELF) {
        // A filter is meaningless here — there is one Token and the rule is on
        // it — so the words say the thing that is true and nothing more.
        return segs(P, d('this Token', R));
    }

    // ⚠️ "every" takes the SINGULAR — "every Coast Token", never "every Coast
    // Tokens" — so the board frame reaches for the singular noun even though
    // the set it names is a plural one.
    if (reach === REACH.BOARD) {
        return segs(P, d('every', R), ' ',
            untargeted ? d('Token', M) : singularSegments(statement, names), ' ', d('on the board', R));
    }

    if (reach === REACH.SELF_AND_NEARBY) {
        return untargeted
            ? segs(P, d('this Token and every nearby', R), ' ', d('Token', M))
            : segs(P, d('this Token and nearby', R), ' ', subjectSegments(statement, names));
    }

    // `nearby`: the default wording, left byte-for-byte identical on purpose.
    const everyNearby = segs(P, d('every', M), ' ', d('nearby', R), ' ', d('Token', M));
    if (untargeted) return everyNearby;
    switch (to.mode) {
        case 'tag':
            return to.value
                ? segs(P, d('nearby', R), ' ', d(to.value, V), ' ', d('Tokens', M))
                : segs(P, d('nearby', R), ' ', d('Tokens tagged', M), ' ', d('…', V));
        case 'id':
            return segs(P, d('any', M), ' ', d('nearby', R), ' ', d(to.value ? names.token(to.value) : '…', V));
        // Retired from the editor but still renderable, so old content reads as what it does.
        case 'tokenType':
            return to.value ? segs(P, d('nearby', R), ` ${to.value} `, d('Tokens', M)) : everyNearby;
        default:
            return everyNearby;
    }
}

/** "to every nearby Token being worked" — the frame plus its stacked filters. */
function targetSegments(statement, names, prep = 'to') {
    const { F } = targetSlots(statement);
    // ⚠️ Appended to whatever frame the reach chose, so "to every Coast Token on
    // the board" becomes "… on the board being worked" — one clause, not two
    // sentences stitched together.
    return segs(reachFrameSegments(statement, names, prep), filterSegments(statement?.to, names, F));
}

/**
 * "heroes on nearby Coast Tokens" — who a status lands on, carrying the reach.
 *
 * The `Applies` counterpart to the reach frame. It needs its own because the
 * preposition differs — a status lands *on people*, not *to Tokens* — and
 * because `self` collapses to a single person: the one working this very Token.
 */
function occupantSegments(statement, names) {
    const { R, M, F } = targetSlots(statement);
    const reach = reachOf(statement);
    const to = statement?.to;
    const untargeted = !to || !to.mode || to.mode === 'all';

    let frame;
    switch (reach) {
        case REACH.SELF:
            // Singular and specific: one Token holds at most one hero.
            frame = segs(d('the hero working this Token', R));
            break;
        case REACH.BOARD:
            // Singular after "every", same as the reach frame.
            frame = segs('heroes on ', d('every', R), ' ',
                untargeted ? d('Token', M) : singularSegments(statement, names), ' ', d('on the board', R));
            break;
        case REACH.SELF_AND_NEARBY:
            frame = untargeted
                ? segs(d('the hero working this Token and', R), ' heroes on ', d('every', M), ' ', d('nearby', R), ' ', d('Token', M))
                : segs(d('the hero working this Token and', R), ' heroes on ', d('nearby', R), ' ', subjectSegments(statement, names));
            break;
        default:
            frame = segs('heroes on ', d('nearby', R), ' ', subjectSegments(statement, names));
    }
    return segs(frame, filterSegments(statement?.to, names, F));
}

/**
 * ", but only for Mining work" — the skill narrowing, or nothing.
 *
 * A trailing clause rather than part of the filter phrase, because it narrows a
 * different thing: the filter says *which Tokens*, this says *which work on
 * them*. "+10% yield to nearby Coast Tokens, but only for Fishing work" is two
 * separate narrowings and reads as two.
 */
function skillScopeSegments(statement) {
    const category = statement?.payload?.category;
    if (!category) return [];
    // An item narrowing is already named inside the effect phrase ("a 10% chance of double Raw Beef").
    if (effectEntryOf(statement)?.categories === 'item') return [];
    const skill = getSkill(category);
    return segs(', but only for ', d(skill?.name || category, categorySlot(statement)), ' work');
}

/**
 * The `category` slot — but only on an axis whose editor offers one.
 *
 * ⚠️ `slotsOf` gives a `Provides` rule a category picker only when its palette
 * entry declares `categories`. `BONUS_DROP` and `CONVERT` declare none, so a
 * category authored on them still renders ("but only for Mining work") and is
 * still a word — just not one that can be clicked, because there is nothing for
 * it to open.
 */
const categorySlot = (statement) => (effectEntryOf(statement)?.categories ? 'category' : null);

/**
 * "the hero" — who a role-targeting statement acts on, in words.
 *
 * ⚠️ Deliberately the role's own label rather than a paraphrase. It is the same
 * phrase the editor offers and the same one `roleRegistry` defines, so the
 * sentence, the picker and the vocabulary all say one thing. A prettier synonym
 * here would read better in one sentence and be wrong in the next, because the
 * same role covers a hero harvesting a bush and a hero killing a monster.
 */
function roleSegments(statement) {
    const role = getRole(statement?.target?.role);
    const kw = getKeyword(statement?.keyword);
    const slot = kw?.targetsRole || kw?.optionalRole ? 'role' : null;
    return segs(d(role ? role.label : '…', slot));
}

/**
 * "nearby Coast Token" — the second, counted selector as a noun.
 *
 * ⚠️ Singular, because it follows "per": *"1 damage per nearby Coast Token"*.
 * The set it counts is plural; the thing each unit of damage is *per* is one of
 * them.
 */
function countedNounPhrase(statement, names) {
    const counted = statement?.counted;
    if (!counted) return '';
    const reach = counted.reach === REACH.BOARD ? 'Token on the board'
        : counted.reach === REACH.SELF ? 'this Token'
            : 'nearby Token';
    // ⚠️ The counted selector's FILTERS are honoured when the game counts matches, so the
    // sentence has to say them too, or the card over-promises.
    const filters = filtersPhrase(counted, names);
    if (!counted.mode || counted.mode === 'all') return `${reach}${filters}`;
    if (counted.mode === 'tag') {
        const noun = counted.value ? `nearby ${counted.value} Token` : 'nearby … Token';
        return `${noun}${filters}`;
    }
    const noun = counted.value ? `nearby ${names.token(counted.value)}` : 'nearby …';
    return `${noun}${filters}`;
}

/** "1 Coal and 2 Tin" — an item list with quantities. */
function itemList(entries, names) {
    if (!entries?.length) return '…';
    return entries
        .map(e => `${Math.max(1, e?.quantity || 1)} ${names.item(e?.itemId)}`)
        .join(' and ');
}

/**
 * "On Cycle" — the moment tag, with its parameter when it has one.
 *
 * ⚠️ The tag is printed as authored: no "When", no lowercasing. A tag is a label, not a
 * clause, so it keeps its capital and the sentence joins with a colon.
 */
function whenSegments(statement, names) {
    const when = statement?.when;
    if (!when?.event) return [];

    const keyword = getKeyword(statement?.keyword);
    const definition = getTriggerEvent(when.event);
    const label = definition?.label || when.event;

    // The moment is a slot only on keywords that take one; its detail (the item
    // watched, the threshold) is a slot whenever the moment itself is known.
    const momentSlot = keyword && keyword.when !== WHEN.NEVER ? 'moment' : null;
    const detail = keyword && definition;

    /**
     * ⚠️ Two moments carry a **parameter**, and the tag has to keep it. "On Bank
     * Holds" on its own names the picker rather than the rule — the whole point
     * of a threshold is the number and the item.
     */
    if (when.event === 'ITEM_THRESHOLD') {
        const item = when.watchItemId ? names.item(when.watchItemId) : '…';
        return segs(d(label, momentSlot), ' ',
            d(String(when.threshold || 1), detail && 'threshold'), ' ', d(item, detail && 'watchItem'));
    }
    if (definition?.needsItem) {
        return segs(d(label, momentSlot), ' ',
            d(when.watchItemId ? names.item(when.watchItemId) : '…', detail && 'watchItem'));
    }
    // "On Every 4th Swing": a counted fight moment says its count; every one is the plain tag.
    if (definition?.countNoun) {
        const every = everyOf(when);
        if (every <= 1) return segs(d(label, momentSlot));
        return segs(d('On Every', momentSlot), ' ', d(ordinal(every), detail && 'every'), ' ',
            d(definition.countNoun, momentSlot));
    }
    // "On Health Below 50%".
    if (definition?.needsPercent) {
        return segs(d(label, momentSlot), ' ', d(`${healthBelowOf(when)}%`, detail && 'belowPct'));
    }
    return segs(d(label, momentSlot));
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st. */
function ordinal(n) {
    const teen = n % 100 >= 11 && n % 100 <= 13;
    const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    return `${n}${suffix}`;
}

/** ", at most once every 5 seconds" — the cooldown, when there is one. */
function cooldownSegments(statement) {
    const ms = statement?.when?.cooldownMs;
    if (!ms) return [];
    // A fight moment has no cooldown (its own count is its rhythm), so a stray one is not said.
    if (isFightMoment(statement?.when?.event)) return [];
    const known = getKeyword(statement?.keyword) && getTriggerEvent(statement?.when?.event);
    return segs(', at most once every ', d(String(Math.round(ms / 100) / 10), known && 'cooldown'), ' seconds');
}

/**
 * "Consumes 1 Coal every 30 seconds." — upkeep, as its own sentence, so an ongoing drain on the
 * Bank is not buried at the tail of a rule about something else.
 *
 * Returns an empty string when there is no upkeep, so callers concatenate without checking.
 */
export function upkeepLine(statement, names = {}) {
    const resolve = { ...DEFAULT_NAMES, ...names };
    const upkeep = statement?.upkeep;
    if (!upkeep?.items?.length) return '';
    const every = Math.round((upkeep.cadenceMs || 0) / 100) / 10;
    return `Consumes ${itemList(upkeep.items, resolve)} every ${every} seconds.`;
}

/** A status a rule names by its effect id, in the author's words: its effect's name. */
const statusName = (effectId, names) => (effectId ? names.effect(effectId) : '…');

/** " — to the hero carrying this item, or on an enemy, to the hero fighting it" */
const COMBAT_REACH = ' — to the hero carrying this item, or on an enemy, to the hero fighting it';

/** The body of the sentence — keyword, payload, filter. */
function bodySegments(statement, names) {
    const payload = statement?.payload || {};
    const K = verbSlot(statement);

    switch (statement?.keyword) {
        case KEYWORD.PROVIDES: {
            /**
             * ⚠️ A combat axis does not reach nearby Tokens, so it must not say it does: `CombatFormulas`
             * reads these off a hero's aggregator, written only by an item (to the hero carrying it) or an
             * enemy (to the hero fighting it), where a filter has nothing to select.
             */
            const entry = effectEntryOf(statement);

            /**
             * ⚠️ An axis that owns its wording gets a target-FIRST sentence ("Works 20% faster"). "Makes ..."
             * is chosen to dodge number agreement: after "makes", English takes the bare infinitive, so a
             * singular or plural subject (depending on reach) never has to agree.
             */
            if (entry?.reads) {
                return segs(d('Makes', K), ' ', targetSegments(statement, names, ''), ' ', effectSegments(statement, names));
            }

            /**
             * ⚠️ Immunity is a switch, and its sentence says so: `STATUS_IMMUNITY` is read as `> 0`, so
             * "3 more status immunity" would be meaningless. The words name the status instead.
             */
            if (payload.type === EFFECT_TYPES.STATUS_IMMUNITY) {
                return segs(d('Provides', K), ' ', d('immunity to', 'type'), ' ',
                    d(statusName(payload.category, names), categorySlot(statement)), COMBAT_REACH);
            }

            // "Provides Poison stacks at most 1 lower": a cap is about one status, so it names it.
            if (payload.type === EFFECT_TYPES.STATUS_MAX_STACKS) {
                const shift = Number(payload.value) || 0;
                const change = shift < 0 ? `at most ${-shift} lower` : shift > 0 ? `up to ${shift} higher` : 'no different';
                return segs(d('Provides', K), ' ', d(statusName(payload.category, names), categorySlot(statement)), ' ',
                    d('stacks', 'type'), ' ', d(change, 'value'), COMBAT_REACH);
            }

            if (entry?.heroOnly) {
                return segs(d('Provides', K), ' ', effectSegments(statement, names), ' in combat', COMBAT_REACH);
            }
            return segs(d('Provides', K), ' ', effectSegments(statement, names), ' ',
                targetSegments(statement, names), skillScopeSegments(statement));
        }

        case KEYWORD.GRANTS: {
            const quantity = Math.max(1, payload.quantity || 1);
            const item = payload.itemId ? names.item(payload.itemId) : '…';
            const chance = payload.chance ?? 100;
            const odds = chance >= 100 ? [] : segs(', ', d(`${chance}%`, 'chance'), ' of the time');
            const moment = statement.when ? '' : ' when they finish work';
            return segs(d('Grants', K), ' ', d(String(quantity), 'quantity'), ' ', d(item, 'itemId'), ' ',
                targetSegments(statement, names), moment, odds);
        }

        case KEYWORD.STATION: {
            const skill = getSkill(payload.skill);
            const kind = payload.stationKind ? segs(': ', d(stationKindLabel(payload.stationKind), 'stationKind')) : [];
            return segs(d('Works as', K), ' a ', d(payload.skill ? (skill?.name || payload.skill) : '…', 'skill'), ' station', kind);
        }

        // "Promotes the hero to Knight." A job the registry no longer has keeps its id on screen
        // rather than vanishing.
        case KEYWORD.PROMOTES:
            return segs(d('Promotes', K), ' the hero to ',
                d(payload.jobId ? (getJob(payload.jobId)?.name || payload.jobId) : '…', 'jobId'));

        /**
         * ⚠️ Two wordings. The CMS editor passes no `tool` name and shows the tier as a number to
         * click; the player's text (`names.tool`, see `toolNames.js`) never says "tier": a tool's
         * place on the ladder shows in what requires it.
         */
        case KEYWORD.ACTS_AS:
            if (payload.tag && names.tool) {
                const tool = names.tool(payload.tag, 1);
                return segs(d('Acts as', K), ` ${articleOf(tool)} `, d(tool, 'tag'), ' for nearby stations');
            }
            return payload.tag
                ? segs(d('Acts as', K), ' a Tier ', d(String(payload.tier || 1), 'tier'), ' ', d(payload.tag, 'tag'), ' for nearby stations')
                : segs(d('Acts as', K), ' ', d('…', 'tag'), ' for nearby stations');

        case KEYWORD.REQUIRES: {
            if (payload.tokenIds?.length) {
                return segs(d('Requires', K), ` a nearby ${payload.tokenIds.map(names.token).join(' or ')}`);
            }
            if (payload.tag && names.tool) {
                const tool = names.tool(payload.tag, payload.minTier || 1);
                return segs(d('Requires', K), ' a nearby ', d(tool, 'tag'));
            }
            return payload.tag
                ? segs(d('Requires', K), ' a nearby Tier ', d(String(payload.minTier || 1), 'minTier'), ' ', d(payload.tag, 'tag'))
                : segs(d('Requires', K), ' a nearby ', d('…', 'tag'));
        }

        case KEYWORD.RESTOCKS:
            return segs(d('Restocks', K), ' nearby ',
                d(payload.tokenIds?.length ? payload.tokenIds.map(names.token).join(' and ') : '…', 'tokenIds'),
                ' from the Guild Bank');

        case KEYWORD.CONVERTS: {
            const exchange = segs(d('Converts', K), ' ', d(itemList(payload.consumes, names), 'payload'),
                ' into ', d(itemList(payload.produces, names), 'payload'));
            /**
             * ⚠️ "onto the nearest", singular and deliberate: a conversion's filter picks one destination,
             * so borrowing the reach frame's "to every nearby Token" would promise a broadcast the runtime
             * refuses. No filter reads as nothing, because landing on the Token that made it is the default.
             */
            const to = statement?.to;
            if (!to || !to.mode || to.mode === 'all') return exchange;
            return segs(exchange, ', onto the nearest nearby ', singularSegments(statement, names));
        }

        case KEYWORD.DEALS: {
            /**
             * ⚠️ The armour clause appears only when it is TRUE: damage respects armour by default, so
             * saying so on every rule would be noise.
             */
            const pierce = payload.ignoresArmor ? segs(', ', d('ignoring armour', 'ignoresArmor')) : [];
            /**
             * A computed magnitude says where its number came from:
             *
             *   flat   "deals 1 damage to the hero"
             *   stat   "deals damage equal to 10% of the hero's max HP to …"
             *   count  "deals 1 damage per nearby Coast Token to the hero"
             *
             * ⚠️ A count is NOT "equal to": the amount is per-match, so it keeps its place in front of
             * "damage".
             */
            const flat = Math.max(0, Number(payload.amount) || 0);
            let amount;
            if (payload.magnitude === MAGNITUDE_KIND.STAT) {
                const parts = magnitudeParts(payload);
                amount = segs(d('damage equal to', 'magnitude'), ' ', d(parts.amount, 'amount'), ' of ', d(parts.stat, 'stat'));
            } else if (payload.magnitude === MAGNITUDE_KIND.COUNT) {
                amount = segs(d(String(flat), 'amount'), ' damage ', d('per', 'magnitude'), ' ',
                    d(countedNounPhrase(statement, names) || '…', 'counted'));
            } else {
                amount = segs(d(String(flat), 'amount'), ' damage');
            }
            return segs(d('Deals', K), ' ', amount, ' to ', roleSegments(statement), pierce);
        }

        case KEYWORD.HEALS: {
            // ⚠️ `Heals` has an amount and nothing else to click: no magnitude,
            // stat or counted slot. So a computed heal keeps its number clickable
            // and says the rest as plain text.
            let amount;
            if (payload.magnitude === MAGNITUDE_KIND.STAT) {
                const parts = magnitudeParts(payload);
                amount = segs('health equal to ', d(parts.amount, 'amount'), ` of ${parts.stat}`);
            } else if (payload.magnitude === MAGNITUDE_KIND.COUNT) {
                amount = segs('health equal to per …');
            } else {
                amount = segs(d(String(Math.max(0, Number(payload.amount) || 0)), 'amount'), ' health');
            }
            return segs(d('Heals', K), ' ', amount, ' on ', roleSegments(statement));
        }

        case KEYWORD.RESTORES: {
            const n = Math.max(0, Number(payload.amount) || 0);
            return segs(d('Restores', K), ' ', d(String(n), 'amount'), ` ${n === 1 ? 'charge' : 'charges'} to `, roleSegments(statement));
        }

        case KEYWORD.REMOVES: {
            // ⚠️ A blank effect is the cure-all, and the sentence says which of
            // the two it is rather than leaving a bare "Removes …".
            const named = payload.effectId
                ? (names.effect ? names.effect(payload.effectId) : payload.effectId)
                : null;
            return segs(d('Removes', K), ' ', d(named || 'every lingering effect', 'effectId'), ' from ', roleSegments(statement));
        }

        case KEYWORD.SPAWNS: {
            const where = getPlacement(placementOf(payload));
            const what = segs(d(payload.typeId ? names.token(payload.typeId) : '…', 'typeId'),
                ' ', d(where ? where.label : '…', 'placement'));
            // A rule that rolls before it fires says so first: "a 5% chance to spawn …".
            const chance = firingChanceOf(statement);
            if (chance != null) return segs('A ', d(`${chance}%`, 'chance'), ' chance to ', d('spawn', K), ' ', what);
            return segs(d('Spawns', K), ' ', what);
        }

        case KEYWORD.TRANSFORMS:
            return segs(d('Transforms into', K), ' ', d(payload.typeId ? names.token(payload.typeId) : '…', 'typeId'));

        case KEYWORD.CANNOT: {
            // The wording belongs to the restriction kind, not to this switch,
            // so a second kind can read completely differently — "cannot be
            // placed in the outer ring", say — without this function growing a
            // branch per rule.
            const kind = getRestrictionKind(payload.kind);
            if (!kind) return segs(d('Cannot', K), ' ', d('…', 'kind'));
            const { F } = targetSlots(statement);
            const subject = segs(subjectSegments(statement, names), filterSegments(statement?.to, names, F));
            /**
             * The limit is its own word. The kind's template is filled with two markers (number, subject)
             * so "2" is clickable apart from the rest, with no second copy of the wording here.
             */
            if (kind.template) {
                const LIMIT = '\u0001';
                const pieces = [];
                let run = '';
                for (const ch of kind.template(LIMIT, MARK)) {
                    if (ch !== LIMIT && ch !== MARK) { run += ch; continue; }
                    if (run) pieces.push(d(run, 'kind'));
                    pieces.push(ch === LIMIT ? d(String(limitOf(payload)), 'max') : subject);
                    run = '';
                }
                if (run) pieces.push(d(run, 'kind'));
                return segs(d('Cannot', K), ' ', pieces);
            }
            const parts = around(kind.sentence(payload, MARK));
            return parts
                ? segs(d('Cannot', K), ' ', d(parts[0], 'kind'), subject, d(parts[1], 'kind'))
                : segs(d('Cannot', K), ' ', d(kind.sentence(payload, textOf(subject)), 'kind'));
        }

        case KEYWORD.APPLIES: {
            const chance = payload.chance ?? 100;
            const odds = chance >= 100 ? [] : segs(', ', d(`${chance}%`, 'chance'), ' of the time');

            /**
             * Aimed at a role instead of its filter: the role is the whole of who it reaches, so the
             * sentence names it and nothing else: "applies Poison to the enemy".
             */
            const byRole = !!statement?.target?.role;
            const who = () => (byRole ? roleSegments(statement) : occupantSegments(statement, names));

            /**
             * A library effect (a status included). With a duration it lingers, "for the fight" it
             * lasts until its fight ends, "for the swing" until the swing being made is over;
             * without any it fires immediately (chaining). A status's own lifetime is its effect's,
             * and the editor offers none of the three for one.
             */
            if (payload.effectId) {
                const title = names.effect ? names.effect(payload.effectId) : payload.effectId;
                const secs = Math.round((payload.durationMs || 0) / 100) / 10;
                const lasting = payload.forSwing
                    ? segs(' ', d('for the swing', 'forSwing'))
                    : payload.forFight
                        ? segs(' ', d('for the fight', 'forFight'))
                        : secs > 0 ? segs(' for ', d(String(secs), 'durationMs'), ' seconds') : [];
                return segs(d('Applies', K), ' ', d(title || '…', 'effectId'), ' to ', who(), lasting, odds);
            }

            /**
             * ⚠️ No effect named: half-authored, or a retired `statusId` from the old status engine,
             * which reaches nobody. It clicks through to the effect picker.
             */
            return segs(d('Applies', K), ' ', d('…', 'effectId'), ' to ', who());
        }

        default:
            return segs('Does nothing');
    }
}

/**
 * One statement, as the segments of its sentence: join the text for the sentence the game
 * prints; the `slot` on a segment names the decision that word is.
 *
 * @param {object} statement
 * @param {{token?: (id: string) => string, item?: (id: string) => string, effect?: (id: string) => string}} [names]
 * @returns {Array<{text: string, slot?: string}>}
 */
export function renderSegments(statement, names = {}) {
    const resolve = { ...DEFAULT_NAMES, ...names };
    const when = whenSegments(statement, resolve);
    const body = tidy(bodySegments(statement, resolve));

    /**
     * ⚠️ A colon, not a comma: "On Cycle, deals 1 damage" reads as a sentence missing its
     * subject; the colon says the tag is a label. The verb after it is lowered, one character,
     * never the whole word, so no proper noun is touched.
     */
    if (when.length && body.length) {
        body[0] = { ...body[0], text: body[0].text.charAt(0).toLowerCase() + body[0].text.slice(1) };
    }
    return tidy(segs(when, when.length ? ': ' : '', body, cooldownSegments(statement), '.'));
}

/**
 * One statement, as one sentence: the joined text of `renderSegments`.
 *
 *
 * @param {object} statement
 * @param {{token?: (id: string) => string, item?: (id: string) => string}} [names]
 */
export function renderStatement(statement, names = {}) {
    return textOf(renderSegments(statement, names));
}

/**
 * A Token's whole rules text, one sentence per line.
 *
 * `acceptedTokens` is rendered alongside the statements as Requires sentences: the field stays
 * where it is because it gates whether a station produces at all, so the author sees one
 * unified list and the engine sees no change.
 */
export function rulesLinesOf(def, names = {}) {
    const lines = [];
    // A status effect says first how it lasts and stacks: its rules below count once per stack.
    const status = statusLineOf(def);
    if (status) lines.push(status);
    for (const requirement of def?.acceptedTokens || []) {
        lines.push(renderStatement(
            { keyword: KEYWORD.REQUIRES, payload: requirement }, names
        ));
    }
    for (const statement of statementsOf(def)) {
        lines.push(renderStatement(statement, names));
        // Its own line, immediately under the rule it belongs to.
        const upkeep = upkeepLine(statement, names);
        if (upkeep) lines.push(upkeep);
    }
    return lines;
}

/**
 * A status effect's own line ("A status: stacks up to 3, its rules once per stack; lasts until the
 * fight ends."), or '' for an ordinary effect.
 */
export function statusLineOf(entry) {
    const block = statusBlockOf(entry);
    if (!block) return '';
    const stacking = block.stacks > 1
        ? `stacks up to ${block.stacks}, its rules once per stack`
        : 'does not stack (landing again renews it)';
    const lasting = block.ticks
        ? `lasts ${block.ticks} ${block.ticks === 1 ? 'tick' : 'ticks'}, never past the fight`
        : 'lasts until the fight ends';
    return `A status: ${stacking}; ${lasting}.`;
}

/** The rules text as one string — what gets written into `description`. */
export function rulesTextOf(def, names = {}) {
    return rulesLinesOf(def, names).join(' ');
}
