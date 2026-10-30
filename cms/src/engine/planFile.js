/**
 * The progression ledger's plan on its way to and from disk (`src/systems/progression/ledger/plan.js`
 * holds the vocabulary).
 *
 * The plan lives in the CMS workspace: a record's `plan` block, and Planned stubs that sit in the
 * collections beside authored content. Sync to Game keeps both out of `data/` (owner ruling: Planned
 * stubs never reach `data/`) and writes them into `cms/plan/plan.json`, committed with `data/` by the
 * same Sync; Restore from Game and the change-pack tool read it back, so the plan survives a restore.
 *
 * ⚠️ Planned stubs must never reach `data/`: `splitPlanned` is the one place they are taken out, and
 * the economy line (Recalculate) and Sync both run on what it leaves.
 *
 * Pure: no store, no fetch, no fs (the CMS's server plugin and its Node tools import it too).
 */

import { isPlanned, cleanPlan } from '../../../src/systems/progression/ledger/plan.js';

/** The plan file's name, in `cms/plan/`. */
export const PLAN_FILE = 'plan.json';
/** Where the plan file sits, from the project root. */
export const PLAN_DIR = 'cms/plan';
/**
 * The key the plan rides under among the files a Sync builds (`syncFiles`). It is not a `data/`
 * path: `sendSync` takes it out of the files and sends it on its own, and the server writes it to
 * `cms/plan/`.
 */
export const PLAN_SYNC_KEY = `${PLAN_DIR}/${PLAN_FILE}`;
export const PLAN_FORMAT = 'fantasy-guild-plan';
export const PLAN_FILE_VERSION = 1;

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const entries = (collection) => (isObject(collection) ? Object.entries(collection) : []);

/**
 * The workspace's collections split in two: what the game gets, and the Planned stubs.
 * @returns {{ live: { items, tokens, recipePools }, planned: { items, tokens, recipes } }} `planned.recipes` is a flat list; each recipe keeps its `skill`, stamped with its pool's key when it had none.
 */
export function splitPlanned({ items = {}, tokens = {}, recipePools = {} } = {}) {
    const live = { items: {}, tokens: {}, recipePools: {} };
    const planned = { items: {}, tokens: {}, recipes: [] };
    for (const [key, source] of [['items', items], ['tokens', tokens]]) {
        for (const [id, def] of entries(source)) {
            if (isPlanned(def)) planned[key][id] = def;
            else live[key][id] = def;
        }
    }
    for (const [skill, pool] of entries(recipePools)) {
        const kept = [];
        for (const recipe of Array.isArray(pool) ? pool : []) {
            if (isPlanned(recipe)) planned.recipes.push(recipe?.skill ? recipe : { ...recipe, skill });
            else kept.push(recipe);
        }
        live.recipePools[skill] = kept;
    }
    return { live, planned };
}

/** Whether a split found any Planned stub. */
export function hasPlanned(planned) {
    return !!planned && (Object.keys(planned.items || {}).length > 0
        || Object.keys(planned.tokens || {}).length > 0
        || (planned.recipes || []).length > 0);
}

/**
 * Put the Planned stubs back beside what the economy line wrote, each in the place it held.
 * `original` is the workspace before the split; `live` the line's output for the rest. A Planned
 * stub comes back exactly as it was: nothing on the line ever saw it.
 */
export function rejoinPlanned(original = {}, live = {}) {
    const keyed = (key) => {
        const out = {};
        const fresh = live[key] || {};
        for (const [id, def] of entries(original[key])) {
            if (isPlanned(def)) out[id] = def;
            else if (id in fresh) out[id] = fresh[id];
        }
        for (const [id, def] of entries(fresh)) if (!(id in out)) out[id] = def;
        return out;
    };

    const recipePools = {};
    const freshPools = live.recipePools || {};
    for (const [skill, pool] of entries(original.recipePools)) {
        const fresh = [...(freshPools[skill] || [])];
        recipePools[skill] = (Array.isArray(pool) ? pool : []).map((recipe) => (isPlanned(recipe) ? recipe : fresh.shift()))
            .filter((recipe) => recipe !== undefined);
        recipePools[skill].push(...fresh);
    }
    for (const [skill, pool] of entries(freshPools)) if (!(skill in recipePools)) recipePools[skill] = pool;

    return { items: keyed('items'), tokens: keyed('tokens'), recipePools };
}

/** A copy of a record without its plan block, or the record itself when it has none. */
function withoutPlan(def) {
    if (!isObject(def) || !('plan' in def)) return def;
    const rest = { ...def };
    delete rest.plan;
    return rest;
}

/** A keyed collection with every plan block taken off, for the game's files. */
export function stripPlanBlocks(collection = {}) {
    let changed = false;
    const out = {};
    for (const [id, def] of entries(collection)) {
        out[id] = withoutPlan(def);
        if (out[id] !== def) changed = true;
    }
    return changed ? out : collection;
}

