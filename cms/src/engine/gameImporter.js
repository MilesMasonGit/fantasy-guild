// === Round-trip import: game `data/` → CMS store ===
//
// CMS rework Phase 2 (cms_rework_roadmap_v1.md §5; L8, L9, L10, F3, F13).
// This is the inverse of buildGamePackage() in fileUtils.js. buildGamePackage
// maps CMS → game; this maps game → CMS so the CMS can finally *read* the
// content it claims to own.
//
// The single most important output of this module is the PASSTHROUGH RECORD.
// Every imported entity keeps a complete, UNTOUCHED copy of its original game
// JSON under `_source` (PASSTHROUGH_KEY). Phase 3's field-level merge (L9/L10)
// diffs CMS-modelled fields against this record and writes back only what
// changed, passing everything else through untouched. So `_source` must contain
// EVERY original field — including ones the CMS never models (deckSlots,
// gridConfig, masteryBonuses, exploration, invasionSpawnPool, config.tokenId,
// card tags/traits, and any unknown keys). Never mutate `_source`.
//
// Anomalies are SURFACED, never normalized (F13). A card with no `preset`, a
// skill outside the game's 15, or a dangling item/enemy reference is collected
// into an anomaly list and shown to the user — it is not silently "fixed".

import { VALID_SKILL_IDS } from '../utils/constants.js';

/** The key under which each imported entity stashes its untouched original JSON. */
export const PASSTHROUGH_KEY = '_source';

/** Endpoint added in vite-plugin-cms-api.js that reads data/** back out. */
const LOAD_ENDPOINT = '/api/load-game-data';

/**
 * Game file (relative to data/) → CMS store collection.
 * Card folders all funnel into `tasks` (the de-facto "cards" collection — see
 * decision in the Phase 2 brief). Only the four authored/preserved card kinds
 * are imported: task, combat, action(mutator), explore. Other card folders
 * (blueprint / consumable / pack / project …) are preserve-only types the CMS
 * does not model, so they are left untouched in `data/` for Phase 3's merge to
 * pass through, and are NOT pulled into the store here.
 */
const CARD_DIR_TO_COLLECTION = {
  'cards/tasks': 'tasks',
  'cards/combat': 'tasks',
  'cards/action': 'tasks',
  'cards/explore': 'tasks',
};


// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** A game file may be an array of entities or an object keyed by id. Normalize. */
function toEntries(fileContent) {
  if (Array.isArray(fileContent)) {
    return fileContent
      .filter((e) => e && typeof e === 'object' && e.id)
      .map((e) => [e.id, e]);
  }
  if (fileContent && typeof fileContent === 'object') {
    return Object.entries(fileContent).filter(
      ([, e]) => e && typeof e === 'object' && !('__parseError' in e)
    );
  }
  return [];
}

/** Attach the untouched original under PASSTHROUGH_KEY. `src` is never mutated. */
function withSource(mapped, src) {
  return { ...mapped, [PASSTHROUGH_KEY]: src };
}

// ---------------------------------------------------------------------------
// Reverse mappers (game shape → CMS shape). Inverse of buildGamePackage().
// ---------------------------------------------------------------------------

function mapItem(src) {
  const price = src.baseValue !== undefined ? src.baseValue : 0;
  const mapped = {
    id: src.id,
    name: src.name,
    type: src.type || 'material',
    tags: src.tags || [],
    description: src.description || '',
    stackable: src.stackable ?? true,
    maxStack: src.maxStack || 99,
    // buildGamePackage: CMS sellPrice/trueCost → game baseValue. Reverse here.
    sellPrice: price,
    trueCost: price,
    restoreType: src.restoreType || '',
    restoreAmount: src.restoreAmount || 0,
    regen: src.regen || 0,
    equipSlot: src.equipSlot || '',
    // buildGamePackage: CMS durability → game maxDurability.
    durability: src.maxDurability || src.durability || 0,
    sprite: src.sprite || '',
    ...(src.damage !== undefined ? { damage: src.damage } : {}),
    ...(src.defense !== undefined ? { defense: src.defense } : {}),
    ...(src.hpBonus !== undefined ? { hpBonus: src.hpBonus } : {}),
    ...(src.tickSpeedBonus !== undefined ? { tickSpeedBonus: src.tickSpeedBonus } : {}),
  };
  return withSource(mapped, src);
}

