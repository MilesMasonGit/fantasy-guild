import { describe, it, expect } from 'vitest';
import { getVelocityTargets, getEntityTargetGPH, isWithinVelocityTolerance } from '../../cms/src/engine/velocityCalculator';
import { resolveItemPrimaryAnchors, deriveRootItemValues, computeMultiOutputSplitWeights } from '../../cms/src/engine/anchorCalculator';
import { propagateValues } from '../../cms/src/engine/valuePropagator';
import { solveTokenCycleBalance, calculateTokenImpliedGPH } from '../../cms/src/engine/tokenSolver';
import { solveTokenCharges, calculateMapPoolTokenSlices } from '../../cms/src/engine/chargeSolver';
import { runFullBalance } from '../../cms/src/engine/balanceRunner';

import tokenData from '../../data/tokens.json';
import itemData from '../../data/items.json';
import recipeData from '../../data/recipes.json';
import mapData from '../../data/maps.json';
import enemyData from '../../data/enemies.json';

describe('CMS Phase 8 Balance Engine & Solver', () => {
  const globals = {
    gphTargets: { 1: 1200, 11: 1400, 41: 10000, 71: 176000 },
    xphTargets: { 1: 3000, 11: 3500, 41: 25000, 71: 440000 },
    passiveVelocityRatio: 0.25,
    mapTargetROI: 20.0,
    craftMarkupBase: 0.05,
    craftMarkupTierRate: 0.01,
    velocityTolerance: 0.05,
    rawCommodityBaseValue: 2.0,
  };

  const rawEntities = {
    tokens: Array.isArray(tokenData) ? Object.fromEntries(tokenData.map(t => [t.id, t])) : tokenData,
    items: Array.isArray(itemData) ? Object.fromEntries(itemData.map(i => [i.id, i])) : itemData,
    recipes: Array.isArray(recipeData) ? Object.fromEntries(recipeData.map(r => [r.id, r])) : recipeData,
    maps: Array.isArray(mapData) ? Object.fromEntries(mapData.map(m => [m.id, m])) : mapData,
    enemies: Array.isArray(enemyData) ? Object.fromEntries(enemyData.map(e => [e.id, e])) : enemyData,
  };

  describe('1. Velocity Calculator (Stage 1)', () => {
    it('interpolates GPH and XPH for skill levels correctly', () => {
      const v1 = getVelocityTargets(1, globals);
      expect(v1.gph).toBe(1200);
      expect(v1.xph).toBe(3000);

      const v11 = getVelocityTargets(11, globals);
      expect(v11.gph).toBe(1400);

      // Mid-tier interpolation
      const v6 = getVelocityTargets(6, globals);
      expect(v6.gph).toBe(1300);
    });

    it('scales target GPH for passive generators by passiveVelocityRatio (D-116)', () => {
      const staffedToken = { id: 'test_grove', skillRequirement: 1, requiresHero: true };
      const passiveToken = { id: 'test_wind_trap', skillRequirement: 1, requiresHero: false };

      expect(getEntityTargetGPH(staffedToken, globals)).toBe(1200);
      expect(getEntityTargetGPH(passiveToken, globals)).toBe(300); // 1200 * 0.25
    });

    it('validates velocity tolerance correctly within 5%', () => {
      expect(isWithinVelocityTolerance(1250, 1200, globals)).toBe(true); // +4.16%
      expect(isWithinVelocityTolerance(1300, 1200, globals)).toBe(false); // +8.33%
    });
  });

  describe('2. Anchor Calculator & Multi-Output Split (CMS-109, CMS-110, CMS-112)', () => {
    it('resolves Oakwood Grove as primary anchor and derives Oak Wood at 2.0g', () => {
      const rootValues = deriveRootItemValues(rawEntities, globals);
      expect(rootValues.item_oak_wood).toBeCloseTo(2.0, 1);
    });

    it('allocates multi-output value split by inverse abundance for Trout Stream', () => {
      const outputs = [
        { itemId: 'item_fish', quantity: 1, chance: 100 },
        { itemId: 'item_raw_shrimp', quantity: 1, chance: 60 },
      ];
      const weights = computeMultiOutputSplitWeights(outputs);
      expect(weights.length).toBe(2);
      expect(weights[0] + weights[1]).toBeCloseTo(1.0, 4);
      // Rarer output (60% shrimp) gets a higher relative per-cycle slice
      expect(weights[1]).toBeGreaterThan(weights[0]);
    });
  });

  describe('3. Value Propagator (Stage 1 DAG)', () => {
    it('propagates values downstream with craft markup', () => {
      const result = propagateValues(rawEntities, globals);
      const oakWood = result.valuedItems.item_oak_wood;
      expect(oakWood).toBeDefined();
      expect(oakWood.trueCost).toBeCloseTo(2.0, 1);
    });
  });

  describe('4. Token Solver (CMS-111 Spread Preservation & Passives)', () => {
    it('tunes non-anchor token output quantity while preserving authored min-max spread', () => {
      const valuedItems = {
        item_copper_ore: { trueCost: 1.5 },
      };
      const anchors = {
        item_copper_ore: { producerId: 'token_copper_seam' },
      };
      const testToken = {
        id: 'token_rich_copper_seam',
        skillRequirement: 1,
        cycleTime: 12,
        outputs: [{ itemId: 'item_copper_ore', minQty: 1, maxQty: 3, chance: 100 }], // avg 2, spread 2
      };

      const result = solveTokenCycleBalance(testToken, valuedItems, anchors, globals);
      expect(result.modified).toBe(true);
      const patchedOut = result.patchedToken.outputs[0];
      // Authored spread (3 - 1 = 2) should be preserved
      if (patchedOut.minQty !== undefined) {
        expect(patchedOut.maxQty - patchedOut.minQty).toBe(2);
      }
    });
  });

  describe('5. Charge Solver (Stage 2 Macro Capacity, CMS-114)', () => {
    it('computes token charges from map acquisition slice and mapTargetROI', () => {
      const valuedItems = { item_oak_wood: { trueCost: 2.0 } };
      const token = {
        id: 'token_oakwood_grove',
        cycleTime: 12,
        charges: 5000,
        outputs: [{ itemId: 'item_oak_wood', quantity: 2, chance: 100 }],
      };

      // Slice = 10g, ROI = 20x -> TargetLifetime = 200g. EV/cycle = 4g -> 50 charges
      const result = solveTokenCharges(token, 10, valuedItems, globals);
      expect(result.charges).toBe(50);
      expect(result.impliedROI).toBeCloseTo(20.0, 1);
    });
  });

  describe('6. Full Balance Runner (End-to-End Orchestration)', () => {
    it('executes full balance pipeline and converges within 10 iterations', () => {
      const balanceResult = runFullBalance(rawEntities, globals);
      expect(balanceResult.stats.converged).toBe(true);
      expect(balanceResult.stats.iterations).toBeLessThanOrEqual(10);
      expect(balanceResult.items.item_oak_wood.trueCost).toBeCloseTo(2.0, 1);
    });
  });
});
