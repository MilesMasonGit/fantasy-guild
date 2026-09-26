// Fantasy Guild — The Token Bank: consolidation and slot caps
// (7×7 Playmat rework, Phase 7)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getTokenType, tokenName, tokenStartingUses } from '../../config/registries/tokenRegistry.js';
import * as BoardState from './BoardState.js';
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

    // ⚠️ Consolidation pools charges and repacks them, so the copies that come
    // out are not the copies that went in and per-copy data cannot simply be
    // carried across. The Map's terrain stamp (D-T6) still has to survive, so
    // the first stamp among the finite copies is applied to all of them.
    //
    // There is no right answer when two copies of one type came from different
    // Maps — after the merge they are not those Tokens any more. Taking the
    // first is defensible because both stamps are valid terrain for this type,
    // so the worst case is the wrong one of two right answers. The alternative,
    // refusing to merge copies with different stamps, would quietly cost the
    // player Vault slots for a cosmetic reason.
    const stamp = finite.find(c => c.terrain)?.terrain || null;
    const pack = (usesRemaining) => (
        stamp ? { usesRemaining, terrain: stamp } : { usesRemaining }
    );

    const packed = [];
    let left = total;
    while (left >= capacity) {
        packed.push(pack(capacity));
        left -= capacity;
    }
    if (left > 0) packed.push(pack(left));

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
    // no definition banks under a blank name and cannot be
    // told apart from any other. Worth saying before it is filed away.
    if (!getTokenType(instance.typeId)) {
        warnMissingContent('TokenBank', 'Token', instance.typeId,
            'the Token going into the Vault has no name or artwork');
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
 * nearly-spent Token while a fresh one sits in storage.
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
// The Bank pane (selling went with gold, Token Lifecycle 9.4)
// ---------------------------------------------------------------------------

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
                .filter(u => u != null && capacity != null && u < capacity)
        };
    }).sort((a, b) => a.name.localeCompare(b.name));
}
