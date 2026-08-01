// Fantasy Guild - Deck Slot Management (Deck Loop rework, Phase 5 §5C)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { AREA_EVENTS } from '../core/areaEvents.js';
import { getCard as getCardTemplate } from '../../config/registries/cardRegistry.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import { BinderManager } from '../progression/BinderManager.js';
import { getOutposts } from './OutpostManager.js';
import { resetAreaLoop } from '../area/HeroAssignmentManager.js';
import { logger } from '../../utils/Logger.js';

/**
 * DeckSlotManager — moves cards between an area's binder and its deck slots.
 *
 * Ownership model (D-3, D-9): a card's copies live in **its own area's
 * binder** (BinderManager), and you must own one copy per slot you fill.
 * Copies "in use" are found by scanning that area's `deckSlots` at runtime —
 * a computed view, never persisted.
 *
 * Rules enforced here:
 * - You can only slot copies you own and haven't already deployed.
 * - **Own N to slot N** (D-9): four copies of a card fill all four slots,
 *   which is the 4× farm loop. There is no longer a one-per-deck limit.
 * - A card can only be slotted in its own area (D-43) — cards never move
 *   between binders.
 * - Any deck change resets that area's loop (Loop Reset Rule, §2D).
 */

/** Card types a player can put in a deck slot. Stations have their own slot
 *  (StationSlotManager); quests are never deck entities (§2G). */
const DECK_SLOTTABLE_TYPES = new Set([
    CARD_TYPES.TASK,
    CARD_TYPES.BOOST,    // Buff-only cards (D-6)
    CARD_TYPES.COMBAT,
    CARD_TYPES.ACTION,   // Mutators & consumable action cards (Phase 4)
    'consumable'
]);

function ownedCount(templateId, areaId = null) {
    return BinderManager.getOwned(templateId, areaId);
}

