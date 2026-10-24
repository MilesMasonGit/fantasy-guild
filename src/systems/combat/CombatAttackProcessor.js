import * as HeroManager from '../hero/HeroManager.js';
import { EventBus } from '../core/EventBus.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import * as LiveEffects from '../effects/LiveEffects.js';
import { handleHeroWounded } from './CombatResolutionProcessor.js';
import * as ConsumptionSystem from '../hero/ConsumptionSystem.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { FIGHT_MOMENT } from '../../config/registries/triggerRegistry.js';
import { SIDE, fightMoment, talliesOf } from './FightHooks.js';

/**
 * HP and food are combat's attrition currency.
 *
 * `combat_hero_attack` names the enemy Token (`instanceId`) so the mat can
 * route a landed hit's knockback to it. Every swing publishes `hit` and `crit`, so a miss and a
 * crit can be shown.
 *
 * Each swing runs the fight moments in a fixed order, so a catch-up draws the same random numbers
 * as live play: the swinger's On Swing rules (before the roll, so they can shape it), the miss and
 * crit roll, the damage, then, on a hit that leaves the other side standing, the swinger's On Hit
 * rules. Whatever was carried "for the swing" comes off, and On Health Below is checked.
 */

/** Whether a hero is out of the fight: knocked out, or at 0 HP. */
function isDown(hero) {
    return !hero || hero.status === 'wounded' || (hero.hp?.current ?? 0) <= 0;
}

/** The swing is over: whatever either fighter carried "for the swing" comes off. */
function endSwing(fight, hero) {
    LiveEffects.endSwingEffects(fight);
    LiveEffects.endSwingEffects(hero);
}

/**
 * Run "On Health Below" for each side whose health has fallen since it was last seen (or that has
 * not been seen yet this fight). A side at 0 is out of the fight and runs nothing.
 */
export function checkHealth(fight, hero) {
    const tallies = talliesOf(fight);
    const seen = tallies.seenHp;

    const enemyHp = fight.combat?.enemyHp?.current ?? 0;
    if (enemyHp > 0 && (seen.enemy == null || enemyHp < seen.enemy)) {
        seen.enemy = enemyHp;
        fightMoment(fight, SIDE.ENEMY, FIGHT_MOMENT.HP_BELOW);
    } else {
        seen.enemy = enemyHp;
    }

    const heroHp = hero?.hp?.current ?? 0;
    if (!isDown(hero) && (seen.hero == null || heroHp < seen.hero)) {
        seen.hero = heroHp;
        fightMoment(fight, SIDE.HERO, FIGHT_MOMENT.HP_BELOW);
    } else {
        seen.hero = heroHp;
    }
}

