import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import { logger } from '../../../utils/Logger.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import { QuestTracker } from '../../progression/QuestTracker.js';
import * as HeroManager from '../../hero/HeroManager.js';
import * as SkillSystem from '../../hero/SkillSystem.js';
import { applyUnifiedReward } from './WorkProcessor.js';
import { InventoryManager } from '../../inventory/InventoryManager.js';
import { ThreatSystem } from '../../threat/ThreatSystem.js';
import * as CardManager from '../CardManager.js';
import { bumpCardRev } from '../CardManager.js';
import * as EquipmentManager from '../../equipment/EquipmentManager.js';
import * as NotificationSystem from '../../core/NotificationSystem.js';
import { getItem } from '../../../config/registries/itemRegistry.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { DEFENSE_XP_SHARE } from '../../../config/FormulaRegistry.js';
import * as StatusEffectSystem from '../../effects/StatusEffectSystem.js';

export function handleHeroWounded(card, heroId) {
    HeroManager.setHeroStatus(heroId, 'wounded');
    // Forced Retreat cleanses every status, buff or debuff (concept doc §6)
    StatusEffectSystem.clearAll(heroId);
    const slotIdx = card.heroSlots ? Object.values(card.heroSlots).indexOf(heroId) : -1;
    if (slotIdx >= 0) CardManager.unassignHero(card.id, slotIdx);
    else if (card.assignedHeroId === heroId) CardManager.unassignHero(card.id, 0);
    NotificationSystem.warning(`${HeroManager.getHero(heroId)?.name} has been wounded!`);
}

export function handleVictory(card, hero, enemy, heroId, assignedHeroIds) {
    if (!card.combat) return;

    // Track kill for quests
    QuestTracker.processEvent('ON_ENEMY_KILLED', { enemyId: enemy.id });

    // Award combat XP on kill (owner-locked 2026-07-12): the full award goes
    // to the weapon-determined style skill, and 1/3 of it goes to Defense.
    assignedHeroIds.forEach(id => {
        const h = HeroManager.getHero(id);
        if (h) {
            const style = CombatFormulas.getHeroCombatStyle(h);
            const xpAward = CombatFormulas.getCombatXpAward(enemy);
            SkillSystem.addXP(id, style, xpAward);
            // Fractional on purpose — tiny kills (1 XP tutorial critters) still trickle into Defense
            SkillSystem.addXP(id, 'defense', xpAward * DEFENSE_XP_SHARE);
        }
        // Fight resolved: combat-only statuses clear; Well Fed layers decay (§3A)
        StatusEffectSystem.notifyCombatResolved(id);
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

// Unified listener for combat quest progress
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
