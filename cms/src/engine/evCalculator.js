/**
 * EV Calculator — Implements §4.1a-c of the CMS Design Document.
 *
 * Calculates the Total Cost, Total Reward, and EV for a single task cycle.
 */

function findMatchingTool(acceptedToolType, minToolTier, items) {
  if (!acceptedToolType) return null;
  const targetType = acceptedToolType.toLowerCase();
  
  // Find all tools that match the acceptedToolType
  const matchingTools = Object.values(items).filter(item => {
    const isTool = item.type?.toLowerCase() === 'tool' || 
                   item.tags?.some(t => t.toLowerCase() === 'tool');
    if (!isTool) return false;
    
    // Check if tool name or tags match the target tool type
    const matchesName = item.name?.toLowerCase().includes(targetType);
    const matchesTags = item.tags?.some(t => t.toLowerCase() === targetType);
    return matchesName || matchesTags;
  });
  
  if (matchingTools.length === 0) return null;
  
  // Find the tool with the lowest tier that is >= minToolTier
  const minTier = minToolTier || 0;
  const eligibleTools = matchingTools.filter(t => (t.tier ?? 0) >= minTier);
  
  if (eligibleTools.length > 0) {
    // Sort by tier ascending to get the lowest eligible tier tool
    eligibleTools.sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));
    return eligibleTools[0];
  }
  
  // If none are >= minTier, fallback to the highest tier available, or just the first matching one
  matchingTools.sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0));
  return matchingTools[0];
}

/**
 * Calculate the Total Cost of running a task once.
 */
export function calculateTotalCost(task, items, globals) {
  const materialCost = sumInputCosts(task.inputs, items);
  let laborCost = calcLaborCost(task.baseTickTime, task.skillRequirement, globals, materialCost);
  if (materialCost === 0) {
    const firstItemOutput = (task.outputs || task.drops || []).find(o => o.type === 'item' || !o.type);
    if (firstItemOutput) {
      const itemId = firstItemOutput.id || firstItemOutput.itemId;
      if (itemId && items[itemId]) {
        const scale = items[itemId].valueScale ?? 1.0;
        laborCost *= scale;
      }
    }
  }
  const energyCost = (task.energyCost || 0) * (globals.energyGpValue || 0.25);
  
  let toolDepreciation = 0;
  if (task.acceptedToolType) {
    const tool = findMatchingTool(task.acceptedToolType, task.minToolTier, items);
    const durabilityConsumed = task.durabilityCost ?? 1;
    
    if (tool) {
      const maxDurability = tool.durability ?? 0;
      if (maxDurability > 0) {
        const toolCost = tool.trueCost || 0;
        toolDepreciation = (toolCost / maxDurability) * durabilityConsumed;
      }
    } else {
      // Fallback: estimate tool cost/durability based on minToolTier
      const tier = task.minToolTier || 0;
      const estimatedCost = (tier + 1) * 50;
      const estimatedDurability = (tier + 1) * 100;
      toolDepreciation = (estimatedCost / estimatedDurability) * durabilityConsumed;
    }
  }

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
      const table = lootTables[output.id || output.itemId];
      if (!table || !table.entries || table.entries.length === 0) continue;
      
      const totalWeight = table.entries.reduce((sum, e) => sum + (e.dropWeight || 0), 0);
      if (totalWeight <= 0) continue;

      let tableEY = 0;
      for (const entry of table.entries) {
        const item = items[entry.itemId || entry.id];
        if (!item) continue;
        const entryChance = (entry.dropWeight || 0) / totalWeight;
        const itemValue = item.trueCost || 0;
        tableEY += itemValue * entryChance;
      }
      outputReward += tableEY * chance * avgQty;
    } else if (output.type !== 'encounter') {
      const item = items[output.id || output.itemId];
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

  const taxedXp = calculateXpTax(task.xpAwarded || 0, globals);
  const xpReward = taxedXp * (globals.xpToGoldRatio || 0.1);

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

  const totalCost = cost.total;
  
  const liquidityEV = totalCost > 0 ? reward.outputReward / totalCost : 0;
  const progressionEV = totalCost > 0 ? reward.xpReward / totalCost : 0;
  const totalEV = totalCost > 0 ? (reward.outputReward + reward.xpReward) / totalCost : 0;

  const ticksPerMinute = 60000 / (task.baseTickTime || 10000);
  const grossGoldPerMinute = reward.outputReward * ticksPerMinute;
  const netGoldReward = reward.outputReward - cost.materialCost - cost.energyCost - cost.toolDepreciation - cost.encounterCost;
  const goldPerMinute = netGoldReward * ticksPerMinute;
  const xpPerMinute = (task.xpAwarded || 0) * ticksPerMinute;

  return {
    cost,
    reward,
    liquidityEV: Math.round(liquidityEV * 1000) / 1000,
    progressionEV: Math.round(progressionEV * 1000) / 1000,
    calculatedEV: Math.round(totalEV * 1000) / 1000, // Legacy support
    goldPerMinute: Math.round(goldPerMinute * 100) / 100, // Net GPM
    grossGoldPerMinute: Math.round(grossGoldPerMinute * 100) / 100,
    xpPerMinute: Math.round(xpPerMinute * 100) / 100,
  };
}

