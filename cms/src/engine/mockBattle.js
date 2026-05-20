/**
 * Mock Battle Engine — Implements CMSDD §4.3
 *
 * Runs a DETERMINISTIC combat simulation using expected values (no dice rolls).
 * Mirrors the game's FormulaRegistry.js and CombatFormulas.js exactly,
 * but replaces random outcomes with averages for stable, reproducible readouts.
 *
 * Game formulas replicated:
 * - Hit chance:       50 + (atkSkill - defSkill) × 2, clamped [5, 95]
 * - Defence reduction: min(skill × 0.5, 50) / 100
 * - RPS multiplier:   Melee > Magic > Ranged > Melee (1.25 / 0.75)
 * - Hero atk speed:   3000ms / (1 + level × 0.005), floor 500ms
 * - Damage:           avg(min, max) × hitChance × RPS × (1 - defReduction)
 */

// ===== Constants (mirrored from FormulaRegistry.js) =====

const BASE_HIT_CHANCE = 50;
const HIT_CHANCE_SCALE = 2;
const HIT_CHANCE_MIN = 5;
const HIT_CHANCE_MAX = 95;

const DEFENCE_SKILL_FACTOR = 0.5;
const DEFENCE_CAP = 50;

const BASE_ATTACK_SPEED_MS = 3000;
const MIN_ATTACK_SPEED_MS = 500;
const SKILL_SPEED_FACTOR = 0.005;

const RPS_ADVANTAGE = 1.25;
const RPS_DISADVANTAGE = 0.75;
const RPS_NEUTRAL = 1.0;

const RPS_RULES = {
  melee:  { weak: 'ranged', strong: 'magic' },
  ranged: { weak: 'magic',  strong: 'melee' },
  magic:  { weak: 'melee',  strong: 'ranged' },
};

// ===== Derived Stat Helpers =====

/** Derive minDamage / maxDamage from a single combatStat. */
function deriveDamageRange(combatStat) {
  const min = Math.max(1, Math.floor(combatStat * 0.4));
  const max = Math.max(2, Math.floor(combatStat * 0.6));
  return { min, max };
}

/** Derive attackSkill from combatStat (1:1 mapping). */
function deriveAttackSkill(combatStat) {
  return combatStat;
}

/** Derive defenceSkill from combatStat (100% of active combat stat). */
function deriveDefenceSkill(combatStat) {
  return combatStat;
}

/** Derive hero base damage from the active combatStat. */
function deriveHeroWeaponRange(combatStat) {
  const min = Math.max(1, Math.floor(combatStat * 0.4));
  const max = Math.max(2, Math.floor(combatStat * 0.6));
  return { min, max };
}

// ===== Formula Replicas =====

function hitChance(attackerSkill, defenderSkill) {
  const raw = BASE_HIT_CHANCE + (attackerSkill - defenderSkill) * HIT_CHANCE_SCALE;
  return Math.max(HIT_CHANCE_MIN, Math.min(HIT_CHANCE_MAX, raw));
}

function defenceReduction(combatSkill) {
  const pct = Math.min(combatSkill * DEFENCE_SKILL_FACTOR, DEFENCE_CAP);
  return pct / 100;
}

function rpsMultiplier(attackerType, defenderType) {
  if (!attackerType || !defenderType) return RPS_NEUTRAL;
  const atk = attackerType.toLowerCase();
  const def = defenderType.toLowerCase();
  if (RPS_RULES[atk]?.strong === def) return RPS_ADVANTAGE;
  if (RPS_RULES[atk]?.weak === def) return RPS_DISADVANTAGE;
  return RPS_NEUTRAL;
}

function heroAttackSpeed(skillLevel) {
  const multiplier = 1 + (skillLevel * SKILL_SPEED_FACTOR);
  return Math.max(MIN_ATTACK_SPEED_MS, BASE_ATTACK_SPEED_MS / multiplier);
}

