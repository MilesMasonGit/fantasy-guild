// Fantasy Guild — carried rules firing at a named moment (Unified Effects P5/P6)

import * as HeroManager from '../hero/HeroManager.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import * as StatusApplication from './StatusApplication.js';
import * as DealDamage from './DealDamage.js';
import * as EffectActions from './EffectActions.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as EffectFeedback from './EffectFeedback.js';
import { KEYWORD } from '../effects/statements.js';

/**
 * The rules a hero is carrying that asked for **this** moment.
 *
 * ## Why carried rules do not go through `TriggerSystem`
 * That system fires statements against a Token **instance** — an instance is
 * where its cooldown lives and where its charge delta is spent. A hero's items
 * have neither: their cost comes out of the inventory stack (UE-21) and there is
 * nowhere to hang a cooldown. Routing them through it would mean inventing
 * per-hero cooldown state for rules that already fire once per moment by
 * construction.
 *
 * ## Why this is its own module
 * Both `BoardRunner` (cycle start) and `BoardCombat` (engaging an enemy) fire
 * carried rules, and `BoardRunner` already imports `BoardCombat` — so putting
 * the shared function in either would make an import cycle. It lives here so
 * both can reach it and neither reaches the other.
 *
 * ## The order is check, act, pay
 * A potion spent on a roll that missed would teach the player the opposite of
 * how often it works, so affordability is checked first, the rule acts, and only
 * then is the item consumed.
 *
 * ⚠️ **Since V10a, "acted" means it changed something.** `Deals`, `Heals` and
 * `Removes` run here for the first time (they were silently skipped before). A
 * hit fully stopped by armour, a heal on someone already whole and a cleanse
 * with nothing to remove all did nothing, so none of them spends the item —
 * the same rule a missed chance roll already followed.
 */

/**
 * Fire every carried rule waiting on `eventId`.
 *
 * @param {string} instanceId the Token where the moment happened (by instance
 *                        id, slice 1.6b) — a grant lands from here, and a status
 *                        resolves its target from whoever works this Token
 * @param {string} heroId the hero whose loadout is being read
 * @param {string} eventId a `TRIGGER_EVENTS` id, e.g. `CYCLE_START`
 * @returns {number} how many rules actually did something
 */
export function fire(instanceId, heroId, eventId) {
    if (!heroId || instanceId == null) return 0;

    const hero = HeroManager.getHero(heroId);
    if (!hero) return 0;

    /**
     * Who a carried rule's roles name (V10a). The carrier is `self` and the
     * actor alike; `the enemy` is looked up from that hero by the verb itself,
     * never from the Token (G-43).
     */
    const roles = { self: instanceId, selfHeroId: heroId, actor: heroId, source: null };

    let fired = 0;

    for (const statement of HeroEffects.loadoutStatements(hero)) {
        if (statement?.when?.event !== eventId) continue;
        if (!HeroEffects.canPayLoadoutCost(statement)) continue;

        const payload = statement.payload || {};
        let acted = false;

        if (statement.keyword === KEYWORD.APPLIES) {
            // G-42: a role, when set, replaces the Token's occupant reading.
            acted = statement.target?.role
                ? StatusApplication.applyToRole(statement, roles) > 0
                : StatusApplication.applyAt(instanceId, payload);
        } else if (statement.keyword === KEYWORD.DEALS) {
            acted = DealDamage.deal(statement, roles) > 0;
        } else if (statement.keyword === KEYWORD.HEALS) {
            acted = EffectActions.heal(statement, roles) > 0;
        } else if (statement.keyword === KEYWORD.REMOVES) {
            acted = EffectActions.remove(statement, roles) > 0;
        } else if (statement.keyword === KEYWORD.GRANTS && payload.itemId) {
            const chance = payload.chance ?? 100;
            if (chance >= 100 || Math.random() * 100 < chance) {
                SpriteLayer.addSprite('item', payload.itemId, Math.max(1, payload.quantity || 1), instanceId);
                acted = true;
            }
        }

        if (!acted) continue;
        HeroEffects.payLoadoutCost(statement);
        EffectFeedback.announce(instanceId, statement);
        fired += 1;
    }

    return fired;
}
