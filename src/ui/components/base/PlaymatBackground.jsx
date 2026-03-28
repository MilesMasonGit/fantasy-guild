import React, { useMemo } from 'react';
import { cn } from '../../utils/cn.js';
import { resolveSpritePath } from '../../../utils/AssetManager.js';

/**
 * PlaymatBackground — Layer 3: The deep repeating background.
 * Provides the foundational visual surface beneath the assembled tile layer.
 */
const PlaymatBackground = React.memo(({
    assetId,
    opacity = 1
}) => {
    const backgroundStyle = useMemo(() => {
        const base = {
            position: 'absolute',
            pointerEvents: 'none',
            zIndex: 0, // Deepest layer
            opacity: opacity,
            imageRendering: 'pixelated',
            width: '100%',
            height: '100%',
            left: 0,
            top: 0
        };

        const backgroundPath = assetId ? resolveSpritePath(assetId) : null;
        if (!backgroundPath) return { ...base, display: 'none' };

        return {
            ...base,
            backgroundImage: `url("${backgroundPath}")`,
            backgroundRepeat: 'repeat',
            backgroundPosition: '0 0',
            backgroundSize: '1024px 1024px'
        };
    }, [assetId, opacity]);

    return (
        <div
            id="playmat-background-layer3"
            className={cn(
                "playmat-background-layer transition-opacity duration-1000",
                "bg-[#0a0a0a]" // Deep dark fallback to hide rendering gaps
            )}
            style={backgroundStyle}
        />
    );
});

PlaymatBackground.displayName = 'PlaymatBackground';

export default PlaymatBackground;
