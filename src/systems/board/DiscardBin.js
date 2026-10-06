// Fantasy Guild — The discard bin and its refunds (B3.1: FB-34, FB-35, TL-13)

import { EventBus } from '../core/EventBus.js';
import { InventoryManager } from '../inventory/InventoryManager.js';
import { BOARD_EVENTS } from './boardEvents.js';
import { getAllTokenTypes, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import { recipesForFoundation } from '../../config/registries/recipePoolRegistry.js';
import * as BoardState from './BoardState.js';
import * as Placement from './Placement.js';
import * as Shop from './Shop.js';
import * as Foundations from './Foundations.js';
import * as TimedChanges from './TimedChanges.js';
import { ENGINE_EVENTS } from '../core/engineEvents.js';

/**
 * ⭐ **The discard bin** — how Tokens leave the mat for good (FB-34, TL-13,
 * replacing TL-1 and 5.2's inline Remove). Engine only; the bin's UI is B3.2.
 *
 * ## Holding (B3 interview, 2026-09-27)
 * * Up to {@link BIN_SIZE} Tokens. {@link binToken} lifts one off the mat:
 *   heroes stop working it and its spot frees, exactly as 5.2's Remove did —
 *   the instance leaves `board.tokens`, so the hero's claim names a Token that
 *   is not there and `Flags` releases it (SP-52). It is **not** a depletion: no
 *   `TOKEN_DEPLETED`, so no "when depleted" rule fires and no restock spot is
 *   left behind.
 * * The instance itself is kept, whole, in `board.bin` (`BoardState.binTokens`)
 *   and saved with the game: its charges, its selected recipe, its origin and
 *   any `builtFrom`. Only its in-flight cycle is forfeited, as any
 *   interruption forfeits it (D-54).
 * * **Binned Tokens still count toward the mat cap** (`MatCap.placedCount`
 *   counts placed Tokens in the bin): the bin cannot dodge the cap.
 * * Spawned Tokens may be binned too. Leaving the mat is enough for their
 *   spawner: its family count is taken from the mat, so it has room again and
 *   simply makes another.
 * * {@link unbinToken} puts one back through normal placement, unchanged.
 * * {@link discardAll} is the one confirm (B3 confirm): everything in the bin
 *   goes for good, and the refund is paid through `InventoryManager`, so a
 *   full Bank drops the rest as loot on the mat (D-138).
 *
 * ## Refunds (TL-13) — see {@link refundFor}
 * All rounded **down, per item**.
 */

/** How many Tokens the bin holds (FB-34). */
export const BIN_SIZE = 9;

const refuse = (reason, extra = {}) => ({ success: false, reason, ...extra });

/** A Token's own point, or null. */
const pointOf = (instance) =>
    (instance && Number.isFinite(instance.x) && Number.isFinite(instance.y))
        ? { x: instance.x, y: instance.y }
        : null;

function binChanged(payload) {
    EventBus.publish(BOARD_EVENTS.BIN_CHANGED, { ...payload, count: BoardState.binTokens().length });
}

// ---------------------------------------------------------------------------
// Refunds (TL-13) — pure
// ---------------------------------------------------------------------------

/** Merge `[{ itemId, quantity }]` lists per item, dropping zero lines, in first-seen order. */
function mergeLines(...lists) {
    const merged = new Map();
    for (const list of lists) {
        for (const { itemId, quantity } of list || []) {
            if (!itemId || !(quantity > 0)) continue;
            merged.set(itemId, (merged.get(itemId) || 0) + quantity);
        }
    }
    return [...merged].map(([itemId, quantity]) => ({ itemId, quantity }));
}

/** Half of each line, rounded down per item (TL-13). */
function halfOf(lines) {
    return mergeLines((lines || []).map(l => ({ itemId: l.itemId, quantity: Math.floor((Number(l.quantity) || 0) / 2) })));
}

/**
 * The share of its charges a **consumable** Token has left, as
 * `{ left, starting }`, or null when it is not consumable.
 *
 * A Token is consumable when its type starts with a finite, positive number of
 * charges (`uses`, e.g. an Anvil's 20) and the instance still holds a finite
 * count. Unlimited Tokens (`uses: null`, D-176) are not. `left` is capped at
 * `starting`, so a Token restocked above its start (FP-50) refunds no more
 * than a full one.
 */
export function chargeShare(instance) {
    const starting = tokenStartingUses(instance?.typeId);
    if (!Number.isFinite(starting) || starting <= 0) return null;
    const left = instance?.usesRemaining;
    if (left == null || !Number.isFinite(left)) return null;
    return { left: Math.max(0, Math.min(left, starting)), starting };
}

/**
 * The Foundation type a built Token could have been built on, read from
 * content — for a station built before B3.1, which carries no `builtFrom`.
 * The first Foundation type (by id) whose build recipes output `typeId`, or
 * null.
 */
export function foundationFromContent(typeId) {
    if (!typeId) return null;
    const types = getAllTokenTypes();
    for (const id of Object.keys(types).sort()) {
        const def = types[id];
        if (!def?.foundation) continue;
        if (recipesForFoundation(def).some(r => Foundations.buildTargetOf(r) === typeId)) return id;
    }
    return null;
}

/**
 * ⭐ **What discarding this Token pays back** (TL-13, FB-35), as
 * `[{ itemId, quantity }]`, each line rounded down on its own:
 *
 * * **The Guild Hall** and **spawned** Tokens: nothing. The Hall is never
 *   binned; a spawner simply makes another.
 * * **Built on a Foundation** (`instance.builtFrom`): half the Foundation's
 *   price **plus** half the build cost it paid, each halved and rounded down
 *   separately, then added (owner's example: Workbench = ⌊15/2⌋ + ⌊5/2⌋ =
 *   7 + 2 = 9 Oak Wood). Takes precedence over any shop price of its own.
 * * **Bought** (`Shop.priceOf` is not empty), unlimited charges: half the
 *   price.
 * * **Bought and consumable** (see {@link chargeShare}): per item,
 *   `⌊price × left / (starting × 2)⌋` — the price scaled by the share of
 *   charges left, then halved, rounded down once at the end. Anvil at
 *   10 Copper Ingots with 30 of 60 charges: ⌊10 × 30 / 120⌋ = 2.
 * * **A built station from an older save** (no `builtFrom`, no shop price):
 *   half the price of the Foundation {@link foundationFromContent} finds; the
 *   build cost it paid is not known, so it is not refunded.
 * * Anything else (a Token a recipe made that is not sold): nothing.
 */
export function refundFor(instance) {
    if (!instance?.typeId) return [];
    if (Placement.isPermanentToken(instance.typeId, instance)) return [];
    if (BoardState.originOf(instance) === BoardState.ORIGIN.SPAWNED) return [];

    const built = instance.builtFrom;
    if (built && typeof built === 'object') {
        return mergeLines(
            halfOf(built.foundationTypeId ? Shop.priceOf(built.foundationTypeId) : []),
            halfOf(built.buildCost)
        );
    }

    const price = Shop.priceOf(instance.typeId);
    if (price.length) {
        const share = chargeShare(instance);
        if (!share) return halfOf(price);
        return mergeLines(price.map(({ itemId, quantity }) => ({
            itemId,
            quantity: Math.floor((quantity * share.left) / (share.starting * 2))
        })));
    }

    const foundationTypeId = foundationFromContent(instance.typeId);
    return foundationTypeId ? halfOf(Shop.priceOf(foundationTypeId)) : [];
}

/** Every binned Token's refund, merged per item — what *Discard all* will pay. */
export function binRefundTotal() {
    return mergeLines(...BoardState.binTokens().map(refundFor));
}

// ---------------------------------------------------------------------------
// The bin
// ---------------------------------------------------------------------------

/** The Tokens in the bin, in the order they went in (a copy of the list; the instances are live). */
export function binContents() {
    return BoardState.binTokens().slice();
}

/** Whether Token `instanceId` is in the bin. */
export function isBinned(instanceId) {
    return !!instanceId && BoardState.binTokens().some(t => t.id === instanceId);
}

/**
 * Whether Token `instanceId` on the mat may go in the bin, and why not.
 *
 * `options.fromHand` is for the drag that drops a Token INTO the bin (B3.2):
 * that Token is in the player's hand until the drop has been handled
 * (`MatToken`'s clean-up runs after it). Without it, a Token in the hand is
 * refused, so no other route pulls a Token out from under the cursor.
 */
export function canBin(instanceId, options = {}) {
    const instance = BoardState.getTokenById(instanceId);
    if (!instance) return refuse('No Token there');
    if (Placement.isPermanentToken(instance.typeId, instance)) return refuse('The Guild Hall cannot be discarded.');
    // B6.1 (FB-42, FB-43): a tutorial quest Token stays until it is claimed;
    // only bounties may be discarded (spawned, so no refund).
    if (instance.quest?.tutorial) return refuse('Tutorial quests cannot be discarded.');
    if (BoardState.binTokens().length >= BIN_SIZE) return refuse(`The bin is full (${BIN_SIZE} Tokens)`);
    if (!options.fromHand && TimedChanges.isInHand(instanceId)) return refuse('That Token is being carried');
    return { success: true, instance };
}

/**
 * ⭐ **Lift Token `instanceId` off the mat into the bin** (FB-34).
 *
 * Handled as 5.2's Remove handles a Token leaving (`Placement.removePlacedToken`):
 * its cycle is forfeited, it leaves `board.tokens`, and `TILE_CHANGED`,
 * `HERO_MOVED` (for a hero working it, SP-52), `ADJACENCY_DIRTY` and
 * `state_changed` go out. Unlike Remove, its recipe selection is **kept**, and
 * the instance goes into the bin rather than nowhere.
 *
 * @returns {{success: boolean, reason?: string, idledHeroId?: string|null}}
 */
export function binToken(instanceId, options = {}) {
    const allowed = canBin(instanceId, options);
    if (!allowed.success) return allowed;
    const { instance } = allowed;

    const at = pointOf(instance);
    const heroId = BoardState.workerOf(instanceId);

    instance.cycleElapsedMs = 0;
    BoardState.removeToken(instanceId);
    BoardState.binTokens().push(instance);

    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId, ...(at || {}), typeId: null });
    if (heroId && at) EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId, ...at });
    if (at) EventBus.publish(BOARD_EVENTS.ADJACENCY_DIRTY, { points: [at] });
    binChanged({ action: 'binned', instanceId, typeId: instance.typeId });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);

    return { success: true, idledHeroId: heroId };
}

