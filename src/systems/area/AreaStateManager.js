import { GameState } from '../../state/GameState.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as CardManager from '../cards/CardManager.js';
import { AssignmentSystem } from '../global/AssignmentSystem.js';
import * as DeckSystem from '../cards/DeckSystem.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import { logger } from '../../utils/Logger.js';

/**
 * AreaStateManager.js
 * 
 * Logic module responsible for freezing the current board into a snapshot (snapshot),
 * and thawing a saved snapshot back into a live board (restore).
 * 
 * This is the heart of the "Board Rebuilding" architecture.
 */

// --- 1.3 CardSnapshot Schema Helpers ---
function isDeckType(cardType) {
    return cardType === CARD_TYPES.PACK_DECK ||
        cardType === CARD_TYPES.QUEST_DECK ||
        cardType === CARD_TYPES.CHEST_DECK;
}

/**
 * Freeze the current board state into areaStates[areaId].
 * After this call, cards.active will be empty and all heroes unlinked.
 */
export function snapshot(areaId) {
    const state = GameState.state;
    const activeCards = state.cards.active;

    logger.info('AreaStateManager', `Freezing board for "${areaId}": ${activeCards.length} card(s)`);

    // 1. Build snapshots with Namespaced Combat & Assignment schema
    const snapshots = activeCards.map(card => {
        return {
            templateId: card.templateId,
            cardType: card.cardType,
            areaSetId: card.areaSetId,
            progress: card.progress || 0,
            status: card.status || 'idle',
            position: card.position || null,
            
            // Modern assignment schema
            assignedHeroId: card.assignedHeroId || null,
            assignedToolId: card.assignedToolId || null,
            assignedBlueprintId: card.assignedBlueprintId || null,

            // Namespaced Combat State
            combat: card.combat ? { ...card.combat } : null,
            
            // Item & Slot state (InputSlotModule)
            assignedItems: card.assignedItems ? { ...card.assignedItems } : null,
            inputMetadata: card.inputMetadata ? { ...card.inputMetadata } : null,
            selectedStyle: card.selectedStyle || null,

            // Namespaced Project State
            project: card.project ? { ...card.project } : null,
        };
    });

    // 2. Silent Hero Unlinking (infrastructure alignment)
    for (const card of activeCards) {
        if (card.assignedHeroId) {
            AssignmentSystem.silentUnlinkHero(card.assignedHeroId);
        }
        // Wipe local card reference
        card.assignedHeroId = null;
    }

    // 3. Clear the card lookup cache
    for (const card of activeCards) {
        GameState.uncacheCard(card.id);
    }

    // 4. Board Limit Management
    const nonUniqueCount = activeCards.filter(
        c => !c.isUnique && !DeckSystem.isDeckType(c.cardType)
    ).length;
    
    state.cards.limits.currentCount = Math.max(0, state.cards.limits.currentCount - nonUniqueCount);

    // 5. Clear the active array and Persist
    state.cards.active = [];
    ensureAreaState(areaId);
    state.areaStates[areaId].cardSnapshots = snapshots;
    state.areaStates[areaId].validCells = state.grid.validCells;

    logger.debug('AreaStateManager', `Snapshot saved for "${areaId}"`);
}

/**
 * Rebuild the board from a saved snapshot.
 */
export function restore(areaId) {
    const state = GameState.state;
    const areaState = state.areaStates[areaId];

    if (!areaState || !areaState.cardSnapshots?.length) {
        logger.info('AreaStateManager', `No snapshot for "${areaId}" — fresh board.`);
        return;
    }

    const snapshots = areaState.cardSnapshots;
    logger.info('AreaStateManager', `Restoring board for "${areaId}": ${snapshots.length} card(s)`);

    for (const snap of snapshots) {
        let result;

        // Step 1: Factory Resolution
        if (DeckSystem.isDeckType(snap.cardType)) {
            const deck = DeckSystem.findOrCreateDeck(snap.areaSetId, snap.cardType);
            result = { success: !!deck, card: deck };
        } else {
            result = CardManager.createCard(snap.templateId, {
                overrides: { position: snap.position }
            });

            // Quest Fallback
            if (!result.success && snap.cardType === CARD_TYPES.QUEST) {
                result = CardManager.createCard('basic_quest', { overrides: { position: snap.position } });
            }
        }

        if (!result.success) continue;

        const card = result.card;

        // Step 2: Runtime Rehydration
        card.progress = snap.progress;
        card.status = snap.status;
        card.position = snap.position;
        
        // Restore Namespaced Combat
        if (snap.combat) card.combat = { ...snap.combat };
        
        // Restore Metadata
        if (snap.assignedItems) card.assignedItems = { ...snap.assignedItems };
        if (snap.inputMetadata) card.inputMetadata = { ...snap.inputMetadata };
        if (snap.selectedStyle) card.selectedStyle = snap.selectedStyle;

        // Restore Namespaced Project
        if (snap.project) card.project = { ...snap.project };

        // Step 3: Assignment Re-linking (Side-Effect Safe)
        if (snap.assignedHeroId) {
            AssignmentSystem.assignHero(snap.assignedHeroId, card.id);
        }
        if (snap.assignedToolId) {
            AssignmentSystem.assignTool(card.id, snap.assignedToolId);
        }
        if (snap.assignedBlueprintId) {
            AssignmentSystem.assignBlueprint(snap.assignedBlueprintId, card.id);
        }
    }

    // Flush snapshot after Consumption
    areaState.cardSnapshots = [];
    logger.debug('AreaStateManager', `Restored ${snapshots.length} card(s) for "${areaId}"`);
}

/**
 * Ensure an areaState object exists for the given areaId
 * @param {string} areaId 
 */
export function ensureAreaState(areaId) {
    const state = GameState.state;
    if (!state.areaStates[areaId]) {
        state.areaStates[areaId] = {
            threat: 0,
            chaosPoints: 0,
            chaosStage: 0,
            invasionThreat: 0,
            activeInvasionId: null,
            mastery: {
                passiveUnlocked: true,
                setMasteryUnlocked: false,
                questMasteryUnlocked: false
            },
            explorationCount: 0,
            collectionProgress: {},
            completedQuestIds: [],
            cardSnapshots: []
        };
        logger.info('AreaStateManager', `Initialized fresh areaState for "${areaId}"`);
    }
    return state.areaStates[areaId];
}
