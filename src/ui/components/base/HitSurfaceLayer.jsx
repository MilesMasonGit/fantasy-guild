import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { GRID_PITCH, PLAYMAT_PADDING } from '../../../config/registries/index.js';
import { getLogicalPosition } from '../../../utils/CoordinateUtils.js';

/**
 * DroppableTile: A minimal, invisible 512x512 hit target for dnd-kit.
 * Separated into a sub-component to ensure dnd-kit hooks are correctly registered per cell.
 */
const DroppableTile = React.memo(({ x, y, minX, minY }) => {
    const { setNodeRef } = useDroppable({
        id: `grid-cell-${x}-${y}`,
        data: {
            targetType: 'playmat_tile',
            x,
            y
        }
    });

    const { px, py } = getLogicalPosition(x, y, minX, minY);

    return (
        <div
            ref={setNodeRef}
            className="absolute"
            style={{
                left: 0,
                top: 0,
                width: GRID_PITCH,
                height: GRID_PITCH,
                transform: `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`,
                backgroundColor: 'rgba(0, 255, 0, 0.05)', // DEBUG: Semi-visible for verification
                pointerEvents: 'auto',
                zIndex: 5 // Above StaticGridLayer (sh-10) but below Cards (z-50)
            }}
        />
    );
});

/**
 * HitSurfaceLayer: Renders the lightweight droppable grid.
 * This is the performant replacement for the monolithic playmat surface.
 */
const HitSurfaceLayer = ({ gridConfig, extents }) => {
    if (!gridConfig.validCells) return null;

    return (
        <div className="hit-surface-layer absolute inset-0 pointer-events-none">
            {gridConfig.validCells.map(cell => (
                <DroppableTile
                    key={`hit-${cell.x}-${cell.y}`}
                    x={cell.x}
                    y={cell.y}
                    minX={extents.minX}
                    minY={extents.minY}
                />
            ))}
        </div>
    );
};

export default React.memo(HitSurfaceLayer);
