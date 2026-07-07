import React, { useMemo } from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { cn } from '../../utils/cn.js';
import { useDndTarget } from '../../hooks/useDndTarget.js';
import { Plus } from 'lucide-react';
import { getTileType, CARD_WIDTH, CARD_HEIGHT } from '../../../config/registries/index.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';
import { USE_DECK_LOOP } from '../../../config/featureFlags.js';

/**
 * GridCell — Layer 2: The Assembled Tiles.
 * Renders individual tile art and provides a target for drag-and-drop interactions.
 * Gated under the deck loop rework (Phase 1). USE_DECK_LOOP is a module
 * constant, so the early return never changes hook order between renders.
 */
const GridCell = ({ x, y, width, height, tileId, isGutter, baseTileTemplate, baseTileVariants = 5 }) => {
    if (USE_DECK_LOOP) return null;

    // Resolve the tile art
    const artStyle = useMemo(() => {
        const typeId = tileId || 'plains';
        const tile = getTileType(typeId);

        let path = null;

        // If it's a boost tile (or lacks a sprite), override its base sprite with an Area-specific board tile
        if (tile && (tile.propSprite || tile.id.endsWith('_boost') || !tile.sprite) && baseTileTemplate) {
             const variant = ((x * 17 + y * 31) % baseTileVariants) + 1; // Pseudo-random 1-N
             const spriteId = `pm_board_${baseTileTemplate}_${variant}`;
             path = resolveSpritePath(spriteId);
        } else if (tile && tile.sprite) {
            path = resolveSpritePath(tile.sprite);
        }

        if (!path) return {};

        return {
            backgroundImage: `url("${path}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
        };
    }, [tileId, x, y, baseTileTemplate, baseTileVariants]);

    const accepts = useMemo(() => ['card', 'blueprint'], []);
    const { isValid: isValidTarget, isDragging: isAnyDragging } = useDndTarget({
        accepts
    });

    // Players cannot drop on gutter tiles
    const isCardDrag = isValidTarget && !isGutter;

    const droppableData = useMemo(() => ({
        type: 'grid-cell',
        x,
        y,
        tileId,
        isGutter
    }), [x, y, tileId, isGutter]);

    const { setNodeRef, isOver } = useDroppable({
        id: `grid-${x}-${y}`,
        disabled: !isCardDrag,
        data: droppableData
    });

    return (
        <div
            ref={setNodeRef}
            data-type="grid-cell"
            data-droppable-id={`grid-${x}-${y}`}
            data-drag-valid={isAnyDragging ? (isValidTarget ? "true" : "false") : undefined}
            data-no-bg-highlight="true"
            data-no-outline="true"
            className={cn(
                "relative transition-all duration-300 dnd-target",
                "flex items-center justify-center group/cell",
                isOver && "z-20 scale-[1.02]"
            )}
            style={{
                width: width,
                height: height,
                zIndex: isOver ? 50 : 10
            }}
            data-tile-id={tileId}
            data-cell-coord={`${x},${y}`}
        >
            {/* Tile Art Layer */}
            <div
                className={cn(
                    "absolute inset-0 pointer-events-none transition-all duration-500",
                    isOver ? "brightness-125 saturate-150" : "brightness-100",
                    isGutter && "saturate-[0.2] brightness-[0.7] opacity-80"
                )}
                style={{
                    ...artStyle,
                    imageRendering: 'pixelated'
                }}
            />

            {/* Card Shadow Highlight - Shows only during Card/Blueprint drag */}
            <div 
                className={cn(
                    "absolute pointer-events-none transition-all duration-300 rounded-xl border-[3px] z-30",
                    (isAnyDragging && isCardDrag) ? "opacity-100" : "opacity-0",
                    isOver 
                        ? "border-gi-success bg-gi-success/20 shadow-[0_0_35px_rgba(72,187,120,0.5)] scale-105" 
                        : "border-white/30 bg-white/5 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                )}
                style={{
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                }}
            />

            {/* Coordinate Badge */}
            <div className="absolute top-2 left-2 z-10 pointer-events-none">
                <div className="bg-black/60 border border-white/5 px-1 py-0.5 rounded">
                    <span className="text-[9px] text-white/40 font-mono font-bold select-none leading-none">
                        {x},{y}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default React.memo(GridCell);
