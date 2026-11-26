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
 *
 * Its live mode ({@link writeLiveNumberPack}) does the same for the Live recipes and gathering
 * Tokens the content session's id map (`docs/active/content_cms_ids.json`) matches to the
 * catalogue, with their XP pinned. Both modes give a gathering Token its uses and rest by the rest
 * rule (BALANCE_RULES section 2, {@link restTerms}).
 */

import { fingerprint, currentValue, PACK_FORMAT, PACK_VERSION } from './changePacks.js';
import { isSkillId, isGatheringSkill } from '../../../src/config/registries/skillRegistry.js';
import { PLAN_STATUS, DEFAULT_PLAN_STATUS } from '../../../src/systems/progression/ledger/plan.js';
import { respawnOf } from '../../../src/config/registries/tokenConstants.js';

const isPlanned = (record) => record?.plan?.status === PLAN_STATUS.PLANNED;
const sameName = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();
const ms = (seconds) => Math.round(seconds * 1000);
const output = (itemId, qty, chance = 100) => ({ itemId, chance, minQty: qty, maxQty: qty, baseQty: { min: qty, max: qty }, variable: false });
const isLive = (record) => (record?.plan?.status ?? DEFAULT_PLAN_STATUS) === PLAN_STATUS.LIVE;

/** The rest rule (BALANCE_RULES section 2): about 30 s of work at a node, then back in about 30 s. */
export const REST_RULE = Object.freeze({ workMs: 30000, restMs: 30000 });

/**
 * A gathering Token's uses and rest by the rest rule, for a cycle of `cycleMs`: `{ patch, unclear }`.
 * It runs out by a chance a cycle (`tokenConstants.endTermsOf`), so its average work is
 * cycle × 100 / chance; the chance that makes that about 30 s is 100 × cycle / 30 s, one decimal,
 * 100 at most. `patch` holds the Token's new `endChance` (its `uses` then mean nothing and go, as
 * the Token editor does) and, for a refill that needs no owner, its 30 s rest. `unclear` says why
 * the rest (or the whole of it) is not written: a regrow's time is its Stump's growth and a gated
 * refill rests only beside its owner, so "back in 30 s" is not one number on this record.
 * ⚠️ Assumes a cycle spends one charge, which every gathering Token does today.
 */
export function restTerms(record, cycleMs, workspace) {
    const back = respawnOf(record);
    if (!back) return { patch: null, unclear: 'no respawn: it leaves the mat when spent (or never runs out), so an end chance would do nothing and there is no rest to write' };
    const endChance = Math.min(100, Math.round(1000 * cycleMs / REST_RULE.workMs) / 10);
    const patch = { endChance };
    if (back.mode === 'refill' && !back.needsNearby.length) {
        patch.respawn = { ...record.respawn, afterMs: REST_RULE.restMs };
        return { patch, unclear: null };
    }
    if (back.mode === 'refill') return { patch, unclear: `its end chance written (${endChance} %); its rest not: it refills only while its ${back.needsNearby.join(' or ')} stands` };
    return { patch, unclear: `its end chance written (${endChance} %); its rest not: it regrows as ${back.into}, whose own growth is its time back${growthOf(workspace, back.into)}` };
}

/** What the regrow's Token says of its growth, for the unclear line. */
function growthOf(workspace, into) {
    const grows = workspace?.tokens?.[into]?.grows;
    if (!grows) return '';
    const bits = [];
    if (Number.isFinite(grows.afterMs)) bits.push(`${Math.round(grows.afterMs / 1000)} s`);
    if (Array.isArray(grows.needsNearby) && grows.needsNearby.length) bits.push(`needing its ${grows.needsNearby.join(' or ')}`);
    if (Array.isArray(grows.cost) && grows.cost.length) bits.push('at a cost');
    return bits.length ? ` (${bits.join(', ')})` : '';
}

/** A Token's value with its uses and rest: the patch applied, `uses` dropped once an end chance stands. */
function withRest(value, patch) {
    if (!patch) return value;
    const next = { ...value, ...patch };
    delete next.uses;
    return next;
}

/**
 * The plan's `split` (`[{ itemId, share }]`, a share the number a cycle gives on average) as output
 * lines: a whole share is that many every cycle, a share under 1 one at that chance. `{ outputs }`
 * or `{ unclear }`.
 */
function splitOutputs(split, workspace) {
    const outputs = [];
    for (const s of split) {
        if (!workspace?.items?.[s?.itemId]) return { unclear: `its split names ${s?.itemId ?? 'nothing'}, not in the workspace` };
        const share = Number(s.share);
        if (Number.isInteger(share) && share >= 1) outputs.push(output(s.itemId, share));
        else if (share > 0 && share < 1) outputs.push(output(s.itemId, 1, Math.round(share * 10000) / 100));
        else return { unclear: `its split gives ${s.itemId} a share of ${s.share}: only a whole number or a share under 1 is one output line` };
    }
    return { outputs };
}

