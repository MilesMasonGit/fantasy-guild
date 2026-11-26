/**
 * The number pack writer: the balance solver's rows (`.claude/skills/balancer/balance_solver.cjs`,
 * one row per catalogue entry, keyed by its catalogue id) turned into a change pack that gives each
 * Planned entry its work as the CMS holds it. A made item gets a Planned recipe in its skill's pool;
 * a gathering Token gets its cycle on its own record; a Planned crop recipe gets its numbers.
 * Every entry the pack touches stays Planned, so none of it reaches the game.
 *
 * Pure: it reads the workspace it is given and returns the pack, never a changed workspace. Where a
 * Planned entry maps to no clear recipe or Token cycle it is listed as unclear, for the content
 * session, and the pack leaves it alone.
 */

import { fingerprint, currentValue, PACK_FORMAT, PACK_VERSION } from './changePacks.js';
import { isSkillId, isGatheringSkill } from '../../../src/config/registries/skillRegistry.js';
import { PLAN_STATUS } from '../../../src/systems/progression/ledger/plan.js';

const isPlanned = (record) => record?.plan?.status === PLAN_STATUS.PLANNED;
const sameName = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();
const ms = (seconds) => Math.round(seconds * 1000);
const output = (itemId, qty) => ({ itemId, chance: 100, minQty: qty, maxQty: qty, baseQty: { min: qty, max: qty }, variable: false });

/** Every Planned item, Token and recipe of the workspace, as `{ kind, id, record }`. */
export function plannedEntries(workspace) {
    const out = [];
    for (const [id, record] of Object.entries(workspace?.items || {})) if (isPlanned(record)) out.push({ kind: 'item', id, record });
    for (const [id, record] of Object.entries(workspace?.tokens || {})) if (isPlanned(record)) out.push({ kind: 'token', id, record });
    for (const pool of Object.values(workspace?.recipePools || {})) {
        for (const record of pool || []) if (isPlanned(record) && record?.id) out.push({ kind: 'recipe', id: record.id, record });
    }
    return out;
}

/** The solver's rows from what it returned or a file of them: `{ rows: [...] }` or the list itself. */
export function solverRows(solved) {
    const rows = Array.isArray(solved) ? solved : solved?.rows;
    if (!Array.isArray(rows)) throw new Error('The solver output holds no rows: expected { "rows": [...] } or a list of rows.');
    return rows;
}

function recipesMaking(workspace, itemId) {
    const out = [];
    for (const pool of Object.values(workspace?.recipePools || {})) {
        for (const r of pool || []) if ((r?.outputs || []).some((o) => o?.itemId === itemId)) out.push(r);
    }
    return out;
}

function findRecipeById(workspace, id) {
    for (const pool of Object.values(workspace?.recipePools || {})) {
        const r = (pool || []).find((x) => x?.id === id);
        if (r) return r;
    }
    return null;
}

/** The numbers a row gives, as a line the review shows. */
function numbersLine(row) {
    const moved = row.planned != null && row.level !== row.planned ? ` (moved from ${row.planned})` : '';
    return `level ${row.level}${moved}, ${row.seconds} s, ${row.xp} XP`;
}

/**
 * The row's inputs as the workspace's items: matched in order to the Planned entry's `plan.madeWith`
 * (the content session's own mapping) and checked by name. Returns `{ inputs }` or `{ unclear }`.
 */
function inputsOf(row, record, workspace) {
    const solverInputs = row.inputs || [];
    const madeWith = Array.isArray(record.plan?.madeWith) ? record.plan.madeWith : [];
    if (solverInputs.length !== madeWith.length) {
        return { unclear: `the solver has ${solverInputs.length} ingredients (${solverInputs.map((i) => i.name).join(', ') || 'none'}) and the plan's madeWith ${madeWith.length} (${madeWith.join(', ') || 'none'})` };
    }
    const inputs = [];
    for (let i = 0; i < solverInputs.length; i++) {
        const want = solverInputs[i];
        const itemId = madeWith[i];
        const item = workspace?.items?.[itemId];
        if (!item) return { unclear: `its ingredient ${want.name} is ${itemId} in the plan, which is not in the workspace` };
        if (!sameName(item.name, want.name)) return { unclear: `its ingredient ${want.name} is ${itemId} (${item.name}) in the plan; the names differ` };
        if (!(Number.isInteger(want.count) && want.count >= 1)) return { unclear: `the solver gives ${want.name} a count of ${want.count}` };
        inputs.push({ itemId, quantity: want.count });
    }
    return { inputs };
}