function mapCardInputs(arr) {
  return (arr || []).map((i) => ({
    id: i.itemId || i.acceptTag || i.id,
    quantity: i.quantity ?? 1,
    ...(i.slotLabel ? { slotLabel: i.slotLabel } : {}),
    ...(i.acceptTag ? { acceptTag: i.acceptTag } : {}),
  }));
}

function mapCardOutputs(arr) {
  return (arr || []).map((o) => {
    if (o.type === 'combat_trigger') {
      return {
        type: 'combat_trigger',
        enemyId: o.enemyId,
        dropChance: o.chance ?? 100,
        minQty: 1,
        maxQty: 1,
        isLocked: false,
        isPrimarySource: false,
      };
    }
    return {
      id: o.itemId || o.id,
      type: o.type || 'item',
      dropChance: o.chance ?? o.dropChance ?? 100,
      minQty: o.minQty ?? o.quantity ?? 1,
      maxQty: o.maxQty ?? o.quantity ?? 1,
      isLocked: o.isLocked ?? false,
      isPrimarySource: o.isPrimarySource ?? o.isPrimaryOutput ?? false,
    };
  });
}

/**
 * Cards (task / combat / action-mutator / explore) all map into `tasks`.
 * cardType, preset and config are preserved VERBATIM (decision 3) — config is
 * copied onto the entity untouched (mutators keep config.tokenId this way) and
 * also lives, whole, inside `_source`.
 */
function mapCard(src) {
  const cfg = src.config || {};
  // Outputs live under config.outputs on modern cards, or top-level drops on the
  // legacy gather_berry_bramble shape. Inputs are config.inputs when present.
  const rawOutputs = cfg.outputs || src.outputs || src.drops || [];
  const rawInputs = cfg.inputs || src.inputs || [];

  const mapped = {
    id: src.id,
    name: src.name,
    cardType: src.cardType,
    preset: src.preset, // may be undefined → surfaced as an anomaly, never invented
    description: src.description || '',
    areaId: src.areaId || '',
    biomeId: src.biomeId || '',
    background: src.background || '',
    parentQuest: src.parentQuest ?? null,
    isUnique: src.isUnique ?? false,
    skill: cfg.skill || src.skill || '',
    baseTickTime: cfg.baseTickTime || src.baseTickTime || 10000,
    actionLabel: cfg.actionLabel || '',
    xpAwarded: cfg.xp ?? src.xp ?? 0,
    enemyId: src.enemyId || cfg.enemyId || null,
    inputs: mapCardInputs(rawInputs),
    outputs: mapCardOutputs(rawOutputs),
    tags: src.tags || [],
    config: cfg, // verbatim
    ...(cfg.tokenId ? { tokenId: cfg.tokenId } : {}),
  };
  return withSource(mapped, src);
}

function mapEnemy(src) {
  const mapped = {
    id: src.id,
    name: src.name,
    areaId: src.areaId || '',
    biomeId: src.biomeId || '',
    tier: src.tier || 1,
    // buildGamePackage derived attackSkill/defenceSkill from a single combatStat.
    combatStat: src.combatStat ?? src.attackSkill ?? src.defenceSkill ?? 5,
    hp: src.hp || 30,
    attackSpeed: src.attackSpeed || 3000,
    combatType: src.combatType || 'melee',
    energyCost: src.energyCost || 2,
    xpAwarded: src.xpAwarded || 0,
    sprite: src.sprite || '',
    drops: (src.drops || []).map((d) => ({
      id: d.itemId || d.id,
      type: d.type || 'item',
      dropChance: d.chance ?? d.dropChance ?? 100,
      minQty: d.minQty ?? 1,
      maxQty: d.maxQty ?? 1,
      isLocked: false,
    })),
    // buildGamePackage: CMS assignedEffects → game traits.
    assignedEffects: (src.traits || src.assignedEffects || []).map((t) =>
      typeof t === 'string'
        ? { effectId: t, scale: 1 }
        : { effectId: t.effectId || t.id, scale: t.scale ?? t.level ?? 1 }
    ),
  };
  return withSource(mapped, src);
}

function mapArea(src) {
  const mapped = {
    id: src.id,
    name: src.name,
    parentAreaId: src.parentAreaId || '',
    totalFragments: src.totalFragments || 0,
    packBaseGoldCost: src.packBaseGoldCost || 50,
    packCostScaling: src.packCostScaling || 5,
    cardPool: src.cardPool || [],
    // buildGamePackage: CMS sprite → game areaArt.
    sprite: src.areaArt || src.sprite || '',
    questBackground: src.questBackground || '',
    invasionBackground: src.invasionBackground || '',
    backgroundImage: src.backgroundImage || '',
    backgroundMode: src.backgroundMode || '',
    deckList: src.deckList || {},
    // deckSlots is modelled (Phase 7 editor). Preserve verbatim; gridConfig,
    // masteryBonuses, exploration, invasionSpawnPool, unlockQuestIds all ride
    // along in _source untouched for Phase 3.
    ...(src.deckSlots !== undefined ? { deckSlots: src.deckSlots } : {}),
  };
  return withSource(mapped, src);
}

