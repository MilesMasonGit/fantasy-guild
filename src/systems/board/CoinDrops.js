// coins a kill drops, and the coins a theft takes, raised by Coin Find in reach

import * as TileModifiers from './TileModifiers.js';
import * as SpriteLayer from './SpriteLayer.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { enemyCoinDropOf, COIN_ITEM_ID } from '../../config/registries/coinCosts.js';

/**
 * An enemy's Coin drop (`enemy.coinDrop`, `coinCosts.js`) lands as a pile of the coin item where it
 * stood, collected like any loot into the guild's coins (`SpriteLayer.collectSprite`). Coin Find
 * (`EFFECT_TYPES.COIN_FIND`) on a building raises it for every enemy defeated in its reach, and the
 * coins a Hideout in its reach steals the same way ({@link stolenCoins}).
 *
 * ⚠️ Draws from `Math.random` only when a pile lands (its landing spot, as any drop's): an enemy
 * with no Coin drop draws nothing, so content without coins keeps the bench's stream.
 */

/** `coins` raised by every Coin Find rule reaching Token `instanceId`, in whole coins (rounded). */
function raised(instanceId, coins, skill) {
    const base = Math.max(0, Math.floor(Number(coins) || 0));
    if (base <= 0) return 0;
    return Math.max(0, Math.round(TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.COIN_FIND, base, skill)));
}

/** The coins one kill of enemy `def` on Token `instanceId` drops, Coin Find in reach counted. */
export function killCoins(instanceId, def, skill) {
    return raised(instanceId, enemyCoinDropOf(def), skill);
}

/**
 * Land a kill's coins as a pile where the enemy stood: the drop as the loot event lists it,
 * `{ itemId, quantity, coins: true }`, or null when it drops none.
 */
export function dropKillCoins(instanceId, def, skill) {
    const coins = killCoins(instanceId, def, skill);
    if (coins <= 0) return null;
    SpriteLayer.addSprite('item', COIN_ITEM_ID, coins, instanceId);
    return { itemId: COIN_ITEM_ID, quantity: coins, coins: true };
}

/**
 * The coins a theft at Hideout `hideoutId` takes when its steal table asks `coins`
 * (`coinCosts.stealCoinsOf`): raised by Coin Find reaching the Hideout, as a kill's are by Coin
 * Find reaching the enemy. Coin Find reaching only the camp raises nothing: a theft is made where
 * the thief works.
 */
export function stolenCoins(hideoutId, coins, skill) {
    return raised(hideoutId, coins, skill);
}

/**
 * Land a theft's coins as a pile at the Hideout, as its stolen lines land: the line as a theft's
 * word lists it, `{ itemId, quantity, coins: true }`, or null when the table takes none. Called once
 * per theft that is not caught, and once more for its Echo.
 */
export function dropStolenCoins(hideoutId, steal, skill) {
    const coins = stolenCoins(hideoutId, steal?.coins, skill);
    if (coins <= 0) return null;
    SpriteLayer.addSprite('item', COIN_ITEM_ID, coins, hideoutId);
    return { itemId: COIN_ITEM_ID, quantity: coins, coins: true };
}
