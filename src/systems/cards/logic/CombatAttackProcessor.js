import * as HeroManager from '../../hero/HeroManager.js';
import { EventBus } from '../../core/EventBus.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import * as EquipmentManager from '../../equipment/EquipmentManager.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { handleVictory, handleHeroWounded } from './CombatResolutionProcessor.js';

export function handleHeroAttack(card, hero, enemy, combatStyle, attackSpeed) {
    const energyCost = enemy.energyCost ?? 2;
    if (hero.energy.current < energyCost) return;

    HeroManager.modifyHeroEnergy(hero.id, -energyCost);
    const weaponId = hero.equipment?.weapon;
    const weapon = weaponId ? getItem(weaponId) : null;

    const stats = card.combat?.stats || {};
    const damageBonus = stats.damageBonus || 0;
    const heroSkill = CombatFormulas.getHeroCombatSkill(hero, combatStyle);
    const didHit = CombatFormulas.rollHit(heroSkill, enemy.defenceSkill);

    if (didHit) {
        const damage = CombatFormulas.computeHeroDamage(hero, enemy, weapon, damageBonus, combatStyle);
        card.combat.enemyHp.current = Math.max(0, card.combat.enemyHp.current - damage);
        
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
    const enemyAttackSpeed = enemy.attackSpeed || 3000;

    if (card.combat.enemyTickProgress >= enemyAttackSpeed) {
        const targetHeroId = assignedHeroIds[Math.floor(Math.random() * assignedHeroIds.length)];
        const targetHero = HeroManager.getHero(targetHeroId);

        if (targetHero && targetHero.status !== 'wounded') {
            const stats = card.combat?.stats || {};
            const defenseBonus = stats.defenseBonus || 0;
            const heroClass = HeroManager.getHeroClass(targetHeroId);
            const style = heroClass?.combatStyle || 'melee';
            const heroDef = (targetHero.skills?.[style]?.level ?? 1) + defenseBonus;
            
            if (CombatFormulas.rollHit(enemy.attackSkill, heroDef)) {
                const dmg = CombatFormulas.computeEnemyDamage(enemy, heroDef, style);
                HeroManager.modifyHeroHp(targetHeroId, -dmg);
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
