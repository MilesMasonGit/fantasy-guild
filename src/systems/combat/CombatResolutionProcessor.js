import { EventBus } from '../core/EventBus.js';
import * as CombatFormulas from '../../utils/CombatFormulas.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import * as NotificationSystem from '../core/NotificationSystem.js';
import * as StatusEffectSystem from '../effects/StatusEffectSystem.js';

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

    // What a kill is worth is the enemy's inline `drops[]`, resolved by
    // `LootSystem` off the `combat_victory` event below. There is no second
    // path: the horde, dungeon and `unifiedreward`-trait branches that used to
    // sit here were card-era code that `BoardCombat.createFight` can never
    // satisfy — it never sets `hordeCount`, `cardType`, `enemyQueue`,
    // `finalRewards` or `originalTraits`, and builds `traits` empty on purpose.
    // Deleted 2026-08-24 (CR2-077).

    fight.combat.state.intermissionTimer = 2000;
    fight.status = 'victory';
    assignedHeroIds.forEach(id => HeroManager.setHeroStatus(id, 'idle'));

    // `tile` is forwarded when the fight is on the BOARD (playmat rework Phase
    // 6). It is what lets loot land as a sprite where the kill happened (D-40)
    // rather than teleporting into the Bank.
    EventBus.publish('combat_victory', {
        cardId: fight.id, heroId, tile: fight.tile ?? null,
        areaId: fight.areaId || 'area_guild_hall',
        enemyId: enemy.id, enemyName: enemy.name,
        drops: enemy.drops
    });
}

// (CR-028) The old combat-quest listener here looked the card up through the
// never-populated card cache and could never fire. The dormant quest board it
// fed was removed on 2026-08-18; the live quest system (systems/quests) listens
// on the EventBus instead.
