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
 * rule (BALANCE_RULES section 2, {@link restTerms}), pin every time they write (`sim.timePinned`,
 * so Recalculate keeps it), and leave a gather's yield as the content has it: what one gather
 * gives is the content's, the same at every tier (BALANCE_RULES section 3), so only a plan's split
 * and a craft's count ({@link ruledMakes}) are written, and pinned (`sim.outputsPinned`) wherever
 * they are; outputs left as the content has them are never pinned.
 */

import { fingerprint, currentValue, PACK_FORMAT, PACK_VERSION } from './changePacks.js';
import { isSkillId, isGatheringSkill } from '../../../src/config/registries/skillRegistry.js';
import { PLAN_STATUS, DEFAULT_PLAN_STATUS } from '../../../src/systems/progression/ledger/plan.js';
import { respawnOf } from '../../../src/config/registries/tokenConstants.js';
import { hasCatchPools } from '../../../src/config/registries/catchPools.js';

const isPlanned = (record) => record?.plan?.status === PLAN_STATUS.PLANNED;
const sameName = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();
const ms = (seconds) => Math.round(seconds * 1000);
const output = (itemId, qty, chance = 100) => ({ itemId, chance, minQty: qty, maxQty: qty, baseQty: { min: qty, max: qty }, variable: false });
const isLive = (record) => (record?.plan?.status ?? DEFAULT_PLAN_STATUS) === PLAN_STATUS.LIVE;
/** A record's `sim` with its time pinned: every edit that writes a time carries it, or Recalculate puts a Tempo band's time back. */
const pinTime = (sim) => ({ ...(sim || {}), timePinned: true });
/** A record's `sim` with its outputs pinned too: every edit that writes outputs (a count or a chance) carries it, or Recalculate tunes them away. */
const pinOutputs = (sim) => ({ ...(sim || {}), outputsPinned: true });
/** Did a Planned gather's outputs gain a line (or come from its split)? Then they are the pack's, and pinned. */
const wroteOutputs = (got, outputs, current) => Boolean(got.outputs) || outputs.length !== (Array.isArray(current) ? current.length : 0);

/** A work potion's batch (BALANCE_RULES section 5): a drink or a work potion lasts 25 work cycles and a craft makes 5. */
export const WORK_POTIONS_A_CRAFT = 5;

/**
 * What one craft makes, by the owner's counts (BALANCE_RULES section 3): the solver's `makes`
 * carries the table (40 arrows a Fletching craft, 40 Arrowheads or Kunai a bar, 5 Nails a bar,
 * 5 drinks a craft, 1 otherwise). ⚠️ The solver counts a drink by its type alone, so a work potion
 * (catalogue type `work: ...`) is given its 5 here.
 */
export function ruledMakes(row) {
    if (/^work:/i.test(row?.type || '')) return WORK_POTIONS_A_CRAFT;
    return Number.isInteger(row?.makes) && row.makes >= 1 ? row.makes : 1;
}

/** The rest rule (BALANCE_RULES section 2): about 30 s of work at a node, then back in about 30 s. */
export const REST_RULE = Object.freeze({ workMs: 30000, restMs: 30000 });

/**
 * A gathering Token's uses and rest by the rest rule, for a cycle of `cycleMs`: `{ patch, unclear, stump }`.
 * It runs out by a chance a cycle (`tokenConstants.endTermsOf`), so its average work is
 * cycle × 100 / chance; the chance that makes that about 30 s is 100 × cycle / 30 s, one decimal,
 * 100 at most. `patch` holds the Token's new `endChance` (its `uses` then mean nothing and go, as
 * the Token editor does) and, for a refill that needs no owner, its 30 s rest. A regrow's rest is
 * its Stump's regrowth, so `stump` is the Stump's new value (`{ id, value }`) with `grows.afterMs`
 * at 30 s and its needs (its Forest) as they are; the Forest's own spawning is not the rest and is
 * left alone. `unclear` says why the rest (or the whole of it) is not written: a gated refill
 * rests only beside its owner, and a regrow into a Token with no growth has nowhere to hold it.
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
    const stump = workspace?.tokens?.[back.into];
    if (stump?.grows && typeof stump.grows === 'object') {
        const value = { ...stump, grows: { ...stump.grows, afterMs: REST_RULE.restMs } };
        delete value.id;
        return { patch, unclear: null, stump: { id: back.into, value } };
    }
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
        outputs: [output(id, ruledMakes(row))],
        xp: row.xp,
        durationMs: ms(row.seconds),
        stationChargeCost: existing?.stationChargeCost ?? 1,
        sim: pinOutputs(pinTime(existing?.sim)),
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
            : { op: 'create', kind: 'recipe', id: recipeId, value, note: `${record.name}: its recipe, ${numbersLine(row)}, makes ${ruledMakes(row)}, from the balance solver.` },
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

/**
 * A Planned gather's outputs: its outputs as they are, with a line of 1 for each thing it gives
 * that has none yet. What one gather gives is the content's, the same at every tier
 * (BALANCE_RULES section 3), so the solver's count is never written onto a gather.
 */
