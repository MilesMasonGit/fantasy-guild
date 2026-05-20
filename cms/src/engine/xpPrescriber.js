/**
 * XP Prescriber — Implements §4.5 (Prescriptive Version)
 *
 * Instead of a fixed curve, this prescriber calculates the XP award 
 * required to meet the "Time to Level" (TTL) goals defined in the Global Store.
 */

/**
 * Calculates the XP gap between level N and N+1.
 */
function getXPNeededForLevel(level, globals) {
  const base = globals.xpThresholdBase || 100;
  const mult = globals.xpThresholdMultiplier || 1.15;
  return Math.floor(base * Math.pow(mult, level - 1));
}

/**
 * Gets the TTL target (in minutes) for a specific level.
 */
function getTargetTTL(level, globals) {
  const targets = globals.ttlTargets || {};
  // Find the highest bracket key that is <= level
  const brackets = Object.keys(targets).map(Number).sort((a, b) => b - a);
  const bracket = brackets.find(k => level >= k) || 1;
  return targets[bracket] || 10;
}

/**
 * Calculate the prescribed XP for a task.
 */
export function prescribeXP(task, globals) {
  // If it's an enemy, calculate XP directly off Combat Stat without XP tax or bracket progressive logic
  if (task.combatStat !== undefined || task.combatType !== undefined) {
    return Math.round((task.combatStat || 1) * (globals.combatXpMultiplier || 1.0));
  }

  const level = task.skillRequirement || 1;
  
  // 1. How much total XP does the player need to earn at this level?
  const xpNeeded = getXPNeededForLevel(level, globals);
  
  // 2. How many minutes do we want it to take?
  const ttlMinutes = getTargetTTL(level, globals);
  
  // 3. Required Velocity (XP per minute)
  const requiredV = xpNeeded / ttlMinutes;
  
  // 4. XP per 10s baseline (10s = 1/6 of a minute)
  const baseXP = requiredV / 6;
  
  // 5. Normalize for the task's specific duration
  const durationMultiplier = (task.baseTickTime || 10000) / 10000;
  
  // Round to nearest integer (minimum 1 XP if it's a valid task)
  return Math.max(1, Math.round(baseXP * durationMultiplier));
}

/**
 * Prescribe XP for all tasks using global settings.
 */
export function prescribeAllXP(tasks, globals) {
  const results = {};
  for (const task of Object.values(tasks)) {
    results[task.id] = prescribeXP(task, globals);
  }
  return results;
}