/** A made item: a new Planned recipe in its skill's pool (or new numbers on the Planned recipe already there). */
function itemWork(entry, row, workspace) {
    const { id, record } = entry;
    const skill = record.plan?.skill;
    if (!isSkillId(skill)) return { unclear: `its plan names no skill the game has (${skill ?? 'none'})` };
    const making = recipesMaking(workspace, id);
    const recipeId = `recipe_${id.replace(/^item_/, '')}`;
    const existing = findRecipeById(workspace, recipeId);
    const others = making.filter((r) => r.id !== recipeId);
    if (others.length) return { unclear: `the workspace already has ${others.map((r) => r.id).join(', ')} making it` };
    if (existing && !isPlanned(existing)) return { unclear: `${recipeId} is already in the workspace and is not Planned` };
    if (existing && existing.plan?.catalogueId && existing.plan.catalogueId !== row.id) {
        return { unclear: `${recipeId} is already in the workspace for catalogue entry ${existing.plan.catalogueId}` };
    }
    const got = inputsOf(row, record, workspace);
    if (got.unclear) return got;
    const value = {
        ...(existing || {}),
        name: existing?.name ?? record.name,
        skill: existing?.skill ?? skill,
        levelRequirement: row.level,
        requiresContext: existing?.requiresContext ?? [],
        inputs: got.inputs,
        outputs: [output(id, row.makes || 1)],
        xp: row.xp,
        durationMs: ms(row.seconds),
        stationChargeCost: existing?.stationChargeCost ?? 1,
        plan: {
            ...(existing?.plan || {}),
            status: PLAN_STATUS.PLANNED,
            tier: existing?.plan?.tier ?? record.plan?.tier ?? 0,
            catalogueId: row.id,
            skill,
            level: row.level,
            note: existing?.plan?.note ?? `The work of ${record.name}, from the balance solver: ${row.work}, at any ${skill} station.`,
        },
    };
    delete value.id;
    return {
        entry: existing
            ? { op: 'edit', kind: 'recipe', id: recipeId, value, fingerprint: fingerprint(existing), note: `${record.name}: ${numbersLine(row)}, from the balance solver.` }
            : { op: 'create', kind: 'recipe', id: recipeId, value, note: `${record.name}: its recipe, ${numbersLine(row)}, makes ${row.makes || 1}, from the balance solver.` },
        station: skill,
    };
}

/** What a gathering Token or a crop gives, in workspace ids: the plan's `gives`, one item. */
function givesOf(record, workspace) {
    const gives = Array.isArray(record.plan?.gives) ? record.plan.gives : [];
    if (!gives.length) return { unclear: 'its plan names nothing it gives' };
    const missing = gives.filter((g) => !workspace?.items?.[g]);
    if (missing.length) return { unclear: `it gives ${missing.join(', ')}, not in the workspace` };
    // ⚠️ The solver times one cycle and one thing made; how several things share a cycle is the content session's call.
    if (gives.length > 1) return { unclear: `it gives ${gives.join(' and ')}; the solver times one cycle and does not say how they share it` };
    return { gives };
}

/** A gathering Token: its cycle on its own record (the skill, level, time, XP and what it gives). */
function tokenWork(entry, row, workspace) {
    const { id, record } = entry;
    const skill = record.plan?.skill;
    if (!isSkillId(skill) || !isGatheringSkill(skill)) {
        return { unclear: `a ${row.skill || skill || 'skill-less'} Token is not a gathering cycle the CMS holds (no recipe, no Token cycle)` };
    }
    const got = givesOf(record, workspace);
    if (got.unclear) return got;
    const qty = row.makes || 1;
    const value = {
        ...record,
        config: {
            ...(record.config || {}),
            skill,
            skillRequired: row.level,
            cycleTimeMs: ms(row.seconds),
            xp: row.xp,
            inputs: record.config?.inputs ?? [],
            outputs: got.gives.map((itemId) => output(itemId, qty)),
        },
    };
    delete value.id;
    return {
        entry: { op: 'edit', kind: 'token', id, value, fingerprint: fingerprint(currentValue(workspace, 'token', id)), note: `${record.name}: its cycle, ${numbersLine(row)}, gives ${got.gives.join(', ')}, from the balance solver.` },
        station: id,
    };
}

