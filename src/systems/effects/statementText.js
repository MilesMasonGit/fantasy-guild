// Fantasy Guild — statements rendered in words (effect authoring redesign, Phase 1)

import { KEYWORD, statementsOf, effectEntryOf } from './statements.js';
import { MODIFIER_SHAPES } from '../../config/registries/modifierPalette.js';
import { getTriggerEvent } from '../../config/registries/triggerRegistry.js';
import { getRestrictionKind } from '../../config/registries/restrictionPalette.js';
import { getStatusEffect } from '../../config/registries/statusRegistry.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { REACH, reachOf } from '../../config/registries/reachRegistry.js';

/**
 * The rules text — **generated, read-only, and the only text a Token has**.
 *
 * ## Why there is no hand-written description any more (owner decision, Q3)
 * The old generator read `mod.axis`, `mod.isPercent`, `block.convert` and
 * `block.bonusDrop` — four fields that have never existed. Every number effect
 * came out as "Speed", every item effect came out as `NaN%`, and the Forge
 * Altar's saved description said its Work Time buff made neighbours *faster*
 * when the authored value made them 20% slower. A description that can say the
 * opposite of the effect is worse than none.
 *
 * So the sentence is not a description *of* the rule — it **is** the rule,
 * rendered. One function, used by the CMS editor, the CMS rules panel and the
 * in-game tooltip, so there is nothing left for them to disagree about.
 *
 * ## The validation loop
 * Because the words come from the statement, a wrong statement reads wrong:
 * a flipped sign says "5% **more** work time", a tag typo says "adjacent
 * **Coste** tokens", an unfinished statement says "…" where the blank is. You
 * catch it by reading the card, which is the thing you were going to do anyway.
 */

/** Names, supplied by whoever is rendering — the registries, or the CMS store. */
const DEFAULT_NAMES = {
    token: id => id || 'a Token',
    item: id => id || 'an item'
};

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
 * "5% less work time".
 *
 * ⚠️ **Literal, never interpretive.** It would read more naturally as "5%
 * faster", but "faster" is a judgement about which direction is good and the
 * palette only knows which axis runs backwards, not what the author meant. The
 * editor puts the friendly reading beside the picker (where `inverted` says
 * "less work time — a buff"); the sentence stays plain so it cannot flatter a
 * mistake.
 */
function effectPhrase(statement) {
    const entry = effectEntryOf(statement);
    const payload = statement?.payload || {};
    if (!entry) return '…';
    const size = magnitude(entry, payload);
    const label = entry.label.toLowerCase();
    if (entry.shape === MODIFIER_SHAPES.PROC) return `a ${size} ${label}`;
    const direction = Number(payload.value) < 0 ? 'less' : 'more';
    if (!Number(payload.value)) return `no change to ${label}`;
    return `${size} ${direction} ${label}`;
}

/**
 * "to adjacent Coast Tokens" — the filter clause, carrying the reach.
 *
 * ## ⚠️ Reach and filter are one phrase in words and two fields in data
 * The sentence has to fuse them, because English does: *"to every Coast Token on
 * the board"* is one clause built from `reach: board` and `to: {tag: Coast}`.
 * Rendering them separately would produce "to adjacent Coast Tokens, on the
 * board", which is not a sentence and, worse, reads as two different sets.
 *
 * So the reach picks the frame and the filter fills the noun. The frame for
 * `self` deliberately drops "adjacent" and every plural, because it names
 * exactly one Token — the one carrying the rule.
 */
