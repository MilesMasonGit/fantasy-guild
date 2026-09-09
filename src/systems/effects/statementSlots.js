// Fantasy Guild — a statement as an ordered list of slots (Effects Grammar v2, V3)

import { KEYWORD, KEYWORDS, WHEN, getKeyword, paletteForKeyword, makeStatement } from './statements.js';
import { TRIGGER_EVENTS, getTriggerEvent, rolesOf } from '../../config/registries/triggerRegistry.js';
import { ROLES, getRole } from '../../config/registries/roleRegistry.js';
import { REACHES, reachOf, getReach } from '../../config/registries/reachRegistry.js';
import {
    TARGET_MODES, getPaletteEntry, bucketsFor, describeModifierDirection
} from '../../config/registries/modifierPalette.js';
import { getStatusEffect, authorableStatuses } from '../../config/registries/statusRegistry.js';
import { RESTRICTION_KINDS, getRestrictionKind } from '../../config/registries/restrictionPalette.js';
import { FILTER_KINDS, filtersOf } from '../../config/registries/filterRegistry.js';
import { MAGNITUDE_KIND, statsForRoles } from '../../config/registries/magnitudeRegistry.js';

/**
 * A statement, described as the **ordered slots an author fills in** — the model
 * behind the sentence editor.
 *
 * ## Why this exists (G-18)
 * The CMS used to ask for a rule through nested dropdowns: pick a keyword, then
 * a payload, then a target, then a trigger, each in its own labelled box. The
 * owner asked for the opposite — *"I write the rules text with support, and it
 * builds the effect from that"* — which needs one thing the editor never had: a
 * description of **what may go where**, in the order the sentence says it.
 *
 * That is what this is. Each slot knows its vocabulary, its current value, and
 * how to write itself back into the statement. Typing filters a slot's options;
 * choosing one produces a patch.
 *
 * ## ⚠️ There is no parser, and this is not one
 * The statement object stays the editor's state and `statementText` stays the
 * one renderer. A slot never parses text into meaning — it offers **declared
 * options** and hands back the one that was picked. So an invalid rule remains
 * unwritable, exactly as it was with dropdowns, and no inverse of
 * `renderStatement` has to exist or be maintained.
 *
 * ## ⚠️ Slots are the EDITABLE parts, not every word
 * "When", "deals", "damage to" and the rest of the connective tissue belong to
 * the sentence, and the sentence is rendered by `statementText` as it always
 * was. A slot is a decision an author makes. Keeping the two apart is what stops
 * this file becoming a second renderer that can disagree with the first.
 *
 * ## ⭐ Legality is read from the same declarations the game reads
 * `KEYWORDS` says which keywords take a trigger, a filter, a reach.
 * `TRIGGER_EVENTS` says which moments a scope allows and which roles each
 * supplies (G-2). `REACHES`, `TARGET_MODES`, the palette and the status registry
 * supply the rest. **Adding a row to any of them puts it in the editor with no
 * editor change** — the same game-defines / CMS-renders split every other
 * vocabulary here already uses.
 */

/** What kind of control a slot needs. */
export const SLOT_KIND = Object.freeze({
    /** Pick one of a declared list. The typing-and-autocomplete case. */
    VOCABULARY: 'vocabulary',
    /** A number typed straight in — a magnitude, a duration, a count. */
    NUMBER: 'number',
    /** On or off. */
    FLAG: 'flag',
    /** A free string with suggestions — a tag, which authors invent. */
    TEXT: 'text',
    /**
     * A payload the sentence cannot hold: a conversion's two item lists, a
     * restock list. G-20 keeps these as a small form beneath the sentence,
     * because a five-item conversion written out inline stops being a sentence.
     */
    FORM: 'form',
    /** A stack of filters, each with its own value and a negate toggle. */
    FILTERS: 'filters'
});

/** A vocabulary option, in the shape every picker wants. */
const option = (id, label, hint = '') => ({ id, label, hint });