/** A Planned crop recipe (Farming): its numbers on the recipe itself, its seeds and grow time left as they are. */
function cropWork(entry, row, workspace) {
    const { id, record } = entry;
    const got = givesOf(record, workspace);
    if (got.unclear) return got;
    const qty = row.makes || 1;
    const value = {
        ...record,
        levelRequirement: row.level,
        requiresContext: record.requiresContext ?? [],
        inputs: record.inputs ?? [],
        outputs: got.gives.map((itemId) => output(itemId, qty)),
        xp: row.xp,
        durationMs: ms(row.seconds),
        stationChargeCost: record.stationChargeCost ?? 1,
    };
    delete value.id;
    return {
        entry: { op: 'edit', kind: 'recipe', id, value, fingerprint: fingerprint(currentValue(workspace, 'recipe', id)), note: `${record.name}: ${numbersLine(row)}, gives ${got.gives.join(', ')}, from the balance solver.` },
        station: record.skill,
    };
}

/**
 * The pack, and what it left out.
 * @param {object} workspace the CMS workspace (its collections), read only
 * @param {object[]} rows the solver's rows (`solve(...).rows`)
 * @param {{ id: string, createdAt?: string, asked?: string }} meta
 * @returns {{ pack: object|null, filled: object[], unclear: object[], skipped: object[] }}
 *   `filled` one line per entry written, `unclear` the entries for the content session (each with
 *   its reason), `skipped` the Planned entries with no work to write and why.
 */
export function writeNumberPack(workspace, rows, { id, createdAt = new Date().toISOString(), asked } = {}) {
    const byCatalogue = new Map();
    for (const row of rows || []) if (row?.id) byCatalogue.set(row.id, row);
    const planned = plannedEntries(workspace);
    const claims = new Map();
    for (const e of planned) {
        const c = e.record.plan?.catalogueId;
        if (c) claims.set(c, [...(claims.get(c) || []), `${e.kind} ${e.id}`]);
    }

    const entries = [];
    const filled = [];
    const unclear = [];
    const skipped = [];
    const at = (e, row) => ({ kind: e.kind, id: e.id, name: e.record.name ?? e.id, catalogueId: e.record.plan?.catalogueId ?? null, skill: row?.skill || e.record.plan?.skill || '' });

    for (const e of planned) {
        const catalogueId = e.record.plan?.catalogueId;
        if (!catalogueId) { skipped.push({ ...at(e), reason: 'no catalogue id in its plan' }); continue; }
        const row = byCatalogue.get(catalogueId);
        if (!row) { unclear.push({ ...at(e), reason: `the solver has no row for catalogue entry ${catalogueId}` }); continue; }
        if (claims.get(catalogueId).length > 1) { unclear.push({ ...at(e, row), reason: `catalogue entry ${catalogueId} is claimed by ${claims.get(catalogueId).join(' and ')}` }); continue; }
        if (!row.work) { skipped.push({ ...at(e, row), reason: row.why || 'no work of its own' }); continue; }
        if (row.level == null || !(row.seconds > 0) || !(row.xp >= 1)) { skipped.push({ ...at(e, row), reason: row.why || 'the solver gave it no numbers' }); continue; }
        if (/^combat$/i.test(row.skill) || /^combat$/i.test(e.record.plan?.skill || '')) { skipped.push({ ...at(e, row), reason: 'combat numbers are not the balance solver\'s' }); continue; }

        let result;
        if (e.kind === 'item' && (row.work === 'make' || row.work === 'prepare')) result = itemWork(e, row, workspace);
        else if (e.kind === 'token' && row.work === 'gather') result = tokenWork(e, row, workspace);
        else if (e.kind === 'recipe' && row.work === 'gather') result = cropWork(e, row, workspace);
        else if (e.kind === 'item' && row.work === 'gather') result = { unclear: `a catch or find with a level of its own (${row.level}): no recipe or Token cycle of its own to hold it` };
        else result = { unclear: `a Planned ${e.kind} whose solver work is ${row.work}: no clear recipe or Token cycle` };

        if (result.unclear) { unclear.push({ ...at(e, row), reason: result.unclear }); continue; }
        entries.push(result.entry);
        filled.push({ ...at(e, row), op: result.entry.op, writes: `${result.entry.kind} ${result.entry.id}`, level: row.level, seconds: row.seconds, xp: row.xp, makes: row.makes || 1, station: result.station });
    }

    const pack = entries.length ? {
        format: PACK_FORMAT,
        version: PACK_VERSION,
        id,
        createdAt,
        asked: asked || 'The balance solver\'s numbers onto the plan\'s Planned entries, still Planned (T-724).',
        entries,
    } : null;
    return { pack, filled, unclear, skipped };
}

/** The unclear list as text for the content session. */
export function unclearText(unclear) {
    if (!unclear.length) return ['Nothing unclear.'];
    return unclear.map((u) => `- ${u.name} (${u.kind} ${u.id}${u.catalogueId ? `, catalogue ${u.catalogueId}` : ''}${u.skill ? `, ${u.skill}` : ''}): ${u.reason}`);
}
