import * as HeroManager from '../hero/HeroManager.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
import { handleVictory } from './CombatResolutionProcessor.js';
import { handleHeroAttack, processEnemyAttack } from './CombatAttackProcessor.js';

/** Advance one fight by `deltaTime`: hero attacks, enemy attack, enemy DoTs. */
export function processCombat(fight, trait, deltaTime) {
    // The stat block is carried on the fight, not looked up by id: `trait.enemy`
    // is the per-tick handoff, `fight.enemy` the stored copy the intermission
    // respawn reads.
    const enemy = trait?.enemy || fight.enemy;
    if (!enemy) return;

    const combat = fight.combat || {};
    fight.combat = combat;

    if (!combat.enemyHp) combat.enemyHp = { current: enemy.hp, max: enemy.hp };
    if (!combat.state) combat.state = { intermissionTimer: 0 };
    if (!combat.heroTickProcesses) combat.heroTickProcesses = {};

    const heroId = fight.assignedHeroId;
    if (!heroId) {
        // Ephemeral fight objects aren't in any registry, so write directly.
        fight.status = 'idle';
        if (combat.enemyHp) combat.enemyHp.current = combat.enemyHp.max;
        combat.enemyTickProgress = 0;
        if (Object.keys(combat.heroTickProcesses || {}).length > 0) combat.heroTickProcesses = {};
        return;
    }

    const assignedHeroIds = [heroId];

    if (combat.state.intermissionTimer > 0) {
        combat.state.intermissionTimer -= deltaTime;
        if (combat.state.intermissionTimer <= 0) {
            combat.state.intermissionTimer = 0;
            combat.enemyHp = { current: enemy.hp, max: enemy.hp };
            fight.status = 'active';
        }
        return;
    }

    if (fight.status === 'idle') fight.status = 'active';

    // 1. Hero Attacks
    for (const heroId of assignedHeroIds) {
        const hero = HeroManager.getHero(heroId);
        if (!hero || hero.status === 'wounded') continue;

        if (hero.status !== 'combat') HeroManager.setHeroStatus(heroId, 'combat');
        if (!hero.aggregator) hero.aggregator = new ModifierAggregator(hero.id);

        combat.heroTickProcesses[heroId] = (combat.heroTickProcesses[heroId] || 0) + deltaTime;

        // Style comes from the equipped weapon; unarmed falls back to the hero's combat skill.
        const combatStyle = CombatFormulas.getHeroCombatStyle(hero);
        const attackSpeed = CombatFormulas.HERO_ATTACK_INTERVAL_MS;

        if (!fight.isFleeing && combat.heroTickProcesses[heroId] >= attackSpeed) {
            handleHeroAttack(fight, hero, enemy, combatStyle, attackSpeed);
            if (combat.enemyHp.current <= 0) {
                handleVictory(fight, hero, enemy, heroId, assignedHeroIds);
                return;
            }
        }
    }

    // 2. Enemy Attacks
    processEnemyAttack(fight, enemy, assignedHeroIds, deltaTime);

    // 3. Periodic enemy statuses. A DoT tick can finish the enemy off, which is a victory like any other.
    StatusEffectSystem.tickEnemyStatuses(fight, deltaTime);
    if (fight.combat.enemyHp.current <= 0 && fight.status !== 'victory') {
        const firstHeroId = assignedHeroIds[0];
        const firstHero = HeroManager.getHero(firstHeroId);
        if (firstHero) handleVictory(fight, firstHero, enemy, firstHeroId, assignedHeroIds);
    }
}