/**
 * recipes / stations / effects / subskills / encounters / quests already
 * round-trip in near-CMS-native shape (they were written by the CMS sync).
 * Pass them through and attach the passthrough record.
 */
function mapPassthrough(src) {
  return withSource({ ...src }, src);
}

/**
 * Dispatch a raw game-JSON object to the right reverse mapper for its
 * collection. Phase 3's field-level merge uses this to reconstruct the
 * "baseline" CMS entity from an entity's `_source` pre-image, so it can project
 * that baseline and diff the current projection against it. Mirrors the
 * collection→mapper routing in buildEntitiesFromBundle().
 */
export function mapSourceToEntity(collection, src) {
  switch (collection) {
    case 'items': return mapItem(src);
    case 'tasks': return mapCard(src);
    case 'enemies': return mapEnemy(src);
    case 'areas': return mapArea(src);
    default: return mapPassthrough(src);
  }
}

// ---------------------------------------------------------------------------
// Anomaly collection (F13) — surfaced, never normalized.
// ---------------------------------------------------------------------------

function collectCardAnomalies(src, anomalies, itemIds, enemyIds) {
  const cardType = src.cardType || '(none)';

  // Missing preset. gather_berry_bramble is the known offender.
  if (src.preset === undefined || src.preset === null || src.preset === '') {
    anomalies.push({
      type: 'missing_preset',
      collection: 'tasks',
      entityId: src.id,
      message: `Card "${src.id}" (cardType ${cardType}) has no preset field.`,
    });
  }

  // Unknown skill: not a parent skill, subskill, or legacy alias the game
  // accepts (mirrors CardValidator). Valid subskills like `foraging` and the
  // remapped legacy ids (industry/…) are NOT flagged.
  const skill = (src.config && src.config.skill) || src.skill;
  if (skill && !VALID_SKILL_IDS.has(skill)) {
    anomalies.push({
      type: 'unknown_skill',
      collection: 'tasks',
      entityId: src.id,
      message: `Card "${src.id}" references skill "${skill}" which the game does not recognize (not a skill, subskill, or legacy alias).`,
    });
  }

  // Dangling references in inputs/outputs/drops.
  const cfg = src.config || {};
  const outs = cfg.outputs || src.outputs || src.drops || [];
  const ins = cfg.inputs || src.inputs || [];
  for (const o of outs) {
    if (o.type === 'combat_trigger') {
      if (o.enemyId && !enemyIds.has(o.enemyId)) {
        anomalies.push({
          type: 'dangling_enemy_ref',
          collection: 'tasks',
          entityId: src.id,
          message: `Card "${src.id}" combat trigger targets enemy "${o.enemyId}" which was not imported.`,
        });
      }
    } else {
      const id = o.itemId || o.id;
      if (id && !itemIds.has(id)) {
        anomalies.push({
          type: 'dangling_item_ref',
          collection: 'tasks',
          entityId: src.id,
          message: `Card "${src.id}" output references item "${id}" which was not imported.`,
        });
      }
    }
  }
  for (const i of ins) {
    // acceptTag inputs reference a tag, not an item — skip.
    if (i.acceptTag) continue;
    const id = i.itemId || i.id;
    if (id && !itemIds.has(id)) {
      anomalies.push({
        type: 'dangling_item_ref',
        collection: 'tasks',
        entityId: src.id,
        message: `Card "${src.id}" input references item "${id}" which was not imported.`,
      });
    }
  }

  // A top-level / config enemyId that doesn't resolve.
  const enemyId = src.enemyId || cfg.enemyId;
  if (enemyId && !enemyIds.has(enemyId)) {
    anomalies.push({
      type: 'dangling_enemy_ref',
      collection: 'tasks',
      entityId: src.id,
      message: `Card "${src.id}" references enemy "${enemyId}" which was not imported.`,
    });
  }
}

// ---------------------------------------------------------------------------
// The pure mapper: bundle of raw files → collections + anomalies.
// Kept side-effect-free and store-agnostic so it can be unit-tested in Node.
// ---------------------------------------------------------------------------

