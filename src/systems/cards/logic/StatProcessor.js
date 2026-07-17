import { getItem } from '../../../config/registries/itemRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { EFFECT_TYPES } from '../../effects/constants.js';
import { ModifierAggregator } from '../../effects/ModifierAggregator.js';
import * as FormulaRegistry from '../../../config/FormulaRegistry.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import { MasterySystem } from '../../progression/MasterySystem.js';
import * as CardManager from '../CardManager.js';
import * as HeroManager from '../../hero/HeroManager.js';
import { getAreaAggregator } from '../../loop/AreaModifiers.js';

/**
 * Main dispatcher for stat recalculation.
 * Scans traits and delegates to specialized calculators.
 */
export function recalculateCardStats(card) {
    if (!card || !card.traits) return;

    // Ensure Aggregator exists and is healthy
    if (!card.aggregator || typeof card.aggregator.getMultiplier !== 'function') {
        card.aggregator = new ModifierAggregator(card.id);
    }

    // Process all traits that contribute to stats
    for (const trait of card.traits) {
        switch (trait.type.toLowerCase()) {
            case 'workcycle':
                calculateWorkcycleStats(card, trait);
                break;
            case 'combat':
                calculateCombatStats(card, trait);
                break;
        }
    }
}

/**
 * Calculate Workcycle (Speed/Labor) stats
 */
function calculateWorkcycleStats(card, trait) {
    let effectiveMultiplier = 1;
    const areaId = card.areaId || card.config?.areaId || 'area_guild_hall';

    try {
        // 1. Local Modifiers (from heroes, equipment, etc. assigned to this card)
        const localMult = card.aggregator.getMultiplier(EFFECT_TYPES.SPEED, trait.skill);

        // 2. Area Modifiers (station passive buffs, Phase 4 §4G). Empty for
        // areas without buff stations, so this resolves to 1.0 unless a
        // buff is actually registered.
        const areaMult = getAreaAggregator(areaId).getMultiplier(EFFECT_TYPES.SPEED, trait.skill);

        // 3. Tool Multiplier
        let toolMult = 1.0;
        if (card.assignedToolId) {
            const tool = getItem(card.assignedToolId);
            if (tool && tool.speedBonus) {
                toolMult = FormulaRegistry.toolSpeedMultiplier(tool.speedBonus);
            }
        }

        // 4. Mastery Multiplier (Worktime Reduction)
        const masteryBonuses = MasterySystem.getEffectiveBonuses({
            areaId,
            skill: trait.skill,
            subskill: trait.subskill
        });
        
        const masterySpeedMult = 1 / (1 - Math.min(0.9, masteryBonuses.speedReduction || 0));

        // 5. Overall Multiplier
        effectiveMultiplier = localMult * areaMult * toolMult * masterySpeedMult;
    } catch (err) {
        console.error(`[StatProcessor] Workcycle failure on card ${card.id}:`, err);
        effectiveMultiplier = 1;
    }
    
    // Store for Engine/UI
    const baseTime = card.baseTickTime || 10000;
    card.currentTickTime = baseTime / effectiveMultiplier;
}

/**
 * Calculate Combat (Damage/Speed/Accuracy) stats
 */
function calculateCombatStats(card, trait) {
    // Ensure namespace exists safely
    card.combat = card.combat || {};
    card.combat.stats = card.combat.stats || {};

    const heroId = card.assignedHeroId;
    const hero = heroId ? HeroManager.getHero(heroId) : null;
    const enemy = getEnemy(trait.enemyId || card.enemyId);

    // Default Stats (Unarmed/Baseline) — 7-stat engine pass
    const stats = {
        attackSpeed: FormulaRegistry.HERO_ATTACK_INTERVAL_MS,
        damageBonus: 0,
        defenseBonus: 0,
        accuracy: FormulaRegistry.BASE_HIT_CHANCE
    };

    if (hero) {
        // Combat style comes from the equipped weapon (unarmed = melee)
        const combatStyle = CombatFormulas.getHeroCombatStyle(hero);
        const heroSkillLevel = hero.skills?.[combatStyle]?.level ?? 1;

        // 1. Speed — fixed interval this pass (weapon archetypes later)
        stats.attackSpeed = FormulaRegistry.HERO_ATTACK_INTERVAL_MS;

        // 2. Damage & Defense Bonuses (Additive from internal and external modifiers)
        stats.damageBonus = hero.aggregator?.query(EFFECT_TYPES.DAMAGE) || 0;
        stats.defenseBonus = hero.aggregator?.query(EFFECT_TYPES.DEFENSE) || 0;

        // 3. Accuracy preview vs this enemy (full pipeline incl. RPS)
        if (enemy) {
            stats.accuracy = CombatFormulas.calculateHitChance(
                heroSkillLevel, enemy.defenceSkill || 1,
                combatStyle, enemy.combatType || 'melee',
                hero, enemy
            );
        }
    }

    // Inject into namespace
    card.combat.stats = stats;
    
    // Maintain legacy root properties for existing UI fallbacks during migration
    card.heroAttackSpeed = stats.attackSpeed; 
}

/**
 * Recalculate stats for all active cards.
 */
export function recalculateAllCardStats() {
    const activeCards = CardManager.getActiveCards();
    for (const card of activeCards) {
        recalculateCardStats(card);
    }
}
