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
  // We only propagate trueCost downstream from Recipes (Refined Items).
  // Tasks and Enemies have fixed drops (Anchors), and the solver will balance their XP/Chances around those anchors.
  const sources = {
    ...entities.recipes
  };

  // Deep-clone items so we can mutate trueCost / sellPrice
  const valuedItems = {};
  for (const [id, item] of Object.entries(items)) {
    valuedItems[id] = { ...item };
  }

  // Track which items have been valued
  const valued = new Set();

  // Seed: all Items with existing trueCost to start (calculated costs will overwrite if crafted)
  for (const [id, item] of Object.entries(valuedItems)) {
    if (item.trueCost > 0) {
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

      // Calculate this source's total cost using currently valued items
      const materialCost = sumInputCosts(source.inputs, valuedItems);
      const laborCost = calcLaborCost(source.baseTickTime, source.skillRequirement || source.levelRequirement, globals);
      const energyCost = (source.energyCost || 0) * (globals.energyGpValue || 0.25);
      const totalCost = materialCost + laborCost + energyCost;

      // For each eligible output, we distribute the intended item reward.
      const outputs = source.outputs || [];
      const eligibleOutputs = outputs.filter(o => (o.type === 'item' || !o.type));

      if (eligibleOutputs.length === 0) continue;

      const targetEV = source.targetEV || globals.defaultTargetEV || 1.05;
      const profitSplitItem = source.profitSplit?.item ?? 0.8;
      // The total monetary value this recipe needs to output
      const targetItemReward = totalCost * targetEV * profitSplitItem;
      // We distribute the target reward evenly among the eligible outputs
      const rewardPerOutput = targetItemReward / eligibleOutputs.length;

      for (const output of eligibleOutputs) {
        const itemId = output.id || output.itemId;
        if (!itemId) continue;

        const chance = (output.dropChance ?? 100) / 100;
        const minQty = output.minQty ?? output.quantity ?? 1;
        const maxQty = output.maxQty ?? output.quantity ?? 1;
        const expectedYield = chance * ((minQty + maxQty) / 2);

        // If expected yield is 0, we can't derive a cost
        if (expectedYield <= 0) continue;

        // Calculate new true cost
        let newTrueCost = Math.round((rewardPerOutput / expectedYield) * 100) / 100;
        const item = valuedItems[itemId];

        // Add effect value if applicable
        if (item && item.assignedEffect) {
          const effData = typeof item.assignedEffect === 'string' ? { effectId: item.assignedEffect, scale: 1 } : item.assignedEffect;
          if (effData.effectId && entities.effects?.[effData.effectId]) {
            const eff = entities.effects[effData.effectId];
            const scale = effData.scale || 1;
            newTrueCost += (eff.estimatedGpValue || 0) * scale;
          }
        }

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

  // 1. Sell Price (Base for all utility calculations)
  item.sellPrice = Math.round((item.trueCost || 0) * (profile.sellValue ?? 1) * (1 + modifier));

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
}

function sumInputCosts(inputs, items) {
  let total = 0;
  for (const input of (inputs || [])) {
    const itemId = input.id || input.itemId;
    const item = items[itemId];
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
