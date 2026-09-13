// Fantasy Guild — a statement as an ordered list of slots (Effects Grammar v2, V3)

import {
    KEYWORD, KEYWORDS, WHEN, getKeyword, paletteForKeyword, makeStatement, DEFAULT_STATEMENT_CHARGE_DELTA
} from './statements.js';
import {
    CHARGE_MOMENT, chargeMomentsFor, chargeMomentOf, DEFAULT_CHARGE_DELTA_BY_MOMENT
} from '../../config/registries/chargeMomentRegistry.js';
import { TRIGGER_EVENTS, getTriggerEvent, rolesOf } from '../../config/registries/triggerRegistry.js';
import { ROLES, getRole } from '../../config/registries/roleRegistry.js';
import { REACHES, reachOf, getReach } from '../../config/registries/reachRegistry.js';
import {
    TARGET_MODES, getPaletteEntry, bucketsFor, describeModifierDirection, clampModifierValue
} from '../../config/registries/modifierPalette.js';
import { getStatusEffect, authorableStatuses } from '../../config/registries/statusRegistry.js';
import { RESTRICTION_KINDS, getRestrictionKind } from '../../config/registries/restrictionPalette.js';
import { FILTER_KINDS, filtersOf } from '../../config/registries/filterRegistry.js';
import { MAGNITUDE_KIND, statsForRoles } from '../../config/registries/magnitudeRegistry.js';
import { PLACEMENTS, placementOf } from '../../config/registries/placementRegistry.js';
import { getAllSkills } from '../../config/registries/skillRegistry.js';

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
    FILTERS: 'filters',
    /**
     * Pick SEVERAL of a declared list — the Tokens a Manager restocks (P4).
     *
     * A set, not a table: it has no per-row numbers, so E-8 gives it a slot
     * rather than letting it keep a form.
     */
    LIST: 'list'
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

/** Every skill, as options — from the game registry, so the CMS can never offer one it lacks. */
const skillOptions = () => Object.values(getAllSkills() || {}).map(s => option(s.id, s.name || s.id));

/**
 * A `Provides` payload rebuilt for a newly chosen axis (Rules Line P4).
 *
 * ⚠️ **Changing the effect REBUILDS the payload, as the retired form did.** A
 * chance-shaped axis wants `flat` and anything else `percentage`; swapping only
 * the type left the old bucket and value behind, so Yield at 25% switched to
 * Double Loot read "a 0.25% chance". Mirrors `makeModifier` in the CMS store.
 */
function payloadForAxis(type) {
    return getPaletteEntry(type)?.shape === 'proc'
        ? { type, bucket: 'flat', value: 0 }
        : { type, bucket: 'percentage', value: 0 };
}

/** A 1–100 chance, clamped as the retired forms clamped it. Unreadable input keeps "always". */
const clampChance = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 100;
};

/**
 * The `Applies` decisions that lived only in the retired form: how often, and
 * — when an item carries the rule — which side of a fight it lands on.
 *
 * `target` retires along with the one-off flag when V10 adds `the opponent`.
 */
