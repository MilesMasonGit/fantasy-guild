/**
 * Change packs: an agent's proposed content edits, reviewed and applied inside the CMS.
 * The format is written down for agents in `cms/incoming/README.md`; this module is the one
 * definition of it (the server's inbox, the review page and the agents' helper script all use it).
 * Pure: no store, no fetch, no fs.
 */

import { normaliseStarterCamp, isEmptyStarterCamp } from '../../../src/config/starterCampShape.js';
import { PLAN_STATUSES, statusOrNull, tierOrNull } from '../../../src/systems/progression/ledger/plan.js';
import { mergePlanFile } from './planFile.js';

export const PACK_FORMAT = 'fantasy-guild-change-pack';
export const PACK_VERSION = 1;
export const OPS = Object.freeze(['create', 'edit', 'delete']);
export const KINDS = Object.freeze(['item', 'token', 'recipe', 'effect', 'map', 'starterCamp']);

/**
 * The Starter Camp is one record, not a collection: its entry's id is always this, its value the
 * Starter Camp page's shape (`src/config/starterCampShape.js`), never with an `id` of its own.
 */
export const STARTER_CAMP_ID = 'starterCamp';

const PACK_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const FINGERPRINT = /^fp:[0-9a-f]{16}$/;
const MAP_TYPES = ['map', 'modifier'];

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isMapValue = (v) => isPlainObject(v) && MAP_TYPES.includes(v.type);

/** JSON with every object's keys sorted, so two equal values always print the same. */
export function canonicalJson(value) {
    if (Array.isArray(value)) return '[' + value.map((v) => (v === undefined ? 'null' : canonicalJson(v))).join(',') + ']';
    if (isPlainObject(value)) {
        const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
        return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
    }
    return JSON.stringify(value ?? null);
}

function fnv1a(text, seed) {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

/**
 * A short fingerprint of one entry's value as it stood: what an edit or delete was made against.
 * Absent (`null` / `undefined`) has its own fingerprint, so "it was not there" is comparable too.
 */
export function fingerprint(value) {
    const text = canonicalJson(value);
    return 'fp:' + fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x01234567);
}

/** The workspace collection an entry's kind lives in. A map is an item. */
export function collectionOf(kind) {
    if (kind === 'item' || kind === 'map') return 'items';
    if (kind === 'token') return 'tokens';
    if (kind === 'effect') return 'effects';
    if (kind === 'recipe') return 'recipePools';
    if (kind === 'starterCamp') return 'starterCamp';
    return null;
}

/**
 * What is wrong with a record's `plan` block (`src/systems/progression/ledger/plan.js`), as sentences.
 * ⚠️ A status the ledger does not know would read as Live and reach the game, so a misspelt "planned" is refused here rather than synced.
 */
function planErrors(plan, label, kind) {
    if (plan === undefined) return [];
    if (kind === 'effect') return [`${label}: only items, maps, Tokens and recipes carry a "plan".`];
    if (!isPlainObject(plan)) return [`${label}: "value.plan" must be an object: { "status", "tier", "note" }.`];
    const out = [];
    if (plan.status !== undefined && !statusOrNull(plan.status)) {
        out.push(`${label}: "value.plan.status" must be one of ${PLAN_STATUSES.join(', ')}.`);
    }
    if (plan.tier !== undefined && tierOrNull(plan.tier) !== plan.tier) out.push(`${label}: "value.plan.tier" must be a whole number from 0 (0 is the Starter Camp).`);
    if (plan.note !== undefined && typeof plan.note !== 'string') out.push(`${label}: "value.plan.note" must be text.`);
    return out;
}

/**
 * Check a parsed pack. Returns `{ ok: true }` or `{ ok: false, errors: [...] }`, each error a
 * sentence an agent can act on. `fileName`, when given, must be `<pack id>.json`.
 */
