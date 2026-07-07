import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    DndContext,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragOverlay,
    pointerWithin,
    closestCenter
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { useViewport } from './ViewportContext.jsx';
import { motion } from 'framer-motion';

import { ActiveCardFace } from '../components/ActiveCardFace.jsx';
import ItemIcon from '../components/base/ItemIcon.jsx';
import BadgeGutter from '../components/hud/BadgeGutter.jsx';
import { resolve as resolveDndDrop } from '../../systems/dnd/DndRouter.js';
import { FeedbackManager } from '../../systems/dnd/FeedbackManager.js';
import { getLogicalPosition } from '../../utils/CoordinateUtils.js';

/**
 * DRAG_EFFECTS
 * Configuration for visual feedback during drags.
 */
const DRAG_EFFECTS = {
    card: {
        scale: 1.05,
        dropShadow: 'shadow-2xl'
    },
    hero: {
        scale: 1.1,
        dropShadow: 'drop-shadow-xl'
    },
    item: {
        scale: 1.1,
        dropShadow: 'drop-shadow-xl'
    }
};

/**
 * DndProvider
 * Extracts the heavy drag-and-drop physics and resolution from ReactRoot.
 */
export const DndProvider = ({ children, engine }) => {
    const { targetScale } = useViewport();
    const [activeDragData, setActiveDragData] = useState(null);
    const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });
    const lastPointerPos = useRef({ x: 0, y: 0 });
    const dropTargetScreenRef = useRef(null);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    useEffect(() => {
        const handlePointerMove = (e) => {
            lastPointerPos.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        return () => window.removeEventListener('pointermove', handlePointerMove);
    }, []);

    // PERFORMANCE: Spatial Pruning & Layered Collision Strategy
    const customCollisionDetection = useCallback((args) => {
        const { active, pointerCoordinates, droppableContainers } = args;
        if (!active || !pointerCoordinates) return [];

        const activeData = active.data.current;
        const type = activeData?.type;
        const isCardMove = type === 'card' || activeData?.cardType === 'blueprint';

        const candidateContainers = droppableContainers.filter(c => {
            const targetData = c.data.current;
            const targetType = targetData?.targetType || targetData?.type;

            if (isCardMove) {
                return targetType === 'grid-cell';
            } else {
                return ['card_area', 'card', 'heroSlot', 'inputSlot', 'toolSlot', 'blueprintSlot', 'inventory_group', 'item', 'hero'].includes(targetType) ||
                    c.id.toString().includes('item-') ||
                    c.id.toString().includes('group-');
            }
        });

        if (!isCardMove) {
            return closestCenter(args);
        }

        const MAX_RADIUS_SQ = 1200 * 1200;
        const prunedContainers = candidateContainers.filter(c => {
            const rect = c.rect;
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const dx = pointerCoordinates.x - centerX;
            const dy = pointerCoordinates.y - centerY;
            return (dx * dx + dy * dy) < MAX_RADIUS_SQ;
        });

        if (prunedContainers.length === 0) return [];
        return closestCenter({ ...args, droppableContainers: prunedContainers });
    }, []);

    const handleDragStart = useCallback((event) => {
        const { active } = event;
        const activeData = active.data.current || { id: active.id };

        if (active.rect.current.initial) {
            const rect = active.rect.current.initial;
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            setDragStartOffset({
                x: centerX - event.activatorEvent.clientX,
                y: centerY - event.activatorEvent.clientY
            });
        }

        setActiveDragData(activeData);

        const type = activeData.type || 'item';
        document.body.setAttribute('data-dragging-type', type);
        document.body.classList.add('is-dragging', `is-dragging-${type}`);
        if (activeData.id) document.body.setAttribute('data-dragging-id', activeData.id);

        engine.EventBus.publish('dnd:drag-start', activeData);
        engine.EventBus.publish('audio:pickup', { type: activeData.type });
    }, [engine]);

    const handleDragOver = useCallback(() => { }, []);
    const handleDragEnd = useCallback((event) => {
        const { over, active } = event;
        const pointerPos = lastPointerPos.current;

        const result = resolveDndDrop({ ...event, over, pointerPos }, engine);
        const success = result?.success || false;

        // Compute target screen position for the drop animation
        if (result?.success && result.targetGridPos) {
            const panRoot = document.getElementById('playmat-drop-zone');
            if (panRoot) {
                const surfaceRect = panRoot.getBoundingClientRect();
                const surfaceScale = surfaceRect.width / panRoot.offsetWidth;

                const gridConfig = engine.GameState.state.grid;
                const validCells = gridConfig?.validCells || [];
                if (validCells.length > 0) {
                    const xs = validCells.map(c => c.x);
                    const ys = validCells.map(c => c.y);
                    const minX = Math.min(...xs);
                    const minY = Math.min(...ys);

                    const { px, py } = getLogicalPosition(
                        result.targetGridPos.x, result.targetGridPos.y, minX, minY
                    );

                    dropTargetScreenRef.current = {
                        x: surfaceRect.left + px * surfaceScale,
                        y: surfaceRect.top + py * surfaceScale
                    };
                }
            }
        } else {
            dropTargetScreenRef.current = null;
        }

        if (result) FeedbackManager.handleResult(result, engine);

        document.body.removeAttribute('data-dragging-type');
        document.body.removeAttribute('data-dragging-id');
        document.body.classList.remove('is-dragging', 'is-dragging-card', 'is-dragging-hero', 'is-dragging-item', 'is-dragging-blueprint');

        setActiveDragData(null);
        engine.EventBus.publish('dnd:drag-end');
        engine.EventBus.publish('audio:drop', { success });
    }, [engine]);

    /**
     * Custom drop animation that glides the overlay ghost from cursor → target slot.
     * The default @dnd-kit animation always flies back to the drag origin because
     * transform.final targets the original draggable element's rect.
     * We override keyframes to redirect toward the resolved target cell instead.
     */
    const dropAnimationConfig = {
        duration: 280,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        keyframes({ transform }) {
            const target = dropTargetScreenRef.current;
            const cursor = lastPointerPos.current;

            if (!target || !cursor || !transform?.initial) {
                // Failed drop or no target — fade out in place
                return [
                    { transform: CSS.Transform.toString(transform.initial), opacity: 1 },
                    { transform: CSS.Transform.toString(transform.initial), opacity: 0 }
                ];
            }

            // Compute delta from current cursor position to target cell center
            const dx = target.x - cursor.x;
            const dy = target.y - cursor.y;

            // Add cursor→target delta onto the current overlay transform
            const finalTransform = {
                x: transform.initial.x + dx,
                y: transform.initial.y + dy,
                scaleX: transform.initial.scaleX ?? 1,
                scaleY: transform.initial.scaleY ?? 1
            };

            return [
                { transform: CSS.Transform.toString(transform.initial), opacity: 1 },
                { transform: CSS.Transform.toString(finalTransform), opacity: 1 }
            ];
        },
        sideEffects({ active }) {
            // Keep source card hidden during the glide so there's no duplicate
            active?.node?.classList.add('is-settling');
            return () => {
                active?.node?.classList.remove('is-settling');
                dropTargetScreenRef.current = null;
            };
        }
    };

    const dragEffect = activeDragData ? (DRAG_EFFECTS[activeDragData.type] || DRAG_EFFECTS.item) : DRAG_EFFECTS.item;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            autoScroll={false}
        >
            {children}

            <DragOverlay
                modifiers={[snapCenterToCursor]}
                dropAnimation={dropAnimationConfig}
                zIndex={1000}
                className="pointer-events-none transform-gpu"
            >
                {activeDragData ? (
                    <div className="relative flex items-center justify-center w-0 h-0 overflow-visible">
                        <motion.div
                            initial={{
                                x: dragStartOffset.x,
                                y: dragStartOffset.y,
                                opacity: 1
                            }}
                            animate={{
                                x: 0,
                                y: 0,
                                opacity: 1
                            }}
                            transition={{
                                type: 'spring',
                                stiffness: 300,
                                damping: 30,
                                mass: 0.5
                            }}
                            style={{
                                scale: activeDragData?.type === 'card' ? targetScale : 1
                            }}
                        >
                            <motion.div
                                initial={{ scale: 0.95 }}
                                animate={{ scale: dragEffect.scale }}
                                transition={{ duration: 0.2 }}
                                className={dragEffect.dropShadow}
                            >
                                {activeDragData.type === 'card' ? (
                                    <div className="w-[280px] h-[440px] flex-shrink-0">
                                        <ActiveCardFace
                                            cardId={activeDragData.id}
                                            cardState={activeDragData.cardState}
                                            template={activeDragData.template}
                                            isHovered={false}
                                        />
                                    </div>
                                ) : (
                                    <ItemIcon
                                        item={activeDragData}
                                        size={128}
                                    />
                                )}
                            </motion.div>
                        </motion.div>
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default DndProvider;
