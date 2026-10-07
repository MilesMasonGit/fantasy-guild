import {
    KEYWORD, KEYWORDS, WHEN, getKeyword, paletteForKeyword, makeStatement, DEFAULT_STATEMENT_CHARGE_DELTA,
    rolesForKeyword
} from './statements.js';
import {
    CHARGE_MOMENT, chargeMomentsFor, chargeMomentOf, chargeDeltaOf
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
import { JOBS } from '../../config/registries/jobRegistry.js';

/**
 * A statement, described as the ordered slots an author fills in: the model behind the
 * sentence editor. Each slot knows its vocabulary, its current value, and how to write itself
 * back (choosing an option produces a patch).
 *
 * ⚠️ There is no parser. The statement object stays the editor's state and `statementText`
 * the one renderer; a slot offers declared options and hands back the picked one, so an
 * invalid rule stays unwritable and no inverse of `renderStatement` has to exist.
 *
 * ⚠️ Slots are the EDITABLE parts, not every word. Connective words belong to the sentence
 * rendered by `statementText`; keeping them apart stops this file becoming a second renderer
 * that can disagree with the first.
 *
 * Legality is read from the same declarations the game reads (`KEYWORDS`, `TRIGGER_EVENTS`,
 * `REACHES`, the palette, ...), so adding a row to any of them puts it in the editor with no
 * editor change.
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
    /** A payload the sentence cannot hold: a conversion's two item lists. Kept as a small form beneath the sentence. */
    FORM: 'form',
    /** A stack of filters, each with its own value and a negate toggle. */
    FILTERS: 'filters',
    /** Pick SEVERAL of a declared list (the Tokens a Manager restocks): a set with no per-row numbers. */
    LIST: 'list'
});

/** A vocabulary option, in the shape every picker wants. */
const option = (id, label, hint = '') => ({ id, label, hint });

/**
 * Which moments a statement may legally name. ⚠️ This returns every moment; callers must not
 * offer it to a keyword that cannot carry a trigger (`slotsOf` checks `KEYWORDS`).
 */
function momentOptions() {
    return TRIGGER_EVENTS.map(t => option(t.id, t.label, t.hint));
}

/**
 * Which roles this statement may act on. The moment decides: on a moment with no actor, "the
 * actor" is not offered.
 */
function roleOptions(statement) {
    const available = rolesOf(statement?.when?.event);
    // ⚠️ The keyword decides too: "Restores 1 charge to the enemy" is never offered, whatever the
    // moment. The same allowlist ContentAudit reads.
    const allowed = rolesForKeyword(statement?.keyword);
    return ROLES
        .filter(r => available.includes(r.id) && allowed.includes(r.id))
        .map(r => option(r.id, r.label, r.hint));
}

/** Every skill, as options — from the game registry, so the CMS can never offer one it lacks. */
const skillOptions = () => Object.values(getAllSkills() || {}).map(s => option(s.id, s.name || s.id));

/**
 * A `Provides` payload rebuilt for a newly chosen axis.
 *
 * ⚠️ Changing the effect REBUILDS the payload: swapping only the type left the old bucket and
 * value behind (Yield at 25% switched to Double Loot read "a 0.25% chance"). A chance-shaped
 * axis wants `flat`, anything else `percentage`.
 */
function payloadForAxis(type) {
    return getPaletteEntry(type)?.shape === 'proc'
        ? { type, bucket: 'flat', value: 0 }
        : { type, bucket: 'percentage', value: 0 };
}

/** A 1-100 chance. Unreadable input keeps "always". */
const clampChance = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 100;
};

/**
 * The `Applies` chance slot. ⚠️ There is no `target` slot: who a rule reaches is its filter
 * or, on a combat moment, the "aims at" role slot.
 */