const splitOf = (record) => (Array.isArray(record?.plan?.split) && record.plan.split.length ? record.plan.split : null);

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

/** What a gathering Token or a crop gives, in workspace ids: the plan's `gives`, one item, or its `split`. */
function givesOf(record, workspace) {
    const gives = Array.isArray(record.plan?.gives) ? record.plan.gives : [];
    const split = splitOf(record);
    if (split) {
        const named = split.map((x) => x?.itemId);
        if (gives.length && (gives.length !== named.length || gives.some((g) => !named.includes(g)))) {
            return { unclear: `its split (${named.join(', ')}) and its plan's gives (${gives.join(', ')}) name different things` };
        }
        const got = splitOutputs(split, workspace);
        return got.unclear ? got : { gives: named, outputs: got.outputs };
    }
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
    const rest = restTerms(record, ms(row.seconds), workspace);
    const value = withRest({
        ...record,
        config: {
            ...(record.config || {}),
            skill,
            skillRequired: row.level,
            cycleTimeMs: ms(row.seconds),
            xp: row.xp,
            inputs: record.config?.inputs ?? [],
            outputs: got.outputs ?? got.gives.map((itemId) => output(itemId, qty)),
        },
    }, rest.patch);
    delete value.id;
    return {
        rest: rest.unclear,
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
    const restUnclear = [];
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
        if (result.rest) restUnclear.push({ ...at(e, row), reason: result.rest });
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
    return { pack, filled, unclear, skipped, restUnclear };
}

/**
 * The content session's id map (`docs/active/content_catalogue.json` ids to CMS ids) both ways:
 * `toCms` every catalogue id to its CMS id, staged or live (an ingredient's id is its id either way),
 * and `toCatalogue` each Live CMS id to the catalogue ids that map to it.
 */
export function liveIdMap(idMap) {
    const ids = idMap?.ids;
    if (!ids || typeof ids !== 'object') throw new Error('The id map holds no ids: expected { "ids": { <catalogue id>: { "cms": ..., "how": ... } } }.');
    const toCms = new Map();
    const toCatalogue = new Map();
    for (const [catalogueId, v] of Object.entries(ids)) {
        if (typeof v?.cms !== 'string') continue;
        toCms.set(catalogueId, v.cms);
        if (/\blive\b/i.test(v.how || '')) toCatalogue.set(v.cms, [...(toCatalogue.get(v.cms) || []), catalogueId]);
    }
    return { toCms, toCatalogue };
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x)) && b.every((x) => a.includes(x));
const qtyRange = (o) => {
    const min = o?.minQty ?? o?.baseQty?.min ?? o?.quantity ?? 1;
    const max = o?.maxQty ?? o?.baseQty?.max ?? o?.quantity ?? 1;
    return min === max ? `${min}` : `${min} to ${max}`;
};

/**
 * A Live record's outputs with the solver's numbers: by its plan's split when it has one, else its
 * one sure output (chance 100) given the solver's count and its chance extras kept as they are.
 * The things it gives must be the catalogue's (`want`, CMS ids). `{ outputs, was }` or `{ unclear }`.
 */
function liveOutputs(record, current, want, makes, workspace, name) {
    const split = splitOf(record);
    if (split) {
        const named = split.map((x) => x?.itemId);
        if (!sameSet(named, want)) return { unclear: `its split (${named.map(name).join(', ')}) differs from the catalogue's output (${want.map(name).join(', ')})` };
        const got = splitOutputs(split, workspace);
        return got.unclear ? got : { outputs: got.outputs, was: '' };
    }
    const have = [...new Set((current || []).map((o) => o?.itemId))];
    if (!sameSet(have, want)) return { unclear: `its output (${have.join(', ') || 'none'}) differs from the catalogue's (${want.join(', ')})` };
    const sure = (current || []).filter((o) => (o?.chance ?? 100) >= 100);
    if (sure.length !== 1) {
        return { unclear: sure.length ? `${sure.length} sure outputs (${sure.map((o) => name(o.itemId)).join(', ')}) share its cycle with no split saying how` : 'it has no sure output, only chances: the solver\'s count has nowhere to go' };
    }
    const main = sure[0];
    const was = qtyRange(main) === String(makes) ? '' : ` (${name(main.itemId)} was ${qtyRange(main)} a cycle)`;
    return {
        outputs: current.map((o) => (o === main ? { ...o, chance: 100, minQty: makes, maxQty: makes, baseQty: { min: makes, max: makes }, variable: false } : o)),
        was,
    };
}

