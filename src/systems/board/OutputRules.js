import * as TileModifiers from './TileModifiers.js';
import * as SpriteLayer from './SpriteLayer.js';
import * as EffectFeedback from './EffectFeedback.js';
import * as RareDrops from './RareDrops.js';
import * as SupportLinks from './supportLinks.js';
import * as CycleSavings from './CycleSavings.js';
import { EFFECT_TYPES, GIANT_HARVEST_TIMES, GIANT_HARVEST_SKILLS } from '../effects/constants.js';
import { getHeroCombatStyle } from '../combat/CombatFormulas.js';
import { rollOutputQuantity } from '../../config/registries/tokenRegistry.js';

/**
 * The output rules a finished cycle pays through: a work cycle (`BoardRunner`) and a kill, a combat
 * cycle (`LootSystem`), so a nearby rule means the same thing beside either. A kill takes Yield,
 * Double Loot, Double Item and the bonus drops; Giant Harvest, Refresh and Fail are work's alone.
 *
 * ⚠️ Each helper draws from `Math.random` in a fixed order (and `roundUp` always draws once, even
 * on a whole number); the bench's work check pins that stream, so keep the draws as they are.
 */

/**
 * The skill a kill's loot rules (Double Loot, Yield, Lucky) narrow to: the style the hero won it in,
 * as the kill's XP is (`CombatResolutionProcessor`), so "Double Loot on Melee" reaches a melee kill
 * as "+10 % XP on Melee" does. With no hero, the enemy Token's own skill (every enemy leaves it blank).
 */
export function killLootSkill(hero, def) {
    return hero ? getHeroCombatStyle(hero) : (def?.config?.skill || '');
}

/**
 * LOOT_MULT: the chance for double loot, resolved to a percentage and rolled ONCE per cycle, so a
 * lucky cycle doubles everything it made rather than a random subset of it.
 */
export function rollDoubleLoot(instanceId, skill) {
    const chance = TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.LOOT_MULT, 0, skill);
    return chance > 0 && Math.random() * 100 < chance;
}

export { GIANT_HARVEST_TIMES };

/**
 * GIANT_HARVEST: whether this Farming work cycle's drops all come in at {@link GIANT_HARVEST_TIMES}
 * (every line and the rare table's find; with Double Loot as well, both apply). Rolled ONCE per
 * cycle, like Double Loot. Other work never rolls it, whatever rule reaches it, and a kill never
 * asks.
 *
 * ⚠️ No draw unless a rule offers the chance to Farming work, so the stream is unchanged without one.
 */
export function rollGiantHarvest(instanceId, skill) {
    if (!GIANT_HARVEST_SKILLS.includes(skill)) return false;
    return CycleSavings.procHits(instanceId, EFFECT_TYPES.GIANT_HARVEST, skill);
}

/**
 * DOUBLE_DROP: a chance that one item, once it has landed, comes out doubled (a Cleaver and Raw
 * Beef). The item is the rule's narrowing, so the axis is resolved per item with the item id as the
 * category; rolled once per item that landed, after its quantity is settled.
 *
 * ⚠️ Draws from `Math.random` only when something offers the chance: content without the rule
 * makes no draw, so the stream (and the bench's work check) is unchanged by it.
 *
 * @returns {number} the quantity that lands
 */
export function doubleItemDrop(instanceId, itemId, quantity) {
    if (!itemId || !(quantity > 0)) return quantity;
    const chance = TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.DOUBLE_DROP, 0, itemId);
    if (!(chance > 0)) return quantity;
    if (!(Math.random() * 100 < chance)) return quantity;
    // The doubled half pops over the Token, sparked from the first support giving the chance (none
    // for a hero's own item).
    EffectFeedback.popBonus(instanceId, quantity, () => SupportLinks.firstSupportOf(instanceId, EFFECT_TYPES.DOUBLE_DROP, itemId));
    return quantity * 2;
}

/**
 * A fractional quantity rounded probabilistically, so a x1.5 yield is 1 plus a 50% chance of a
 * 2nd, rather than silently truncating every small buff to nothing.
 * ⚠️ Not `RNG.roundByChance`: this one draws once even on a whole number, and the bench pins it.
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
 * One item line of a work cycle's drops, once its chance has landed: the authored range rolled
 * FIRST, then widened by Yield (so a 1-5 output buffs a lucky cycle more than an unlucky one), then
 * `times` over (the cycle's Double Loot and Giant Harvest), then Double Item. The rules resolve at
 * Token `instanceId`; the sprite lands from `landAt` (that Token unless named), and `note` hears it.
 * A line naming no item lands nothing (its Yield and rounding still draw, as they always have).
 *
 * @returns {boolean} whether an item landed
 */
export function landItemLine(instanceId, skill, output, times = 1, note = null, landAt = instanceId) {
    const rolled = widenYield(instanceId, skill, rollOutputQuantity(output));
    const widened = rolled * times;
    const quantity = !output.itemId ? widened : doubleItemDrop(instanceId, output.itemId, widened);
    if (quantity <= 0 || !output.itemId) return false;
    const sprite = SpriteLayer.addSprite('item', output.itemId, quantity, landAt);
    note?.(sprite);
    return true;
}

/**
 * BONUS_DROP: nearby grants of something the Token does not make itself, rolled per entry after
 * its own outputs. Each lands on the board like any other output, `times` as many as authored: the
 * cycle's Double Loot (x2) and Giant Harvest (x10) multiply a bonus drop as they do the Token's own.
 * @param {number} [times] the cycle's loot multiplier
 * @returns {Array<{itemId: string, quantity: number}>} what landed
 */
export function dropBonusGrants(instanceId, times = 1) {
    const landed = [];
    for (const grant of TileModifiers.collectItemGrants(instanceId, EFFECT_TYPES.BONUS_DROP)) {
        const chance = grant.chance ?? 100;
        if (chance < 100 && Math.random() * 100 > chance) continue;
        // An item-borne grant spends units of the item that granted it. Paid AFTER the roll, so a
        // miss costs nothing: the same charge-burns-on-service-not-on-luck rule Tokens follow. A
        // Token's grant carries no `sourceItemIds` and pays nothing here.
        // Preservation may keep the item and still land the grant (`CycleSavings.payItemRule`).
        if (!CycleSavings.payItemRule(instanceId, grant)) continue;
        const quantity = Math.max(1, grant.quantity || 1) * times;
        RareDrops.noteDrop(SpriteLayer.addSprite('item', grant.itemId, quantity, instanceId), chance);
        landed.push({ itemId: grant.itemId, quantity });
        // Announced only once the roll has actually landed: a 5% grant that missed did nothing,
        // and saying its name would teach the player the opposite of how often it works.
        EffectFeedback.announce(instanceId, grant, { amount: quantity });
    }
    return landed;
}