function appliesExtras(payload) {
    return [
        {
            id: 'chance', kind: SLOT_KIND.NUMBER, label: 'chance (%)', min: 1, max: 100, optional: true,
            value: payload.chance ?? 100,
            patch: v => ({ payload: { ...payload, chance: clampChance(v) } })
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
                 * ⚠️ The magnitude vocabulary is role-filtered too: a stat about the actor is not offered
                 * on a moment that has no actor.
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
                     * ⚠️ A percentage is typed as 5 and stored as 0.05, clamped through `clampModifierValue`;
                     * storing the typed value rendered "500% more yield".
                     */
                    id: 'value', kind: SLOT_KIND.NUMBER, label: 'amount',
                    value: (payload.bucket === 'percentage' && entry?.shape !== 'proc')
                        ? Math.round((payload.value ?? 0) * 1000) / 10
                        : (payload.value ?? 0),
                    /**
                     * ⚠️ The buff-or-penalty reading, which the sign alone does not give: +5% on Yield is a
                     * gift, +5% on Work Time a punishment. The palette's `inverted` knows which axes run backwards.
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
                    // ⚠️ Optional: an unset skill scope means "any", so the editor must not paint it as a
                    // blank that needs filling.
                    id: 'category', kind: SLOT_KIND.VOCABULARY, label: 'only for', optional: true,
                    value: payload.category || '',
                    /** The only way to scope a rule to a skill. "Any skill" clears the scope. */
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
            // A rule naming a `statusId` still edits as before, but only library effects are offered:
            // picking an effect replaces the status (its `statusId` and `stacks` go). The engine still
            // RUNS status rules.
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
                    // Zero means fire it once, now (how chaining works).
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
         * `Acts as` is the `Requires` capability plus a tool tier: a station asking for a Tier 2
         * tool refuses a Tier 1 one.
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
                     * ⚠️ Capabilities come from the CONTENT, never a hardcoded list: a fixed list would let an
                     * author require a `pickaxe` that nothing in the game grants.
                     */
                    suggestions: (ctx?.capabilities || []).slice().sort(),
                    patch: v => ({ payload: { ...payload, tag: v } })
                },
                /**
                 * ⚠️ The sentence says "Tier 2", so this slot must exist: a number the rules text prints
                 * with no control behind it is a silent hole.
                 */
                {
                    id: 'minTier', kind: SLOT_KIND.NUMBER, label: 'minimum tool tier', min: 1,
                    value: payload.minTier ?? 1,
                    patch: v => ({ payload: { ...payload, minTier: Math.max(1, Math.floor(Number(v) || 1)) } })
                }
            ];

        /**
         * ⚠️ A conversion's two item lists are the ONE form that survives: a genuine table, with a
         * quantity on every row. Everything else is a slot.
         */
        case KEYWORD.CONVERTS:
            return [{ id: 'payload', kind: SLOT_KIND.FORM, label: 'what it moves' }];

        /** `Grants`: how many, of which item, how often. */
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

        /** `Restocks`: the Tokens a Manager keeps supplied. */
        case KEYWORD.RESTOCKS:
            return [{
                id: 'tokenIds', kind: SLOT_KIND.LIST, label: 'which Tokens',
                value: Array.isArray(payload.tokenIds) ? payload.tokenIds : [],
                options: Object.values(ctx?.tokens || {}).map(t => option(t.id, t.name || t.id)),
                patch: v => ({ payload: { ...payload, tokenIds: [...new Set((v || []).filter(Boolean))] } })
            }];

        /**
         * `Works as`: which skill's recipes a station runs. ⚠️ `stationSkillOf` is the sole input to
         * `deriveTokenType`, so this slot is the only way to author a station.
         */
        case KEYWORD.STATION:
            return [{
                id: 'skill', kind: SLOT_KIND.VOCABULARY, label: 'which skill',
                value: payload.skill || '',
                options: skillOptions(),
                patch: v => ({ payload: { ...payload, skill: v } })
            }];

        /**
         * `Promotes`: which job. Every job that HAS a parent (the Recruit has none, so nothing
         * promotes a hero to it). Read from `jobRegistry`, so a new job is offered with no editor change.
         */
        case KEYWORD.PROMOTES:
            return [{
                id: 'jobId', kind: SLOT_KIND.VOCABULARY, label: 'which job',
                value: payload.jobId || '',
                options: Object.values(JOBS)
                    .filter(job => job.parent)
                    .map(job => option(job.id, job.name, `from ${JOBS[job.parent]?.name || job.parent}`)),
                patch: v => ({ payload: { ...payload, jobId: v } })
            }];

        default:
            return [];
    }
}

