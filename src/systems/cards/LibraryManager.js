// Fantasy Guild - Library Manager
// Stage 2: Logic Services

import { GameState } from '../../state/GameState.js';
import { EventBus } from '../core/EventBus.js';
import * as CardManager from './CardManager.js';
import { isDeckType } from './DeckSystem.js';
import { logger } from '../../utils/Logger.js';

/**
 * LibraryManager - Central logic for the Card Library system.
 * 
 * Responsibilities:
 * - Tracking where all owned instances of a card are located.
 * - Validating withdrawal of cards to the active board.
 * - Reclaiming cards from boards (active or hibernated).
 */

/**
 * Reconcile the location of all owned copies of a specific card.
 * 
 * @param {string} templateId - The card template to check
 * @param {Object} [providedState] - Optional state override (for testing)
 * @returns {Array<{status: string, areaId?: string}>} 4-item array representing pips
 */
export function reconcileLocation(templateId, providedState = null) {
    const state = providedState || GameState.state;
    if (!state) return [];

    const ownedCount = state.collection?.playsets?.[templateId] || 0;
    const pips = [];

    // 1. Find instances on the active board
    const activeInstances = state.cards.active.filter(c => c.templateId === templateId);
    const activeAreaId = state.ui.activeAreaId;

    activeInstances.forEach(() => {
        pips.push({ status: 'in-use', areaId: activeAreaId });
    });

    // 2. Find instances in hibernated area snapshots
    for (const [areaId, areaState] of Object.entries(state.areaStates || {})) {
        if (areaId === activeAreaId) continue; // Skip active area, already handled

        const snapshots = areaState.cardSnapshots || [];
        const matches = snapshots.filter(s => s.templateId === templateId);

        matches.forEach(() => {
            pips.push({ status: 'in-use', areaId });
        });
    }

    // 3. Fill remaining owned slots as 'available'
    while (pips.length < ownedCount) {
        pips.push({ status: 'available' });
    }

    // 4. Fill up to 4 as 'undiscovered'
    while (pips.length < 4) {
        pips.push({ status: 'undiscovered' });
    }

    // Ensure we never return more than 4 pips (cap at 4)
    return pips.slice(0, 4);
}

/**
 * Check if a card has been discovered (at least one copy owned).
 * 
 * @param {string} templateId 
 * @returns {boolean}
 */
export function isDiscovered(templateId) {
    const state = GameState.state;
    if (!state) return false;
    return (state.collection?.playsets?.[templateId] || 0) > 0;
}

/**
 * Check if a card can be withdrawn from the library to the active board.
 * 
 * @param {string} templateId 
 * @param {Object} [providedState] 
 * @returns {boolean}
 */
export function canWithdraw(templateId, providedState = null) {
    const state = providedState || GameState.state;
    if (!state) return false;

    // Must be space on the active board
    const boardMax = state.cards.limits.boardMax || 5;
    if (state.cards.active.length >= boardMax) return false;

    // Must have an available copy in the library
    const pips = reconcileLocation(templateId, state);
    const available = pips.filter(p => p.status === 'available').length;

    return available > 0;
}

/**
 * Reclaim a card from a specific area and return it to the library.
 * This effectively removes the card instance from the game board.
 * 
 * @param {string} templateId 
 * @param {string} areaId - The area to reclaim from
 * @returns {{ success: boolean, error?: string }}
 */
export function performReclaim(templateId, areaId) {
    const state = GameState.state;
    const activeAreaId = state.ui.activeAreaId;

    if (areaId === activeAreaId) {
        // Find FIRST instance of this template on active board
        const index = state.cards.active.findIndex(c => c.templateId === templateId);
        if (index === -1) {
            return { success: false, error: 'CARD_NOT_FOUND_IN_AREA' };
        }

        const cardId = state.cards.active[index].id;
        // Use CardManager to handle cleanup (hero unassignment, cache, limits)
        const result = CardManager.discardCard(cardId);

        if (result.success) {
            EventBus.publish('library_card_reclaimed', { templateId, areaId });
            EventBus.publish('state_changed'); // Ensure UI refresh (including Binder counts)
            logger.info('LibraryManager', `Reclaimed "${templateId}" from active area "${areaId}"`);
        }
        return result;
    } else {
        // Handle hibernated area
        const areaState = state.areaStates[areaId];
        if (!areaState || !areaState.cardSnapshots) {
            return { success: false, error: 'AREA_NOT_FOUND' };
        }

        const index = areaState.cardSnapshots.findIndex(s => s.templateId === templateId);
        if (index === -1) {
            return { success: false, error: 'CARD_NOT_FOUND_IN_SNAPSHOT' };
        }

        // Remove from snapshot
        areaState.cardSnapshots.splice(index, 1);

        EventBus.publish('library_card_reclaimed', { templateId, areaId });
        EventBus.publish('state_changed'); // Trigger UI refresh
        logger.info('LibraryManager', `Reclaimed "${templateId}" from hibernated area "${areaId}"`);
        return { success: true };
    }
}
