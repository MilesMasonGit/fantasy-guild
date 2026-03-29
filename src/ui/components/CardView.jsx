import React, { useMemo } from 'react';
import isEqual from 'fast-deep-equal/es6';
import { useRenderTrace } from '../hooks/useRenderTrace.js';
import { useGameState } from '../hooks/useGameState.js';
import { useEngine } from '../hooks/useEngine.js';
import { AnimatePresence, motion } from 'framer-motion';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import GridCell from './base/GridCell.jsx';
import PlaymatViewport from './base/PlaymatViewport.jsx';
import GICard from './base/GICard.jsx';
import CardSlot from './base/CardSlot.jsx';
import { getCard, getSkill, getBiome, getAreaSet, getTileType } from '../../config/registries/index.js';
import { renderTraitModule } from './card-modules/ModuleRegistry.jsx';
import { resolveSpritePath } from '../../utils/AssetManager.js';
import DeckCardView from './DeckCardView.jsx';
import AreaDeckHub from './AreaDeckHub.jsx';
import SlotHUDLayer from './SlotHUDLayer.jsx';
import {
    CARD_WIDTH,
    CARD_HEIGHT,
    PLAYMAT_GAP_X,
    PLAYMAT_GAP_Y,
    PLAYMAT_PADDING
} from '../../config/registries/index.js';
import { getLogicalPosition } from '../../utils/CoordinateUtils.js';
import { isDeckType } from '../../systems/cards/DeckSystem.js';
import { Button } from '@headlessui/react';
import { Info, Coins, Swords } from 'lucide-react';
import { cn } from '../utils/cn.js';

/**
 * ActiveCard: Renders a single active card and acts as a large drop target.
 * Accepts optional handleProps from SortableCard to enable header-only dragging.
 */
