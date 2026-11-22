// The best stack of gear and perks a hero could carry on one effect, and where it reaches the effect's own limit.

import { MODIFIER_PALETTE, MODIFIER_SHAPES } from '../../config/registries/modifierPalette.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { isWornGear } from '../../config/registries/gearDefence.js';
import { BASE_CRIT_CHANCE } from '../../config/FormulaRegistry.js';
import { MAX_SPEED_UP_CUT } from '../../config/loopConstants.js';
import { effectRefsOf, statementsFromEntry } from '../effects/effectLibrary.js';
import { KEYWORD } from '../effects/statements.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from '../effects/constants.js';
import { bestPieces } from './gearDefenceRule.js';

/**
 * The same effect from several sources adds in full (owner: no cap, small numbers instead), so the
 * audits name an effect a hero's best stack pushes to the effect's own limit, where more stops
 * helping: a chance at 100 %, a speed-up at the speed-up floor, a cost cut at 100 %. Shared by the
 * boot audit (`ContentAudit`) and the CMS Economy Audit.
 *
 * ⚠️ Kept free of the registries' loaded content: the CMS imports it and hands in its own workspace.
 *
 * The best stack is the one `gearDefenceRule.bestPieces` picks (the best piece the content has in
 * every place gear goes) plus every milestone perk, each at its own scale, counting its always-on
 * rules in the bucket the limit is read in. A rule narrowed to one skill counts only there; an
 * unnarrowed one counts everywhere. Drinks, potions, elixirs and statuses are left out, as are
 * buildings and Hall stars (they reach a Token, not the hero's own stack).
 *
 * Output: `[{ entityType, entityId, entityName, field, message }]`, as `gearDefenceRule`'s.
 */

const asList = (collection) => (Array.isArray(collection) ? collection : Object.values(collection || {}));

/** The palette rows that are a chance resolved from 0, so 100 points is certain. */
const CHANCE_TYPES = MODIFIER_PALETTE
    .filter(row => row.shape === MODIFIER_SHAPES.PROC && !row.retired && row.type !== EFFECT_TYPES.FAIL_CHANCE)
    .map(row => row.type);

const percent = (n) => `${Math.round(n * 1000) / 10}%`;
const points = (n) => `${Math.round(n * 10) / 10}%`;

/**
 * Each limit: the axis and bucket it is read in, the direction more helps in (`sign`), and how far
 * that way the stack may go before more stops helping (`reach`, in the bucket's own units); `shown`
 * writes a stack's total as the player reads it, `step` one piece's share.
 */
export const STACK_LIMITS = Object.freeze([
    ...CHANCE_TYPES.map(type => ({
        type, bucket: 'flat', sign: 1, reach: 100,
        shown: (n) => points(n), step: (n) => `+${points(n)}`, why: 'a chance of 100%'
    })),
    {
        type: EFFECT_TYPES.CRIT_CHANCE, bucket: 'flat', sign: 1, reach: 100 - BASE_CRIT_CHANCE,
        shown: (n) => points(BASE_CRIT_CHANCE + n), step: (n) => `+${points(n)}`, why: 'a crit on every hit'
    },
    {
        type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', sign: -1, reach: MAX_SPEED_UP_CUT,
        shown: (n) => `-${percent(n)}`, step: (n) => `-${percent(n)}`, why: `the speed-up floor (${percent(MAX_SPEED_UP_CUT)} off the time)`
    },
    {
        type: EFFECT_TYPES.INPUT_COST, bucket: 'percentage', sign: -1, reach: 1,
        shown: (n) => `-${percent(n)}`, step: (n) => `-${percent(n)}`, why: 'inputs cut by 100%'
    }
].map(limit => Object.freeze({ ...limit, label: MODIFIER_PALETTE.find(row => row.type === limit.type)?.label || limit.type })));

const LIMIT_BY_TYPE = new Map(STACK_LIMITS.map(limit => [limit.type, limit]));

/** A rule's skill, lowercased like the aggregator compares it, or ALL when it names none. */
function categoryOf(payload) {
    const category = payload?.category;
    if (!category || category === TARGET_CATEGORIES.ALL) return TARGET_CATEGORIES.ALL;
    return String(category).toLowerCase();
}

/**
 * The always-on rules one reference adds toward a limit, as `[{ type, category, value }]`, `value`
 * signed so a positive number is toward the limit.
 */