export function validatePack(pack, { fileName } = {}) {
    const errors = [];
    if (!isPlainObject(pack)) return { ok: false, errors: ['The file must hold one JSON object (the pack).'] };

    if (pack.format !== PACK_FORMAT) errors.push(`"format" must be "${PACK_FORMAT}".`);
    if (pack.version !== PACK_VERSION) errors.push(`"version" must be ${PACK_VERSION}.`);
    if (typeof pack.id !== 'string' || !PACK_ID.test(pack.id)) {
        errors.push('"id" must be letters, digits, "-" or "_" (up to 80), starting with a letter or digit.');
    } else if (fileName && fileName !== pack.id + '.json') {
        errors.push(`The file must be named after the pack id: "${pack.id}.json", not "${fileName}".`);
    }
    if (typeof pack.createdAt !== 'string' || Number.isNaN(Date.parse(pack.createdAt))) {
        errors.push('"createdAt" must be a date-time string, like "2026-10-20T15:00:00Z".');
    }
    if (typeof pack.asked !== 'string' || !pack.asked.trim()) errors.push('"asked" must say what the owner asked for.');
    if (!Array.isArray(pack.entries) || pack.entries.length === 0) {
        errors.push('"entries" must be a list with at least one entry.');
        return { ok: false, errors };
    }

    const seen = new Map();
    pack.entries.forEach((entry, i) => {
        const at = `Entry ${i + 1}`;
        if (!isPlainObject(entry)) {
            errors.push(`${at} must be an object.`);
            return;
        }
        const { op, kind, id, value, note } = entry;
        const label = typeof id === 'string' && id ? `${at} (${id})` : at;
        if (!OPS.includes(op)) errors.push(`${label}: "op" must be one of ${OPS.join(', ')}.`);
        if (!KINDS.includes(kind)) errors.push(`${label}: "kind" must be one of ${KINDS.join(', ')}.`);
        if (typeof id !== 'string' || !id.trim()) errors.push(`${at}: "id" must be the entity's id.`);
        if (typeof note !== 'string' || !note.trim()) errors.push(`${label}: "note" must say why this entry is here.`);
        if (entry.placeholderArt !== undefined && typeof entry.placeholderArt !== 'boolean') {
            errors.push(`${label}: "placeholderArt" must be true or false.`);
        }

        if (op === 'create' || op === 'edit') {
            if (!isPlainObject(value)) {
                errors.push(`${label}: a ${op} needs "value", the entity's full new record.`);
            } else if (kind === 'starterCamp') {
                if (value.id !== undefined) errors.push(`${label}: the Starter Camp carries no "value.id".`);
                else if (isEmptyStarterCamp(normaliseStarterCamp(value))) {
                    errors.push(`${label}: this camp has no Tokens and an empty Bank; the Starter Camp page's Clear does that.`);
                }
            } else {
                if (value.id !== undefined && value.id !== id) errors.push(`${label}: "value.id" is "${value.id}" but the entry's "id" is "${id}".`);
                if (kind === 'map' && !isMapValue(value)) errors.push(`${label}: a map's "value.type" must be "map" or "modifier".`);
                if (kind === 'item' && isMapValue(value)) errors.push(`${label}: this is a map or modifier; use "kind": "map".`);
                if (kind === 'recipe' && (typeof value.skill !== 'string' || !value.skill)) errors.push(`${label}: a recipe's "value.skill" must name its skill pool.`);
                errors.push(...planErrors(value.plan, label, kind));
            }
        }
        if (kind === 'starterCamp') {
            if (id !== STARTER_CAMP_ID) errors.push(`${label}: a Starter Camp entry's "id" must be "${STARTER_CAMP_ID}".`);
            if (op === 'delete') errors.push(`${label}: the Starter Camp cannot be deleted by a pack; edit it instead.`);
        }
        if (op === 'delete' && value !== undefined) errors.push(`${label}: a delete carries no "value".`);
        if (op === 'edit' || op === 'delete') {
            if (typeof entry.fingerprint !== 'string' || !FINGERPRINT.test(entry.fingerprint)) {
                errors.push(`${label}: ${op === 'edit' ? 'an' : 'a'} ${op} needs "fingerprint" ("fp:" and 16 hex digits) of the value it was made against; run "node cms/changePackTool.mjs stamp <file>".`);
            }
        }
        if (op === 'create' && entry.fingerprint !== undefined) errors.push(`${label}: a create carries no "fingerprint".`);

        const key = `${collectionOf(kind)}:${id}`;
        if (collectionOf(kind) && typeof id === 'string') {
            if (seen.has(key)) errors.push(`${label}: the same entity is already entry ${seen.get(key) + 1}; one entry per entity.`);
            else seen.set(key, i);
        }
    });

    return errors.length ? { ok: false, errors } : { ok: true };
}

