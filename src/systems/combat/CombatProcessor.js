import { bumpFightRev } from './FightRevision.js';
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
    if (!combat.stats) combat.stats = {};

    const heroId = fight.assignedHeroId;
    if (!heroId) {
        let changed = false;
        if (fight.status !== 'idle') {
            // Ephemeral fight objects aren't in any registry, so write directly.
            fight.status = 'idle';
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
            bumpFightRev(fight);
        }
        return;
    }

    const assignedHeroIds = [heroId];

    if (combat.state.intermissionTimer > 0) {
        combat.state.intermissionTimer -= deltaTime;
        if (combat.state.intermissionTimer <= 0) {
            combat.state.intermissionTimer = 0;
            combat.enemyHp = { current: enemy.hp, max: enemy.hp };
            fight.status = 'active';
            bumpFightRev(fight);
        }
        return;
    }

    if (fight.status === 'idle') {
        fight.status = 'active';
        bumpFightRev(fight);
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

        // Style comes from the equipped weapon; unarmed falls back to the hero's combat skill.
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
            isFleeing: fight.isFleeing
        });

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
