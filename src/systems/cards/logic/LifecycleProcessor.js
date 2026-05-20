import { GameState } from '../../../state/GameState.js';
import { EventBus } from '../../core/EventBus.js';
import { getCard as getCardTemplate, CARD_TYPES } from '../../../config/registries/cardRegistry.js';
import { isDeckType } from '../DeckSystem.js';
import { logger } from '../../../utils/Logger.js';
import { effectEngine } from '../../effects/EffectEngine.js';
import { CardFactory } from './CardFactory.js';
import { CardStackManager } from './CardStackManager.js';
import { AssignmentSystem } from '../../global/AssignmentSystem.js';
import { CollectionManager } from '../../progression/CollectionManager.js';
import { publishCardUpdate } from './CardManagerUtils.js';

/**
 * Card Lifecycle - Handles Instance creation, Discarding, and Status management.
 */

export function createCard(templateId, options = {}) {
    const template = typeof templateId === 'object' ? templateId : getCardTemplate(templateId);
    if (!template) return { success: false, error: 'TEMPLATE_NOT_FOUND' };

    const cards = GameState.cards;

    // Check card limit (unless card is unique or a deck type)
    if (!template.isUnique && !isDeckType(template.cardType) && cards.limits.currentCount >= cards.limits.max) {
        return { success: false, error: 'CARD_LIMIT_REACHED' };
    }

    // Delegate creation to Factory
    const card = CardFactory.createInstance(templateId, options);
    if (!card) return { success: false, error: 'CREATION_FAILED' };

    // Delegate positioning/stacking to StackManager
    CardStackManager.addToStack(card);
    GameState.cacheCard(card);

    // Initial position assignment
    if (card.location === 'board' && (!card.position || card.position.x === null)) {
        const spawnPos = CardStackManager.findFirstEmptyCell();
        if (spawnPos) {
            card.position = { x: spawnPos.x, y: spawnPos.y };
        }
    }

    // Update global limits
    if (!card.isUnique && !isDeckType(card.cardType)) {
        cards.limits.currentCount++;
    }

    // Events
    EventBus.publish('card_spawned', {
        cardId: card.id,
        cardType: card.cardType,
        templateId: card.templateId,
        enemyId: card.enemyId
    });

    if (card.cardType === CARD_TYPES.TASK) {
        EventBus.publish('task_card_created', { templateId: card.templateId });
    }

    effectEngine.pulse();
    publishCardUpdate(card.id);

    logger.info('LifecycleProcessor', `Created card "${card.name}" (${card.id}) [Modular]`);
    return { success: true, card };
}

export function vaultCard(cardId) {
    const cards = GameState.cards;
    const index = cards.active.findIndex(c => c.id === cardId);

    if (index === -1) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    const card = cards.active[index];

    // 1. Unassign all entities
    unassignAllHeroesFromCard(card);
    if (card.assignedBlueprintId) AssignmentSystem.unassignBlueprint(cardId);
    if (card.assignedToolId) AssignmentSystem.unassignTool(cardId);

    // 2. Transfer to Library
    cards.active.splice(index, 1);
    card.location = 'library';
    card.position = { x: null, y: null };
    card.status = 'idle'; // Reset status when vaulted
    cards.library.push(card);

    // 3. Update count (unless unique or deck type)
    if (!card.isUnique && !isDeckType(card.cardType)) {
        cards.limits.currentCount = Math.max(0, cards.limits.currentCount - 1);
    }

    effectEngine.pulse();
    publishCardUpdate(cardId, { location: 'library' });
    
    logger.info('LifecycleProcessor', `Vaulted card "${card.name}" (${cardId}) to Binder.`);
    return { success: true };
}

