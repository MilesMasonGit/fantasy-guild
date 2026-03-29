import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay, defaultDropAnimationSideEffects, pointerWithin } from '@dnd-kit/core';
import { snapCenterToCursor } from '@dnd-kit/modifiers';
import { EngineProvider } from './context/EngineContext.jsx';
import PalettePreview from './components/PalettePreview.jsx';
import GICard from './components/base/GICard.jsx';
import TopBarView from './components/TopBarView.jsx';
import HeroView from './components/HeroView.jsx';
import InvView from './components/InvView.jsx';
import CardView from './components/CardView.jsx';
import TestDashboard from './components/TestDashboard.jsx';
import WorldMapDrawer from './components/WorldMapDrawer.jsx';
import PackOpeningOverlay from './components/PackOpeningOverlay.jsx';
import SettingsModal from './modals/SettingsModal.jsx';
import CardLibraryModal from './modals/CardLibraryModal.jsx';
import CollectionModal from './modals/CollectionModal.jsx';
import SpawnItemModal from './modals/SpawnItemModal.jsx';
import SlotSelectionModal from './modals/SlotSelectionModal.jsx';
import HeroIdentityStrip from './components/HeroIdentityStrip.jsx';
import TavernDrawer from './components/TavernDrawer.jsx';
import InvasionHUD from './components/hud/InvasionHUD.jsx';
import LayoutSandbox from './components/sandbox/LayoutSandbox.jsx';
import { FPSCounter } from './components/base/FPSCounter.jsx';
import ToastContainer from './components/base/ToastContainer.jsx';
import { getItem } from '../config/registries/index.js';
import { isPlacementAllowed } from '../utils/GridLookup.js';
import { resolve as resolveDndDrop } from '../systems/dnd/DndRouter.js';
import { CARD_WIDTH, CARD_HEIGHT, PLAYMAT_GAP_X, PLAYMAT_GAP_Y, PLAYMAT_PADDING, GRID_PITCH } from '../config/registries/layoutConstants.js';

/**
 * The root entry point for the new React layer.
 * It provides the EngineContext to all descendant React components.
 * 
 * Note: the container uses pointer-events-none to ensure it doesn't 
 * block clicks to the underlying Vanilla UI during the Strangler Fig transition.
 * Individual React panels will re-enable pointer events as they are built.
 */
/**
 * DndProvider: Isolated wrapper that holds all DnD state and handlers.
 * 
 * PERFORMANCE: By receiving the app tree as `children` (a stable React element reference),
 * when `activeDragData` state changes (on drag start/end), React skips re-rendering
 * the children — only the DragOverlay re-renders. This prevents the entire component
 * tree from re-rendering on every drag interaction.
 */
