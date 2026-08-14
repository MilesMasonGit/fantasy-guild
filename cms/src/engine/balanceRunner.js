import { propagateValues } from './valuePropagator';
import { solveTokenCycleBalance } from './tokenSolver';
import { solveEntityXP } from './xpSolver';
import { solveTokenCharges, calculateMapPoolTokenSlices } from './chargeSolver';
import { solveEnemyLootBalance } from './combatLootSolver';

/**
 * Balance Runner — Master Orchestrator for Phase 8 Balance Engine & Solver
 * (CMS-16, CMS-47, CMS-109 through CMS-116)
 */

/**
 * Generates a compact hash representing the current state of item trueCosts and token output chances.
 * Used for cycle oscillation detection (CMS-115).
 */
function hashBalanceState(valuedItems, tokens) {
  const itemEntries = Object.entries(valuedItems)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, item]) => `${id}:${item.trueCost}`)
    .join('|');

  const tokenEntries = Object.entries(tokens)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, t]) => {
      const outStr = (t.outputs || [])
        .map((o) => `${o.id || o.itemId}:${o.minQty ?? o.quantity}-${o.maxQty ?? o.quantity}@${o.chance ?? o.dropChance}`)
        .join(',');
      return `${id}[${outStr}]`;
    })
    .join('|');

  return `${itemEntries}#${tokenEntries}`;
}

/**
 * Runs the full on-demand balance engine over the entire CMS dataset.
 * @param {object} entities - { items, tokens, recipes, enemies, maps }
 * @param {object} globals - CMS Global Dials
 * @returns {{
 *   items: Record<string, object>,
 *   tokens: Record<string, object>,
 *   recipes: Record<string, object>,
 *   enemies: Record<string, object>,
 *   maps: Record<string, object>,
 *   stats: { iterations: number, converged: boolean, modifiedTokensCount: number },
 *   refusals: Array<string>
 * }}
 */
export function runFullBalance(entities, globals = {}) {
  let currentItems = { ...(entities.items || {}) };
  let currentTokens = { ...(entities.tokens || {}) };
  let currentRecipes = { ...(entities.recipes || {}) };
  let currentEnemies = { ...(entities.enemies || {}) };
  let currentMaps = { ...(entities.maps || {}) };

  const refusals = [];
  const stateHistory = new Set();

  let iterations = 0;
  const MAX_ITERATIONS = 10;
  let converged = false;
  let totalModifiedTokens = 0;

  // Outer fixed-point relaxation loop (CMS-47, CMS-108, CMS-115)
  while (!converged && iterations < MAX_ITERATIONS) {
    iterations++;

    // 1. Stage 1: Propagate item values from primary anchors through recipes
    const propagationResult = propagateValues(
      {
        items: currentItems,
        tokens: currentTokens,
        recipes: currentRecipes,
        enemies: currentEnemies,
        maps: currentMaps,
      },
      globals
    );

    currentItems = propagationResult.valuedItems;
    const anchors = propagationResult.anchors;

    // 2. Stage 1: Solve non-anchor Token cycle velocities (Quantity Range & Chance)
    let anyTokenChanged = false;
    const nextTokens = {};

    for (const [tokenId, token] of Object.entries(currentTokens)) {
      const solveResult = solveTokenCycleBalance(token, currentItems, anchors, globals);
      nextTokens[tokenId] = solveResult.patchedToken;

      if (solveResult.modified) {
        anyTokenChanged = true;
        totalModifiedTokens++;
      }
      if (solveResult.refusal && iterations === 1) {
        refusals.push(solveResult.refusal);
      }
    }
    currentTokens = nextTokens;

    // 3. Stage 1: Solve XP per cycle for all tokens and recipes
    for (const [tokenId, token] of Object.entries(currentTokens)) {
      const xpResult = solveEntityXP(token, globals);
      if (xpResult.modified) {
        currentTokens[tokenId] = xpResult.patchedEntity;
      }
    }
    for (const [recipeId, recipe] of Object.entries(currentRecipes)) {
      const xpResult = solveEntityXP(recipe, globals);
      if (xpResult.modified) {
        currentRecipes[recipeId] = xpResult.patchedEntity;
      }
    }

    // Check oscillation or stability
    const stateHash = hashBalanceState(currentItems, currentTokens);
    if (stateHistory.has(stateHash) || !anyTokenChanged) {
      converged = true;
      break;
    }
    stateHistory.add(stateHash);
  }

  // 4. Stage 2: Solve Token Charges from Map burst slices and mapTargetROI dial
  // Precompute Map pool slices across all maps
  const tokenAcquisitionSlices = {};
  for (const map of Object.values(currentMaps)) {
    const slices = calculateMapPoolTokenSlices(map, currentItems, globals);
    Object.assign(tokenAcquisitionSlices, slices);
  }

  for (const [tokenId, token] of Object.entries(currentTokens)) {
    const slice = tokenAcquisitionSlices[tokenId] ?? 10;
    const chargeResult = solveTokenCharges(token, slice, currentItems, globals);
    if (chargeResult.charges !== token.charges && token.charges !== null) {
      currentTokens[tokenId] = {
        ...token,
        charges: chargeResult.charges,
      };
    }
  }

  // 5. Stage 3: Solve Enemy loot tables
  for (const [enemyId, enemy] of Object.entries(currentEnemies)) {
    const enemyResult = solveEnemyLootBalance(enemy, currentItems, globals);
    if (enemyResult.modified) {
      currentEnemies[enemyId] = enemyResult.patchedEnemy;
    }
  }

  return {
    items: currentItems,
    tokens: currentTokens,
    recipes: currentRecipes,
    enemies: currentEnemies,
    maps: currentMaps,
    stats: {
      iterations,
      converged,
      modifiedTokensCount: totalModifiedTokens,
    },
    refusals,
  };
}
