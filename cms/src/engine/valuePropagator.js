import { calculateCombatEV } from './mockBattle';

/**
 * Value Propagation Engine — Implements §4.1d + §4.2 + §4.4
 *
 * Walks the dependency graph from Root Items outward, calculating:
 * 1. trueCost for each downstream item (via Primary Source tasks/recipes)
 * 2. sellPrice = trueCost × valueProfile.sellValue × (1 + type-derived modifier)
 * 3. stats (HP/Energy) = (trueCost × valueProfile.stat) / globalAnchor
 */

export function propagateValues(entities, globals) {
  const items = { ...entities.items };
  // Propagate trueCost downstream from Recipes (Refined Items), Gathering Tasks (Raw Items), and Enemies (Monster Drops).
  const sources = {
    ...entities.recipes,
    ...entities.tasks
  };

  for (const [id, enemy] of Object.entries(entities.enemies || {})) {
    sources[`enemy_${id}`] = {
      id: enemy.id,
      isEnemy: true,
      inputs: [],
      outputs: (enemy.drops || []).map(d => ({
        id: d.itemId,
        itemId: d.itemId,
        dropChance: d.dropChance ?? d.chance ?? 100,
        minQty: d.minQty ?? 1,
        maxQty: d.maxQty ?? 1,
        isPrimarySource: d.isPrimarySource
      }))
    };
  }

  // Precompute fallback primary sources for items that have no primary source designated
  // Map of itemId -> sourceId (the designated or fallback source that should propagate to this item)
  const itemPrimarySource = {};
  const itemProducers = {}; // itemId -> array of { sourceId, isPrimary }
  const producedItemIds = new Set();

  for (const source of Object.values(sources)) {
    for (const output of (source.outputs || [])) {
      const itemId = output.id || output.itemId;
      if (itemId && (output.type === 'item' || !output.type)) {
        producedItemIds.add(itemId);
        if (!itemProducers[itemId]) itemProducers[itemId] = [];
        itemProducers[itemId].push({
          sourceId: source.id,
          isPrimary: !!(output.isPrimarySource || output.isPrimaryOutput)
        });
      }
    }
  }

  // Determine the primary source for each item
  for (const [itemId, producers] of Object.entries(itemProducers)) {
    const designated = producers.find(p => p.isPrimary);
    if (designated) {
      itemPrimarySource[itemId] = designated.sourceId;
    } else if (producers.length > 0) {
      // Fallback: use the first producer
      itemPrimarySource[itemId] = producers[0].sourceId;
    }
  }

  // Deep-clone items so we can mutate trueCost / sellPrice
  const valuedItems = {};
  for (const [id, item] of Object.entries(items)) {
    valuedItems[id] = { ...item };
  }

  // Track which items have been valued
  const valued = new Set();

  // Seed: all Items with existing trueCost or marked as true Root to start (skipping produced ones so the engine recalculates them)
  for (const [id, item] of Object.entries(valuedItems)) {
    const isProduced = producedItemIds.has(id);
    if (item.isRoot || ((item.trueCost > 0 || item.isRoot) && !isProduced)) {
      valued.add(id);
      updateDerivedStats(valuedItems[id], globals);
    }
  }

  // Iterative propagation — keep going until no new items are valued
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    for (const source of Object.values(sources)) {
      // Check if all inputs are valued
      const allInputsValued = (source.inputs || []).every(
        (inp) => {
          const tid = inp.id || inp.itemId;
          return !tid || valued.has(tid);
        }
      );

      if (!allInputsValued) continue;

      // Calculate unique inputs count and complexity markup rate
      const uniqueInputsCount = Array.isArray(source.inputs) ? new Set(source.inputs.map(inp => inp.id || inp.itemId).filter(Boolean)).size : 0;
      const isRecipe = entities.recipes?.[source.id] !== undefined;

      // Calculate this source's total cost using currently valued items
      const materialCost = sumInputCosts(source.inputs, valuedItems);
      
      let laborCost;
      if (source.isEnemy) {
        const combatDiag = calculateCombatEV(entities.enemies[source.id], valuedItems, globals);
        laborCost = combatDiag.cost.total;
      } else if (!isRecipe && uniqueInputsCount === 0) {
        // Gathering Task: Heuristic A Value-First Progression Curve
        const level = source.skillRequirement || 1;
        const rawBase = globals.rawCommodityBaseValue !== undefined ? globals.rawCommodityBaseValue : 1.0;
        const rawRate = globals.rawCommodityScalingRate !== undefined ? globals.rawCommodityScalingRate : 0.05;
        let scale = 1.0;
        const firstItemOutput = (source.outputs || []).find(o => o.type === 'item' || !o.type);
        if (firstItemOutput) {
          const itemId = firstItemOutput.id || firstItemOutput.itemId;
          if (itemId && valuedItems[itemId]) {
            scale = valuedItems[itemId].valueScale ?? 1.0;
          }
        }
        laborCost = rawBase * Math.pow(1 + rawRate, level - 1) * scale;
      } else {
        // Recipe/Crafting Task: Traditional Material-Based Labor Cost
        laborCost = calcLaborCost(source.baseTickTime, source.skillRequirement || 1, globals, materialCost);
      }

      const energyCost = (source.energyCost || 0) * (globals.energyGpValue || 0.25);

      // Calculate tool depreciation
      let toolDepreciation = 0;
      if (source.acceptedToolType) {
        const tool = findMatchingTool(source.acceptedToolType, source.minToolTier, valuedItems);
        const durabilityConsumed = source.durabilityCost ?? 1;
        if (tool) {
          const maxDurability = tool.durability ?? 0;
          if (maxDurability > 0) {
            const toolCost = tool.trueCost || 0;
            toolDepreciation = (toolCost / maxDurability) * durabilityConsumed;
          }
        } else {
          const tier = source.minToolTier || 0;
          const estimatedCost = (tier + 1) * 50;
          const estimatedDurability = (tier + 1) * 100;
          toolDepreciation = (estimatedCost / estimatedDurability) * durabilityConsumed;
        }
      }

      // Calculate complexity markup rate (recipes only)
      const profitMarkupPerUniqueInput = globals.profitMarkupPerUniqueInput !== undefined ? globals.profitMarkupPerUniqueInput : 0.02;
      const markupRate = uniqueInputsCount * profitMarkupPerUniqueInput;

      // For each eligible output, we distribute the intended item reward.
      const outputs = source.outputs || [];
      const eligibleOutputs = outputs.filter(o => {
        const isItemType = o.type === 'item' || !o.type;
        if (!isItemType) return false;
        const itemId = o.id || o.itemId;
        return itemPrimarySource[itemId] === source.id;
      });

      if (eligibleOutputs.length === 0) continue;

      // The output value is calculated with a material-only markup, plus labor, energy, and tool depreciation
      let targetItemReward;
      if (source.isEnemy) {
        const combatDiag = calculateCombatEV(entities.enemies[source.id], valuedItems, globals);
        const totalCost = combatDiag.cost.total;
        const xpReward = combatDiag.reward.xpReward;
        targetItemReward = Math.max(0, totalCost - xpReward);
      } else {
        targetItemReward = (materialCost * (1 + markupRate)) + laborCost + energyCost + toolDepreciation;
      }
      // We distribute the target reward evenly among the eligible outputs
      const rewardPerOutput = targetItemReward / eligibleOutputs.length;

      for (const output of eligibleOutputs) {
        const itemId = output.id || output.itemId;
        if (!itemId) continue;

        const item = valuedItems[itemId];
        if (item && item.isRoot) {
          // Skip recalculation only for true root items
          if (!valued.has(itemId)) {
            updateDerivedStats(valuedItems[itemId], globals);
            valued.add(itemId);
            changed = true;
          }
          continue;
        }

        const chance = (output.dropChance ?? 100) / 100;
        const minQty = output.minQty ?? output.quantity ?? 1;
        const maxQty = output.maxQty ?? output.quantity ?? 1;
        const expectedYield = chance * ((minQty + maxQty) / 2);

        // If expected yield is 0, we can't derive a cost
        if (expectedYield <= 0) continue;

        // Calculate new true cost (rounded to nearest whole integer for Option A)
        let newTrueCost = Math.round(rewardPerOutput / expectedYield);

        // Add effect value if applicable
        if (item && item.assignedEffect) {
          const effData = typeof item.assignedEffect === 'string' ? { effectId: item.assignedEffect, scale: 1 } : item.assignedEffect;
          if (effData.effectId && entities.effects?.[effData.effectId]) {
            const eff = entities.effects[effData.effectId];
            const scale = effData.scale || 1;
            newTrueCost += (eff.estimatedGpValue || 0) * scale;
          }
        }

        newTrueCost = Math.round(newTrueCost);

        if (item && (item.trueCost !== newTrueCost || !valued.has(itemId))) {
          valuedItems[itemId].trueCost = newTrueCost;
          updateDerivedStats(valuedItems[itemId], globals);
          valued.add(itemId);
          changed = true;
        }
      }
    }
  }

  return {
    items: valuedItems,
    valuedCount: valued.size,
    totalItems: Object.keys(valuedItems).length,
    iterations,
  };
}