/**
 * The ordered slots of one statement.
 *
 * Order follows the sentence, not the data shape: when, verb, payload, who, how far.
 *
 * @param {object} statement
 * @returns {Array<object>} slots, each with `id`, `kind`, `label`, `value` and
 *   a `patch(value)` returning the change to merge into the statement
 */
export function slotsOf(statement, ctx = {}) {
    const keyword = getKeyword(statement?.keyword);
    if (!keyword) return [];

    const slots = [];

    // The moment comes first because the sentence starts with it, and it decides which roles
    // the target slot may offer.
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
                        scope: definition?.scopes?.[0] || 'nearby'
                    }
                };
            }
        });
    }

    // The moment's own detail (what it watches, how often it may fire) is a chip, since all of
    // it appears in the sentence.
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
         * ⚠️ In seconds, because the sentence says seconds. The data stays in milliseconds; only
         * the word converts.
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
         * ⚠️ Changing the verb REBUILDS the statement: a keyword decides the payload shape, the
         * moment, the target and the filter, so swapping only the word would leave e.g. a `Deals`
         * carrying a `Provides` payload. It goes through `makeStatement`. The id is KEPT: per-
         * statement save state (`blockUpkeep`, `blockCooldowns`) is keyed by it.
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
             * ⚠️ Names a value its own options no longer contain (the author picked "the actor", then a
             * moment that has none). The label is looked up outside the current options so the warning
             * names "the actor" rather than a raw id.
             */
            labelFor: v => getRole(v)?.label,
            patch: v => ({ target: { ...(statement.target || {}), role: v } })
        });
    }

    /**
     * `Applies` may aim at a role instead of its filter. Offered only where the moment supplies a
     * role the keyword allows; a role already chosen keeps its slot on any moment so an orphan
     * can be seen and cleared.
     */
    const byRole = !!keyword.optionalRole && !!statement?.target?.role;
    if (keyword.optionalRole) {
        const offered = roleOptions(statement);
        if (offered.length || byRole) {
            slots.push({
                id: 'role', kind: SLOT_KIND.VOCABULARY, label: 'aims at', optional: true,
                value: statement?.target?.role || '',
                options: [
                    option('', 'whoever its filter reaches', 'No role — the reach and filter decide, as usual.'),
                    ...offered
                ],
                labelFor: v => getRole(v)?.label,
                patch: v => ({ target: v ? { ...(statement.target || {}), role: v } : null })
            });
        }
    }

    // A role replaces the filter and the reach, so neither is offered beside it.
    if (keyword.reach && !byRole) {
        slots.push({
            id: 'reach', kind: SLOT_KIND.VOCABULARY, label: 'how far',
            value: reachOf(statement),
            options: REACHES.map(r => option(r.id, r.label, r.hint)),
            patch: v => ({ reach: v })
        });
    }

    if (keyword.filter && !byRole) {
        const mode = statement?.to?.mode || 'all';
        slots.push({
            id: 'filterMode', kind: SLOT_KIND.VOCABULARY, label: 'reaches',
            value: mode,
            options: TARGET_MODES.map(m => option(m.mode, m.label, m.hint)),
            patch: v => ({ to: { mode: v, value: '' } })
        });

        /**
         * ⚠️ The filter's VALUE: a tag is typed (authors invent them), a Token id is chosen from
         * content. The content comes from `ctx` because the CMS edits its own draft store while the
         * game reads its registry.
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
                 * ⚠️ The most common authoring slip: a capital letter in the wrong place. Tags match exactly,
                 * so a near miss reaches nothing and looks identical to a rule that works.
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

    if (keyword.filter && !byRole) {
        /**
         * The stacked filters. The FILTER VOCABULARY comes from the game, so a new filter kind appears
         * in the editor with no editor change.
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
 * Whether a slot's current value is one its own vocabulary still allows. A target may name a
 * role and then the author changes the moment to one without it; the rule then reaches nobody,
 * so the editor must say so rather than show a picker that silently lost its selection.
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
 * ⚠️ Ranked, because Enter takes the top hit. Unranked, typing
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
 * The nearest legal words to something that is not a word here. An unrecognised word inserts
 * nothing (that keeps an invalid rule unwritable), so the panel offers the closest options
 * instead.
 *
 * Scored on each typed word's best match among the label's words, blended with the whole
 * label's closeness (so "on cycel" prefers *On Cycle* over *On Neighbour's Cycle*).
 *
 * ⚠️ Only ever returns the slot's own options: it ranks, it never invents.
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
 * ⚠️ This stops a decision becoming silently unauthorable: a flat damage never says "measured
 * as", "ignores armour" is absent until it is true, an empty filter stack says nothing, a tier
 * of 1 is not printed. Each is a real slot with no word to click, so the line offers every one
 * explicitly.
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
 * Slots the sentence may say, whose control otherwise lives in the cost strip. Kept out of the
 * quiet row beneath the line so a decision is never offered in two places.
 */
export const FINE_PRINT_SLOTS = Object.freeze(['cooldown']);

/** What a charge cost means, in words. */
function chargeHint(delta, moment) {
    const firing = moment === CHARGE_MOMENT.ON_FIRE;
    const n = Math.abs(delta);
    const charges = `${n} charge${n === 1 ? '' : 's'}`;
    if (moment === CHARGE_MOMENT.ON_PROMOTE) {
        const promote = delta < 0
            ? `Spends ${charges} each time a hero accepts a promotion here, and cannot promote anyone with fewer left. This is the whole price of the job.`
            : delta === 0
                ? 'Free — this Token promotes any number of heroes and never wears down.'
                : 'A promotion can only cost charges, never give them back — this spends nothing.';
        return `${promote} Declining spends nothing. A Token with unlimited charges never runs out. Type a number to set the price.`;
    }
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
 * The fine print: what a rule costs, which its sentence never says. The charge cost and the
 * upkeep's clock appear nowhere in the rules text, so they get slots here.
 *
 * Separate from `slotsOf` on purpose: everything `slotsOf` returns is a decision the sentence
 * can hold.
 *
 * ⚠️ `charge` reads as what the rule SPENDS (positive) while `chargeDelta` stores the change to
 * the Token (negative). Writing it pins `chargeWhen`, so a rule's moment stops being inferred
 * once a cost is typed.
 *
 * @param {object} statement
 * @returns {Array<object>} slots shaped like `slotsOf`'s
 */
export function costSlots(statement) {
    const keyword = getKeyword(statement?.keyword);
    // ⚠️ `Requires` is a view of a Token's `acceptedTokens`, not a rule: nothing spends on it,
    // and a charge written here would land in the Token's requirement list.
    if (!keyword || keyword.id === KEYWORD.REQUIRES) return [];

    const moment = chargeMomentOf(statement);
    // The same reading the board spends by (`Charges.statementChargeDelta`).
    const delta = chargeDeltaOf(statement, DEFAULT_STATEMENT_CHARGE_DELTA);

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
            options: chargeMomentsFor(!!statement.when, keyword.id).map(m => option(m.id, m.label, m.hint)),
            patch: v => ({ chargeWhen: v })
        }
    ];

    if (keyword.upkeep && statement.upkeep) {
        const upkeep = statement.upkeep;
        slots.push({
            id: 'upkeepEvery', kind: SLOT_KIND.NUMBER, label: 'seconds between payments', min: 1,
            value: Math.round((upkeep.cadenceMs ?? 30000) / 100) / 10,
            hint: 'Its own clock, independent of any production cycle. When the Bank cannot pay, this rule switches off until stock returns — nothing is destroyed and no debt accrues.',
            // Floor of one second.
            patch: v => ({ upkeep: { ...upkeep, cadenceMs: Math.max(1000, Math.round((Number(v) || 0) * 1000)) } })
        });
    }

    return slots;
}

/** Named exports the CMS leans on, re-checked here so a rename breaks loudly. */
export const SLOT_VOCABULARIES = Object.freeze({
    getRole, getReach, getStatusEffect, getTriggerEvent
});