/**
 * ⭐ **Put binned Token `instanceId` back on the mat at `point`**, unchanged —
 * the same instance, id, charges, recipe, origin and `builtFrom`. Through
 * `Placement.placeTokenAt` like any drop, with `noRestock` so it stands as
 * itself rather than pouring its charges into a copy it lands on. Refused, and
 * left in the bin, whenever placement refuses (no room within reach, a
 * Mythic already out). No cap check: it was counted while it was binned.
 *
 * @returns the placement result, or a refusal
 */
export function unbinToken(instanceId, point) {
    const bin = BoardState.binTokens();
    const index = bin.findIndex(t => t.id === instanceId);
    if (index < 0) return refuse('That Token is not in the bin');
    const instance = bin[index];

    const res = Placement.placeTokenAt(instance, point, { noRestock: true });
    if (!res?.success) return res;

    const now = BoardState.binTokens();
    const at = now.indexOf(instance);
    if (at >= 0) now.splice(at, 1);

    binChanged({ action: 'unbinned', instanceId, typeId: instance.typeId });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
    return res;
}

/**
 * ⭐ ***Discard all*** (B3 confirm): every binned Token goes for good and
 * {@link binRefundTotal} is paid through `InventoryManager.addItem`, which
 * drops whatever a full Bank cannot take as loot on the mat (D-138) — the same
 * route a quest reward takes. Publishes `BIN_CHANGED` and `state_changed` (the
 * mat cap badge's refresh), since binned Tokens stop counting toward the cap.
 *
 * An empty bin does nothing and publishes nothing.
 *
 * @returns {{success: true, discarded: number, refunded: {itemId: string, quantity: number}[]}}
 */
export function discardAll() {
    const bin = BoardState.binTokens();
    if (!bin.length) return { success: true, discarded: 0, refunded: [] };

    const refunded = binRefundTotal();
    const discarded = bin.length;
    bin.length = 0;

    for (const { itemId, quantity } of refunded) {
        InventoryManager.addItem(itemId, quantity, 'discard_refund');
    }

    binChanged({ action: 'discarded', refunded });
    EventBus.publish(ENGINE_EVENTS.STATE_CHANGED);
    return { success: true, discarded, refunded };
}