function rowsOf(entry, ref) {
    if (!entry) return [];
    const out = [];
    for (const statement of statementsFromEntry(entry, ref)) {
        if (statement?.keyword !== KEYWORD.PROVIDES || statement.when?.event) continue;
        const payload = statement.payload || {};
        const limit = LIMIT_BY_TYPE.get(payload.type);
        if (!limit) continue;
        if ((payload.bucket || 'percentage') !== limit.bucket) continue;
        const value = Number(payload.value);
        if (!Number.isFinite(value) || value === 0) continue;
        out.push({ type: payload.type, category: categoryOf(payload), value: value * limit.sign });
    }
    return out;
}

/** What `rows` add toward `type` on `category`: a rule naming no skill counts on every one. */
function toward(rows, type, category) {
    let total = 0;
    for (const row of rows) {
        if (row.type !== type) continue;
        if (row.category === TARGET_CATEGORIES.ALL || row.category === category) total += row.value;
    }
    return total;
}

/** A skill's name for the message, or every skill for a rule naming none. */
function categoryLabel(category) {
    if (category === TARGET_CATEGORIES.ALL) return 'every skill';
    return getSkill(category)?.name || category;
}

/**
 * The best stack of worn gear and perks toward each limit, on each skill some rule names (and on
 * every skill at once).
 * @param {{ items?: object, effects?: object, skillPerks?: object }} content
 * @returns {Array<{ type: string, category: string, total: number, limit: object, pieces: Array<{ itemId: string, name: string, value: number }>, perks: number }>}
 */
export function bestEffectStacks({ items, effects, skillPerks } = {}) {
    const gear = [];
    for (const def of asList(items)) {
        if (!def || typeof def !== 'object' || !isWornGear(def)) continue;
        const rows = effectRefsOf(def).flatMap(ref => rowsOf(effects?.[ref.effectId], ref));
        if (rows.length) gear.push({ def, rows });
    }
    const perkRows = [];
    for (const record of asList(skillPerks)) {
        for (const row of Array.isArray(record?.perks) ? record.perks : []) {
            if (!row?.effectId) continue;
            perkRows.push(rowsOf(effects?.[row.effectId], { effectId: row.effectId, scale: row.scale ?? 1 }));
        }
    }

    const categories = new Map();
    for (const rows of [...gear.map(g => g.rows), ...perkRows]) {
        for (const { type, category } of rows) {
            if (!categories.has(type)) categories.set(type, new Set([TARGET_CATEGORIES.ALL]));
            categories.get(type).add(category);
        }
    }

    const out = [];
    for (const limit of STACK_LIMITS) {
        for (const category of categories.get(limit.type) || []) {
            const candidates = [];
            for (const { def, rows } of gear) {
                const value = toward(rows, limit.type, category);
                if (value > 0) candidates.push({ def, value });
            }
            const pieces = bestPieces(candidates);
            let perks = 0;
            for (const rows of perkRows) perks += Math.max(0, toward(rows, limit.type, category));
            const total = pieces.reduce((n, p) => n + p.value, 0) + perks;
            out.push({
                type: limit.type, category, total, limit, perks,
                pieces: pieces.map(p => ({ itemId: p.def.id, name: p.def.name || p.def.id, value: p.value }))
            });
        }
    }
    return out;
}

/**
 * Every effect whose best stack reaches its own limit. A skill is left out when every skill at once
 * already reaches it.
 * @param {{ items?: object, effects?: object, skillPerks?: object }} content
 */
export function effectStackFindings(content = {}) {
    const stacks = bestEffectStacks(content).filter(s => s.total >= s.limit.reach - 1e-9);
    const everywhere = new Set(stacks.filter(s => s.category === TARGET_CATEGORIES.ALL).map(s => s.type));
    const out = [];
    for (const stack of stacks) {
        if (stack.category !== TARGET_CATEGORIES.ALL && everywhere.has(stack.type)) continue;
        const { limit } = stack;
        const top = [...stack.pieces].sort((a, b) => b.value - a.value)[0];
        const parts = stack.pieces.map(p => `${p.name} ${limit.step(p.value)}`);
        if (stack.perks) parts.push(`milestone perks ${limit.step(stack.perks)}`);
        out.push({
            entityType: top ? 'Item' : 'Milestone perks',
            entityId: top?.itemId ?? null,
            entityName: top?.name ?? '',
            field: 'effects',
            message: `lets a hero's best stack of gear and perks reach ${limit.label} ${limit.shown(stack.total)} on ${categoryLabel(stack.category)} (${parts.join(', ')}): that is ${limit.why}, where more stops helping. Lower one of these in the CMS.`
        });
    }
    return out;
}
