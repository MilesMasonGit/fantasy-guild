import { memo, useMemo } from 'react';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useMatFit } from './MatFitContext.jsx';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { MAT_Z } from './matLayers.js';
import { pixelRingPath } from './pixelRing.js';

/** The ring: one art pixel of gold over a solid black copy one art pixel down-right (the old flag ring's look). */
const RING_GOLD = 'var(--color-gi-gold)';
const RING_SHADOW = '#000';

/**
 * A camp's reach ring (`Camps.reachRingOf`): shown while the pointer rests on a camp, or while a
 * hero who works from one is hovered (on the mat or their roster tab) or has their sheet open.
 * `ring` is `{ campId, x, y, r }` in mat units, or null for none. Drawn in whole art pixels, over
 * the Tokens and under the loot (`MAT_Z.RINGS`), never in the pointer's way.
 */
export const CampReachRing = memo(function CampReachRing({ ring = null }) {
    const mat = useMatSize();
    const artScale = boardScaleAt(useMatFit());
    const pixels = ring ? Math.max(1, Math.round(ring.r / artScale)) : 0;
    const path = useMemo(() => (pixels ? pixelRingPath(pixels) : ''), [pixels]);
    if (!ring || !path) return null;
    // Snapped to the art-pixel grid, so every cell lands on whole screen pixels.
    const ox = Math.round(ring.x / artScale - 0.5) * artScale;
    const oy = Math.round(ring.y / artScale - 0.5) * artScale;
    return (
        <svg
            data-camp-ring={ring.campId}
            data-r={ring.r}
            data-cx={ring.x}
            data-cy={ring.y}
            className="absolute left-0 top-0 overflow-visible pointer-events-none"
            width={mat.w}
            height={mat.h}
            style={{ zIndex: MAT_Z.RINGS }}
        >
            <g shapeRendering="crispEdges">
                <path d={path} transform={`translate(${ox + artScale} ${oy + artScale}) scale(${artScale})`} fill={RING_SHADOW} />
                <path d={path} transform={`translate(${ox} ${oy}) scale(${artScale})`} fill={RING_GOLD} />
            </g>
        </svg>
    );
});

export default CampReachRing;
