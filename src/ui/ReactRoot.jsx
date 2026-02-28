import React, { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { EngineProvider } from './context/EngineContext.jsx';
import PalettePreview from './components/PalettePreview.jsx';
import GICard from './components/base/GICard.jsx';
import TopBarView from './components/TopBarView.jsx';
import HeroView from './components/HeroView.jsx';
import InvView from './components/InvView.jsx';
import CardView from './components/CardView.jsx';
import TestDashboard from './components/TestDashboard.jsx';

/**
 * The root entry point for the new React layer.
 * It provides the EngineContext to all descendant React components.
 * 
 * Note: the container uses pointer-events-none to ensure it doesn't 
 * block clicks to the underlying Vanilla UI during the Strangler Fig transition.
 * Individual React panels will re-enable pointer events as they are built.
 */
export const ReactRoot = ({ engine }) => {
    // Track the currently dragged item payload for rendering the overlay
    const [activeDragData, setActiveDragData] = useState(null);

    // Configure drag constraints to prevent accidental pickup when clicking buttons inside cards
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 3, // Requires 3 pixels of movement to activate drag
            },
        })
    );

    // Fired immediately when a draggable item is picked up
    const handleDragStart = (event) => {
        const { active } = event;
        console.log(`[DND] Picked up ${active.id}`, active.data.current);
        setActiveDragData(active.data.current || { id: active.id });
    };

    // Fired when a draggable item is dropped
    const handleDragEnd = (event) => {
        const { active, over } = event;
        // Always clear the active drag visual state on end
        setActiveDragData(null);

        if (!over) {
            console.log(`[DND] Dropped ${active.id} in invalid area, snapping back.`);
            return;
        }

        const activeData = active.data.current;
        const overData = over.data.current;

        // --- THE ENGINE ADAPTER BRIDGE ---
        // If a hero was dropped onto a card slot
        if (activeData?.type === 'hero' && overData?.targetType === 'card') {
            const heroId = activeData.heroId;
            const cardId = overData.cardId;

            // Replicate the legacy DragDropHandler logic to unassign before reassigning
            const hero = engine.HeroManager.getHero(heroId);
            if (hero && hero.assignedCardId) {
                const sourceCard = engine.CardManager.getCard(hero.assignedCardId);
                if (sourceCard && sourceCard.stack) {
                    // Try to pop from top of stack first
                    if (sourceCard.stack.length > 0 && sourceCard.stack[sourceCard.stack.length - 1].id === heroId) {
                        engine.CardManager.unassignTopFromStack(sourceCard.id);
                    } else {
                        engine.CardManager.unassignHero(sourceCard.id);
                    }
                } else {
                    engine.CardManager.unassignHero(hero.assignedCardId);
                }
            }

            // Perform the assignment
            const result = engine.CardManager.assignEntityToStack(cardId, 'hero', heroId);
            if (!result.success) {
                console.warn(`[DND] Engine rejected Hero drop on ${cardId}:`, result.error);
                // Ideally trigger a warning toast here using NotificationSystem, but we rely on simple logs for now.
            } else {
                console.log(`[DND] Successfully assigned Hero ${heroId} to Card ${cardId}`);
            }
        }
    };

    // Configuration for the visual snap-back animation when a drop is cancelled/invalid
    const dropAnimationConfig = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
    };

    return (
        <EngineProvider engine={engine}>
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                {/* 
                  The root overlay container is pointer-events-none to allow clicks through to the Vanilla DOM.
                  Individual React views must implement pointer-events-auto to be interactive.
                */}
                <div className="react-overlay absolute inset-0 z-50 pointer-events-none flex flex-col">
                    <div className="pointer-events-auto w-full">
                        <TopBarView onSettingsClick={() => console.log('Settings opened')} />
                    </div>

                    <div className="flex-1 relative flex overflow-hidden">
                        {/* Left Panel: Hero Roster */}
                        <div className="pointer-events-auto h-full z-[90]">
                            <HeroView />
                        </div>

                        {/* Center Area: Playmat / Dashboard */}
                        <div className="flex-1 overflow-y-auto pointer-events-auto">
                            <CardView />
                        </div>

                        {/* Right Panel: Inventory / Vault */}
                        <div className="pointer-events-auto h-full z-[90]">
                            <InvView />
                        </div>
                    </div>
                </div>

                {/* 
                  DragOverlay renders a duplicate of the actively dragged item at the highest z-index.
                  zIndex 200 matches the overlay of our modals to ensure dragged cards never clip under backgrounds.
                 */}
                <DragOverlay dropAnimation={dropAnimationConfig} zIndex={200}>
                    {activeDragData ? (
                        activeDragData.type === 'card' ? (
                            <GICard
                                rarity={activeDragData.rarity}
                                interactive={false}
                                className="rotate-3 scale-105 shadow-2xl opacity-90 backdrop-blur-md"
                            >
                                <div className="flex-1 bg-gi-surface-hover/50 rounded border border-dashed border-gi-border/30 flex items-center justify-center text-gi-muted/50 mb-2">Image Area</div>
                                <div className="p-2">
                                    <div className="text-gi-text font-bold text-lg drop-shadow-md">{activeDragData.title}</div>
                                    <div className="text-gi-muted text-xs mt-1 drop-shadow-md">{activeDragData.subtitle}</div>
                                </div>
                            </GICard>
                        ) : (
                            <div className="bg-gi-surface border border-gi-primary shadow-[0_0_20px_rgba(6,182,212,0.5)] p-2 rounded w-64 opacity-90 backdrop-blur-md text-gi-text font-bold text-center">
                                Moving: {activeDragData.title || activeDragData.id}
                            </div>
                        )
                    ) : null}
                </DragOverlay>

                {/* Developer QA Tool */}
                <TestDashboard />
            </DndContext>
        </EngineProvider>
    );
};

export default ReactRoot;
