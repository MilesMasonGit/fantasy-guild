// === Field-level merge sync: CMS store → game `data/` ===
//
// CMS rework Phase 3 (cms_rework_roadmap_v1.md §5; L9, L10, L11, F3, F4).
// This REPLACES the old destructive syncGamePackage(), which rebuilt every
// `data/` file from scratch and wrote over the originals — silently dropping
// anything the CMS doesn't model (card tags, config.tokenId, area gridConfig,
// deckSlots, unknown keys). See concept doc §2.2 / §3.2.
//
// The owner's requirement, verbatim: "If I change the value of an item or an
// output of a card, I want it to use the new value, but still keep that card in
// the data." That is a FIELD-LEVEL MERGE, never a file replacement.
//
// ---------------------------------------------------------------------------
// The algorithm
// ---------------------------------------------------------------------------
// The base is always the CURRENT on-disk file (re-read at sync time). For each
// entity the CMS still models we compute a minimal PATCH and deep-apply it onto
// the disk entity, so every field the CMS didn't touch — and every field it
// doesn't model — stays exactly as it is on disk.
//
// The patch is the diff of two PROJECTIONS, not projection-vs-disk:
//   current  = project(storeEntity)
//   baseline = project(mapSourceToEntity(storeEntity._source))
// Both run through the identical projector, so defaulting/normalization is the
// same on both sides and cancels out. An UNCHANGED entity therefore yields an
// EMPTY patch and its disk record is left byte-identical — regardless of any
// lossiness in the projector (e.g. the card projector drops config.tokenId; an
// unchanged mutator still keeps its tokenId because nothing is applied).
// Only fields the user actually edited in the CMS appear in the patch.
//
//   • Entity in CMS with a `_source`, present on disk → merge patch (above).
//   • Entity in CMS with NO `_source` (created in the CMS, never imported) and
//     absent from disk → genuinely new content: write its full projection.
//   • Entity on disk but ABSENT from the CMS store → left untouched (L10 —
//     silence preserves). Never deleted.
//   • Entity the user DELETED in the CMS → removed from `data/` ONLY on sync,
//     ONLY for ids on the staged pending-deletions list (L11). Absence is never
//     itself a deletion.
//
// Files the CMS doesn't model at all (cards/blueprint, cards/consumable,
// cards/pack, cards/project, …) are never touched — they aren't even read into
// the output set, so they pass through byte-for-byte.
//
// Only files that actually changed are POSTed, so unchanged files are never
// rewritten (and so can't be reformatted).

import { useEntityStore } from '../stores/useEntityStore';
import {
  PASSTHROUGH_KEY,
  mapSourceToEntity,
  fetchGameData,
} from './gameImporter';
import {
  projectItem,
  projectCard,
  projectEnemy,
  projectQuest,
  projectArea,
  projectPassthrough,
  routeCardFile,
} from './fileUtils';

// Collections the CMS models and that participate in the merge.
export const MODELLED_COLLECTIONS = [
  'items', 'tasks', 'recipes', 'stations', 'enemies',
  'areas', 'quests', 'subskills', 'effects', 'encounters',
];

// `data/` files that are stored as a JSON array rather than an object-keyed map.
const ARRAY_FILES = new Set([
  'recipes.json', 'stations.json', 'effects.json', 'subskills.json', 'encounters.json',
]);

/** Map a `data/`-relative file path to the CMS collection it belongs to (or null). */
function fileCollection(relPath) {
  switch (relPath) {
    case 'items.json': return 'items';
    case 'enemies.json': return 'enemies';
    case 'quests.json': return 'quests';
    case 'recipes.json': return 'recipes';
    case 'stations.json': return 'stations';
    case 'subskills.json': return 'subskills';
    case 'effects.json': return 'effects';
    case 'encounters.json': return 'encounters';
    case 'cards/area/areas.json': return 'areas';
    default: break;
  }
  const dir = relPath.substring(0, relPath.lastIndexOf('/'));
  // Card folders the CMS models funnel into `tasks` (see gameImporter.js).
  if (['cards/tasks', 'cards/combat', 'cards/action', 'cards/explore'].includes(dir)) {
    return 'tasks';
  }
  return null; // not modelled → passed through untouched
}

/** Project a store entity into game shape for its collection. */
function projectEntity(collection, entity, ctx) {
  switch (collection) {
    case 'items': return projectItem(entity);
    case 'tasks': return projectCard(entity, ctx);
    case 'enemies': return projectEnemy(entity);
    case 'areas': return projectArea(entity, ctx);
    case 'quests': return projectQuest(entity);
    default: return projectPassthrough(entity);
  }
}