/**
 * @param {Record<string, any>} files - relPath (posix, relative to data/) → parsed JSON.
 * @returns {{ collections: object, anomalies: object[], counts: object }}
 */
export function buildEntitiesFromBundle(files) {
  const collections = {
    items: {},
    tasks: {},
    recipes: {},
    stations: {},
    enemies: {},
    areas: {},
    quests: {},
    subskills: {},
    effects: {},
    encounters: {},
  };
  const anomalies = [];

  // First pass: items and enemies, so card anomaly checks can resolve refs.
  if (files['items.json']) {
    for (const [id, src] of toEntries(files['items.json'])) {
      collections.items[id] = mapItem(src);
    }
  }
  if (files['enemies.json']) {
    for (const [id, src] of toEntries(files['enemies.json'])) {
      collections.enemies[id] = mapEnemy(src);
    }
  }
  const itemIds = new Set(Object.keys(collections.items));
  const enemyIds = new Set(Object.keys(collections.enemies));

  // Cards → tasks. Only the four authored/preserved card folders.
  // Track which file each card id first came from so a duplicate id across two
  // files is SURFACED (F13), not silently resolved by last-write-wins.
  const cardIdOrigin = {};
  for (const [relPath, content] of Object.entries(files)) {
    const dir = relPath.substring(0, relPath.lastIndexOf('/'));
    if (!CARD_DIR_TO_COLLECTION[dir]) continue;
    for (const [id, src] of toEntries(content)) {
      if (cardIdOrigin[id]) {
        anomalies.push({
          type: 'duplicate_id',
          collection: 'tasks',
          entityId: id,
          message: `Card "${id}" is defined in both "${cardIdOrigin[id]}" and "${relPath}". Only one survives import (last file wins) — decide which area it belongs to.`,
        });
      } else {
        cardIdOrigin[id] = relPath;
      }
      collections.tasks[id] = mapCard(src);
      collectCardAnomalies(src, anomalies, itemIds, enemyIds);
    }
  }

  // Areas.
  if (files['cards/area/areas.json']) {
    for (const [id, src] of toEntries(files['cards/area/areas.json'])) {
      collections.areas[id] = mapArea(src);
    }
  }

  // Near-native round-trip collections.
  const passthroughFiles = {
    'recipes.json': 'recipes',
    'stations.json': 'stations',
    'effects.json': 'effects',
    'subskills.json': 'subskills',
    'encounters.json': 'encounters',
    'quests.json': 'quests',
  };
  for (const [file, collection] of Object.entries(passthroughFiles)) {
    if (!files[file]) continue;
    for (const [id, src] of toEntries(files[file])) {
      collections[collection][id] = mapPassthrough(src);
    }
  }

  const counts = Object.fromEntries(
    Object.entries(collections).map(([k, v]) => [k, Object.keys(v).length])
  );

  return { collections, anomalies, counts };
}

// ---------------------------------------------------------------------------
// Runtime entry points (browser). Fetch → build → merge into the store.
// ---------------------------------------------------------------------------

/** Fetch the raw data bundle from the dev-server endpoint. */
export async function fetchGameData() {
  const res = await fetch(LOAD_ENDPOINT);
  if (!res.ok) {
    let msg = 'Failed to load game data';
    try {
      msg = (await res.json()).error || msg;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  const { files } = await res.json();
  return files || {};
}

/**
 * Full import: read data/, map to CMS entities, merge into the store.
 * Seed rule (L10): CMS wins on conflict; import fills anything absent. The
 * merge is delegated to the store's importGameData action; here we compute the
 * added/refreshed summary against the pre-merge store for the UI.
 *
 * @param {import('../stores/useEntityStore').useEntityStore} store - the zustand store hook.
 * @returns {Promise<{ counts: object, merge: object, anomalies: object[] }>}
 */
export async function importGameData(store) {
  const files = await fetchGameData();
  const { collections, anomalies, counts } = buildEntitiesFromBundle(files);

  const before = store.getState();
  const merge = {};
  for (const [name, incoming] of Object.entries(collections)) {
    const existing = before[name] || {};
    let added = 0;
    let refreshed = 0;
    for (const id of Object.keys(incoming)) {
      if (existing[id]) refreshed += 1;
      else added += 1;
    }
    merge[name] = { added, refreshed, incoming: Object.keys(incoming).length };
  }

  store.getState().importGameData(collections);

  return { counts, merge, anomalies };
}
