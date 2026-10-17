/**
 * What a Sync to Game would remove from or add to `data/`, compared file by file in the game's own
 * shape (the files `syncFiles` builds against the files on disk). Only ids count: an entity whose
 * fields changed is neither removed nor added.
 */

/** The collections compared, in the order the panel lists them. */
export const SYNC_COLLECTIONS = [
  { key: 'tokens', label: 'Token', plural: 'Tokens' },
  { key: 'items', label: 'item', plural: 'items' },
  { key: 'maps', label: 'map', plural: 'maps' },
  { key: 'recipes', label: 'recipe', plural: 'recipes' },
  { key: 'effects', label: 'effect', plural: 'effects' },
  { key: 'starterCamp', label: 'Starter Camp Token', plural: 'Starter Camp Tokens' },
];

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isMap = (def) => def?.type === 'map' || def?.type === 'modifier';

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

function collections(files) {
  return {
    tokens: keyed(files['tokens.json']),
    items: keyed(files['items.json'], (d) => !isMap(d)),
    maps: keyed(files['items.json'], isMap),
    recipes: keyedRecipes(files['tokenRecipes.json']),
    effects: keyed(files['effects.json']),
    starterCamp: keyedPlacements(files['starterCamp.json']),
  };
}

/**
 * @param {object} current the files in `data/` now, by file name (a missing file is absent or null)
 * @param {object} incoming the files the Sync would write, by file name
 * @returns {{ removed: object, added: object, hasRemovals: boolean }} per collection key, `[{ id, name }]`
 */
export function compareSync(current = {}, incoming = {}) {
  const before = collections(current || {});
  const after = collections(incoming || {});
  const removed = {};
  const added = {};
  for (const { key } of SYNC_COLLECTIONS) {
    // A Starter Camp the Sync does not write stays on disk untouched.
    if (key === 'starterCamp' && !incoming?.['starterCamp.json']) {
      removed[key] = [];
      added[key] = [];
      continue;
    }
    removed[key] = [...before[key]].filter(([id]) => !after[key].has(id)).map(([id, name]) => ({ id, name }));
    added[key] = [...after[key]].filter(([id]) => !before[key].has(id)).map(([id, name]) => ({ id, name }));
  }
  const hasRemovals = Object.values(removed).some((list) => list.length > 0);
  return { removed, added, hasRemovals };
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
  const addedTotal = Object.values(diff.added).reduce((n, list) => n + list.length, 0);
  let text = `This Sync would remove ${removed} that the game has now`;
  text += addedTotal ? `, and add ${addedTotal} the game doesn't have.` : '.';
  text += " If you didn't delete these on purpose, your CMS copy is probably out of date: use Backups → Restore from Game first.";
  return text;
}
