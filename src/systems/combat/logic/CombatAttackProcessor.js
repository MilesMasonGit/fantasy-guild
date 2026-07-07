import { logger } from '../../../utils/Logger.js';
import { EventBus } from '../../core/EventBus.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import * as HeroManager from '../../hero/HeroManager.js';
import * as SkillSystem from '../../hero/SkillSystem.js';
import { DurabilitySystem } from '../../equipment/DurabilitySystem.js';
import { MasterySystem } from '../../progression/MasterySystem.js';
import { EFFECT_TYPES } from '../../effects/constants.js';

/**
 * Combat Attack: Hit rolls and Damage calculation.
 */

export function processHeroAttack(card, hero, enemy) {
    const selectedStyle = card.selectedStyle || 'melee';
    const weaponId = hero.equipment?.weapon;
    const weapon = weaponId ? getItem(weaponId) : null;

    const heroSkill = CombatFormulas.getHeroCombatSkill(hero, selectedStyle);
    const didHit = CombatFormulas.rollHit(heroSkill, enemy.defenceSkill, selectedStyle, enemy.combatType || 'melee', hero, enemy);

    if (didHit) {
        const areaId = card.areaId || 'area_guild_hall';
        const masteryBonuses = MasterySystem.getEffectiveBonuses({ areaId });

        // Damage calculation using aggregator (equipment + temporary buffs)
        const damageBonus = hero.aggregator.query(EFFECT_TYPES.DAMAGE, selectedStyle.toUpperCase());
        let damage = CombatFormulas.computeHeroDamage(hero, enemy, weapon, damageBonus, selectedStyle);

        if (masteryBonuses.combatDamageMultiplier > 1.0) {
            damage = Math.floor(damage * masteryBonuses.combatDamageMultiplier);
        }

        card.enemyHp.current = Math.max(0, card.enemyHp.current - damage);
        card.combatState.lastHeroHit = true;
        card.combatState.lastHeroDamage = damage;

        // Specialized Monster Traits
        applyMonsterCounterTraits(card, hero, enemy, damage);
    } else {
        card.combatState.lastHeroHit = false;
        card.combatState.lastHeroDamage = 0;
    }

    // Progression & Durability
    const xpAward = CombatFormulas.getCombatXpAward(enemy);
    SkillSystem.addXP(hero.id, selectedStyle, xpAward);
    DurabilitySystem.applyWeaponWear(hero.id);

    EventBus.publish('combat_hero_attack', {
        cardId: card.id,
        heroId: hero.id,
        damage: card.combatState.lastHeroDamage,
        hit: card.combatState.lastHeroHit
    });
}

export function processEnemyAttack(card, hero, enemy) {
    const heroClass = HeroManager.getHeroClass(hero.id);
    const combatSpec = heroClass?.combatStyle || 'melee';
    const heroStyle = card.selectedStyle || combatSpec;

    // Defense calculation using aggregator (+ defense from armor)
    const baseSkillLevel = hero.skills?.[combatSpec]?.level ?? 1;
    const defenseBonus = hero.aggregator.query(EFFECT_TYPES.DEFENSE, heroStyle.toUpperCase());
    const heroDefenceSkill = baseSkillLevel + defenseBonus;

    const didHit = CombatFormulas.rollHit(enemy.attackSkill, heroDefenceSkill, enemy.combatType || 'melee', heroStyle, enemy, hero);

    if (didHit) {
        const damage = CombatFormulas.computeEnemyDamage(enemy, heroDefenceSkill, heroStyle, hero);
        HeroManager.modifyHeroHp(hero.id, -damage);
        card.combatState.lastEnemyHit = true;
        card.combatState.lastEnemyDamage = damage;
    } else {
        card.combatState.lastEnemyHit = false;
        card.combatState.lastEnemyDamage = 0;
    }

    // Defensive Progression & Wear
    const xpAward = CombatFormulas.getCombatXpAward(enemy);
    SkillSystem.addXP(hero.id, combatSpec, xpAward);
    DurabilitySystem.applyArmorWear(hero.id);

    EventBus.publish('combat_enemy_attack', {
        cardId: card.id,
        damage: card.combatState.lastEnemyDamage,
        hit: card.combatState.lastEnemyHit
    });
}

/**
 * Internal: Apply thorns or other reactive monster traits.
 */
function applyMonsterCounterTraits(card, hero, enemy, damage) {
    const thornsTrait = (enemy.traits || []).find(t => t.id === 'thorns');
    if (thornsTrait) {
        const reflectPct = thornsTrait.level * 0.1; // 10% per level
        const reflectedDamage = Math.max(1, Math.floor(damage * reflectPct));
        HeroManager.modifyHeroHp(hero.id, -reflectedDamage);

        EventBus.publish('combat_thorns_proc', {
            cardId: card.id,
            heroId: hero.id,
            damage: reflectedDamage
        });
        logger.debug('CombatAttack', `Thorns reflected ${reflectedDamage} damage to ${hero.name}`);
    }
}
