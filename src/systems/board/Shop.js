// the Shop: buying Tokens

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
import { logger } from '../../utils/Logger.js';
import { matW, matH } from '../../config/matGeometry.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * Sells every Token type that carries a `shop` block: `shop: { price: [{ itemId, quantity }],
 * section: '<skill id>' | 'general' }`.
 *
 * Everything with a `shop` block is listed from the start; the price is the only gate. Items are
 * the only price, paid all or nothing through `InputAllocator` (Bank first, then loot on the
 * floor). A purchase is refused once placed Tokens reach `MatCap.matCap()`.
 *
 * A bought Token is created with `origin: 'placed'`, beside the Guild Hall via
 * `Placement.placeArrivalNear` aimed at `Placement.centreOfBoard()`. When that area is crowded it
 * lands on the nearest legal free spot on the mat; only a mat with no legal spot refuses.
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
 * The price shaped for display, with what the Bank holds against each line: `[{ itemId, name, need,
 * have, enough }]`. `have` counts loot on the floor too, since payment takes that as well.
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
 * Buy one Token: check the cap and the price, put it on the mat beside the Guild Hall (or the
 * nearest free spot to it), then take the items. Placing first means a mat with no room refuses the
 * purchase without taking anything; nothing runs between the check and the payment, so the payment
 * cannot then fall short.
 *
 * The Shop drawer does not call this: a row is dragged onto the mat and bought there ({@link
 * buyAt}). Only tests call it.
 *
 * @returns {{success: boolean, reason?: string, instance?: object}}
 */
export function buy(typeId) {
    return purchase(typeId, (instance) => Placement.placeArrivalNear(instance, Placement.centreOfBoard()));
}

/**
 * Buy one Token where the player let it go: a Shop row dragged onto the mat pays on drop. The same
 * checks as {@link buy}, but the Token goes through `Placement.placeTokenAt` at `point` (exactly
 * there, or nudged to the nearest legal spot) rather than beside the Hall.
 *
 * A point off the mat is refused with `offMat`: the drop is a plain cancel. A placement refusal
 * charges nothing and keeps its `full` flag, so the drag flies back. `noRestock`: a bought Token is
 * always a new Token, never charges poured into a copy it was dropped on.
 *
 * @param {string} typeId
 * @param {{x:number, y:number}} point mat units
 * @returns {{success: boolean, reason?: string, instance?: object, full?: boolean, offMat?: boolean}}
 */
export function buyAt(typeId, point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
        || point.x < 0 || point.y < 0 || point.x > matW() || point.y > matH()) {
        return { ...refuse('Not on the mat'), offMat: true };
    }
    return purchase(typeId, (instance) => Placement.placeTokenAt(instance, point, { noRestock: true }));
}

/**
 * The one purchase path: check, make the instance, let `place` put it on the
 * mat, and only then take the items. A refused placement comes back as it
 * came (its `full` flag included) with nothing taken.
 */
function purchase(typeId, place) {
    const allowed = canBuy(typeId);
    if (!allowed.success) return allowed;

    const price = priceOf(typeId);
    const instance = BoardState.createTokenInstance(
        typeId, tokenStartingUses(typeId), null, BoardState.ORIGIN.PLACED
    );
    instance.bornAt = Date.now();

    const placed = place(instance);
    if (!placed?.success) return { ...(placed || {}), ...refuse(placed?.reason || 'No room on the mat') };

    if (!InputAllocator.consumeInputs(price)) {
        // Unreachable in practice (checked above); undo the placement so a
        // Token is never handed out for free.
        BoardState.removeToken(instance.id);
        EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
        return refuse('Not enough items');
    }

    EventBus.publish(ENGINE_EVENTS.TOKEN_PURCHASED, { typeId, instanceId: instance.id, price });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
    logger.info('Shop', `Bought ${tokenName(typeId)}`);
    return { success: true, instance, x: placed.x, y: placed.y, nudged: !!placed.nudged };
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