function appliesExtras(payload) {
    const note = 'On a Token this is ignored — its filter decides who is reached.';
    return [
        {
            id: 'chance', kind: SLOT_KIND.NUMBER, label: 'chance (%)', min: 1, max: 100, optional: true,
            value: payload.chance ?? 100,
            patch: v => ({ payload: { ...payload, chance: clampChance(v) } })
        },
        {
            id: 'target', kind: SLOT_KIND.VOCABULARY, label: 'on an item, lands on', optional: true,
            value: payload.target || 'hero',
            options: [
                option('hero', 'the hero carrying it', note),
                option('enemy', 'the enemy that hero is fighting', note)
            ],
            patch: v => ({ payload: { ...payload, target: v } })
        }
    ];
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
                    patch: v => ({ payload: payloadForAxis(v) })
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
                    /**
                     * ⚠️ **A percentage is typed as 5 and stored as 0.05.**
                     *
                     * The retired form divided by 100 for the percentage bucket
                     * and clamped through `clampModifierValue`. The slot did
                     * neither, so typing 5 for a percentage Yield stored 5 and
                     * rendered *"500% more yield"* — and a proc's 0–100 clamp
                     * was gone with it.
                     */
                    id: 'value', kind: SLOT_KIND.NUMBER, label: 'amount',
                    value: (payload.bucket === 'percentage' && entry?.shape !== 'proc')
                        ? Math.round((payload.value ?? 0) * 1000) / 10
                        : (payload.value ?? 0),
                    /**
                     * ⚠️ The buff-or-penalty reading, which the sign alone does
                     * not give. `+5%` on Yield is a gift and `+5%` on Work Time
                     * is a punishment, because Work Time is milliseconds per
                     * cycle. The palette knows which axes run backwards; without
                     * saying so the author has to remember, which is exactly
                     * what `inverted` exists to stop.
                     */
                    note: describeModifierDirection(entry, payload.value, payload.bucket)?.text,
                    patch: v => {
                        const typed = Number(v) || 0;
                        const stored = (payload.bucket === 'percentage' && entry?.shape !== 'proc')
                            ? typed / 100
                            : typed;
                        return { payload: { ...payload, value: clampModifierValue(entry, stored) } };
                    }
                },
                ...(entry?.categories ? [{
                    // ⚠️ Optional: an unset skill scope means "any", which is the
                    // normal case. Without saying so the editor paints it as a
                    // blank that needs filling, and every ordinary rule looks
                    // half-finished.
                    id: 'category', kind: SLOT_KIND.VOCABULARY, label: 'only for', optional: true,
                    value: payload.category || '',
                    /**
                     * ⚠️ The skill list was EMPTY here — only the retired form's
                     * picker could scope a rule to a skill, so deleting it would
                     * have made "but only for Mining work" unauthorable (P4).
                     * "Any skill" clears the scope, which the form also did.
                     */
                    options: entry.categories === 'status'
                        ? authorableStatuses().map(s => option(s.id, s.name, s.description))
                        : [option('', 'Any skill', 'No narrowing — the usual case.'), ...skillOptions()],
                    patch: v => {
                        const next = { ...payload };
                        if (v) next.category = v; else delete next.category;
                        return { payload: next };
                    }
                }] : [])
            ];
        }

        case KEYWORD.SPAWNS:
            return [
                {
                    id: 'typeId', kind: SLOT_KIND.VOCABULARY, label: 'which Token',
                    value: payload.typeId || '',
                    options: Object.values(ctx?.tokens || {}).map(t => option(t.id, t.name || t.id)),
                    patch: v => ({ payload: { ...payload, typeId: v } })
                },
                {
                    id: 'placement', kind: SLOT_KIND.VOCABULARY, label: 'where',
                    value: placementOf(payload),
                    options: PLACEMENTS.map(pl => option(pl.id, pl.label, pl.hint)),
                    patch: v => ({ payload: { ...payload, placement: v } })
                }
            ];

        case KEYWORD.TRANSFORMS:
            return [{
                id: 'typeId', kind: SLOT_KIND.VOCABULARY, label: 'into which Token',
                value: payload.typeId || '',
                options: Object.values(ctx?.tokens || {}).map(t => option(t.id, t.name || t.id)),
                patch: v => ({ payload: { ...payload, typeId: v } })
            }];

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
            /**
             * ⭐ **Library effects only** (owner ruling, 2026-09-12).
             *
             * The retired form authored only statuses and the line only effects,
             * so P4 had to choose. The owner chose effects: statuses are meant to
             * become ordinary library effects, so new rules point there. No status
             * slot is offered any more — and a rule that still names a status
             * shows the effect picker in its place, where picking an effect
             * replaces the status cleanly (its `statusId` and `stacks` go).
             *
             * The engine still RUNS status rules; nothing authored breaks.
             */
            return [
                {
                    id: 'effectId', kind: SLOT_KIND.VOCABULARY, label: 'effect',
                    value: payload.effectId || '',
                    options: Object.values(ctx?.effects || {}).map(e => option(e.id, e.name || e.id)),
                    patch: v => {
                        const { statusId, stacks, ...rest } = payload;
                        void statusId; void stacks;
                        return { payload: { ...rest, effectId: v } };
                    }
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
                },
                ...appliesExtras(payload)
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

        /**
         * `Acts as` is the `Requires` capability plus a **tool tier**, which
         * lived only in the retired form (P4). A station asking for a Tier 2
         * tool refuses a Tier 1 one, so this is a real decision.
         */
        case KEYWORD.ACTS_AS:
            return [
                // Only the capability — `Acts as` has a tier of its own, not a minimum.
                ...payloadSlots({ ...statement, keyword: KEYWORD.REQUIRES }, ctx).filter(s => s.id === 'tag'),
                {
                    id: 'tier', kind: SLOT_KIND.NUMBER, label: 'tool tier', min: 1,
                    value: payload.tier ?? 1,
                    patch: v => ({ payload: { ...payload, tier: Math.max(1, Math.floor(Number(v) || 1)) } })
                }
            ];

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
                },
                /**
                 * ⚠️ The sentence says "Tier 2", and the retired Requires form's
                 * "Min Tool Tier" box was the only way to change it (Rules Line
                 * P6). A number the rules text prints with no control behind it
                 * is exactly the silent hole P4 kept finding.
                 */
                {
                    id: 'minTier', kind: SLOT_KIND.NUMBER, label: 'minimum tool tier', min: 1,
                    value: payload.minTier ?? 1,
                    patch: v => ({ payload: { ...payload, minTier: Math.max(1, Math.floor(Number(v) || 1)) } })
                }
            ];

        // ⚠️ Item lists are a table, not a sentence (G-20). They keep a small
        // form beneath the line rather than being spelled out inline.
        /**
         * ⚠️ A conversion's two item lists are the ONE form that survives (E-8):
         * a genuine table, with a quantity on every row. Everything else a form
         * used to hold is a slot below.
         */
        case KEYWORD.CONVERTS:
            return [{ id: 'payload', kind: SLOT_KIND.FORM, label: 'what it moves' }];

        /** `Grants` — how many, of which item, how often (P4: was a form). */
        case KEYWORD.GRANTS:
            return [
                {
                    id: 'quantity', kind: SLOT_KIND.NUMBER, label: 'how many', min: 1,
                    value: payload.quantity ?? 1,
                    patch: v => ({ payload: { ...payload, quantity: Math.max(1, Math.floor(Number(v) || 1)) } })
                },
                {
                    // `creates` tells the editor it may offer "Create …" when the
                    // search finds nothing — the retired item picker could.
                    id: 'itemId', kind: SLOT_KIND.VOCABULARY, label: 'which item', creates: 'item',
                    value: payload.itemId || '',
                    options: Object.values(ctx?.items || {}).map(i => option(i.id, i.name || i.id)),
                    patch: v => ({ payload: { ...payload, itemId: v } })
                },
                {
                    id: 'chance', kind: SLOT_KIND.NUMBER, label: 'chance (%)', min: 1, max: 100, optional: true,
                    value: payload.chance ?? 100,
                    patch: v => ({ payload: { ...payload, chance: clampChance(v) } })
                }
            ];

        /** `Restocks` — the Tokens a Manager keeps supplied (P4: was a form). */
        case KEYWORD.RESTOCKS:
            return [{
                id: 'tokenIds', kind: SLOT_KIND.LIST, label: 'which Tokens',
                value: Array.isArray(payload.tokenIds) ? payload.tokenIds : [],
                options: Object.values(ctx?.tokens || {}).map(t => option(t.id, t.name || t.id)),
                patch: v => ({ payload: { ...payload, tokenIds: [...new Set((v || []).filter(Boolean))] } })
            }];

        /**
         * `Works as` — which skill's recipes a station runs (P4). It had NO slot
         * at all; the retired form was its only control, and `stationSkillOf`
         * is the sole input to `deriveTokenType`, so losing it would have made
         * every new station unauthorable.
         */
        case KEYWORD.STATION:
            return [{
                id: 'skill', kind: SLOT_KIND.VOCABULARY, label: 'which skill',
                value: payload.skill || '',
                options: skillOptions(),
                patch: v => ({ payload: { ...payload, skill: v } })
            }];

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
        /**
         * ⚠️ **In seconds, because the sentence says seconds** (fixed in P5).
         *
         * The sentence reads "at most once every 5 seconds", and E-3 retypes
         * the word the author sees. The slot used to take milliseconds, so
         * retyping that 5 as 10 stored 10 ms and the sentence then read "every
         * 0 seconds". The data stays in milliseconds; only the word converts.
         */
        slots.push({
            id: 'cooldown', kind: SLOT_KIND.NUMBER, label: 'cooldown (seconds)', min: 0,
            value: Math.round((statement?.when?.cooldownMs ?? 0) / 100) / 10,
            hint: 'The shortest gap between two firings. 0 lets it fire every time its moment happens.',
            patch: v => ({ when: { ...statement.when, cooldownMs: Math.max(0, Math.round((Number(v) || 0) * 1000)) } })
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
        case SLOT_KIND.LIST: {
            const chosen = (slot.value || []).map(v => slot.options.find(o => o.id === v)?.label || v);
            return chosen.length ? chosen.join(' and ') : '…';
        }
        default:
            return slot.label;
    }
}

