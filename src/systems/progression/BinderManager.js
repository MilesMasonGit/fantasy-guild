// Fantasy Guild — Per-Area Binders (Area Deck Rework, C-2)
//
// Card ownership is **per area**, not global (D-3). Each area has its own
// binder holding the copies of its own cards; a card found in the Iron Crags
// lives in the Iron Crags binder and is usable only there (D-43). This
// replaces the single global `collection.playsets` pile that every area drew
// from.
//
// ## Why this module exists
// The shape of ownership is about to change twice more — the Universal Bucket
// takes universals out (C-2c, D-46), and the guild tree takes Outpost cards
// out (C-12, D-34). Routing every reader through this API means those moves
// are edits *here*, not another sweep of the whole codebase.
//
// ## Where a card's copies live
//   - A **deck-slottable card with a home area** → that area's binder.
//   - **Anything else** (stations today) → the legacy global `playsets` map.
//     Stations lose their `areaId` in C-12 (D-64) and move to guild-tree
//     ranks; until then they stay global and this module leaves them alone.

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { getCard as getCardTemplate, getCardsByAreaSet } from '../../config/registries/cardRegistry.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import { getMaxCopies } from '../../config/cards/cardEffects.js';
import { logger } from '../../utils/Logger.js';

/** Card types a player collects into an area binder. */
const BINDER_TYPES = new Set([
    CARD_TYPES.TASK,
    CARD_TYPES.BOOST,
    CARD_TYPES.COMBAT,
    CARD_TYPES.ACTION,
    'consumable'
]);

/** The area a card belongs to, or null when it isn't area-scoped. */
export function homeAreaOf(templateId) {
    const template = getCardTemplate(templateId);
    if (!template) return null;
    if (!BINDER_TYPES.has(template.cardType)) return null;
    return template.areaId || template.areaSet || null;
}

/** True when this card's ownership lives in an area binder. */
export function isBinderCard(templateId) {
    return homeAreaOf(templateId) !== null;
}

/** Ensure and return the binders map. */
function binders() {
    const collection = GameState.state?.collection;
    if (!collection) return null;
    if (!collection.binders) collection.binders = {};
    return collection.binders;
}

/**
 * One area's binder: `{ [templateId]: ownedCount }`.
 * Returns a live reference — callers may read it, but should mutate through
 * `grantCopy` / `setOwned` so the cap and events stay consistent.
 */
export function getBinder(areaId) {
    const all = binders();
    if (!all) return {};
    if (!all[areaId]) all[areaId] = {};
    return all[areaId];
}

/**
 * How many copies of a card the player owns.
 *
 * Area-scoped cards are counted in their own area's binder; everything else
 * falls back to the legacy global map, so stations keep working unchanged.
 *
 * @param {string} templateId
 * @param {string} [areaId] Defaults to the card's home area.
 * @returns {number}
 */
export function getOwned(templateId, areaId = null) {
    const home = areaId || homeAreaOf(templateId);
    if (!home) return GameState.state?.collection?.playsets?.[templateId] || 0;
    return getBinder(home)[templateId] || 0;
}

/**
 * Set an exact owned count, clamped to the card's authored cap (D-61).
 * @returns {number} the count actually stored.
 */
export function setOwned(templateId, count, areaId = null) {
    const template = getCardTemplate(templateId);
    if (!template) {
        // An unknown id would otherwise fall through to the global map and
        // silently mint copies of a card that doesn't exist.
        logger.warn('BinderManager', `Refusing to grant unknown card "${templateId}"`);
        return 0;
    }

    const home = areaId || homeAreaOf(templateId);
    const max = getMaxCopies(template);
    const next = Math.max(0, Math.min(count, max));

    if (!home) {
        const collection = GameState.state?.collection;
        if (!collection) return 0;
        if (!collection.playsets) collection.playsets = {};
        collection.playsets[templateId] = next;
        return next;
    }

    getBinder(home)[templateId] = next;
    return next;
}

