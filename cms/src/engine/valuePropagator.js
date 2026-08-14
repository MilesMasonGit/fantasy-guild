import { deriveRootItemValues, resolveItemPrimaryAnchors, getOutputExpectedYield } from './anchorCalculator';
import { DEFAULT_GLOBALS } from '../utils/constants';

/**
 * Value Propagation Engine — Implements Stage 1 Value Propagation (CMS-47, CMS-109, CMS-110)
 *
 * Walks the dependency graph from Root Items outward through recipes and processing chains,
 * calculating:
 * 1. trueCost for each produced item with craft markup
 * 2. sellPrice = trueCost * (1 + sellModifier)
 */

/**
 * Calculates sum of material input costs for a recipe.
 * @param {Array<object>} inputs - [{ id/itemId, quantity }]
 * @param {Record<string, object>} items - Valued items map
 * @returns {number}
 */
export function sumInputCosts(inputs = [], items = {}) {
  let total = 0;
  for (const input of inputs) {
    const itemId = input.id || input.itemId;
    const qty = input.quantity ?? 1;
    const item = items[itemId];
    if (item && item.trueCost > 0) {
      total += item.trueCost * qty;
    }
  }
  return total;
}

/**
 * Propagates values across all items in the CMS economy.
 * @param {object} entities - { items, tokens, recipes, enemies, maps }
 * @param {object} globals - CMS Global Dials
 * @returns {{ valuedItems: Record<string, object>, anchors: object, iterations: number }}
 */
export function propagateValues(entities, globals = {}) {
  const items = { ...(entities.items || {}) };
  const recipes = { ...(entities.recipes || {}) };
  const anchors = resolveItemPrimaryAnchors(entities);

  // Initialize all items with clone
  const valuedItems = {};
  for (const [id, item] of Object.entries(items)) {
    valuedItems[id] = { ...item };
  }

  // Step 1: Seed root item values from primary anchors
  const rootValues = deriveRootItemValues(entities, globals);
  const valuedSet = new Set();

  for (const [itemId, value] of Object.entries(rootValues)) {
    if (valuedItems[itemId]) {
      valuedItems[itemId].trueCost = value;
      updateDerivedSellPrice(valuedItems[itemId], globals);
      valuedSet.add(itemId);
    }
  }

  // Step 2: Iterative DAG propagation for recipes
  const craftMarkupBase = globals?.craftMarkupBase ?? DEFAULT_GLOBALS.craftMarkupBase ?? 0.05;
  const craftMarkupTierRate = globals?.craftMarkupTierRate ?? DEFAULT_GLOBALS.craftMarkupTierRate ?? 0.01;

  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 20;

  while (changed && iterations < MAX_ITERATIONS) {
    changed = false;
    iterations++;

    for (const [recipeId, recipe] of Object.entries(recipes)) {
      const inputs = recipe.inputs || [];
      const outputs = recipe.outputs || [];

      // Check if all inputs are valued
      const allInputsValued = inputs.every((inp) => {
        const iid = inp.id || inp.itemId;
        return !iid || (valuedItems[iid] && valuedItems[iid].trueCost > 0);
      });

      if (!allInputsValued || inputs.length === 0 || outputs.length === 0) continue;

      const inputCost = sumInputCosts(inputs, valuedItems);
      const level = recipe.skillRequirement || recipe.level || 1;
      const markupMultiplier = 1 + craftMarkupBase + (level - 1) * craftMarkupTierRate;
      const totalCraftValue = inputCost * markupMultiplier;

      // Allocate value across outputs
      const totalYield = outputs.reduce((sum, o) => sum + getOutputExpectedYield(o), 0);
      if (totalYield <= 0) continue;

      for (const out of outputs) {
        const outItemId = out.id || out.itemId;
        if (!outItemId || !valuedItems[outItemId]) continue;

        // Check if this recipe is the designated anchor for this output item
        const primaryAnchor = anchors[outItemId];
        const isAnchor = primaryAnchor && primaryAnchor.producerId === recipeId;

        // If not anchor and already valued, do not overwrite primary anchor value
        if (!isAnchor && valuedSet.has(outItemId)) continue;

        const outEY = getOutputExpectedYield(out);
        if (outEY <= 0) continue;

        // Unit value = (totalCraftValue * (outEY / totalYield)) / outEY = totalCraftValue / totalYield
        const derivedUnitValue = Math.max(0.01, Math.round((totalCraftValue / totalYield) * 100) / 100);

        const currentVal = valuedItems[outItemId].trueCost || 0;
        if (Math.abs(currentVal - derivedUnitValue) > 0.001) {
          valuedItems[outItemId].trueCost = derivedUnitValue;
          updateDerivedSellPrice(valuedItems[outItemId], globals);
          valuedSet.add(outItemId);
          changed = true;
        }
      }
    }
  }

  return {
    valuedItems,
    anchors,
    iterations,
  };
}

/**
 * Updates derived sell price for an item based on trueCost and sellModifiers dial.
 * @param {object} item
 * @param {object} globals
 */
export function updateDerivedSellPrice(item, globals = {}) {
  const trueCost = item.trueCost || 0;
  const sellModifiers = globals?.sellModifiers || DEFAULT_GLOBALS.sellModifiers || {};
  const itemType = item.type || item.category || 'Material';

  const typeMod = sellModifiers[itemType] ?? 0;
  const sellRatio = Math.max(0.1, 1 + typeMod);

  item.sellPrice = Math.max(1, Math.round(trueCost * sellRatio));
}