/**
 * Calculate the full EV for an Encounter.
 */
export function calculateEncounterEV(encounter, enemyUpdates) {
  let liquidityReward = 0;
  let progressionReward = 0;
  let totalCost = 0;
  let xpPerMinute = 0;
  let goldPerMinute = 0;

  for (const { enemyId, spawnChance } of (encounter.assignedEnemies || [])) {
    const enemyData = enemyUpdates[enemyId];
    if (!enemyData) continue;
    const chance = spawnChance || 0;
    
    liquidityReward += (enemyData.combatReward?.lootReward || 0) * chance;
    progressionReward += (enemyData.combatReward?.xpReward || 0) * chance;
    totalCost += (enemyData.combatCost?.total || 0) * chance;
    goldPerMinute += (enemyData.goldPerMinute || 0) * chance;
    xpPerMinute += (enemyData.xpPerMinute || 0) * chance;
  }

  const totalReward = liquidityReward + progressionReward;
  const liquidityEV = totalCost > 0 ? liquidityReward / totalCost : 0;
  const progressionEV = totalCost > 0 ? progressionReward / totalCost : 0;
  const totalEV = totalCost > 0 ? totalReward / totalCost : 0;

  return {
    liquidityEV: Math.round(liquidityEV * 1000) / 1000,
    progressionEV: Math.round(progressionEV * 1000) / 1000,
    calculatedEV: Math.round(totalEV * 1000) / 1000,
    goldPerMinute: Math.round(goldPerMinute * 100) / 100,
    xpPerMinute: Math.round(xpPerMinute * 100) / 100,
    totalCost,
    totalReward,
  };
}

/**
 * Calculates XP after applying the progressive tax bracket logic.
 * Flattening exceptionally large XP drops.
 */
export function calculateXpTax(baseXp, globals) {
  const bracketSize = globals.xpTaxBracketSize || 10;
  const decayRate = globals.xpTaxDecayRate || 0.1;

  let remainingXp = baseXp;
  let totalXp = 0;
  let bracketIndex = 0;

  while (remainingXp > 0) {
    const currentBracketMultiplier = Math.max(0.1, 1 - (bracketIndex * decayRate));
    const amountInBracket = Math.min(remainingXp, bracketSize);

    totalXp += amountInBracket * currentBracketMultiplier;
    remainingXp -= amountInBracket;
    bracketIndex++;

    // Safety break
    if (bracketIndex > 1000) {
      totalXp += remainingXp * 0.1;
      break;
    }
  }

  return totalXp;
}

// ===== Helpers =====

function sumInputCosts(inputs, items) {
  let total = 0;
  for (const input of (inputs || [])) {
    if (input.tag) {
      const targetTag = input.tag.toLowerCase();
      const matchingItems = Object.values(items).filter(item => {
        const itemTags = (item.tags || []).map(t => t.toLowerCase());
        const itemType = (item.type || '').toLowerCase();
        return itemTags.includes(targetTag) || itemType === targetTag;
      });
      if (matchingItems.length > 0) {
        const minCost = Math.min(...matchingItems.map(item => item.trueCost || 0));
        total += minCost * (input.quantity || 1);
      }
    } else {
      const itemId = input.id || input.itemId;
      const item = items[itemId];
      if (!item) continue;
      total += (item.trueCost || 0) * (input.quantity || 1);
    }
  }
  return total;
}

function calcLaborCost(baseTickTime, skillRequirement, globals, materialCost = 0) {
  if (materialCost > 0) {
    const rate = globals.laborRatePerLevel !== undefined ? globals.laborRatePerLevel : 0.002;
    return materialCost * rate * (skillRequirement || 1);
  }
  // Gathering Task: Heuristic A Value-First Progression Curve
  const level = skillRequirement || 1;
  const rawBase = globals.rawCommodityBaseValue !== undefined ? globals.rawCommodityBaseValue : 1.0;
  const rawRate = globals.rawCommodityScalingRate !== undefined ? globals.rawCommodityScalingRate : 0.05;
  return rawBase * Math.pow(1 + rawRate, level - 1);
}

