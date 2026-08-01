import * as HeroManager from '../../hero/HeroManager.js';
import { EventBus } from '../../core/EventBus.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import * as EquipmentManager from '../../equipment/EquipmentManager.js';
import * as StatusEffectSystem from '../../effects/StatusEffectSystem.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getPrimaryWeapon, getPrimaryWeaponSlot, getEquippedEntries, isGearCategory } from '../../../config/registries/equipmentConstants.js';
import { handleHeroWounded } from './CombatResolutionProcessor.js';
import * as ConsumptionSystem from '../../hero/ConsumptionSystem.js';

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

export function handleHeroAttack(card, hero, enemy, combatStyle, attackSpeed) {
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
            cardId: card.id, heroId: hero.id, itemId: meal.itemId, healed: meal.amount
        });
        card.combat.heroTickProcesses[hero.id] -= attackSpeed;
        return;
    }

    const weaponId = getPrimaryWeapon(hero);
    const weapon = weaponId ? getItem(weaponId) : null;

    // Stun check: the attempt itself spends a stack, success or failure.
    if (StatusEffectSystem.rollAttackFailure(hero.statuses)) {
        EventBus.publish('combat_hero_attack', { cardId: card.id, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false, stunned: true, enemyHpRemaining: card.combat.enemyHp.current });
        card.combat.heroTickProcesses[hero.id] -= attackSpeed;
        return;
    }

    const stats = card.combat?.stats || {};
    const damageBonus = stats.damageBonus || 0;
    const heroSkill = CombatFormulas.getHeroCombatSkill(hero, combatStyle);

    // Hit roll (§7 step 2): attacker style skill vs the enemy's Defense (= its level)
    const didHit = CombatFormulas.rollHit(
        heroSkill, enemy.defenceSkill,
        combatStyle, enemy.combatType || 'melee',
        hero, enemy
    );

    if (didHit) {
        const damage = CombatFormulas.computeHeroDamage(hero, enemy, weapon, damageBonus, combatStyle, card.combat.enemyStatuses);
        card.combat.enemyHp.current = Math.max(0, card.combat.enemyHp.current - damage);

        // Weapon on-hit statuses (Poisonous Dagger etc.), then hit-taken decay
        rollStatusOnHit(weapon, (statusId, stacks) => StatusEffectSystem.applyToEnemy(card, statusId, stacks));
        StatusEffectSystem.notifyHitTaken(card.combat.enemyStatuses);

        // Thorns handling
        if (enemy.traits) {
            const thorns = enemy.traits.find(t => t.id === 'thorns');
            if (thorns) {
                const reflex = thorns.level || 1;
                HeroManager.modifyHeroHp(hero.id, -reflex);
                EventBus.publish('combat_enemy_trait_trigger', { cardId: card.id, heroId: hero.id, traitId: 'thorns', damage: reflex });
            }
        }
        EventBus.publish('combat_hero_attack', { cardId: card.id, heroId: hero.id, enemyId: enemy.id, damage, hit: true, enemyHpRemaining: card.combat.enemyHp.current });
    } else {
        EventBus.publish('combat_hero_attack', { cardId: card.id, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false, enemyHpRemaining: card.combat.enemyHp.current });
    }

    // Only the weapon that swung wears — the primary hand (the off hand's
    // bonuses still apply, it just doesn't take the hit).
    // `!== null`, not truthiness: a slot is an INDEX now and index 0 is a
    // perfectly good slot — a weapon in the first grid position would
    // otherwise never wear.
    const weaponSlot = getPrimaryWeaponSlot(hero);
    if (weaponSlot !== null) EquipmentManager.reduceDurability(hero.id, weaponSlot);
    // Carry the overshoot instead of resetting (CR-002): at 10x time-scale a
    // reset quantized every attack up to a whole engine tick slower.
    card.combat.heroTickProcesses[hero.id] -= attackSpeed;
}

export function processEnemyAttack(card, enemy, assignedHeroIds, deltaTime) {
    if (!card.combat) return;
    card.combat.enemyTickProgress += deltaTime;
    const enemyAttackSpeed = enemy.attackSpeed || CombatFormulas.ENEMY_ATTACK_INTERVAL_MS;
    card.combat.enemyAttackSpeed = enemyAttackSpeed; // persisted for UI attack-loop bars

    if (card.combat.enemyTickProgress >= enemyAttackSpeed) {
        const targetHeroId = assignedHeroIds[Math.floor(Math.random() * assignedHeroIds.length)];
        const targetHero = HeroManager.getHero(targetHeroId);

        if (targetHero && targetHero.status !== 'wounded') {
            // Stun check for the enemy: the attempt spends a stack either way.
            if (StatusEffectSystem.rollAttackFailure(card.combat.enemyStatuses)) {
                EventBus.publish('combat_enemy_attack', { cardId: card.id, heroId: targetHeroId, enemyId: enemy.id, damage: 0, hit: false, stunned: true, heroHpRemaining: targetHero.hp.current });
                card.combat.enemyTickProgress -= enemyAttackSpeed;
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

                EventBus.publish('combat_enemy_attack', { cardId: card.id, heroId: targetHeroId, enemyId: enemy.id, damage: dmg, hit: true, heroHpRemaining: targetHero.hp.current });

                if (targetHero.hp.current <= 0) {
                    handleHeroWounded(card, targetHeroId);
                }
            } else {
                EventBus.publish('combat_enemy_attack', { cardId: card.id, heroId: targetHeroId, enemyId: enemy.id, damage: 0, hit: false, heroHpRemaining: targetHero.hp.current });
            }

            // Category-driven rather than a hardcoded slot list (D-54): a new
            // gear type added by authoring alone takes incidental wear too,
            // with no edit here. Chest takes every blow; other worn gear takes
            // a quarter of them.
            const hero = HeroManager.getHero(targetHeroId);
            for (const entry of getEquippedEntries(hero)) {
                if (!isGearCategory(entry.category)) continue;
                const always = entry.category === 'chest';
                if (always || Math.random() < 0.25) {
                    EquipmentManager.reduceDurability(targetHeroId, entry.index);
                }
            }
        }
        // Carry the overshoot instead of resetting (CR-002).
        card.combat.enemyTickProgress -= enemyAttackSpeed;
    }
}
