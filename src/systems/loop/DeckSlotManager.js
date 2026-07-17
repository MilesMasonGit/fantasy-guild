// Fantasy Guild - Deck Slot Management (Deck Loop rework, Phase 5 §5C)

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import { AREA_EVENTS } from '../core/areaEvents.js';
import { getCard as getCardTemplate } from '../../config/registries/cardRegistry.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import { resetAreaLoop } from '../area/HeroAssignmentManager.js';
import { logger } from '../../utils/Logger.js';

/**
 * DeckSlotManager — moves cards between the Collection Binder
 * (`collection.playsets`) and per-area deck slots. Replaced the old
 * LibraryManager withdraw/reclaim as the card-movement API.
 *
 * Ownership model (§5B): `playsets[templateId]` is how many copies you own;
 * copies "in use" are found by scanning every area's `deckSlots` (plus the
 * Station Slot) at runtime — a computed view, never persisted, the same
 * approach as the old `reconcileLocation()`.
 *
 * Rules enforced here:
 * - You can only slot copies you own and haven't deployed elsewhere.
 * - Single-Copy Rule: max 1 copy of a template per area deck (concept §8B).
 * - Specialized slots only accept cards matching one of their tags.
 * - Locked/hazard slots are never player-assignable.
 * - Any deck change resets that area's loop (Loop Reset Rule, §2D).
 */

/** Card types a player can put in a deck slot. Stations have their own slot
 *  (StationSlotManager); quests are never deck entities (§2G). */
const DECK_SLOTTABLE_TYPES = new Set([
    CARD_TYPES.TASK,
    CARD_TYPES.COMBAT,
    'consumable'
]);

function ownedCount(templateId) {
    return GameState.state.collection?.playsets?.[templateId] || 0;
}

/**
 * Does a card template satisfy a specialized slot's tag list?
 * Matches against the template's tags, skill, subskill, or card type so
 * designers can author e.g. ['fishing'] or ['consumable'] and both work.
 */
function matchesSpecializedTags(template, specializedTags) {
    if (!specializedTags || specializedTags.length === 0) return true;
    const candidates = new Set([
        template.cardType,
        template.config?.skill,
        template.config?.subskill,
        ...(template.tags || []),
        ...(template.traits || []).map(t => t.skillId).filter(Boolean)
    ]);
    return specializedTags.some(tag => candidates.has(tag));
}

