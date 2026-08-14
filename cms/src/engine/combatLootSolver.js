import { DEFAULT_GLOBALS } from '../utils/constants';
import { snapDropChance } from './tokenSolver';

/**
 * Combat Loot Solver — Implements Stage 3 Decoupled Enemy Loot Balancing (CMS-51)
 *
 * Solves encounter loot tables based purely on Total Kill Loot EV vs. Target Encounter Reward
 * with zero time / GPH dimension.
 */

/**
 * Computes total expected loot value for an enemy's drops.
 * @param {object} enemy
 * @param {Record<string, object>} valuedItems
 * @returns {number} Expected loot value in gold
 */
export function calculateEnemyExpectedLootValue(enemy, valuedItems = {}) {
  if (!enemy || !enemy.drops) return 0;

  let totalLootEV = 0;
  for (const drop of enemy.drops) {
    const itemId = drop.id || drop.itemId;
    const item = valuedItems[itemId];
    const itemValue = item?.trueCost || 0;

    const minQty = drop.minQty ?? drop.quantity ?? 1;
    const maxQty = drop.maxQty ?? drop.quantity ?? 1;
    const avgQty = (minQty + maxQty) / 2;
    const chance = (drop.dropChance ?? drop.chance ?? 100) / 100;

    totalLootEV += itemValue * avgQty * chance;
  }

  return totalLootEV;
}

/**
 * Solves enemy drop chances and quantities to hit target encounter reward EV.
 * @param {object} enemy - Enemy entity
 * @param {Record<string, object>} valuedItems - Valued items map
 * @param {object} globals - CMS globals
 * @returns {{ patchedEnemy: object, modified: boolean }}
 */
export function solveEnemyLootBalance(enemy, valuedItems = {}, globals = {}) {
  if (!enemy || !enemy.drops || enemy.drops.length === 0) {
    return { patchedEnemy: enemy, modified: false };
  }

  const level = enemy.level || enemy.skillRequirement || 1;
  const rawBase = globals?.rawCommodityBaseValue ?? DEFAULT_GLOBALS.rawCommodityBaseValue ?? 2.0;
  const rewardMultiplier = globals?.combatRewardMultiplier ?? DEFAULT_GLOBALS.combatRewardMultiplier ?? 1.05;

  // Baseline target reward for monster kill scaled by level
  const targetEncounterEV = rawBase * level * 2.0 * rewardMultiplier;
  const currentEV = calculateEnemyExpectedLootValue(enemy, valuedItems);

  if (Math.abs(currentEV - targetEncounterEV) <= targetEncounterEV * 0.10) {
    return { patchedEnemy: enemy, modified: false };
  }

  const drops = [...enemy.drops.map((d) => ({ ...d }))];
  let modified = false;

  // Scale drop chances proportionately to match target
  const ratio = currentEV > 0 ? targetEncounterEV / currentEV : 1.0;

  for (const drop of drops) {
    const currentChance = drop.dropChance ?? drop.chance ?? 100;
    const rawNewChance = currentChance * ratio;
    const snappedChance = snapDropChance(rawNewChance);

    if (snappedChance !== currentChance) {
      drop.dropChance = snappedChance;
      drop.chance = snappedChance;
      modified = true;
    }
  }

  return {
    patchedEnemy: { ...enemy, drops },
    modified,
  };
}
