import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { useEntityStore } from '../stores/useEntityStore';

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

/**
 * Generates a ZIP file containing individual JSON files for each registry,
 * formatted exactly as the game engine expects them (as arrays).
 */
/**
 * Builds a flat mapping of game database files and their formatted contents.
 */
export function buildGamePackage() {
  const state = useEntityStore.getState();
  const files = {};

  // Helper to derive damage range from combatStat (matching mockBattle.js)
  const deriveDamageRange = (combatStat) => {
    const min = Math.max(1, Math.floor(combatStat * 0.4));
    const max = Math.max(2, Math.floor(combatStat * 0.6));
    return { min, max };
  };

  // 1. Format Items (Object keyed by ID)
  const items = {};
  for (const [id, item] of Object.entries(state.items || {})) {
    items[id] = {
      id,
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
  files['items.json'] = items;

  // 2. Format & Route Tasks (Tasks vs. Combat Card folder routing)
  const tasksByArea = {};
  const combatCardsByBiome = {};

  for (const [id, task] of Object.entries(state.tasks || {})) {
    const isCombat = task.cardType === 'combat' || task.preset === 'BASIC_COMBAT' || task.skill === 'combat';
    
    // Resolve enemyId from encounter outputs if available
    let resolvedEnemyId = task.enemyId || null;
    const encounterOutput = (task.outputs || []).find(o => o.type === 'encounterTable' || o.type === 'encounter');
    if (encounterOutput) {
      if (encounterOutput.enemies && encounterOutput.enemies.length > 0) {
        resolvedEnemyId = encounterOutput.enemies[0].enemyId;
      } else {
        const encounterId = encounterOutput.id || encounterOutput.itemId;
        const encounter = state.encounters?.[encounterId];
        if (encounter && encounter.assignedEnemies && encounter.assignedEnemies.length > 0) {
          resolvedEnemyId = encounter.assignedEnemies[0].enemyId;
        }
      }
    }

    const inputs = (task.inputs || []).map(inp => {
      const tag = state.tags?.[inp.id];
      if (tag) {
        return {
          acceptTag: inp.id,
          quantity: inp.quantity || 1,
          slotLabel: inp.slotLabel || `Any ${tag.name}`
        };
      }
      return {
        itemId: inp.id,
        quantity: inp.quantity || 1
      };
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

    const cardDef = {
      id,
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

    if (isCombat) {
      const biomeId = task.biomeId || task.areaId || 'global';
      if (!combatCardsByBiome[biomeId]) combatCardsByBiome[biomeId] = {};
      combatCardsByBiome[biomeId][id] = cardDef;
    } else {
      const areaId = task.areaId || 'global';
      if (!tasksByArea[areaId]) tasksByArea[areaId] = {};
      tasksByArea[areaId][id] = cardDef;
    }
  }

  // Write card files to correct subdirectories
  for (const [areaId, areaTasks] of Object.entries(tasksByArea)) {
    files[`cards/tasks/${areaId}.json`] = areaTasks;
  }
  for (const [biomeId, biomeCombat] of Object.entries(combatCardsByBiome)) {
    files[`cards/combat/${biomeId}.json`] = biomeCombat;
  }

  // 3. Format Base Enemies (`enemies.json`)
  const enemies = {};
  for (const [id, enemy] of Object.entries(state.enemies || {})) {
    const derivedDamage = deriveDamageRange(enemy.combatStat || 5);
    enemies[id] = {
      id,
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
  files['enemies.json'] = enemies;

  // 4. Format Quests (`quests.json`)
  const quests = {};
  for (const [id, quest] of Object.entries(state.quests || {})) {
    const targetEventMap = {
      'Gain Item': 'ON_ITEM_GAINED',
      'Kill Enemy': 'ON_ENEMY_KILLED',
      'item': 'ON_ITEM_GAINED',
      'enemy': 'ON_ENEMY_KILLED'
    };
    const rawEvent = quest.targetEvent || '';
    const mappedEvent = targetEventMap[rawEvent] || rawEvent;

    quests[id] = {
      id,
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
  files['quests.json'] = quests;

  // 5. Format Areas Set Config (`cards/area/areas.json`)
  const areas = {};
  for (const [id, area] of Object.entries(state.areas || {})) {
    // Deck Loop rework (Phase 2 §2B): unlock quests are derived from each
    // quest's Map Fragment Target — quests.json stays the single source.
    const unlockQuestIds = Object.values(state.quests || {})
      .filter(q => q.mapFragmentTarget === id)
      .map(q => q.id);

    // Deck slot entries are normalized to the authored schema (§2C/§2C-1).
    // If this area has never had deck slots authored in the CMS, the key is
    // omitted entirely so the sync API can preserve what's already in the
    // game's areas.json (see vite-plugin-cms-api.js merge guard).
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

    areas[id] = {
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
  files['cards/area/areas.json'] = areas;

  const formatRegistry = (registry) => Object.values(registry || {});
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

/**
 * Syncs the game package directly to the local project data folders via the server API.
 */
export async function syncGamePackage() {
  const files = buildGamePackage();

  const response = await fetch('/api/sync-game-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to sync game data');
  }
}

