import { CardResolver } from './resolvers/CardResolver.js';
import { HeroTransferResolver } from './resolvers/HeroTransferResolver.js';
import { AssignmentResolver } from './resolvers/AssignmentResolver.js';
import { InventoryResolver } from './resolvers/InventoryResolver.js';
import { USE_DECK_LOOP } from '../../config/featureFlags.js';

/**
 * resolveManualOverData - Fallback when dnd-kit fails to find a target.
 * Uses pointer coordinates to find the droppable container directly from the DOM.
 */
function resolveManualOverData(pointerPos) {
    if (!pointerPos || typeof document === 'undefined') return null;

    // Use elementsFromPoint to find the top-most droppable or dnd-target
    const elements = document.elementsFromPoint(pointerPos.x, pointerPos.y);
    const target = elements.find(el =>
        el.hasAttribute('data-droppable-id') ||
        el.classList.contains('dnd-target') ||
        el.hasAttribute('data-card-id')
    );

    if (!target) return null;

    return {
        id: target.getAttribute('data-droppable-id') || target.id,
        data: {
            current: {
                type: target.getAttribute('data-type'),
                cardId: target.getAttribute('data-card-id'),
                slotIndex: parseInt(target.getAttribute('data-slot-index')) || 0,
                targetType: target.getAttribute('data-target-type') || target.getAttribute('data-type')
            }
        }
    };
}

/**
 * resolve - Main Entry Point for DND events.
 * Dispatches to specialized resolvers based on entity type.
 */
export function resolve(event, engine) {
    const { active, pointerPos } = event;
    let { over } = event;

    // 0. MANUAL OVER RESOLUTION (Fallback for transformed viewports)
    if (!over && pointerPos) {
        over = resolveManualOverData(pointerPos);
    }

    const activeData = active?.data?.current || { id: active?.id };
    const overData = over?.data?.current;

    const entityType = activeData.type;
    const cardType = activeData.cardType;

    try {
        // 1. CARDS (Grid Placement / Swaps / Blueprints)
        // 2D grid placement is gated under the deck loop rework (Phase 1).
        // Drops on the new Area Banner slots get their own resolvers later
        // (roadmap Phase 5/6) — hit-testing here is kept for that adaptation.
        if (!USE_DECK_LOOP && (entityType === 'card' || cardType === 'blueprint')) {
            const result = CardResolver.resolve(event, engine, activeData, overData);
            if (result && result.action !== 'none') return result;
        }

        // 2. HERO TRANSFER (Tavern / Roster / Swap)
        if (entityType === 'hero') {
            const result = HeroTransferResolver.resolve(event, engine, activeData, overData);
            if (result && result.action !== 'none') return result;
        }

        // 3. INVENTORY & GROUPS (Sales / Moves)
        if (entityType === 'item' || entityType === 'inventory_group') {
            const result = InventoryResolver.resolve(event, engine, activeData, overData);
            if (result && result.action !== 'none') return result;
        }

        // 4. ASSIGNMENT & UNASSIGNMENT (Final Fallback)
        // Assignment handles Hero/Tool/Item drops on slots or surfaces.
        return AssignmentResolver.resolve(event, engine, activeData, overData);

    } catch (err) {
        console.error('[DndRouter] Dispatch error:', err);
        return { success: false, action: 'error', error: err.message };
    }
}

