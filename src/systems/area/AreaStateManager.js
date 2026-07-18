import { GameState } from '../../state/GameState.js';
import { getAreaSet } from '../../config/registries/areaSetRegistry.js';
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
 * Grant the starter deck for an area the player has just unlocked (CR-041).
 * Safe to call repeatedly — the grant itself is idempotent.
 */
export function grantStarterDeckFor(areaId) {
    const areaState = GameState.state?.areaStates?.[areaId];
    if (!areaState?.deckSlots) return;
    grantDefaultDeckOwnership(areaState.deckSlots);
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
        if (isUnlocked) grantDefaultDeckOwnership(deckSlots);
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
        logger.info('AreaStateManager', `Initialized fresh areaState for "${areaId}"`);
    } else if (!Array.isArray(state.areaStates[areaId].deckSlots)) {
        // A 0.2.0 save written before the deck-loop cutover can lack the deck
        // loop fields. Graft them onto the existing areaState instead of
        // losing mastery/quest progress.
        const graftedSlots = buildDeckSlotsForArea(areaId);
        if (isUnlocked) grantDefaultDeckOwnership(graftedSlots);
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