function plannedGatherOutputs(current, gives) {
    const list = Array.isArray(current) ? current : [];
    const have = new Set(list.map((o) => o?.itemId));
    return [...list, ...gives.filter((g) => !have.has(g)).map((g) => output(g, 1))];
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
    const rest = restTerms(record, ms(row.seconds), workspace);
    const outputs = got.outputs ?? plannedGatherOutputs(record.config?.outputs, got.gives);
    const sim = pinTime(record.sim);
    const value = withRest({
        ...record,
        config: {
            ...(record.config || {}),
            skill,
            skillRequired: row.level,
            cycleTimeMs: ms(row.seconds),
            xp: row.xp,
            inputs: record.config?.inputs ?? [],
            outputs,
        },
        sim: wroteOutputs(got, outputs, record.config?.outputs) ? pinOutputs(sim) : sim,
    }, rest.patch);
    delete value.id;
    // ⚠️ This pack touches Planned entries only: a Live Stump's regrowth would reach the game.
    const stumpLive = rest.stump && !isPlanned(workspace?.tokens?.[rest.stump.id]);
    return {
        rest: stumpLive ? `its end chance written (${value.endChance} %); its rest not: its Stump ${rest.stump.id} is not Planned, and this pack writes Planned entries only` : rest.unclear,
        stump: stumpLive ? null : rest.stump,
        entry: { op: 'edit', kind: 'token', id, value, fingerprint: fingerprint(currentValue(workspace, 'token', id)), note: `${record.name}: its cycle, ${numbersLine(row)}, gives ${got.gives.join(', ')}, from the balance solver.` },
        station: id,
    };
}