/** Where a recipe with this id sits in the pools, or null. */
function findRecipe(pools, id) {
    for (const [skill, pool] of Object.entries(pools || {})) {
        const index = (pool || []).findIndex((r) => r?.id === id);
        if (index !== -1) return { skill, index, recipe: pool[index] };
    }
    return null;
}

/** The workspace's current value for one entity, or null when it has none. */
export function currentValue(workspace, kind, id) {
    // In its one shape, so a fingerprint taken from a raw `data/starterCamp.json` matches the store's.
    if (kind === 'starterCamp') return normaliseStarterCamp(workspace?.starterCamp);
    if (kind === 'recipe') return findRecipe(workspace?.recipePools, id)?.recipe ?? null;
    const key = collectionOf(kind);
    return (key && workspace?.[key]?.[id]) ?? null;
}

/**
 * Set (or with `null`, remove) one entity in a workspace. Returns the changed collections only,
 * as a patch for the store. An edited entity keeps its place in its list; a new one goes last.
 */
export function setValue(workspace, kind, id, value) {
    if (kind === 'starterCamp') return { starterCamp: value ? normaliseStarterCamp(value) : null };
    if (kind === 'recipe') {
        const pools = { ...(workspace?.recipePools || {}) };
        const found = findRecipe(pools, id);
        const next = value ? { ...value, id } : null;
        if (found && next && (next.skill || found.skill) === found.skill) {
            pools[found.skill] = pools[found.skill].map((r, i) => (i === found.index ? next : r));
            return { recipePools: pools };
        }
        if (found) pools[found.skill] = pools[found.skill].filter((_, i) => i !== found.index);
        if (next) pools[next.skill] = [...(pools[next.skill] || []), next];
        return { recipePools: pools };
    }
    const key = collectionOf(kind);
    const collection = { ...(workspace?.[key] || {}) };
    if (value) collection[id] = { ...value, id };
    else delete collection[id];
    return { [key]: collection };
}

/** The value an entry asks for: the pack's value (with its id), or null for a delete. */
export function proposedValue(entry) {
    if (entry.op === 'delete') return null;
    if (entry.kind === 'starterCamp') return normaliseStarterCamp(entry.value);
    return { ...entry.value, id: entry.id };
}

/**
 * Whether one entry can be applied to the workspace as it is now. A conflict is never applied
 * silently: the review page shows the reason and the owner decides.
 * @returns {{ conflict: false } | { conflict: true, reason: string }}
 */
export function entryConflict(workspace, entry) {
    const current = currentValue(workspace, entry.kind, entry.id);
    if (entry.op === 'create') {
        return current ? { conflict: true, reason: 'Something with this id already exists in the workspace.' } : { conflict: false };
    }
    if (!current) return { conflict: true, reason: 'This is no longer in the workspace.' };
    if (fingerprint(current) !== entry.fingerprint) {
        return { conflict: true, reason: 'It has changed since the pack was made.' };
    }
    return { conflict: false };
}

/** The top-level fields whose values differ between two records, for the review page's before / after. */
export function changedFields(before, after) {
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    return [...keys].filter((k) => canonicalJson(before?.[k]) !== canonicalJson(after?.[k])).sort();
}

/** Build the workspace a pack was made against from the game's `data/` files (as `/api/load-game-data` and the store's load do), the plan laid back on (`planFile.js`). */
export function workspaceFromDataFiles({ items = {}, tokens = {}, effects = {}, tokenRecipes = [], starterCamp = null, plan = null }) {
    const recipePools = {};
    for (const recipe of tokenRecipes || []) (recipePools[recipe.skill || 'general'] ||= []).push(recipe);
    return mergePlanFile({ items, tokens, effects, recipePools, starterCamp: normaliseStarterCamp(starterCamp) }, plan);
}
