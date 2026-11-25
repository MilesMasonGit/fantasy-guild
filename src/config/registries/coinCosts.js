// Coin costs and coin drops: what a Shop Token asks in coins, what an enemy drops
//
// ⚠️ THE CMS IMPORTS THIS FILE ACROSS THE PROJECT BOUNDARY (`cms/src/utils/constants.js`): the
// Shop block's Coins field, the enemy's Coin drop field and the audit read it. Pure, with no imports.

/**
 * A coin cost sits beside a price's items: `shop.coins` on a Token sold at the Shop (a Foundation
 * among them), and `prices[ring].coins` in the world tables (`worldTablesShape.js`). An enemy's
 * `enemy.coinDrop` is the coins one kill drops. Each is a whole number of coins; absent is 0.
 */

/**
 * The item whose art and name a coin pile and a coin price line show. Coins are a number on the
 * guild, never banked: a pile of this item pays the count when collected (`SpriteLayer`).
 */
export const COIN_ITEM_ID = 'item_coins';

/** A written coin amount as a whole number of 0 or more, or null when it is not one. */
function coinValue(value) {
    const n = Number(value);
    return value !== '' && value !== null && Number.isInteger(n) && n >= 0 ? n : null;
}

/** A coin amount as written: a whole number of 0 or more, else 0. */
export function coinsOf(value) {
    if (value == null) return 0;
    return coinValue(value) ?? 0;
}

/** The coins a Token sold at the Shop asks beside its items. */
export function shopCoinsOf(def) {
    return coinsOf(def?.shop?.coins);
}

/** The coins one kill of this enemy drops, before any rule in reach raises them. */
export function enemyCoinDropOf(def) {
    if (!def?.enemy || typeof def.enemy !== 'object') return 0;
    return coinsOf(def.enemy.coinDrop);
}

/** Why a written coin amount is not read, or null when it is (or is absent). */
export function coinAmountProblem(value, label) {
    if (value == null || coinValue(value) != null) return null;
    return `its ${label} "${value}" is not a whole number of 0 or more, so it counts as 0`;
}

/**
 * Every Token whose Shop coins or enemy Coin drop is not read: `{ entityType: 'Token', entityId,
 * entityName, message }`. For the boot audit and the CMS Economy Audit.
 */
export function coinCostFindings({ tokens = {} } = {}) {
    const out = [];
    for (const [id, def] of Object.entries(tokens || {})) {
        const where = { entityType: 'Token', entityId: def?.id || id, entityName: def?.name || id };
        const shop = coinAmountProblem(def?.shop?.coins, 'Shop coins');
        if (shop) out.push({ ...where, message: shop });
        const drop = def?.enemy && typeof def.enemy === 'object' ? coinAmountProblem(def.enemy.coinDrop, 'Coin drop') : null;
        if (drop) out.push({ ...where, message: drop });
    }
    return out;
}
