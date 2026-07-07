import React from 'react';
import GridCell from './GridCell.jsx';
import { getLogicalPosition } from '../../../utils/CoordinateUtils.js';
import { USE_DECK_LOOP } from '../../../config/featureFlags.js';

/**
 * StaticGridLayer - Renders the physical tiles of the playmat.
 * Optimized to only re-render when the grid configuration or area changes.
 * Gated under the deck loop rework (Phase 1) — 2D grid geometry has no
 * equivalent in the new mode.
 */
const StaticGridLayer = ({ gridConfig, extents }) => {
    if (USE_DECK_LOOP) return null;
    if (!gridConfig?.validCells?.length) return null;

    return (
        <div className="static-grid-layer absolute inset-0 z-10 pointer-events-none">
            {gridConfig.validCells.map(cell => {
                const { px, py } = getLogicalPosition(cell.x, cell.y, extents.minX, extents.minY);
                const tileId = gridConfig.tileMap?.[`${cell.x},${cell.y}`] || 'plains';
                return (
                    <div
                        key={`cell-wrapper-${cell.x}-${cell.y}`}
                        className="absolute pointer-events-auto"
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
                            isGutter={cell.isGutter}
                            baseTileTemplate={gridConfig.baseTileTemplate}
                            baseTileVariants={gridConfig.baseTileVariants}
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default React.memo(StaticGridLayer, (prev, next) => {
    // Only re-render if the grid dimensions or the actual cell layout changed.
    // This is the core optimization to prevent "mouse shake" re-renders.
    return (
        prev.gridConfig === next.gridConfig &&
        prev.extents.minX === next.extents.minX &&
        prev.extents.minY === next.extents.minY
    );
});