export function deployCard(cardId) {
    const cards = GameState.cards;
    const index = cards.library.findIndex(c => c.id === cardId);

    if (index === -1) {
        return { success: false, error: 'CARD_NOT_FOUND_IN_LIBRARY' };
    }

    // 1. Check Capacity
    if (cards.limits.currentCount >= cards.limits.max) {
        return { success: false, error: 'BOARD_FULL' };
    }

    // 2. Find Position
    const spawnPos = CardStackManager.findFirstEmptyCell();
    if (!spawnPos) {
        return { success: false, error: 'NO_EMPTY_CELL' };
    }

    const card = cards.library[index];

    // 3. Transfer to Board
    cards.library.splice(index, 1);
    card.location = 'board';
    card.position = { x: spawnPos.x, y: spawnPos.y };
    cards.active.push(card);

    // 4. Update count
    if (!card.isUnique && !isDeckType(card.cardType)) {
        cards.limits.currentCount++;
    }

    effectEngine.pulse();
    publishCardUpdate(cardId, { location: 'board' });

    logger.info('LifecycleProcessor', `Deployed card "${card.name}" (${cardId}) to Playmat.`);
    return { success: true };
}

export function discardCard(cardId) {
    const card = GameState.getCardById(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    // New Permanent Collection Rules:
    // 1. Quests cannot be vaulted (user rule).
    // 2. Decks/Packs are temporary board entities.
    // 3. System events/invasions are temporary.
    const isQuest = card.cardType === CARD_TYPES.QUEST;
    const isTemp = card.cardType === 'event' || card.cardType === 'invasion';
    const isDeck = isDeckType(card.cardType);

    if (isQuest || isTemp || isDeck) {
        return permanentlyRemoveCard(cardId);
    }

    // Standard task/combat cards are vaulted to the binder.
    return vaultCard(cardId);
}

/**
 * Legacy discard logic renamed to reflect permanent removal.
 */
function permanentlyRemoveCard(cardId) {
    const cards = GameState.cards;
    const index = cards.active.findIndex(c => c.id === cardId);

    if (index === -1) {
        return { success: false, error: 'CARD_NOT_FOUND' };
    }

    const card = cards.active[index];

    // Bulk Unassign Hero
    unassignAllHeroesFromCard(card);

    // Unassign Blueprints/Tools
    if (card.assignedBlueprintId) AssignmentSystem.unassignBlueprint(cardId);
    if (card.assignedToolId) AssignmentSystem.unassignTool(cardId);

    // Handle host blueprint unassignment
    if (card.cardType === CARD_TYPES.BLUEPRINT) {
        const host = GameState.cards.active.find(c => c.assignedBlueprintId === cardId);
        if (host) AssignmentSystem.unassignBlueprint(host.id);
    }

    // Remove from active
    cards.active.splice(index, 1);

    // Remove from card lookup cache
    GameState.uncacheCard(cardId);

    // Update count (unless unique or deck type)
    if (!card.isUnique && !isDeckType(card.cardType)) {
        cards.limits.currentCount = Math.max(0, cards.limits.currentCount - 1);
    }

    // Recalculate grid bonuses
    effectEngine.pulse();

    EventBus.publish('card_discarded', { cardId, templateId: card.templateId });
    publishCardUpdate(cardId, { source: 'discard' });
    
    logger.info('LifecycleProcessor', `Permanently removed card "${card.name}" (${card.id})`);
    return { success: true };
}

/**
 * Interface for opening a physical Booster Pack on the board.
 */
export function openPack(cardId) {
    const card = GameState.getCardById(cardId);
    if (!card || card.cardType !== 'pack') {
        return { success: false, error: 'NOT_A_PACK' };
    }

    const areaId = card.areaId || GameState.activeAreaId;
    const options = CollectionManager.generatePackOptions(areaId);

    if (options.length === 0) {
        return { success: false, error: 'AREA_EXHAUSTED' };
    }

    // Trigger UI with options
    EventBus.publish('ui:open_pack_overlay', {
        packCardId: cardId,
        areaId: areaId,
        options: options
    });

    return { success: true };
}

export function setCardStatus(cardId, status) {
    const card = GameState.getCardById(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    card.status = status;
    publishCardUpdate(cardId, { status });
    return { success: true };
}

/**
 * Internal helper for unassigning all heroes from a card
 */
function unassignAllHeroesFromCard(card) {
    if (card.assignedHeroId) {
        AssignmentSystem.unassignHero(card.assignedHeroId);
    }
}