export function handleHeroAttack(fight, hero, enemy, attackSpeed) {
    // Eating mid-fight: the hero skips this attack while the enemy's timer keeps
    // running, so the enemy gets a free swing. That price keeps HP management
    // tense. Uncapped on purpose: a hero who can't out-heal the damage should lose. Only food
    // heals in a fight; an equipped drink is left alone.
    const meals = ConsumptionSystem.tryEat(hero.id, { inFight: true });
    if (meals.length) {
        for (const meal of meals) {
            EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATE, {
                cardId: fight.id, heroId: hero.id, itemId: meal.itemId, healed: meal.amount
            });
        }
        fight.combat.heroTickProcesses[hero.id] -= attackSpeed;
        return;
    }

    const tallies = talliesOf(fight);
    tallies.swings.hero += 1;
    fightMoment(fight, SIDE.HERO, FIGHT_MOMENT.SWING, tallies.swings.hero);

    // A rule on the swing may have ended the fight before the blow: either side may have fallen.
    if (!isDown(hero) && fight.combat.enemyHp.current > 0) {
        const swing = CombatFormulas.rollSwing(
            CombatFormulas.heroMissChance(hero, enemy),
            CombatFormulas.heroCritChance(hero)
        );

        if (swing.hit) {
            const damage = CombatFormulas.heroHitDamage(hero, enemy, { crit: swing.crit });
            fight.combat.enemyHp.current = Math.max(0, fight.combat.enemyHp.current - damage);

            if (enemy.traits) {
                const thorns = enemy.traits.find(t => t.id === 'thorns');
                if (thorns) {
                    const reflex = thorns.level || 1;
                    HeroManager.modifyHeroHp(hero.id, -reflex);
                    EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_TRAIT_TRIGGER, { cardId: fight.id, heroId: hero.id, traitId: 'thorns', damage: reflex });
                }
            }
            EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATTACK, { cardId: fight.id, instanceId: fight.instanceId, heroId: hero.id, enemyId: enemy.id, damage, hit: true, crit: swing.crit, enemyHpRemaining: fight.combat.enemyHp.current });

            if (fight.combat.enemyHp.current > 0 && !isDown(hero)) {
                tallies.hits.hero += 1;
                fightMoment(fight, SIDE.HERO, FIGHT_MOMENT.HIT, tallies.hits.hero);
            }
        } else {
            EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATTACK, { cardId: fight.id, instanceId: fight.instanceId, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false, crit: false, enemyHpRemaining: fight.combat.enemyHp.current });
        }
    }

    endSwing(fight, hero);
    if (!isDown(hero)) checkHealth(fight, hero);

    // Carry the overshoot instead of resetting; a reset would quantize every
    // attack up to a whole engine tick.
    fight.combat.heroTickProcesses[hero.id] -= attackSpeed;
}

/** One enemy swing at a hero who is still standing. */
function enemySwing(fight, enemy, hero) {
    const tallies = talliesOf(fight);
    tallies.swings.enemy += 1;
    fightMoment(fight, SIDE.ENEMY, FIGHT_MOMENT.SWING, tallies.swings.enemy);

    if (!isDown(hero) && fight.combat.enemyHp.current > 0) {
        const swing = CombatFormulas.rollSwing(
            CombatFormulas.enemyMissChance(enemy, hero),
            CombatFormulas.enemyCritChance(enemy)
        );

        if (swing.hit) {
            const dmg = CombatFormulas.enemyHitDamage(enemy, hero, { crit: swing.crit });
            HeroManager.modifyHeroHp(hero.id, -dmg);

            EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, { cardId: fight.id, heroId: hero.id, enemyId: enemy.id, damage: dmg, hit: true, crit: swing.crit, heroHpRemaining: hero.hp.current });

            if (hero.hp.current <= 0) {
                handleHeroWounded(fight, hero.id);
            } else {
                // Where a Venomous enemy's poison lands, and a boss's status attack.
                tallies.hits.enemy += 1;
                fightMoment(fight, SIDE.ENEMY, FIGHT_MOMENT.HIT, tallies.hits.enemy);
            }
        } else {
            EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, { cardId: fight.id, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false, crit: false, heroHpRemaining: hero.hp.current });
        }
    }

    endSwing(fight, hero);
    if (!isDown(hero)) checkHealth(fight, hero);
}

export function processEnemyAttack(fight, enemy, assignedHeroIds, deltaTime) {
    if (!fight.combat) return;
    fight.combat.enemyTickProgress += deltaTime;
    const enemyAttackSpeed = CombatFormulas.enemyAttackSpeedMs(enemy);

    if (fight.combat.enemyTickProgress >= enemyAttackSpeed) {
        const targetHeroId = assignedHeroIds[Math.floor(Math.random() * assignedHeroIds.length)];
        const targetHero = HeroManager.getHero(targetHeroId);

        if (targetHero && targetHero.status !== 'wounded') enemySwing(fight, enemy, targetHero);

        // Carry the overshoot instead of resetting.
        fight.combat.enemyTickProgress -= enemyAttackSpeed;
    }
}