function filterPhrase(statement, names) {
    const reach = reachOf(statement);
    const noun = subjectPhrase(statement, names);
    const to = statement?.to;
    const untargeted = !to || !to.mode || to.mode === 'all';

    if (reach === REACH.SELF) {
        // A filter is meaningless here — there is one Token and the rule is on
        // it — so the words say the thing that is true and nothing more.
        return 'to this Token';
    }

    // ⚠️ "every" takes the SINGULAR — "every Coast Token", never "every Coast
    // Tokens" — so the board frame reaches for the singular noun even though
    // the set it names is a plural one.
    if (reach === REACH.BOARD) {
        return `to every ${untargeted ? 'Token' : singularSubjectPhrase(statement, names)} on the board`;
    }

    if (reach === REACH.SELF_AND_ADJACENT) {
        return untargeted
            ? 'to this Token and every adjacent Token'
            : `to this Token and adjacent ${noun}`;
    }

    // `adjacent` — the default, and the wording every rule authored before P2
    // has always produced. Left byte-for-byte identical on purpose.
    if (untargeted) return 'to every adjacent Token';
    switch (to.mode) {
        case 'tag':
            return to.value ? `to adjacent ${to.value} Tokens` : 'to adjacent Tokens tagged …';
        case 'id':
            return to.value ? `to any adjacent ${names.token(to.value)}` : 'to any adjacent …';
        // Retired from the editor (Q2) but still renderable, so old content
        // reads as what it does rather than as a blank.
        case 'tokenType':
            return to.value ? `to adjacent ${to.value} Tokens` : 'to every adjacent Token';
        default:
            return 'to every adjacent Token';
    }
}

/**
 * "Coast Tokens" / "Forges" / "Tokens" — the filter as a **noun**, with no
 * preposition in front of it.
 *
 * `filterPhrase` above bakes in "to …", which reads correctly for a statement
 * that *reaches* neighbours. `Cannot` and `Applies` need the same set of
 * Tokens as the object of a different preposition — "adjacent **to** more than
 * 2 Coast Tokens", "heroes **on** adjacent Coast Tokens" — so the noun is
 * built once here rather than by string-surgery on the other phrase.
 */
function subjectPhrase(statement, names) {
    const to = statement?.to;
    if (!to || !to.mode || to.mode === 'all') return 'Tokens';
    switch (to.mode) {
        case 'tag':
            return to.value ? `${to.value} Tokens` : '… Tokens';
        case 'id':
            return to.value ? `${names.token(to.value)} Tokens` : '… Tokens';
        case 'tokenType':
            return to.value ? `${to.value} Tokens` : 'Tokens';
        default:
            return 'Tokens';
    }
}

/**
 * "Coast Token" / "Kiln" — the filter as a **singular** noun.
 *
 * `subjectPhrase` above is plural because every other filtered keyword reaches a
 * set. `Converts` reaches exactly one destination (ER-14), and "onto the nearest
 * adjacent Kiln Tokens" is not a sentence. Built separately rather than by
 * de-pluralising the other one, because "Tokens"→"Token" is a string trick that
 * would break the moment a filter names something whose plural is irregular.
 */
function singularSubjectPhrase(statement, names) {
    const to = statement?.to;
    if (!to || !to.mode || to.mode === 'all') return 'Token';
    switch (to.mode) {
        case 'tag':
            return to.value ? `${to.value} Token` : '… Token';
        case 'id':
            // A Token's own name is already the specific thing — "the nearest
            // adjacent Kiln", not "the nearest adjacent Kiln Token".
            return to.value ? names.token(to.value) : '…';
        case 'tokenType':
            return to.value ? `${to.value} Token` : 'Token';
        default:
            return 'Token';
    }
}

/**
 * "heroes on adjacent Coast Tokens" — who a status lands on, carrying the reach.
 *
 * The `Applies` counterpart to `filterPhrase`. It needs its own because the
 * preposition differs — a status lands *on people*, not *to Tokens* — and
 * because `self` collapses to a single person: the one working this very Token.
 */
function occupantPhrase(statement, names) {
    const reach = reachOf(statement);
    const noun = subjectPhrase(statement, names);
    const to = statement?.to;
    const untargeted = !to || !to.mode || to.mode === 'all';

    switch (reach) {
        case REACH.SELF:
            // Singular and specific: one Token holds at most one hero.
            return 'the hero working this Token';
        case REACH.BOARD:
            // Singular after "every", same as `filterPhrase`.
            return `heroes on every ${untargeted ? 'Token' : singularSubjectPhrase(statement, names)} on the board`;
        case REACH.SELF_AND_ADJACENT:
            return untargeted
                ? 'the hero working this Token and heroes on every adjacent Token'
                : `the hero working this Token and heroes on adjacent ${noun}`;
        default:
            return `heroes on adjacent ${noun}`;
    }
}

/** "1 Coal every 30 seconds" — an item list with quantities. */
function itemList(entries, names) {
    if (!entries?.length) return '…';
    return entries
        .map(e => `${Math.max(1, e?.quantity || 1)} ${names.item(e?.itemId)}`)
        .join(' and ');
}

