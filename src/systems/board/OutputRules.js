import * as TileModifiers from './TileModifiers.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as EffectFeedback from './EffectFeedback.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import { EFFECT_TYPES } from '../effects/constants.js';

/**
 * The output rules a finished cycle pays through: a station's cycle (`BoardRunner`) and a kill
 * (`LootSystem`), so a nearby rule means the same thing beside either.
 *
 * ⚠️ Each helper draws from `Math.random` in a fixed order (and `roundUp` always draws once, even
 * on a whole number); the bench's work check pins that stream, so keep the draws as they are.
 */

/**
 * LOOT_MULT: the chance for double loot, resolved to a percentage and rolled ONCE per cycle, so a
 * lucky cycle doubles everything it made rather than a random subset of it.
 */
export function rollDoubleLoot(instanceId, skill) {
    const chance = TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.LOOT_MULT, 0, skill);
    return chance > 0 && Math.random() * 100 < chance;
}

/**
 * A fractional quantity rounded probabilistically, so a x1.5 yield is 1 plus a 50% chance of a
 * 2nd, rather than silently truncating every small buff to nothing.
 */
export function roundUp(scaled) {
    const whole = Math.floor(scaled);
    return whole + (Math.random() < (scaled - whole) ? 1 : 0);
}

/**
 * YIELD, widened to the neighbours, applied to a quantity already rolled: a Sawmill scales what
 * this cycle actually rolled, not the range's midpoint.
 */
export function widenYield(instanceId, skill, rolled) {
    return roundUp(Math.max(0, TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.YIELD, rolled, skill)));
}

/**
 * BONUS_DROP: nearby grants of something the Token does not make itself, rolled per entry after
 * its own outputs. Each lands on the board like any other output.
 * @returns {string[]} the item ids that landed
 */
export function dropBonusGrants(instanceId) {
    const landed = [];
    for (const grant of TileModifiers.collectItemGrants(instanceId, EFFECT_TYPES.BONUS_DROP)) {
        const chance = grant.chance ?? 100;
        if (chance < 100 && Math.random() * 100 > chance) continue;
        // An item-borne grant spends units of the item that granted it. Paid AFTER the roll, so a
        // miss costs nothing: the same charge-burns-on-service-not-on-luck rule Tokens follow. A
        // Token's grant carries no `sourceItemIds` and pays nothing here.
        if (!HeroEffects.payLoadoutCost(grant)) continue;
        const quantity = Math.max(1, grant.quantity || 1);
        SpriteLayer.addSprite('item', grant.itemId, quantity, instanceId);
        landed.push(grant.itemId);
        // Announced only once the roll has actually landed: a 5% grant that missed did nothing,
        // and saying its name would teach the player the opposite of how often it works.
        EffectFeedback.announce(instanceId, grant);
    }
    return landed;
}
