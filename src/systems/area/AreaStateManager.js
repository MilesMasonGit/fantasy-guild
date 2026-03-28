import { GameState } from '../../state/GameState.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as CardManager from '../cards/CardManager.js';
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
 *
 * @param {string} areaId — The area being LEFT (the current activeAreaId)
 */
export function snapshot(areaId) {
    const state = GameState.state;
    const activeCards = state.cards.active;

    logger.info('AreaStateManager', `Freezing board for "${areaId}": ${activeCards.length} card(s)`);

    // 1. Build snapshots from every live card (1.3 Schema)
    const snapshots = activeCards.map(card => {
        const snap = {
            templateId: card.templateId,
            cardType: card.cardType,         // Critical for Deck/Quest restoration
            areaSetId: card.areaSetId,       // Critical for Deck/Quest restoration
            stack: (card.stack || []).map(e => ({ type: e.type, id: e.id })),
            progress: card.progress || 0,
            status: card.status || 'idle',
            position: card.position || null, // Phase 3 grid coords
            
            // Combat & Style state
            selectedStyle: card.selectedStyle || null,
            enemyHp: card.enemyHp ? { ...card.enemyHp } : null,
            combatState: card.combatState ? { ...card.combatState } : null,
            
            // Item & Slot state (legacy support if still used)
            assignedItems: card.assignedItems ? { ...card.assignedItems } : null,
            inputMetadata: card.inputMetadata ? { ...card.inputMetadata } : null,
        };

        // If it's a dynamic template (like a specific quest instance), 
        // we might eventually need to save the full template config.
        // For now, Decks are handled via findOrCreateDeck in restore().
        return snap;
    });
    // 2. Clear hero back-references WITHOUT triggering side effects
    //    We do NOT use HeroManager.unassignHero() here because that
    //    publishes events and sets hero.status = 'idle'. We want a
    //    silent, bulk wipe.
    for (const card of activeCards) {
        for (const entry of (card.stack || [])) {
            if (entry.type === 'hero') {
                const hero = HeroManager.getHero(entry.id);
                if (hero) {
                    hero.assignedCardId = null;
                    hero.status = 'idle';
                }
            }
        }
        // Also clear legacy fields for safety
        card.assignedHeroId = null;
        card.heroSlots = {};
    }

    // 3. Clear the card lookup cache for all departing cards
    for (const card of activeCards) {
        GameState.uncacheCard(card.id);
    }

    // --- Task 2.3: currentCount delta correction ---
    // createCard() increments currentCount, so we must manually decrement it
    // during snapshot so the board limit doesn't inflate.
    const nonUniqueCount = activeCards.filter(
        c => !c.isUnique && !isDeckType(c.cardType)
    ).length;
    state.cards.limits.currentCount = Math.max(
        0,
        state.cards.limits.currentCount - nonUniqueCount
    );

    // 4. Wipe the active array
    state.cards.active = [];

    // 5. Persist the snapshot
    ensureAreaState(areaId);
    state.areaStates[areaId].cardSnapshots = snapshots;
    state.areaStates[areaId].validCells = state.grid.validCells; // Snapshot the current grid shape

    logger.debug('AreaStateManager', `Snapshot saved for "${areaId}"`);
}

/**
 * Rebuild the board from a saved snapshot.
 * After this call, cards.active will contain fully live cards
 * with heroes re-assigned and progress restored.
 *
 * @param {string} areaId — The area being ENTERED (the new activeAreaId)
 */
export function restore(areaId) {
    const state = GameState.state;
    const areaState = state.areaStates[areaId];

    // If no snapshot exists (first visit), leave the board empty.
    if (!areaState || !areaState.cardSnapshots?.length) {
        logger.info('AreaStateManager', `No snapshot for "${areaId}" — fresh board.`);
        return;
    }

    const snapshots = areaState.cardSnapshots;
    logger.info('AreaStateManager', `Restoring board for "${areaId}": ${snapshots.length} card(s)`);

    for (const snap of snapshots) {
        // Step 1: Recreate the card from its template
        let result;

        if (DeckSystem.isDeckType(snap.cardType)) {
            // Decks are unique per-area and managed by DeckSystem
            const deck = DeckSystem.findOrCreateDeck(snap.areaSetId, snap.cardType);
            result = { success: !!deck, card: deck };
        } else if (snap.cardType === CARD_TYPES.QUEST) {
            result = CardManager.createCard(snap.templateId, {
                overrides: { position: snap.position }
            });

            // Fallback: if dynamic quest ID is missing from registry, just use generic quest
            if (!result.success) {
                logger.info('AreaStateManager', `Quest template "${snap.templateId}" not found — falling back to generic quest.`);
                result = CardManager.createCard('basic_quest', {
                    overrides: { position: snap.position }
                });
            }
        } else {
            // Standard cards use the Registry
            result = CardManager.createCard(snap.templateId, {
                overrides: { position: snap.position }
            });
        }

        if (!result.success) {
            logger.warn('AreaStateManager', `Failed to restore card "${snap.templateId}": ${result.error}`);
            continue;
        }

        const card = result.card;

        // Step 2: Restore runtime state
        card.progress = snap.progress;
        card.status = snap.status;
        card.position = snap.position;
        
        // Restore Combat & Style state
        if (snap.selectedStyle) card.selectedStyle = snap.selectedStyle;
        if (snap.enemyHp) card.enemyHp = { ...snap.enemyHp };
        if (snap.combatState) card.combatState = { ...snap.combatState };
        
        // Restore Item & Slot state
        if (snap.assignedItems) card.assignedItems = { ...snap.assignedItems };
        if (snap.inputMetadata) card.inputMetadata = { ...snap.inputMetadata };

        // Step 3: Restore entity assignments from the snapshot's stack
        for (const entry of snap.stack) {
            if (entry.type === 'hero') {
                const hero = HeroManager.getHero(entry.id);
                if (!hero) {
                    logger.warn('AreaStateManager', `Hero "${entry.id}" no longer exists — skipping.`);
                    continue;
                }
                // Use the existing assignment pipeline
                CardManager.assignEntityToStack(card.id, 'hero', entry.id);
            } else if (entry.type === 'item') {
                CardManager.assignEntityToStack(card.id, 'item', entry.id);
            }
        }
    }

    // Clear the snapshot now that it's been consumed.
    // The live cards in cards.active are the new source of truth.
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
