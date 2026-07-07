import React, { useMemo } from 'react';
import { useGameState } from '../hooks/useGameState.js';
import { useEngine } from '../hooks/useEngine.js';
import { AnimatePresence, motion } from 'framer-motion';
import PlaymatViewport from './base/PlaymatViewport.jsx';
import TableFXLayer from './base/TableFXLayer.jsx';
import StaticGridLayer from './base/StaticGridLayer.jsx';
import InteractionOverlay from './base/InteractionOverlay.jsx';
import PropsLayer from './base/PropsLayer.jsx';
import EnvironmentLayer from './base/EnvironmentLayer.jsx';
import { ActiveCard } from './ActiveCard.jsx';
import DeckCardView from './DeckCardView.jsx';
import AreaDeckHub from './AreaDeckHub.jsx';
import SlotHUDLayer from './SlotHUDLayer.jsx';
import OffScreenIndicators from './hud/OffScreenIndicators.jsx';
import {
    getAreaSet,
    GRID_PITCH, PLAYMAT_PADDING
} from '../../config/registries/index.js';
import { getLogicalPosition } from '../../utils/CoordinateUtils.js';
import { isDeckType } from '../../systems/cards/DeckSystem.js';
import { cn } from '../utils/cn.js';
import { USE_DECK_LOOP } from '../../config/featureFlags.js';

/**
 * CardView: The main interactive component for the center of the screen.
 * Resolves drops mathematically via DndRouter fallback.
 * Gated under the deck loop rework (Phase 1) — replaced by the Area Banner
 * Row system when USE_DECK_LOOP is on. USE_DECK_LOOP is a module constant,
 * so the early return never changes hook order between renders.
 */
export const CardView = React.memo(({ onOpenWorldMap, leftVisible = true, rightVisible = true, isTavernOpen = false }) => {
    if (USE_DECK_LOOP) return null;

    const { GameState } = useEngine();

    // Optimized state subscription - Only transform active cards when actually updated
    const activeCardsPrimitivesSelector = React.useCallback(state => {
        const active = state.cards?.active || [];
        return active.filter(c => !c.isHidden).map(c => ({
            id: c.id,
            cardType: c.cardType,
            icon: c.icon,
            name: c.name,
            x: c.position?.x ?? null,
            y: c.position?.y ?? null
        }));
    }, []);

    const activeCardsPrimitives = useGameState(
        activeCardsPrimitivesSelector,
        ['cards_updated', 'heroes_updated', 'card_spawned', 'card_discarded', 'area_switched']
    );

    const activeAreaId = useGameState(state => state.ui?.activeAreaId || 'area_guild_hall', ['area_switched']);

    const gridConfig = useGameState(state => state.grid || {
        width: 8, height: 8, max_width: 12, max_height: 12, center: { x: 3, y: 3 }, validCells: []
    }, ['area_switched', 'cells_unlocked', 'cards_updated']);

    const activeArea = getAreaSet(activeAreaId);
    const positionedCards = useMemo(() => {
        return activeCardsPrimitives.filter(c => c.x !== null && c.y !== null);
    }, [activeCardsPrimitives]);

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

    const playmatPixelWidth = ((extents.maxX - extents.minX + 1) * GRID_PITCH) + (PLAYMAT_PADDING * 2);
    const playmatPixelHeight = ((extents.maxY - extents.minY + 1) * GRID_PITCH) + (PLAYMAT_PADDING * 2);

    const containerStyle = {
        position: 'relative',
        width: playmatPixelWidth,
        height: playmatPixelHeight,
        zIndex: 1
    };

    return (
        <>
            <PlaymatViewport
                gridConfig={gridConfig}
                activeAreaId={activeAreaId}
                leftVisible={leftVisible}
                rightVisible={rightVisible}
                isTavernOpen={isTavernOpen}
            >
                <div
                    className="playmat-surface-root pointer-events-auto"
                    style={containerStyle}
                    id="playmat-drop-zone"
                >
                    <TableFXLayer extents={extents} />
                    <StaticGridLayer gridConfig={gridConfig} extents={extents} />
                    <InteractionOverlay gridConfig={gridConfig} extents={extents} />
                    <PropsLayer gridConfig={gridConfig} extents={extents} />

                    {/* Entities Layer */}
                    <AnimatePresence mode="popLayout" initial={false}>
                        {positionedCards.map((cardInfo) => {
                            const { px, py } = getLogicalPosition(cardInfo.x, cardInfo.y, extents.minX, extents.minY);
                            return (
                                <div
                                    key={`${activeAreaId}-${cardInfo.id}`}
                                    className="absolute z-50"
                                    style={{ left: px, top: py, transform: 'translate(-50%, -50%)' }}
                                >
                                    <motion.div
                                        className={cn(
                                            "pointer-events-auto card-interaction-zone dnd-target",
                                            "rounded-xl",
                                            document.body.hasAttribute('data-dragging-type') && "shadow-none"
                                        )}
                                        data-no-bg-highlight="true"
                                        data-droppable-id={cardInfo.id}
                                        data-type="card"
                                        initial={{ 
                                            opacity: 0, 
                                            scale: 0.1, 
                                            filter: 'brightness(3) drop-shadow(0 0 20px white)' 
                                        }}
                                        animate={{ 
                                            opacity: 1, 
                                            scale: 1,
                                            filter: 'brightness(1) drop-shadow(0 0 0px transparent)'
                                        }}
                                        exit={{ 
                                            opacity: 0,
                                            scale: 0.1,
                                            x: -600,
                                            y: [0, -600, -1000],
                                            filter: 'brightness(3) drop-shadow(0 0 20px white)'
                                        }}
                                        transition={{ 
                                            duration: 0.4, // Default for spawn
                                            exit: { duration: 2.5, ease: "easeInOut" } // Specific for flight
                                        }}
                                    >
                                        {isDeckType(cardInfo.cardType) ? (
                                            <DeckCardView
                                                cardId={cardInfo.id}
                                            />
                                        ) : (
                                            <ActiveCard
                                                cardId={cardInfo.id}
                                            />
                                        )}
                                    </motion.div>
                                </div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Hub Layer */}
                    {(() => {
                        const hubPos = gridConfig.hubPosition || gridConfig.center || { x: 0, y: 0 };
                        const hasCoveringEvent = positionedCards.some(c => 
                            c.x === hubPos.x && 
                            c.y === hubPos.y && 
                            (c.cardType === 'event' || c.cardType === 'invasion')
                        );
                        if (hasCoveringEvent) return null;

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

                    {/* Slot HUD Layer */}
                    <SlotHUDLayer
                        cards={positionedCards}
                        minX={extents.minX}
                        minY={extents.minY}
                    />

                    <EnvironmentLayer activeAreaId={activeAreaId} />
                </div>
            </PlaymatViewport>

            {/* Indicators must be outside the viewport to stay fixed to screen edges */}
            <OffScreenIndicators extents={extents} />
        </>
    );
});

CardView.displayName = 'CardView';
export default CardView;
