import { EventBus } from '../core/EventBus.js';
import * as CombatFormulas from './CombatFormulas.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as SkillSystem from '../hero/SkillSystem.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { noteEnemyBeaten } from '../progression/collectionLog.js';
import * as TileModifiers from '../board/TileModifiers.js';
import { EFFECT_TYPES } from '../effects/constants.js';

export function handleHeroWounded(fight, heroId) {
    HeroManager.setHeroStatus(heroId, 'wounded');
    // Statuses end with the fight: `BoardCombat.resolveDefeat` ends it.
    // ⚠️ Does not unassign the hero: that is a no-op on ephemeral fight objects.
    // `BoardCombat.resolveDefeat` sees the wounded status set here, furls the
    // hero's flag and sends the one defeat notification.
}

/**
 * A kill's XP for the style it was won in, through the same three scopes a work cycle's XP reads:
 * the enemy Token's inbound rules, the guild's (Hall stars) and the loadout of the hero on it.
 *
 * ⚠️ The hero's loadout is found through the enemy Token's worker (`BoardState.workerOf`), and that
 * is the fighter: a hero fights only the Token they hold the claim on and have reached
 * (`BoardRunner` ticks the fight with exactly that hero, and every fight is one-on-one). A fight
 * with no enemy Token behind it has no place to read and keeps the flat award.
 */
function killXp(fight, award, style) {
    if (!fight.instanceId) return award;
    return SkillSystem.applyXpBonus(award, TileModifiers.resolveAxis(
        fight.instanceId, EFFECT_TYPES.XP_BONUS, award, style
    ));
}

export function handleVictory(fight, hero, enemy, heroId, assignedHeroIds) {
    if (!fight.combat) return;

    // The full award goes into the style the hero fought in, the weapon's (barehanded is Melee):
    // Defence is folded into it, so there is no second bar. XP bonuses aimed at that style, or at
    // every skill, widen it as a work cycle's are widened for its skill (`BoardRunner`).
    const award = CombatFormulas.getCombatXpAward(enemy);
    assignedHeroIds.forEach(id => {
        const h = HeroManager.getHero(id);
        if (h) {
            const style = CombatFormulas.getHeroCombatStyle(h);
            SkillSystem.addXP(id, style, killXp(fight, award, style));
        }
    });

    // A kill's loot is the enemy Token's outputs, carried as `fight.drops` and
    // resolved by `LootSystem` off the `combat_victory` event below.

    fight.combat.state.intermissionTimer = 2000;
    fight.status = 'victory';
    assignedHeroIds.forEach(id => HeroManager.setHeroStatus(id, 'idle'));
    // The kill counts the Encyclopedia ticks an enemy by.
    noteEnemyBeaten(enemy.id);

    // `instanceId` (the enemy Token) is forwarded so loot lands as a sprite where
    // the kill happened instead of teleporting into the Bank.
    EventBus.publish(ENGINE_EVENTS.COMBAT_VICTORY, {
        cardId: fight.id, heroId, instanceId: fight.instanceId ?? null,
        enemyId: enemy.id, enemyName: enemy.name,
        drops: fight.drops || []
    });
}