/**
 * Which moments a statement may legally name.
 *
 * ⚠️ A keyword that cannot carry a trigger gets none — `KEYWORDS` declares that,
 * and offering one anyway is the "authored but inert" failure the grammar exists
 * to prevent.
 */
function momentOptions() {
    return TRIGGER_EVENTS.map(t => option(t.id, t.label, t.hint));
}

/**
 * Which roles this statement may act on — **G-2, at the point of authoring**.
 *
 * The moment decides. Pick *"a neighbour runs out of charges"* and "the actor"
 * is simply not here, because nobody acted: a Token ran dry.
 */
function roleOptions(statement) {
    const available = rolesOf(statement?.when?.event);
    return ROLES.filter(r => available.includes(r.id)).map(r => option(r.id, r.label, r.hint));
}

/** The payload slots for one keyword. Each returns `[]` where it has none. */
function payloadSlots(statement, ctx) {
    const payload = statement?.payload || {};

    switch (statement?.keyword) {
        case KEYWORD.DEALS: {
            const available = rolesOf(statement?.when?.event);
            return [
                {
                    id: 'amount', kind: SLOT_KIND.NUMBER, label: 'damage',
                    value: payload.amount ?? 1, min: 0,
                    patch: v => ({ payload: { ...payload, amount: Math.max(0, Number(v) || 0) } })
                },
                {
                    id: 'magnitude', kind: SLOT_KIND.VOCABULARY, label: 'measured as',
                    value: payload.magnitude || MAGNITUDE_KIND.FLAT,
                    options: [
                        option(MAGNITUDE_KIND.FLAT, 'a flat amount', 'The number, as typed.'),
                        option(MAGNITUDE_KIND.STAT, 'a percentage of a stat', 'Scales with the target, so it stays relevant as heroes grow.'),
                        option(MAGNITUDE_KIND.COUNT, 'per matching Token', 'The number, once for each thing the second filter matches.')
                    ],
                    patch: v => ({ payload: { ...payload, magnitude: v } })
                },
                /**
                 * ⚠️ G-2 reaches the magnitude vocabulary too: a stat about the
                 * actor is not offered on a moment that has no actor.
                 */
                ...(payload.magnitude === MAGNITUDE_KIND.STAT ? [{
                    id: 'stat', kind: SLOT_KIND.VOCABULARY, label: 'of what',
                    value: payload.stat || '',
                    options: statsForRoles(available).map(st => option(st.id, st.label, st.hint)),
                    patch: v => ({ payload: { ...payload, stat: v } })
                }] : []),
                ...(payload.magnitude === MAGNITUDE_KIND.COUNT ? [{
                    id: 'counted', kind: SLOT_KIND.FILTERS, label: 'counting',
                    value: filtersOf(statement?.counted),
                    options: FILTER_KINDS.map(f => option(f.id, f.label, f.hint)),
                    patch: v => ({ counted: { ...(statement.counted || { mode: 'all', value: '' }), filters: v } })
                }] : []),
                {
                    id: 'ignoresArmor', kind: SLOT_KIND.FLAG, label: 'ignores armour',
                    value: !!payload.ignoresArmor,
                    hint: 'Armour normally reduces this, and heavy armour can stop it entirely.',
                    patch: v => ({ payload: { ...payload, ignoresArmor: !!v } })
                }
            ];
        }

        case KEYWORD.PROVIDES: {
            const entry = getPaletteEntry(payload.type);
            return [
                {
                    id: 'type', kind: SLOT_KIND.VOCABULARY, label: 'effect',
                    value: payload.type,
                    options: paletteForKeyword(KEYWORD.PROVIDES).map(p => option(p.type, p.label, p.hint)),
                    patch: v => ({ payload: { ...payload, type: v } })
                },
                {
                    id: 'bucket', kind: SLOT_KIND.VOCABULARY, label: 'how it combines',
                    value: payload.bucket || 'percentage',
                    options: bucketsFor(entry).map(b => option(
                        b,
                        b === 'percentage' ? 'a percentage' : b === 'flat' ? 'a flat amount' : 'a multiplier',
                        b === 'percentage' ? '5 means +5%.' : b === 'flat' ? '5 means +5.' : '1.5 means ×1.5.'
                    )),
                    patch: v => ({ payload: { ...payload, bucket: v } })
                },
                {
                    id: 'value', kind: SLOT_KIND.NUMBER, label: 'amount',
                    value: payload.value ?? 0,
                    /**
                     * ⚠️ The buff-or-penalty reading, which the sign alone does
                     * not give. `+5%` on Yield is a gift and `+5%` on Work Time
                     * is a punishment, because Work Time is milliseconds per
                     * cycle. The palette knows which axes run backwards; without
                     * saying so the author has to remember, which is exactly
                     * what `inverted` exists to stop.
                     */
                    note: describeModifierDirection(entry, payload.value, payload.bucket)?.text,
                    patch: v => ({ payload: { ...payload, value: Number(v) || 0 } })
                },
                ...(entry?.categories ? [{
                    // ⚠️ Optional: an unset skill scope means "any", which is the
                    // normal case. Without saying so the editor paints it as a
                    // blank that needs filling, and every ordinary rule looks
                    // half-finished.
                    id: 'category', kind: SLOT_KIND.VOCABULARY, label: 'only for', optional: true,
                    value: payload.category || '',
                    options: entry.categories === 'status'
                        ? authorableStatuses().map(s => option(s.id, s.name, s.description))
                        : [],
                    patch: v => ({ payload: { ...payload, ...(v ? { category: v } : {}) } })
                }] : [])
            ];
        }

        case KEYWORD.HEALS:
        case KEYWORD.RESTORES:
            return [{
                id: 'amount', kind: SLOT_KIND.NUMBER,
                label: statement.keyword === KEYWORD.HEALS ? 'health' : 'charges',
                value: payload.amount ?? 1, min: 0,
                patch: v => ({ payload: { ...payload, amount: Math.max(0, Number(v) || 0) } })
            }];

        case KEYWORD.REMOVES:
            return [{
                id: 'effectId', kind: SLOT_KIND.VOCABULARY, label: 'which effect', optional: true,
                value: payload.effectId || '',
                options: Object.values(ctx?.effects || {}).map(e => option(e.id, e.name || e.id)),
                note: !payload.effectId ? 'Leave it blank to clear every lingering effect.' : null,
                patch: v => ({ payload: { ...payload, effectId: v } })
            }];

        case KEYWORD.APPLIES:
            /**
             * ⚠️ **Two shapes during V6.** A `statusId` is the old status path
             * and still edits as it did; an `effectId` attaches a live library
             * effect for a while, which is the shape that makes the status
             * registry deletable. V7 removes the first half.
             */
            if (payload.statusId) {
                return [
                    {
                        id: 'statusId', kind: SLOT_KIND.VOCABULARY, label: 'status',
                        value: payload.statusId,
                        options: authorableStatuses().map(s => option(s.id, s.name, s.description)),
                        patch: v => ({ payload: { ...payload, statusId: v } })
                    },
                    {
                        id: 'stacks', kind: SLOT_KIND.NUMBER, label: 'stacks',
                        value: payload.stacks ?? 1, min: 1,
                        patch: v => ({ payload: { ...payload, stacks: Math.max(1, Number(v) || 1) } })
                    }
                ];
            }
            return [
                {
                    id: 'effectId', kind: SLOT_KIND.VOCABULARY, label: 'effect',
                    value: payload.effectId || '',
                    options: Object.values(ctx?.effects || {}).map(e => option(e.id, e.name || e.id)),
                    patch: v => ({ payload: { ...payload, effectId: v } })
                },
                {
                    id: 'scale', kind: SLOT_KIND.NUMBER, label: 'tier', min: 1,
                    value: payload.scale ?? 1,
                    patch: v => ({ payload: { ...payload, scale: Math.max(1, Number(v) || 1) } })
                },
                {
                    /**
                     * ⭐ Zero means **fire it once, now** — which is how chaining
                     * works (G-17). One verb, both shapes, no new concept for
                     * combos.
                     */
                    id: 'durationMs', kind: SLOT_KIND.NUMBER, label: 'for (ms)', min: 0, optional: true,
                    value: payload.durationMs ?? 0,
                    note: !payload.durationMs
                        ? 'Zero means it fires once, immediately — that is how one effect sets off another.'
                        : null,
                    patch: v => ({ payload: { ...payload, durationMs: Math.max(0, Number(v) || 0) } })
                }
            ];

        case KEYWORD.CANNOT:
            return [
                {
                    id: 'kind', kind: SLOT_KIND.VOCABULARY, label: 'restriction',
                    value: payload.kind,
                    options: RESTRICTION_KINDS.map(k => option(k.id, k.label, k.blurb)),
                    patch: v => ({ payload: { ...(getRestrictionKind(v)?.blank() || {}) } })
                },
                {
                    id: 'max', kind: SLOT_KIND.NUMBER, label: 'at most',
                    value: payload.max ?? 2, min: 0,
                    patch: v => ({ payload: { ...payload, max: Math.max(0, Number(v) || 0) } })
                }
            ];

        case KEYWORD.ACTS_AS:
        case KEYWORD.REQUIRES:
            return [
                {
                    id: 'tag', kind: SLOT_KIND.TEXT, label: 'capability',
                    value: payload.tag || '',
                    /**
                     * ⚠️ Capabilities come from the CONTENT, never from a
                     * hardcoded list (B5). A capability exists because some
                     * Token says it provides one, so the vocabulary is whatever
                     * has been authored — and offering a fixed list would let an
                     * author require a `pickaxe` that nothing in the game grants.
                     */
                    suggestions: (ctx?.capabilities || []).slice().sort(),
                    patch: v => ({ payload: { ...payload, tag: v } })
                }
            ];

        // ⚠️ Item lists are a table, not a sentence (G-20). They keep a small
        // form beneath the line rather than being spelled out inline.
        case KEYWORD.CONVERTS:
        case KEYWORD.RESTOCKS:
        case KEYWORD.GRANTS:
            return [{ id: 'payload', kind: SLOT_KIND.FORM, label: 'what it moves' }];

        default:
            return [];
    }
}

