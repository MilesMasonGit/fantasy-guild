import { memo, useEffect, useRef } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useMatFit } from './MatFitContext.jsx';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { MAT_Z } from './matLayers.js';
import { pointerToMat, matRectForDrag } from './matPoint.js';
import { dashedLinePath, MARCH_PX_PER_S } from './orderLine.js';
import * as HeroMotion from '../../../systems/board/HeroMotion.js';

/** The line: one art pixel of gold over a black copy one art pixel down-right, as the camp ring. */
const LINE_GOLD = 'var(--color-gi-gold)';
const LINE_SHADOW = '#000';

const reducedMotion = () => typeof window !== 'undefined'
    && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/** Whether a drag carries a hero (their figure, their marker or their roster tab). */
const carriesHero = (payload) => !!payload?.heroId
    && (payload.kind === DRAG_KIND.HERO || payload.kind === DRAG_KIND.FLAG);

/**
 * While a hero is carried to a new job, a dashed line from where they stand on the mat to the
 * point they would be sent to (the pointer: the drop's own point), its dashes marching towards it.
 * Nothing is mounted at rest; while carried, one `<svg>` whose two paths are rewritten once per
 * animation frame, never through React. A hero with no figure on the mat (none today: every hero
 * stands on it) draws no line. Under reduced motion the dashes stand still.
 */
export const OrderDragLine = memo(function OrderDragLine({ matRef }) {
    const { isDragging, activePayload } = useActiveDrag();
    if (!isDragging || !carriesHero(activePayload)) return null;
    return <MarchingLine heroId={activePayload.heroId} session={activePayload} matRef={matRef} />;
});

function MarchingLine({ heroId, session, matRef }) {
    const mat = useMatSize();
    const artScale = boardScaleAt(useMatFit());
    const goldRef = useRef(null);
    const shadowRef = useRef(null);

    useEffect(() => {
        let pointer = null;
        let frame = 0;
        let last = '';
        const still = reducedMotion();
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const onMove = (e) => { pointer = { x: e.clientX, y: e.clientY }; };
        const draw = (now) => {
            frame = requestAnimationFrame(draw);
            const from = HeroMotion.heroPointOf(heroId);
            const matEl = matRef?.current || null;
            const to = pointer && matEl ? pointerToMat(pointer, matRectForDrag(matEl, session)) : null;
            let d = '';
            if (from && to) {
                const cell = (p) => ({ x: Math.floor(p.x / artScale), y: Math.floor(p.y / artScale) });
                const phase = still ? 0 : ((now - t0) / 1000) * MARCH_PX_PER_S;
                d = dashedLinePath(cell(from), cell(to), phase);
            }
            if (d === last) return;
            last = d;
            goldRef.current?.setAttribute('d', d);
            shadowRef.current?.setAttribute('d', d);
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(draw);
        return () => {
            window.removeEventListener('pointermove', onMove);
            if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
        };
    }, [heroId, session, matRef, artScale]);

    return (
        <svg
            data-order-line={heroId}
            aria-hidden="true"
            className="absolute left-0 top-0 overflow-visible pointer-events-none"
            width={mat.w}
            height={mat.h}
            style={{ zIndex: MAT_Z.RINGS }}
        >
            <g shapeRendering="crispEdges">
                <path ref={shadowRef} d="" transform={`translate(${artScale} ${artScale}) scale(${artScale})`} fill={LINE_SHADOW} />
                <path ref={goldRef} d="" transform={`scale(${artScale})`} fill={LINE_GOLD} />
            </g>
        </svg>
    );
}

export default OrderDragLine;