const ActiveCard = React.memo(({ cardId, onOpenPack, handleProps }) => {
    useRenderTrace(`ActiveCard-${cardId}`, { cardId, onOpenPack });
    const { GameState } = useEngine();
    const [isHovered, setIsHovered] = React.useState(false);
    const [infoTab, setInfoTab] = React.useState(null);

    // Optimized: Use bypassClone to get the raw reference since we rely on _rev for updates.
    // This is the "Trust Pattern" — we trust this component not to mutate the engine's card object.
    const cardState = useGameState(
        state => state.getCardById(cardId),
        ['cards_updated', 'cards_progress_updated'],
        (eventData) => !eventData?.cardId || eventData.cardId === cardId
    );

    const template = cardState ? getCard(cardState.templateId) : null;

    const {
        attributes,
        listeners,
        setNodeRef: setDraggableRef,
        transform,
        isDragging
    } = useDraggable({
        id: cardId, // Always use the passed cardId as the stable hook ID
        disabled: !cardState || !template,
        data: {
            type: 'card',
            cardType: template?.cardType,
            id: cardId,
            icon: cardState?.icon || '🃏'
        }
    });

    const { setNodeRef: setDroppableRef } = useDroppable({
        id: `area-${cardId}`,
        disabled: !cardState || !template,
        data: {
            targetType: 'card_area',
            cardId: cardId
        }
    });

    if (!cardState || !template) return null;

    // Merge refs
    const setNodeRef = (el) => {
        setDraggableRef(el);
        setDroppableRef(el);
    };

    const dragStyle = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 1000 : 200,
        opacity: isDragging ? 0.5 : 1
    } : {};

    // Filter traits into external (rendered above card) and internal (rendered inside card)
    const externalTraitTypes = ['heroslot', 'blueprintslot', 'inputslot', 'toolslot'];
    const externalTraits = (cardState.traits || []).filter(t => externalTraitTypes.includes(t.type));
    const internalTraits = (cardState.traits || []).filter(t => !externalTraitTypes.includes(t.type));

    // PERFORMANCE: isOver removed from interactionActive. Drag-over highlighting
    // is now handled by CSS [data-drag-over] attribute set via DOM manipulation
    // in DndProvider, avoiding React re-renders on every droppable boundary crossing.
    const interactionActive = isHovered;

    /**
     * Visibility rules:
     * - Always: header, heroslot, inputslot
     * - Hover/Drag-Over: description, loot, skillrequirement
     * - Assigned: workcycle, combat
     * - Info: if infoTab is set, only show matching module
     */
    const getIsVisible = (trait) => {
        const type = trait.type?.toLowerCase();

        // Always visible types
        if (['header', 'heroslot', 'blueprintslot', 'inputslot'].includes(type)) return true;

        if (type === 'description') return false; // Handled by Drawer

        // If in an Info Tab, only show the module that matches the tab
        if (infoTab) {
            if (infoTab === 'loot' && type === 'loot') return true;
            if (infoTab === 'combat' && type === 'combat') return true;
            return false;
        }

        // --- NO TAB SELECTED STATE ---

        // Tab-driven modules (loot) are hidden if no tab is active
        if (['loot'].includes(type)) return false;

        // Hover/Drag rules (Only for requirements/meta that should hint on hover)
        if (['skillrequirement'].includes(type)) {
            return false; // Handled by Ribbons/Drawer
        }

        // Project rules: Panel is always visible for projects to show requirements
        if (type === 'projectpanel') {
            return true;
        }

        // Assigned rules for other modules (like workcycle)
        // Combat: Always visible on combat cards, or when someone is assigned
        if (type === 'combat') {
            return template.cardType === 'combat' || template.cardType === 'dungeon' || !!cardState.assignedHeroId;
        }

        // Projects show the theater even without a hero to display the large icon
        if (['workcycle'].includes(type)) {
            return !!cardState.assignedHeroId || template.cardType === 'project';
        }

        return true; // Default for other things
    };

    const INTERNAL_MODULE_ORDER = ['header', 'heroslot', 'blueprintslot', 'inputslot', 'skillrequirement', 'workcycle', 'projectpanel', 'loot', 'combat'];
    const getModuleSortOrder = (type) => {
        const idx = INTERNAL_MODULE_ORDER.indexOf(type?.toLowerCase());
        return idx === -1 ? 99 : idx;
    };

    // Separate traits for specialized UI ribbons/drawers
    const descriptionTrait = internalTraits.find(t => t.type?.toLowerCase() === 'description');
    const skillReqTrait = internalTraits.find(t => t.type?.toLowerCase() === 'skillrequirement');

    // XP formatting (from CardManager task state)
    const xpReward = cardState.xpAwarded || 0;
    const skillDef = skillReqTrait ? getSkill(skillReqTrait.skill) : null;
    const skillName = skillDef ? skillDef.name : (skillReqTrait ? (skillReqTrait.skill.charAt(0).toUpperCase() + skillReqTrait.skill.slice(1)) : null);
    const skillInfo = skillReqTrait ? `${skillReqTrait.level} ${skillName}` : null;
    const infoRibbonText = [skillInfo, xpReward > 0 ? `${xpReward}XP` : null].filter(Boolean).join(' / ');

    const visibleInternalTraits = internalTraits
        .filter(t => t.type?.toLowerCase() !== 'description')
        .filter(getIsVisible)
        .sort((a, b) => getModuleSortOrder(a.type) - getModuleSortOrder(b.type));

    // Background logic: Task background -> Area (Biome) background -> AreaSet art -> null
    const backgroundId = template.background || getBiome(cardState.areaId)?.backgroundImage || getAreaSet(template.areaSet || cardState.areaId)?.areaArt;
    const backgroundPath = backgroundId ? resolveSpritePath(backgroundId) : null;

    return (
        <div
            ref={setNodeRef}
            data-droppable-id={`area-${cardState.id}`}
            className="flex flex-col items-center w-[280px] relative transform-gpu"
            style={dragStyle}
            onMouseEnter={() => { if (!document.body.hasAttribute('data-dragging-type')) setIsHovered(true); }}
            onMouseLeave={() => { if (!document.body.hasAttribute('data-dragging-type')) setIsHovered(false); }}
        >

            <GICard
                className="w-full relative overflow-hidden"
                imageSrc={backgroundPath}
                active={interactionActive}
                intent={template.cardType?.toLowerCase() || template.type?.toLowerCase()}
                isUnique={template.isUnique}
                style={{
                    order: 10,
                    zIndex: 200
                }}
            >
                {/* Main Content Area - Expandable to push footer down. Acts as the drag handle. */}
                <div
                    className={cn(
                        "p-4 flex flex-col flex-1 z-10 relative",
                        "cursor-grab active:cursor-grabbing"
                    )}
                    {...attributes}
                    {...listeners}
                >
                    {visibleInternalTraits.length > 0 ? (
                        <div className="flex flex-col gap-2 w-full h-full">
                            {visibleInternalTraits.map((trait, index) => renderTraitModule(trait, cardState, `${trait.id || trait.type}-${index}`, index === 0))}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 w-full h-full opacity-50 italic text-sm">
                            {/* Empty state if nothing is visible */}
                        </div>
                    )}
                </div>

                {/* Description Drawer - Slid-up from footer (Flex Flow) */}
                <AnimatePresence>
                    {descriptionTrait && (interactionActive || infoTab === 'info') && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="overflow-hidden px-2 z-40 -mb-2" // Negative margin to tuck module bottom padding behind footer
                        >
                            {renderTraitModule(descriptionTrait, cardState, `desc-999`, false)}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Task Info Ribbon - XP/Skill summary always visible above footer */}
                {infoRibbonText && (
                    <div
                        className="absolute bottom-[56px] left-0 w-full bg-black/20 py-1 text-[16px] text-white font-bold uppercase tracking-tighter text-center z-40"
                        style={{ textShadow: 'var(--text-shadow-base)' }}
                    >
                        {infoRibbonText}
                    </div>
                )}

                {/* Footer Action Buttons - Stationery Footer absolutely positioned in safe-area */}
                <div className="absolute bottom-0 left-0 w-full flex justify-evenly gap-2 px-2 py-3 z-50 bg-black/20">
                    <Button
                        onClick={() => setInfoTab(infoTab === 'info' ? null : 'info')}
                        className={cn(
                            "group h-8 px-3 rounded-full border border-white/10 flex items-center justify-center transition-all duration-300 bg-black/40 text-gray-400 hover:bg-black/60 hover:w-auto min-w-[32px]",
                            infoTab === 'info' && "bg-gi-primary text-white"
                        )}
                        title="Card Info"
                    >
                        <div className="relative flex items-center justify-center">
                            <div className="flex items-center transition-all duration-300 group-hover:opacity-0 group-hover:scale-0">
                                <Info size={14} />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-50 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100 whitespace-nowrap text-pixel-base font-bold uppercase tracking-wider">
                                Info
                            </div>
                        </div>
                    </Button>

                    {internalTraits.some(t => t.type === 'loot') && (
                        <Button
                            onClick={() => setInfoTab(infoTab === 'loot' ? null : 'loot')}
                            className={cn(
                                "group h-8 px-3 rounded-full border border-white/10 flex items-center justify-center transition-all duration-300 bg-black/40 text-gray-400 hover:bg-black/60 hover:w-auto min-w-[32px]",
                                infoTab === 'loot' && "bg-gi-primary text-white"
                            )}
                            title="Loot Preview"
                        >
                            <div className="relative flex items-center justify-center">
                                <div className="flex items-center transition-all duration-300 group-hover:opacity-0 group-hover:scale-0">
                                    <Coins size={14} />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-50 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100 whitespace-nowrap text-pixel-base font-bold uppercase tracking-wider">
                                    Loot
                                </div>
                            </div>
                        </Button>
                    )}

                    {internalTraits.some(t => t.type === 'combat') && (
                        <Button
                            onClick={() => setInfoTab(infoTab === 'combat' ? null : 'combat')}
                            className={cn(
                                "group h-8 px-3 rounded-full border border-white/10 flex items-center justify-center transition-all duration-300 bg-black/40 text-gray-400 hover:bg-black/60 hover:w-auto min-w-[32px]",
                                infoTab === 'combat' && "bg-gi-primary text-white"
                            )}
                            title="Combat Details"
                        >
                            <div className="relative flex items-center justify-center">
                                <div className="flex items-center transition-all duration-300 group-hover:opacity-0 group-hover:scale-0">
                                    <Swords size={14} />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-50 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100 whitespace-nowrap text-pixel-base font-bold uppercase tracking-wider">
                                    Combat
                                </div>
                            </div>
                        </Button>
                    )}
                </div>
            </GICard>
        </div>
    );
});
ActiveCard.displayName = 'ActiveCard';

