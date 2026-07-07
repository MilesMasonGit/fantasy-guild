import React from 'react';
import { getLogicalPosition } from '../../../utils/CoordinateUtils.js';
import { getTileType, GRID_PITCH } from '../../../config/registries/index.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';

/**
 * PropsLayer - L3: The Props
 * Placed above the StaticGridLayer. Renders prop sprites on top of L2 tiles.
 */
const PropsLayer = ({ gridConfig, extents }) => {
    if (!gridConfig) return null;

    const propKeys = new Set([
        ...Object.keys(gridConfig.tileMap || {}),
        ...Object.keys(gridConfig.propsMap || {})
    ]);

    return (
        <div className="absolute inset-0 z-[20] pointer-events-none">
            {Array.from(propKeys).map((key) => {
                let tileId = gridConfig.propsMap?.[key];
                if (!tileId) {
                    const fallbackId = gridConfig.tileMap?.[key];
                    if (fallbackId) {
                        const tile = getTileType(fallbackId);
                        if (tile && tile.propSprite) {
                            tileId = fallbackId;
                        }
                    }
                }
                if (!tileId) return null;

                const tile = getTileType(tileId);
                if (!tile || !tile.propSprite) return null;

                const path = resolveSpritePath(tile.propSprite);
                if (!path) return null;

                const [xStr, yStr] = key.split(',');
                const x = parseInt(xStr, 10);
                const y = parseInt(yStr, 10);
                const { px, py } = getLogicalPosition(x, y, extents.minX, extents.minY);

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