const DndProvider = ({ children, engine }) => {
    const [activeDragData, setActiveDragData] = useState(null);
    const prevOverElRef = useRef(null);

    // PERFORMANCE: Frame-throttled collision detection cache.
    // dnd-kit calls collision detection on every pointermove event. On high-refresh
    // monitors (165Hz), this means 165 collision detection passes per second —
    // each filtering droppables, calling pointerWithin (which reads rects), and
    // prioritizing results. We cache the last result and only recompute once per
    // animation frame by using a dirty flag that rAF resets.
    const collisionCacheRef = useRef({ result: [], dirty: true, rafId: null });

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        })
    );

    // Custom collision detection to prefer specific items over group containers
    const customCollisionDetection = useCallback((args) => {
        const cache = collisionCacheRef.current;

        // Return cached result if we already computed this frame
        if (!cache.dirty) return cache.result;
        cache.dirty = false;

        // Schedule the dirty flag reset for the next frame
        if (!cache.rafId) {
            cache.rafId = requestAnimationFrame(() => {
                cache.dirty = true;
                cache.rafId = null;
            });
        }

        const { active, droppableContainers } = args;
        const activeData = active?.data?.current;
        const activeType = activeData?.type;

        // PERFORMANCE: Filter collision candidates based on what we are dragging.
        // This prevents checking 100+ inventory items when dragging a Hero card/identity.
        const filteredContainers = droppableContainers.filter(container => {
            const data = container.data?.current;
            if (!data) return false;

            if (activeType === 'hero') {
                // Hero can only be dropped on slots, cards, areas, the tavern, or the roster
                return (
                    data.type === 'heroSlot' || 
                    data.targetType === 'card_area' || 
                    data.type === 'card' ||
                    data.type === 'tavern' ||
                    data.type === 'roster' ||
                    data.type === 'hero'
                );
            }

            if (activeType === 'item') {
                // Item can only be dropped on input slots, other items (to swap/reorder), 
                // groups, or the sell zone.
                return (
                    data.type === 'inputSlot' || 
                    data.type === 'toolSlot' || 
                    data.type === 'item' || 
                    data.type === 'inventory_group' ||
                    data.type === 'hero' ||
                    container.id === 'sell-zone'
                );
            }

            if (activeType === 'card') {
                // Main card dragging mostly interacts with the playmat surface
                // PHASE 2: Allow cards (Blueprints/Heroes) to see specialized slots on buildings
                return (
                    data.targetType === 'playmat_area' || 
                    data.type === 'card' ||
                    data.targetType === 'card_area' ||
                    data.type === 'blueprintSlot' ||
                    data.type === 'heroSlot' ||
                    data.type === 'inputSlot'
                );
            }

            return true;
        });

        const collisions = pointerWithin({
            ...args,
            droppableContainers: filteredContainers
        });

        if (collisions.length === 0) {
            cache.result = [];
            return cache.result;
        }

        // PERFORMANCE: Single-pass prioritization to avoid multiple .find() traversals
        let bestItem = null;
        let bestSlot = null;
        let bestCard = null;
        let bestPlaymat = null;

        for (let i = 0; i < collisions.length; i++) {
            const c = collisions[i];
            const data = c.data?.current;
            if (!data) continue;

            if (data.type === 'item') {
                bestItem = c;
                break; // Highest priority, can exit early
            }
            // Priority: Specialized Slots > General Card Body > Playmat Surface
            if (!bestSlot && ['blueprintSlot', 'toolSlot', 'heroSlot', 'inputSlot', 'hero', 'tavern', 'roster'].includes(data.type)) {
                bestSlot = c;
            }
            if (!bestCard && (data.targetType === 'card_area' || data.type === 'card')) {
                bestCard = c;
            }
            if (!bestPlaymat && data.targetType === 'playmat_area') {
                bestPlaymat = c;
            }
        }

        cache.result = [bestItem || bestSlot || bestCard || bestPlaymat || collisions[0]].filter(Boolean);
        return cache.result;
    }, []);

    // Fired immediately when a draggable item is picked up
    const handleDragStart = useCallback((event) => {
        const { active } = event;
        const activeData = active.data.current || { id: active.id };
        setActiveDragData(activeData);

        // --- OPTION C: CSS-DRIVEN HIGHLIGHTING ---
        // Set metadata on body so CSS can highlight valid slots without React state updates
        document.body.setAttribute('data-dragging-type', activeData.type || '');
        if (activeData.id) document.body.setAttribute('data-dragging-id', activeData.id);

        // Handle tags (space-separated for CSS ~= selector)
        if (activeData.tags) {
            const tagStr = Array.isArray(activeData.tags) ? activeData.tags.join(' ') : activeData.tags;
            document.body.setAttribute('data-dragging-tags', tagStr);
        } else if (activeData.type === 'item' && activeData.id) {
            // Lazy-load tags from registry if not in drag data
            const itemDef = getItem(activeData.id);
            if (itemDef?.tags) {
                document.body.setAttribute('data-dragging-tags', itemDef.tags.join(' '));
            }
        }

        engine.EventBus.publish('dnd:drag-start', activeData);
    }, [engine]);

    // Fired when an item is moved over another droppable
    const prevOverIdRef = useRef(null);
    const handleDragOver = useCallback((event) => {
        const { over } = event;
        const newOverId = over?.id ?? null;

        // PERFORMANCE: Only do DOM work when the actual target changes.
        // onDragOver fires on every collision detection pass (every pointer move),
        // but we only need to swap the attribute when crossing a droppable boundary.
        if (newOverId === prevOverIdRef.current) return;
        prevOverIdRef.current = newOverId;

        if (prevOverElRef.current) {
            prevOverElRef.current.removeAttribute('data-drag-over');
            prevOverElRef.current = null;
        }

        if (over) {
            const el = document.querySelector(`[data-droppable-id="${over.id}"]`);
            if (el) {
                el.setAttribute('data-drag-over', 'true');
                prevOverElRef.current = el;

                // --- Tile System: Placement Constraint Feedback ---
                const activeData = activeDragData; // Current drag data cached in state
                if (activeData?.type === 'card' || activeData?.type === 'hero' || activeData?.type === 'item') {
                    // Note: GridCell has data-tile-id and data-cell-coord
                    // This is more intended for the Playmat Surface mathematical drop
                    // but we can also check literal elements if they are droppable.
                    // For now, let's focus on the 'playmat-surface' drop zone calculation.
                }
            }
        }
    }, [activeDragData]);

    // Fired when a draggable item is dropped
    const handleDragEnd = useCallback((event) => {
        // --- CSS Highlight Cleanup ---
        document.body.removeAttribute('data-dragging-type');
        document.body.removeAttribute('data-dragging-id');
        document.body.removeAttribute('data-dragging-tags');

        if (prevOverElRef.current) {
            prevOverElRef.current.removeAttribute('data-drag-over');
            prevOverElRef.current = null;
        }
        prevOverIdRef.current = null;

        engine.EventBus.publish('dnd:drag-end');

        // Delegate all D&D logic to the DndRouter
        resolveDndDrop(event, engine);

        setActiveDragData(null);
    }, [engine]);

    // Configuration for the visual snap-back animation when a drop is cancelled/invalid
    const dropAnimationConfig = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.4',
                },
            },
        }),
    };

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

            <DragOverlay modifiers={[snapCenterToCursor]} dropAnimation={dropAnimationConfig} zIndex={1000}>
                {activeDragData ? (
                    activeDragData.type === 'card' ? (
                        /* Card drag: Icon inside a bordered box (Item Slot sized) */
                        <div className="w-12 h-12 flex items-center justify-center rounded-md border-2 border-gi-primary bg-gi-base/90 pointer-events-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]">
                            <span className="text-2xl">
                                {typeof activeDragData.icon === 'string'
                                    ? activeDragData.icon.replace(/[<>]/g, '')
                                    : (activeDragData.icon || '🃏')}
                            </span>
                        </div>
                    ) : activeDragData.type === 'inventory_group' ? (
                        /* Group drag: Compact header-like box */
                        <div className="px-4 py-2 rounded-lg border-2 border-gi-primary bg-gi-base/90 pointer-events-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)] flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-gi-surface border border-gi-border flex items-center justify-center text-gi-primary">
                                <span className="text-lg">📁</span>
                            </div>
                            <span className="gi-text-16 font-pixel font-bold text-gi-text uppercase tracking-wider">
                                {activeDragData.title || 'Group'}
                            </span>
                        </div>
                    ) : (
                        /* Entity drag: Lone icon centered on cursor */
                        <div className="w-12 h-12 flex items-center justify-center text-4xl pointer-events-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]">
                            {typeof activeDragData.icon === 'string'
                                ? activeDragData.icon.replace(/[<>]/g, '')
                                : (activeDragData.icon || '📦')}
                        </div>
                    )
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

export const ReactRoot = ({ engine }) => {
    const [dropDebug, setDropDebug] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSpawnItemOpen, setIsSpawnItemOpen] = useState(false);
    const [isSlotSelectionOpen, setIsSlotSelectionOpen] = useState(true);
    const [isWorldMapOpen, setIsWorldMapOpen] = useState(false);
    const [isTavernOpen, setIsTavernOpen] = useState(false);
    const [isCardLibraryOpen, setIsCardLibraryOpen] = useState(false);
    const [isCodexOpen, setIsCodexOpen] = useState(false);
    const [isSandboxOpen, setIsSandboxOpen] = useState(false);
    const [packResults, setPackResults] = useState(null);

    const handleSettingsOpen = useCallback(() => setIsSettingsOpen(true), []);
    const handleSettingsClose = useCallback(() => setIsSettingsOpen(false), []);
    const handleWorldMapToggle = useCallback(() => setIsWorldMapOpen(prev => !prev), []);
    const handleCodexToggle = useCallback(() => setIsCodexOpen(prev => !prev), []);
    const handleTavernToggle = useCallback(() => setIsTavernOpen(prev => !prev), []);
    const handleTavernClose = useCallback(() => setIsTavernOpen(false), []);

    const handleSlotSelect = (index) => {
        const isEmpty = !engine.SaveManager.hasSlot(index);

        if (isEmpty) {
            engine.SaveManager.newGame(index);
            setIsSlotSelectionOpen(false);
            engine.EventBus.publish('react:slot_selected', { index, isNewGame: true });
        } else {
            const success = engine.SaveManager.loadSlot(index);
            setIsSlotSelectionOpen(false);
            engine.EventBus.publish('react:slot_selected', { index, isNewGame: !success });
        }
    };

    useEffect(() => {
        if (!engine) return;

        const handleOpenSpawnCard = () => {
            setIsSpawnAreaOpen(true);
        };
        const handleOpenSpawnItem = () => {
            setIsSpawnItemOpen(true);
        };

        const unsubscribeArea = engine.EventBus.subscribe('dev:open-spawn-card', handleOpenSpawnCard);
        const unsubscribeItem = engine.EventBus.subscribe('dev:open-spawn-item', handleOpenSpawnItem);

        // World map toggle from dev tools
        const unsubscribeWorldMap = engine.EventBus.subscribe('ui:toggle-world-map', () => {
            setIsWorldMapOpen(prev => !prev);
        });

        const unsubscribeSandbox = engine.EventBus.subscribe('dev:toggle-sandbox', () => {
            setIsSandboxOpen(prev => !prev);
        });

        const unsubscribeTavern = engine.EventBus.subscribe('ui:toggle_tavern', () => {
            setIsTavernOpen(prev => !prev);
        });
        
        const unsubscribeCodex = engine.EventBus.subscribe('ui:toggle_codex', () => {
            setIsCodexOpen(prev => !prev);
        });

        return () => {
            unsubscribeArea();
            unsubscribeItem();
            unsubscribeWorldMap();
            unsubscribeSandbox();
            unsubscribeTavern();
            unsubscribeCodex();
        };
    }, [engine]);

    // Handle opening a pack — called from DeckCardView via CardView
    const handleOpenPack = useCallback((areaSetId) => {
        if (!engine.PackSystem) return;
        const result = engine.PackSystem.openPack(areaSetId);
        if (result.success) {
            setPackResults(result.cards);
        } else {
            console.warn('[ReactRoot] Pack open failed:', result.error);
        }
    }, [engine]);

    return (
        <EngineProvider engine={engine}>
            <DndProvider engine={engine}>
                <div className="react-overlay absolute inset-0 z-50 pointer-events-none flex flex-col">
                    <div className="pointer-events-auto w-full">
                        <TopBarView
                            onSettingsClick={handleSettingsOpen}
                            onWorldMapClick={handleWorldMapToggle}
                            onCardLibraryClick={useCallback(() => setIsCardLibraryOpen(true), [])}
                            onCodexClick={handleCodexToggle}
                        />
                    </div>

                    <div className="flex-1 relative flex overflow-hidden">
                        <div className="pointer-events-auto h-full z-[90]">
                            <HeroView 
                                isTavernOpen={isTavernOpen} 
                                onTavernToggle={handleTavernToggle} 
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto pointer-events-auto relative">
                            <CardView
                                onOpenPack={handleOpenPack}
                                onOpenWorldMap={useCallback(() => setIsWorldMapOpen(true), [])}
                            />
                            {/* Invasion Status Tracker (Bottom Left of Playmat) */}
                            <InvasionHUD />
                        </div>

                        <div className="pointer-events-auto h-full z-[90]">
                            <InvView />
                        </div>

                        {/* Tavern Drawer (positioned absolute relative to this container) */}
                        <TavernDrawer
                            isOpen={isTavernOpen}
                            onClose={handleTavernClose}
                        />
                    </div>
                </div>

                {/* Developer QA Tool */}
                <TestDashboard />
                <FPSCounter />

                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={handleSettingsClose}
                />


                <SpawnItemModal
                    isOpen={isSpawnItemOpen}
                    onClose={() => setIsSpawnItemOpen(false)}
                />

                <SlotSelectionModal
                    isOpen={isSlotSelectionOpen}
                    onSelect={handleSlotSelect}
                />

                {/* World Map Drawer */}
                <WorldMapDrawer
                    isOpen={isWorldMapOpen}
                    onClose={() => setIsWorldMapOpen(false)}
                />

                {/* Moved TavernDrawer inside the flex container below */}

                {/* Pack Opening Overlay */}
                {packResults && (
                    <PackOpeningOverlay
                        results={packResults}
                        onClose={() => setPackResults(null)}
                    />
                )}

                {/* Card Library Modal */}
                <CardLibraryModal
                    isOpen={isCardLibraryOpen}
                    onClose={() => setIsCardLibraryOpen(false)}
                />

                {/* Collection Codex Modal */}
                <CollectionModal
                    isOpen={isCodexOpen}
                    onClose={() => setIsCodexOpen(false)}
                />

                {/* Layout Sandbox */}
                {isSandboxOpen && (
                    <div className="pointer-events-auto absolute inset-0 z-[1000] bg-gi-background">
                        <LayoutSandbox />
                        <button
                            onClick={() => setIsSandboxOpen(false)}
                            className="absolute top-4 right-4 p-2 bg-gi-danger/20 text-gi-danger rounded hover:bg-gi-danger hover:text-white pointer-events-auto z-50 transition-colors shadow-lg"
                        >
                            Close Sandbox
                        </button>
                    </div>
                )}
            </DndProvider>

            {/* Debug Drop Math Overlay */}
            {dropDebug && (
                <div className="absolute top-[60px] left-1/2 -translate-x-1/2 bg-black/80 text-white font-mono text-xs px-3 py-1.5 rounded-full border border-white/20 z-[9999] backdrop-blur-sm pointer-events-none">
                    {dropDebug}
                </div>
            )}
            {/* Global Notifications */}
            <ToastContainer />

        </EngineProvider>
    );
};

export default ReactRoot;
