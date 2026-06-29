import * as CardManager from '../CardManager.js';
import { bumpCardRev } from '../CardManager.js';
import * as HeroManager from '../../hero/HeroManager.js';
import { InventoryManager } from '../../inventory/InventoryManager.js';
import * as SkillSystem from '../../hero/SkillSystem.js';
import { EventBus } from '../../core/EventBus.js';
import { logger } from '../../../utils/Logger.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import * as EquipmentManager from '../../equipment/EquipmentManager.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { ThreatSystem } from '../../threat/ThreatSystem.js';
import * as NotificationSystem from '../../core/NotificationSystem.js';
import { GameState } from '../../../state/GameState.js';
import { EFFECT_TYPES } from '../../effects/constants.js';
import { ModifierAggregator } from '../../effects/ModifierAggregator.js';
import { applyUnifiedReward } from './WorkProcessor.js';
import { QuestTracker } from '../../progression/QuestTracker.js';

import { getAreaSet } from '../../../config/registries/index.js';

/**
 * Combat Module Processor
 */
export function processCombat(card, trait, deltaTime) {
    // Resolve Enemy
    const enemy = getEnemy(trait.enemyId || card.enemyId);
    if (!enemy) return;

    // Granular Namespace Initialization
    const combat = card.combat || {};
    card.combat = combat; // Assign back if created

    if (!combat.enemyHp) combat.enemyHp = { current: enemy.hp, max: enemy.hp };
    if (!combat.state) combat.state = { intermissionTimer: 0 };
    if (!combat.heroTickProcesses) combat.heroTickProcesses = {};
    if (!combat.stats) combat.stats = {};

    const heroId = card.assignedHeroId;
    if (!heroId) {
        let changed = false;
        if (card.status !== 'idle') {
            CardManager.setCardStatus(card.id, 'idle');
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
            bumpCardRev(card);
        }
        return;
    }

    const assignedHeroIds = [heroId];

    // Intermission Timer
    if (combat.state.intermissionTimer > 0) {
        combat.state.intermissionTimer -= deltaTime;
        if (combat.state.intermissionTimer <= 0) {
            combat.state.intermissionTimer = 0;
            combat.enemyHp = { current: enemy.hp, max: enemy.hp };
            card.status = 'active';
            bumpCardRev(card);
        }
        return;
    }

    if (card.status === 'idle') CardManager.setCardStatus(card.id, 'active');

    // 1. Hero Attacks
    const heroStatsForUi = [];

    for (const heroId of assignedHeroIds) {
        const hero = HeroManager.getHero(heroId);
        if (!hero || hero.status === 'wounded') continue;

        if (hero.status !== 'combat') HeroManager.setHeroStatus(heroId, 'combat');
        if (!hero.aggregator) hero.aggregator = new ModifierAggregator(hero.id);

        // Auto-consume Check
        if (checkAndConsumeFoodModular(card, hero)) {
            heroStatsForUi.push({ id: hero.id, hp: hero.hp, energy: hero.energy, progress: 0, attackSpeed: 3000, isConsuming: true });
            continue;
        }

        combat.heroTickProcesses[heroId] = (combat.heroTickProcesses[heroId] || 0) + deltaTime;
        combat.heroTickProgress = combat.heroTickProcesses[heroId];

        const heroClass = HeroManager.getHeroClass(heroId);
        const combatStyle = heroClass?.combatStyle || 'melee';
        const stats = combat.stats || {};
        const attackSpeed = stats.attackSpeed || 3000;
        combat.heroAttackSpeed = attackSpeed;

        heroStatsForUi.push({
            id: hero.id,
            hp: hero.hp,
            energy: hero.energy,
            progress: combat.heroTickProcesses[heroId],
            attackSpeed: attackSpeed,
            isFleeing: card.isFleeing
        });

        if (!card.isFleeing && combat.heroTickProcesses[heroId] >= attackSpeed) {
            handleHeroAttack(card, hero, enemy, combatStyle, attackSpeed);
            if (combat.enemyHp.current <= 0) {
                handleVictory(card, hero, enemy, heroId, assignedHeroIds);
                return;
            }
        }
    }

    // 2. Enemy Attacks
    processEnemyAttack(card, enemy, assignedHeroIds, deltaTime);
}

/**
 * Sub-logic for hero attack cycle
 */