/**
 * The live pack: the solver's numbers onto each Live recipe and gathering Token the id map matches
 * to a catalogue entry, as fingerprinted edits. Each carries its level, time, XP (pinned, so
 * Recalculate keeps it: `sim.xpPinned`), its input counts and its output counts; a gathering Token
 * also its uses and rest. A Live entry with no match, two, ingredients or an output other than the
 * catalogue's, is listed as unclear and left alone.
 * ⚠️ Recalculate still derives the cycle time and output counts of a record tagged with a Tempo and
 * a Purpose (`sim/tempoPass.js`, `tuningPass.js`); only the XP has a pin. `filled[].tagged` says which.
 * @param {object} workspace the CMS workspace, read only
 * @param {object[]} rows the solver's rows
 * @param {{ ids: object, catalogue: object|object[], id: string, createdAt?: string, asked?: string }} options
 *   `ids` the id map file's contents, `catalogue` the catalogue (`{ entries }` or the list)
 * @returns {{ pack: object|null, filled: object[], unclear: object[], skipped: object[], restUnclear: object[] }}
 */
export function writeLiveNumberPack(workspace, rows, { ids, catalogue, id, createdAt = new Date().toISOString(), asked } = {}) {
    const { toCms, toCatalogue } = liveIdMap(ids);
    const catalogueEntries = Array.isArray(catalogue) ? catalogue : catalogue?.entries;
    if (!Array.isArray(catalogueEntries)) throw new Error('The catalogue holds no entries: expected { "entries": [...] } or a list.');
    const byEntry = new Map(catalogueEntries.map((e) => [e.id, e]));
    const byCatalogue = new Map();
    for (const row of rows || []) if (row?.id) byCatalogue.set(row.id, row);
    const name = (itemId) => workspace?.items?.[itemId]?.name ?? itemId;

    const candidates = [];
    for (const [pool, list] of Object.entries(workspace?.recipePools || {})) {
        for (const record of list || []) {
            if (!record?.id || !isLive(record)) continue;
            const own = toCatalogue.get(record.id);
            const viaOutputs = [...new Set((record.outputs || []).flatMap((o) => toCatalogue.get(o?.itemId) || []))];
            candidates.push({ kind: 'recipe', id: record.id, record, pool, matches: own || viaOutputs });
        }
    }
    for (const [tokenId, record] of Object.entries(workspace?.tokens || {})) {
        if (!isLive(record) || !isGatheringSkill(record?.config?.skill)) continue;
        candidates.push({ kind: 'token', id: tokenId, record, matches: toCatalogue.get(tokenId) || [] });
    }
    const claims = new Map();
    for (const c of candidates) if (c.matches.length === 1) claims.set(c.matches[0], [...(claims.get(c.matches[0]) || []), `${c.kind} ${c.id}`]);

    const entries = [];
    const filled = [];
    const unclear = [];
    const skipped = [];
    const restUnclear = [];
    const at = (c, catalogueId, row) => ({ kind: c.kind, id: c.id, name: c.record.name ?? c.id, catalogueId: catalogueId ?? null, skill: row?.skill || c.record.skill || c.record.config?.skill || '' });

    for (const c of candidates) {
        if (!c.matches.length) { unclear.push({ ...at(c), reason: 'no catalogue match in the id map' }); continue; }
        if (c.matches.length > 1) { unclear.push({ ...at(c), reason: `it matches several catalogue entries (${c.matches.join(', ')})` }); continue; }
        const catalogueId = c.matches[0];
        const entry = byEntry.get(catalogueId);
        const row = byCatalogue.get(catalogueId);
        if (!entry || !row) { unclear.push({ ...at(c, catalogueId), reason: `the ${entry ? 'solver has no row' : 'catalogue has no entry'} for ${catalogueId}` }); continue; }
        if (claims.get(catalogueId).length > 1) { unclear.push({ ...at(c, catalogueId, row), reason: `catalogue entry ${catalogueId} is matched by ${claims.get(catalogueId).join(' and ')}` }); continue; }
        if (!row.work) { skipped.push({ ...at(c, catalogueId, row), reason: row.why || 'no work of its own' }); continue; }
        if (row.level == null || !(row.seconds > 0) || !(row.xp >= 1)) { skipped.push({ ...at(c, catalogueId, row), reason: row.why || 'the solver gave it no numbers' }); continue; }
        if (/^combat$/i.test(row.skill)) { skipped.push({ ...at(c, catalogueId, row), reason: 'combat numbers are not the balance solver\'s' }); continue; }

        const result = liveWork(c, entry, row, { workspace, toCms, name });
        if (result.unclear) { unclear.push({ ...at(c, catalogueId, row), reason: result.unclear }); continue; }
        const { record } = c;
        const current = currentValue(workspace, c.kind, c.id);
        const tagged = Boolean(record.sim?.tempo && record.sim?.purpose);
        entries.push({
            op: 'edit', kind: c.kind, id: c.id, value: result.value, fingerprint: fingerprint(current),
            note: `${record.name ?? c.id}: ${numbersLine(row)}${result.was}, from the balance solver; XP pinned, so Recalculate keeps it.`,
        });
        if (result.rest) restUnclear.push({ ...at(c, catalogueId, row), reason: result.rest });
        filled.push({ ...at(c, catalogueId, row), op: 'edit', writes: `${c.kind} ${c.id}`, level: row.level, seconds: row.seconds, xp: row.xp, makes: row.makes || 1, tagged });
    }

    const pack = entries.length ? {
        format: PACK_FORMAT,
        version: PACK_VERSION,
        id,
        createdAt,
        asked: asked || 'The balance solver\'s numbers onto the Live recipes and gathering Tokens the catalogue matches, XP pinned (T-724, live mode).',
        entries,
    } : null;
    return { pack, filled, unclear, skipped, restUnclear };
}

