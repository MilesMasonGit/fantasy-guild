import * as HeroManager from '../hero/HeroManager.js';
import { EventBus } from '../core/EventBus.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getPrimaryWeapon } from '../../config/registries/equipmentConstants.js';
import { handleHeroWounded } from './CombatResolutionProcessor.js';
import * as ConsumptionSystem from '../hero/ConsumptionSystem.js';

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
 * Live combat attack handlers (7-stat engine pass, combat_formula_spec.md §7).
 * No energy cost in combat (owner-locked F4) — HP/food is the attrition currency.
 */

export function handleHeroAttack(fight, hero, enemy, combatStyle, attackSpeed) {
    // Eating mid-fight (D-27): the hero stops to eat while the fight carries
    // on, so this attack never happens and the enemy — whose own timer is
    // untouched — effectively gets a free swing. That price is what keeps HP
    // management tense and makes Rest cards and healing worth building for.
    //
    // Uncapped by design (D-31): no cooldown, no per-fight limit. A hero who
    // can't out-heal the damage is meant to lose.
    const meal = ConsumptionSystem.tryEat(hero.id);
    if (meal) {
        EventBus.publish('combat_hero_ate', {
            cardId: fight.id, heroId: hero.id, itemId: meal.itemId, healed: meal.amount
        });
        fight.combat.heroTickProcesses[hero.id] -= attackSpeed;
        return;
    }

    const weaponId = getPrimaryWeapon(hero);
    const weapon = weaponId ? getItem(weaponId) : null;

    // Stun check: the attempt itself spends a stack, success or failure.
    if (StatusEffectSystem.rollAttackFailure(hero.statuses)) {
        EventBus.publish('combat_hero_attack', { cardId: fight.id, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false, stunned: true, enemyHpRemaining: fight.combat.enemyHp.current });
        fight.combat.heroTickProcesses[hero.id] -= attackSpeed;
        return;
    }

    const stats = fight.combat?.stats || {};
    const damageBonus = stats.damageBonus || 0;
    const heroSkill = CombatFormulas.getHeroCombatSkill(hero, combatStyle);

    // Hit roll (§7 step 2): attacker style skill vs the enemy's Defense (= its level)
    const didHit = CombatFormulas.rollHit(
        heroSkill, enemy.defenceSkill,
        combatStyle, enemy.combatType || 'melee',
        hero, enemy
    );

    if (didHit) {
        const damage = CombatFormulas.computeHeroDamage(hero, enemy, weapon, damageBonus, combatStyle, fight.combat.enemyStatuses);
        fight.combat.enemyHp.current = Math.max(0, fight.combat.enemyHp.current - damage);

        // Weapon on-hit statuses (Poisonous Dagger etc.), then hit-taken decay
        rollStatusOnHit(weapon, (statusId, stacks) => StatusEffectSystem.applyToEnemy(fight, statusId, stacks));
        StatusEffectSystem.notifyHitTaken(fight.combat.enemyStatuses);

        // Thorns handling
        if (enemy.traits) {
            const thorns = enemy.traits.find(t => t.id === 'thorns');
            if (thorns) {
                const reflex = thorns.level || 1;
                HeroManager.modifyHeroHp(hero.id, -reflex);
                EventBus.publish('combat_enemy_trait_trigger', { cardId: fight.id, heroId: hero.id, traitId: 'thorns', damage: reflex });
            }
        }
        EventBus.publish('combat_hero_attack', { cardId: fight.id, heroId: hero.id, enemyId: enemy.id, damage, hit: true, enemyHpRemaining: fight.combat.enemyHp.current });
    } else {
        EventBus.publish('combat_hero_attack', { cardId: fight.id, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false, enemyHpRemaining: fight.combat.enemyHp.current });
    }

    // Carry the overshoot instead of resetting (CR-002): at 10x time-scale a
    // reset quantized every attack up to a whole engine tick slower.
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
                EventBus.publish('combat_enemy_attack', { cardId: fight.id, heroId: targetHeroId, enemyId: enemy.id, damage: 0, hit: false, stunned: true, heroHpRemaining: targetHero.hp.current });
                fight.combat.enemyTickProgress -= enemyAttackSpeed;
                return;
            }

            // Defender: hero's Defense skill shifts the enemy's hit chance;
            // the hero's Block (innate from Defense + gear later) is applied
            // inside the hit roll via the defender entity.
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

                // Enemy on-hit statuses (Spider Bite → Poison), then hit-taken
                // decay for the hero's Armor Shield stacks.
                rollStatusOnHit(enemy, (statusId, stacks) => StatusEffectSystem.applyToHero(targetHeroId, statusId, stacks));
                StatusEffectSystem.notifyHitTaken(targetHero.statuses);

                EventBus.publish('combat_enemy_attack', { cardId: fight.id, heroId: targetHeroId, enemyId: enemy.id, damage: dmg, hit: true, heroHpRemaining: targetHero.hp.current });

                if (targetHero.hp.current <= 0) {
                    handleHeroWounded(fight, targetHeroId);
                }
            } else {
                EventBus.publish('combat_enemy_attack', { cardId: fight.id, heroId: targetHeroId, enemyId: enemy.id, damage: 0, hit: false, heroHpRemaining: targetHero.hp.current });
            }

        }
        // Carry the overshoot instead of resetting (CR-002).
        fight.combat.enemyTickProgress -= enemyAttackSpeed;
    }
}
