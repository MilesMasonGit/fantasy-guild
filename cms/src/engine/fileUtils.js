import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useEntityStore } from '../stores/useEntityStore';
import { PASSTHROUGH_KEY } from './gameImporter';

/**
 * Downloads a complete backup of the CMS state as a JSON file.
 */
export function exportWorkspace() {
  const state = useEntityStore.getState();
  const backup = {
    items: state.items,
    tasks: state.tasks,
    recipes: state.recipes,
    encounters: state.encounters,
    stations: state.stations,
    enemies: state.enemies,
    areas: state.areas,
    quests: state.quests,
    subskills: state.subskills,
    effects: state.effects,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  saveAs(blob, `cms-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`);
}

/**
 * Reads a JSON file and applies it to the CMS state.
 */
export async function importWorkspace(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const state = useEntityStore.getState();
        // Hydrate the store
        state.hydrate(data);
        resolve();
      } catch (err) {
        reject(new Error('Failed to parse backup file. Invalid JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

// ===========================================================================
// Per-entity projectors (CMS store shape → game `data/` shape).
//
// CMS rework Phase 3 (L9/L10). These were extracted verbatim from the old
// monolithic buildGamePackage() so there is a SINGLE source of truth for
// "which fields the CMS owns and their game shape." Both buildGamePackage()
// (whole-file rebuild, used by Export Package) and the field-level merge sync
// (syncMerge.js) call these, so the projection can never drift between the two.
//
// Each projector emits ONLY the fields the CMS models. Anything it doesn't
// emit (card tags, config.tokenId, config.taskIcon, area gridConfig /
// masteryBonuses / exploration, and any unknown keys) is preserved by the
// merge because the merge applies these projections as a *diff against the
// entity's `_source` pre-image*, not as a whole-object replacement.
// ===========================================================================

/** Derive a min/max damage range from a single combatStat (matches mockBattle.js). */
function deriveDamageRange(combatStat) {
  const min = Math.max(1, Math.floor(combatStat * 0.4));
  const max = Math.max(2, Math.floor(combatStat * 0.6));
  return { min, max };
}

/** Item → game shape (items.json). */
export function projectItem(item) {
  return {
    id: item.id,
    name: item.name,
    type: (item.type || 'material').toLowerCase(),
    tags: item.tags || [],
    description: item.description || '',
    stackable: item.stackable ?? true,
    maxStack: item.maxStack || 99999,
    ...(item.damage ? { damage: item.damage } : {}),
    ...(item.defense ? { defense: item.defense } : {}),
    ...(item.hpBonus ? { hpBonus: item.hpBonus } : {}),
    ...(item.tickSpeedBonus ? { tickSpeedBonus: item.tickSpeedBonus } : {}),
    ...(item.durability ? { maxDurability: item.durability } : {}),
    ...(item.restoreAmount ? { restoreAmount: item.restoreAmount } : {}),
    ...(item.restoreType ? { restoreType: item.restoreType } : {}),
    ...(item.regen ? { regen: item.regen } : {}),
    ...(item.equipSlot ? { equipSlot: item.equipSlot } : {}),
    ...(item.sprite ? { sprite: item.sprite } : {}),
    baseValue: item.sellPrice !== undefined ? item.sellPrice : (item.trueCost !== undefined ? item.trueCost : 0)
  };
}

/**
 * Card (task / combat / mutator) → game shape. `ctx` carries the cross-entity
 * lookups the projection needs: { encounters, tags }.
 * Returns the card definition object only — file routing lives with the caller.
 */
export function projectCard(task, ctx = {}) {
  const encounters = ctx.encounters || {};
  const tags = ctx.tags || {};
  const isCombat = task.cardType === 'combat' || task.preset === 'BASIC_COMBAT' || task.skill === 'combat';

  // Resolve enemyId from encounter outputs if available
  let resolvedEnemyId = task.enemyId || null;
  const encounterOutput = (task.outputs || []).find(o => o.type === 'encounterTable' || o.type === 'encounter');
  if (encounterOutput) {
    if (encounterOutput.enemies && encounterOutput.enemies.length > 0) {
      resolvedEnemyId = encounterOutput.enemies[0].enemyId;
    } else {
      const encounterId = encounterOutput.id || encounterOutput.itemId;
      const encounter = encounters[encounterId];
      if (encounter && encounter.assignedEnemies && encounter.assignedEnemies.length > 0) {
        resolvedEnemyId = encounter.assignedEnemies[0].enemyId;
      }
    }
  }

  const inputs = (task.inputs || []).map(inp => {
    const tag = tags[inp.id];
    if (tag) {
      return {
        acceptTag: inp.id,
        quantity: inp.quantity || 1,
        slotLabel: inp.slotLabel || `Any ${tag.name}`
      };
    }
    return { itemId: inp.id, quantity: inp.quantity || 1 };
  });

  const outputs = [];
  for (const out of (task.outputs || [])) {
    if (out.type === 'encounterTable' || out.type === 'encounter') {
      if (!isCombat && resolvedEnemyId) {
        outputs.push({
          type: 'combat_trigger',
          enemyId: resolvedEnemyId,
          chance: out.dropChance !== undefined ? out.dropChance : (out.chance !== undefined ? out.chance : 100)
        });
      }
    } else {
      outputs.push({
        itemId: out.id || out.itemId,
        quantity: out.quantity || 1,
        chance: out.dropChance !== undefined ? out.dropChance : (out.chance !== undefined ? out.chance : 100)
      });
    }
  }

  const config = {
    skill: task.skill || 'nature',
    baseTickTime: task.baseTickTime || 10000,
    actionLabel: task.actionLabel || 'Working...',
    xp: task.xpAwarded !== undefined ? task.xpAwarded : (task.xp || 0),
    ...(resolvedEnemyId ? { enemyId: resolvedEnemyId } : {}),
    inputs,
    outputs
  };

  return {
    id: task.id,
    name: task.name,
    cardType: task.cardType || (isCombat ? 'combat' : 'task'),
    preset: task.preset || (isCombat ? 'BASIC_COMBAT' : 'BASIC_TASK'),
    description: task.description || '',
    areaId: task.areaId || '',
    parentQuest: task.parentQuest || null,
    background: task.background || '',
    isUnique: task.isUnique ?? false,
    config
  };
}

/** Which `data/` file a card projection routes into. Used for BRAND-NEW cards. */
export function routeCardFile(task) {
  const isCombat = task.cardType === 'combat' || task.preset === 'BASIC_COMBAT' || task.skill === 'combat';
  if (isCombat) return `cards/combat/${task.biomeId || task.areaId || 'global'}.json`;
  return `cards/tasks/${task.areaId || 'global'}.json`;
}

/** Enemy → game shape (enemies.json). */
export function projectEnemy(enemy) {
  const derivedDamage = deriveDamageRange(enemy.combatStat || 5);
  return {
    id: enemy.id,
    name: enemy.name,
    biomeId: enemy.biomeId || enemy.areaId || '',
    tier: enemy.tier || 1,
    combatType: (enemy.combatType || 'melee').toLowerCase(),
    energyCost: enemy.energyCost || 2,
    hp: enemy.hp || 30,
    attackSkill: enemy.combatStat || 5,
    defenceSkill: enemy.combatStat || 5,
    minDamage: derivedDamage.min,
    maxDamage: derivedDamage.max,
    attackSpeed: enemy.attackSpeed || 3000,
    xpAwarded: enemy.xpAwarded || 0,
    ...(enemy.sprite ? { sprite: enemy.sprite } : {}),
    drops: (enemy.drops || []).map(d => ({
      itemId: d.id || d.itemId,
      minQty: d.minQty || 1,
      maxQty: d.maxQty || 1,
      chance: d.dropChance !== undefined ? d.dropChance : (d.chance !== undefined ? d.chance : 100)
    })),
    traits: (enemy.assignedEffects || []).map(eff => ({
      id: typeof eff === 'string' ? eff : eff.effectId,
      level: typeof eff === 'object' ? eff.scale || eff.level || 1 : 1
    }))
  };
}

/** Quest → game shape (quests.json). */
export function projectQuest(quest) {
  const targetEventMap = {
    'Gain Item': 'ON_ITEM_GAINED',
    'Kill Enemy': 'ON_ENEMY_KILLED',
    'item': 'ON_ITEM_GAINED',
    'enemy': 'ON_ENEMY_KILLED'
  };
  const rawEvent = quest.targetEvent || '';
  const mappedEvent = targetEventMap[rawEvent] || rawEvent;
  return {
    id: quest.id,
    name: quest.name,
    description: quest.description || '',
    areaId: quest.areaId || '',
    targetEvent: mappedEvent,
    targetId: quest.targetId || '',
    maxProgress: quest.maxProgress || 1,
    mapFragmentTarget: quest.mapFragmentTarget || '',
    rewards: (quest.rewards || []).map(r => ({
      type: (r.type || 'ITEM').toUpperCase(),
      id: r.itemId || r.id,
      amount: r.amount || r.count || 1
    }))
  };
}

/** Area → game shape (cards/area/areas.json). `ctx` carries { quests }. */
export function projectArea(area, ctx = {}) {
  const quests = ctx.quests || {};
  const id = area.id;
  // Unlock quests are DERIVED from each quest's Map Fragment Target — quests.json
  // stays the single source (Deck Loop rework Phase 2 §2B).
  const unlockQuestIds = Object.values(quests)
    .filter(q => q.mapFragmentTarget === id)
    .map(q => q.id);

  const deckSlots = Array.isArray(area.deckSlots)
    ? area.deckSlots.map(slot => {
        const slotType = slot.slotType || 'regular';
        return {
          slotType,
          templateId: slot.templateId || null,
          ...(slot.specializedTags?.length ? { specializedTags: slot.specializedTags } : {}),
          ...(slotType === 'locked' && slot.hazard ? {
            hazard: {
              type: slot.hazard.type || 'poison',
              damagePerPass: Number(slot.hazard.damagePerPass) || 0,
              tickTime: Number(slot.hazard.tickTime) || 2000
            }
          } : {})
        };
      })
    : undefined;

  return {
    unlockQuestIds,
    ...(deckSlots !== undefined ? { deckSlots } : {}),
    id,
    name: area.name,
    parentAreaId: area.parentAreaId || '',
    questBackground: area.questBackground || '',
    invasionBackground: area.invasionBackground || '',
    areaArt: area.sprite || area.areaArt || `bg_${id}`,
    backgroundImage: area.backgroundImage || 'pm_table_wood_spruce',
    backgroundMode: area.backgroundMode || 'tiled-grid',
    totalFragments: area.totalFragments || 0,
    packBaseGoldCost: area.packBaseGoldCost || 50,
    packCostScaling: area.packCostScaling || 5,
    cardPool: area.cardPool || [],
    deckList: area.deckList || {},
    masteryBonuses: area.masteryBonuses || {},
    exploration: area.exploration || {},
    invasionSpawnPool: area.invasionSpawnPool || []
  };
}

/**
 * recipes / stations / effects / subskills / encounters round-trip in
 * near-native shape. The only thing to strip is the `_source` passthrough
 * record the importer attached (it must never be written to a game file).
 */
export function projectPassthrough(entity) {
  const { [PASSTHROUGH_KEY]: _omit, ...rest } = entity;
  return rest;
}

/**
 * Builds a flat mapping of game database files and their formatted contents by
 * REBUILDING each file from scratch. Still used by Export Package (ZIP). The
 * live "Sync to Game" no longer uses this — it does a field-level merge
 * (syncMerge.js) so unmodelled fields survive. Kept whole-file for the ZIP
 * export, where a clean-slate rebuild is the intent.
 */
export function buildGamePackage(state = useEntityStore.getState()) {
  const files = {};
  const ctx = { encounters: state.encounters || {}, tags: state.tags || {}, quests: state.quests || {} };

  // 1. Items (object keyed by id)
  const items = {};
  for (const [id, item] of Object.entries(state.items || {})) items[id] = projectItem(item);
  files['items.json'] = items;

  // 2. Cards, routed into tasks/ vs combat/ subdirectories
  const tasksByArea = {};
  const combatCardsByBiome = {};
  for (const [id, task] of Object.entries(state.tasks || {})) {
    const cardDef = projectCard(task, ctx);
    const isCombat = task.cardType === 'combat' || task.preset === 'BASIC_COMBAT' || task.skill === 'combat';
    if (isCombat) {
      const biomeId = task.biomeId || task.areaId || 'global';
      (combatCardsByBiome[biomeId] ||= {})[id] = cardDef;
    } else {
      const areaId = task.areaId || 'global';
      (tasksByArea[areaId] ||= {})[id] = cardDef;
    }
  }
  for (const [areaId, areaTasks] of Object.entries(tasksByArea)) files[`cards/tasks/${areaId}.json`] = areaTasks;
  for (const [biomeId, biomeCombat] of Object.entries(combatCardsByBiome)) files[`cards/combat/${biomeId}.json`] = biomeCombat;

  // 3. Enemies
  const enemies = {};
  for (const [id, enemy] of Object.entries(state.enemies || {})) enemies[id] = projectEnemy(enemy);
  files['enemies.json'] = enemies;

  // 4. Quests
  const quests = {};
  for (const [id, quest] of Object.entries(state.quests || {})) quests[id] = projectQuest(quest);
  files['quests.json'] = quests;

  // 5. Areas
  const areas = {};
  for (const [id, area] of Object.entries(state.areas || {})) areas[id] = projectArea(area, ctx);
  files['cards/area/areas.json'] = areas;

  // 6. Near-native registries (arrays). Strip the importer's `_source`.
  const formatRegistry = (registry) => Object.values(registry || {}).map(projectPassthrough);
  files['recipes.json'] = formatRegistry(state.recipes);
  files['encounters.json'] = formatRegistry(state.encounters);
  files['stations.json'] = formatRegistry(state.stations);
  files['subskills.json'] = formatRegistry(state.subskills);
  files['effects.json'] = formatRegistry(state.effects);

  return files;
}

/**
 * Generates a ZIP file containing individual JSON files for each registry,
 * formatted exactly as the game engine expects them (as arrays).
 */
export async function exportGamePackage() {
  const files = buildGamePackage();
  const zip = new JSZip();

  for (const [relPath, content] of Object.entries(files)) {
    zip.file(relPath, JSON.stringify(content, null, 2));
  }

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `fantasy_guild_export_${new Date().toISOString().slice(0, 10)}.zip`);
}

