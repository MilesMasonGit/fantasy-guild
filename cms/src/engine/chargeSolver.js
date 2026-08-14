import { DEFAULT_GLOBALS } from '../utils/constants';
import { getOutputExpectedYield } from './anchorCalculator';

/**
 * Charge Solver — Implements Stage 2 Lifetime Value & Map ROI-Driven Charges (CMS-114)
 */

/**
 * Computes the total effective acquisition cost of a Map (Gold + Material values, CMS-108).
 * @param {object} map - Map definition
 * @param {Record<string, object>} valuedItems - Valued items map
 * @returns {number} Full Map cost in gold
 */
export function calculateFullMapCost(map, valuedItems = {}) {
  if (!map) return 200;
  const baseGold = map.cost || map.goldCost || 200;
  let materialCost = 0;

  const materials = map.materialCost || map.materials || [];
  for (const mat of materials) {
    const itemId = mat.id || mat.itemId;
    const qty = mat.quantity ?? mat.count ?? 1;
    const item = valuedItems[itemId];
    if (item && item.trueCost > 0) {
      materialCost += item.trueCost * qty;
    }
  }

  return baseGold + materialCost;
}

/**
 * Calculates the acquisition cost slice allocated to each entry in a Map pool (CMS-103).
 * Allocates burst value inversely proportional to draw weight (rarer = bigger slice).
 * @param {object} map - Map definition
 * @param {Record<string, object>} valuedItems
 * @param {object} globals
 * @returns {Record<string, number>} entryId -> gold cost slice per copy
 */
export function calculateMapPoolTokenSlices(map, valuedItems = {}, globals = {}) {
  if (!map || !map.pool || map.pool.length === 0) return {};

  const fullMapCost = calculateFullMapCost(map, valuedItems);
  const pool = map.pool;

  // Inverse draw weight allocation (CMS-103)
  const inverseWeights = pool.map((entry) => {
    const weight = entry.weight ?? entry.dropWeight ?? 10;
    return weight > 0 ? 1 / weight : 1;
  });

  const totalInverseWeight = inverseWeights.reduce((sum, w) => sum + w, 0);
  const burstSizeAvg = ((map.minItems ?? 3) + (map.maxItems ?? 6)) / 2;
  const burstGoldPool = fullMapCost;

  const slices = {};
  pool.forEach((entry, idx) => {
    const entryId = entry.id || entry.tokenId || entry.itemId;
    if (!entryId) return;

    const sliceRatio = totalInverseWeight > 0 ? inverseWeights[idx] / totalInverseWeight : 1 / pool.length;
    // Value of one copy = (burstGoldPool / burstSizeAvg) * (sliceRatio * pool.length)
    const copyValue = (burstGoldPool / burstSizeAvg) * sliceRatio * pool.length;
    slices[entryId] = Math.max(0.1, Math.round(copyValue * 100) / 100);
  });

  return slices;
}

/**
 * Solves token charge counts based on Map acquisition cost slice and mapTargetROI dial (CMS-114).
 * @param {object} token - Token entity
 * @param {number} tokenAcquisitionSlice - Gold slice from Map burst
 * @param {Record<string, object>} valuedItems - Valued items map
 * @param {object} globals - CMS globals
 * @returns {{ charges: number|null, lifetimeValue: number, impliedROI: number }}
 */
export function solveTokenCharges(token, tokenAcquisitionSlice = 10, valuedItems = {}, globals = {}) {
  if (!token) return { charges: 100, lifetimeValue: 0, impliedROI: 0 };

  // Unlimited charges tokens (charges === null)
  if (token.charges === null) {
    return { charges: null, lifetimeValue: Infinity, impliedROI: Infinity };
  }

  // Calculate per-cycle EV
  let evCycle = 0;
  const outputs = token.outputs || [];
  for (const out of outputs) {
    const itemId = out.id || out.itemId;
    const item = valuedItems[itemId];
    const itemValue = item?.trueCost || 0;
    const ey = getOutputExpectedYield(out);
    evCycle += itemValue * ey;
  }

  if (evCycle <= 0) {
    return { charges: token.charges || 500, lifetimeValue: 0, impliedROI: 0 };
  }

  const mapTargetROI = globals?.mapTargetROI ?? DEFAULT_GLOBALS.mapTargetROI ?? 20.0;
  const targetLifetimeValue = tokenAcquisitionSlice * mapTargetROI;

  // Charges = round(targetLifetimeValue / evCycle)
  const calculatedCharges = Math.max(10, Math.round(targetLifetimeValue / evCycle));
  const finalLifetimeValue = calculatedCharges * evCycle;
  const impliedROI = tokenAcquisitionSlice > 0 ? finalLifetimeValue / tokenAcquisitionSlice : 0;

  return {
    charges: calculatedCharges,
    lifetimeValue: Math.round(finalLifetimeValue * 100) / 100,
    impliedROI: Math.round(impliedROI * 10) / 10,
  };
}