/**
 * Options whose label or hint matches what the author has typed, **best first**.
 *
 * ⚠️ Ranked, because Enter takes the top hit (Rules Line, E-1). Unranked, typing
 * "tick" could commit whatever option merely *mentions* ticking in its hint
 * ahead of the one called "On Tick". The order: an exact label, a label that
 * starts with it, a label word that starts with it, a label containing it, and
 * only then a hint containing it. Ties keep the vocabulary's own order.
 */
export function filterOptions(slot, query) {
    const options = slot?.options || [];
    const q = (query || '').trim().toLowerCase();
    if (!q) return options;
    const tier = (o) => {
        const label = o.label.toLowerCase();
        if (label === q) return 0;
        if (label.startsWith(q)) return 1;
        if (label.split(/\s+/).some(w => w.startsWith(q))) return 2;
        if (label.includes(q)) return 3;
        return (o.hint || '').toLowerCase().includes(q) ? 4 : -1;
    };
    return options
        .map((o, i) => ({ o, i, t: tier(o) }))
        .filter(x => x.t >= 0)
        .sort((a, b) => a.t - b.t || a.i - b.i)
        .map(x => x.o);
}

/** Classic edit distance. Small strings only — option labels and a typed word. */
function editDistance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const kept = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = kept;
        }
    }
    return row[b.length];
}