/** A recipe list with every plan block taken off. */
export function stripPlanFromList(list = []) {
    return (Array.isArray(list) ? list : []).map(withoutPlan);
}

/**
 * `cms/plan/plan.json` for a workspace: the plan block of every record the game gets, and every
 * Planned stub whole. Null when the workspace holds no plan at all, so a workspace that never
 * loaded the plan cannot write an empty one over it (Sync then leaves the file alone).
 * @param {{ items, tokens, recipePools }} live  the records the game gets (after `splitPlanned`)
 * @param {{ items, tokens, recipes }} planned    the stubs
 * @param {object|null} settings                  the Ledger settings (`ledger/settings.js`); null when the workspace never set any
 */
export function buildPlanFile(live = {}, planned = {}, settings = null) {
    const blocks = { items: {}, tokens: {}, recipes: {} };
    for (const key of ['items', 'tokens']) {
        for (const [id, def] of entries(live[key])) {
            const block = cleanPlan(def?.plan);
            if (block) blocks[key][def?.id ?? id] = block;
        }
    }
    for (const pool of Object.values(live.recipePools || {})) {
        for (const recipe of Array.isArray(pool) ? pool : []) {
            const block = cleanPlan(recipe?.plan);
            if (block && recipe?.id) blocks.recipes[recipe.id] = block;
        }
    }
    const anyBlock = Object.values(blocks).some((b) => Object.keys(b).length > 0);
    const hasSettings = isObject(settings);
    if (!anyBlock && !hasPlanned(planned) && !hasSettings) return null;
    return {
        format: PLAN_FORMAT,
        version: PLAN_FILE_VERSION,
        ...(hasSettings ? { settings } : {}),
        entries: blocks,
        planned: {
            items: { ...(planned.items || {}) },
            tokens: { ...(planned.tokens || {}) },
            recipes: [...(planned.recipes || [])]
        }
    };
}

/**
 * A workspace built from the game's files, with the plan file laid back over it: each plan block
 * onto its record, each Planned stub back into its collection. A stub whose id the game's files
 * already hold is skipped (the game's record wins), and so is a block whose record is gone.
 * The Ledger settings come back as the workspace's `planSettings`.
 * Returns the workspace unchanged when there is no plan file.
 */
export function mergePlanFile(workspace = {}, file = null) {
    if (!isObject(file)) return workspace;
    const blocks = isObject(file.entries) ? file.entries : {};
    const planned = isObject(file.planned) ? file.planned : {};
    const next = { ...workspace };

    for (const key of ['items', 'tokens']) {
        const collection = { ...(workspace[key] || {}) };
        for (const [id, block] of entries(blocks[key])) {
            const clean = cleanPlan(block);
            if (clean && isObject(collection[id])) collection[id] = { ...collection[id], plan: clean };
        }
        for (const [id, def] of entries(planned[key])) {
            if (!(id in collection) && isObject(def)) collection[id] = { ...def, id: def.id ?? id };
        }
        next[key] = collection;
    }

    const recipeBlocks = isObject(blocks.recipes) ? blocks.recipes : {};
    const pools = {};
    const seen = new Set();
    for (const [skill, pool] of entries(workspace.recipePools)) {
        pools[skill] = (Array.isArray(pool) ? pool : []).map((recipe) => {
            if (recipe?.id) seen.add(recipe.id);
            const clean = recipe?.id ? cleanPlan(recipeBlocks[recipe.id]) : undefined;
            return clean ? { ...recipe, plan: clean } : recipe;
        });
    }
    for (const recipe of Array.isArray(planned.recipes) ? planned.recipes : []) {
        if (!isObject(recipe) || (recipe.id && seen.has(recipe.id))) continue;
        const skill = recipe.skill || 'general';
        (pools[skill] ||= []).push(recipe);
    }
    next.recipePools = pools;
    if (isObject(file.settings)) next.planSettings = file.settings;
    return next;
}

/** The Planned stubs a plan file holds, keyed `items:<id>`, `tokens:<id>`, `recipes:<id>`, each with its name: what the Sync guard compares. */
export function plannedKeysOf(file) {
    const out = new Map();
    if (!isObject(file) || !isObject(file.planned)) return out;
    for (const key of ['items', 'tokens']) {
        for (const [id, def] of entries(file.planned[key])) out.set(`${key}:${def?.id ?? id}`, def?.name || id);
    }
    for (const recipe of Array.isArray(file.planned.recipes) ? file.planned.recipes : []) {
        if (recipe?.id) out.set(`recipes:${recipe.id}`, recipe.name || recipe.id);
    }
    return out;
}
