// Fantasy Guild — The Token Bank: consolidation, slot caps and selling
// (7×7 Playmat rework, Phase 7)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import { getTokenType, tokenName, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import { logger } from '../../utils/Logger.js';

/**
 * TokenBank — the **rules** over `BoardState`'s storage primitives.
 *
 * `BoardState` knows the shape of the Bank; this knows what is allowed to
 * happen to it. Same split that keeps placement policy out of `setToken`.
 *
 * ## Stacks are never capped; slots are (D-137)
 * The player may hold a million Wood but only so many *distinct types*. Capping
 * quantity would punish a productive board, which is the opposite of what the
 * economy is for; capping variety creates pressure to specialise without ever
 * making success feel like a problem.
 *
 * ## Nothing is ever lost to a full Bank (D-138)
 * A refused deposit leaves the Token on the board as a sprite. A full Bank
 * therefore announces itself **visibly**, as litter piling up across the grid,
 * rather than through an error dialog — and a one-copy-ever Mythic can never be
 * wasted for want of storage.
 */

/** Distinct Token types storable at rank 0. Raised by the Storage track. */
export const BASE_TOKEN_BANK_SLOTS = 12;

/** Extra distinct types per rank of the `token_bank_slots` upgrade. */
export const SLOTS_PER_RANK = 4;

/**
 * Gold paid for one **full** Token, by rarity (D-146).
 *
 * **Deliberately poor** (owner decision 2026-08-06). Selling is the *escape
 * valve* slot caps require, not a strategy — a Map burst hands the player
 * Tokens they have no use for, and without an exit those would eventually fill
 * the Bank. It must never become a way to make money.
 *
 * ⚠️ **Corrected 2026-08-20 (CR2-066).** This comment used to claim the value
 * was "flat rather than scaled by charges remaining", and reasoned at length
 * about the exploit that would follow. It is not flat. `copySellValue` below
 * scales it by charges left, and the owner confirmed 2026-08-19 that the code
 * is right and the comment was wrong. These numbers are the price of a **full**
 * copy; a half-spent one fetches half. Nothing is gained by running a Token to
 * zero before selling it.
 *
 * ⚠️ PLACEHOLDER VALUES awaiting the Phase 10 balance pass.
 */
export const SELL_VALUE = {
    common: 5,
    uncommon: 15,
    rare: 40,
    mythic: 120
};

/** How many distinct Token types the Bank can hold right now. */
export function slotCap() {
    return GameState.state?.board?.tokenBankSlots ?? BASE_TOKEN_BANK_SLOTS;
}

/** Slots used and available, for the Bank header. */
export function slotUsage() {
    return { used: BoardState.tokenBankSlotsUsed(), cap: slotCap() };
}

// ---------------------------------------------------------------------------
// Consolidation (D-77)
// ---------------------------------------------------------------------------

/**
 * Re-pack every copy of one type into **as many full Tokens as possible plus at
 * most one remainder**.
 *
 * ```
 * Bank has:  Forest (3,000 uses left)        capacity 5,000
 * Returning: Forest (4,000 uses left)
 * Result:    1× Forest (5,000, full) + 1× Forest (2,000)
 * ```
 *
 * **Totals are conserved exactly.** That is the whole point and it is load
 * bearing: it is what makes D-54's free repositioning safe, because picking a
 * Token up and putting it back can never gain a single charge. It also keeps
 * per-type state to two numbers rather than per-instance sprawl, so the Bank
 * never degrades into a ragged list of near-dead copies.
 *
 * **Unlimited-use copies (`null`) never merge.** `null` and `0` are opposites,
 * not neighbours (D-176), and pooling an unlimited Token's charges into a
 * finite pile would silently destroy the thing that made it unlimited.
 */
export function consolidate(typeId) {
    const capacity = tokenStartingUses(typeId);
    const copies = BoardState.tokenBankCopies(typeId);
    if (!copies.length) return;

    // A type whose definition is unlimited has no capacity to pack into.
    if (capacity == null) return;

    const unlimited = copies.filter(c => c.usesRemaining == null);
    const finite = copies.filter(c => c.usesRemaining != null);
    if (!finite.length) return;

    const total = finite.reduce((sum, c) => sum + Math.max(0, c.usesRemaining), 0);

    const packed = [];
    let left = total;
    while (left >= capacity) {
        packed.push({ usesRemaining: capacity });
        left -= capacity;
    }
    if (left > 0) packed.push({ usesRemaining: left });

    BoardState.setTokenBankCopies(typeId, [...unlimited, ...packed]);
}

// ---------------------------------------------------------------------------
// Deposit and withdraw
// ---------------------------------------------------------------------------

/**
 * Put a Token into the Bank, applying the slot cap and consolidating after.
 *
 * @returns {boolean} false when the Bank has no free slot for a NEW type. The
 *          caller must **not** destroy the Token — leave it on the board (D-138).
 */
