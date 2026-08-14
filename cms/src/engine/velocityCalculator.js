import { DEFAULT_GLOBALS } from '../utils/constants';

/**
 * Velocity Calculator — Implements Stage 1 Velocity Curves & Labor Valuation
 *
 * Provides velocity target interpolation (GPH / XPH) and labor rate calculations
 * per skill level bracket.
 */

/**
 * Interpolates a target value for a given level across bracketed targets.
 * @param {number} level - Hero skill level (1-99)
 * @param {Record<number, number>} targets - Bracket targets e.g. { 1: 1200, 11: 1400, 41: 10000, 71: 176000 }
 * @returns {number} Interpolated target value
 */
export function interpolateVelocityTarget(level, targets = {}) {
  const brackets = Object.keys(targets).map(Number).sort((a, b) => a - b);
  if (brackets.length === 0) return 0;
  if (level <= brackets[0]) return targets[brackets[0]];
  if (level >= brackets[brackets.length - 1]) return targets[brackets[brackets.length - 1]];

  for (let i = 0; i < brackets.length - 1; i++) {
    const l1 = brackets[i];
    const l2 = brackets[i + 1];
    if (level >= l1 && level <= l2) {
      const v1 = targets[l1];
      const v2 = targets[l2];
      const t = (level - l1) / (l2 - l1);
      return v1 + t * (v2 - v1);
    }
  }
  return targets[brackets[0]];
}

/**
 * Gets gold-per-hour and XP-per-hour velocity targets for a skill level.
 * @param {number} level
 * @param {object} globals
 * @returns {{ gph: number, xph: number, gpm: number, xpm: number }}
 */
export function getVelocityTargets(level = 1, globals = {}) {
  const gphTargets = globals?.gphTargets || DEFAULT_GLOBALS.gphTargets || {};
  const xphTargets = globals?.xphTargets || DEFAULT_GLOBALS.xphTargets || {};

  const targetGPH = interpolateVelocityTarget(level, gphTargets);
  const targetXPH = interpolateVelocityTarget(level, xphTargets);

  return {
    gph: targetGPH,
    xph: targetXPH,
    gpm: targetGPH / 60,
    xpm: targetXPH / 60,
  };
}

/**
 * Computes the target GPH for a specific entity, accounting for passive generators (D-116).
 * @param {object} entity - Token or Recipe
 * @param {object} globals
 * @returns {number} Target GPH in gold per hour
 */
export function getEntityTargetGPH(entity, globals = {}) {
  const level = entity?.skillRequirement || entity?.level || 1;
  const velocity = getVelocityTargets(level, globals);
  let targetGPH = velocity.gph;

  // D-116: Passive generators solve against passiveVelocityRatio (default 0.25)
  const isPassive = entity?.requiresHero === false || entity?.passive === true;
  if (isPassive) {
    const ratio = globals?.passiveVelocityRatio ?? DEFAULT_GLOBALS.passiveVelocityRatio ?? 0.25;
    targetGPH *= ratio;
  }

  return targetGPH;
}

/**
 * Checks whether an implied GPH is within the velocity tolerance band.
 * @param {number} impliedGPH
 * @param {number} targetGPH
 * @param {object} globals
 * @returns {boolean}
 */
export function isWithinVelocityTolerance(impliedGPH, targetGPH, globals = {}) {
  if (targetGPH <= 0) return true;
  const tolerance = globals?.velocityTolerance ?? DEFAULT_GLOBALS.velocityTolerance ?? 0.05;
  const deviation = Math.abs(impliedGPH - targetGPH) / targetGPH;
  return deviation <= tolerance;
}
