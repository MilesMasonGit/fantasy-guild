// Fantasy Guild - DnD Router
// Extracts all drag-and-drop resolution logic from ReactRoot.handleDragEnd.
// This module is engine-aware but React-agnostic.

import { getItem } from '../../config/registries/index.js';
import { PLAYMAT_PADDING, GRID_PITCH } from '../../config/registries/layoutConstants.js';

/**
 * Resolve a dnd-kit DragEnd event.
 * @param {Object} event - The dnd-kit event ({ active, over })
 * @param {Object} engine - The game engine reference (GameState, CardManager, HeroManager, etc.)
 * @returns {void}
 */
export function resolve(event, engine) {
    const { active, over } = event;
    const activeData = active.data.current || { id: active.id };
    const overData = over?.data?.current;

    // 1. CARD SPATIAL REORDERING & GRID PLACEMENT
    if (activeData.type === 'card' && over) {
        resolveCardDrop(event, engine, activeData, overData);
        return;
    }

    const entityId = activeData.id;
    const entityType = activeData.type;
    if (!entityId || !entityType) return;

    // 2. INVENTORY MOVES (REORDER / GROUP MOVE / SELL)
    if (entityType === 'item') {
        const targetAction = overData?.action;
        if (targetAction === 'initiate-sell' || over?.id === 'sell-zone') {
            engine.EventBus.publish('dnd:sell-initiated', { itemId: entityId });
            return;
        }

        const targetGroupId = overData?.type === 'inventory_group' ? overData.id : overData?.groupId;
        if (targetGroupId) {
            const targetIndex = overData?.type === 'inventory_group'
                ? overData.itemCount
                : overData?.index;
            engine.InventoryGroupManager.moveItemToGroup(entityId, targetGroupId, targetIndex);
            return;
        }
    }

    // 2b. GROUP REORDERING
    if (entityType === 'inventory_group' && overData?.type === 'inventory_group') {
        if (entityId !== overData.id) {
            engine.InventoryGroupManager.reorderGroups(entityId, overData.id);
        }
        return;
    }

    // 3. TARGET IDENTIFICATION
    const overCardId = overData?.cardId || (overData?.type === 'card' ? overData.id : null);
    const overHeroId = overData?.type === 'hero' ? overData.id : null;
    const cardId = overCardId;

    // 4a. Drop into Tavern (Bench)
    if (over?.id === 'tavern-drawer' && entityType === 'hero') {
        engine.HeroManager.moveHeroToBench(entityId);
        engine.EventBus.publish('audio:play', { clip: 'hero_bench', type: 'ui' });
        return;
    }

    // 4b. Drop into Roster (Activate)
    if (over?.id === 'hero-view-roster' && entityType === 'hero') {
        const result = engine.HeroManager.moveHeroToActive(entityId);
        if (result.success) {
            engine.EventBus.publish('audio:play', { clip: 'hero_activate', type: 'ui' });
        } else {
            engine.EventBus.publish('notification', {
                message: result.error === 'ROSTER_FULL' ? 'Active roster is full!' : 'Cannot activate hero.',
                type: 'error'
            });
        }
        return;
    }

    // SWAPPING HEROES (Direct drop on other hero)
    if (overHeroId && entityType === 'hero' && entityId !== overHeroId) {
        const dragIsBenched = activeData.idPrefix === 'bench';
        const overIsBenched = overData.idPrefix === 'bench';

        if (dragIsBenched !== overIsBenched) {
            if (dragIsBenched) {
                engine.HeroManager.moveHeroToBench(overHeroId);
                engine.HeroManager.moveHeroToActive(entityId);
            } else {
                engine.HeroManager.moveHeroToBench(entityId);
                engine.HeroManager.moveHeroToActive(overHeroId);
            }
            engine.EventBus.publish('audio:play', { clip: 'hero_swap', type: 'ui' });
            return;
        }
    }

    // 5. UNASSIGNMENT CHECK
    if (!overCardId && !overHeroId) {
        if (activeData.sourceCardId) {
            try {
                if (entityType === 'hero') {
                    engine.CardManager.unassignHero(
                        activeData.sourceCardId,
                        activeData.sourceSlotIndex !== undefined ? activeData.sourceSlotIndex : undefined
                    );
                } else if (entityType === 'item') {
                    if (activeData.isTool) {
                        engine.CardManager.unassignTool(activeData.sourceCardId);
                    } else {
                        engine.CardManager.unassignItemFromSlot(
                            activeData.sourceCardId,
                            activeData.sourceSlotIndex
                        );
                    }
                } else if (entityType === 'card' && activeData.cardType === 'blueprint') {
                    engine.CardManager.unassignBlueprint(activeData.sourceCardId);
                }
                engine.EventBus.publish('audio:play', { clip: 'unassign', type: 'ui' });
            } catch (err) {
                console.error('[DndRouter] Error during unassignment:', err);
            }
        }
        return;
    }

    // 6. ENTITY ASSIGNMENT (slot-specific + smart routing)
    try {
        if (overData?.type === 'blueprintSlot' && activeData.cardType === 'blueprint') {
            engine.CardManager.assignBlueprint(cardId, entityId);
            engine.EventBus.publish('audio:play', { clip: 'blueprint_assign', type: 'ui' });
        }
        else if (overData?.type === 'heroSlot' && entityType === 'hero') {
            ensureHeroUnassigned(entityId, engine);
            if (cardId && overData.slotIndex !== undefined) {
                engine.CardManager.unassignHero(cardId, overData.slotIndex);
                engine.EventBus.publish('audio:play', { clip: 'unassign', type: 'ui' });
            }
            engine.CardManager.assignHero(cardId, entityId, overData.slotIndex);
            engine.EventBus.publish('audio:play', { clip: 'hero_assign', type: 'ui' });
        }
        else if (overData?.type === 'toolSlot' && entityType === 'item') {
            engine.CardManager.assignTool(cardId, entityId);
            engine.EventBus.publish('audio:play', { clip: 'tool_assign', type: 'ui' });
        }
        else if (overData?.type === 'inputSlot' && entityType === 'item') {
            engine.CardManager.unassignItemFromSlot(cardId, overData.slotIndex);
            engine.EventBus.publish('audio:play', { clip: 'unassign', type: 'ui' });
            engine.CardManager.assignItemToSlot(cardId, overData.slotIndex, entityId);
            engine.EventBus.publish('audio:play', { clip: 'item_assign', type: 'ui' });
        }
        // General Card/Area drop handling (smart routing)
        else if (overData?.targetType === 'card_area' || overData?.targetType === 'card' || overData?.type === 'card' || overData?.type === 'heroSlot' || overData?.type === 'inputSlot') {
            const routedEntityType = entityType === 'card' ? activeData.cardType : entityType;
            if (routedEntityType === 'hero') ensureHeroUnassigned(entityId, engine);
            engine.CardManager.smartAssignEntity(cardId, routedEntityType, entityId);
            engine.EventBus.publish('audio:play', { clip: 'card_place', type: 'ui' });
        }
        // ITEM ON HERO EQUIPPING
        else if (overData?.type === 'hero' && entityType === 'item') {
            const itemDef = getItem(entityId);
            const slot = itemDef?.equipSlot;
            if (slot) {
                engine.EquipmentManager.equipItem(overData.id, entityId, slot);
                engine.EventBus.publish('audio:play', { clip: 'item_equip', type: 'ui' });
            }
        }
    } catch (err) {
        console.error('[DndRouter] Error during drop assignment:', err);
    }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Resolve card-type drag-and-drop (grid placement, swap, blueprint assignment)
 */
function resolveCardDrop(event, engine, activeData, overData) {
    const { over } = event;
    const targetData = over.data.current;

    // Blueprint assignment priority
    if (activeData.cardType === 'blueprint') {
        const targetCardId = targetData?.cardId || (targetData?.type === 'card' ? targetData.id : null);
        if (targetCardId && targetCardId !== activeData.id) {
            const result = engine.CardManager.smartAssignEntity(targetCardId, 'blueprint', activeData.id);
            if (result.success) {
                engine.EventBus.publish('audio:play', { clip: 'card_place', type: 'ui' });
                return;
            }
        }
    }

    // Playmat surface grid placement
    if (targetData?.targetType === 'playmat_area') {
        if (activeData.cardType === 'blueprint' && activeData.sourceCardId) {
            engine.CardManager.unassignBlueprint(activeData.sourceCardId);
        }

        const containerNode = document.getElementById('playmat-drop-zone');
        if (containerNode) {
            const rect = containerNode.getBoundingClientRect();
            const cursorX = event.active.rect.current.translated.left + (event.active.rect.current.translated.width / 2);
            const cursorY = event.active.rect.current.translated.top + (event.active.rect.current.translated.height / 2);

            const scale = rect.width / containerNode.offsetWidth;
            const logicalX = (cursorX - rect.left) / scale;
            const logicalY = (cursorY - rect.top) / scale;

            const gridX = Math.round((logicalX - PLAYMAT_PADDING) / GRID_PITCH);
            const gridY = Math.round((logicalY - PLAYMAT_PADDING) / GRID_PITCH);

            const gridConfig = engine.GameState.state.grid?.gridConfig || engine.GameState.state.grid;

            if (gridConfig) {
                const extents = { minX: 0, minY: 0 };
                if (gridConfig.validCells?.length) {
                    extents.minX = Math.min(...gridConfig.validCells.map(c => c.x));
                    extents.minY = Math.min(...gridConfig.validCells.map(c => c.y));
                }

                const trueGridX = gridX + extents.minX;
                const trueGridY = gridY + extents.minY;

                const isValidCell = gridConfig.validCells?.some(c => c.x === trueGridX && c.y === trueGridY);

                if (isValidCell) {
                    engine.CardManager.updateCardPosition(activeData.id, trueGridX, trueGridY);
                    engine.EventBus.publish('audio:play', { clip: 'card_place', type: 'ui' });
                    engine.EffectProcessor.calculateAdjacencyBonuses();
                }
            }
        }
        return;
    }

    // Card-to-card swap / reorder
    const targetCardId = targetData?.cardId || (targetData?.type === 'card' ? targetData.id : null);
    if (targetCardId && targetCardId !== activeData.id) {
        const draggedCard = engine.GameState.getCardById(activeData.id);
        const targetCard = engine.GameState.getCardById(targetCardId);

        if (draggedCard?.position && targetCard?.position && draggedCard.position.x !== null && targetCard.position.x !== null) {
            const oldX = draggedCard.position.x;
            const oldY = draggedCard.position.y;
            engine.CardManager.updateCardPosition(activeData.id, targetCard.position.x, targetCard.position.y);
            engine.CardManager.updateCardPosition(targetCardId, oldX, oldY);
            engine.EventBus.publish('audio:play', { clip: 'card_swap', type: 'ui' });
        } else {
            const activeCards = engine.GameState.cards?.active || [];
            const targetIndex = activeCards.findIndex(c => c.id === targetCardId);
            if (targetIndex !== -1) {
                engine.CardManager.reorderCard(activeData.id, targetIndex);
            }
        }
    }
    engine.EffectProcessor.calculateAdjacencyBonuses();
}

/**
 * Helper: unassign a hero from its current card before moving
 */
function ensureHeroUnassigned(heroId, engine) {
    const hero = engine.HeroManager.getHero(heroId);
    if (!hero) return;

    // If hero is benched, activate them first if there is room
    if (engine.GameState.bench.some(h => h.id === heroId)) {
        const result = engine.HeroManager.moveHeroToActive(heroId);
        if (!result.success) {
            throw new Error(result.error);
        }
    }

    if (hero.assignedCardId) {
        const sourceCard = engine.CardManager.getCard(hero.assignedCardId);
        if (sourceCard?.heroSlots) {
            const idx = Object.keys(sourceCard.heroSlots).find(k => sourceCard.heroSlots[k] === heroId);
            engine.CardManager.unassignHero(sourceCard.id, idx !== undefined ? parseInt(idx) : undefined);
        } else {
            engine.CardManager.unassignHero(hero.assignedCardId);
        }
    }
}