/**
 * CardView: The main interactive component for the center of the screen.
 * Automatically maps over `state.cards.active` and renders them with entrance/exit physics.
 * Integrates SortableContext for card reordering via drag-and-drop.
 */
export const CardView = React.memo(({ onOpenPack, onOpenWorldMap }) => {
    const { GameState } = useEngine();
    const [tooltipData, setTooltipData] = React.useState(null);
    const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });

    // Event delegation for tile tooltips
    const handleBoardPointerMove = React.useCallback((e) => {
        // Track mouse position for the tooltip to follow
        setMousePos({ x: e.clientX, y: e.clientY });

        // Suppress tooltips during drag operations
        if (document.body.hasAttribute('data-dragging-type')) {
            if (tooltipData) setTooltipData(null);
            return;
        }

        const cellEl = e.target.closest('[data-cell-coord]');
        if (!cellEl) {
            if (tooltipData) setTooltipData(null);
            return;
        }

        const tileId = cellEl.dataset.tileId || 'plains';

        // Suppress tooltips for basic 'plains' tiles - only show for special terrain
        if (tileId === 'plains') {
            if (tooltipData) setTooltipData(null);
            return;
        }

        const [x, y] = cellEl.dataset.cellCoord.split(',').map(Number);

        // Only update if target changed to save re-renders
        if (tooltipData?.tileId === tileId && tooltipData?.x === x && tooltipData?.y === y) return;

        const tile = getTileType(tileId);

        setTooltipData({
            tile,
            tileId,
            x,
            y
        });
    }, [tooltipData]);

    const handleBoardPointerLeave = React.useCallback(() => {
        setTooltipData(null);
    }, []);

    // Fast projection: fetch only stable IDs to prevent heavy O(N) deep-cloning
    const activeCardsPrimitives = useGameState(state => {
        const active = state.cards?.active || [];
        return active.filter(c => !c.isHidden).map(c => ({
            id: c.id,
            cardType: c.cardType,
            icon: c.icon,
            name: c.name,
            x: c.position?.x ?? null,
            y: c.position?.y ?? null
        }));
    }, ['cards_updated', 'heroes_updated'], (eventData) => {
        // Only trigger re-render if cards were explicitly updated, 
        // a hero was reordered (which affects lists), or an area was switched.
        return !eventData?.source ||
            ['cards_updated', 'reorderHero', 'area_switched', 'updateCardPosition'].includes(eventData.source);
    });

    const { activeAreaId, gridConfig } = useGameState(state => ({
        activeAreaId: state.ui?.activeAreaId || 'guild_hall_v1',
        gridConfig: state.grid || {
            width: 8, height: 8, max_width: 12, max_height: 12, center: { x: 3, y: 3 }, validCells: []
        }
    }), ['area_switched', 'cells_unlocked', 'state_changed']);

    const activeArea = getAreaSet(activeAreaId);
    const backgroundId = activeArea?.backgroundImage || 'bg_desert';
    const backgroundMode = activeArea?.backgroundMode || 'centered';

    const positionedCards = useMemo(() => {
        return activeCardsPrimitives.filter(c => c.x !== null && c.y !== null);
    }, [activeCardsPrimitives]);

    // 1. Calculate Grid Extents for Dynamic Sizing & Offsetting
    const extents = useMemo(() => {
        if (!gridConfig.validCells?.length) {
            return { minX: 0, maxX: gridConfig.max_width, minY: 0, maxY: gridConfig.max_height };
        }

        const xs = gridConfig.validCells.map(c => c.x);
        const ys = gridConfig.validCells.map(c => c.y);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys)
        };
    }, [gridConfig.validCells]);

    // Root coordinate container for Point-Map (Relative to Viewport)
    // Wrap the bounding box tightly around the extents, eliminating dead space.
    const playmatPixelWidth = ((extents.maxX - extents.minX) * CARD_WIDTH) + (PLAYMAT_PADDING * 2);
    const playmatPixelHeight = ((extents.maxY - extents.minY) * CARD_HEIGHT) + (PLAYMAT_PADDING * 2);

    // Note: Due to CARD_WIDTH vs GRID_PITCH discrepancies in older layout constants, 
    // we use CARD_WIDTH/HEIGHT above to be safe, but getLogicalPosition uses GRID_PITCH.
    // Assuming they are equal (512x512) for the new system.

    const containerStyle = {
        position: 'relative',
        width: playmatPixelWidth,
        height: playmatPixelHeight,
        zIndex: 1 // Layer 1 & 2 surface above Layer 3 fixed viewport background
    };

    // Unified drop zone for the entire playmat surface
    const { setNodeRef: setPlaymatRef } = useDroppable({
        id: 'playmat-surface',
        data: { targetType: 'playmat_area' }
    });

    return (
        <>
            <PlaymatViewport gridConfig={gridConfig} activeAreaId={activeAreaId}>
                <div
                    ref={setPlaymatRef}
                    className="playmat-surface-root"
                    style={containerStyle}
                    id="playmat-drop-zone"
                    onPointerMove={handleBoardPointerMove}
                    onPointerLeave={handleBoardPointerLeave}
                >
                    {/* 1. Tiles Layer (z-10) */}
                    {gridConfig.validCells.map(cell => {
                        const { px, py } = getLogicalPosition(cell.x, cell.y, extents.minX, extents.minY);
                        const tileId = gridConfig.tileMap?.[`${cell.x},${cell.y}`] || 'plains';
                        return (
                            <div
                                key={`cell-wrapper-${cell.x}-${cell.y}`}
                                className="absolute z-10"
                                style={{
                                    left: 0,
                                    top: 0,
                                    transform: `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`
                                }}
                            >
                                <GridCell
                                    x={cell.x}
                                    y={cell.y}
                                    width={512}
                                    height={512}
                                    tileId={tileId}
                                />
                            </div>
                        );
                    })}

                    {/* 2. Entities Layer (z-50) */}
                    <AnimatePresence mode="popLayout" initial={false}>
                        {positionedCards.map((cardInfo) => {
                            const { px, py } = getLogicalPosition(cardInfo.x, cardInfo.y, extents.minX, extents.minY);
                            return (
                                <div
                                    key={`${activeAreaId}-${cardInfo.id}`}
                                    className="absolute z-50 transition-transform duration-300"
                                    style={{ left: px, top: py, transform: 'translate(-50%, -50%)' }}
                                >
                                    <motion.div
                                        className="pointer-events-auto"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                    >
                                        {isDeckType(cardInfo.cardType) ? (
                                            <DeckCardView
                                                cardId={cardInfo.id}
                                                onOpenPack={onOpenPack}
                                            />
                                        ) : (
                                            <ActiveCard
                                                cardId={cardInfo.id}
                                                onOpenPack={onOpenPack}
                                            />
                                        )}
                                    </motion.div>
                                </div>
                            );
                        })}
                    </AnimatePresence>

                    {/* 3. Area Hub Layer (z-100) */}
                    {(() => {
                        const hubPos = gridConfig.hubPosition || gridConfig.center || { x: 0, y: 0 };
                        const { px, py } = getLogicalPosition(hubPos.x, hubPos.y, extents.minX, extents.minY);
                        return (
                            <div
                                className="absolute z-[100]"
                                style={{ left: px, top: py, transform: 'translate(-50%, -50%)' }}
                            >
                                <AreaDeckHub onOpenWorldMap={onOpenWorldMap} />
                            </div>
                        );
                    })()}

                    {/* 4. Slot HUD Layer (z-300) */}
                    <SlotHUDLayer
                        cards={positionedCards}
                        minX={extents.minX}
                        minY={extents.minY}
                    />
                </div>


            </PlaymatViewport>

            {/* Tile Tooltip Overlay - Moved outside viewport to escape transforms and zoom scaling */}
            {tooltipData && (
                <div
                    className="fixed z-[9999] pointer-events-none"
                    style={{ left: mousePos.x + 20, top: mousePos.y + 20 }}
                >
                    <div className="bg-gi-base/95 border-2 border-white/10 p-3 rounded-lg shadow-2xl backdrop-blur-md min-w-[200px]">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{tooltipData.tile.icon}</span>
                            <span className="gi-text-16 font-pixel font-bold uppercase text-white">{tooltipData.tile.name}</span>
                        </div>
                        <p className="text-gi-text-dim text-xs mb-2 leading-relaxed">
                            {tooltipData.tile.description}
                        </p>

                        {tooltipData.tile.bonuses?.length > 0 && (
                            <div className="border-t border-white/5 pt-2 flex flex-col gap-1">
                                {tooltipData.tile.bonuses.map((b, i) => (
                                    <div key={i} className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                                        <span className="text-gi-primary">+{b.value * 100}% {b.category} Speed</span>
                                        <span className="text-white/40">{b.range}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
});
CardView.displayName = 'CardView';

export default CardView;
