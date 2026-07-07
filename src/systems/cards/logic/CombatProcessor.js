import * as CardManager from '../CardManager.js';
import { bumpCardRev } from '../CardManager.js';
import * as HeroManager from '../../hero/HeroManager.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { ModifierAggregator } from '../../effects/ModifierAggregator.js';
import { handleVictory, checkAndConsumeFoodModular } from './CombatResolutionProcessor.js';
import { handleHeroAttack, processEnemyAttack } from './CombatAttackProcessor.js';

/**
 * Combat Module Processor
 */
export function processCombat(card, trait, deltaTime) {
    // Resolve Enemy
    const enemy = getEnemy(trait.enemyId || card.enemyId);
    if (!enemy) return;

    // Granular Namespace Initialization
    const combat = card.combat || {};
    card.combat = combat; // Assign back if created

    if (!combat.enemyHp) combat.enemyHp = { current: enemy.hp, max: enemy.hp };
    if (!combat.state) combat.state = { intermissionTimer: 0 };
    if (!combat.heroTickProcesses) combat.heroTickProcesses = {};
    if (!combat.stats) combat.stats = {};

    const heroId = card.assignedHeroId;
    if (!heroId) {
        let changed = false;
        if (card.status !== 'idle') {
            CardManager.setCardStatus(card.id, 'idle');
            changed = true;
        }
        if (combat.enemyHp && combat.enemyHp.current !== combat.enemyHp.max) {
            combat.enemyHp.current = combat.enemyHp.max;
            changed = true;
        }
        if (combat.enemyTickProgress !== 0) {
            combat.enemyTickProgress = 0;
            changed = true;
        }
        if (Object.keys(combat.heroTickProcesses || {}).length > 0) {
            combat.heroTickProcesses = {};
            changed = true;
        }
        if (changed) {
            bumpCardRev(card);
        }
        return;
    }

    const assignedHeroIds = [heroId];

    // Intermission Timer
    if (combat.state.intermissionTimer > 0) {
        combat.state.intermissionTimer -= deltaTime;
        if (combat.state.intermissionTimer <= 0) {
            combat.state.intermissionTimer = 0;
            combat.enemyHp = { current: enemy.hp, max: enemy.hp };
            card.status = 'active';
            bumpCardRev(card);
        }
        return;
    }

    if (card.status === 'idle') CardManager.setCardStatus(card.id, 'active');

    // 1. Hero Attacks
    const heroStatsForUi = [];

    for (const heroId of assignedHeroIds) {
        const hero = HeroManager.getHero(heroId);
        if (!hero || hero.status === 'wounded') continue;

        if (hero.status !== 'combat') HeroManager.setHeroStatus(heroId, 'combat');
        if (!hero.aggregator) hero.aggregator = new ModifierAggregator(hero.id);

        // Auto-consume Check
        if (checkAndConsumeFoodModular(card, hero)) {
            heroStatsForUi.push({ id: hero.id, hp: hero.hp, energy: hero.energy, progress: 0, attackSpeed: 3000, isConsuming: true });
            continue;
        }

        combat.heroTickProcesses[heroId] = (combat.heroTickProcesses[heroId] || 0) + deltaTime;
        combat.heroTickProgress = combat.heroTickProcesses[heroId];

        const heroClass = HeroManager.getHeroClass(heroId);
        const combatStyle = heroClass?.combatStyle || 'melee';
        const stats = combat.stats || {};
        const attackSpeed = stats.attackSpeed || 3000;
        combat.heroAttackSpeed = attackSpeed;

        heroStatsForUi.push({
            id: hero.id,
            hp: hero.hp,
            energy: hero.energy,
            progress: combat.heroTickProcesses[heroId],
            attackSpeed: attackSpeed,
            isFleeing: card.isFleeing
        });

        if (!card.isFleeing && combat.heroTickProcesses[heroId] >= attackSpeed) {
            handleHeroAttack(card, hero, enemy, combatStyle, attackSpeed);
            if (combat.enemyHp.current <= 0) {
                handleVictory(card, hero, enemy, heroId, assignedHeroIds);
                return;
            }
        }
    }

    // 2. Enemy Attacks
    processEnemyAttack(card, enemy, assignedHeroIds, deltaTime);
}
