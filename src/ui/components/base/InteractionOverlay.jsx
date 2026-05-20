import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { cn } from '../../utils/cn.js';
import { 
    getTileType, 
    GRID_PITCH, 
    PLAYMAT_PADDING 
} from '../../../config/registries/index.js';
import { getLogicalPosition, screenToGrid } from '../../../utils/CoordinateUtils.js';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';
import GUTooltip from './GUTooltip.jsx';

/**
 * InteractionOverlay - Handles performance-critical hover feedback.
 * Uses event delegation and Ref-based positioning to avoid React re-renders.
 */
const InteractionOverlay = ({ extents, gridConfig }) => {
    const [hoverData, setHoverData] = useState(null);
    const [mousePos, setMousePos] = useState(null);
    const highlighterRef = useRef(null);

    const onMove = useCallback((e) => {
        const isDragging = document.body.hasAttribute('data-dragging-type');

        // 1. Instant Cursor Follow
        setMousePos({ x: e.clientX, y: e.clientY });

        // 2. Pure Coordinate Resolution (Scale-Aware)
        const gridPos = screenToGrid(e.clientX, e.clientY, e.currentTarget, extents);
        if (!gridPos) return;

        const { x: trueGridX, y: trueGridY } = gridPos;

        // Perform Grid Calculation
        const isValid = gridConfig.validCells?.some(c => c.x === trueGridX && c.y === trueGridY);

        if (!isValid) {
            if (hoverData) setHoverData(null);
            return;
        }

        const tileId = gridConfig.tileMap?.[`${trueGridX},${trueGridY}`] || 'plains';

        // 3. ZERO-LATENCY Highlighting Override
        // If we are dragging, we update the highlighter position DIRECTLY via the Ref
        // bypassing the setHoverData (and thus the full React re-render).
        if (isDragging && highlighterRef.current) {
            const { px, py } = getLogicalPosition(trueGridX, trueGridY, extents.minX, extents.minY);
            highlighterRef.current.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
            highlighterRef.current.style.opacity = '1';
        }

        if (!isDragging && (hoverData?.x !== trueGridX || hoverData?.y !== trueGridY)) {
            const tile = getTileType(tileId);
            setHoverData({ x: trueGridX, y: trueGridY, tileId, tile });
        }
    }, [hoverData, extents, gridConfig]);

    const onLeave = useCallback(() => {
        setHoverData(null);
    }, []);

    // Effect to attach listener to the parent playmat surface
    useEffect(() => {
        const root = document.getElementById('playmat-drop-zone');
        if (!root) return;

        root.addEventListener('pointermove', onMove);
        root.addEventListener('pointerleave', onLeave);
        return () => {
            root.removeEventListener('pointermove', onMove);
            root.removeEventListener('pointerleave', onLeave);
        };
    }, [onMove, onLeave]);

    if (!hoverData) return null;

    const { px, py } = getLogicalPosition(hoverData.x, hoverData.y, extents.minX, extents.minY);
    const isSpecial = hoverData.tile?.bonuses?.length > 0;

    return (
        <div className="absolute inset-0 z-20 pointer-events-none">
            {/* 1. Floating Highlighter (Relative to Grid) */}
            <div
                ref={highlighterRef}
                className="absolute z-20 pointer-events-none"
                style={{
                    left: 0,
                    top: 0,
                    transform: `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`,
                    willChange: 'transform'
                }}
            >
                <div className={cn(
                    "w-16 h-16 border-2 rounded-full flex items-center justify-center transition-colors duration-200",
                    isSpecial ? "border-gi-primary/40 shadow-[0_0_15px_rgba(var(--gi-primary-rgb),0.2)]" : "border-white/10"
                )}>
                    <Plus 
                        size={24} 
                        className={isSpecial ? "text-gi-primary/40" : "text-white/10"} 
                    />
                </div>
            </div>

            {/* 2. Tooltip Overlay (Unified) */}
            {isSpecial && SettingsManager.get('ui.tooltipsEnabled') && SettingsManager.get('ui.tooltipsBoostTiles') && (
                <GUTooltip 
                    title={`${hoverData.tile.bonuses?.[0]?.category || hoverData.tile.name} Tile`}
                    mousePos={mousePos}
                    color="text-gi-success"
                >
                    {hoverData.tile.bonuses?.length > 0 && (
                        <div className="flex flex-col gap-1">
                            {hoverData.tile.bonuses.map((b, i) => (
                                <div key={i} className="text-gi-success font-bold text-[10px] uppercase tracking-wider">
                                    -{Math.round(b.value * 100)}% time to adjacent {b.category} tasks
                                </div>
                            ))}
                        </div>
                    )}
                </GUTooltip>
            )}
        </div>
    );
};

export default React.memo(InteractionOverlay);
