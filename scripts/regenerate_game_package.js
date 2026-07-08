import fs from 'fs';
import path from 'path';

// Path configuration
const rootDir = 'c:/Users/16048/Projects/fantasy_guild_v2';
const backupFile = path.join(rootDir, 'cms/backups/autosave_1782023883947.json');

if (!fs.existsSync(backupFile)) {
  console.error(`Backup file not found at: ${backupFile}`);
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

// Helper to derive damage range from combatStat
const deriveDamageRange = (combatStat) => {
  const min = Math.max(1, Math.floor(combatStat * 0.4));
  const max = Math.max(2, Math.floor(combatStat * 0.6));
  return { min, max };
};

const formatRegistry = (registry) => Object.values(registry || {});

const files = {};

// 1. Format Items
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

// 2. Format & Route Tasks
const tasksByArea = {};
const combatCardsByBiome = {};

for (const [id, task] of Object.entries(state.tasks || {})) {
  const isCombat = task.cardType === 'combat' || task.preset === 'BASIC_COMBAT' || task.skill === 'combat';
  
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

for (const [areaId, areaTasks] of Object.entries(tasksByArea)) {
  files[`cards/tasks/${areaId}.json`] = areaTasks;
}
for (const [biomeId, biomeCombat] of Object.entries(combatCardsByBiome)) {
  files[`cards/combat/${biomeId}.json`] = biomeCombat;
}

// 3. Format Base Enemies
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

// 4. Format Quests
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

// 5. Format Areas
const areas = {};
for (const [id, area] of Object.entries(state.areas || {})) {
  areas[id] = {
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
    gridConfig: area.gridConfig || {
      width: 3,
      height: 3,
      max_width: 5,
      max_height: 5,
      hubPosition: { x: 1, y: 1 },
      baseTileTemplate: id,
      baseTileVariants: 1,
      validCells: [{ x: 1, y: 1 }],
      tileMap: {}
    },
    masteryBonuses: area.masteryBonuses || {},
    exploration: area.exploration || {}
  };
}
files['cards/area/areas.json'] = areas;

files['recipes.json'] = formatRegistry(state.recipes);
files['encounters.json'] = formatRegistry(state.encounters);
files['stations.json'] = formatRegistry(state.stations || state.workstations);
files['subskills.json'] = formatRegistry(state.subskills);
files['effects.json'] = formatRegistry(state.effects);

// Write to files
for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(rootDir, 'data', relPath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, JSON.stringify(content, null, 2), 'utf8');
  console.log(`Successfully regenerated: data/${relPath}`);
}

console.log('--- REGENERATION COMPLETE ---');
