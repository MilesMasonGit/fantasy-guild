import { screenToGrid } from '../../../utils/CoordinateUtils.js';

/**
 * CardResolver - Handles grid placement, swapping, and blueprint assignment.
 */
export const CardResolver = {
    resolve(event, engine, activeData, overData) {
        const gridConfig = engine.GameState.state.grid?.gridConfig || engine.GameState.state.grid;
        if (!gridConfig) return { success: false, action: 'none' };

        const targetCardId = overData?.cardId || (overData?.type === 'card' ? overData.id : null);

        // 1. Blueprint assignment to a card
        if (activeData.cardType === 'blueprint' && targetCardId && targetCardId !== activeData.id) {
            const result = engine.CardManager.smartAssignEntity(targetCardId, 'blueprint', activeData.id);
            if (result.success) {
                return { success: true, action: 'assign_blueprint' };
            }
        }

        // 2. Grid Resolution
        let trueGridX, trueGridY;
        if (overData?.targetType === 'playmat_tile') {
            trueGridX = overData.x;
            trueGridY = overData.y;
        } else {
            const panRoot = document.getElementById('playmat-drop-zone');
            if (!panRoot) return { success: false, action: 'none', error: 'Viewport root not found' };

            const clientX = event.pointerPos?.x || event.activatorEvent.clientX;
            const clientY = event.pointerPos?.y || event.activatorEvent.clientY;

            const extents = this.getPlaymatExtents(gridConfig);
            const gridPos = screenToGrid(clientX, clientY, panRoot, extents);
            
            if (!gridPos) return { success: false, action: 'none' };
            trueGridX = gridPos.x;
            trueGridY = gridPos.y;
        }

        // 3. Execution: Update card position
        const isValidCell = gridConfig.validCells?.some(c => c.x === trueGridX && c.y === trueGridY && !c.isGutter);
        if (isValidCell) {
            // Prevent moving locked cards (like Invasions)
            if (activeData.cardState?.isLocked) return { success: false, action: 'none', error: 'CARD_LOCKED' };

            if (activeData.cardType === 'blueprint' && activeData.sourceCardId) {
                engine.CardManager.unassignBlueprint(activeData.sourceCardId);
            }

            engine.CardManager.updateCardPosition(activeData.id, trueGridX, trueGridY);
            if (engine.EffectEngine?.pulse) engine.EffectEngine.pulse();
            return { success: true, action: 'grid_placement', targetGridPos: { x: trueGridX, y: trueGridY } };
        }

        // 4. Fallback: Card-to-card swap
        if (targetCardId && targetCardId !== activeData.id) {
            const draggedCard = engine.GameState.getCardById(activeData.id);
            const targetCard = engine.GameState.getCardById(targetCardId);

            // Prevent swapping with locked cards (Invasions) or moving locked cards
            if (draggedCard?.isLocked || targetCard?.isLocked) return { success: false, action: 'none' };

            if (draggedCard?.position && targetCard?.position && draggedCard.position.x !== null && targetCard.position.x !== null) {
                // Capture target position BEFORE the swap for animation
                const swapTargetPos = { x: targetCard.position.x, y: targetCard.position.y };
                const oldX = draggedCard.position.x;
                const oldY = draggedCard.position.y;
                engine.CardManager.updateCardPosition(activeData.id, targetCard.position.x, targetCard.position.y);
                engine.CardManager.updateCardPosition(targetCardId, oldX, oldY);
                return { success: true, action: 'card_swap', targetGridPos: swapTargetPos };
            }
        }

        return { success: false, action: 'none' };
    },

    getPlaymatExtents(gridConfig) {
        if (!gridConfig.validCells?.length) {
            return { minX: 0, maxX: gridConfig.max_width || 8, minY: 0, maxY: gridConfig.max_height || 8 };
        }
        const xs = gridConfig.validCells.map(c => c.x);
        const ys = gridConfig.validCells.map(c => c.y);
        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    }
};