/**
 * Run a deterministic mock battle between a Standard Hero and an Enemy.
 *
 * @param {Object} enemy - Enemy entity from the CMS store
 * @param {Object} globals - Global constants (heroProfiles, healthGpValue, etc.)
 * @param {number|null} targetTier - Optional target tier override
 * @param {string|null} heroStyleToggle - Optional hero combat style override (Melee, Ranged, Magic)
 * @returns {Object} Combat diagnostics
 */
export function simulateCombat(enemy, globals, targetTier = null, heroStyleToggle = null) {
  const tierToUse = targetTier != null ? targetTier : (enemy.tier || 1);
  const heroProfile = globals.heroProfiles[tierToUse] || globals.heroProfiles[1];

  // --- Hero stats ---
  const heroCombatStat = heroProfile.combatStat;
  const heroHp = heroProfile.derivedHp;
  const heroAtkSkill = deriveAttackSkill(heroCombatStat);
  const heroDefSkill = deriveDefenceSkill(heroCombatStat);
  const heroAtkSpeed = heroAttackSpeed(heroCombatStat);

  // --- Enemy stats ---
  const enemyDmgRange = deriveDamageRange(enemy.combatStat || 1);
  const enemyAtkSkill = deriveAttackSkill(enemy.combatStat || 1);
  const enemyDefSkill = deriveDefenceSkill(enemy.combatStat || 1);
  const enemyAtkSpeed = enemy.attackSpeed || BASE_ATTACK_SPEED_MS;
  const enemyHp = enemy.hp || 10;

  // --- Mock battle: Hero combat style vs Enemy combat style ---
  const combatStyle = (heroStyleToggle || enemy.combatType || 'melee').toLowerCase();
  const enemyType = (enemy.combatType || 'melee').toLowerCase();

  // RPS Matchups (Option A: Shift stats before calculations)
  const heroRps = rpsMultiplier(combatStyle, enemyType);
  const enemyRps = rpsMultiplier(enemyType, combatStyle);

  let effectiveHeroAtk = heroAtkSkill;
  let effectiveEnemyDef = enemyDefSkill;
  if (heroRps > 1.0) {
    effectiveHeroAtk = Math.round(heroAtkSkill * 1.25);
    effectiveEnemyDef = Math.round(enemyDefSkill * 0.75);
  } else if (heroRps < 1.0) {
    effectiveHeroAtk = Math.round(heroAtkSkill * 0.75);
    effectiveEnemyDef = Math.round(enemyDefSkill * 1.25);
  }

  let effectiveEnemyAtk = enemyAtkSkill;
  let effectiveHeroDef = heroDefSkill;
  if (enemyRps > 1.0) {
    effectiveEnemyAtk = Math.round(enemyAtkSkill * 1.25);
    effectiveHeroDef = Math.round(heroDefSkill * 0.75);
  } else if (enemyRps < 1.0) {
    effectiveEnemyAtk = Math.round(enemyAtkSkill * 0.75);
    effectiveHeroDef = Math.round(heroDefSkill * 1.25);
  }

  // Derive Hero base damage range from element-scaled skill level
  const heroWeapon = deriveHeroWeaponRange(effectiveHeroAtk);

  // --- Hero → Enemy DPS ---
  const heroAvgDmg = (heroWeapon.min + heroWeapon.max) / 2;
  const heroHitPct = hitChance(effectiveHeroAtk, effectiveEnemyDef) / 100;
  const enemyDefRed = defenceReduction(effectiveEnemyDef);
  const heroEffectiveDmg = heroAvgDmg * heroHitPct * (1 - enemyDefRed);
  const heroAttacksPerSec = 1000 / heroAtkSpeed;
  const heroDps = heroEffectiveDmg * heroAttacksPerSec;

  // --- Enemy → Hero DPS ---
  const enemyAvgDmg = (enemyDmgRange.min + enemyDmgRange.max) / 2;
  const enemyHitPct = hitChance(effectiveEnemyAtk, effectiveHeroDef) / 100;
  const heroDefRed = defenceReduction(effectiveHeroDef);
  const enemyEffectiveDmg = enemyAvgDmg * enemyHitPct * (1 - heroDefRed);
  const enemyAttacksPerSec = 1000 / enemyAtkSpeed;
  const enemyDps = enemyEffectiveDmg * enemyAttacksPerSec;

  // --- Outcomes ---
  const timeToKill = heroDps > 0 ? enemyHp / heroDps : Infinity;
  const expectedDamageTaken = enemyDps * timeToKill;
  const healthCostGp = expectedDamageTaken * (globals.healthGpValue || 0.5);
  const canHeroSurvive = expectedDamageTaken < heroHp;

  // Kill through Food threat analysis (Average Hit Damage > 20% Max HP)
  const enemySingleHitDamage = enemyAvgDmg * (1 - heroDefRed);
  const isFoodKillThreat = enemySingleHitDamage > (heroHp * 0.20);

  return {
    // Hero readout
    heroDps: round2(heroDps),
    heroHitChance: round2(heroHitPct * 100),
    heroAttackSpeed: Math.round(heroAtkSpeed),
    heroAvgDamage: round2(heroEffectiveDmg),
    heroHp,

    // Enemy readout
    enemyDps: round2(enemyDps),
    enemyHitChance: round2(enemyHitPct * 100),
    enemyAttackSpeed: Math.round(enemyAtkSpeed),
    enemyAvgDamage: round2(enemyEffectiveDmg),
    enemyHp,

    // Outcome
    timeToKill: round2(timeToKill),
    expectedDamageTaken: round2(expectedDamageTaken),
    healthCostGp: round2(healthCostGp),
    combatDuration: Math.round(timeToKill * 1000), // in ms
    canHeroSurvive,
    rpsMultiplier: heroRps,
    combatStyle,
    isFoodKillThreat,
    enemySingleHitDamage: round2(enemySingleHitDamage)
  };
}

