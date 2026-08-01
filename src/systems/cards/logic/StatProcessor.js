import { getItem } from '../../../config/registries/itemRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { EFFECT_TYPES } from '../../effects/constants.js';
import { ModifierAggregator, applyThreeBucket } from '../../effects/ModifierAggregator.js';
import { resolveWorkTime } from '../../effects/TokenAxes.js';
import * as FormulaRegistry from '../../../config/FormulaRegistry.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import * as HeroManager from '../../hero/HeroManager.js';
import { getAreaAggregator } from '../../loop/AreaModifiers.js';
import { getGlobalAggregator } from '../../loop/GlobalModifiers.js';

/**
 * Main dispatcher for stat recalculation.
 * Scans traits and delegates to specialized calculators.
 */
export function recalculateCardStats(card) {
    if (!card || !card.traits) return;

    // Ensure Aggregator exists and is healthy
    if (!card.aggregator || typeof card.aggregator.collectMultipliers !== 'function') {
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
    let workRate = 1;
    const areaId = card.areaId || card.config?.areaId || 'area_guild_hall';

    try {
        // Three-Bucket (§15.3): every speed source below is a contribution to a
        // SHARED bucket, NOT a link in a multiplicative chain (roadmap F4).
        // Sources that are currently neutral contribute NOTHING — pushing a 1.0
        // (or a 0) would wrongly inflate a summed bucket.
        const multipliers = [];   // genuine ×N factors
        const percentages = [];   // fractions, 0.25 meaning "+25% work rate"

        // 1. Local Modifiers (from heroes, equipment, etc. assigned to this card)
        multipliers.push(...card.aggregator.collectMultipliers(EFFECT_TYPES.SPEED, trait.skill));
        percentages.push(...card.aggregator.collectPercentages(EFFECT_TYPES.SPEED, trait.skill));

        // 2. Area Modifiers (in-deck Boost auras, C-4). Contributes nothing for
        // areas with no aura running.
        const areaAgg = getAreaAggregator(areaId);
        multipliers.push(...areaAgg.collectMultipliers(EFFECT_TYPES.SPEED, trait.skill));
        percentages.push(...areaAgg.collectPercentages(EFFECT_TYPES.SPEED, trait.skill));

        // 2b. Global Modifiers (Outpost card auras, C-11/D-23). Pushed into the
        // SAME buckets rather than resolved separately and multiplied in: the
        // buckets sum, so two Smithies give +50% (§15.3). Resolving global and
        // area independently would compound them into ×1.5625 — exactly the
        // bug the three-bucket rule exists to prevent.
        const globalAgg = getGlobalAggregator();
        multipliers.push(...globalAgg.collectMultipliers(EFFECT_TYPES.SPEED, trait.skill));
        percentages.push(...globalAgg.collectPercentages(EFFECT_TYPES.SPEED, trait.skill));

        // 3. Tool. `toolSpeedMultiplier` returns a FACTOR (1.25), but a tool is
        // conceptually a percentage bonus to work rate, so it contributes
        // factor-1 to the percentage bucket. Two +25% sources then give +50%,
        // not ×2.5.
        if (card.assignedToolId) {
            const tool = getItem(card.assignedToolId);
            if (tool && tool.speedBonus) {
                const toolFactor = FormulaRegistry.toolSpeedMultiplier(tool.speedBonus);
                if (toolFactor !== 1) percentages.push(toolFactor - 1);
            }
        }

        // 4. Binder Mastery is NOT read here (C-19). It registers on the
        // area's aggregator, which step 2 already collects — one delivery path
        // for every area-scoped bonus instead of a bespoke second one.

        // 5. Resolve. Base work rate is 1 and sits inside the flat bucket; the
        // flat bucket has no other contributors until the Time axis lands in
        // Phase 5.
        workRate = applyThreeBucket(1, { multipliers, percentages });
    } catch (err) {
        console.error(`[StatProcessor] Workcycle failure on card ${card.id}:`, err);
        workRate = 1;
    }

    // Store for Engine/UI. Speed is the inverse of time, so a doubled work rate
    // halves the work time. A fully-cancelled bucket (clamped to 0) would mean
    // "never finishes" — hold it at the base time.
    const baseTime = card.baseTickTime || 10000;
    const speedAdjusted = workRate > 0 ? baseTime / workRate : baseTime;

    // Token WORK_TIME axis (§15.8, Phase 5): a Trawler's ×2 time or a Haste's
    // −20% applies on top of the speed-adjusted time, floored at 1s (§10). This
    // is a separate axis from SPEED — a stamped time penalty must not be read
    // as a speed change (it would invert). No-ops when no WORK_TIME tokens.
    card.currentTickTime = resolveWorkTime(card.aggregator, speedAdjusted);
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