export const DeckSlotManager = {

    // ------------------------------------------------------------------
    // Query API (§5C)
    // ------------------------------------------------------------------

    /**
     * Where every owned copy of a template is. Computed on demand — scans
     * all areas' deck slots and station slots.
     * @returns {{ owned: number, slotted: Array<{areaId, slotIndex}|{areaId, slotIndex: 'station'}>, available: number }}
     */
    getAllocations(templateId) {
        const owned = ownedCount(templateId);
        const slotted = [];
        const areaStates = GameState.areaStates || {};
        for (const [areaId, areaState] of Object.entries(areaStates)) {
            (areaState.deckSlots || []).forEach((slot, slotIndex) => {
                if (slot.templateId === templateId) slotted.push({ areaId, slotIndex });
            });
            if (areaState.stationState?.activeStationCardId === templateId) {
                slotted.push({ areaId, slotIndex: 'station' });
            }
        }
        return { owned, slotted, available: owned - slotted.length };
    },

    /**
     * All owned templates that could legally go into a specific slot right
     * now (available copy, not already in this deck, tag-compatible).
     */
    getAvailableCardsForSlot(areaId, slotIndex) {
        const areaState = GameState.areaStates?.[areaId];
        const slot = areaState?.deckSlots?.[slotIndex];
        if (!slot || slot.isLocked) return [];

        const playsets = GameState.state.collection?.playsets || {};
        const inThisDeck = new Set((areaState.deckSlots || []).map(s => s.templateId).filter(Boolean));

        return Object.keys(playsets).filter(templateId => {
            if (playsets[templateId] < 1) return false;
            const template = getCardTemplate(templateId);
            if (!template || !DECK_SLOTTABLE_TYPES.has(template.cardType)) return false;
            if (inThisDeck.has(templateId)) return false;
            if (this.getAllocations(templateId).available < 1) return false;
            return matchesSpecializedTags(template, slot.specializedTags);
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
        if (slot.isLocked || slot.hazard) return { success: false, error: 'This slot is locked (environmental)' };

        const template = getCardTemplate(templateId);
        if (!template) return { success: false, error: `Unknown card "${templateId}"` };
        if (!DECK_SLOTTABLE_TYPES.has(template.cardType)) {
            return { success: false, error: `${template.cardType} cards cannot go in deck slots` };
        }

        if (ownedCount(templateId) < 1) {
            return { success: false, error: 'You do not own this card' };
        }

        // Single-Copy Rule (concept §8B): once per area deck.
        const duplicate = areaState.deckSlots.some((s, i) => i !== slotIndex && s.templateId === templateId);
        if (duplicate) {
            return { success: false, error: 'Only one copy of a card per area deck' };
        }

        // Availability: owned minus copies deployed elsewhere (the target
        // slot's current occupant is about to be freed, so it doesn't count).
        const { slotted } = this.getAllocations(templateId);
        const deployedElsewhere = slotted.filter(s => !(s.areaId === areaId && s.slotIndex === slotIndex)).length;
        if (deployedElsewhere >= ownedCount(templateId)) {
            return { success: false, error: 'All owned copies are already deployed' };
        }

        if (!matchesSpecializedTags(template, slot.specializedTags)) {
            return { success: false, error: `This slot only accepts: ${slot.specializedTags.join(', ')}` };
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
        if (slot.isLocked || slot.hazard) return { success: false, error: 'This slot is locked (environmental)' };
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
        if (from.isLocked || from.hazard || to.isLocked || to.hazard) {
            return { success: false, error: 'Locked slots cannot be rearranged' };
        }

        const fromTemplate = from.templateId ? getCardTemplate(from.templateId) : null;
        const toTemplate = to.templateId ? getCardTemplate(to.templateId) : null;
        if (fromTemplate && !matchesSpecializedTags(fromTemplate, to.specializedTags)) {
            return { success: false, error: `"${fromTemplate.name}" does not fit the target slot (${to.specializedTags.join(', ')})` };
        }
        if (toTemplate && !matchesSpecializedTags(toTemplate, from.specializedTags)) {
            return { success: false, error: `"${toTemplate.name}" does not fit the source slot (${from.specializedTags.join(', ')})` };
        }

        [from.templateId, to.templateId] = [to.templateId, from.templateId];
        from.progress = 0; from.status = 'idle';
        to.progress = 0; to.status = 'idle';

        resetAreaLoop(areaId);
        EventBus.publish(AREA_EVENTS.DECK_UPDATED, { areaId });
        return { success: true };
    },

    /**
     * Move a card from one area's deck to another's.
     * @returns {{ success: boolean, error?: string }}
     */
    moveCardBetweenAreas(fromAreaId, fromSlotIndex, toAreaId, toSlotIndex) {
        const fromState = GameState.areaStates?.[fromAreaId];
        const fromSlot = fromState?.deckSlots?.[fromSlotIndex];
        if (!fromSlot?.templateId) return { success: false, error: 'Source slot is empty' };

        const templateId = fromSlot.templateId;
        const unslot = this.unslotCard(fromAreaId, fromSlotIndex);
        if (!unslot.success) return unslot;

        const slot = this.slotCard(toAreaId, toSlotIndex, templateId);
        if (!slot.success) {
            // Roll back so the card isn't lost to the pool mid-move.
            this.slotCard(fromAreaId, fromSlotIndex, templateId);
            return slot;
        }
        return { success: true };
    },

    // ------------------------------------------------------------------
    // Ownership self-heal
    // ------------------------------------------------------------------

    /**
     * Guarantee the invariant "every slotted card is owned".
     *
     * Areas ship with authored default decks (Phase 2), but nothing granted
     * those cards into `collection.playsets` — and pre-Phase-5 0.2.0 saves
     * have the same hole. Whenever slotted copies exceed owned copies, the
     * difference is granted (the default deck is starter kit, not a loan).
     * Runs at boot and after every save load.
     */
    reconcileOwnership() {
        const playsets = GameState.state.collection?.playsets;
        if (!playsets) return;

        const slottedCounts = {};
        const areaStates = GameState.areaStates || {};
        for (const areaState of Object.values(areaStates)) {
            for (const slot of areaState.deckSlots || []) {
                if (slot.templateId) slottedCounts[slot.templateId] = (slottedCounts[slot.templateId] || 0) + 1;
            }
            const stationId = areaState.stationState?.activeStationCardId;
            if (stationId) slottedCounts[stationId] = (slottedCounts[stationId] || 0) + 1;
        }

        for (const [templateId, slotted] of Object.entries(slottedCounts)) {
            const owned = playsets[templateId] || 0;
            if (slotted > owned) {
                const granted = Math.min(slotted, 4); // schema caps playsets at 4
                playsets[templateId] = granted;
                if (slotted > 4) {
                    logger.warn('DeckSlotManager', `"${templateId}" is slotted ${slotted}× but playsets cap at 4 — check authored default decks`);
                }
                logger.info('DeckSlotManager', `Ownership reconciled: granted ${granted - owned}× "${templateId}" (default-deck/legacy-save cover)`);
            }
        }
    }
};

export default DeckSlotManager;
