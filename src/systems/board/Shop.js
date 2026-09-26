// Fantasy Guild — The Shop (Token Lifecycle slice 5.1, SP-12 / SP-13 / SP-65 / SP-67)

import { EventBus } from '../core/EventBus.js';
import {
    getTokenType, getAllTokenTypes, tokenName, tokenStartingUses
} from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { totalPrice } from '../../config/guildUpgrades.js';
import * as BoardState from './BoardState.js';
import * as InputAllocator from './InputAllocator.js';
import * as MatCap from './MatCap.js';
import * as Placement from './Placement.js';
import { centreOfBoard } from './Cartographer.js';
import { logger } from '../../utils/Logger.js';

/**
 * The Shop — the reworked Cartographer (SP-12).
 *
 * Sells every Token type that carries a `shop` block (roadmap §3.1):
 * `shop: { price: [{ itemId, quantity }], section: '<skill id>' | 'general' }`.
 *
 * * **No unlocks** (SP-13): everything with a `shop` block is listed from the
 *   start; the price is the only gate.
 * * **Items are the only price** (SP-65). Payment is all or nothing through
 *   `InputAllocator` (Bank first, then loot on the floor), the same path Map
 *   purchases use.
 * * **The mat cap** (SP-67): a purchase is refused once the placed Tokens
 *   reach `MatCap.matCap()`.
 * * A bought Token lands **beside the Guild Hall** (FP-18), through
 *   `Placement.placeTokenAt` at `Cartographer.centreOfBoard()` — the route the
 *   Vault's click-to-place uses — created with `origin: 'placed'`.
 */

/** The section every Token without a skill section falls under. */
export const GENERAL_SECTION = 'general';

const refuse = (reason) => ({ success: false, reason });

/** A Token type's shop block, or null when it is not sold. */
export function shopBlockOf(typeId) {
    const shop = getTokenType(typeId)?.shop;
    return shop && Array.isArray(shop.price) ? shop : null;
}

/** A Token's price, merged per item: `[{ itemId, quantity }]`. */
export function priceOf(typeId) {
    return totalPrice(shopBlockOf(typeId)?.price || []);
}

/** The heading a section is shown under: the skill's name, or "General". */
export function sectionName(section) {
    if (!section || section === GENERAL_SECTION) return 'General';
    return getSkill(section)?.name || section;
}

/**
 * The price shaped for display, with what the Bank holds against each line:
 * `[{ itemId, name, need, have, enough }]`. `have` counts loot on the floor
 * too, since payment takes that as well (D-42).
 */
export function priceLines(typeId) {
    return priceOf(typeId).map(({ itemId, quantity }) => {
        const have = InputAllocator.availableOf(itemId);
        return {
            itemId,
            name: getItem(itemId)?.name || itemId,
            need: quantity,
            have,
            enough: have >= quantity
        };
    });
}

/** What the Bank is short of, as "3× Oak Wood, 1× Stone". Empty when it can pay. */
function shortfallText(typeId) {
    return priceLines(typeId)
        .filter(l => !l.enough)
        .map(l => `${l.need - l.have}× ${l.name}`)
        .join(', ');
}

/**
 * Whether a Token can be bought right now, and why not. Every refusal names
 * its cause, so the button can say it.
 */
export function canBuy(typeId) {
    if (!shopBlockOf(typeId)) return refuse('Not sold at the Shop');
    if (!MatCap.canPlaceMore(1)) {
        return refuse(`Mat is full (${MatCap.placedCount()}/${MatCap.matCap()} placed Tokens)`);
    }
    const missing = shortfallText(typeId);
    if (missing) return refuse(`Need ${missing}`);
    return { success: true };
}

/**
 * Buy one Token: check the cap and the price, put it on the mat beside the
 * Guild Hall, then take the items. Placing first means a mat with no room
 * refuses the purchase without taking anything; nothing runs between the check
 * and the payment, so the payment cannot then fall short.
 *
 * @returns {{success: boolean, reason?: string, instance?: object}}
 */
export function buy(typeId) {
    const allowed = canBuy(typeId);
    if (!allowed.success) return allowed;

    const price = priceOf(typeId);
    const instance = BoardState.createTokenInstance(
        typeId, tokenStartingUses(typeId), null, BoardState.ORIGIN.PLACED
    );
    instance.bornAt = Date.now();

    const placed = Placement.placeTokenAt(instance, centreOfBoard());
    if (!placed?.success) return refuse(placed?.reason || 'No room on the mat');

    if (!InputAllocator.consumeInputs(price)) {
        // Unreachable in practice (checked above); undo the placement so a
        // Token is never handed out for free.
        BoardState.removeToken(instance.id);
        EventBus.publish('state_changed');
        return refuse('Not enough items');
    }

    EventBus.publish('token_purchased', { typeId, instanceId: instance.id, price });
    EventBus.publish('state_changed');
    logger.info('Shop', `Bought ${tokenName(typeId)}`);
    return { success: true, instance };
}

/**
 * The catalogue for the panel: every sold Token, grouped by section. Sections
 * are ordered by name with General last; Tokens within a section by name.
 *
 * @returns {Array<{section, name, items: Array<{typeId, name, price, affordability}>}>}
 */
export function catalogue() {
    const bySection = new Map();
    for (const typeId of Object.keys(getAllTokenTypes())) {
        const shop = shopBlockOf(typeId);
        if (!shop) continue;
        const section = shop.section || GENERAL_SECTION;
        if (!bySection.has(section)) bySection.set(section, []);
        bySection.get(section).push({
            typeId,
            name: tokenName(typeId) || typeId,
            price: priceLines(typeId),
            affordability: canBuy(typeId)
        });
    }
    return [...bySection.entries()]
        .map(([section, items]) => ({
            section,
            name: sectionName(section),
            items: items.sort((a, b) => a.name.localeCompare(b.name))
        }))
        .sort((a, b) => {
            if (a.section === GENERAL_SECTION) return 1;
            if (b.section === GENERAL_SECTION) return -1;
            return a.name.localeCompare(b.name);
        });
}

/** The header figure: placed Tokens against the cap. */
export function capStatus() {
    return { placed: MatCap.placedCount(), cap: MatCap.matCap() };
}
