/**
 * What a Sync to Game would remove from, change in or add to `data/`, compared file by file in the
 * game's own shape (the files `syncFiles` builds against the files on disk). Removed and added go
 * by id; changed is an entity on both sides whose content differs. Only a removal stops a Sync:
 * changed entries are listed beside it, so the author sees what a stale copy would also overwrite.
 */

import { plannedKeysOf, PLAN_SYNC_KEY } from './planFile.js';
import { keyedPerks, PERK_FILE } from './skillPerks.js';
import { keyedHallSky, HALL_STARS_FILE } from './hallSky.js';
import { keyedWorld, usableTables, WORLD_FILE } from './worldTables.js';
import { keyedEvents, EVENTS_FILE } from './events.js';
import { normaliseSkillPerks } from '../../../src/systems/hero/perkTable.js';
import { normaliseHallSky } from '../../../src/config/hallStars.js';
import { STRICT_RINGS } from '../../../src/config/worldTablesShape.js';

/** The collections compared, in the order the panel lists them. */
export const SYNC_COLLECTIONS = [
  { key: 'tokens', label: 'Token', plural: 'Tokens' },
  { key: 'items', label: 'item', plural: 'items' },
  { key: 'recipes', label: 'recipe', plural: 'recipes' },
  { key: 'effects', label: 'effect', plural: 'effects' },
  { key: 'starterCamp', label: 'Starter Camp Token', plural: 'Starter Camp Tokens' },
  { key: 'perks', label: 'perk', plural: 'perks' },
  { key: 'hallSky', label: 'Guild Hall star or constellation', plural: 'Guild Hall stars and constellations' },
  { key: 'world', label: 'world map placement', plural: 'world map placements' },
  { key: 'events', label: 'event', plural: 'events' },
  { key: 'planned', label: 'Planned entry', plural: 'Planned entries' },
];

/** The plan file's key for a game collection's entity, so a stub that became content (or content sent back to the plan) is not counted as lost. */
const PLANNED_KEY = { tokens: 'tokens', items: 'items', recipes: 'recipes' };

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

function keyed(obj, keep = () => true) {
  const out = new Map();
  if (!isObject(obj)) return out;
  for (const [id, def] of Object.entries(obj)) {
    if (keep(def)) out.set(id, def?.name || id);
  }
  return out;
}

/** Recipes keyed the way the CMS keys them: the recipe's `id`, else `pooled_<skill>_<index within that skill>` for older recipes that predate `id`. */
function keyedRecipes(list) {
  const out = new Map();
  if (!Array.isArray(list)) return out;
  const seen = {};
  for (const r of list) {
    if (!r) continue;
    const skill = r.skill || 'general';
    const idx = seen[skill] ?? 0;
    seen[skill] = idx + 1;
    out.set(r.id || `pooled_${skill}_${idx}`, r.name || r.id || `${skill} recipe ${idx + 1}`);
  }
  return out;
}

/** Starter Camp placements have no ids: the nth placement of a Token type is one entity, so moving a Token is not a removal. */
function keyedPlacements(camp) {
  const out = new Map();
  const seen = {};
  for (const t of Array.isArray(camp?.tokens) ? camp.tokens : []) {
    if (!t?.typeId) continue;
    const n = (seen[t.typeId] = (seen[t.typeId] ?? 0) + 1);
    out.set(n === 1 ? t.typeId : `${t.typeId} #${n}`, t.typeId);
  }
  return out;
}

/** JSON with every object's keys sorted, so the same content written in another key order compares equal. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  return JSON.stringify(value ?? null);
}

/** The file each collection is read from. */
const FILE_OF = {
  tokens: 'tokens.json', items: 'items.json', recipes: 'tokenRecipes.json', effects: 'effects.json',
  starterCamp: 'starterCamp.json', perks: PERK_FILE, hallSky: HALL_STARS_FILE, world: WORLD_FILE, events: EVENTS_FILE, planned: PLAN_SYNC_KEY,
};

