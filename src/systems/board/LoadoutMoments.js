// carried rules firing at a named moment

import * as HeroManager from '../hero/HeroManager.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import * as StatusApplication from './StatusApplication.js';
import * as DealDamage from './DealDamage.js';
import * as EffectActions from './EffectActions.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as EffectFeedback from './EffectFeedback.js';
import { KEYWORD } from '../effects/statements.js';
import { EventBus } from '../core/EventBus.js';
import { BOARD_EVENTS } from './boardEvents.js';

/**
 * The rules a hero is carrying that asked for this moment.
 *
 * Not routed through `TriggerSystem`: that fires statements against a Token instance, where the
 * cooldown lives and the charge delta is spent. A hero's items have neither; their cost comes out
 * of the inventory stack.
 *
 * Its own module because `BoardRunner` (cycle start) and `BoardCombat` (engaging an enemy, via
 * `init`'s `COMBAT_ENGAGED` subscription) both fire carried rules and `BoardRunner` imports
 * `BoardCombat`; putting this in either would make an import cycle. This file imports neither.
 *
 * Order is check, act, pay: a potion spent on a roll that missed would misreport how often it
 * works.
 *
 * ⚠️ Acted means it changed something: a hit fully stopped by armour, a heal on someone already
 * whole and a cleanse with nothing to remove do nothing, so none of them spends the item.
 */

/**
 * Fire every carried rule waiting on `eventId`.
 * @param {string} instanceId the Token where the moment happened: a grant lands from here, and a
 * status resolves its target from whoever works this Token
 * @param {string} heroId the hero whose loadout is being read
 * @param {string} eventId a `TRIGGER_EVENTS` id, e.g. `CYCLE_START`
 * @returns {number} how many rules actually did something
 */
export function fire(instanceId, heroId, eventId) {
    if (!heroId || instanceId == null) return 0;

    const hero = HeroManager.getHero(heroId);
    if (!hero) return 0;

    // Who a carried rule's roles name. The carrier is `self` and the actor alike; `the enemy` is
    // looked up from that hero by the verb itself, never from the Token.
    const roles = { self: instanceId, selfHeroId: heroId, actor: heroId, source: null };

    let fired = 0;

    for (const statement of HeroEffects.loadoutStatements(hero)) {
        if (statement?.when?.event !== eventId) continue;
        if (!HeroEffects.canPayLoadoutCost(statement)) continue;

        const payload = statement.payload || {};
        let acted = false;

        if (statement.keyword === KEYWORD.APPLIES) {
            // A role, when set, replaces the Token's occupant reading.
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

let unsubscribers = [];

export function teardown() {
    for (const off of unsubscribers) off();
    unsubscribers = [];
}

/**
 * Fires carried rules on `COMBAT_ENGAGED`.
 *
 * ⚠️ Must subscribe after everything else on that event (the trigger moments, via
 * `TriggerSystem.init()` inside `BoardRunner.init()`), so `EventBus`'s in-order loop reaches it
 * last. `EngineBootstrap` calls this after `BoardRunner.init()`/`BoardCombat.init()` for that
 * reason.
 */
export function init() {
    teardown();
    unsubscribers.push(EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, ({ instanceId, heroId }) => {
        fire(instanceId, heroId, 'COMBAT_ENGAGED');
    }));
}
