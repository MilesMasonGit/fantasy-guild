import { logger } from '../../../utils/Logger.js';
import { EventBus } from '../../core/EventBus.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import * as CardManager from '../../cards/CardManager.js';
import * as HeroManager from '../../hero/HeroManager.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import { SurvivalSystem } from '../SurvivalSystem.js';
import { EFFECT_TYPES } from '../../effects/constants.js';
import * as AttackProcessor from './CombatAttackProcessor.js';
import * as ResolutionProcessor from './CombatResolutionProcessor.js';

/**
 * Combat Tick: High-frequency timing and attack cycle management.
 */

export function processCombatTick(card, deltaTime) {
    const hero = HeroManager.getHero(card.assignedHeroId);
    const enemy = getEnemy(card.enemyId);
    if (!hero || !enemy) return;

    // 1. Guard: Check for Wounded State
    if (hero.status === 'wounded') {
        CardManager.unassignHero(card.id);
        return;
    }

    // 2. State Prep
    if (hero.status !== 'combat') {
        HeroManager.setHeroStatus(hero.id, 'combat');
        card.status = 'active';
    }

    // 3. Maintenance (Auto-consume items)
    SurvivalSystem.processAutoConsume(hero);

    // 4. Intermission Handling (Post-fight pause)
    if (card.combatState.intermissionTimer > 0) {
        handleIntermission(card, deltaTime);
        return;
    }

    // 5. Preparation & Speed
    const selectedStyle = card.selectedStyle || 'melee';
    const speedMultiplier = hero.aggregator.getMultiplier(EFFECT_TYPES.SPEED, selectedStyle.toUpperCase());
    const flatHaste = hero.aggregator.query('HASTE') || 0; // HASTE flat ms adjustment
    const heroAttackSpeed = CombatFormulas.clamp(
        CombatFormulas.BASE_ATTACK_SPEED_MS * (speedMultiplier || 1) + flatHaste,
        CombatFormulas.MIN_ATTACK_SPEED_MS,
        10000
    );

    // 6. Hero Attack Cycle
    card.heroTickProgress += deltaTime;
    if (!card.isFleeing && card.heroTickProgress >= heroAttackSpeed) {
        // LIGHT modifier reduces energy cost by 10% per level
        const lightPct = hero.aggregator.query('LIGHT') || 0;
        const energyCost = Math.max(1, Math.round((enemy.energyCost ?? 2) * (1 - lightPct)));
        
        if (hero.energy.current >= energyCost) {
            HeroManager.modifyHeroEnergy(hero.id, -energyCost);
            AttackProcessor.processHeroAttack(card, hero, enemy);
            card.heroTickProgress = 0;

            if (card.enemyHp.current <= 0) {
                ResolutionProcessor.handleVictory(card, hero, enemy);
                return;
            }
        }
    }

    // 7. Enemy Attack Cycle
    card.enemyTickProgress += deltaTime;
    // SLOW_ENEMY modifier adds flat milliseconds of hit lag/stun to enemy attacks
    const slowVal = hero.aggregator.query('SLOW_ENEMY') || 0;
    const targetEnemyAttackSpeed = Math.max(500, (enemy.attackSpeed || 3000) + slowVal);
    
    if (card.enemyTickProgress >= targetEnemyAttackSpeed) {
        AttackProcessor.processEnemyAttack(card, hero, enemy);
        card.enemyTickProgress = 0;

        if (hero.hp.current <= 0) {
            ResolutionProcessor.handleDefeat(card, hero, enemy);
            return;
        }
    }

}

function handleIntermission(card, deltaTime) {
    card.combatState.intermissionTimer -= deltaTime;
    if (card.combatState.intermissionTimer <= 0) {
        card.combatState.intermissionTimer = 0;
        CardManager.resetCombatCard(card.id);
    }
}