/**
 * Each entity's content, keyed as `collections` keys it. ⚠️ The keys must match `collections`'
 * (and the `keyed*` helpers'): an entity whose key is missing here is never listed as changed, and
 * only the whole-file check in `compareSync` still sees it.
 */
function contents(files) {
  const byId = (obj) => new Map(isObject(obj) ? Object.entries(obj).map(([id, def]) => [id, stable(def)]) : []);
  const recipes = new Map();
  const seen = {};
  for (const r of Array.isArray(files['tokenRecipes.json']) ? files['tokenRecipes.json'] : []) {
    if (!r) continue;
    const skill = r.skill || 'general';
    const idx = seen[skill] ?? 0;
    seen[skill] = idx + 1;
    recipes.set(r.id || `pooled_${skill}_${idx}`, stable(r));
  }
  const camp = new Map();
  const placed = {};
  for (const t of Array.isArray(files['starterCamp.json']?.tokens) ? files['starterCamp.json'].tokens : []) {
    if (!t?.typeId) continue;
    const n = (placed[t.typeId] = (placed[t.typeId] ?? 0) + 1);
    camp.set(n === 1 ? t.typeId : `${t.typeId} #${n}`, stable(t));
  }
  const perks = new Map();
  for (const [skillId, record] of Object.entries(normaliseSkillPerks(files[PERK_FILE]))) {
    for (const row of record.perks) perks.set(`${skillId}:${row.level}:${row.effectId}`, stable(row));
  }
  const hallSky = new Map();
  const sky = normaliseHallSky(files[HALL_STARS_FILE] || {});
  for (const c of sky.constellations) hallSky.set(`constellation:${c.id}`, stable(c));
  for (const s of sky.stars) hallSky.set(`star:${s.id}`, stable(s));
  const world = new Map();
  const tables = usableTables(files[WORLD_FILE]);
  for (const line of tables?.lines || []) {
    for (let ring = 1; ring <= STRICT_RINGS; ring++) {
      for (const o of line.origins[ring] || []) world.set(`${line.id} ring ${ring}: ${o.id}`, stable(o));
    }
  }
  for (let ring = 1; ring <= STRICT_RINGS; ring++) {
    for (const c of tables?.camps?.[ring] || []) world.set(`camps ring ${ring}: ${c.id}`, stable(c));
  }
  const planned = new Map();
  const plan = files[PLAN_SYNC_KEY];
  if (isObject(plan) && isObject(plan.planned)) {
    for (const key of ['items', 'tokens']) {
      for (const [id, def] of Object.entries(isObject(plan.planned[key]) ? plan.planned[key] : {})) planned.set(`${key}:${def?.id ?? id}`, stable(def));
    }
    for (const recipe of Array.isArray(plan.planned.recipes) ? plan.planned.recipes : []) {
      if (recipe?.id) planned.set(`recipes:${recipe.id}`, stable(recipe));
    }
  }
  return {
    tokens: byId(files['tokens.json']), items: byId(files['items.json']), recipes, effects: byId(files['effects.json']),
    starterCamp: camp, perks, hallSky, world, events: byId(files[EVENTS_FILE]), planned,
  };
}

function collections(files) {
  return {
    tokens: keyed(files['tokens.json']),
    items: keyed(files['items.json']),
    recipes: keyedRecipes(files['tokenRecipes.json']),
    effects: keyed(files['effects.json']),
    starterCamp: keyedPlacements(files['starterCamp.json']),
    perks: keyedPerks(files[PERK_FILE]),
    hallSky: keyedHallSky(files[HALL_STARS_FILE]),
    world: keyedWorld(files[WORLD_FILE]),
    events: keyedEvents(files[EVENTS_FILE]),
    planned: plannedKeysOf(files[PLAN_SYNC_KEY]),
  };
}

