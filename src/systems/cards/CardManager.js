// Fantasy Guild - Card Manager (Dispatcher)
// Refactored to delegate logic to specialized processors in logic/

import { EventBus } from '../core/EventBus.js';
import { logger } from '../../utils/Logger.js';

// Logic Processors
import * as Lifecycle from './logic/LifecycleProcessor.js';
import * as Transformation from './logic/TransformationProcessor.js';
import * as Lookup from './logic/LookupProcessor.js';
import * as Grid from './logic/GridProcessor.js';
import * as Project from './logic/ProjectProcessor.js';
import * as Events from './logic/EventProcessor.js';
import * as Utils from './logic/CardManagerUtils.js';

import { AssignmentSystem } from '../global/AssignmentSystem.js';

// --- Lifecycle Exports ---
export const createCard = Lifecycle.createCard;
export const discardCard = Lifecycle.discardCard;
export const vaultCard = Lifecycle.vaultCard;
export const deployCard = Lifecycle.deployCard;
export const openPack = Lifecycle.openPack;
export const setCardStatus = Lifecycle.setCardStatus;

import { CardFactory } from './logic/CardFactory.js';
import { CardStackManager } from './logic/CardStackManager.js';
export const generateId = (prefix) => CardFactory.generateId(prefix);
export const addToStack = (card) => CardStackManager.addToStack(card);

// --- Lookup Exports ---
export const getCard = Lookup.getCard;
export const getActiveCards = Lookup.getActiveCards;
export const getCardsByType = Lookup.getCardsByType;
export const getCardByTemplate = Lookup.getCardByTemplate;
export const getCardByHero = Lookup.getCardByHero;
export const getCardCount = Lookup.getCardCount;
export const getCardLimit = Lookup.getCardLimit;

// --- Transformation Exports ---
export const transformToCombat = Transformation.transformToCombat;
export const revertFromCombat = Transformation.revertFromCombat;
export const resetCombatCard = Transformation.resetCombatCard;
export const updateCombatStyle = Transformation.updateCombatStyle;

// --- Grid & Positioning Exports ---
export const reorderCard = Grid.reorderCard;
export const updateCardPosition = Grid.updateCardPosition;
export const findFirstEmptyCell = Grid.findFirstEmptyCell;

// --- Project & Blueprint Exports ---
export const evaluateBuildingRecipe = Project.evaluateBuildingRecipe;
export const assignBlueprint = Project.assignBlueprint;
export const unassignBlueprint = Project.unassignBlueprint;

// --- Event & Invasion Exports ---
export const spawnEventCard = Events.spawnEventCard;
export const spawnInvasionCard = Events.spawnInvasionCard;

// --- Utility Exports ---
export const bumpCardRev = Utils.bumpCardRev;
export const publishCardUpdate = Utils.publishCardUpdate;
export const updateProgress = Utils.updateProgress;
export const resetProgress = Utils.resetProgress;
export const rehydrateCards = Utils.rehydrateCards;
export const reapplyAllPersistentModifiers = Utils.reapplyAllPersistentModifiers;
export const setAssignedHero = Utils.setAssignedHero;
export const clearAssignedHero = Utils.clearAssignedHero;
export const assignHero = (h, c) => AssignmentSystem.assignHero(h, c);


// --- Assignment System Facades (for UI backward compatibility) ---

/**
 * Assign an item to an open input slot.
 */
export function assignItemToSlot(cardId, slotIndex, itemId) {
    const card = Lookup.getCard(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };
    const inputTraits = card.traits?.filter(t => t.type === 'inputslot') || [];
    let amount = 1;
    let currentIdx = 0;
    for (const trait of inputTraits) {
        const inputs = trait.inputs || [trait];
        for (const input of inputs) {
            if (currentIdx === parseInt(slotIndex, 10)) {
                amount = input.quantity || 1;
                break;
            }
            currentIdx++;
        }
    }
    return AssignmentSystem.assignItem(cardId, slotIndex, itemId, amount);
}

export const unassignItemFromSlot = (c, s) => AssignmentSystem.unassignSlot(c, `input-${s}`);
export const assignTool = (c, i) => AssignmentSystem.assignTool(c, i);
export const unassignTool = (c) => AssignmentSystem.unassignTool(c);
export const smartAssignEntity = (c, t, e) => AssignmentSystem.smartAssignEntity(c, t, e);
export const assignEntityToStack = (c, t, e) => AssignmentSystem.assignEntityToStack(c, t, e);
export const assignToSlot = (c, s, e) => {
    const [type, idx] = s.split('-');
    const index = parseInt(idx, 10);
    if (type === 'hero') return AssignmentSystem.assignHero(e, c);
    if (type === 'tool') return AssignmentSystem.assignTool(c, e);
    if (type === 'blueprint') return AssignmentSystem.assignBlueprint(e, c);
    if (type === 'input') return assignItemToSlot(c, index, e);
    return { success: false, error: 'INVALID_SLOT_TYPE' };
};

// Note: assignHero restored as facade for UI/DND compatibility.
// unassignHero should just unassign heroes.
export function unassignHero(cardId, slotIndex = null) {
    const card = Lookup.getCard(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };
    if (slotIndex !== null) {
        const heroId = card.heroSlots?.[slotIndex] || (slotIndex === 0 ? card.assignedHeroId : null);
        if (heroId) return AssignmentSystem.unassignHero(heroId);
    } else {
        if (card.assignedHeroId) AssignmentSystem.unassignHero(card.assignedHeroId);
        if (card.heroSlots) Object.values(card.heroSlots).forEach(id => id && AssignmentSystem.unassignHero(id));
        if (card.stack) card.stack.filter(e => e.type === 'hero').forEach(e => AssignmentSystem.unassignHero(e.id));
    }
    return { success: true };
}

// --- Global Effect Subscription ---
EventBus.subscribe('game_loaded', () => Utils.reapplyAllPersistentModifiers());
EventBus.subscribe('spawn_area_event', (data) => Events.spawnEventCard(data.areaId, data.stage, data.eventId));
EventBus.subscribe('spawn_invasion', (data) => Events.spawnInvasionCard(data.areaId, data.invasionId));

logger.info('CardManager', 'Dispatcher initialized with specialized sub-processors.');
