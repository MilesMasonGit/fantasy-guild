import { planOf, cleanPlan, PLAN_STATUS } from '../../../src/systems/progression/ledger/plan.js';
import { itemKey, tokenKey, recipeKey } from '../../../src/systems/progression/ledger/engine.js';
import { isMapItem } from '../../../src/systems/atlas/mapItems.js';

/**
 * The Ledger tab's list: one row per item, map, Token (enemies apart) and recipe in the workspace,
 * with its plan. Pure; the tab reads the store and writes back through `planPatch`.
 */

/** The kinds the tab lists, in its order. */
export const LEDGER_KINDS = Object.freeze(['item', 'map', 'token', 'enemy', 'recipe']);

export const LEDGER_KIND_TEXT = Object.freeze({
    item: 'Item', map: 'Map', token: 'Token', enemy: 'Enemy', recipe: 'Recipe',
});

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * @returns {{ rowKey, kind, id, name, status, tier, note, ledgerKey, collection?, poolSkill?, index? }[]}
 *   sorted by kind, then name. `ledgerKey` is the entry's key in the reach engine; `collection` (items,
 *   tokens) or `poolSkill` and `index` (recipes) say where the record lives.
 */
export function ledgerRows({ items = {}, tokens = {}, recipePools = {} } = {}) {
    const rows = [];
    const push = (base, def) => {
        const { status, tier, note } = planOf(def);
        rows.push({ ...base, name: def?.name || base.id, status, tier, note });
    };
    for (const [id, def] of Object.entries(items || {})) {
        if (!isObject(def)) continue;
        push({ rowKey: `items:${id}`, kind: isMapItem(def) ? 'map' : 'item', id, collection: 'items', ledgerKey: itemKey(def.id ?? id) }, def);
    }
    for (const [id, def] of Object.entries(tokens || {})) {
        if (!isObject(def)) continue;
        push({ rowKey: `tokens:${id}`, kind: isObject(def.enemy) ? 'enemy' : 'token', id, collection: 'tokens', ledgerKey: tokenKey(def.id ?? id) }, def);
    }
    for (const [skill, pool] of Object.entries(recipePools || {})) {
        (Array.isArray(pool) ? pool : []).forEach((recipe, index) => {
            if (!isObject(recipe)) return;
            const id = recipe.id || `${skill}#${index}`;
            push({ rowKey: `recipes:${skill}:${index}:${id}`, kind: 'recipe', id, poolSkill: skill, index, ledgerKey: recipeKey(id) }, recipe);
        });
    }
    const order = (k) => LEDGER_KINDS.indexOf(k);
    return rows.sort((a, b) => order(a.kind) - order(b.kind) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/**
 * Rows matching every filter given. `tier` is a number, `'none'` for rows with no tier, or empty
 * for any; `search` matches name, id or note, case-blind.
 */
export function filterLedgerRows(rows, { kind = '', status = '', tier = '', search = '' } = {}) {
    const q = String(search || '').trim().toLowerCase();
    return rows.filter((row) => {
        if (kind && row.kind !== kind) return false;
        if (status && row.status !== status) return false;
        if (tier === 'none' && row.tier !== null) return false;
        if (tier !== '' && tier !== 'none' && row.tier !== Number(tier)) return false;
        if (q && !`${row.name}\n${row.id}\n${row.note}`.toLowerCase().includes(q)) return false;
        return true;
    });
}

/** The `{ plan }` patch that sets part of a record's plan block, as the editors' Plan section writes it. */
export function planPatch(record, patch) {
    return { plan: cleanPlan({ ...(isObject(record?.plan) ? record.plan : {}), ...patch }) };
}

/** The plan block a new Planned stub starts with. */
export function stubPlan({ tier = null, note = '' } = {}) {
    return cleanPlan({ status: PLAN_STATUS.PLANNED, tier, note });
}

/** A reach result in the tab's words: the tier it is first reachable at, "never", or "planned". */
export function reachText(reach, label) {
    if (!reach) return '—';
    if (reach.planned) return 'Planned';
    if (reach.tier === null) return 'Never';
    return label(reach.tier) + (reach.luckOnly ? ' (luck)' : '');
}
