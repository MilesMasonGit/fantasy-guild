// Fantasy Guild - Mutator Stamping (Card Mutators & Tokens, Phase 4)

import { getToken, tokenMatchesTags } from '../../config/registries/TokenRegistry.js';
import { getCard as getCardTemplate } from '../../config/registries/cardRegistry.js';
import { deriveCardTags } from '../../config/registries/tagRegistry.js';
import { attachToken, removeTokenFromSlot } from './SlotTokens.js';
import { logger } from '../../utils/Logger.js';

/**
 * Stamping — the moment a Mutator is *worked* (§15.5 "stamp immediately",
 * §15 "Trigger Timing"). Nothing happens when a Mutator is merely slotted or
 * drawn; the Hero must reach it and work it in the active slot. Only then does
 * it walk the rest of the deck and stamp Tokens onto matching slots.
 *
 * ## What is a Mutator card?
 * An ordinary `action`-type Card carrying one or more `mutator` traits:
 *     { type: 'mutator', tokenId: 'trawler' }
 * The referenced Token DEFINITION (in TokenRegistry) does double duty — its
 * `target_tags` / `targeting` / `charges` decide WHICH slots get stamped, and
 * its `flat`/`multiplier`/`percentage`/`applyStatuses` are the effect that
 * lands when a stamped slot later materializes (SlotTokens.applySlotTokensToCard).
 *
 * ## Forward-only, current Cycle only (§15.5, §9)
 * The deck runs in fixed sequence with no shuffle (§9), so when the Mutator at
 * index i is worked, slots 0..i were already worked this Cycle and slots
 * i+1..end are still upcoming. Stamping only ever touches i+1..end — it never
 * reaches backward, and it never wraps into the next Cycle (which is wiped at
 * the boundary anyway, F2). Surplus charges with no matching slot are wasted.
 *
 * ## Targeting modes (§15.14)
 *  - 'charges': stamp the first N matching slots, N = def.charges (default 1).
 *  - 'area'   : stamp EVERY matching slot remaining in the Cycle.
 */

/** A Token definition is stampable if it carries any effect to apply later. */
function isStampable(def) {
    return !!(def.flat || def.multiplier || def.percentage || def.applyStatuses);
}

/**
 * The upcoming slot indices a Mutator at `fromIndex` may stamp: everything
 * after it in the current Cycle that holds a real, workable card.
 *
 * A slot is skipped only when there is no card there to mark — an empty slot,
 * or a `hazard` slot, which is terrain rather than a card (§2C-1).
 *
 * **`isLocked` is deliberately NOT a reason to skip.** Locked only means the
 * player cannot re-slot that position; the card in it is worked by the loop
 * like any other. §9's Area Blueprints lock combat and hazard cards into fixed
 * anchor points, so treating locked as unstampable would make the §15.13 Hex —
 * whose entire purpose is to curse the next Enemy card — unable to target the
 * very cards it was designed for. (Corrected in Phase 8, which surfaced it.)
 */
function upcomingStampableSlots(areaState, fromIndex) {
    const slots = areaState.deckSlots || [];
    const out = [];
    for (let i = fromIndex + 1; i < slots.length; i++) {
        const slot = slots[i];
        if (!slot || slot.hazard) continue;
        if (!slot.templateId) continue;
        out.push(i);
    }
    return out;
}

/**
 * Resolve the tags of the card sitting in a slot, via the Phase 2 derivation.
 * Cards aren't materialized yet (F1), so we derive from the template.
 */
function slotTags(areaState, slotIndex) {
    const slot = areaState.deckSlots[slotIndex];
    const template = slot?.templateId ? getCardTemplate(slot.templateId) : null;
    return template ? deriveCardTags(template) : [];
}

/**
 * Apply one Token definition's stamping to the upcoming slots.
 * @returns {{stampedSlots: number[], removed: number}}
 */
function stampOneToken(areaId, areaState, fromIndex, def, sourceCardId) {
    const candidates = upcomingStampableSlots(areaState, fromIndex)
        .filter(i => tokenMatchesTags(def, slotTags(areaState, i)));

    // 'charges' takes the first N in deck order; 'area' takes them all.
    const chosen = def.targeting === 'area'
        ? candidates
        : candidates.slice(0, Number.isFinite(def.charges) ? def.charges : 1);

    const stampedSlots = [];
    let removed = 0;

    for (const slotIndex of chosen) {
        // Targeted counter (§15.6): a curative names exactly what it strips.
        // There is no generic "remove all negatives" — content is Phase 10,
        // but the primitive rides the same walk.
        if (def.removes?.length) {
            for (const id of def.removes) removed += removeTokenFromSlot(areaId, slotIndex, id);
        }
        // A pure counter (removes-only, no effect) leaves no instance behind.
        if (isStampable(def)) {
            attachToken(areaId, slotIndex, { tokenId: def.tokenId, sourceCardId, charges: 1 });
            stampedSlots.push(slotIndex);
        }
    }

    return { stampedSlots, removed };
}

/**
 * Stamp every Token a just-worked Mutator card carries onto the deck.
 *
 * Call this AFTER the card's normal work cycle completes — a Mutator is just
 * another Card that takes normal Work Time (§15.15); stamping is its payoff,
 * the way loot is a task's payoff.
 *
 * Mutator CARDS are never destroyed by being worked — they are permanent
 * library cards. §15.7's "consumed on use" describes CONSUMABLE cards, which
 * draw a banked item each pass (`LoopRunner._resolveConsumable`) — a mechanic
 * that already exists and has nothing to do with Mutators
 * [owner clarification 2026-07-21].
 *
 * @param {string} areaId
 * @param {object} areaState - must have `deckSlots` and `activeCardIndex`
 * @param {object} card - the materialized Mutator card (the one being worked)
 * @returns {{stamped: Array<{slotIndex:number, tokenId:string}>, removed:number}}
 */
export function stampMutatorFromCard(areaId, areaState, card) {
    const result = { stamped: [], removed: 0 };
    if (!areaId || !areaState?.deckSlots || !card?.traits) return result;

    const fromIndex = areaState.activeCardIndex;
    if (!Number.isInteger(fromIndex)) return result;

    const mutatorTraits = card.traits.filter(t => t.type === 'mutator' && t.tokenId);
    if (!mutatorTraits.length) return result;

    for (const trait of mutatorTraits) {
        const def = getToken(trait.tokenId);
        if (!def) {
            logger.warn('MutatorStamping', `Card ${card.id} references unknown token "${trait.tokenId}"`);
            continue;
        }

        const { stampedSlots, removed } = stampOneToken(areaId, areaState, fromIndex, def, card.id);
        result.removed += removed;
        for (const slotIndex of stampedSlots) result.stamped.push({ slotIndex, tokenId: def.tokenId });
    }

    if (result.stamped.length || result.removed) {
        logger.info('MutatorStamping',
            `${card.id} stamped ${result.stamped.length}, removed ${result.removed}`);
    }
    return result;
}