// ===== Helpers =====

function updateDerivedStats(item, globals) {
  const profile = item.valueProfile || { sellValue: 1 };
  const modifier = globals.sellModifiers?.[item.type] ?? 0;
  const tags = (item.tags || []).map(t => t.toLowerCase());
  const type = (item.type || '').toLowerCase();

  // 1. Sell Price (Base for all utility calculations, unified to match True Cost/Value)
  item.sellPrice = Math.round(item.trueCost || 0);

  // 2. Automated Restoration Amounts (Rule: Food = HP, Drink = Energy)
  const isFood = tags.includes('food');
  const isDrink = tags.includes('drink');
  const markup = globals.restorationMarkup || 0.2;

  if (isFood) {
    const anchor = globals.healthGpValue || 0.5;
    item.restoreType = 'HP';
    item.restoreAmount = Math.round((item.sellPrice * markup) / anchor);
  } else if (isDrink) {
    const anchor = globals.energyGpValue || 0.25;
    item.restoreType = 'Energy';
    item.restoreAmount = Math.round((item.sellPrice * markup) / anchor);
  } else {
    item.restoreType = 'None';
    item.restoreAmount = 0;
  }

  // 3. Automated Durability Assignment (Rule: Tools, Weapons, and Armor receive global durability setting)
  const isWeapon = type === 'weapon' || tags.includes('weapon');
  const isArmor = type === 'armor' || tags.includes('armor');
  const isTool = type === 'tool' || tags.includes('tool');
  const needsDurability = isWeapon || isArmor || isTool;

  if (needsDurability) {
    const globalDur = globals.defaultItemDurability !== undefined ? globals.defaultItemDurability : 100;
    item.durability = globalDur;
    item.maxDurability = globalDur;
  } else {
    item.durability = undefined;
    item.maxDurability = undefined;
  }

  // 4. Dynamic Gating & Requirements (Selective)
  // Consumables (Food, Drink, and anything tagged as such) must never carry requirements
  const isConsumable = tags.includes('food') || tags.includes('drink') || tags.includes('consumable') || type === 'food' || type === 'drink' || type === 'consumable' || type === 'special' || item.equipSlot === 'food' || item.equipSlot === 'drink' || item.equipSlot === 'special';
  
  if (isConsumable) {
    item.requirements = undefined;
    item.skillRequired = undefined;
    item.levelRequired = undefined;
    item.levelRequirement = undefined;
  } else {
    // Initialize or load requirements array
    let reqs = Array.isArray(item.requirements) ? [...item.requirements] : [];
    
    // Legacy migration: if skillRequired exists but isn't in reqs, add it
    if (item.skillRequired && item.skillRequired !== 'none') {
      const exists = reqs.some(r => r.skill === item.skillRequired);
      if (!exists) {
        reqs.push({ skill: item.skillRequired });
      }
    }
    
    // Default Weapons/Armor to combat if they have no requirements
    if (reqs.length === 0 && (isWeapon || isArmor)) {
      reqs.push({ skill: 'combat' });
    }
    
    // Filter out any "none" or empty skills, keeping only valid ones
    reqs = reqs.filter(r => r.skill && r.skill !== 'none');
    
    if (reqs.length > 0) {
      const baseValue = globals.levelReqBaseValue !== undefined ? globals.levelReqBaseValue : 100;
      const rate = globals.skillMultiplierRate !== undefined ? globals.skillMultiplierRate : 0.035;
      const trueCost = item.trueCost || 0;
      
      let calculatedLevel = 1;
      if (trueCost > baseValue) {
        calculatedLevel = Math.max(1, Math.min(99, Math.round(Math.log(trueCost / baseValue) / Math.log(1 + rate))));
      }
      
      // Calculate and assign the level for each requirement dynamically!
      item.requirements = reqs.map(r => ({
        skill: r.skill,
        level: calculatedLevel
      }));
      
      // Synchronize back to legacy flat fields for backwards compatibility!
      item.skillRequired = item.requirements[0].skill;
      item.levelRequired = calculatedLevel;
      item.levelRequirement = calculatedLevel;
    } else {
      item.requirements = undefined;
      item.skillRequired = undefined;
      item.levelRequired = undefined;
      item.levelRequirement = undefined;
    }
  }
}

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
  const ticks = (baseTickTime || 10000) / 10000;
  const rate = globals.skillMultiplierRate !== undefined ? globals.skillMultiplierRate : 0.035;
  const isExponential = globals.laborScalingType === 'exponential';
  const skillMultiplier = isExponential
    ? Math.pow(1 + rate, skillRequirement || 1)
    : 1 + (skillRequirement || 1) * rate;
  return ticks * globals.gpt * skillMultiplier;
}