const closeness = (a, b) => (a || b ? 1 - editDistance(a, b) / Math.max(a.length, b.length) : 1);
const wordsOf = (text) => text.toLowerCase().replace(/[^a-z0-9%\s]/g, '').split(/\s+/).filter(Boolean);

/**
 * ⭐ **The nearest legal words to something that is not a word here** (E-4).
 *
 * An unrecognised word inserts nothing — that is what keeps an invalid rule
 * unwritable. But a dead end teaches nothing, so the panel offers the closest
 * options instead, turning "depletd" into a way of finding *On Depleted*.
 *
 * Scored on each typed word's best match among the label's words (so a typo in
 * one word still finds it), blended with the whole label's closeness (so "on
 * cycel" prefers *On Cycle* over *On Neighbour's Cycle*, which shares both
 * words but is further from what was typed).
 *
 * ⚠️ Only ever returns the slot's own options — it ranks, it never invents.
 */
export function nearestOptions(slot, query, limit = 5) {
    const options = slot?.options || [];
    const typed = (query || '').trim().toLowerCase();
    const typedWords = wordsOf(typed);
    if (!typedWords.length || !options.length) return [];
    return options
        .map((o, i) => {
            const labelWords = wordsOf(o.label);
            const perWord = typedWords.reduce((sum, w) =>
                sum + Math.max(0, ...labelWords.map(lw => closeness(w, lw))), 0) / typedWords.length;
            const whole = closeness(typed, wordsOf(o.label).join(' '));
            return { o, i, score: perWord * 0.7 + whole * 0.3 };
        })
        .sort((a, b) => b.score - a.score || a.i - b.i)
        .slice(0, limit)
        .map(x => x.o);
}

/**
 * The decisions this statement has that its SENTENCE never mentions.
 *
 * ⚠️ **This is what stops a decision becoming silently unauthorable.** The
 * Rules Line makes the sentence's own words clickable — but a flat damage
 * never says "measured as", "ignores armour" is absent until it is true, an
 * empty filter stack says nothing, a tier of 1 is not printed. Each of those is
 * a real slot with no word to click. The last code review found exactly this
 * failure hiding behind a form (`Works as` became unauthorable), so the line
 * offers every one of these explicitly.
 *
 * `FORM` slots are left out: their form renders beneath the line regardless.
 *
 * @param {Array<object>} slots     `slotsOf(statement)`
 * @param {Array<{slot?: string}>} segments  `renderSegments(statement)`
 */
export function slotsWithoutWords(slots, segments) {
    const worded = new Set((segments || []).map(s => s.slot).filter(Boolean));
    return (slots || []).filter(s => s.kind !== SLOT_KIND.FORM && !worded.has(s.id));
}

