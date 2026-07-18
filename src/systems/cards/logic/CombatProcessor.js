import { bumpCardRev } from '../CardManager.js';
import * as HeroManager from '../../hero/HeroManager.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { ModifierAggregator } from '../../effects/ModifierAggregator.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import * as StatusEffectSystem from '../../effects/StatusEffectSystem.js';
import { handleVictory } from './CombatResolutionProcessor.js';
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
            // Ephemeral loop cards aren't in any registry — write directly
            // (CR-028: the old CardManager route silently no-opped).
            card.status = 'idle';
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

    if (card.status === 'idle') {
        card.status = 'active';   // CR-028: direct write on the ephemeral card
        bumpCardRev(card);
    }

    // 1. Hero Attacks
    const heroStatsForUi = [];

    for (const heroId of assignedHeroIds) {
        const hero = HeroManager.getHero(heroId);
        if (!hero || hero.status === 'wounded') continue;

        if (hero.status !== 'combat') HeroManager.setHeroStatus(heroId, 'combat');
        if (!hero.aggregator) hero.aggregator = new ModifierAggregator(hero.id);

        combat.heroTickProcesses[heroId] = (combat.heroTickProcesses[heroId] || 0) + deltaTime;
        combat.heroTickProgress = combat.heroTickProcesses[heroId];

        // Combat style is determined by the equipped weapon (unarmed = melee)
        const combatStyle = CombatFormulas.getHeroCombatStyle(hero);
        const stats = combat.stats || {};
        const attackSpeed = stats.attackSpeed || CombatFormulas.HERO_ATTACK_INTERVAL_MS;
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

    // 3. Periodic enemy statuses (DoTs on the global 5s clock). A DoT tick
    // can finish the enemy off — that's a victory like any other.
    StatusEffectSystem.tickEnemyStatuses(card, deltaTime);
    if (card.combat.enemyHp.current <= 0 && card.status !== 'victory') {
        const firstHeroId = assignedHeroIds[0];
        const firstHero = HeroManager.getHero(firstHeroId);
        if (firstHero) handleVictory(card, firstHero, enemy, firstHeroId, assignedHeroIds);
    }
}
