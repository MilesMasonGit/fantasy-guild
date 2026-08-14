import { getVelocityTargets } from './velocityCalculator';

/**
 * XP Solver — Implements Stage 1 Direct XP Velocity Balancing (CMS-113)
 */

/**
 * Calculates the balanced XP per cycle for a token or recipe based on skill level XPH band.
 * @param {object} entity - Token or Recipe
 * @param {object} globals - CMS globals
 * @returns {number} Target XP per cycle (integer >= 1)
 */
export function calculateBalancedXP(entity, globals = {}) {
  const level = entity?.skillRequirement || entity?.level || 1;
  const velocity = getVelocityTargets(level, globals);
  const cycleTime = entity?.cycleTime || entity?.baseTickTime / 1000 || 12;

  if (cycleTime <= 0 || velocity.xph <= 0) return entity?.xp || 1;

  // xp = round((targetXPH * cycleTime) / 3600)
  const balancedXP = Math.max(1, Math.round((velocity.xph * cycleTime) / 3600));
  return balancedXP;
}

/**
 * Solves and updates the XP awarded per cycle on a token or recipe.
 * @param {object} entity
 * @param {object} globals
 * @returns {{ patchedEntity: object, modified: boolean }}
 */
export function solveEntityXP(entity, globals = {}) {
  if (!entity) return { patchedEntity: entity, modified: false };

  const currentXP = entity.xp ?? entity.experience ?? 0;
  const targetXP = calculateBalancedXP(entity, globals);

  if (currentXP !== targetXP) {
    return {
      patchedEntity: { ...entity, xp: targetXP },
      modified: true,
    };
  }

  return { patchedEntity: entity, modified: false };
}
