import { GameState } from '../../state/GameState.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
import { DECK_SLOT_COUNT } from '../../config/loopConstants.js';
import { BinderManager } from '../progression/BinderManager.js';
import { logger } from '../../utils/Logger.js';

/**
 * AreaStateManager.js
 *
 * Owns the per-area state objects (`areaStates[areaId]`) for the Area Deck
 * Loop system: deck slot construction, default-deck ownership grants, and
 * lazy areaState initialization.
 */

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

    // D-1/D-2: every area has exactly DECK_SLOT_COUNT identical, unrestricted
    // slots, from the moment it unlocks, permanently. The count is enforced
    // HERE rather than trusted from the data, so an area authored with three
    // or six slots still plays correctly and the invariant can't drift.
    //
    // The retired slot types (`specialized` tag-gating, `locked` + hazard
    // terrain) are gone: areas differentiate through their card palette, and
    // hazards moved onto Task cards as an effect (D-8).
    return Array.from({ length: DECK_SLOT_COUNT }, (_, i) => ({
        templateId: authoredSlots[i]?.templateId || null,
        // --- Runtime fields ---
        progress: 0,
        status: 'idle'                                          // idle | active | completed
    }));
}

/**
 * Grant the starter deck for an area the player has just unlocked (CR-041).
 * Safe to call repeatedly — the grant itself is idempotent.
 */
export function grantStarterDeckFor(areaId) {
    const areaState = GameState.state?.areaStates?.[areaId];
    if (!areaState?.deckSlots) return;
    grantDefaultDeckOwnership(areaState.deckSlots, areaId);
}

/**
 * Grant ownership of a freshly built starter deck (D-9).
 *
 * Authored starter decks pre-slot cards, but ownership is separate — every
 * slotted card must be owned or the binder's allocation maths
 * (owned − slotted = available) goes negative.
 *
 * Ownership is per area now (D-3), so the count needed is simply how many
 * copies this area's own deck slots hold — no cross-area scan, because a card
 * can't be slotted anywhere else (D-43).
 */
function grantDefaultDeckOwnership(slots, areaId) {
    const needed = {};
    for (const slot of slots) {
        if (slot.templateId) needed[slot.templateId] = (needed[slot.templateId] || 0) + 1;
    }
    for (const [templateId, count] of Object.entries(needed)) {
        // Route exactly as BinderManager.getOwned does — home area, or the
        // global map when the card isn't area-scoped.
        const home = BinderManager.homeAreaOf(templateId);
        if (BinderManager.getOwned(templateId, home) < count) {
            BinderManager.setOwned(templateId, count, home);
            logger.debug('AreaStateManager', `Granted starter card "${templateId}" ×${count} to ${home || 'global'}`);
        }
    }
}

/**
 * Ensure an areaState object exists for the given areaId, in the deck loop
 * shape (§2C) — deckSlots, hero assignment, loop cursor, mode/status, and
 * station state.
 * @param {string} areaId
 */
export function ensureAreaState(areaId) {
    const state = GameState.state;
    // Quest tracking materializes areaStates for LOCKED areas too, so the
    // starter-deck grant must wait until the area is actually unlocked —
    // otherwise the player owns (and can deploy) cards from areas they
    // haven't reached (CR-041). unlockArea() re-runs the grant on unlock.
    const isUnlocked = (state.collection?.unlockedAreaSets || []).includes(areaId);
    if (!state.areaStates[areaId]) {
        const deckSlots = buildDeckSlotsForArea(areaId);
        if (isUnlocked) grantDefaultDeckOwnership(deckSlots, areaId);
        state.areaStates[areaId] = {
            mastery: {
                passiveUnlocked: true,
                setMasteryUnlocked: false,
                questMasteryUnlocked: false
            },
            collectionProgress: {},
            completedQuestIds: [],
            assignedHeroId: null,
            deckSlots,
            activeCardIndex: 0,
            // Prep Phase (D-20/D-25b): the Consumables spent at the head of
            // this loop, drawn as quick cards before slot 0.
            prepQueue: [],
            prepIndex: 0,
            executionTimer: 0,
            mode: 'adventure',              // adventure | stationed
            status: 'paused',               // running | paused | injured | prepping | drawing | shuffling | in_combat
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
        logger.info('AreaStateManager', `Initialized fresh areaState for "${areaId}"`);
    } else if (!Array.isArray(state.areaStates[areaId].deckSlots)) {
        // A 0.2.0 save written before the deck-loop cutover can lack the deck
        // loop fields. Graft them onto the existing areaState instead of
        // losing mastery/quest progress.
        const graftedSlots = buildDeckSlotsForArea(areaId);
        if (isUnlocked) grantDefaultDeckOwnership(graftedSlots, areaId);
        Object.assign(state.areaStates[areaId], {
            assignedHeroId: null,
            deckSlots: graftedSlots,
            activeCardIndex: 0,
            // Prep Phase (D-20/D-25b): the Consumables spent at the head of
            // this loop, drawn as quick cards before slot 0.
            prepQueue: [],
            prepIndex: 0,
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
