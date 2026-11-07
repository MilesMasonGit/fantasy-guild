// the Shop: buying Tokens

import { EventBus } from '../core/EventBus.js';
import {
    getTokenType, getAllTokenTypes, tokenName, tokenStartingUses
} from '../../config/registries/tokenRegistry.js';
import { getItem } from '../../config/registries/itemRegistry.js';
import { foundationTierOf } from '../../config/registries/tokenConstants.js';
import { getSkill } from '../../config/registries/skillRegistry.js';
import { recipesForFoundation } from '../../config/registries/recipePoolRegistry.js';
import { totalPrice } from '../../config/guildUpgrades.js';
import * as BoardState from './BoardState.js';
import * as InputAllocator from './InputAllocator.js';
import * as MatCap from './MatCap.js';
import * as Placement from './Placement.js';
import { logger } from '../../utils/Logger.js';
import { matW, matH } from '../../config/matGeometry.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';
import { BOARD_EVENTS } from './boardEvents.js';

/**
 * Sells every Token type that carries a `shop` block: `shop: { price: [{ itemId, quantity }],
 * section?: '<skill id>' | 'general', group?: '<label>', skills?: ['<skill id>'], order?: n }`.
 * The Shop itself no longer reads `section`; the Token Summary still sorts by it ({@link sectionName}).
 * `skills` are the skill icons the Shop shows on the Token, authored rather than worked out from
 * its recipes (several buildings have no skill of their own); `order` is its place in the list,
 * lowest first, with unordered Tokens after the ordered ones.
 *
 * Everything with a `shop` block is listed from the start; the price is the only gate. Items are
 * the only price, paid all or nothing through `InputAllocator` (Bank first, then loot on the
 * floor). A purchase is refused once the mat's Token count reaches `MatCap.matCap()`.
 *
 * A bought Token is created with `origin: 'placed'`, beside the Guild Hall via
 * `Placement.placeArrivalNear` aimed at `Placement.centreOfBoard()`. When that area is crowded it
 * lands on the nearest legal free spot on the mat; only a mat with no legal spot refuses.
 */

/** The section every Token without a skill section falls under (the Token Summary's headings). */
export const GENERAL_SECTION = 'general';

const refuse = (reason) => ({ success: false, reason });

/** A Token type's shop block, or null when it is not sold. */
export function shopBlockOf(typeId) {
    const shop = getTokenType(typeId)?.shop;
    return shop && Array.isArray(shop.price) ? shop : null;
}

/** The skill icons a sold Token shows, in authored order: real skill ids only, each once. */
export function shopSkillsOf(typeId) {
    const skills = shopBlockOf(typeId)?.skills;
    if (!Array.isArray(skills)) return [];
    return [...new Set(skills.filter(id => typeof id === 'string' && getSkill(id)))];
}

/** A sold Token's place in the list, or Infinity when it has none. */
export function shopOrderOf(typeId) {
    const order = shopBlockOf(typeId)?.order;
    return Number.isFinite(order) ? order : Infinity;
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
        return { ...refuse(`Token cap full (${MatCap.tokenCount()}/${MatCap.matCap()})`), capFull: true };
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
 * The Shop panel does not call this: a card is dragged onto the mat and bought there ({@link
 * buyAt}). Only tests call it.
 *
 * @returns {{success: boolean, reason?: string, instance?: object}}
 */
export function buy(typeId) {
    return purchase(typeId, (instance) => Placement.placeArrivalNear(instance, Placement.centreOfBoard()));
}

/**
 * Buy one Token where the player let it go: a Shop card dragged onto the mat pays on drop. The same
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
        EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: instance.id, x: placed.x, y: placed.y, typeId: null });
        return refuse('Not enough items');
    }

    EventBus.publish(ENGINE_EVENTS.TOKEN_PURCHASED, { typeId, instanceId: instance.id, price });
    logger.info('Shop', `Bought ${tokenName(typeId)}`);
    return { success: true, instance, x: placed.x, y: placed.y, nudged: !!placed.nudged };
}

/** Total quantity of a price, used to order a group cheapest first. */
const priceWeight = (typeId) => priceOf(typeId).reduce((n, l) => n + l.quantity, 0);

/** A group member's Foundation tier, or 0 for a Token that is not a Foundation. */
const tierWeight = (typeId) => {
    const def = getTokenType(typeId);
    return def?.foundation ? foundationTierOf(def) : 0;
};

/**
 * The Tokens a Foundation can be built into, by name, each once, in its pool's order. Empty for a
 * Token that is not a Foundation.
 */
export function buildsOf(typeId) {
    const def = getTokenType(typeId);
    if (!def?.foundation) return [];
    const names = [];
    for (const recipe of recipesForFoundation(def)) {
        const built = (recipe.outputs || []).find(o => o?.tokenId)?.tokenId;
        const name = built ? (tokenName(built) || built) : null;
        if (name && !names.includes(name)) names.push(name);
    }
    return names;
}

/**
 * The catalogue for the panel: every sold Token, one list in `shop.order`, then name, unordered
 * Tokens last. Each entry carries its `skills` (icons) and `order`.
 *
 * Tokens whose `shop.group` is the same label are one entry: `{ group, name: <label>, options,
 * typeId, price, affordability, skills, order }`, where `options` lists the members lowest
 * Foundation tier first, then cheapest first; the top-level `typeId`, `price`, `affordability` and
 * `skills` are the first option's and `order` is the lowest of them. Every option is selectable;
 * each is gated only by its own price.
 *
 * @returns {Array<{typeId, name, price, affordability, skills, order, group?, options?}>}
 */
export function catalogue() {
    const entries = [];
    const groups = new Map();
    const entryOf = (typeId) => ({
        typeId,
        name: tokenName(typeId) || typeId,
        price: priceLines(typeId),
        affordability: canBuy(typeId),
        skills: shopSkillsOf(typeId),
        order: shopOrderOf(typeId)
    });
    for (const typeId of Object.keys(getAllTokenTypes())) {
        const shop = shopBlockOf(typeId);
        if (!shop) continue;
        const label = typeof shop.group === 'string' ? shop.group.trim() : '';
        if (label) {
            if (!groups.has(label)) {
                const entry = { group: label, name: label, options: [] };
                groups.set(label, entry);
                entries.push(entry);
            }
            groups.get(label).options.push(entryOf(typeId));
            continue;
        }
        entries.push(entryOf(typeId));
    }
    for (const entry of groups.values()) {
        entry.options.sort((a, b) => tierWeight(a.typeId) - tierWeight(b.typeId)
            || priceWeight(a.typeId) - priceWeight(b.typeId)
            || a.name.localeCompare(b.name));
        const [first] = entry.options;
        entry.typeId = first.typeId;
        entry.price = first.price;
        entry.affordability = first.affordability;
        entry.skills = first.skills;
        entry.order = Math.min(...entry.options.map(o => o.order));
    }
    // Infinity - Infinity is NaN, so unordered entries compare by hand.
    const byOrder = (a, b) => (a.order === b.order ? 0 : a.order < b.order ? -1 : 1);
    return entries.sort((a, b) => byOrder(a, b) || a.name.localeCompare(b.name));
}

/** The header figure: Tokens counting toward the cap, against it. */
export function capStatus() {
    return { count: MatCap.tokenCount(), cap: MatCap.matCap() };
}
