// what a Token cost the guild, and the two building perks: Build Discount off Foundations and builds, Salvage back on a demolition

import { GameState } from '../../state/GameState.js';
import * as HeroManager from '../hero/HeroManager.js';
import { loadoutStatements } from '../hero/HeroEffects.js';
import { modifierStatements } from '../effects/LiveEffects.js';
import { getGlobalAggregator } from '../effects/GuildModifiers.js';
import { KEYWORD } from '../effects/statements.js';
import { EFFECT_TYPES } from '../effects/constants.js';
import { getTokenType } from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { COIN_ITEM_ID } from '../../config/registries/coinCosts.js';
import {
    buildDiscountOf, salvageShareOf, discounted, discountedLines, paidRecord, addPaid, salvagedPrice
} from '../../config/buildPrices.js';
import * as BoardState from './BoardState.js';
import * as SpriteLayer from './SpriteLayer.js';

/**
 * Both perks are a percent in the flat bucket, read from a hero (what they carry, their perks, what
 * lingers on them) and from the guild's stars, never from a Token (`heroOrGuild` in the palette).
 *
 * **Build Discount** (Master Builder): percent off a Foundation's Shop price, items and coins each
 * rounded up (`Shop.priceOf`), and off the materials of a build on a Foundation, made whole by chance
 * as the cycle pays as an Efficiency cost is (`InputCost`), so the check, the card and the pay agree.
 * The guild's best hero counts, never the sum of several, and never more than `MAX_BUILD_DISCOUNT`.
 * Read as the heroes stand: nothing about it is saved.
 *
 * **Salvage**: when a hero holding it demolishes a Token, that hero's share of what the Token cost
 * (`instance.paid`, below) lands as loot where it stood, each line and the coins rounded down, the
 * coins as a coin pile; at most all of it.
 *
 * **What a Token cost** is kept on it, saved: `paid: { items, coins }` (`config/buildPrices.js`).
 * The Shop writes it as it sells a Token (`recordPaid`), and a build hands its Foundation's on to the
 * building with the materials the build paid (`paidAfterBuild`). A Token nobody paid for, or one
 * bought before the record was kept, has none and gives nothing back.
 *
 * ⚠️ The bench's work check pins the `Math.random` stream: nothing here draws, but a salvage's loot
 * lands as any drop does (two draws a pile), and a cut that leaves a build's material a fraction is
 * made whole by chance. Content without either perk draws nothing more.
 */

/** A hero's own `type`: the flat sum of what they carry and what lingers on them, plus the guild's stars'. */
function heroPercent(hero, type) {
    let total = getGlobalAggregator().getFlat(type);
    if (!hero || typeof hero !== 'object') return total;
    for (const statements of [loadoutStatements(hero), modifierStatements(hero)]) {
        for (const statement of statements) {
            if (statement?.keyword !== KEYWORD.PROVIDES || statement.when?.event) continue;
            const payload = statement.payload || {};
            if (payload.type !== type || (payload.bucket && payload.bucket !== 'flat')) continue;
            const value = Number(payload.value);
            if (Number.isFinite(value)) total += value;
        }
    }
    return total;
}

/**
 * The guild's Build Discount now: its best hero's, in percent, 0 to `MAX_BUILD_DISCOUNT`. A guild
 * with no hero has none.
 */
export function buildDiscount() {
    let best = 0;
    for (const hero of GameState.state?.heroes || []) best = Math.max(best, heroPercent(hero, EFFECT_TYPES.BUILD_DISCOUNT));
    return buildDiscountOf(best);
}

/** The Shop's price lines for a Token of type `def`: a Foundation's with the guild's Build Discount off. */
export function shopLines(def, lines) {
    return def?.foundation ? discountedLines(lines, buildDiscount()) : lines;
}

/** The Shop's coins for a Token of type `def`: a Foundation's with the guild's Build Discount off. */
export function shopCoins(def, coins) {
    return def?.foundation ? discounted(coins, buildDiscount()) : coins;
}

/**
 * What one unit of a cycle's input costs at Token `instanceId` beside Efficiency: the guild's Build
 * Discount on a Foundation's build (`0.8` at 20 %), else 1.
 */
export function inputFactorAt(instanceId) {
    const def = getTokenType(BoardState.getTokenById(instanceId)?.typeId);
    if (!def?.foundation) return 1;
    return (100 - buildDiscount()) / 100;
}

/** What a Token cost the guild, as kept on it: `{ items, coins }`, or null when nothing is. */
export function paidOf(instance) {
    return paidRecord(instance?.paid);
}

/** Keep on `instance` what the guild paid for it (items as `[{ itemId, quantity }]`, coins); nothing kept when nothing was paid. */
export function recordPaid(instance, items, coins = 0) {
    if (!instance) return;
    const paid = paidRecord({ items, coins });
    if (paid) instance.paid = paid;
    else delete instance.paid;
}

/**
 * What a building made on Foundation `foundation` cost: the Foundation's own record and the
 * materials the build paid (`[{ itemId, quantity }]`), as one record, or null when both are nothing.
 */
export function paidAfterBuild(foundation, materials) {
    return addPaid(foundation?.paid, { items: materials || [], coins: 0 });
}

/** The demolisher `heroId`'s Salvage, in percent: 0 to `MAX_SALVAGE`. */
export function salvageShare(heroId) {
    if (!heroId) return 0;
    const hero = HeroManager.getHero(heroId);
    return hero ? salvageShareOf(heroPercent(hero, EFFECT_TYPES.SALVAGE)) : 0;
}

/**
 * What demolishing `instance` gives back to hero `heroId`: their Salvage share of what it cost,
 * `{ items, coins }`, or null when nothing comes back (no Salvage, nothing paid). Draws nothing.
 */
export function salvageOf(instance, heroId) {
    const paid = paidOf(instance);
    if (!paid) return null;
    const share = salvageShare(heroId);
    return share > 0 ? salvagedPrice(paid, share) : null;
}

/**
 * Land a salvage as loot round mat point `at` (where the Token stood): each item a drop of its own,
 * the coins a coin pile. An item gone from the content is not given back.
 */
export function dropSalvage(salvage, at) {
    if (!salvage || !at) return;
    const source = { centre: at };
    for (const { itemId, quantity } of salvage.items) {
        if (getItem(itemId)) SpriteLayer.addSprite('item', itemId, quantity, source);
    }
    if (salvage.coins > 0) SpriteLayer.addSprite('item', COIN_ITEM_ID, salvage.coins, source);
}
