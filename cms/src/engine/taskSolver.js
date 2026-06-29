import { EV_CURVE, EV_VARIANCE, DEFAULT_GLOBALS } from '../utils/constants';
import { calculateTotalCost, calculateTotalReward } from './evCalculator';
import { calculateCombatEV } from './mockBattle';

/**
 * Calculates the target EV for a given level by interpolating the EV_CURVE.
 */
export const calculateTargetEV = (level) => {
  const levels = Object.keys(EV_CURVE).map(Number).sort((a, b) => a - b);

  if (level <= levels[0]) return EV_CURVE[levels[0]];
  if (level >= levels[levels.length - 1]) return EV_CURVE[levels[levels.length - 1]];

  for (let i = 0; i < levels.length - 1; i++) {
    const l1 = levels[i];
    const l2 = levels[i + 1];
    if (level >= l1 && level <= l2) {
      const v1 = EV_CURVE[l1];
      const v2 = EV_CURVE[l2];
      const t = (level - l1) / (l2 - l1);
      return v1 + t * (v2 - v1);
    }
  }
  return 1.05;
};

/**
 * Calculates the allowed variance for a given level.
 */
export const calculateEVVariance = (level) => {
  const levels = Object.keys(EV_VARIANCE).map(Number).sort((a, b) => a - b);
  if (level <= levels[0]) return EV_VARIANCE[levels[0]];
  if (level >= levels[levels.length - 1]) return EV_VARIANCE[levels[levels.length - 1]];

  for (let i = 0; i < levels.length - 1; i++) {
    const l1 = levels[i];
    const l2 = levels[i + 1];
    if (level >= l1 && level <= l2) return EV_VARIANCE[l1];
  }
  return 0.02;
};

/**
 * Gets the XP threshold needed for a specific level.
 */
function getXPNeededForLevel(level, globals) {
  const base = globals.xpThresholdBase || DEFAULT_GLOBALS.xpThresholdBase || 100;
  const mult = globals.xpThresholdMultiplier || DEFAULT_GLOBALS.xpThresholdMultiplier || 1.15;
  return Math.floor(base * Math.pow(mult, level - 1));
}

/**
 * Gets the target Time to Level (TTL) in minutes.
 */
function getTargetTTL(level, globals) {
  const targets = globals.ttlTargets || DEFAULT_GLOBALS.ttlTargets || {};
  const brackets = Object.keys(targets).map(Number).sort((a, b) => b - a);
  const bracket = brackets.find(k => level >= k) || 1;
  return targets[bracket] || 10;
}

function interpolateTarget(level, targets) {
  const brackets = Object.keys(targets).map(Number).sort((a, b) => a - b);
  if (brackets.length === 0) return 0;
  if (level <= brackets[0]) return targets[brackets[0]];
  if (level >= brackets[brackets.length - 1]) return targets[brackets[brackets.length - 1]];

  for (let i = 0; i < brackets.length - 1; i++) {
    const l1 = brackets[i];
    const l2 = brackets[i + 1];
    if (level >= l1 && level <= l2) {
      const v1 = targets[l1];
      const v2 = targets[l2];
      const t = (level - l1) / (l2 - l1);
      return v1 + t * (v2 - v1);
    }
  }
  return targets[brackets[0]];
}

/**
 * Gets the velocity targets for level.
 */
export function getVelocityTargets(level, globals) {
  const gphTargets = globals?.gphTargets || DEFAULT_GLOBALS.gphTargets || {};
  const xphTargets = globals?.xphTargets || DEFAULT_GLOBALS.xphTargets || {};

  const targetGPH = interpolateTarget(level, gphTargets);
  const targetXPH = interpolateTarget(level, xphTargets);

  return {
    gph: targetGPH,
    xph: targetXPH,
    gpm: targetGPH / 60,
    xpm: targetXPH / 60,
  };
}

