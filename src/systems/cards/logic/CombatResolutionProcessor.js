import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import { logger } from '../../../utils/Logger.js';
import * as CombatFormulas from '../../../utils/CombatFormulas.js';
import { QuestTracker } from '../../progression/QuestTracker.js';
import * as HeroManager from '../../hero/HeroManager.js';
import * as SkillSystem from '../../hero/SkillSystem.js';
import { applyUnifiedReward } from './WorkProcessor.js';
import { InventoryManager } from '../../inventory/InventoryManager.js';
import { bumpCardRev } from '../CardManager.js';
import * as NotificationSystem from '../../core/NotificationSystem.js';
import { getEnemy } from '../../../config/registries/enemyRegistry.js';
import { DEFENSE_XP_SHARE } from '../../../config/FormulaRegistry.js';
import * as StatusEffectSystem from '../../effects/StatusEffectSystem.js';

export function handleHeroWounded(card, heroId) {
    HeroManager.setHeroStatus(heroId, 'wounded');
    // Forced Retreat cleanses every status, buff or debuff (concept doc §6)
    StatusEffectSystem.clearAll(heroId);
    // The hero↔area binding is owned by LoopRunner._forcedRetreat, which runs
    // on the next tick after it sees the wounded status (CR-028: the old
    // card-level unassign here was a no-op on ephemeral cards).
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

    card.combat.state.intermissionTimer = 2000;
    card.status = 'victory';
    assignedHeroIds.forEach(id => HeroManager.setHeroStatus(id, card.originalTraits ? 'working' : 'idle'));

    EventBus.publish('combat_victory', { cardId: card.id, heroId, areaId: card.areaId || 'area_guild_hall', enemyId: enemy.id, enemyName: enemy.name, drops: enemy.drops, dropTableId: enemy.dropTableId });
}

// (CR-028) The old combat-quest listener here looked the card up through the
// never-populated card cache and could never fire; quest progress for kills
// runs through QuestTracker's ON_ENEMY_KILLED fan-out instead.