/**
 * Add copies of a card, never exceeding its cap (D-13/D-61).
 *
 * @returns {{ granted: number, owned: number, max: number, full: boolean }}
 *          `granted` is how many actually landed — 0 when already at the cap.
 */
export function grantCopy(templateId, amount = 1, areaId = null) {
    const max = getMaxCopies(getCardTemplate(templateId));
    const before = getOwned(templateId, areaId);
    const owned = setOwned(templateId, before + amount, areaId);
    return { granted: owned - before, owned, max, full: owned >= max };
}

/**
 * The full card pool for an area — every card that can ever appear in its
 * binder, owned or not. This is what the binder page renders as silhouettes
 * (D-44) and what pack pools draw from.
 *
 * @param {string} areaId
 * @returns {string[]} template ids
 */
export function getPool(areaId) {
    return (getCardsByAreaSet(areaId) || [])
        .filter(card => card && BINDER_TYPES.has(card.cardType))
        .map(card => card.id);
}

/**
 * Collection progress for an area, in copies — the "X of Y collected" figure
 * behind the binder's completion state (D-13).
 *
 * @returns {{ owned: number, total: number, complete: boolean, cardsOwned: number, cardsTotal: number }}
 */
export function getCompletion(areaId) {
    const pool = getPool(areaId);
    let owned = 0;
    let total = 0;
    let cardsOwned = 0;

    for (const templateId of pool) {
        const max = getMaxCopies(getCardTemplate(templateId));
        const have = getOwned(templateId, areaId);
        total += max;
        owned += Math.min(have, max);
        if (have > 0) cardsOwned++;
    }

    return {
        owned,
        total,
        complete: total > 0 && owned >= total,
        cardsOwned,
        cardsTotal: pool.length
    };
}

/**
 * True when every card in the area's pool sits at its cap — the binder is
 * finished, and that area's packs stop being sold (D-13).
 */
export function isComplete(areaId) {
    return getCompletion(areaId).complete;
}

/**
 * Cards from this area's pool that still have room for another copy. This is
 * the live pack pool: a maxed card drops out of it (D-13), so every pack
 * delivers something the player still needs.
 */
export function getIncompletePool(areaId) {
    return getPool(areaId).filter(templateId => {
        const max = getMaxCopies(getCardTemplate(templateId));
        return getOwned(templateId, areaId) < max;
    });
}

/**
 * Repair binders so every slotted card is owned.
 *
 * Authored starter decks pre-slot cards, but ownership is separate — without
 * this the binder's allocation maths (owned − slotted) goes negative. Safe to
 * run repeatedly.
 */
export function reconcileOwnership() {
    const areaStates = GameState.state?.areaStates || {};
    let repaired = 0;

    for (const [areaId, areaState] of Object.entries(areaStates)) {
        const counts = {};
        for (const slot of areaState.deckSlots || []) {
            if (slot?.templateId) counts[slot.templateId] = (counts[slot.templateId] || 0) + 1;
        }

        for (const [templateId, slotted] of Object.entries(counts)) {
            // Route exactly as getOwned does: home area, or global when the
            // card isn't area-scoped. Falling back to the *containing* area
            // here would write somewhere reads never look.
            const home = homeAreaOf(templateId);
            if (getOwned(templateId, home) >= slotted) continue;

            const max = getMaxCopies(getCardTemplate(templateId));
            if (slotted > max) {
                logger.warn('BinderManager',
                    `"${templateId}" is slotted ${slotted}× in ${areaId} but caps at ${max} — check the authored starter deck`);
            }
            setOwned(templateId, slotted, home);
            repaired++;
        }
    }

    if (repaired > 0) {
        logger.info('BinderManager', `Granted ownership for ${repaired} slotted card(s)`);
        EventBus.publish('collection_updated', {});
    }
}

export const BinderManager = {
    homeAreaOf, isBinderCard, getBinder, getOwned, setOwned, grantCopy,
    getPool, getCompletion, isComplete, getIncompletePool, reconcileOwnership
};

export default BinderManager;
