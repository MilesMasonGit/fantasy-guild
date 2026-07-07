import { EventBus } from '../core/EventBus.js';
import * as CardManager from '../cards/CardManager.js';
import { InventoryManager } from '../inventory/InventoryManager.js';

export function assignBlueprint(blueprintId, buildingId) {
    const blueprint = CardManager.getCard(blueprintId);
    const building = CardManager.getCard(buildingId);
    if (!blueprint || !building) return { success: false, error: 'NOT_FOUND' };

    if (building.assignedBlueprintId) unassignBlueprint(buildingId);
    building.assignedBlueprintId = blueprintId;
    blueprint.isHidden = true;

    CardManager.bumpCardRev(building);
    CardManager.bumpCardRev(blueprint);
    EventBus.publish('blueprint_assigned', { blueprintId, buildingId });
    CardManager.publishCardUpdate(buildingId);
    CardManager.publishCardUpdate(blueprintId);
    return { success: true };
}

export function unassignBlueprint(buildingId) {
    const building = CardManager.getCard(buildingId);
    if (!building?.assignedBlueprintId) return { success: true };

    const blueprint = CardManager.getCard(building.assignedBlueprintId);
    building.assignedBlueprintId = null;
    if (blueprint) blueprint.isHidden = false;

    CardManager.bumpCardRev(building);
    if (blueprint) CardManager.bumpCardRev(blueprint);
    EventBus.publish('blueprint_unassigned', { buildingId });
    CardManager.publishCardUpdate(buildingId);
    if (blueprint) CardManager.publishCardUpdate(blueprint.id);
    return { success: true };
}

export function assignTool(cardId, itemId) {
    const card = CardManager.getCard(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };
    if (!InventoryManager.hasItem(itemId)) return { success: false, error: 'ITEM_NOT_AVAILABLE' };

    card.assignedToolId = itemId;
    CardManager.bumpCardRev(card);
    EventBus.publish('tool_assigned', { cardId, itemId });
    CardManager.publishCardUpdate(cardId);
    return { success: true };
}

export function unassignTool(cardId) {
    const card = CardManager.getCard(cardId);
    if (!card?.assignedToolId) return { success: true };

    card.assignedToolId = null;
    CardManager.bumpCardRev(card);
    EventBus.publish('tool_unassigned', { cardId });
    CardManager.publishCardUpdate(cardId);
    return { success: true };
}

export function assignItem(cardId, slotIndex, itemId, amount = 1) {
    const card = CardManager.getCard(cardId);
    if (!card) return { success: false, error: 'CARD_NOT_FOUND' };

    if (!card.assignedItems) card.assignedItems = {};
    card.assignedItems[slotIndex] = { id: itemId, amount, isGhost: true };

    CardManager.bumpCardRev(card);
    EventBus.publish('item_assigned', { cardId, slotIndex, itemId });
    CardManager.publishCardUpdate(cardId);
    return { success: true };
}

export function unassignItem(cardId, slotIndex) {
    const card = CardManager.getCard(cardId);
    if (!card?.assignedItems?.[slotIndex]) return { success: true };

    delete card.assignedItems[slotIndex];
    CardManager.bumpCardRev(card);
    EventBus.publish('item_unassigned', { cardId, slotIndex });
    CardManager.publishCardUpdate(cardId);
    return { success: true };
}
