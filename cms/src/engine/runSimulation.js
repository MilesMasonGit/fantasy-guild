import { auditConnectivity } from './connectivityAuditor';
import { propagateValues } from './valuePropagator';
import { calculateTaskEV, calculateEncounterEV } from './evCalculator';
import { calculateCombatEV } from './mockBattle';
import { prescribeAllXP } from './xpPrescriber';
import { generateProgressionReports } from './progressionEngine';
import { solveEntityBalance } from './taskSolver';

/**
 * Simulation Orchestrator.
 * Runs all engines in order and returns results for review (Proposals).
 */
export async function runSimulation(entities, globals, onProgress) {
  let currentItems = { ...entities.items };
  let currentTasks = { ...entities.tasks };
  let currentRecipes = { ...entities.recipes };
  let currentEnemies = { ...entities.enemies };

  let proposals = {
    tasks: {},
    recipes: {},
    enemies: {},
    items: {}, // Item trueCost proposals based on markup
    quests: {}, // Dynamic quest reward proposals
  };

  const MAX_ITERATIONS = 10;

  // --- ITERATIVE SOLVER LOOP ---
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    onProgress(10 + (i * 5), `Balancing iteration ${i + 1}/${MAX_ITERATIONS}...`);
    await sleep(20);

    // 1. Propagate values (Root Items → downstream trueCost/sellPrice)
    const propagation = propagateValues({
      ...entities,
      items: currentItems,
      tasks: currentTasks,
      recipes: currentRecipes,
      enemies: currentEnemies
    }, globals);
    currentItems = propagation.items;

    // 2. Solve balance for all entities
    let totalChanges = 0;

    // 1. Enemy proposals
    const loopEnemyUpdates = {};
    for (const enemy of Object.values(currentEnemies)) {
      const combatEV = calculateCombatEV(enemy, currentItems, globals);
      const enemyWithCalculatedEV = { ...enemy, calculatedEV: combatEV.calculatedEV };
      
      loopEnemyUpdates[enemy.id] = combatEV;

      const patch = solveEntityBalance(enemyWithCalculatedEV, currentItems, globals);
      if (patch) {
        totalChanges++;
        proposals.enemies[enemy.id] = { ...proposals.enemies[enemy.id], ...patch };
        currentEnemies[enemy.id] = { ...currentEnemies[enemy.id], ...patch };
      }
    }

    // 2. Encounter EV (Derived from Enemies)
    const loopEncounterUpdates = {};
    for (const encounter of Object.values(entities.encounters || {})) {
      loopEncounterUpdates[encounter.id] = calculateEncounterEV(encounter, loopEnemyUpdates);
    }

    // Attach to globals temporarily so solveEntityBalance can use them
    const loopGlobals = { ...globals, encounterUpdates: loopEncounterUpdates, enemyUpdates: loopEnemyUpdates };

    // 3. Task proposals (Sunsetted - all task parameters are now manually set and not auto-balanced)


    // 4. Recipe proposals
    for (const recipe of Object.values(currentRecipes)) {
      const patch = solveEntityBalance(recipe, currentItems, loopGlobals);
      if (patch) {
        totalChanges++;
        proposals.recipes[recipe.id] = { ...proposals.recipes[recipe.id], ...patch };
        currentRecipes[recipe.id] = { ...currentRecipes[recipe.id], ...patch };
      }
    }

    if (totalChanges === 0) break; // Converged
  }

  // --- FINAL DIAGNOSTICS PASS ---
  onProgress(70, 'Finalizing diagnostics...');
  await sleep(50);

  const finalPropagation = propagateValues({ ...entities, items: currentItems }, globals);
  const finalValuedItems = finalPropagation.items;

  // Final EV calculations for tasks
  const taskUpdates = {};
  for (const task of Object.values(currentTasks)) {
    const evResult = calculateTaskEV(task, finalValuedItems, globals);
    taskUpdates[task.id] = {
      calculatedEV: evResult.calculatedEV,
      liquidityEV: evResult.liquidityEV,
      progressionEV: evResult.progressionEV,
      goldPerMinute: evResult.goldPerMinute,
      xpPerMinute: evResult.xpPerMinute,
      xpAwarded: task.xpAwarded,
    };
  }

  // Final EV calculations for recipes
  const recipeUpdates = {};
  for (const recipe of Object.values(currentRecipes)) {
    const evResult = calculateTaskEV(recipe, finalValuedItems, globals);
    recipeUpdates[recipe.id] = {
      calculatedEV: evResult.calculatedEV,
      liquidityEV: evResult.liquidityEV,
      progressionEV: evResult.progressionEV,
      goldPerMinute: evResult.goldPerMinute,
      xpPerMinute: evResult.xpPerMinute,
      xpAwarded: recipe.xpAwarded,
    };
  }

  // Final EV and Diagnostic calculations for enemies
  const enemyUpdates = {};
  for (const enemy of Object.values(currentEnemies)) {
    const combatEV = calculateCombatEV(enemy, finalValuedItems, globals);
    enemyUpdates[enemy.id] = {
      calculatedEV: combatEV.calculatedEV,
      liquidityEV: combatEV.liquidityEV,
      progressionEV: combatEV.progressionEV,
      goldPerMinute: combatEV.goldPerMinute,
      xpPerMinute: combatEV.xpPerMinute,
      timeToKill: combatEV.combat.timeToKill,
      expectedDamageTaken: combatEV.combat.expectedDamageTaken,
      healthCostGp: combatEV.combat.healthCostGp,
      heroDps: combatEV.combat.heroDps,
      enemyDps: combatEV.combat.enemyDps,
      heroHp: combatEV.combat.heroHp,
      heroHitChance: combatEV.combat.heroHitChance,
      heroAttackSpeed: combatEV.combat.heroAttackSpeed,
      enemyHitChance: combatEV.combat.enemyHitChance,
      enemyAttackSpeed: combatEV.combat.enemyAttackSpeed,
      canHeroSurvive: combatEV.combat.canHeroSurvive,
      combatCost: combatEV.cost,
      combatReward: combatEV.reward,
      xpAwarded: Math.round((enemy.combatStat || 1) * (globals.combatXpMultiplier || 1.0)),
    };
  }

  const encounterUpdates = {};
  for (const encounter of Object.values(entities.encounters || {})) {
    const evResult = calculateEncounterEV(encounter, enemyUpdates);
    encounterUpdates[encounter.id] = {
      calculatedEV: evResult.calculatedEV,
      liquidityEV: evResult.liquidityEV,
      progressionEV: evResult.progressionEV,
      goldPerMinute: evResult.goldPerMinute,
      xpPerMinute: evResult.xpPerMinute,
    };
  }

  // --- Quest Reward Optimization (200% Item Value, 100% Enemy Kill EV Value) ---
  const questProposals = {};
  for (const quest of Object.values(entities.quests || {})) {
    let recommendedGold = 50;
    let hasValidCalculation = false;

    if (quest.targetEvent === 'ON_ITEM_GAINED' || quest.targetEvent === 'Gain Item') {
      const targetItem = finalValuedItems[quest.targetId];
      if (targetItem) {
        const itemVal = targetItem.trueCost || 0;
        // user requested 200% (2.0x) of items consumed
        recommendedGold = Math.ceil(itemVal * (quest.maxProgress || 1) * 2.0);
        hasValidCalculation = true;
      }
    } else if (quest.targetEvent === 'ON_ENEMY_KILLED') {
      const enemyUpdate = enemyUpdates[quest.targetId];
      if (enemyUpdate && enemyUpdate.combatReward) {
        const killVal = enemyUpdate.combatReward.total || 0;
        // user requested 100% (1.0x) of enemy kill gold/drop value
        recommendedGold = Math.ceil(killVal * (quest.maxProgress || 1) * 1.0);
        hasValidCalculation = true;
      }
    }

    if (hasValidCalculation) {
      const currentGoldReward = (quest.rewards || []).find(r => r.id === 'gold' || r.type === 'CURRENCY')?.amount || 0;
      if (recommendedGold !== currentGoldReward) {
        const otherRewards = (quest.rewards || []).filter(r => r.id !== 'gold' && r.type !== 'CURRENCY');
        questProposals[quest.id] = {
          rewards: [
            { type: 'CURRENCY', id: 'gold', amount: recommendedGold },
            ...otherRewards
          ]
        };
      }
    }
  }
  proposals.quests = questProposals;

  // --- Step 5: Connectivity Audit ---
  onProgress(85, 'Auditing connectivity...');
  await sleep(50);

  const auditResults = auditConnectivity({
    ...entities,
    items: finalValuedItems,
  });

  // --- Step 6: Progression Simulation ---
  onProgress(95, 'Simulating progression...');
  const xpResults = prescribeAllXP({ ...currentTasks, ...currentRecipes, ...currentEnemies }, globals);
  const progressionReports = generateProgressionReports(entities, xpResults, globals);

  onProgress(100, 'Complete');
  await sleep(50);

  return {
    proposals,
    auditResults,
    progressionReports,
    itemUpdates: finalValuedItems,
    taskUpdates,
    recipeUpdates,
    encounterUpdates,
    enemyUpdates,
    propagation: {
      valuedCount: finalPropagation.valuedCount,
      totalItems: finalPropagation.totalItems,
      iterations: finalPropagation.iterations,
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