export const DeckSlotManager = {

    // ------------------------------------------------------------------
    // Query API (§5C)
    // ------------------------------------------------------------------

    /**
     * Where every owned copy of a template is. Computed on demand.
     *
     * For an area-scoped card only its own area can hold it (D-43), so the
     * scan is that area's slots. Station cards are still global, so they keep
     * the all-areas scan until C-12 moves them onto the guild tree.
     *
     * @returns {{ owned: number, slotted: Array<{areaId, slotIndex}|{areaId, slotIndex: 'station'}>, available: number }}
     */
    getAllocations(templateId) {
        const home = BinderManager.homeAreaOf(templateId);
        const owned = ownedCount(templateId, home);
        const slotted = [];
        const areaStates = GameState.areaStates || {};

        for (const [areaId, areaState] of Object.entries(areaStates)) {
            // An area-scoped card can only legally sit in its own area.
            // Universals (home === null) are global, so every area is scanned —
            // that all-areas count IS the bucket's availability (D-46).
            if (!home || home === areaId) {
                (areaState.deckSlots || []).forEach((slot, slotIndex) => {
                    if (slot.templateId === templateId) slotted.push({ areaId, slotIndex });
                });
            }
        }
        // Station cards live on Outpost banners now (D-16), not on areas — so
        // an installed station counts against the same owned pool from there.
        for (const outpost of getOutposts()) {
            if (outpost.activeStationCardId === templateId) {
                slotted.push({ areaId: outpost.id, slotIndex: 'station' });
            }
        }
        return { owned, slotted, available: owned - slotted.length };
    },

    /**
     * All cards that could legally go into a specific slot right now — owned
     * in THIS area's binder, with a copy still free.
     *
     * Every slot accepts every card (D-1), so the answer is the same for all
     * four slots. A card already in this deck still qualifies as long as a
     * spare copy exists — that's how you build the 4× farm loop (D-9).
     */
    getAvailableCardsForSlot(areaId, slotIndex) {
        const areaState = GameState.areaStates?.[areaId];
        const slot = areaState?.deckSlots?.[slotIndex];
        if (!slot) return [];

        const occupant = slot.templateId;
        // This area's own cards, plus every universal — universals belong to
        // no region and may be placed anywhere (D-46).
        const candidates = new Set([
            ...Object.keys(BinderManager.getBinder(areaId)),
            ...BinderManager.getUniversalPool()
        ]);

        return [...candidates].filter(templateId => {
            if (BinderManager.getOwned(templateId, areaId) < 1) return false;
            const template = getCardTemplate(templateId);
            if (!template || !DECK_SLOTTABLE_TYPES.has(template.cardType)) return false;
            // The slot's current occupant is about to be freed, so its own
            // copy shouldn't count against availability.
            const free = this.getAllocations(templateId).available + (templateId === occupant ? 1 : 0);
            return free >= 1;
        });
    },

    /** The full deck for UI display: slots with their resolved templates. */
    getAreaDeckContents(areaId) {
        const areaState = GameState.areaStates?.[areaId];
        return (areaState?.deckSlots || []).map((slot, slotIndex) => ({
            slotIndex,
            slot,
            template: slot.templateId ? getCardTemplate(slot.templateId) : null
        }));
    },

    // ------------------------------------------------------------------
    // Mutation API (§5C)
    // ------------------------------------------------------------------

    /**
     * Put an owned card into a deck slot.
     * @returns {{ success: boolean, error?: string }}
     */
    slotCard(areaId, slotIndex, templateId) {
        const areaState = GameState.areaStates?.[areaId];
        const slot = areaState?.deckSlots?.[slotIndex];
        if (!slot) return { success: false, error: `No slot ${slotIndex} in "${areaId}"` };

        const template = getCardTemplate(templateId);
        if (!template) return { success: false, error: `Unknown card "${templateId}"` };
        if (!DECK_SLOTTABLE_TYPES.has(template.cardType)) {
            return { success: false, error: `${template.cardType} cards cannot go in deck slots` };
        }

        // Cards belong to one area and never move between binders (D-43) —
        // except universals, which are global and go anywhere (D-46).
        const home = BinderManager.homeAreaOf(templateId);
        if (home && home !== areaId) {
            return { success: false, error: `"${template.name}" belongs to another area` };
        }

        if (ownedCount(templateId, home) < 1) {
            return { success: false, error: 'You do not own this card' };
        }

        // Own N to slot N (D-9). There is deliberately NO one-per-deck limit:
        // four owned copies fill all four slots, which is the 4× farm loop.
        // Availability is owned minus copies already deployed (the target
        // slot's current occupant is about to be freed, so it doesn't count).
        const { slotted } = this.getAllocations(templateId);
        const deployedElsewhere = slotted.filter(s => !(s.areaId === areaId && s.slotIndex === slotIndex)).length;
        if (deployedElsewhere >= ownedCount(templateId, home)) {
            return { success: false, error: 'All owned copies are already deployed' };
        }

        // Occupied slot: the old card is auto-unslotted by being overwritten
        // (its copy returns to the available pool implicitly).
        slot.templateId = templateId;
        slot.progress = 0;
        slot.status = 'idle';

        resetAreaLoop(areaId); // Loop Reset Rule — publishes STATS_DIRTY
        EventBus.publish(AREA_EVENTS.DECK_UPDATED, { areaId });
        logger.info('DeckSlotManager', `Slotted "${templateId}" into ${areaId}[${slotIndex}]`);
        return { success: true };
    },

    /**
     * Clear a deck slot, returning the copy to the available pool.
     * @returns {{ success: boolean, error?: string }}
     */
    unslotCard(areaId, slotIndex) {
        const areaState = GameState.areaStates?.[areaId];
        const slot = areaState?.deckSlots?.[slotIndex];
        if (!slot) return { success: false, error: `No slot ${slotIndex} in "${areaId}"` };
        if (!slot.templateId) return { success: false, error: 'Slot is already empty' };

        const removed = slot.templateId;
        slot.templateId = null;
        slot.progress = 0;
        slot.status = 'idle';

        resetAreaLoop(areaId);
        EventBus.publish(AREA_EVENTS.DECK_UPDATED, { areaId });
        logger.info('DeckSlotManager', `Unslotted "${removed}" from ${areaId}[${slotIndex}]`);
        return { success: true };
    },

    /**
     * Swap the contents of two slots in the same area (used by Phase 6
     * drag-reordering; both cards must fit their new homes).
     * @returns {{ success: boolean, error?: string }}
     */
    swapSlots(areaId, fromIndex, toIndex) {
        const areaState = GameState.areaStates?.[areaId];
        const from = areaState?.deckSlots?.[fromIndex];
        const to = areaState?.deckSlots?.[toIndex];
        if (!from || !to) return { success: false, error: 'Invalid slot index' };

        // Every slot accepts every card (D-1), so a swap is always legal.
        [from.templateId, to.templateId] = [to.templateId, from.templateId];
        from.progress = 0; from.status = 'idle';
        to.progress = 0; to.status = 'idle';

        resetAreaLoop(areaId);
        EventBus.publish(AREA_EVENTS.DECK_UPDATED, { areaId });
        return { success: true };
    },

    // `moveCardBetweenAreas` is retired (D-43): a card belongs to the area it
    // was found in and never moves to another binder. Cross-area drags are
    // rejected by `slotCard`'s home-area check.

    // ------------------------------------------------------------------
    // Ownership self-heal
    // ------------------------------------------------------------------

    /**
     * Guarantee the invariant "every slotted card is owned".
     *
     * Delegates to BinderManager, which knows where each card's copies live.
     * Station cards are still global and keep their own top-up here until
     * C-12 moves them onto the guild tree.
     */
    reconcileOwnership() {
        BinderManager.reconcileOwnership();

        // Stations: not area-scoped, so still counted in the legacy map.
        const playsets = GameState.state.collection?.playsets;
        if (!playsets) return;
        for (const outpost of getOutposts()) {
            const stationId = outpost.activeStationCardId;
            if (!stationId) continue;
            if ((playsets[stationId] || 0) < 1) {
                playsets[stationId] = 1;
                logger.info('DeckSlotManager', `Ownership reconciled: granted station "${stationId}"`);
            }
        }
    }
};

export default DeckSlotManager;