/**
 * @param {object} current the files in `data/` now, by file name (a missing file is absent or null)
 * @param {object} incoming the files the Sync would write, by file name
 * @returns {{ removed: object, changed: object, added: object, hasRemovals: boolean, hasChanges: boolean }}
 *          per collection key, `[{ id, name }]`
 */
export function compareSync(current = {}, incoming = {}) {
  const before = collections(current || {});
  const after = collections(incoming || {});
  const wasContent = contents(current || {});
  const nowContent = contents(incoming || {});
  const removed = {};
  const changed = {};
  const added = {};
  // Planned stubs that became content, and content sent back to the plan, by game collection key.
  const nowIn = (key, id) => after[key].has(id);
  const promoted = (plannedKey) => {
    const [kind, ...rest] = plannedKey.split(':');
    const id = rest.join(':');
    return Object.entries(PLANNED_KEY).some(([key, k]) => k === kind && nowIn(key, id));
  };
  for (const { key } of SYNC_COLLECTIONS) {
    // A Starter Camp (or a plan) the Sync does not write stays on disk untouched.
    if ((key === 'starterCamp' && !incoming?.['starterCamp.json']) || (key === 'perks' && !incoming?.[PERK_FILE])
      || (key === 'hallSky' && !incoming?.[HALL_STARS_FILE])
      || (key === 'world' && !incoming?.[WORLD_FILE])
      || (key === 'events' && !incoming?.[EVENTS_FILE])
      || (key === 'planned' && !incoming?.[PLAN_SYNC_KEY])) {
      removed[key] = [];
      changed[key] = [];
      added[key] = [];
      continue;
    }
    const kept = (id) => {
      if (after[key].has(id)) return true;
      if (key === 'planned') return promoted(id);
      return !!PLANNED_KEY[key] && after.planned.has(`${PLANNED_KEY[key]}:${id}`);
    };
    removed[key] = [...before[key]].filter(([id]) => !kept(id)).map(([id, name]) => ({ id, name }));
    added[key] = [...after[key]].filter(([id]) => !before[key].has(id)).map(([id, name]) => ({ id, name }));
    changed[key] = [...after[key]]
      .filter(([id]) => before[key].has(id) && wasContent[key].has(id) && nowContent[key].has(id) && wasContent[key].get(id) !== nowContent[key].get(id))
      .map(([id, name]) => ({ id, name }));
    // What no entity accounts for (a file's other fields): the file as a whole.
    const file = FILE_OF[key];
    const onDisk = current?.[file];
    if (onDisk != null && !removed[key].length && !changed[key].length && !added[key].length && stable(onDisk) !== stable(incoming[file])) {
      changed[key] = [{ id: file, name: `${file} (fields outside its entries)` }];
    }
  }
  const hasRemovals = Object.values(removed).some((list) => list.length > 0);
  const hasChanges = Object.values(changed).some((list) => list.length > 0);
  return { removed, changed, added, hasRemovals, hasChanges };
}

function countPhrase(lists) {
  const parts = SYNC_COLLECTIONS.filter(({ key }) => lists[key]?.length).map(
    ({ key, label, plural }) => `${lists[key].length} ${lists[key].length === 1 ? label : plural}`
  );
  if (parts.length <= 1) return parts[0] || '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The panel's plain-words summary of a comparison. */
export function describeSyncDiff(diff) {
  const removed = countPhrase(diff.removed);
  const total = (lists) => Object.values(lists || {}).reduce((n, list) => n + list.length, 0);
  const addedTotal = total(diff.added);
  const changedTotal = total(diff.changed);
  let text = `This Sync would remove ${removed} that the game has now`;
  if (changedTotal && addedTotal) text += `, overwrite ${changedTotal} it has with different content, and add ${addedTotal} the game doesn't have.`;
  else if (changedTotal) text += `, and overwrite ${changedTotal} it has with different content.`;
  else text += addedTotal ? `, and add ${addedTotal} the game doesn't have.` : '.';
  text += " If you didn't delete these on purpose, your CMS copy is probably out of date: use Backups → Restore from Game first.";
  return text;
}