/**
 * The ordered slots of one statement.
 *
 * Order follows the **sentence**, not the data shape: when, verb, payload, who,
 * how far. An author reading down the row is reading the rule.
 *
 * @param {object} statement
 * @returns {Array<object>} slots, each with `id`, `kind`, `label`, `value` and
 *   a `patch(value)` returning the change to merge into the statement
 */
export function slotsOf(statement, ctx = {}) {
    const keyword = getKeyword(statement?.keyword);
    if (!keyword) return [];

    const slots = [];

    // The moment comes first because the sentence starts with it — and because
    // it decides which roles the target slot may offer (G-2).
    if (keyword.when !== WHEN.NEVER) {
        slots.push({
            id: 'moment', kind: SLOT_KIND.VOCABULARY, label: 'when',
            value: statement?.when?.event || null,
            required: keyword.when === WHEN.REQUIRED,
            options: momentOptions(),
            patch: v => {
                const definition = getTriggerEvent(v);
                return {
                    when: {
                        ...(statement.when || {}),
                        event: v,
                        scope: definition?.scopes?.[0] || 'adjacent'
                    }
                };
            }
        });
    }

    // The moment's own detail — what it watches for, and how often it may fire.
    // All of it appears in the sentence, so all of it is a chip rather than a
    // box somewhere else.
    const moment = getTriggerEvent(statement?.when?.event);
    if (moment) {
        if (moment.needsItem || moment.id === 'ITEM_THRESHOLD') {
            slots.push({
                id: 'watchItem', kind: SLOT_KIND.VOCABULARY, label: 'which item',
                value: statement?.when?.watchItemId || '',
                options: Object.values(ctx.items || {}).map(i => option(i.id, i.name || i.id)),
                patch: v => ({ when: { ...statement.when, watchItemId: v } })
            });
        }
        if (moment.id === 'ITEM_THRESHOLD') {
            slots.push({
                id: 'threshold', kind: SLOT_KIND.NUMBER, label: 'how many', min: 1,
                value: statement?.when?.threshold ?? 1,
                patch: v => ({ when: { ...statement.when, threshold: Math.max(1, Number(v) || 1) } })
            });
        }
        slots.push({
            id: 'cooldown', kind: SLOT_KIND.NUMBER, label: 'cooldown (ms)', min: 0,
            value: statement?.when?.cooldownMs ?? 0,
            patch: v => ({ when: { ...statement.when, cooldownMs: Math.max(0, Number(v) || 0) } })
        });
    }

    slots.push({
        id: 'keyword', kind: SLOT_KIND.VOCABULARY, label: 'does',
        value: statement.keyword,
        options: KEYWORDS.map(k => option(k.id, k.label, k.blurb)),
        /**
         * ⚠️ **Changing the verb REBUILDS the statement**, and must.
         *
         * A keyword decides the payload's shape, whether there is a moment,
         * whether there is a target and whether there is a filter. Swapping only
         * the word leaves the previous keyword's payload behind and the new
         * keyword's required fields missing — a `Deals` carrying a `Provides`
         * payload, with no moment and nothing to act on. That is not a rule an
         * author could have written, so the editor must not be able to produce
         * it either.
         *
         * `makeStatement` already builds a statement legal by construction, so
         * the rebuild goes through it rather than through a second set of
         * defaults here. The **id is kept**: per-statement save state
         * (`blockUpkeep`, `blockCooldowns`) is keyed by it, and changing it under
         * a live save would strand that state on a rule that no longer exists.
         */
        patch: v => ({ ...makeStatement(v), id: statement.id })
    });

    slots.push(...payloadSlots(statement, ctx));

    if (keyword.targetsRole) {
        slots.push({
            id: 'role', kind: SLOT_KIND.VOCABULARY, label: 'acts on',
            value: statement?.target?.role || null,
            options: roleOptions(statement),
            /**
             * ⚠️ Names a value its own options no longer contain.
             *
             * The orphan case (G-2): the author picked "the actor", then chose a
             * moment that has none. Looking the label up in the CURRENT options
             * finds nothing and falls back to the raw id, so the warning reads
             * *"actor is not something this rule can reach"* — naming the value
             * in a vocabulary the author never sees. They picked "the actor";
             * they should be told about "the actor".
             */
            labelFor: v => getRole(v)?.label,
            patch: v => ({ target: { ...(statement.target || {}), role: v } })
        });
    }

    if (keyword.reach) {
        slots.push({
            id: 'reach', kind: SLOT_KIND.VOCABULARY, label: 'how far',
            value: reachOf(statement),
            options: REACHES.map(r => option(r.id, r.label, r.hint)),
            patch: v => ({ reach: v })
        });
    }

    if (keyword.filter) {
        const mode = statement?.to?.mode || 'all';
        slots.push({
            id: 'filterMode', kind: SLOT_KIND.VOCABULARY, label: 'reaches',
            value: mode,
            options: TARGET_MODES.map(m => option(m.mode, m.label, m.hint)),
            patch: v => ({ to: { mode: v, value: '' } })
        });

        /**
         * ⚠️ The filter's VALUE, which the mode alone cannot supply.
         *
         * A tag is a string the author invents, so it is typed. A Token id is a
         * choice from content, so it is a vocabulary — and the content comes
         * from `ctx`, because the CMS edits its own draft store and the game
         * reads its registry. Neither is more correct than the other, so the
         * caller supplies whichever it means, exactly as `renderStatement` takes
         * a `names` resolver rather than reaching for a registry itself.
         */
        if (mode === 'tag') {
            const typed = statement?.to?.value || '';
            const known = new Set();
            for (const t of Object.values(ctx.tokens || {})) {
                for (const tag of t.tags || []) known.add(tag);
            }
            const miss = typed && !known.has(typed);
            const nearMiss = miss && [...known].find(t => t.toLowerCase() === typed.toLowerCase());
            slots.push({
                id: 'filterValue', kind: SLOT_KIND.TEXT, label: 'tag',
                value: typed,
                suggestions: [...known].sort(),
                /**
                 * ⚠️ The most common authoring slip there is: a capital letter
                 * in the wrong place. Tags match exactly, so a near miss reaches
                 * nothing at all and looks identical to a rule that works.
                 */
                warning: miss
                    ? `No Token carries the tag “${typed}”, so this reaches nothing.`
                        + (nearMiss ? ` Did you mean ${nearMiss}? Tags match exactly, including case.` : '')
                    : null,
                patch: v => ({ to: { mode: 'tag', value: v } })
            });
        } else if (mode === 'id') {
            slots.push({
                id: 'filterValue', kind: SLOT_KIND.VOCABULARY, label: 'which Token',
                value: statement?.to?.value || '',
                options: Object.values(ctx.tokens || {}).map(t => option(t.id, t.name || t.id)),
                patch: v => ({ to: { mode: 'id', value: v } })
            });
        }
    }

    if (keyword.filter) {
        /**
         * The stacked filters (G-9). A list rather than a single value, so it
         * gets the form treatment (G-20) — but the FILTER VOCABULARY still comes
         * from the game, so adding a filter kind puts it in the editor with no
         * editor change.
         */
        slots.push({
            id: 'filters', kind: SLOT_KIND.FILTERS, label: 'only the ones',
            value: filtersOf(statement?.to),
            options: FILTER_KINDS.map(f => option(f.id, f.label, f.hint)),
            patch: v => ({ to: { ...(statement.to || { mode: 'all', value: '' }), filters: v } })
        });
    }

    return slots;
}