/** "When a neighbour completes a cycle," — the trigger clause. */
function whenPhrase(statement, names) {
    const when = statement?.when;
    if (!when?.event) return '';
    if (when.event === 'ITEM_THRESHOLD') {
        const item = when.watchItemId ? names.item(when.watchItemId) : '…';
        return `When the Bank holds at least ${when.threshold || 1} ${item}`;
    }
    const definition = getTriggerEvent(when.event);
    // A trigger that names an item reads better with the item in the clause
    // than with a generic label — "when a neighbour produces Copper Ore" says
    // the rule; "when a neighbour produces a specific item" says the picker.
    if (definition?.needsItem) {
        const item = when.watchItemId ? names.item(when.watchItemId) : '…';
        return `When a neighbour produces ${item}`;
    }
    return `When ${(definition?.label || when.event).toLowerCase()}`;
}

/** ", at most once every 5 seconds" — the cooldown, when there is one. */
function cooldownPhrase(statement) {
    const ms = statement?.when?.cooldownMs;
    if (!ms) return '';
    return `, at most once every ${Math.round(ms / 100) / 10} seconds`;
}

/** ", costing 1 Coal every 30 seconds" — the upkeep clause. */
function upkeepPhrase(statement, names) {
    const upkeep = statement?.upkeep;
    if (!upkeep?.items?.length) return '';
    const every = Math.round((upkeep.cadenceMs || 0) / 100) / 10;
    return `, costing ${itemList(upkeep.items, names)} every ${every} seconds`;
}

