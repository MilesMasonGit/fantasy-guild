import { memo, useMemo } from 'react';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useMatFit } from './MatFitContext.jsx';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { MAT_Z } from './matLayers.js';
import { MAT_EDGE } from './groundScreen.js';
import { pixelRingPath } from './pixelRing.js';
import { REACH_DOT_PATHS, REACH_DOT_COLOUR, REACH_DOT_MIDDLE, snapToArt } from './reachDot.js';

/** The ring: one art pixel of gold over a solid black copy one art pixel down-right (the old flag ring's look). */
const RING_GOLD = 'var(--color-gi-gold)';
const RING_SHADOW = '#000';

/** One in-reach dot on a Token's centre, its centre cell on the Token's art-pixel cell. */
const ReachDot = ({ dot, artScale }) => {
    const ox = snapToArt(dot.x, artScale) - REACH_DOT_MIDDLE * artScale;
    const oy = snapToArt(dot.y, artScale) - REACH_DOT_MIDDLE * artScale;
    return (
        <g data-reach-dot={dot.id}>
            <path d={REACH_DOT_PATHS.shape} transform={`translate(${ox + artScale} ${oy + artScale}) scale(${artScale})`} fill={REACH_DOT_COLOUR.shadow} />
            <g transform={`translate(${ox} ${oy}) scale(${artScale})`}>
                <path d={REACH_DOT_PATHS.X} fill={REACH_DOT_COLOUR.X} />
                <path d={REACH_DOT_PATHS.o} fill={REACH_DOT_COLOUR.o} />
                <path d={REACH_DOT_PATHS.w} fill={REACH_DOT_COLOUR.w} />
            </g>
        </g>
    );
};

/**
 * The one reach ring, `{ x, y, r }` in mat units, and a dot over each Token in `dots`
 * (`{ id, x, y }`, worked out by the caller with `reachDisplay.reachDotsAt`). Drawn in whole art
 * pixels, over the Tokens and under the loot (`MAT_Z.RINGS`), never in the pointer's way. `attrs`
 * are data attributes for the svg (which ring this is).
 */
export const ReachRing = memo(function ReachRing({ ring = null, dots = null, attrs = null }) {
    const mat = useMatSize();
    const artScale = boardScaleAt(useMatFit());
    const pixels = ring ? Math.max(1, Math.round(ring.r / artScale)) : 0;
    const path = useMemo(() => (pixels ? pixelRingPath(pixels) : ''), [pixels]);
    if (!ring || !path) return null;
    // Snapped to the art-pixel grid, so every cell lands on whole screen pixels.
    const ox = snapToArt(ring.x, artScale);
    const oy = snapToArt(ring.y, artScale);
    // Clipped to the mat and its rounded corners, so a ring near an edge stops at it.
    return (
        <div
            data-reach-clip
            aria-hidden="true"
            className="absolute left-0 top-0 pointer-events-none overflow-hidden"
            style={{ width: mat.w, height: mat.h, zIndex: MAT_Z.RINGS, borderRadius: MAT_EDGE.radius }}
        >
            <svg
                {...attrs}
                data-r={ring.r}
                data-cx={ring.x}
                data-cy={ring.y}
                className="absolute left-0 top-0 overflow-visible pointer-events-none"
                width={mat.w}
                height={mat.h}
            >
                <g shapeRendering="crispEdges">
                    <path d={path} transform={`translate(${ox + artScale} ${oy + artScale}) scale(${artScale})`} fill={RING_SHADOW} />
                    <path d={path} transform={`translate(${ox} ${oy}) scale(${artScale})`} fill={RING_GOLD} />
                    {dots?.map(dot => <ReachDot key={dot.id} dot={dot} artScale={artScale} />)}
                </g>
            </svg>
        </div>
    );
});

/**
 * A camp's reach ring (`Camps.reachRingOf`) while a hero who works from it is hovered (on the mat
 * or their roster tab) or has their sheet open. `ring` is `{ campId, x, y, r }` in mat units, or
 * null for none. The ring of a camp hovered or carried itself is `MatRings`', with its dots.
 */
export const CampReachRing = memo(function CampReachRing({ ring = null }) {
    const attrs = useMemo(() => (ring ? { 'data-camp-ring': ring.campId } : null), [ring]);
    return <ReachRing ring={ring} attrs={attrs} />;
});
