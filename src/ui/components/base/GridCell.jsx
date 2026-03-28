import React, { useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { Plus } from 'lucide-react';
import { getTileType } from '../../../config/registries/index.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';

/**
 * GridCell — Layer 2: The Assembled Tiles.
 * Renders individual tile art and provides a target for drag-and-drop interactions.
 */
const GridCell = ({ x, y, width, height, tileId }) => {
    // Resolve the tile art
    const artStyle = useMemo(() => {
        const typeId = tileId || 'plains';
        const tile = getTileType(typeId);
        
        let path = null;
        if (tile && tile.sprite) {
            path = resolveSpritePath(tile.sprite);
        }

        if (!path) return {};

        return {
            backgroundImage: `url("${path}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
        };
    }, [tileId]);

    return (
        <div
            className={cn(
                "relative transition-all duration-300",
                "flex items-center justify-center group/cell"
            )}
            style={{
                width: width,
                height: height,
                zIndex: 10
            }}
            data-tile-id={tileId}
            data-cell-coord={`${x},${y}`}
        >
            {/* Tile Art Layer (z-0, pointer-events-none so it doesn't block dropping) */}
            <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundColor: '#1a1a1a', // Fallback color
                    ...artStyle,
                    imageRendering: 'pixelated'
                }}
            />

            {/* Coordinate Badge (z-10) */}
            <div className="absolute top-2 left-2 z-10 pointer-events-none">
                <div className="bg-black/40 backdrop-blur-sm border border-white/10 px-1.5 py-0.5 rounded shadow-sm">
                    <span className="text-[10px] text-white/60 font-mono font-bold select-none leading-none">
                        {x},{y}
                    </span>
                </div>
            </div>

            {/* Simple centered prompt (z-10) */}
            <div className={cn(
                "relative z-10 w-16 h-16 border-2 border-dashed rounded-full flex items-center justify-center transition-all duration-500",
                "border-white/10 group-hover/cell:border-white/30 group-hover/cell:scale-105 pointer-events-none"
            )}>
                <Plus
                    size={24}
                    className={cn(
                        "transition-colors",
                        "text-white/10 group-hover/cell:text-white/30"
                    )}
                />
            </div>
        </div>
    );
};

export default React.memo(GridCell);