function findMatchingTool(acceptedToolType, minToolTier, items) {
  if (!acceptedToolType) return null;
  const targetType = acceptedToolType.toLowerCase();
  
  const matchingTools = Object.values(items).filter(item => {
    const isTool = item.type?.toLowerCase() === 'tool' || 
                   item.tags?.some(t => t.toLowerCase() === 'tool');
    if (!isTool) return false;
    
    const matchesName = item.name?.toLowerCase().includes(targetType);
    const matchesTags = item.tags?.some(t => t.toLowerCase() === targetType);
    return matchesName || matchesTags;
  });
  
  if (matchingTools.length === 0) return null;
  
  const minTier = minToolTier || 0;
  const eligibleTools = matchingTools.filter(t => (t.tier ?? 0) >= minTier);
  
  if (eligibleTools.length > 0) {
    eligibleTools.sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));
    return eligibleTools[0];
  }
  
  matchingTools.sort((a, b) => (b.tier ?? 0) - (a.tier ?? 0));
  return matchingTools[0];
}

function getTargetGPH(level, globals) {
  const gphTargets = globals?.gphTargets || {
    1: 1200,
    11: 1400,
    41: 10000,
    71: 176000,
  };
  const gBrackets = Object.keys(gphTargets).map(Number).sort((a, b) => b - a);
  const gBracket = gBrackets.find(k => level >= k) || 1;
  return gphTargets[gBracket] || 1200;
}