/**
 * Calculate the combat EV for an enemy encounter.
 * Cost = Health drain GP + Energy cost GP
 * Reward = Weighted loot value + XP value
 */
export function calculateCombatEV(enemy, items, globals) {
  const combat = simulateCombat(enemy, globals);

  // --- Cost side ---
  const healthCost = combat.healthCostGp;
  const heroAttacksToKill = combat.timeToKill / (combat.heroAttackSpeed / 1000);
  const rawEnergyCost = heroAttacksToKill * (globals.energyPerSwing || 1);
  const energyCost = rawEnergyCost * (globals.energyGpValue || 0.25);
  const totalCost = healthCost + energyCost;

  // --- Reward side ---
  let lootReward = 0;
  for (const drop of (enemy.drops || [])) {
    const item = items[drop.itemId];
    if (!item) continue;
    const avgQty = ((drop.minQty || 1) + (drop.maxQty || 1)) / 2;
    const chance = drop.chance ?? 1;
    lootReward += (item.trueCost || 0) * avgQty * chance;
  }

  const enemyXpAward = (enemy.combatStat || 1) * (globals.combatXpMultiplier || 1.0);
  const xpReward = enemyXpAward * (globals.xpToGoldRatio || 0.1);
  const totalReward = lootReward + xpReward;

  // --- EV ---
  const ev = totalCost > 0 ? totalReward / totalCost : 0;
  // 2-second respawn cooldown is added to TTK
  const combatsPerMinute = combat.timeToKill > 0 ? 60 / (combat.timeToKill + 2) : 0;
  const goldPerMinute = lootReward * combatsPerMinute;
  const xpPerMinute = enemyXpAward * combatsPerMinute;

  return {
    combat,
    cost: { healthCost: round2(healthCost), energyCost: round2(energyCost), total: round2(totalCost) },
    reward: { lootReward: round2(lootReward), xpReward: round2(xpReward), total: round2(totalReward) },
    calculatedEV: round2(ev),
    goldPerMinute: round2(goldPerMinute),
    xpPerMinute: round2(xpPerMinute),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
