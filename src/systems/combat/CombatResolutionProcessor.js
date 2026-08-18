import { EventBus } from '../core/EventBus.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import * as TransactionProcessor from '../economy/TransactionProcessor.js';
import { bumpCardRev } from '../../utils/CardManagerUtils.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import { getEnemy } from '../../config/registries/enemyRegistry.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';

/**
 * Pay out a victory's XP and items.
 *
 * Was `applyUnifiedReward`, the last living function in the card era's
 * `WorkProcessor` — everything else in that module drove a work cycle the board
 * reimplemented for itself, and was deleted with it (2026-08-18). Brought here
 * because combat victory is now its only caller, so a whole module and an extra
 * hop existed to serve twenty lines.
 *
 * The name says *victory* rather than "unified" because that is the only case
 * that reaches it now.
 */
function applyVictoryReward(fight, rewardTrait) {
    const heroId = fight.assignedHeroId;
    const entries = [];

    if (rewardTrait.xp > 0) {
        const xpSkill = fight.traits.find(t => t.type === 'workcycle')?.skill;
        if (xpSkill) {
            entries.push({ type: 'XP', skill: xpSkill, amount: rewardTrait.xp });
        }
    }

    if (rewardTrait.items?.length > 0) {
        for (const item of rewardTrait.items) {
            entries.push({ type: 'ITEM', id: item.id, amount: item.amount || 1 });
        }
    }

    if (entries.length > 0) {
        TransactionProcessor.apply({ entries }, heroId);
    }
}

export function handleHeroWounded(fight, heroId) {
    HeroManager.setHeroStatus(heroId, 'wounded');
    // Forced Retreat cleanses every status, buff or debuff (concept doc §6)
    StatusEffectSystem.clearAll(heroId);
    // The hero↔area binding is owned by LoopRunner._forcedRetreat, which runs
    // on the next tick after it sees the wounded status (CR-028: the old
    // card-level unassign here was a no-op on ephemeral cards).
    NotificationSystem.warning(`${HeroManager.getHero(heroId)?.name} has been wounded!`);
}

export function handleVictory(fight, hero, enemy, heroId, assignedHeroIds) {
    if (!fight.combat) return;

    // Award combat XP on kill.
    //
    // ⚠️ **The award is now the FULL amount into one skill**, where it used to
    // be the full amount into the style plus a third again into Defense — 4/3
    // of the award spread over two bars. Defence folded into the combat skill,
    // so there is no second bar to feed, and paying 4/3 into the single one
    // would have silently accelerated combat levelling by a third.
    //
    // A hero who holds no combat skill is a Recruit: `addXP` refuses, which is
    // correct, and they should not have been fighting in the first place.
    assignedHeroIds.forEach(id => {
        const h = HeroManager.getHero(id);
        if (h) {
            const { id: combatSkillId } = CombatFormulas.getHeroCombatSkillEntry(h);
            if (combatSkillId) {
                SkillSystem.addXP(id, combatSkillId, CombatFormulas.getCombatXpAward(enemy));
            }
        }
        // Fight resolved: combat-only statuses clear; Well Fed layers decay (§3A)
        StatusEffectSystem.notifyCombatResolved(id);
    });

    const rewardTrait = fight.traits.find(t => t.type.toLowerCase() === 'unifiedreward');
    if (rewardTrait) applyVictoryReward(fight, rewardTrait);

    // Horde Handling
    if (fight.hordeCount > 1) {
        fight.hordeCount--;
        fight.combat.enemyHp.current = fight.combat.enemyHp.max;
        EventBus.publish('combat_victory', { cardId: fight.id, heroId, enemyId: enemy.id, enemyName: enemy.name, drops: enemy.drops, dropTableId: enemy.dropTableId, isHordeMember: true });
        return;
    }

    // Dungeon Handling
    if (fight.cardType === 'dungeon') {
        fight.completedCount = (fight.completedCount || 0) + 1;
        if (fight.enemyQueue?.length > 0) {
            const nextId = fight.enemyQueue.shift();
            const nextEnemy = getEnemy(nextId);
            if (nextEnemy) {
                fight.enemyId = nextId;
                fight.combat.enemyHp = { current: nextEnemy.hp, max: nextEnemy.hp };
                fight.combat.state.intermissionTimer = 2000;
                fight.status = 'victory';
                EventBus.publish('combat_victory', { cardId: fight.id, heroId, areaId: fight.areaId || 'area_guild_hall', enemyId: enemy.id, enemyName: enemy.name, drops: enemy.drops, dropTableId: enemy.dropTableId });
                bumpCardRev(fight);
                return;
            }
        } else {
            if (fight.finalRewards) fight.finalRewards.forEach(r => InventoryManager.addItem(r.itemId, r.count || r.amount));
            if (fight.finalXpRewards) fight.finalXpRewards.forEach(xp => assignedHeroIds.forEach(hid => SkillSystem.addXP(hid, xp.skill, xp.amount)));
        }
    }

    fight.combat.state.intermissionTimer = 2000;
    fight.status = 'victory';
    assignedHeroIds.forEach(id => HeroManager.setHeroStatus(id, fight.originalTraits ? 'working' : 'idle'));

    // `tile` is forwarded when the fight is on the BOARD (playmat rework Phase
    // 6). It is what lets loot land as a sprite where the kill happened (D-40)
    // rather than teleporting into the Bank.
    EventBus.publish('combat_victory', {
        cardId: fight.id, heroId, tile: fight.tile ?? null,
        areaId: fight.areaId || 'area_guild_hall',
        enemyId: enemy.id, enemyName: enemy.name,
        drops: enemy.drops, dropTableId: enemy.dropTableId
    });
}

// (CR-028) The old combat-quest listener here looked the card up through the
// never-populated card cache and could never fire. The dormant quest board it
// fed was removed on 2026-08-18; the live quest system (systems/quests) listens
// on the EventBus instead.
