import { getEntityTargetGPH, isWithinVelocityTolerance } from './velocityCalculator';
import { getOutputExpectedYield } from './anchorCalculator';
import { DEFAULT_GLOBALS } from '../utils/constants';

/**
 * Token Solver — Implements Stage 1 Non-Anchor Cycle Lever Solver (CMS-109, CMS-110, CMS-111, CMS-115)
 */

/**
 * Snaps a calculated drop chance to clean, legible increments (10% -> 5% -> 1%).
 * @param {number} chance - Raw calculated chance (0-100)
 * @returns {number} Snapped chance (10-100)
 */
export function snapDropChance(chance) {
  if (chance <= 10) return 10;
  if (chance >= 100) return 100;

  const c10 = Math.round(chance / 10) * 10;
  const c5 = Math.round(chance / 5) * 5;
  const c1 = Math.round(chance);

  if (Math.abs(c10 - chance) <= 2.5) return Math.max(10, Math.min(100, c10));
  if (Math.abs(c5 - chance) <= 1.5) return Math.max(10, Math.min(100, c5));
  return Math.max(10, Math.min(100, c1));
}

/**
 * Computes implied GPH for a token using currently valued items.
 * @param {object} token
 * @param {Record<string, object>} valuedItems
 * @returns {number}
 */
export function calculateTokenImpliedGPH(token, valuedItems = {}) {
  const cycleTime = token.cycleTime || token.baseTickTime / 1000 || 12;
  if (cycleTime <= 0) return 0;

  const cyclesPerHour = 3600 / cycleTime;
  let cycleValue = 0;

  const outputs = token.outputs || [];
  for (const out of outputs) {
    const itemId = out.id || out.itemId;
    const item = valuedItems[itemId];
    const itemValue = item?.trueCost || 0;
    const ey = getOutputExpectedYield(out);
    cycleValue += itemValue * ey;
  }

  return cycleValue * cyclesPerHour;
}

/**
 * Solves and tunes cycle levers for a single Token to bring its GPH into band.
 * @param {object} token - Token entity
 * @param {Record<string, object>} valuedItems - Valued items map
 * @param {object} anchors - Primary anchors map from resolveItemPrimaryAnchors
 * @param {object} globals - CMS globals
 * @returns {{ patchedToken: object, modified: boolean, refusal: string|null }}
 */
export function solveTokenCycleBalance(token, valuedItems = {}, anchors = {}, globals = {}) {
  if (!token || !token.outputs || token.outputs.length === 0) {
    return { patchedToken: token, modified: false, refusal: null };
  }

  const targetGPH = getEntityTargetGPH(token, globals);
  const currentGPH = calculateTokenImpliedGPH(token, valuedItems);

  // Check if already in band
  if (isWithinVelocityTolerance(currentGPH, targetGPH, globals)) {
    return { patchedToken: token, modified: false, refusal: null };
  }

  const cycleTime = token.cycleTime || token.baseTickTime / 1000 || 12;
  const cyclesPerHour = 3600 / cycleTime;
  const targetCycleValue = targetGPH / cyclesPerHour;

  const outputs = [...token.outputs.map((o) => ({ ...o }))];
  let modified = false;
  let refusal = null;

  // Identify non-anchor outputs (outputs that do not anchor this item's value)
  for (let i = 0; i < outputs.length; i++) {
    const out = outputs[i];
    const itemId = out.id || out.itemId;
    const item = valuedItems[itemId];
    const itemValue = item?.trueCost || 0;
    if (itemValue <= 0) continue;

    const isAnchor = anchors[itemId]?.producerId === token.id;
    if (isAnchor) continue; // Do not tune anchor outputs

    const isPrimaryOutput = i === 0;
    const currentEY = getOutputExpectedYield(out);
    const requiredEY = targetCycleValue / itemValue;

    if (isPrimaryOutput) {
      // Lever: Quantity / Min-Max Range (preserving authored spread)
      const currentMin = out.minQty ?? out.quantity ?? 1;
      const currentMax = out.maxQty ?? out.quantity ?? 1;
      const authoredSpread = Math.max(0, currentMax - currentMin);

      // Desired average quantity assuming 100% chance
      const desiredAvgQty = Math.max(1, requiredEY);
      const newMin = Math.max(1, Math.round(desiredAvgQty - authoredSpread / 2));
      const newMax = newMin + authoredSpread;

      if (newMin !== currentMin || newMax !== currentMax) {
        if (authoredSpread > 0 || newMin !== newMax) {
          out.minQty = newMin;
          out.maxQty = newMax;
          delete out.quantity;
        } else {
          out.quantity = newMin;
          delete out.minQty;
          delete out.maxQty;
        }
        modified = true;
      }

      // If at minimum quantity 1 and still over-earning by > 20%, tune drop chance
      const newEY = getOutputExpectedYield(out);
      const newImpliedGPH = (newEY * itemValue) * cyclesPerHour;
      if (newMin === 1 && newImpliedGPH > targetGPH * 1.20) {
        const requiredChance = (targetCycleValue / (newEY * itemValue)) * 100;
        const snappedChance = snapDropChance(requiredChance);
        if (snappedChance !== (out.chance ?? out.dropChance ?? 100)) {
          out.chance = snappedChance;
          out.dropChance = snappedChance;
          modified = true;
        }
      }
    } else {
      // Secondary/Byproduct Output: Lever = Drop Chance (snapped 10/5/1)
      const avgQty = ((out.minQty ?? out.quantity ?? 1) + (out.maxQty ?? out.quantity ?? 1)) / 2;
      if (avgQty > 0) {
        const rawChance = (targetCycleValue / (avgQty * itemValue)) * 100;
        const snappedChance = snapDropChance(rawChance);
        if (snappedChance !== (out.chance ?? out.dropChance ?? 100)) {
          out.chance = snappedChance;
          out.dropChance = snappedChance;
          modified = true;
        }
      }
    }
  }

  const patchedToken = { ...token, outputs };
  const finalGPH = calculateTokenImpliedGPH(patchedToken, valuedItems);

  if (!isWithinVelocityTolerance(finalGPH, targetGPH, globals)) {
    refusal = `Token ${token.id} could not reach target GPH (${Math.round(targetGPH)}g/hr) within lever bounds. Final: ${Math.round(finalGPH)}g/hr.`;
  }

  return {
    patchedToken,
    modified,
    refusal,
  };
}
