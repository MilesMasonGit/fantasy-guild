import { getEntityTargetGPH } from './velocityCalculator';
import { DEFAULT_GLOBALS } from '../utils/constants';

/**
 * Anchor Calculator — Implements Stage 1 Primary Anchor Resolution & Root Item Pricing
 * (CMS-109, CMS-110, CMS-112)
 */

/**
 * Computes the expected yield (units per cycle) for an output entry.
 * @param {object} output - { quantity, minQty, maxQty, chance, dropChance }
 * @returns {number} Expected units per cycle
 */
export function getOutputExpectedYield(output) {
  if (!output) return 0;
  const minQty = output.minQty ?? output.quantity ?? 1;
  const maxQty = output.maxQty ?? output.quantity ?? 1;
  const avgQty = (minQty + maxQty) / 2;
  const chance = (output.dropChance ?? output.chance ?? 100) / 100;
  return avgQty * chance;
}

/**
 * Computes the relative split weight across multiple outputs using inverse abundance (CMS-112).
 * w_i = 1 / (avgQty_i * chance_i)
 * @param {Array<object>} outputs
 * @returns {Array<number>} Array of normalized weights summing to 1.0
 */
export function computeMultiOutputSplitWeights(outputs = []) {
  if (!outputs || outputs.length === 0) return [];
  if (outputs.length === 1) return [1.0];

  const rawWeights = outputs.map((out) => {
    const ey = getOutputExpectedYield(out);
    return ey > 0 ? 1 / ey : 1;
  });

  const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) return outputs.map(() => 1 / outputs.length);

  return rawWeights.map((w) => w / totalWeight);
}

/**
 * Scans all tokens and recipes to find the primary anchor producer for each produced item.
 * Preference order (CMS-110):
 * 1. Explicit `isPrimarySource: true` on the output.
 * 2. Staffed Resource Token (`requiresHero !== false`) with lowest skill requirement and Common rarity.
 * 3. Any staffed producer with lowest skill requirement.
 * 4. First discovered producer.
 *
 * @param {object} entities - { tokens, recipes, items }
 * @returns {Record<string, { producerId: string, outputIndex: number, isRecipe: boolean }>}
 */
export function resolveItemPrimaryAnchors(entities) {
  const tokens = entities?.tokens || {};
  const recipes = entities?.recipes || {};
  const itemAnchors = {};

  const producerCandidates = {}; // itemId -> array of candidate records

  // Scan Tokens (Gathering/Resource tokens)
  for (const [tokenId, token] of Object.entries(tokens)) {
    const outputs = token.outputs || [];
    outputs.forEach((out, idx) => {
      const itemId = out.id || out.itemId;
      if (!itemId) return;

      if (!producerCandidates[itemId]) {
        producerCandidates[itemId] = [];
      }

      producerCandidates[itemId].push({
        producerId: tokenId,
        producer: token,
        outputIndex: idx,
        output: out,
        isRecipe: false,
        isExplicitPrimary: !!out.isPrimarySource,
        isStaffed: token.requiresHero !== false,
        level: token.skillRequirement || token.level || 1,
        rarity: (token.rarity || 'common').toLowerCase(),
      });
    });
  }

  // Scan Recipes (Crafting/Refining outputs)
  for (const [recipeId, recipe] of Object.entries(recipes)) {
    const outputs = recipe.outputs || [];
    outputs.forEach((out, idx) => {
      const itemId = out.id || out.itemId;
      if (!itemId) return;

      if (!producerCandidates[itemId]) {
        producerCandidates[itemId] = [];
      }

      producerCandidates[itemId].push({
        producerId: recipeId,
        producer: recipe,
        outputIndex: idx,
        output: out,
        isRecipe: true,
        isExplicitPrimary: !!out.isPrimarySource,
        isStaffed: true,
        level: recipe.skillRequirement || recipe.level || 1,
        rarity: 'common',
      });
    });
  }

  // Resolve best anchor for each item
  const rarityRank = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

  for (const [itemId, candidates] of Object.entries(producerCandidates)) {
    // 1. Explicit primary flag
    const explicit = candidates.find((c) => c.isExplicitPrimary);
    if (explicit) {
      itemAnchors[itemId] = {
        producerId: explicit.producerId,
        outputIndex: explicit.outputIndex,
        isRecipe: explicit.isRecipe,
      };
      continue;
    }

    // 2. Sort by: staffed (true first) -> level (lowest first) -> rarity (common first) -> non-recipe first
    const sorted = [...candidates].sort((a, b) => {
      if (a.isStaffed !== b.isStaffed) return a.isStaffed ? -1 : 1;
      if (a.level !== b.level) return a.level - b.level;
      const rankA = rarityRank[a.rarity] ?? 99;
      const rankB = rarityRank[b.rarity] ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      if (a.isRecipe !== b.isRecipe) return a.isRecipe ? 1 : -1;
      return 0;
    });

    if (sorted.length > 0) {
      itemAnchors[itemId] = {
        producerId: sorted[0].producerId,
        outputIndex: sorted[0].outputIndex,
        isRecipe: sorted[0].isRecipe,
      };
    }
  }

  return itemAnchors;
}

/**
 * Computes root item gold values derived from their primary anchor producer's cycle velocity.
 * @param {object} entities - { tokens, recipes, items }
 * @param {object} globals - CMS Globals
 * @returns {Record<string, number>} itemId -> derived trueCost / gold value
 */
export function deriveRootItemValues(entities, globals = {}) {
  const tokens = entities?.tokens || {};
  const items = entities?.items || {};
  const anchors = resolveItemPrimaryAnchors(entities);
  const rootValues = {};

  for (const [itemId, anchor] of Object.entries(anchors)) {
    // Only derive directly for Resource Tokens (Recipes derive via material propagation)
    if (anchor.isRecipe) continue;

    const token = tokens[anchor.producerId];
    if (!token) continue;

    const targetGPH = getEntityTargetGPH(token, globals);
    const cycleTime = token.cycleTime || token.baseTickTime / 1000 || 12;
    const outputs = token.outputs || [];
    const splitWeights = computeMultiOutputSplitWeights(outputs);

    const out = outputs[anchor.outputIndex];
    if (!out) continue;

    const expectedYield = getOutputExpectedYield(out);
    const splitWeight = splitWeights[anchor.outputIndex] ?? 1.0;

    if (expectedYield > 0 && cycleTime > 0) {
      // Value(Item) = (TargetGPH * CycleTime / 3600) * splitWeight / expectedYield
      const cycleTotalTargetValue = (targetGPH * cycleTime) / 3600;
      const itemGoldValue = (cycleTotalTargetValue * splitWeight) / expectedYield;
      rootValues[itemId] = Math.max(0.01, Math.round(itemGoldValue * 100) / 100);
    }
  }

  // Handle pure enemy-only items or items with no token producer
  const rawBase = globals?.rawCommodityBaseValue ?? DEFAULT_GLOBALS.rawCommodityBaseValue ?? 2.0;
  for (const [itemId, item] of Object.entries(items)) {
    if (!rootValues[itemId]) {
      // If hand-authored trueCost exists, preserve it; otherwise use commodity base scaled by tier
      const tier = item.tier || item.level || 1;
      const baseVal = item.trueCost > 0 ? item.trueCost : rawBase * (1 + (tier - 1) * 0.1);
      rootValues[itemId] = Math.max(0.01, Math.round(baseVal * 100) / 100);
    }
  }

  return rootValues;
}
