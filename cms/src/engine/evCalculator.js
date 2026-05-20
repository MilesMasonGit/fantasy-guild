/**
 * EV Calculator — Implements §4.1a-c of the CMS Design Document.
 *
 * Calculates the Total Cost, Total Reward, and EV for a single task cycle.
 */

/**
 * Calculate the Total Cost of running a task once.
 */
export function calculateTotalCost(task, items, globals) {
  const materialCost = sumInputCosts(task.inputs, items);
  const laborCost = calcLaborCost(task.baseTickTime, task.skillRequirement, globals);
  const energyCost = (task.energyCost || 0) * (globals.energyGpValue || 0.25);
  const toolDepreciation = 0; 

  let encounterCost = 0;

  const outputs = task.outputs || task.drops || [];
  
  // Calculate Encounter Pool Cost
  const encounterOutputs = outputs.filter(o => o.type === 'encounter');
  
  if (globals.enemyUpdates) {
    for (const enc of encounterOutputs) {
      const triggerChance = (enc.chance ?? 100) / 100;
      if (triggerChance <= 0) continue;
      
      const enemies = enc.enemies || [];
      const totalEnemyWeight = enemies.reduce((sum, en) => sum + (en.weight ?? 100), 0);
      
      if (totalEnemyWeight > 0) {
        for (const en of enemies) {
          const weight = en.weight ?? 100;
          const enemyChance = (weight / totalEnemyWeight) * triggerChance;
          
          const enemyStats = globals.enemyUpdates[en.enemyId];
          if (enemyStats && enemyStats.combatCost && enemyStats.combatCost.total) {
            encounterCost += enemyStats.combatCost.total * enemyChance;
          }
        }
      }
    }
  }

  return {
    materialCost,
    laborCost,
    energyCost,
    toolDepreciation,
    encounterCost,
    total: materialCost + laborCost + energyCost + toolDepreciation + encounterCost,
  };
}

/**
 * Calculate the Total Reward of a task's outputs.
 */
export function calculateTotalReward(task, items, globals) {
  let outputReward = 0;
  const lootTables = globals.lootTables || {};

  const outputs = task.outputs || task.drops || [];

  for (const output of outputs) {
    const chance = (output.dropChance ?? output.chance ?? 100) / 100;
    const minQty = output.minQty ?? output.quantity ?? 1;
    const maxQty = output.maxQty ?? output.quantity ?? 1;
    const avgQty = (minQty + maxQty) / 2;

    if (output.type === 'lootTable' || output.isLootTable) {
      const table = lootTables[output.id];
      if (!table || !table.entries || table.entries.length === 0) continue;
      
      const totalWeight = table.entries.reduce((sum, e) => sum + (e.dropWeight || 0), 0);
      if (totalWeight <= 0) continue;

      let tableEY = 0;
      for (const entry of table.entries) {
        const item = items[entry.itemId];
        if (!item) continue;
        const entryChance = (entry.dropWeight || 0) / totalWeight;
        const itemValue = item.trueCost || 0;
        tableEY += itemValue * entryChance;
      }
      outputReward += tableEY * chance * avgQty;
    } else if (output.type !== 'encounter') {
      const item = items[output.id];
      if (!item) continue;
      const value = item.trueCost || 0;
      outputReward += value * chance * avgQty;
    }
  }

  // Calculate Encounter Pool Reward
  const encounterOutputs = outputs.filter(o => o.type === 'encounter');
  
  if (globals.enemyUpdates) {
    for (const enc of encounterOutputs) {
      const triggerChance = (enc.chance ?? 100) / 100;
      if (triggerChance <= 0) continue;
      
      const enemies = enc.enemies || [];
      const totalEnemyWeight = enemies.reduce((sum, en) => sum + (en.weight ?? 100), 0);
      
      if (totalEnemyWeight > 0) {
        for (const en of enemies) {
          const weight = en.weight ?? 100;
          const enemyChance = (weight / totalEnemyWeight) * triggerChance;
          
          const enemyStats = globals.enemyUpdates[en.enemyId];
          if (enemyStats && enemyStats.combatReward && enemyStats.combatReward.total) {
            outputReward += enemyStats.combatReward.total * enemyChance;
          }
        }
      }
    }
  }

  const xpReward = (task.xpAwarded || 0) * (globals.xpToGoldRatio || 0.1);

  return {
    outputReward,
    xpReward,
    total: outputReward + xpReward,
  };
}

/**
 * Calculate the full EV for a task.
 */
export function calculateTaskEV(task, items, globals) {
  const cost = calculateTotalCost(task, items, globals);
  const reward = calculateTotalReward(task, items, globals);

  const ev = cost.total > 0 ? reward.total / cost.total : 0;
  const ticksPerMinute = 60000 / (task.baseTickTime || 10000);
  const goldPerMinute = reward.outputReward * ticksPerMinute;
  const xpPerMinute = (task.xpAwarded || 0) * ticksPerMinute;

  return {
    cost,
    reward,
    calculatedEV: Math.round(ev * 1000) / 1000,
    goldPerMinute: Math.round(goldPerMinute * 100) / 100,
    xpPerMinute: Math.round(xpPerMinute * 100) / 100,
  };
}

/**
 * Calculate the full EV for an Encounter.
 */
export function calculateEncounterEV(encounter, enemyUpdates) {
  let totalReward = 0;
  let totalCost = 0;
  let xpPerMinute = 0;
  let goldPerMinute = 0;

  for (const { enemyId, spawnChance } of (encounter.assignedEnemies || [])) {
    const enemyData = enemyUpdates[enemyId];
    if (!enemyData) continue;
    const chance = spawnChance || 0;
    
    totalReward += (enemyData.combatReward?.total || 0) * chance;
    totalCost += (enemyData.combatCost?.total || 0) * chance;
    goldPerMinute += (enemyData.goldPerMinute || 0) * chance;
    xpPerMinute += (enemyData.xpPerMinute || 0) * chance;
  }

  const ev = totalCost > 0 ? totalReward / totalCost : 0;

  return {
    calculatedEV: Math.round(ev * 1000) / 1000,
    goldPerMinute: Math.round(goldPerMinute * 100) / 100,
    xpPerMinute: Math.round(xpPerMinute * 100) / 100,
    totalCost,
    totalReward,
  };
}

// ===== Helpers =====

function sumInputCosts(inputs, items) {
  let total = 0;
  for (const input of (inputs || [])) {
    const item = items[input.id];
    if (!item) continue;
    total += (item.trueCost || 0) * (input.quantity || 1);
  }
  return total;
}

function calcLaborCost(baseTickTime, skillRequirement, globals) {
  const ticks = (baseTickTime || 10000) / 10000; 
  const skillMultiplier = 1 + (skillRequirement || 1) * (globals.skillMultiplierRate || 0.002);
  return ticks * globals.gpt * skillMultiplier;
}

