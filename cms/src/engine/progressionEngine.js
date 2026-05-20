import { SKILLS } from '../utils/constants';

/**
 * Progression Engine — Analyzes the 1-99 journey for each skill.
 * Calculates XP Velocity, Time-to-Level, and Identifying Stalling Points.
 */

/**
 * Calculates the XP gap for every level from 1 to 99.
 */
export function calculateXpThresholds(globals) {
  const thresholds = {};
  const base = globals.xpThresholdBase || 100;
  const mult = globals.xpThresholdMultiplier || 1.15;

  for (let l = 1; l <= 99; l++) {
    thresholds[l] = Math.floor(base * Math.pow(mult, l - 1));
  }
  return thresholds;
}

/**
 * Generates a full 1-99 progression report for a specific skill.
 */
export function calculateLevelingPath(skillId, entities, xpResults, thresholds, globals) {
  const path = [];
  
  // Combine all tasks/recipes/enemies for this skill
  const skillSources = [
    ...Object.values(entities.tasks || {}),
    ...Object.values(entities.recipes || {}),
    ...(skillId === 'combat' ? Object.values(entities.enemies || {}) : [])
  ].filter(t => t.skill === skillId || t.skillId === skillId);

  for (let l = 1; l < 99; l++) {
    // 1. Find all available sources for this level
    const available = skillSources.filter(t => (t.skillRequirement || 1) <= l);
    
    // 2. Find the best XP/min (Velocity)
    let bestV = 0;
    let bestSourceId = null;
    
    available.forEach(t => {
      // Use simulated xpPerMinute if available (accurate TTK), 
      // otherwise fall back to prescribed XP / baseTickTime
      let v = 0;
      if (t.xpPerMinute != null) {
        v = t.xpPerMinute;
      } else {
        const xp = xpResults[t.id] || t.xpAwarded || 0;
        const mins = (t.baseTickTime || (t.combatStat ? 12000 : 10000)) / 60000;
        v = xp / mins;
      }

      if (v > bestV) {
        bestV = v;
        bestSourceId = t.id;
      }
    });

    // 3. Calculate TTL
    const xpNeeded = thresholds[l];
    const ttlMins = bestV > 0 ? xpNeeded / bestV : Infinity;
    
    // 4. Calculate Efficiency (Target TTL vs Actual TTL)
    const targetTTL = getTargetTTL(l, globals);
    const efficiency = targetTTL / ttlMins;

    path.push({
      level: l,
      bestSourceId,
      xpVelocity: bestV,
      ttlMinutes: ttlMins,
      targetTTL,
      efficiency,
      isStalling: ttlMins > targetTTL * 2 || bestV === 0
    });
  }

  return path;
}

/**
 * Generates reports for all 8 skills.
 */
export function generateProgressionReports(entities, xpResults, globals) {
  const thresholds = calculateXpThresholds(globals);
  const reports = {};

  SKILLS.forEach(skill => {
    reports[skill.id] = calculateLevelingPath(skill.id, entities, xpResults, thresholds, globals);
  });

  return reports;
}

function getTargetTTL(level, globals) {
  const targets = globals.ttlTargets || {};
  const brackets = Object.keys(targets).map(Number).sort((a, b) => b - a);
  const bracket = brackets.find(k => level >= k) || 1;
  return targets[bracket] || 10;
}
