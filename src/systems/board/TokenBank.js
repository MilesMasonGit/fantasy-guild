// Fantasy Guild — The Token Bank: consolidation, slot caps and selling
// (7×7 Playmat rework, Phase 7)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { CurrencyManager } from '../economy/CurrencyManager.js';
import { getTokenType, tokenName, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
import { logger } from '../../utils/Logger.js';
import { warnMissingContent } from '../../utils/missingContent.js';

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

/** Distinct Token types storable at rank 0 (64 per tab). */
export const BASE_TOKEN_BANK_SLOTS = 64;

/** Extra distinct types per rank of the `token_bank_slots` upgrade. */
export const SLOTS_PER_RANK = 32;

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

    // CR2-108c. The deposit still goes through — warn-only — but a Token with
    // no definition banks under a blank name, sells for nothing, and cannot be
    // told apart from any other. Worth saying before it is filed away.
    if (!getTokenType(instance.typeId)) {
        warnMissingContent('TokenBank', 'Token', instance.typeId,
            'the Token going into the Vault has no name, artwork or sell value');
    }

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
 *
 * ⚠️ **This is the only place a withdrawal is announced** — the mirror of
 * `deposit` above (CR2-033). `TokenVaultTab` and `TrayMiniBoard` used to publish
 * `vault_withdrawn` and `token_bank_updated` again after calling this, so the
 * tutorial's "Stage a Token" counter moved by two for one withdrawal (CR2-146).
 * A caller's job is to move the returned instance somewhere, not to re-announce.
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

/**
 * Gold one full copy of a type fetches.
 *
 * ⚠️ **A Token with no definition is worth nothing (CR2-120, 2026-08-26).**
 * This used to read `getTokenType(typeId)?.rarity || 'common'`, so a stale id
 * left in an old save — a Token that was renamed out from under it and can no
 * longer be placed or used — priced itself at the `common` rate of 5 gold. A
 * ghost was worth exactly as much as a real Token of the same rarity, which is
 * the one thing selling must never reward.
 *
 * The `?? SELL_VALUE.common` below is a *different* fallback and is still
 * wanted: it covers a Token that genuinely exists but carries a rarity the
 * table has no row for (an authoring typo), where the sensible answer is the
 * base price rather than nothing.
 */
export function sellValue(typeId) {
    const def = getTokenType(typeId);
    if (!def) return 0;
    return SELL_VALUE[def.rarity] ?? SELL_VALUE.common;
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
 * Takes the most spent copies first — the same `worstFirst` order `sell` uses,
 * which is what makes the price the sell dialog quotes the price actually paid.
 */
export function totalSellValue(typeId, quantity = 1) {
    const copies = BoardState.tokenBankCopies(typeId);
    if (!copies.length || quantity <= 0) return 0;

    return worstFirst(copies)
        .slice(0, Math.min(quantity, copies.length))
        .reduce((total, copy) => total + copySellValue(typeId, copy), 0);
}

/**
 * Rank a type's copies **worst first** — the order both selling and
 * `totalSellValue` take them in, so a quoted price and the gold actually paid
 * can never disagree.
 *
 * "Worst" is fewest charges left. An unlimited copy (`usesRemaining == null`)
 * is the *best* copy there is and sorts last, so bulk-selling a stack can never
 * quietly dispose of the one Token that never runs out (D-176).
 */
function worstFirst(copies) {
    return [...copies].sort((a, b) => {
        if (a.usesRemaining == null && b.usesRemaining == null) return 0;
        if (a.usesRemaining == null) return 1;
        if (b.usesRemaining == null) return -1;
        return a.usesRemaining - b.usesRemaining;
    });
}

/**
 * Sell copies of a Token type out of the Bank.
 *
 * Sells the **most spent** copies first (disposal takes the worst).
 * Partial tokens sell for their fraction of charges, rounded down.
 *
 * ## One sale, one announcement (CR2-168 item 5, fixed 2026-08-26)
 * `quantity` exists because both sell controls used to call this in a loop, one
 * copy at a time. Selling 100 Tokens meant 100 gold credits, 100
 * `currency_changed` events, 100 `token_bank_updated`, 100 `state_changed` and
 * 100 rounds of notification aggregation — for a single player action. The
 * arithmetic is identical either way; only the number of announcements changed.
 *
 * Selling fewer than asked is a **success**, not a failure: `count` says how
 * many actually went. Only "none in the Bank at all" is a refusal.
 *
 * @param {string} typeId
 * @param {number} quantity how many copies to sell; clamped to what is there
 * @returns {{success: boolean, reason?: string, gold?: number, count?: number}}
 */
export function sell(typeId, quantity = 1) {
    const copies = BoardState.tokenBankCopies(typeId);
    if (!copies.length) return { success: false, reason: 'None in the Bank' };
    if (quantity <= 0) return { success: false, reason: 'Nothing to sell' };

    const sorted = worstFirst(copies);
    const count = Math.min(Math.floor(quantity), sorted.length);
    const sold = sorted.slice(0, count);

    BoardState.setTokenBankCopies(typeId, sorted.slice(count));

    const gold = sold.reduce((sum, copy) => sum + copySellValue(typeId, copy), 0);
    if (gold > 0) {
        const label = count > 1
            ? `Sold ${count}× ${tokenName(typeId)}`
            : `Sold ${tokenName(typeId)}`;
        CurrencyManager.addCurrency('gold', gold, label);
    }

    EventBus.publish('token_bank_updated', { typeId });
    EventBus.publish('state_changed');
    logger.info('TokenBank', `Sold ${count}× ${tokenName(typeId)} for ${gold}g`);
    return { success: true, gold, count };
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