/** One Live candidate's new value: `{ value, was, rest }` or `{ unclear }`. */
function liveWork(c, entry, row, { workspace, toCms, name }) {
    const { record } = c;
    const makes = row.makes || 1;
    const seconds = ms(row.seconds);
    const pin = { ...(record.sim || {}), xpPinned: true };

    if (c.kind === 'recipe' && (row.work === 'make' || row.work === 'prepare')) {
        const madeWith = entry.madeWith || [];
        const unmapped = madeWith.filter((m) => !toCms.has(m));
        if (unmapped.length) return { unclear: `its catalogue ingredients ${unmapped.join(', ')} have no CMS id in the id map` };
        const want = madeWith.map((m) => toCms.get(m));
        const have = (record.inputs || []).map((i) => i?.itemId);
        if (!sameSet(have, want)) return { unclear: `its ingredients (${have.map(name).join(', ') || 'none'}) differ from the catalogue's (${want.map(name).join(', ') || 'none'})` };
        const counts = new Map((row.inputs || []).map((i) => [toCms.get(i.id), i.count]));
        const bad = want.find((w) => !(Number.isInteger(counts.get(w)) && counts.get(w) >= 1));
        if (bad) return { unclear: `the solver gives ${name(bad)} a count of ${counts.get(bad)}` };
        const out = toCms.get(entry.id);
        if (!out) return { unclear: `the catalogue's ${entry.id} has no CMS id in the id map` };
        const outs = liveOutputs(record, record.outputs, [out], makes, workspace, name);
        if (outs.unclear) return outs;
        const value = {
            ...record,
            skill: record.skill ?? c.pool,
            levelRequirement: row.level,
            inputs: (record.inputs || []).map((i) => ({ ...i, quantity: counts.get(i.itemId) })),
            outputs: outs.outputs,
            xp: row.xp,
            durationMs: seconds,
            sim: pin,
        };
        delete value.id;
        return { value, was: outs.was };
    }

    if (row.work !== 'gather') return { unclear: `a Live ${c.kind} whose solver work is ${row.work}: no clear recipe or Token cycle` };
    const gives = entry.gives || [];
    if (!gives.length) return { unclear: 'the catalogue names nothing it gives' };
    const unmapped = gives.filter((g) => !toCms.has(g));
    if (unmapped.length) return { unclear: `the catalogue's ${unmapped.join(', ')} have no CMS id in the id map` };
    const want = gives.map((g) => toCms.get(g));

    if (c.kind === 'recipe') {
        // A crop recipe (a Field's): its seeds and grow time stay as they are.
        const outs = liveOutputs(record, record.outputs, want, makes, workspace, name);
        if (outs.unclear) return outs;
        const value = { ...record, skill: record.skill ?? c.pool, levelRequirement: row.level, outputs: outs.outputs, xp: row.xp, durationMs: seconds, sim: pin };
        delete value.id;
        return { value, was: outs.was };
    }

    const outs = liveOutputs(record, record.config?.outputs, want, makes, workspace, name);
    if (outs.unclear) return outs;
    const rest = restTerms(record, seconds, workspace);
    const value = withRest({
        ...record,
        config: { ...(record.config || {}), skillRequired: row.level, cycleTimeMs: seconds, xp: row.xp, outputs: outs.outputs },
        sim: pin,
    }, rest.patch);
    delete value.id;
    return { value, was: outs.was, rest: rest.unclear };
}

/** The unclear list as text for the content session. */
export function unclearText(unclear) {
    if (!unclear.length) return ['Nothing unclear.'];
    return unclear.map((u) => `- ${u.name} (${u.kind} ${u.id}${u.catalogueId ? `, catalogue ${u.catalogueId}` : ''}${u.skill ? `, ${u.skill}` : ''}): ${u.reason}`);
}
