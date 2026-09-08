// Fantasy Guild — carried rules firing at a named moment (Unified Effects P5/P6)

import * as HeroManager from '../hero/HeroManager.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import * as StatusApplication from './StatusApplication.js';
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
 */

/**
 * Fire every carried rule waiting on `eventId`.
 *
 * @param {number} tile   where the moment happened — a grant lands here, and a
 *                        status resolves its target from this tile's occupants
 * @param {string} heroId the hero whose loadout is being read
 * @param {string} eventId a `TRIGGER_EVENTS` id, e.g. `CYCLE_START`
 * @returns {number} how many rules actually did something
 */
export function fire(tile, heroId, eventId) {
    if (!heroId || tile == null) return 0;

    const hero = HeroManager.getHero(heroId);
    if (!hero) return 0;

    let fired = 0;

    for (const statement of HeroEffects.loadoutStatements(hero)) {
        if (statement?.when?.event !== eventId) continue;
        if (!HeroEffects.canPayLoadoutCost(statement)) continue;

        const payload = statement.payload || {};
        let acted = false;

        if (statement.keyword === KEYWORD.APPLIES) {
            acted = StatusApplication.applyAt(tile, payload);
        } else if (statement.keyword === KEYWORD.GRANTS && payload.itemId) {
            const chance = payload.chance ?? 100;
            if (chance >= 100 || Math.random() * 100 < chance) {
                SpriteLayer.addSprite('item', payload.itemId, Math.max(1, payload.quantity || 1), tile);
                acted = true;
            }
        }

        if (!acted) continue;
        HeroEffects.payLoadoutCost(statement);
        EffectFeedback.announce(tile, statement);
        fired += 1;
    }

    return fired;
}
