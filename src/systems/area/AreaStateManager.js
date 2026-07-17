import { GameState } from '../../state/GameState.js';
import * as HeroManager from '../hero/HeroManager.js';
import * as CardManager from '../cards/CardManager.js';
import { AssignmentSystem } from '../global/AssignmentSystem.js';
import * as DeckSystem from '../cards/DeckSystem.js';
import { CARD_TYPES } from '../../config/registries/cardConstants.js';
import { USE_DECK_LOOP } from '../../config/featureFlags.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
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
 * Build the runtime deck slot array for an area from its authored
 * `deckSlots` definition in areas.json (Deck Loop rework, Phase 2 §2C/§2E).
 *
 * Flyweight rule: slots hold only a templateId reference + slot metadata +
 * runtime counters. Template data (name, outputs, tick time, ...) is never
 * copied here — look it up via cardRegistry.getCard(slot.templateId).
 */
export function buildDeckSlotsForArea(areaId) {
    const areaSet = getAreaSet(areaId);
    const authoredSlots = areaSet?.deckSlots || [];

    return authoredSlots.map(authored => {
        const slotType = authored.slotType || 'regular';
        const slot = {
            templateId: authored.templateId || null,
            slotType,                                           // regular | specialized | boost | locked
            specializedTags: [...(authored.specializedTags || [])],
            isLocked: slotType === 'locked',
            // --- Runtime fields ---
            progress: 0,
            status: 'idle'                                      // idle | active | completed
        };
        if (authored.hazard) {
            slot.hazard = { ...authored.hazard };               // { type, damagePerPass, tickTime }
        }
        return slot;
    });
}

/**
 * Grant ownership of a freshly built default deck (Phase 5 §5B).
 *
 * Authored default decks pre-slot cards, but ownership lives in
 * `collection.playsets` — every slotted card must be owned or the Binder's
 * allocation math (owned − slotted = available) goes negative. Since area
 * states are built lazily (an area's deck may materialize long after boot),
 * the grant happens here at build time; DeckSlotManager.reconcileOwnership()
 * covers pre-Phase-5 saves the same way at load time.
 */
function grantDefaultDeckOwnership(slots) {
    const playsets = GameState.state.collection?.playsets;
    if (!playsets) return;
    for (const slot of slots) {
        if (!slot.templateId) continue;
        // The new deck adds one more slotted copy of this template game-wide;
        // make sure ownership covers all of them (capped at the 4-copy max).
        let slottedElsewhere = 0;
        for (const otherState of Object.values(GameState.state.areaStates || {})) {
            for (const other of otherState.deckSlots || []) {
                if (other.templateId === slot.templateId) slottedElsewhere++;
            }
        }
        const required = Math.min(4, slottedElsewhere + 1);
        if ((playsets[slot.templateId] || 0) < required) {
            playsets[slot.templateId] = required;
            logger.debug('AreaStateManager', `Granted default-deck card "${slot.templateId}" (${required} owned)`);
        }
    }
}

/**
 * Ensure an areaState object exists for the given areaId.
 *
 * Two shapes exist behind the feature flag:
 * - USE_DECK_LOOP off: the legacy grid shape (cardSnapshots for board freezing).
 * - USE_DECK_LOOP on: the deck loop shape (§2C) — deckSlots, hero assignment,
 *   loop cursor, mode/status, and station state. No cardSnapshots (grid-only
 *   concept). The threat/chaos/invasion counters are kept in both shapes so
 *   the muted systems can be re-integrated later without a save break.
 * @param {string} areaId
 */
export function ensureAreaState(areaId) {
    const state = GameState.state;
    if (!state.areaStates[areaId]) {
        const base = {
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
            completedQuestIds: []
        };

        if (USE_DECK_LOOP) {
            const deckSlots = buildDeckSlotsForArea(areaId);
            grantDefaultDeckOwnership(deckSlots);
            state.areaStates[areaId] = {
                ...base,
                assignedHeroId: null,
                deckSlots,
                activeCardIndex: 0,
                executionTimer: 0,
                mode: 'adventure',              // adventure | stationed
                status: 'paused',               // running | paused | injured | drawing | shuffling | in_combat
                stationState: {
                    activeStationCardId: null,
                    selectedRecipeId: null,
                    progress: 0,
                    productionMode: 'infinite', // infinite | limited
                    productionLimit: 0,
                    producedCount: 0,
                    drinkItemId: null,          // area-level Drink slot — auto-consumed for craft energy
                    status: 'idle'              // idle | crafting | paused_no_inputs | paused_limit_reached | paused_no_energy
                },
                unlockQuestProgress: {},        // { [questId]: number } — §2G, tracked while this area is locked
                _dirtyStats: false              // per-area stat recalculation flag (PERF §2C)
            };
        } else {
            state.areaStates[areaId] = {
                ...base,
                cardSnapshots: []
            };
        }
        logger.info('AreaStateManager', `Initialized fresh areaState for "${areaId}" (${USE_DECK_LOOP ? 'deck loop' : 'grid'} shape)`);
    } else if (USE_DECK_LOOP && !Array.isArray(state.areaStates[areaId].deckSlots)) {
        // A 0.2.0 save written with the flag off can be reopened with the flag
        // on (same game version, different mode). Graft the deck loop fields
        // onto the existing areaState instead of losing mastery/quest progress.
        const graftedSlots = buildDeckSlotsForArea(areaId);
        grantDefaultDeckOwnership(graftedSlots);
        Object.assign(state.areaStates[areaId], {
            assignedHeroId: null,
            deckSlots: graftedSlots,
            activeCardIndex: 0,
            executionTimer: 0,
            mode: 'adventure',
            status: 'paused',
            stationState: {
                activeStationCardId: null,
                selectedRecipeId: null,
                progress: 0,
                productionMode: 'infinite',
                productionLimit: 0,
                producedCount: 0,
                drinkItemId: null,
                status: 'idle'
            },
            unlockQuestProgress: {},
            _dirtyStats: false
        });
        delete state.areaStates[areaId].cardSnapshots;
        logger.info('AreaStateManager', `Grafted deck loop fields onto legacy areaState for "${areaId}"`);
    }
    return state.areaStates[areaId];
}