/** The body of the sentence — keyword, payload, filter. */
function bodyOf(statement, names) {
    const payload = statement?.payload || {};
    switch (statement?.keyword) {
        case KEYWORD.PROVIDES: {
            /**
             * ⚠️ A combat axis does not reach adjacent Tokens, so it must not
             * say it does (Unified Effects P7).
             *
             * `CombatFormulas` reads these off a **hero's** aggregator, and only
             * two things write there: an item, which lends its numbers to the
             * hero carrying it, and an enemy, which lends them to the hero
             * fighting it. A filter has nothing to select between in either
             * case, and "to every adjacent Token" would be false in both.
             *
             * A plain Token carrying one of these reaches nobody at all —
             * `ContentAudit` says so by name at boot rather than letting it look
             * like it works.
             */
            const entry = effectEntryOf(statement);
            if (entry?.group === 'Combat') {
                return `Provides ${effectPhrase(statement)} in combat — to the hero carrying this item, `
                    + `or on an enemy, to the hero fighting it`;
            }
            return `Provides ${effectPhrase(statement)} ${filterPhrase(statement, names)}`;
        }

        case KEYWORD.GRANTS: {
            const quantity = Math.max(1, payload.quantity || 1);
            const item = payload.itemId ? names.item(payload.itemId) : '…';
            const chance = payload.chance ?? 100;
            const odds = chance >= 100 ? '' : `, ${chance}% of the time`;
            const moment = statement.when ? '' : ' when they finish work';
            return `Grants ${quantity} ${item} ${filterPhrase(statement, names)}${moment}${odds}`;
        }

        case KEYWORD.STATION: {
            const skill = getSkill(payload.skill);
            return payload.skill
                ? `Works as a ${skill?.name || payload.skill} station`
                : 'Works as a … station';
        }

        case KEYWORD.ACTS_AS:
            return payload.tag
                ? `Acts as a Tier ${payload.tier || 1} ${payload.tag} for adjacent stations`
                : 'Acts as … for adjacent stations';

        case KEYWORD.REQUIRES: {
            if (payload.tokenIds?.length) {
                return `Requires an adjacent ${payload.tokenIds.map(names.token).join(' or ')}`;
            }
            return payload.tag
                ? `Requires an adjacent Tier ${payload.minTier || 1} ${payload.tag}`
                : 'Requires an adjacent …';
        }

        case KEYWORD.RESTOCKS:
            return payload.tokenIds?.length
                ? `Restocks adjacent ${payload.tokenIds.map(names.token).join(' and ')} from the Guild Bank`
                : 'Restocks adjacent … from the Guild Bank';

        case KEYWORD.CONVERTS: {
            const exchange = `Converts ${itemList(payload.consumes, names)} into ${itemList(payload.produces, names)}`;
            /**
             * ⚠️ **"onto the nearest", singular and deliberate** (ER-14).
             *
             * A conversion's filter picks one destination rather than a set, so
             * the sentence must not borrow `filterPhrase`'s "to every adjacent
             * Token" — that would promise a broadcast the runtime refuses to
             * do, which is the exact class of lie P1 exists to remove.
             *
             * No filter reads as nothing at all, because the output landing on
             * the Token that made it (D-40) is the unremarkable default and
             * every yield in the game already behaves that way.
             */
            const to = statement?.to;
            if (!to || !to.mode || to.mode === 'all') return exchange;
            return `${exchange}, onto the nearest adjacent ${singularSubjectPhrase(statement, names)}`;
        }

        case KEYWORD.CANNOT: {
            // The wording belongs to the restriction kind, not to this switch,
            // so a second kind can read completely differently — "cannot be
            // placed in the outer ring", say — without this function growing a
            // branch per rule.
            const kind = getRestrictionKind(payload.kind);
            if (!kind) return 'Cannot …';
            return `Cannot ${kind.sentence(payload, subjectPhrase(statement, names))}`;
        }

        case KEYWORD.APPLIES: {
            // ⚠️ **This sentence must be literally true.** A filter selects
            // Tokens; a status lands on a person. The only honest reading of
            // "adjacent Coast Tokens" for a status is *the heroes working
            // them*, so the sentence says exactly that rather than leaving the
            // reader to guess which of the two it meant.
            const status = getStatusEffect(payload.statusId);
            if (!status) return `Applies … to ${occupantPhrase(statement, names)}`;
            const stacks = Math.max(1, payload.stacks || 1);
            const amount = stacks > 1 ? `${stacks} stacks of ${status.name}` : status.name;
            const chance = payload.chance ?? 100;
            const odds = chance >= 100 ? '' : `, ${chance}% of the time`;
            // Untriggered, this is the same moment `Grants` uses: the neighbour
            // finishing a cycle is the only ambient instant a status could land
            // on the person who was working it.
            const moment = statement.when ? '' : ' when they finish work';

            /**
             * ⚠️ An item-borne `Applies` names its target and says so (UE-24).
             *
             * An item has one hero, so there is no filter and nothing to select
             * between — except the one choice that is real: the person carrying
             * it, or the creature they are fighting. The sentence has to say
             * which, because "Applies Poison" alone would be true of two
             * opposite rules.
             */
            if (payload.target === 'enemy') {
                return `Applies ${amount} to the enemy its hero is fighting${odds}`;
            }
            if (payload.target === 'hero') {
                return `Applies ${amount} to the hero carrying it${moment}${odds}`;
            }

            return `Applies ${amount} to ${occupantPhrase(statement, names)}${moment}${odds}`;
        }

        default:
            return 'Does nothing';
    }
}

/**
 * One statement, as one sentence.
 *
 * @param {object} statement
 * @param {{token?: (id: string) => string, item?: (id: string) => string}} [names]
 */
export function renderStatement(statement, names = {}) {
    const resolve = { ...DEFAULT_NAMES, ...names };
    const when = whenPhrase(statement, resolve);
    const body = bodyOf(statement, resolve);
    const sentence = when ? `${when}, ${body[0].toLowerCase()}${body.slice(1)}` : body;
    return `${sentence}${cooldownPhrase(statement)}${upkeepPhrase(statement, resolve)}.`;
}

/**
 * A Token's whole rules text, one sentence per line.
 *
 * `acceptedTokens` is rendered alongside the statements as *Requires* sentences
 * (owner decision Q5: the field stays exactly where it is — it gates whether a
 * station produces at all, and moving it was the one change with a real chance
 * of silently stopping production). The author sees one unified list; the engine
 * sees no change.
 */
export function rulesLinesOf(def, names = {}) {
    const lines = [];
    for (const requirement of def?.acceptedTokens || []) {
        lines.push(renderStatement(
            { keyword: KEYWORD.REQUIRES, payload: requirement }, names
        ));
    }
    for (const statement of statementsOf(def)) {
        lines.push(renderStatement(statement, names));
    }
    return lines;
}

/** The rules text as one string — what gets written into `description`. */
export function rulesTextOf(def, names = {}) {
    return rulesLinesOf(def, names).join(' ');
}
