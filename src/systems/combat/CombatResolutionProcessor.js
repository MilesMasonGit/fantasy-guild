import { EventBus } from '../core/EventBus.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

export function handleHeroWounded(fight, heroId) {
    HeroManager.setHeroStatus(heroId, 'wounded');
    // Forced Retreat cleanses every status, buff or debuff
    StatusEffectSystem.clearAll(heroId);
    // ⚠️ Does not unassign the hero: that is a no-op on ephemeral fight objects.
    // `BoardCombat.resolveDefeat` sees the wounded status set here, furls the
    // hero's flag and sends the one defeat notification.
}

export function handleVictory(fight, hero, enemy, heroId, assignedHeroIds) {
    if (!fight.combat) return;

    // The full award goes into the hero's single combat skill (Defence is folded
    // into it, so there is no second bar). A hero holding no combat skill gets nothing.
    assignedHeroIds.forEach(id => {
        const h = HeroManager.getHero(id);
        if (h) {
            const { id: combatSkillId } = CombatFormulas.getHeroCombatSkillEntry(h);
            if (combatSkillId) {
                SkillSystem.addXP(id, combatSkillId, CombatFormulas.getCombatXpAward(enemy));
            }
        }
        StatusEffectSystem.notifyCombatResolved(id);
    });

    // A kill's loot is the enemy Token's outputs, carried as `fight.drops` and
    // resolved by `LootSystem` off the `combat_victory` event below.

    fight.combat.state.intermissionTimer = 2000;
    fight.status = 'victory';
    assignedHeroIds.forEach(id => HeroManager.setHeroStatus(id, 'idle'));

    // `instanceId` (the enemy Token) is forwarded so loot lands as a sprite where
    // the kill happened instead of teleporting into the Bank.
    EventBus.publish(ENGINE_EVENTS.COMBAT_VICTORY, {
        cardId: fight.id, heroId, instanceId: fight.instanceId ?? null,
        areaId: fight.areaId || 'area_guild_hall',
        enemyId: enemy.id, enemyName: enemy.name,
        drops: fight.drops || []
    });
}
