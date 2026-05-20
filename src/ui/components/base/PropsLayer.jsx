import React from 'react';
import { getLogicalPosition } from '../../../utils/CoordinateUtils.js';
import { getTileType, GRID_PITCH } from '../../../config/registries/index.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';

/**
 * PropsLayer - L3: The Props
 * Placed above the StaticGridLayer. Renders prop sprites on top of L2 tiles.
 */
const PropsLayer = ({ gridConfig, extents }) => {
    if (!gridConfig || !gridConfig.validCells) return null;

    return (
        <div className="absolute inset-0 z-[20] pointer-events-none">
            {gridConfig.validCells.map((cell) => {
                const key = `${cell.x},${cell.y}`;
                const tileId = gridConfig.tileMap?.[key];
                if (!tileId) return null;

                const tile = getTileType(tileId);
                // Future expansion: render propSprite if defined
                if (!tile || !tile.propSprite) return null;

                const path = resolveSpritePath(tile.propSprite);
                if (!path) return null;

                const { px, py } = getLogicalPosition(cell.x, cell.y, extents.minX, extents.minY);

                return (
                    <div
                        key={`prop-${key}`}
                        className="absolute"
                        style={{
                            left: px,
                            top: py,
                            width: GRID_PITCH,
                            height: GRID_PITCH,
                            transform: 'translate(-50%, -50%)',
                            backgroundImage: `url("${path}")`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            imageRendering: 'pixelated'
                        }}
                    />
                );
            })}
        </div>
    );
};

export default React.memo(PropsLayer);
