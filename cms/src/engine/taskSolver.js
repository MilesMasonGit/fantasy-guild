import { EV_CURVE, EV_VARIANCE } from '../utils/constants';

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
 * Calculates XP after applying the progressive tax bracket logic.
 * Flattening exceptionally large XP drops.
 */
export const calculateXpTax = (baseXp, globals) => {
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
};

import { calculateTotalCost, calculateTotalReward } from './evCalculator';

/**
 * Core solver for a single entity (Task, Recipe, or Enemy).
 * Returns a patch of proposed changes.
 */
export const solveEntityBalance = (entity, items, globals) => {
  if (entity.isLocked || !entity.autoBalance) return null;

  const level = entity.levelRequirement || entity.skillRequirement || entity.tier * 20 || 1;
  const targetEV = entity.targetEV || calculateTargetEV(level);
  const variance = calculateEVVariance(level);

  const costData = calculateTotalCost(entity, items, globals);
  const totalCost = costData.total;
  const targetReward = totalCost * targetEV;
  
  const rewardData = calculateTotalReward(entity, items, globals);
  const currentReward = rewardData.total;

  const currentEV = totalCost > 0 ? currentReward / totalCost : 0;
  if (totalCost > 0 && Math.abs(currentEV - targetEV) <= variance) {
    if (entity.auditFlag) return { auditFlag: null };
    return null;
  }
  if (totalCost === 0 && Math.abs(currentReward - targetReward) <= 0.1) {
    if (entity.auditFlag) return { auditFlag: null };
    return null;
  }

  const patch = {};
  let deficit = targetReward - currentReward;
  const dampedDeficit = deficit * 0.2; // 20% step size

  let remainingDeficit = dampedDeficit;

  // 1. Auto-XP Phase
  const isEnemy = entity.combatStat !== undefined || entity.combatType !== undefined;
  if (!entity.fieldLocks?.xpAwarded && !isEnemy) {
    const split = entity.profitSplit || { item: 0.8, xp: 0.2 };
    
    // The amount of the target reward that we explicitly want to come from XP
    const targetXpReward = targetReward * split.xp;
    
    const xpToGold = globals.xpToGoldRatio || 0.1;
    let targetXp = targetXpReward / xpToGold;

    const xpFloor = level * 2;
    const xpCap = globals.xpTaxBracketSize ? globals.xpTaxBracketSize * 10 : 5000;

    if (targetXp < xpFloor) targetXp = xpFloor;
    if (targetXp > xpCap) targetXp = xpCap;

    const currentXp = entity.xpAwarded || 0;
    const currentXpReward = currentXp * xpToGold;
    const targetXpRewardClamped = targetXp * xpToGold;
    
    const xpDeficit = targetXpRewardClamped - currentXpReward;
    const dampedXpDelta = (targetXp - currentXp) * 0.2; // 20% damping
    
    if (Math.abs(dampedXpDelta) > 0.1) {
      patch.xpAwarded = Math.round(currentXp + dampedXpDelta);
      remainingDeficit -= (patch.xpAwarded - currentXp) * xpToGold;
    }
  }

  // 2. Drop Scaling Phase
  const outputsKey = entity.outputs ? 'outputs' : 'drops';
  const outputs = entity[outputsKey] || [];
  
  let unlockedEY = 0;
  const unlockedIndices = [];
  
  for (let i = 0; i < outputs.length; i++) {
    const o = outputs[i];
    if (o.isLocked || o.type === 'encounter') continue;
    
    const chance = (o.dropChance ?? o.chance ?? 100) / 100;
    const avgQty = ((o.minQty ?? o.quantity ?? 1) + (o.maxQty ?? o.quantity ?? 1)) / 2;
    
    let baseValue = 0;
    if (o.type === 'lootTable' || o.isLootTable) {
      const table = globals.lootTables?.[o.id];
      if (table && table.entries) {
        const totalWeight = table.entries.reduce((sum, e) => sum + (e.dropWeight || 0), 0);
        if (totalWeight > 0) {
          for (const e of table.entries) {
            const itemValue = items[e.itemId]?.trueCost || 0;
            baseValue += itemValue * (e.dropWeight / totalWeight);
          }
        }
      }
    } else {
      baseValue = items[o.id]?.trueCost || 0;
    }
    
    const ey = baseValue * chance * avgQty;
    unlockedEY += ey;
    unlockedIndices.push(i);
  }

  if (unlockedIndices.length > 0 && Math.abs(remainingDeficit) > 0.1) {
    const targetUnlockedEY = Math.max(0, unlockedEY + remainingDeficit);
    const scalingFactor = unlockedEY > 0 ? targetUnlockedEY / unlockedEY : 1;
    
    if (scalingFactor !== 1) {
      const newOutputs = [...outputs];
      let madeChanges = false;
      for (const idx of unlockedIndices) {
        const o = newOutputs[idx];
        const oldChance = o.dropChance ?? o.chance ?? 100;
        let newChance = oldChance * scalingFactor;
        
        if (newChance > 100) newChance = 100;
        if (newChance < 0) newChance = 0;
        
        if (Math.abs(newChance - oldChance) > 0.01) {
          newOutputs[idx] = { ...o, dropChance: Number(newChance.toFixed(2)) };
          madeChanges = true;
        }
      }
      if (madeChanges) {
        patch[outputsKey] = newOutputs;
      }
    }
  }

  // 3. Time Padding (Surplus only, all drops locked)
  if (unlockedIndices.length === 0 && remainingDeficit < -0.1) {
    const costDeficit = (currentReward / targetEV) - totalCost;
    if (costDeficit > 0) {
      const skillMultiplier = 1 + (entity.skillRequirement || 1) * (globals.skillMultiplierRate || 0.002);
      const laborCostPerTick = globals.gpt * skillMultiplier;
      const addedTicks = costDeficit / laborCostPerTick;
      const addedTimeMs = addedTicks * 10000;
      const dampedAddedTime = addedTimeMs * 0.2;
      
      const newTime = (entity.baseTickTime || 10000) + dampedAddedTime;
      patch.baseTickTime = Math.round(newTime);
      remainingDeficit = 0; // Padded
    }
  }

  // 4. Audit Flag
  if (unlockedIndices.length === 0 && remainingDeficit > 0.1) {
    patch.auditFlag = 'Unresolvable Deficit';
  } else if (entity.auditFlag) {
    patch.auditFlag = null;
  }

  return Object.keys(patch).length > 0 ? patch : null;
};