/**
 * Slots the sentence may say, but whose control lives in the cost strip when it
 * does not (E-6, owner ruling 2026-09-12). Kept out of the quiet row beneath the
 * line so a decision is never offered in two places.
 */
export const FINE_PRINT_SLOTS = Object.freeze(['cooldown']);

/** What a charge cost means, in the words the retired Charge cost box used. */
function chargeHint(delta, moment) {
    const firing = moment === CHARGE_MOMENT.ON_FIRE;
    const n = Math.abs(delta);
    const charges = `${n} charge${n === 1 ? '' : 's'}`;
    const body = delta < 0
        ? firing
            ? `Spends ${charges} each time it fires, and cannot fire at all with fewer left.`
            : `Spends ${charges} every cycle this Token completes, on top of its own work cost.`
        : delta === 0
            ? 'Free — this rule never wears the Token down. This is how an always-on effect is authored.'
            : firing
                ? `Gives ${charges} back, up to the Token's starting charges.`
                : 'A per-cycle rule can only cost, never restore — a Token topping itself up every cycle would never deplete.';
    return `${body} A Token with unlimited charges ignores this in both directions. Type a minus sign to give charges back.`;
}

/**
 * ⭐ **The fine print: what a rule costs, which its sentence never says** (E-6, P5).
 *
 * Owner ruling 2026-09-12: the strip beside the sentence holds only what the
 * sentence leaves unsaid. Cooldown and chance are already words in the rules
 * text, so they stay clickable there; the charge cost and the upkeep's clock
 * are said nowhere, so they get slots here.
 *
 * Separate from `slotsOf` on purpose. Everything `slotsOf` returns is a decision
 * the sentence can hold, and the tests hold every tag the renderer emits to it.
 * None of these ever appears in the rules text.
 *
 * ⚠️ `charge` reads as what the rule SPENDS — positive — while `chargeDelta`
 * stores the change to the Token, negative. Writing it pins `chargeWhen`, as the
 * retired box did, so a rule's moment stops being inferred once a cost is typed.
 *
 * @param {object} statement
 * @returns {Array<object>} slots shaped like `slotsOf`'s
 */
export function costSlots(statement) {
    const keyword = getKeyword(statement?.keyword);
    // ⚠️ `Requires` is a view of a Token's `acceptedTokens`, not a rule (owner
    // Q5): nothing spends on it, and a charge written here would be written into
    // the Token's requirement list.
    if (!keyword || keyword.id === KEYWORD.REQUIRES) return [];

    const moment = chargeMomentOf(statement);
    const delta = typeof statement.chargeDelta === 'number'
        ? statement.chargeDelta
        : (DEFAULT_CHARGE_DELTA_BY_MOMENT[moment] ?? DEFAULT_STATEMENT_CHARGE_DELTA);

    const slots = [
        {
            id: 'charge', kind: SLOT_KIND.NUMBER, label: 'charges spent',
            value: delta === 0 ? 0 : -delta,
            hint: chargeHint(delta, moment),
            patch: v => {
                const n = Math.round(Number(v));
                const spend = Number.isFinite(n) ? n : 0;
                return { chargeDelta: spend === 0 ? 0 : -spend, chargeWhen: moment };
            }
        },
        {
            id: 'chargeWhen', kind: SLOT_KIND.VOCABULARY, label: 'spent',
            value: moment,
            options: chargeMomentsFor(!!statement.when).map(m => option(m.id, m.label, m.hint)),
            patch: v => ({ chargeWhen: v })
        }
    ];

    if (keyword.upkeep && statement.upkeep) {
        const upkeep = statement.upkeep;
        slots.push({
            id: 'upkeepEvery', kind: SLOT_KIND.NUMBER, label: 'seconds between payments', min: 1,
            value: Math.round((upkeep.cadenceMs ?? 30000) / 100) / 10,
            hint: 'Its own clock, independent of any production cycle. When the Bank cannot pay, this rule switches off until stock returns — nothing is destroyed and no debt accrues.',
            // The retired box's floor was one second.
            patch: v => ({ upkeep: { ...upkeep, cadenceMs: Math.max(1000, Math.round((Number(v) || 0) * 1000)) } })
        });
    }

    return slots;
}

/** Named exports the CMS leans on, re-checked here so a rename breaks loudly. */
export const SLOT_VOCABULARIES = Object.freeze({
    getRole, getReach, getStatusEffect, getTriggerEvent
});