function handleHeroAttack(card, hero, enemy, combatStyle, attackSpeed) {
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

/**
 * Sub-logic for enemy attack cycle
 */
function processEnemyAttack(card, enemy, assignedHeroIds, deltaTime) {
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

function handleHeroWounded(card, heroId) {
    HeroManager.setHeroStatus(heroId, 'wounded');
    const slotIdx = card.heroSlots ? Object.values(card.heroSlots).indexOf(heroId) : -1;
    if (slotIdx >= 0) CardManager.unassignHero(card.id, slotIdx);
    else if (card.assignedHeroId === heroId) CardManager.unassignHero(card.id, 0);
    NotificationSystem.warning(`${HeroManager.getHero(heroId)?.name} has been wounded!`);
}

/**
 * Handle Combat Victory scenarios
 */
function handleVictory(card, hero, enemy, heroId, assignedHeroIds) {
    if (!card.combat) return;

    // Track kill for quests
    QuestTracker.processEvent('ON_ENEMY_KILLED', { enemyId: enemy.id });

    // Award combat XP in one large chunk upon killing the enemy
    assignedHeroIds.forEach(id => {
        const h = HeroManager.getHero(id);
        if (h) {
            const heroClass = HeroManager.getHeroClass(id);
            const style = heroClass?.combatStyle || 'melee';
            const xpAward = CombatFormulas.getCombatXpAward(enemy);
            SkillSystem.addXP(id, style, xpAward);
        }
    });

    const rewardTrait = card.traits.find(t => t.type.toLowerCase() === 'unifiedreward');
    if (rewardTrait) applyUnifiedReward(card, rewardTrait);

    // Horde Handling
    if (card.hordeCount > 1) {
        card.hordeCount--;
        card.combat.enemyHp.current = card.combat.enemyHp.max;
        EventBus.publish('combat_victory', { cardId: card.id, heroId, enemyId: enemy.id, enemyName: enemy.name, drops: enemy.drops, dropTableId: enemy.dropTableId, isHordeMember: true });
        return;
    }

    // Dungeon Handling
    if (card.cardType === 'dungeon') {
        card.completedCount = (card.completedCount || 0) + 1;
        if (card.enemyQueue?.length > 0) {
            const nextId = card.enemyQueue.shift();
            const nextEnemy = getEnemy(nextId);
            if (nextEnemy) {
                card.enemyId = nextId;
                card.combat.enemyHp = { current: nextEnemy.hp, max: nextEnemy.hp };
                card.combat.state.intermissionTimer = 2000;
                card.status = 'victory';
                EventBus.publish('combat_victory', { cardId: card.id, heroId, areaId: card.areaId || 'area_guild_hall', enemyId: enemy.id, enemyName: enemy.name, drops: enemy.drops, dropTableId: enemy.dropTableId });
                bumpCardRev(card);
                return;
            }
        } else {
            if (card.finalRewards) card.finalRewards.forEach(r => InventoryManager.addItem(r.itemId, r.count || r.amount));
            if (card.finalXpRewards) card.finalXpRewards.forEach(xp => assignedHeroIds.forEach(hid => SkillSystem.addXP(hid, xp.skill, xp.amount)));
        }
    }

    if (card.cardType === 'invasion') {
        if (card.hordeCount !== undefined) {
            card.hordeCount = Math.max(0, card.hordeCount - 1);
        }
        ThreatSystem.clearInvasion(card.areaId || GameState.state.ui.activeAreaId);
    }

    card.combat.state.intermissionTimer = 2000;
    card.status = 'victory';
    assignedHeroIds.forEach(id => HeroManager.setHeroStatus(id, card.originalTraits ? 'working' : 'idle'));

    EventBus.publish('combat_victory', { cardId: card.id, heroId, areaId: card.areaId || 'area_guild_hall', enemyId: enemy.id, enemyName: enemy.name, drops: enemy.drops, dropTableId: enemy.dropTableId });

    if (card.originalTraits) CardManager.revertFromCombat(card.id);
}

/**
 * Food/Drink Auto-consume
 */
export function checkAndConsumeFoodModular(card, hero) {
    const { needsFood, needsDrink } = CombatFormulas.checkAutoConsume(hero);
    if (needsFood && hero.equipment?.food) {
        const item = getItem(hero.equipment.food);
        if (item?.restoreAmount) {
            HeroManager.modifyHeroHp(hero.id, item.restoreAmount);
            EventBus.publish('combat_consumed', { heroId: hero.id, itemId: item.id, restoreType: 'hp', amount: item.restoreAmount });
            InventoryManager.removeItem(item.id, 1);
            EquipmentManager.syncEquipmentModifiers(hero.id);
            return true;
        }
    }
    if (needsDrink && hero.equipment?.drink) {
        const item = getItem(hero.equipment.drink);
        if (item?.restoreAmount) {
            HeroManager.modifyHeroEnergy(hero.id, item.restoreAmount);
            EventBus.publish('combat_consumed', { heroId: hero.id, itemId: item.id, restoreType: 'energy', amount: item.restoreAmount });
            InventoryManager.removeItem(item.id, 1);
            EquipmentManager.syncEquipmentModifiers(hero.id);
            return true;
        }
    }
    return false;
}

/**
 * Unified listener for combat quest progress
 */
EventBus.subscribe('combat_victory', (data) => {
    const card = CardManager.getCard(data.cardId);
    if (!card || !card.traits) return;
    const questTrait = card.traits.find(t => t.type === 'quest' && t.questType === 'combat');
    if (!questTrait) return;

    if (card.hordeCount !== undefined) {
        card.hordeCount--;
        EventBus.publish('quest_progress_updated', { cardId: card.id, hordeCount: card.hordeCount });
        if (card.hordeCount <= 0) EventBus.publish('quest_completed', { cardId: card.id, questId: questTrait.id });
    }
});