export function deposit(instance) {
    if (!instance?.typeId) return false;

    // **Maps cannot be stored** (D-156). They go straight to the Tray on
    // purchase, never occupy a Vault slot, and there is no Map inventory — a
    // Map is a thing you are about to open, not a thing you keep. Enforced here
    // rather than at the call sites so no future path can quietly stockpile
    // them and turn the Tray's natural cap into no cap at all.
    if (getTokenType(instance.typeId)?.mapId) return false;

    if (!BoardState.addToTokenBank(instance, slotCap())) return false;
    consolidate(instance.typeId);
    EventBus.publish('token_bank_updated', { typeId: instance.typeId });
    // Published here rather than at the call sites (CR2-033). Every deposit
    // route funnels through this function, and only this function knows the
    // deposit actually succeeded — both early returns above are refusals, and
    // a refusal must not advance a "deposit a Token" quest.
    EventBus.publish('vault_deposited', { typeId: instance.typeId });
    return true;
}

/**
 * Take one copy out, **fullest first** (D-77).
 *
 * Drawing the full Token before partials means a player can never be handed a
 * nearly-spent Token while a fresh one sits in storage — which matters most for
 * Managers, since a restock that quietly installed the worst copy available
 * would make automation feel like a downgrade.
 */
export function withdraw(typeId) {
    const instance = BoardState.takeFromTokenBank(typeId);
    if (instance) {
        EventBus.publish('token_bank_updated', { typeId });
        EventBus.publish('vault_withdrawn', { typeId, instance });
    }
    return instance;
}

// ---------------------------------------------------------------------------
// Selling (D-146)
// ---------------------------------------------------------------------------

/** Gold one full copy of a type fetches. */
export function sellValue(typeId) {
    const rarity = getTokenType(typeId)?.rarity || 'common';
    return SELL_VALUE[rarity] ?? SELL_VALUE.common;
}

/**
 * Gold a specific copy fetches based on remaining charges.
 * Partial tokens yield a proportional fraction of base value, rounded down.
 */
export function copySellValue(typeId, copy) {
    const base = sellValue(typeId);
    if (!copy || copy.usesRemaining == null) return base;
    const capacity = tokenStartingUses(typeId);
    if (!capacity || copy.usesRemaining >= capacity) return base;
    return Math.floor(base * (copy.usesRemaining / capacity));
}

/**
 * Total gold selling `quantity` copies of `typeId` will yield right now.
 * Takes the most spent copies first.
 */
export function totalSellValue(typeId, quantity = 1) {
    const copies = BoardState.tokenBankCopies(typeId);
    if (!copies.length || quantity <= 0) return 0;

    const sorted = [...copies].sort((a, b) => {
        if (a.usesRemaining == null) return 1;
        if (b.usesRemaining == null) return -1;
        return a.usesRemaining - b.usesRemaining;
    });

    const countToSell = Math.min(quantity, sorted.length);
    let total = 0;
    for (let i = 0; i < countToSell; i++) {
        total += copySellValue(typeId, sorted[i]);
    }
    return total;
}

/**
 * Sell one copy of a Token type out of the Bank.
 *
 * Sells the **most spent** copy first (disposal takes the worst).
 * Partial tokens sell for their fraction of charges, rounded down.
 *
 * @returns {{success: boolean, reason?: string, gold?: number}}
 */
export function sell(typeId) {
    const copies = BoardState.tokenBankCopies(typeId);
    if (!copies.length) return { success: false, reason: 'None in the Bank' };

    let worst = 0;
    for (let i = 1; i < copies.length; i++) {
        const a = copies[worst].usesRemaining;
        const b = copies[i].usesRemaining;
        if (a == null) { worst = i; continue; }        // unlimited is the best copy
        if (b != null && b < a) worst = i;
    }

    const soldCopy = copies[worst];
    const remaining = copies.filter((_, i) => i !== worst);
    BoardState.setTokenBankCopies(typeId, remaining);

    const gold = copySellValue(typeId, soldCopy);
    if (gold > 0) {
        CurrencyManager.addCurrency('gold', gold, `Sold ${tokenName(typeId)}`);
    }

    EventBus.publish('token_bank_updated', { typeId });
    EventBus.publish('state_changed');
    logger.info('TokenBank', `Sold ${tokenName(typeId)} for ${gold}g`);
    return { success: true, gold };
}

/** Every banked type, shaped for the Bank pane. */
export function contents() {
    const bank = BoardState.getTokenBank();
    return Object.keys(bank).map(typeId => {
        const copies = bank[typeId];
        const def = getTokenType(typeId);
        const capacity = tokenStartingUses(typeId);
        return {
            typeId,
            name: tokenName(typeId),
            rarity: def?.rarity || 'common',
            count: copies.length,
            // ⚠️ "Part-used" means *below capacity*, not merely "has a number".
            // A 5,000-charge Forest whose capacity is 5,000 is full; comparing
            // against zero instead of against capacity labels every finite
            // Token as damaged goods.
            partials: copies
                .map(c => c.usesRemaining)
                .filter(u => u != null && capacity != null && u < capacity),
            sellValue: sellValue(typeId)
        };
    }).sort((a, b) => a.name.localeCompare(b.name));
}