function snapDropChance(calculatedChance, targetEV, variance, getResultingEV) {
  if (calculatedChance <= 0) return 0;
  if (calculatedChance >= 100) return 100;

  const c10 = Math.max(0, Math.min(100, Math.round(calculatedChance / 10) * 10));
  const c5 = Math.max(0, Math.min(100, Math.round(calculatedChance / 5) * 5));
  const c1 = Math.max(0, Math.min(100, Math.round(calculatedChance)));

  if (Math.abs(getResultingEV(c10) - targetEV) <= variance) return c10;
  if (Math.abs(getResultingEV(c5) - targetEV) <= variance) return c5;
  if (Math.abs(getResultingEV(c1) - targetEV) <= variance) return c1;

  if (calculatedChance >= 1.0) {
    return Math.max(1, c1);
  }
  return Math.max(0, Math.round(calculatedChance * 100) / 100);
}

/**
 * Core solver for a single entity (Task, Recipe, or Enemy).
 * Implements the deterministic pure calculator balancing engine.
 */
export const solveEntityBalance = (entity, items, globals) => {
  if (entity.isLocked || !entity.autoBalance) return null;

  const isEnemy = entity.combatStat !== undefined || entity.combatType !== undefined;
  const patch = {};

  const inputs = entity.inputs || [];
  const outputs = entity.outputs || entity.drops || [];
  const inputCount = inputs.length;
  const outputCount = outputs.length;

  const rewardData = calculateTotalReward(entity, items, globals);
  const costData = calculateTotalCost(entity, items, globals);
  const netGoldReward = rewardData.outputReward - costData.materialCost - costData.energyCost - costData.toolDepreciation - costData.encounterCost;

  // 1. Pacing & Yield Tuning (All Non-Combat Tasks & Recipes)
  if (!isEnemy) {
    let gphMult = 1.0;
    if (inputCount === 0 && outputCount > 0) {
      gphMult = 1.0; // Gathering
    } else if (inputCount > 0 && outputCount > 0) {
      gphMult = 1.0; // Refining
    } else if (inputCount > 0 && outputCount === 0) {
      gphMult = 0.0; // Training
    }

    const level = entity.skillRequirement || 1;
    const velocityTargets = getVelocityTargets(level, globals);
    const targetGPH = velocityTargets.gph * gphMult;
    const autoBalancedOutputs = outputs.filter(o => o.autoBalanceChance);

    let chanceBalancedSuccess = false;

    if (autoBalancedOutputs.length > 0 && targetGPH > 0) {
      // Prioritize Chance Balancing: Tune output drop chances to hit target GPH
      const currentTickTime = entity.baseTickTime || 10000;
      const netGoldReward_target = (targetGPH * currentTickTime) / 3600000;
      const requiredTotalReward = netGoldReward_target + costData.materialCost + costData.energyCost + costData.toolDepreciation + costData.encounterCost;

      // Sum up reward contributions of all non-balanced outputs
      let nonBalancedReward = 0;
      const lootTables = globals.lootTables || {};

      outputs.forEach(o => {
        if (o.autoBalanceChance) return;
        const chance = (o.dropChance ?? o.chance ?? 100) / 100;
        const minQty = o.minQty ?? o.quantity ?? 1;
        const maxQty = o.maxQty ?? o.quantity ?? 1;
        const avgQty = (minQty + maxQty) / 2;

        if (o.type === 'lootTable' || o.isLootTable) {
          const table = lootTables[o.id || o.itemId];
          if (table && table.entries) {
            const totalWeight = table.entries.reduce((sum, entry) => sum + (entry.dropWeight || 0), 0);
            if (totalWeight > 0) {
              let tableEY = 0;
              table.entries.forEach(entry => {
                const item = items[entry.itemId || entry.id];
                if (item) {
                  const entryChance = (entry.dropWeight || 0) / totalWeight;
                  tableEY += (item.trueCost || 0) * entryChance;
                }
              });
              nonBalancedReward += tableEY * chance * avgQty;
            }
          }
        } else if (o.type !== 'encounter') {
          const item = items[o.id || o.itemId];
          if (item) {
            nonBalancedReward += (item.trueCost || 0) * chance * avgQty;
          }
        }
      });

      const remainingRewardNeeded = requiredTotalReward - nonBalancedReward;
      const rewardPerBalancedOutput = remainingRewardNeeded / autoBalancedOutputs.length;

      let allChancesInBounds = true;

      const newOutputs = outputs.map(o => {
        if (!o.autoBalanceChance) return o;
        const item = items[o.id || o.itemId];
        const trueCost = item ? (item.trueCost || 0) : 0;
        const minQty = o.minQty ?? o.quantity ?? 1;
        const maxQty = o.maxQty ?? o.quantity ?? 1;
        const avgQty = (minQty + maxQty) / 2;

        if (trueCost > 0 && avgQty > 0) {
          const calculatedChance = (rewardPerBalancedOutput / (trueCost * avgQty)) * 100;
          if (calculatedChance < 0 || calculatedChance > 100) {
            allChancesInBounds = false;
          }
          const level = entity.skillRequirement || 1;
          const variance = calculateEVVariance(level);
          const targetEV = calculateTargetEV(level);
          const getResultingEV = (candChance) => {
            const newOutputs = outputs.map(out => {
              if (out.autoBalanceChance) {
                return { ...out, dropChance: candChance, chance: candChance };
              }
              return out;
            });
            const tempEntity = { ...entity, outputs: newOutputs };
            const tempReward = calculateTotalReward(tempEntity, items, globals);
            return tempReward.total / costData.total;
          };
          const clampedChance = snapDropChance(calculatedChance, targetEV, variance, getResultingEV);
          return {
            ...o,
            dropChance: clampedChance,
            chance: clampedChance
          };
        }
        return o;
      });

      const anyChanceChanged = newOutputs.some((o, idx) => {
        const orig = outputs[idx];
        return (o.dropChance !== orig.dropChance) || (o.chance !== orig.chance);
      });

      if (anyChanceChanged) {
        patch.outputs = newOutputs;
      }

      if (allChancesInBounds) {
        chanceBalancedSuccess = true;
      }
    }

    // If chance balancing was not active or hit a boundary (0% or 100%), perform Speed Balancing
    if (!chanceBalancedSuccess && targetGPH > 0) {
      // Re-evaluate reward metrics using any output changes from the patch
      const tempEntity = { ...entity, ...patch };
      const currentRewardData = calculateTotalReward(tempEntity, items, globals);
      const currentNetGoldReward = currentRewardData.outputReward - costData.materialCost - costData.energyCost - costData.toolDepreciation - costData.encounterCost;

      if (currentNetGoldReward > 0) {
        const currentTickTime = entity.baseTickTime || 10000;
        const currentGPH = (currentNetGoldReward * 3600000) / currentTickTime;
        const deviation = Math.abs(currentGPH - targetGPH) / targetGPH;

        if (deviation > 0.01) {
          let calculatedTimeMs = (3600000 * currentNetGoldReward) / targetGPH;
          calculatedTimeMs = Math.round(calculatedTimeMs / 500) * 500;

          const minTickTime = globals.minTickTime || 2000;
          const maxTickTime = globals.maxTickTime || 60000;
          const clampedTime = Math.max(minTickTime, Math.min(maxTickTime, calculatedTimeMs));

          if (clampedTime !== currentTickTime) {
            patch.baseTickTime = clampedTime;
          }
        }
      }
    }
  }

  // 2. XP Awarded Prescriber
  if (isEnemy) {
    // 1. Enemy Drop Chance Balancing
    const level = entity.skillRequirement || 1;
    const targetEV = calculateTargetEV(level);
    
    // Simulate current combat EV
    const combatEV = calculateCombatEV(entity, items, globals);
    const costTotal = combatEV.cost.total;
    const xpReward = combatEV.reward.xpReward;
    
    const autoBalancedDrops = outputs.filter(o => o.autoBalanceChance);
    
    if (autoBalancedDrops.length > 0 && costTotal > 0) {
      // Reward_target = targetEV * costTotal
      const targetReward = targetEV * costTotal;
      
      // Calculate loot value contribution of non-balanced drops
      let nonBalancedLootReward = 0;
      outputs.forEach(o => {
        if (o.autoBalanceChance) return;
        const rawChance = o.dropChance ?? o.chance ?? 100;
        const chance = rawChance > 1.0 ? rawChance / 100 : rawChance;
        const minQty = o.minQty ?? o.quantity ?? 1;
        const maxQty = o.maxQty ?? o.quantity ?? 1;
        const avgQty = (minQty + maxQty) / 2;
        const item = items[o.id || o.itemId];
        if (item) {
          nonBalancedLootReward += (item.trueCost || 0) * avgQty * chance;
        }
      });
      
      const targetLootReward = targetReward - xpReward;
      const remainingLootRewardNeeded = targetLootReward - nonBalancedLootReward;
      const rewardPerBalancedDrop = remainingLootRewardNeeded / autoBalancedDrops.length;
      
      const newOutputs = outputs.map(o => {
        if (!o.autoBalanceChance) return o;
        const item = items[o.id || o.itemId];
        const trueCost = item ? (item.trueCost || 0) : 0;
        const minQty = o.minQty ?? o.quantity ?? 1;
        const maxQty = o.maxQty ?? o.quantity ?? 1;
        const avgQty = (minQty + maxQty) / 2;
        
        if (trueCost > 0 && avgQty > 0) {
          const calculatedChance = (rewardPerBalancedDrop / (trueCost * avgQty)) * 100;
          const variance = calculateEVVariance(level);
          const getResultingEV = (candChance) => {
            const newDrops = outputs.map(out => {
              if (out.autoBalanceChance) {
                return { ...out, dropChance: candChance, chance: candChance };
              }
              return out;
            });
            const tempEntity = { ...entity, drops: newDrops };
            const tempCombat = calculateCombatEV(tempEntity, items, globals);
            return tempCombat.calculatedEV;
          };
          const clampedChance = snapDropChance(calculatedChance, targetEV, variance, getResultingEV);
          return {
            ...o,
            dropChance: clampedChance,
            chance: clampedChance
          };
        }
        return o;
      });
      
      const anyChanceChanged = newOutputs.some((o, idx) => {
        const orig = outputs[idx];
        return (o.dropChance !== orig.dropChance) || (o.chance !== orig.chance);
      });
      
      if (anyChanceChanged) {
        patch.drops = newOutputs;
        patch.outputs = newOutputs;
      }
    }

    if (!entity.fieldLocks?.xpAwarded) {
      const proposedXp = Math.round((entity.combatStat || 1) * (globals.combatXpMultiplier || 1.0));
      if (proposedXp !== (entity.xpAwarded || 0)) {
        patch.xpAwarded = proposedXp;
      }
    }
  } else {
    if (!entity.fieldLocks?.xpAwarded) {
      const level = entity.skillRequirement || 1;
      const velocityTargets = getVelocityTargets(level, globals);
      const targetXPH = velocityTargets.xph;
      
      const taskTimeMs = patch.baseTickTime !== undefined ? patch.baseTickTime : (entity.baseTickTime || 10000);
      
      let multiplier = 1.0;
      if (inputCount === 0 && outputCount > 0) {
        multiplier = 0.5; // Gathering
      } else if (inputCount > 0 && outputCount > 0) {
        multiplier = 1.0; // Refining/Crafting
      } else if (inputCount > 0 && outputCount === 0) {
        multiplier = 2.0; // Training
      }
      
      const targetXp = targetXPH * (taskTimeMs / 3600000) * multiplier;
      const proposedXp = Math.max(1, Math.round(targetXp));
      
      if (proposedXp !== (entity.xpAwarded || 0)) {
        patch.xpAwarded = proposedXp;
      }
    }
  }

  // 3. Final Safety Sweep: Filter out unchanged values
  const filteredPatch = {};
  for (const [key, val] of Object.entries(patch)) {
    if (Array.isArray(val)) {
      const currentVal = entity[key] || [];
      if (JSON.stringify(val) !== JSON.stringify(currentVal)) {
        filteredPatch[key] = val;
      }
    } else if (val !== entity[key]) {
      filteredPatch[key] = val;
    }
  }

  return Object.keys(filteredPatch).length > 0 ? filteredPatch : null;
};;