/**
 * Whether a slot's current value is one its own vocabulary still allows.
 *
 * ⭐ The G-2 case, and the reason this is a question worth asking: a target may
 * name a role, and then the author changes the moment to one that has no such
 * role. The value does not become invalid data — it becomes a rule that reaches
 * nobody on any board — so the editor must be able to say so rather than showing
 * a picker that silently lost its selection.
 */
export function slotIsOrphaned(slot) {
    if (slot?.kind !== SLOT_KIND.VOCABULARY) return false;
    if (!slot.value) return false;
    return !slot.options.some(o => o.id === slot.value);
}

/**
 * A slot's current value in words, for the chip face.
 *
 * ⚠️ Deliberately the **vocabulary's own label**, never a paraphrase. The chip,
 * the panel and the generated sentence all draw from one set of words, so an
 * author never has to work out that "the actor" and "the harvester" are the same
 * thing. Where the sentence needs different grammar around a word, that is the
 * sentence's job and `statementText` owns it.
 */
export function slotDisplay(slot) {
    if (!slot) return '';
    switch (slot.kind) {
        case SLOT_KIND.VOCABULARY: {
            const chosen = slot.options.find(o => o.id === slot.value);
            if (chosen) return chosen.label;
            // Orphaned, or simply unset. A slot that can name a value outside
            // its current options says so in the author's own words.
            return slot.labelFor?.(slot.value) || slot.value || '…';
        }
        case SLOT_KIND.FLAG:
            return slot.value ? slot.label : '';
        case SLOT_KIND.NUMBER:
            return String(slot.value ?? '…');
        case SLOT_KIND.TEXT:
            return slot.value || '…';
        default:
            return slot.label;
    }
}

/** Options whose label or hint matches what the author has typed. */
export function filterOptions(slot, query) {
    const options = slot?.options || [];
    const q = (query || '').trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
        o.label.toLowerCase().includes(q) || (o.hint || '').toLowerCase().includes(q)
    );
}

/** Named exports the CMS leans on, re-checked here so a rename breaks loudly. */
export const SLOT_VOCABULARIES = Object.freeze({
    getRole, getReach, getStatusEffect, getTriggerEvent
});