/** Which `data/` file a brand-new (never-synced) entity should be written to. */
function routeNewEntity(collection, entity) {
  switch (collection) {
    case 'items': return 'items.json';
    case 'enemies': return 'enemies.json';
    case 'quests': return 'quests.json';
    case 'recipes': return 'recipes.json';
    case 'stations': return 'stations.json';
    case 'subskills': return 'subskills.json';
    case 'effects': return 'effects.json';
    case 'encounters': return 'encounters.json';
    case 'areas': return 'cards/area/areas.json';
    case 'tasks':
      // A mutator carries a token it hands out; it lives with the other mutators.
      if (entity.cardType === 'action' || entity.tokenId || entity.config?.tokenId) {
        return 'cards/action/mutators.json';
      }
      return routeCardFile(entity);
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Deep diff / apply primitives
// ---------------------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

/** A structuredClone-free deep clone for plain JSON. */
function clone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

/**
 * Nested patch of the leaves in `current` that changed vs `baseline` or are new.
 * Recurses into plain objects (so a change to config.outputs never disturbs the
 * sibling config.tokenId). Arrays are atomic — a changed array replaces whole.
 * Keys present in baseline but absent in current are NOT emitted (a cleared
 * field is left as it stands on disk — the conservative, non-destructive choice).
 */
export function deepDiff(current, baseline) {
  const patch = {};
  const base = baseline || {};
  for (const key of Object.keys(current)) {
    if (key === PASSTHROUGH_KEY) continue;
    const cv = current[key];
    if (!Object.prototype.hasOwnProperty.call(base, key)) {
      patch[key] = cv; // new field
      continue;
    }
    const bv = base[key];
    if (deepEqual(cv, bv)) continue;
    if (isPlainObject(cv) && isPlainObject(bv)) {
      const sub = deepDiff(cv, bv);
      if (Object.keys(sub).length) patch[key] = sub;
    } else {
      patch[key] = cv;
    }
  }
  return patch;
}

/** Deep-merge `patch` onto `target` in place, only overwriting changed leaves. */
export function deepApply(target, patch) {
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    if (isPlainObject(pv) && isPlainObject(target[key])) {
      deepApply(target[key], pv);
    } else {
      target[key] = pv;
    }
  }
}

/** Flatten a patch to dotted-path { path, old, new } rows for the preview. */
function flattenChanges(patch, base, prefix = '') {
  const rows = [];
  for (const key of Object.keys(patch)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const pv = patch[key];
    const ov = base ? base[key] : undefined;
    if (isPlainObject(pv) && isPlainObject(ov)) {
      rows.push(...flattenChanges(pv, ov, path));
    } else {
      rows.push({ path, old: ov, new: pv });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Plan builder
// ---------------------------------------------------------------------------

/**
 * Compute exactly what a sync would write, WITHOUT writing anything. Async
 * wrapper: reads data/ and the live store, then delegates to computeSyncPlan.
 * @returns {Promise<{ files: Record<string, any>, preview: object }>}
 */
export async function buildSyncPlan() {
  const diskFiles = await fetchGameData();
  const state = useEntityStore.getState();
  return computeSyncPlan(diskFiles, state);
}

/**
 * Pure core of the sync plan — no fetch, no store, no I/O. Given the current
 * on-disk files and a CMS store snapshot, returns the files to write and a
 * preview. Kept side-effect-free so it can be unit-tested in Node.
 * @param {Record<string, any>} diskFiles - relPath (posix, relative to data/) → parsed JSON.
 * @param {object} state - a store snapshot ({ items, tasks, …, tags, quests, encounters, pendingDeletions }).
 * @returns {{ files: Record<string, any>, preview: object }}
 *   `files`  — relPath → merged content, ONLY for files that changed.
 *   `preview`— { fileChanges: [{ file, entities: [{ id, changes }] }],
 *                deletions: [{ collection, id, file }],
 *                newEntities: [{ collection, id, file }] }
 */
export function computeSyncPlan(diskFiles, state) {
  const ctx = {
    encounters: state.encounters || {},
    tags: state.tags || {},
    quests: state.quests || {},
  };
  const pending = state.pendingDeletions || [];
  const pendingSet = new Set(pending.map((d) => `${d.collection}::${d.id}`));

  // Index every id present on disk, by collection — used to tell genuinely-new
  // CMS entities apart from ones that merely lost their `_source`.
  const diskIds = {};
  for (const [relPath, content] of Object.entries(diskFiles)) {
    const collection = fileCollection(relPath);
    if (!collection) continue;
    const set = (diskIds[collection] ||= new Set());
    const ids = Array.isArray(content)
      ? content.filter((e) => e && e.id).map((e) => e.id)
      : Object.keys(content || {});
    ids.forEach((id) => set.add(id));
  }

  const working = {}; // relPath → mutable clone of file content
  const changed = new Set();
  const preview = { fileChanges: [], deletions: [], newEntities: [] };
  const fileChangeIndex = {}; // relPath → preview.fileChanges entry

  const ensureFile = (relPath) => {
    if (!(relPath in working)) {
      working[relPath] = relPath in diskFiles
        ? clone(diskFiles[relPath])
        : (ARRAY_FILES.has(relPath) ? [] : {});
    }
    return working[relPath];
  };
  const recordEntityChange = (relPath, id, changes) => {
    changed.add(relPath);
    let entry = fileChangeIndex[relPath];
    if (!entry) {
      entry = { file: relPath, entities: [] };
      fileChangeIndex[relPath] = entry;
      preview.fileChanges.push(entry);
    }
    entry.entities.push({ id, changes });
  };

  // 1. Disk-driven pass: merge edits + apply staged deletions, entity by entity,
  //    keeping every entity in the file it already lives in.
  for (const [relPath, content] of Object.entries(diskFiles)) {
    const collection = fileCollection(relPath);
    if (!collection) continue; // unmodelled file → never touched
    const isArr = Array.isArray(content);
    const ids = isArr
      ? content.filter((e) => e && e.id).map((e) => e.id)
      : Object.keys(content || {});

    for (const id of ids) {
      // Deletion takes precedence over any edit.
      if (pendingSet.has(`${collection}::${id}`)) {
        const file = ensureFile(relPath);
        if (Array.isArray(file)) {
          const idx = file.findIndex((e) => e && e.id === id);
          if (idx >= 0) file.splice(idx, 1);
        } else {
          delete file[id];
        }
        changed.add(relPath);
        preview.deletions.push({ collection, id, file: relPath });
        continue;
      }

      const storeEntity = state[collection]?.[id];
      // Silence preserves: an entity the CMS doesn't hold is left as-is.
      // Without a `_source` pre-image we can't compute a safe minimal diff, so
      // we also leave it untouched (the intended flow is Import → edit → Sync).
      if (!storeEntity || !storeEntity[PASSTHROUGH_KEY]) continue;

      const current = projectEntity(collection, storeEntity, ctx);
      const baselineEntity = mapSourceToEntity(collection, storeEntity[PASSTHROUGH_KEY]);
      const baseline = projectEntity(collection, baselineEntity, ctx);
      const patch = deepDiff(current, baseline);
      if (Object.keys(patch).length === 0) continue;

      const file = ensureFile(relPath);
      const target = Array.isArray(file) ? file.find((e) => e && e.id === id) : file[id];
      if (!target) continue;
      const changes = flattenChanges(patch, target);
      deepApply(target, patch);
      recordEntityChange(relPath, id, changes);
    }
  }

  // 2. Genuinely-new content: in the CMS, no `_source`, not on disk anywhere,
  //    not staged for deletion. Write the full projection into its target file.
  for (const collection of MODELLED_COLLECTIONS) {
    const coll = state[collection] || {};
    for (const [id, entity] of Object.entries(coll)) {
      if (!entity || entity[PASSTHROUGH_KEY]) continue;      // existed on disk already
      if (pendingSet.has(`${collection}::${id}`)) continue;
      if (diskIds[collection]?.has(id)) continue;            // merged in pass 1
      const relPath = routeNewEntity(collection, entity);
      if (!relPath) continue;
      const file = ensureFile(relPath);
      const projection = projectEntity(collection, entity, ctx);
      if (Array.isArray(file)) file.push(projection);
      else file[id] = projection;
      changed.add(relPath);
      preview.newEntities.push({ collection, id, file: relPath });
    }
  }

  const files = {};
  for (const relPath of changed) files[relPath] = working[relPath];
  return { files, preview };
}

/**
 * Write a computed plan's files to `data/`. Each value is a fully-merged file;
 * the server just persists it (no reconstruction, no per-field guards).
 * Clears the pending-deletions list on success (L11).
 */
export async function applySyncPlan(files) {
  const response = await fetch('/api/sync-game-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  if (!response.ok) {
    let msg = 'Failed to sync game data';
    try { msg = (await response.json()).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  useEntityStore.getState().clearPendingDeletions();
}

/** True when a plan would write nothing. */
export function isEmptyPlan(plan) {
  return !plan || Object.keys(plan.files || {}).length === 0;
}
