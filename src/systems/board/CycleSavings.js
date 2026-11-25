import * as TileModifiers from './TileModifiers.js';
import * as HeroEffects from '../hero/HeroEffects.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { CARRIED_KIND } from '../../config/registries/carriedKinds.js';

/**
 * The chances a completed cycle has to save what it would spend: its charges (Refresh) and its
 * materials (Preservation), and the chance a hero's ammo, Food, drink, potion or bait is not used
 * up (Preservation).
 *
 * ⚠️ The bench's work check pins the `Math.random` stream. A roll here draws only when a rule
 * actually offers the chance, so content without one makes no draw and the stream is unchanged.
 */

/**
 * The percent chance a rule-driven `type` gives at Token `instanceId`, narrowed to `category` (one
 * name, or a list of which any may match): resolved from a base of 0 (the Token's neighbours, the
 * guild's stars, its hero). With no Token (a hero who works nothing), the guild's stars alone.
 * Draws nothing.
 */
export function chanceOf(instanceId, type, category) {
    if (!instanceId) return getGlobalAggregator().resolveAxis(type, 0, category);
    return TileModifiers.resolveAxis(instanceId, type, 0, category);
}

/** Whether a roll at `chance` percent hits: one draw, and none at all when there is no chance. */
export function rollChance(chance, random = Math.random) {
    if (!(chance > 0)) return false;
    return random() * 100 < chance;
}

/**
 * Whether a roll at `chance` percent hits, sure at 100 or more: no draw at a sure chance nor at
 * none, one between. The gathering signature perks roll this way, so a perk at its own 100 moves
 * the random stream not at all.
 */
export function sureOrRolled(chance, random = Math.random) {
    if (!(chance > 0)) return false;
    return chance >= 100 || random() * 100 < chance;
}

/**
 * Whether a rule-driven chance on `type` hits, for Token `instanceId` narrowed to `category`:
 * {@link chanceOf}, then rolled once. No chance, no draw.
 */
export function procHits(instanceId, type, category) {
    return rollChance(chanceOf(instanceId, type, category));
}

/**
 * REFRESH: whether this cycle spends none of the Token's charges (a Field, none of its load).
 * The caller asks only for a cycle that succeeded and would spend something.
 */
export function rollRefresh(instanceId, skill) {
    return procHits(instanceId, EFFECT_TYPES.REFRESH, skill);
}

/**
 * NEVER_RUNS_OUT (a shrine's blessing, the Motherlode perk): whether this cycle of `skill` at Token
 * `instanceId` spends none of its own charges (a Field, none of its load), failed or not. A chance
 * from every scope (a Token in reach, the guild's stars, its hero's perks and gear), rolled by
 * {@link sureOrRolled}: sure at 100, one draw below, none with no rule.
 * ⚠️ The one reader of the effect: `BoardRunner.completeCycle` skips the cycle's spend on it, and
 * with the spend the chance to end of a source that ends by chance (`endRoll.endsNow`) and a ripe
 * Field's harvest, so no other place needs to ask. A rule's own charge cost (`TriggerSystem`) is no
 * cycle's spend and is not kept.
 */
export function neverRunsOut(instanceId, skill) {
    return sureOrRolled(chanceOf(instanceId, EFFECT_TYPES.NEVER_RUNS_OUT, skill));
}

/**
 * ECHO (a shrine's blessing): whether a finished cycle of `skill` at Token `instanceId` repeats at
 * once, for free. No chance, no draw.
 */
export function rollEcho(instanceId, skill) {
    return procHits(instanceId, EFFECT_TYPES.ECHO, skill);
}

/**
 * VALIANT (a shrine's blessing): whether `heroId`, brought to 0 HP fighting enemy Token `instanceId`,
 * flees instead of being Defeated, keeping everything. A chance from every scope (a shrine reaching
 * the enemy, the guild's stars, the hero's own perks and gear), rolled by {@link sureOrRolled}: sure
 * at 100 (no draw), one draw below, none with no rule. Read by `BoardCombat.resolveDefeat` alone.
 */
export function fleesDefeat(instanceId, heroId) {
    if (!instanceId) return false;
    return sureOrRolled(TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.VALIANT, 0, undefined, heroId || undefined));
}

/**
 * PRESERVATION on a cycle: the percent chance a cycle of `skill` at Token `instanceId` uses none of
 * its materials. Asked first and rolled later (`rollChance`): `BoardRunner.completeCycle` rolls it
 * only once it knows the cycle did not fail, and keeps its old order when nothing offers it.
 */
export function preservationChance(instanceId, skill) {
    return chanceOf(instanceId, EFFECT_TYPES.PRESERVATION, skill);
}

/**
 * PRESERVATION on something a hero carries: whether item `itemId`, about to be used up as a `kind`
 * (`carriedKinds.js`: ammo, Food, a drink…), is kept instead. Read at Token `instanceId`, the one the
 * hero works or the enemy they fight (null: none, so only the guild's stars reach it), narrowed to
 * the item or its kind (none: the item alone). One draw when a rule offers the chance, none
 * otherwise.
 */
export function keepsCarried(instanceId, itemId, kind, random = Math.random) {
    if (!itemId) return false;
    return rollChance(chanceOf(instanceId, EFFECT_TYPES.PRESERVATION, kind ? [itemId, kind] : itemId), random);
}

/**
 * The kind (`carriedKinds.js`) an item counts as when it spends itself as its own rule fires, by its
 * loadout category: Food, a drink, and a Consumable as a potion. Anything else (a trinket) has no
 * kind, so only a rule naming the item itself, or keeping everything, reaches it.
 */
export function spentKindOf(itemId) {
    switch (getItem(itemId)?.equipSlot) {
        case 'food': return CARRIED_KIND.FOOD;
        case 'drink': return CARRIED_KIND.DRINK;
        case 'consumable': return CARRIED_KIND.POTION;
        default: return null;
    }
}

/**
 * PRESERVATION on an item that spends itself as its rule fires (a carried rule's charge,
 * `HeroEffects.payLoadoutCost`, owner 2026-11-11): the rule has fired, and the item that would pay
 * is kept instead on a hit. Read at Token `instanceId` (the one the hero works, or the enemy they
 * fight), narrowed to the item or its kind. One roll when an item would be used up and a rule offers
 * the chance; a free rule, or no rule, draws nothing.
 * @returns {boolean} whether the cost was met (paid or kept), as `payLoadoutCost` answers
 */
export function payItemRule(instanceId, statement) {
    return HeroEffects.payLoadoutCost(statement, (itemId) => keepsCarried(instanceId, itemId, spentKindOf(itemId)));
}
