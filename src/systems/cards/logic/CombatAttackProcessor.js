import * as HeroManager from '../../hero/HeroManager.js';
import { EventBus } from '../../core/EventBus.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import * as EquipmentManager from '../../equipment/EquipmentManager.js';
import * as StatusEffectSystem from '../../effects/StatusEffectSystem.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { handleHeroWounded } from './CombatResolutionProcessor.js';

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
    const weaponId = hero.equipment?.weapon;
    const weapon = weaponId ? getItem(weaponId) : null;

    // Stun check: the attempt itself spends a stack, success or failure.
    if (StatusEffectSystem.rollAttackFailure(hero.statuses)) {
        EventBus.publish('combat_hero_attack', { cardId: card.id, heroId: hero.id, enemyId: enemy.id, damage: 0, hit: false, stunned: true, enemyHpRemaining: card.combat.enemyHp.current });
        card.combat.heroTickProcesses[hero.id] = 0;
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

    EquipmentManager.reduceDurability(hero.id, 'weapon');
    card.combat.heroTickProcesses[hero.id] = 0;
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
                card.combat.enemyTickProgress = 0;
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

            EquipmentManager.reduceDurability(targetHeroId, 'armor');
            ['head', 'body', 'hands', 'feet'].forEach(slot => { if (Math.random() < 0.25) EquipmentManager.reduceDurability(targetHeroId, slot); });
        }
        card.combat.enemyTickProgress = 0;
    }
}
