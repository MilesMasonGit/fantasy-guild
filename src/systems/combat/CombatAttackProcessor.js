import * as HeroManager from '../hero/HeroManager.js';
import { EventBus } from '../core/EventBus.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getPrimaryWeapon } from '../../config/registries/equipmentConstants.js';
import { handleHeroWounded } from './CombatResolutionProcessor.js';
import * as ConsumptionSystem from '../hero/ConsumptionSystem.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Roll `statusOnHit` entries (on enemies or weapons):
 * { statusId, chance (0-1), stacks } or an array of them.
 */
function rollStatusOnHit(source, applyFn) {
    if (!source?.statusOnHit) return;
    const entries = Array.isArray(source.statusOnHit) ? source.statusOnHit : [source.statusOnHit];
    for (const entry of entries) {
        if (!entry?.statusId) continue;
        if (Math.random() < (entry.chance ?? 1)) {
            applyFn(entry.statusId, entry.stacks ?? 1);
        }
    }
}

/**
 * No energy cost in combat: HP/food is the attrition currency.
 *
 * `combat_hero_attack` names the enemy Token (`instanceId`) so the mat can
 * route a landed hit's knockback to it.
 */

export function handleHeroAttack(fight, hero, enemy, combatStyle, attackSpeed) {
    // Eating mid-fight: the hero skips this attack while the enemy's timer keeps
    // running, so the enemy gets a free swing. That price keeps HP management
    // tense. Uncapped on purpose: a hero who can't out-heal the damage should lose.
    const meal = ConsumptionSystem.tryEat(hero.id);
    if (meal) {
        EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATE, {
            cardId: fight.id, heroId: hero.id, itemId: meal.itemId, healed: meal.amount
        });
        fight.combat.heroTickProcesses[hero.id] -= attackSpeed;
        return;
    }

    const weaponId = getPrimaryWeapon(hero);
    const weapon = weaponId ? getItem(weaponId) : null;

    // Stun check: the attempt itself spends a stack, success or failure.
    if (StatusEffectSystem.rollAttackFailure(hero.statuses)) {
        EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATTACK, { cardId: fight.id, instanceId: fight.instanceId, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false, stunned: true, enemyHpRemaining: fight.combat.enemyHp.current });
        fight.combat.heroTickProcesses[hero.id] -= attackSpeed;
        return;
    }

    const stats = fight.combat?.stats || {};
    const damageBonus = (stats.damageBonus || 0) + (hero?.aggregator?.query('DAMAGE') || 0);
    const heroSkill = CombatFormulas.getHeroCombatSkill(hero, combatStyle);

    const didHit = CombatFormulas.rollHit(
        heroSkill, enemy.defenceSkill,
        combatStyle, enemy.combatType || 'melee',
        hero, enemy
    );

    if (didHit) {
        const damage = CombatFormulas.computeHeroDamage(hero, enemy, weapon, damageBonus, combatStyle, fight.combat.enemyStatuses);
        fight.combat.enemyHp.current = Math.max(0, fight.combat.enemyHp.current - damage);

        rollStatusOnHit(weapon, (statusId, stacks) => StatusEffectSystem.applyToEnemy(fight, statusId, stacks));
        StatusEffectSystem.notifyHitTaken(fight.combat.enemyStatuses);

        if (enemy.traits) {
            const thorns = enemy.traits.find(t => t.id === 'thorns');
            if (thorns) {
                const reflex = thorns.level || 1;
                HeroManager.modifyHeroHp(hero.id, -reflex);
                EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_TRAIT_TRIGGER, { cardId: fight.id, heroId: hero.id, traitId: 'thorns', damage: reflex });
            }
        }
        EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATTACK, { cardId: fight.id, instanceId: fight.instanceId, heroId: hero.id, enemyId: enemy.id, damage, hit: true, enemyHpRemaining: fight.combat.enemyHp.current });
    } else {
        EventBus.publish(ENGINE_EVENTS.COMBAT_HERO_ATTACK, { cardId: fight.id, instanceId: fight.instanceId, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false, enemyHpRemaining: fight.combat.enemyHp.current });
    }

    // Carry the overshoot instead of resetting; a reset would quantize every
    // attack up to a whole engine tick.
    fight.combat.heroTickProcesses[hero.id] -= attackSpeed;
}

export function processEnemyAttack(fight, enemy, assignedHeroIds, deltaTime) {
    if (!fight.combat) return;
    fight.combat.enemyTickProgress += deltaTime;
    const enemyAttackSpeed = enemy.attackSpeed || CombatFormulas.ENEMY_ATTACK_INTERVAL_MS;
    fight.combat.enemyAttackSpeed = enemyAttackSpeed; // persisted for UI attack-loop bars

    if (fight.combat.enemyTickProgress >= enemyAttackSpeed) {
        const targetHeroId = assignedHeroIds[Math.floor(Math.random() * assignedHeroIds.length)];
        const targetHero = HeroManager.getHero(targetHeroId);

        if (targetHero && targetHero.status !== 'wounded') {
            // Stun check for the enemy: the attempt spends a stack either way.
            if (StatusEffectSystem.rollAttackFailure(fight.combat.enemyStatuses)) {
                EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, { cardId: fight.id, heroId: targetHeroId, enemyId: enemy.id, damage: 0, hit: false, stunned: true, heroHpRemaining: targetHero.hp.current });
                fight.combat.enemyTickProgress -= enemyAttackSpeed;
                return;
            }

            const heroStyle = CombatFormulas.getHeroCombatStyle(targetHero);
            const heroDefense = CombatFormulas.getHeroDefenseSkill(targetHero);

            const didHit = CombatFormulas.rollHit(
                enemy.attackSkill, heroDefense,
                enemy.combatType || 'melee', heroStyle,
                enemy, targetHero
            );

            if (didHit) {
                const dmg = CombatFormulas.computeEnemyDamage(enemy, targetHero, heroStyle);
                HeroManager.modifyHeroHp(targetHeroId, -dmg);

                rollStatusOnHit(enemy, (statusId, stacks) => StatusEffectSystem.applyToHero(targetHeroId, statusId, stacks));
                StatusEffectSystem.notifyHitTaken(targetHero.statuses);

                EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, { cardId: fight.id, heroId: targetHeroId, enemyId: enemy.id, damage: dmg, hit: true, heroHpRemaining: targetHero.hp.current });

                if (targetHero.hp.current <= 0) {
                    handleHeroWounded(fight, targetHeroId);
                }
            } else {
                EventBus.publish(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, { cardId: fight.id, heroId: targetHeroId, enemyId: enemy.id, damage: 0, hit: false, heroHpRemaining: targetHero.hp.current });
            }

        }
        // Carry the overshoot instead of resetting.
        fight.combat.enemyTickProgress -= enemyAttackSpeed;
    }
}
