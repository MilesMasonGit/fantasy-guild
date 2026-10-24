import * as HeroManager from '../hero/HeroManager.js';
import { ModifierAggregator } from '../effects/ModifierAggregator.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import { handleVictory } from './CombatResolutionProcessor.js';
import { handleHeroAttack, processEnemyAttack, checkHealth } from './CombatAttackProcessor.js';
import { resetTallies } from './FightHooks.js';

/** Whether the hero is still in the fight. */
const standing = (hero) => !!hero && hero.status !== 'wounded';

/** Advance one fight by `deltaTime`: hero attacks, then the enemy's. */
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
            // A fresh enemy is a fresh fight: its swings and hits count from one again.
            resetTallies(fight);
            fight.status = 'active';
        }
        return;
    }

    if (fight.status === 'idle') fight.status = 'active';

    // Something outside a swing (a status tick, a rule) may have finished the enemy since the last
    // tick: that is a kill like any other, before anyone swings at a creature already at 0.
    const first = HeroManager.getHero(heroId);
    if (combat.enemyHp.current <= 0) {
        if (standing(first)) handleVictory(fight, first, enemy, heroId, assignedHeroIds);
        return;
    }
    // ...and either side's health may have fallen past an "On Health Below" rule.
    if (standing(first)) checkHealth(fight, first);

    // 1. Hero Attacks
    for (const heroId of assignedHeroIds) {
        const hero = HeroManager.getHero(heroId);
        if (!standing(hero)) continue;

        if (hero.status !== 'combat') HeroManager.setHeroStatus(heroId, 'combat');
        if (!hero.aggregator) hero.aggregator = new ModifierAggregator(hero.id);

        combat.heroTickProcesses[heroId] = (combat.heroTickProcesses[heroId] || 0) + deltaTime;

        // The weapon sets the pace: fast 2 s, normal 3 s, slow 4 s (barehanded: normal).
        const attackSpeed = CombatFormulas.heroAttackSpeedMs(hero);

        if (!fight.isFleeing && combat.heroTickProcesses[heroId] >= attackSpeed) {
            handleHeroAttack(fight, hero, enemy, attackSpeed);
            if (combat.enemyHp.current <= 0) {
                if (standing(hero)) handleVictory(fight, hero, enemy, heroId, assignedHeroIds);
                return;
            }
        }
    }

    // 2. Enemy Attacks
    processEnemyAttack(fight, enemy, assignedHeroIds, deltaTime);

    // 3. A rule fired by the enemy's swing (the hero's On Health Below, say) may have finished the
    // enemy: a victory like any other.
    if (combat.enemyHp.current <= 0 && fight.status !== 'victory') {
        const firstHero = HeroManager.getHero(assignedHeroIds[0]);
        if (standing(firstHero)) handleVictory(fight, firstHero, enemy, assignedHeroIds[0], assignedHeroIds);
    }
}