/** A Planned crop recipe (Farming): its numbers on the recipe itself, its seeds and grow time left as they are. */
function cropWork(entry, row, workspace) {
    const { id, record } = entry;
    const got = givesOf(record, workspace);
    if (got.unclear) return got;
    const outputs = got.outputs ?? plannedGatherOutputs(record.outputs, got.gives);
    const sim = pinTime(record.sim);
    const value = {
        ...record,
        levelRequirement: row.level,
        requiresContext: record.requiresContext ?? [],
        inputs: record.inputs ?? [],
        outputs,
        xp: row.xp,
        durationMs: ms(row.seconds),
        stationChargeCost: record.stationChargeCost ?? 1,
        sim: wroteOutputs(got, outputs, record.outputs) ? pinOutputs(sim) : sim,
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
 * @returns {{ pack: object|null, filled: object[], unclear: object[], skipped: object[], restUnclear: object[], stumps: object[] }}
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
    const stumps = [];
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
        if (result.stump) addStump(entries, stumps, result.stump, workspace, e.record.name ?? e.id);
        filled.push({ ...at(e, row), op: result.entry.op, writes: `${result.entry.kind} ${result.entry.id}`, level: row.level, seconds: row.seconds, xp: row.xp, makes: e.kind === 'item' ? ruledMakes(row) : null, station: result.station });
    }

    const pack = entries.length ? {
        format: PACK_FORMAT,
        version: PACK_VERSION,
        id,
        createdAt,
        asked: asked || 'The balance solver\'s numbers onto the plan\'s Planned entries, still Planned (T-724).',
        entries,
    } : null;
    return { pack, filled, unclear, skipped, restUnclear, stumps };
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
const isSure = (o) => (o?.chance ?? 100) >= 100;

/**
 * The content session's answers (main 3c7d1657) the live writer follows, by catalogue id.
 * * `TIMED_BY_INPUT`: one catalogue row many Live recipes share, each recipe unlocked at the level
 *   of its one ingredient's row and timed as a prepare step at that level (the 14 Bait recipes,
 *   each at its own fish's level, its XP at the fish's Fishing rate). Their ingredients and counts
 *   are the content's and stay as they are.
 * * `NUMBERED_AS_THEY_ARE`: Live recipes whose ingredients differ from the catalogue's on purpose
 *   (the two fishing rods): their level, time and XP are written, their ingredients left alone.
 */
export const TIMED_BY_INPUT = Object.freeze(['bait']);
export const NUMBERED_AS_THEY_ARE = Object.freeze(['fishing_rod', 'fine_fishing_rod']);

/**
 * A Live record's things against the catalogue's (`want`, CMS ids): every thing the catalogue says
 * it gives is among its outputs, and anything else is a chance extra (a seed, a worm, a Bird Nest),
 * kept as it is. `null` when they agree, else why not.
 */
function outputsDiffer(current, want, name) {
    const have = [...new Set((current || []).map((o) => o?.itemId))];
    const missing = want.filter((w) => !have.includes(w));
    if (missing.length) return `its output (${have.join(', ') || 'none'}) lacks the catalogue's ${missing.join(', ')}`;
    const surely = (current || []).filter((o) => !want.includes(o?.itemId) && isSure(o)).map((o) => o.itemId);
    if (surely.length) return `its output (${have.join(', ')}) gives ${surely.map(name).join(', ')} every cycle, which the catalogue's (${want.join(', ')}) does not`;
    return null;
}

/**
 * A made Live record's outputs with the craft's count: by its plan's split when it has one, else
 * its one sure output given the owner's count ({@link ruledMakes}), its chance extras as they are.
 * `{ outputs, was }` or `{ unclear }`.
 */
function liveOutputs(record, current, want, makes, workspace, name) {
    const split = splitOf(record);
    if (split) {
        const named = split.map((x) => x?.itemId);
        if (!sameSet(named, want)) return { unclear: `its split (${named.map(name).join(', ')}) differs from the catalogue's output (${want.map(name).join(', ')})` };
        const got = splitOutputs(split, workspace);
        return got.unclear ? got : { outputs: got.outputs, was: '' };
    }
    const differ = outputsDiffer(current, want, name);
    if (differ) return { unclear: differ };
    const sure = (current || []).filter(isSure);
    if (sure.length !== 1) {
        return { unclear: sure.length ? `${sure.length} sure outputs (${sure.map((o) => name(o.itemId)).join(', ')}) share its cycle with no split saying how` : 'it has no sure output, only chances: the craft\'s count has nowhere to go' };
    }
    const main = sure[0];
    const was = qtyRange(main) === String(makes) ? '' : ` (${name(main.itemId)} was ${qtyRange(main)} a cycle)`;
    // ⚠️ A `baseChance` an earlier tuning left would price a chance other than the 100 written here.
    const counted = ({ baseChance, ...o }) => ({ ...o, chance: 100, minQty: makes, maxQty: makes, baseQty: { min: makes, max: makes }, variable: false });
    return {
        outputs: current.map((o) => (o === main ? counted(o) : o)),
        was,
    };
}

/**
 * A gather's outputs (a Live gathering Token's or a Field's crop): its plan's split written as
 * shares, else its outputs exactly as they are. What one gather gives is the content's, the same
 * at every tier (BALANCE_RULES section 3), so the solver's count is never written onto it; a
 * chance-only gather (the Geode) is so by design. A water's catch lives on each fish's `fish` block
 * and its catch pools, never on its outputs, so a water is not checked here.
 * `{ outputs }` (undefined: leave them) or `{ unclear }`.
 */
function gatherOutputs(record, current, want, workspace, name) {
    const split = splitOf(record);
    if (split) {
        const named = split.map((x) => x?.itemId);
        if (!sameSet(named, want)) return { unclear: `its split (${named.map(name).join(', ')}) differs from the catalogue's output (${want.map(name).join(', ')})` };
        const got = splitOutputs(split, workspace);
        return got.unclear ? got : { outputs: got.outputs };
    }
    if (hasCatchPools(record)) return { outputs: undefined };
    const differ = outputsDiffer(current, want, name);
    return differ ? { unclear: differ } : { outputs: undefined };
}

/** The Tokens a Live recipe places (a build or a Dig recipe), or none. */
const tokensBuilt = (record) => {
    const outs = record?.outputs || [];
    return outs.length && outs.every((o) => typeof o?.tokenId === 'string' && !o.itemId) ? outs.map((o) => o.tokenId) : [];
};

/** The Live shrines a Faith offering is made at (`stationKinds: ['shrine']`): its numbers follow its shrine. */
function shrinesOf(record, workspace) {
    if (!(record?.stationKinds || []).includes('shrine') && !record?.offering) return [];
    return Object.entries(workspace?.tokens || {}).filter(([, t]) => t?.shrine && isLive(t)).map(([id]) => id);
}

/**
 * The live pack: the solver's numbers onto each Live recipe and gathering Token the id map matches
 * to a catalogue entry, as fingerprinted edits. Each carries its level, its time (pinned:
 * `sim.timePinned`), its XP (pinned: `sim.xpPinned`), so Recalculate keeps both; a made thing its
 * input counts and the craft's count; a gathering Token its uses and rest, a regrowing one its
 * Stump's regrowth. A gather's yield stays as the content has it, a plan's split aside.
 * A build or Dig recipe follows the Token it places, and an offering its shrine: none has work the
 * solver times, so they are skipped with the reason. The Bait recipes share the bait row, each timed
 * by its own fish ({@link TIMED_BY_INPUT}). A Live entry with no match, two, ingredients or an output
 * other than the catalogue's is listed as unclear and left alone.
 * @param {object} workspace the CMS workspace, read only
 * @param {object[]} rows the solver's rows
 * @param {{ ids: object, catalogue: object|object[], id: string, createdAt?: string, asked?: string, prepareStep?: Function }} options
 *   `ids` the id map file's contents, `catalogue` the catalogue (`{ entries }` or the list),
 *   `prepareStep(level, xpLevel)` the solver's own prepare rule (`balance_solver.timeStep` at
 *   `'prepare'`, `{ seconds, xp }`) that times a Bait recipe; without it the Bait recipes are listed
 * @returns {{ pack: object|null, filled: object[], unclear: object[], skipped: object[], restUnclear: object[], stumps: object[] }}
 */
export function writeLiveNumberPack(workspace, rows, { ids, catalogue, id, createdAt = new Date().toISOString(), asked, prepareStep } = {}) {
    const { toCms, toCatalogue } = liveIdMap(ids);
    const catalogueEntries = Array.isArray(catalogue) ? catalogue : catalogue?.entries;
    if (!Array.isArray(catalogueEntries)) throw new Error('The catalogue holds no entries: expected { "entries": [...] } or a list.');
    const byEntry = new Map(catalogueEntries.map((e) => [e.id, e]));
    const byCatalogue = new Map();
    for (const row of rows || []) if (row?.id) byCatalogue.set(row.id, row);
    const name = (itemId) => workspace?.items?.[itemId]?.name ?? workspace?.tokens?.[itemId]?.name ?? itemId;

    const candidates = [];
    for (const [pool, list] of Object.entries(workspace?.recipePools || {})) {
        for (const record of list || []) {
            if (!record?.id || !isLive(record)) continue;
            const own = toCatalogue.get(record.id);
            const built = tokensBuilt(record);
            const shrines = shrinesOf(record, workspace);
            const follows = built.length ? built : shrines;
            const viaOutputs = [...new Set((record.outputs || []).flatMap((o) => toCatalogue.get(o?.itemId) || []))];
            const viaFollowed = [...new Set(follows.flatMap((t) => toCatalogue.get(t) || []))];
            const role = built.length ? 'build' : shrines.length ? 'offering' : 'recipe';
            candidates.push({ kind: 'recipe', id: record.id, record, pool, role, follows, matches: own || (role === 'recipe' ? viaOutputs : viaFollowed) });
        }
    }
    for (const [tokenId, record] of Object.entries(workspace?.tokens || {})) {
        if (!isLive(record) || !isGatheringSkill(record?.config?.skill)) continue;
        candidates.push({ kind: 'token', id: tokenId, record, role: 'token', matches: toCatalogue.get(tokenId) || [] });
    }
    // A build or an offering claims nothing: the Token it follows keeps its own row. A row shared on purpose (the Bait) is not a clash.
    const claims = new Map();
    for (const c of candidates) {
        if (c.role === 'build' || c.role === 'offering' || c.matches.length !== 1 || TIMED_BY_INPUT.includes(c.matches[0])) continue;
        claims.set(c.matches[0], [...(claims.get(c.matches[0]) || []), `${c.kind} ${c.id}`]);
    }

    const entries = [];
    const filled = [];
    const unclear = [];
    const skipped = [];
    const restUnclear = [];
    const stumps = [];
    const at = (c, catalogueId, row) => ({ kind: c.kind, id: c.id, name: c.record.name ?? c.id, catalogueId: catalogueId ?? null, skill: row?.skill || c.record.skill || c.record.config?.skill || '' });

    for (const c of candidates) {
        if (c.role === 'build' || c.role === 'offering') {
            const what = c.role === 'build' ? `it places ${c.follows.map(name).join(', ')}` : `an offering at ${c.follows.map(name).join(' or ')}`;
            if (!c.matches.length) {
                if (c.role === 'offering') skipped.push({ ...at(c), reason: `${what}, which has no catalogue entry: an offering follows its shrine, and there is no work of the shrine's to write` });
                else unclear.push({ ...at(c), reason: `${what}, which has no catalogue match in the id map` });
                continue;
            }
            const catalogueId = c.matches[0];
            const row = byCatalogue.get(catalogueId);
            const why = row && !row.work && row.why ? row.why : 'builds follow the one-off step rule, which the solver does not time';
            skipped.push({ ...at(c, catalogueId, row), reason: `${what} (catalogue ${c.matches.join(', ')}): ${why}` });
            continue;
        }
        if (!c.matches.length) { unclear.push({ ...at(c), reason: 'no catalogue match in the id map' }); continue; }
        if (c.matches.length > 1) { unclear.push({ ...at(c), reason: `it matches several catalogue entries (${c.matches.join(', ')})` }); continue; }
        const catalogueId = c.matches[0];
        const entry = byEntry.get(catalogueId);
        let row = byCatalogue.get(catalogueId);
        if (!entry || !row) { unclear.push({ ...at(c, catalogueId), reason: `the ${entry ? 'solver has no row' : 'catalogue has no entry'} for ${catalogueId}` }); continue; }
        if (claims.get(catalogueId)?.length > 1) { unclear.push({ ...at(c, catalogueId, row), reason: `catalogue entry ${catalogueId} is matched by ${claims.get(catalogueId).join(' and ')}` }); continue; }
        if (c.kind === 'recipe' && TIMED_BY_INPUT.includes(catalogueId)) {
            const timed = inputRow(c.record, { toCatalogue, byCatalogue, name });
            if (timed.unclear) { unclear.push({ ...at(c, catalogueId, row), reason: timed.unclear }); continue; }
            if (typeof prepareStep !== 'function') { unclear.push({ ...at(c, catalogueId, row), reason: `it is a prepare step at its ${name(c.record.inputs[0].itemId)}'s level, and the writer was given no prepare rule to time it` }); continue; }
            // Unlocked at its fish's level, timed as a prepare step there, at the fish's XP rate (its solver row's `xpLevel`).
            const step = prepareStep(timed.row.level, timed.row.xpLevel ?? timed.row.level);
            row = { ...timed.row, work: 'prepare', seconds: step.seconds, xp: step.xp, makes: row.makes, type: row.type, timedBy: timed.row.id };
        }
        if (!row.work) { skipped.push({ ...at(c, catalogueId, row), reason: row.why || 'no work of its own' }); continue; }
        if (row.level == null || !(row.seconds > 0) || !(row.xp >= 1)) { skipped.push({ ...at(c, catalogueId, row), reason: row.why || 'the solver gave it no numbers' }); continue; }
        if (/^combat$/i.test(row.skill)) { skipped.push({ ...at(c, catalogueId, row), reason: 'combat numbers are not the balance solver\'s' }); continue; }

        const result = liveWork(c, entry, row, { workspace, toCms, name });
        if (result.unclear) { unclear.push({ ...at(c, catalogueId, row), reason: result.unclear }); continue; }
        const { record } = c;
        const current = currentValue(workspace, c.kind, c.id);
        const tagged = Boolean(record.sim?.tempo && record.sim?.purpose);
        const timedBy = row.timedBy ? `, a prepare step at its ${name(toCms.get(row.timedBy) ?? row.timedBy)}'s level` : '';
        entries.push({
            op: 'edit', kind: c.kind, id: c.id, value: result.value, fingerprint: fingerprint(current),
            note: `${record.name ?? c.id}: ${numbersLine(row)}${timedBy}${result.was}, from the balance solver; time and XP pinned, so Recalculate keeps them.`,
        });
        if (result.rest) restUnclear.push({ ...at(c, catalogueId, row), reason: result.rest });
        if (result.stump) addStump(entries, stumps, result.stump, workspace, c.record.name ?? c.id);
        filled.push({ ...at(c, catalogueId, row), op: 'edit', writes: `${c.kind} ${c.id}`, level: row.level, seconds: row.seconds, xp: row.xp, makes: result.makes ?? null, tagged });
    }

    const pack = entries.length ? {
        format: PACK_FORMAT,
        version: PACK_VERSION,
        id,
        createdAt,
        asked: asked || 'The balance solver\'s numbers onto the Live recipes and gathering Tokens the catalogue matches, time and XP pinned (T-724, live mode).',
        entries,
    } : null;
    return { pack, filled, unclear, skipped, restUnclear, stumps };
}

/** A Stump's regrowth as an edit, once however many trees regrow into it. */
function addStump(entries, stumps, stump, workspace, treeName) {
    if (entries.some((e) => e.kind === 'token' && e.id === stump.id)) return;
    entries.push({
        op: 'edit', kind: 'token', id: stump.id, value: stump.value, fingerprint: fingerprint(currentValue(workspace, 'token', stump.id)),
        note: `${stump.value.name ?? stump.id}: grows back in ${REST_RULE.restMs / 1000} s, ${treeName}'s rest by the rest rule (its needs as they are).`,
    });
    stumps.push({ id: stump.id, name: stump.value.name ?? stump.id, tree: treeName, afterMs: REST_RULE.restMs });
}

/** The row a recipe shared on purpose is timed by: its one ingredient's (a Bait recipe's fish). `{ row }` or `{ unclear }`. */
function inputRow(record, { toCatalogue, byCatalogue, name }) {
    const inputs = record.inputs || [];
    if (inputs.length !== 1) return { unclear: `it shares its catalogue row, each recipe timed by its one ingredient, and it has ${inputs.length}` };
    const itemId = inputs[0]?.itemId;
    const ids = toCatalogue.get(itemId) || [];
    if (ids.length !== 1) return { unclear: `it is timed by its ${name(itemId)}, which ${ids.length ? `matches several catalogue entries (${ids.join(', ')})` : 'has no catalogue match'}` };
    const row = byCatalogue.get(ids[0]);
    if (!row || !row.work || row.level == null || !(row.seconds > 0) || !(row.xp >= 1)) {
        return { unclear: `it is timed by its ${name(itemId)}, whose row has no numbers of its own (${row?.why || 'no row'})` };
    }
    return { row };
}

/** One Live candidate's new value: `{ value, was, rest, stump, makes }` or `{ unclear }`. */
function liveWork(c, entry, row, { workspace, toCms, name }) {
    const { record } = c;
    const makes = ruledMakes(row);
    const seconds = ms(row.seconds);
    const pin = pinTime({ ...(record.sim || {}), xpPinned: true });
    // ⚠️ Only where its outputs are written: a gather's yield left as the content has it stays the simulator's to tune.
    const pinWith = (outputs) => (outputs ? pinOutputs(pin) : pin);

    if (c.kind === 'recipe' && row.timedBy) {
        // Its ingredient and its Bait a craft are the content's (rarer fish give more).
        const value = { ...record, skill: record.skill ?? c.pool, levelRequirement: row.level, xp: row.xp, durationMs: seconds, sim: pin };
        delete value.id;
        return { value, was: '' };
    }

    if (c.kind === 'recipe' && (row.work === 'make' || row.work === 'prepare')) {
        const asTheyAre = NUMBERED_AS_THEY_ARE.includes(entry.id);
        const madeWith = entry.madeWith || [];
        const unmapped = madeWith.filter((m) => !toCms.has(m));
        if (unmapped.length && !asTheyAre) return { unclear: `its catalogue ingredients ${unmapped.join(', ')} have no CMS id in the id map` };
        const want = madeWith.map((m) => toCms.get(m));
        const have = (record.inputs || []).map((i) => i?.itemId);
        if (!asTheyAre && !sameSet(have, want)) return { unclear: `its ingredients (${have.map(name).join(', ') || 'none'}) differ from the catalogue's (${want.map(name).join(', ') || 'none'})` };
        const counts = new Map((row.inputs || []).map((i) => [toCms.get(i.id), i.count]));
        const bad = asTheyAre ? null : want.find((w) => !(Number.isInteger(counts.get(w)) && counts.get(w) >= 1));
        if (bad) return { unclear: `the solver gives ${name(bad)} a count of ${counts.get(bad)}` };
        const out = toCms.get(entry.id);
        if (!out) return { unclear: `the catalogue's ${entry.id} has no CMS id in the id map` };
        const outs = liveOutputs(record, record.outputs, [out], makes, workspace, name);
        if (outs.unclear) return outs;
        const value = {
            ...record,
            skill: record.skill ?? c.pool,
            levelRequirement: row.level,
            inputs: asTheyAre ? record.inputs : (record.inputs || []).map((i) => ({ ...i, quantity: counts.get(i.itemId) })),
            outputs: outs.outputs,
            xp: row.xp,
            durationMs: seconds,
            sim: pinOutputs(pin),
        };
        delete value.id;
        return { value, was: outs.was + (asTheyAre ? ', its ingredients as they are' : ''), makes };
    }

    if (row.work !== 'gather') return { unclear: `a Live ${c.kind} whose solver work is ${row.work}: no clear recipe or Token cycle` };
    const gives = entry.gives || [];
    if (!gives.length) return { unclear: 'the catalogue names nothing it gives' };
    const unmapped = gives.filter((g) => !toCms.has(g));
    if (unmapped.length) return { unclear: `the catalogue's ${unmapped.join(', ')} have no CMS id in the id map` };
    const want = gives.map((g) => toCms.get(g));

    if (c.kind === 'recipe') {
        // A crop recipe (a Field's): its seeds, its grow time and its yield stay as they are.
        const outs = gatherOutputs(record, record.outputs, want, workspace, name);
        if (outs.unclear) return outs;
        const value = { ...record, skill: record.skill ?? c.pool, levelRequirement: row.level, ...(outs.outputs ? { outputs: outs.outputs } : {}), xp: row.xp, durationMs: seconds, sim: pinWith(outs.outputs) };
        delete value.id;
        return { value, was: '' };
    }

    const outs = gatherOutputs(record, record.config?.outputs, want, workspace, name);
    if (outs.unclear) return outs;
    const rest = restTerms(record, seconds, workspace);
    const value = withRest({
        ...record,
        config: { ...(record.config || {}), skillRequired: row.level, cycleTimeMs: seconds, xp: row.xp, ...(outs.outputs ? { outputs: outs.outputs } : {}) },
        sim: pinWith(outs.outputs),
    }, rest.patch);
    delete value.id;
    return { value, was: '', rest: rest.unclear, stump: rest.stump };
}

/** The unclear list as text for the content session. */
export function unclearText(unclear) {
    if (!unclear.length) return ['Nothing unclear.'];
    return unclear.map((u) => `- ${u.name} (${u.kind} ${u.id}${u.catalogueId ? `, catalogue ${u.catalogueId}` : ''}${u.skill ? `, ${u.skill}` : ''}): ${u.reason}`);
}
