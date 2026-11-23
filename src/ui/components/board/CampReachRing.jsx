import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useMatFit } from './MatFitContext.jsx';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { MAT_Z } from './matLayers.js';
import { MAT_EDGE } from './groundScreen.js';
import { pixelRingPath } from './pixelRing.js';
import { REACH_DOT_PATHS, REACH_DOT_COLOUR, REACH_DOT_MIDDLE, REACH_DOT_PULSE, REACH_DOT_HALO, snapToArt } from './reachDot.js';
import { useGrowRing } from './growRing.js';
import { playPoses, prefersReducedMotion } from './fx/pixelSteps.js';

/** The ring: one art pixel of gold over a solid black copy one art pixel down-right (the old flag ring's look). */
const RING_GOLD = 'var(--color-gi-gold)';
const RING_SHADOW = '#000';

/**
 * One in-reach dot on a Token's centre, its centre cell on the Token's art-pixel cell, on its
 * see-through dark backing. It pulses once as it arrives (the growing ring reaching it, or a
 * carried ring's reach coming over it).
 */
const ReachDot = ({ dot, artScale }) => {
    const ox = snapToArt(dot.x, artScale) - REACH_DOT_MIDDLE * artScale;
    const oy = snapToArt(dot.y, artScale) - REACH_DOT_MIDDLE * artScale;
    const hop = useRef(null);
    const halo = useRef(null);
    useLayoutEffect(() => {
        if (prefersReducedMotion()) return;
        playPoses(hop.current, REACH_DOT_PULSE, { unit: artScale });
        playPoses(halo.current, REACH_DOT_HALO, { rest: { visibility: 'hidden' } });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // ⚠️ The hop's CSS transform goes on the outer group, which has no transform attribute of its
    // own: on an SVG element a CSS transform replaces the attribute.
    return (
        <g data-reach-dot={dot.id} ref={hop}>
            <path data-reach-dot-backing d={REACH_DOT_PATHS.backing} transform={`translate(${ox} ${oy}) scale(${artScale})`} fill={REACH_DOT_COLOUR.backing} />
            <path d={REACH_DOT_PATHS.shape} transform={`translate(${ox + artScale} ${oy + artScale}) scale(${artScale})`} fill={REACH_DOT_COLOUR.shadow} />
            <g transform={`translate(${ox} ${oy}) scale(${artScale})`}>
                <path ref={halo} d={REACH_DOT_PATHS.halo} fill={REACH_DOT_COLOUR.halo} visibility="hidden" />
                <path d={REACH_DOT_PATHS.X} fill={REACH_DOT_COLOUR.X} />
                <path d={REACH_DOT_PATHS.o} fill={REACH_DOT_COLOUR.o} />
                <path d={REACH_DOT_PATHS.w} fill={REACH_DOT_COLOUR.w} />
            </g>
        </g>
    );
};

/**
 * The one reach ring, `{ x, y, r, key? }` in mat units, and a dot over each Token in `dots`
 * (`{ id, x, y }`, worked out by the caller with `reachDisplay.reachDotsAt`). It grows out from
 * its centre when it appears and shrinks back when `ring` goes null (`growRing.useGrowRing`); a
 * dot shows once the ring has reached it and goes as it shrinks past. A new `key` grows again; the
 * same key moving follows. Drawn in whole art pixels, over the Tokens and under the loot
 * (`MAT_Z.RINGS`), never in the pointer's way. `attrs` are data attributes for the svg (which ring
 * this is); `colour` the ring's fill.
 */
export const ReachRing = memo(function ReachRing({ ring = null, dots = null, attrs = null, colour = RING_GOLD }) {
    const mat = useMatSize();
    const artScale = boardScaleAt(useMatFit());
    const shown = useGrowRing(ring, artScale);
    // What the ring carried, held while it shrinks away after its owner has let it go.
    const held = useRef({ dots: null, attrs: null });
    if (ring) held.current = { dots, attrs };
    const px = shown ? shown.px : 0;
    const path = useMemo(() => (px ? pixelRingPath(px) : ''), [px]);
    if (!shown) return null;
    // Snapped to the art-pixel grid, so every cell lands on whole screen pixels.
    const ox = snapToArt(shown.x, artScale);
    const oy = snapToArt(shown.y, artScale);
    const reached = (held.current.dots || []).filter(d => shown.settled || Math.hypot(d.x - shown.x, d.y - shown.y) <= shown.radius);
    // Clipped to the mat and its rounded corners, so a ring near an edge stops at it.
    return (
        <div
            data-reach-clip
            aria-hidden="true"
            className="absolute left-0 top-0 pointer-events-none overflow-hidden"
            style={{ width: mat.w, height: mat.h, zIndex: MAT_Z.RINGS, borderRadius: MAT_EDGE.radius }}
        >
            <svg
                {...held.current.attrs}
                data-r={shown.r}
                data-px={shown.px}
                data-cx={shown.x}
                data-cy={shown.y}
                className="absolute left-0 top-0 overflow-visible pointer-events-none"
                width={mat.w}
                height={mat.h}
            >
                <g shapeRendering="crispEdges">
                    {path && <path d={path} transform={`translate(${ox + artScale} ${oy + artScale}) scale(${artScale})`} fill={RING_SHADOW} />}
                    {path && <path d={path} transform={`translate(${ox} ${oy}) scale(${artScale})`} fill={colour} />}
                    {reached.map(dot => <ReachDot key={dot.id} dot={dot} artScale={artScale} />)}
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
    const grown = useMemo(() => (ring ? { ...ring, key: ring.campId } : null), [ring]);
    return <ReachRing ring={grown} attrs={attrs} />;
});
