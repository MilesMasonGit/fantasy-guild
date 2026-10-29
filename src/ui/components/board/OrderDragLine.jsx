import { memo, useEffect, useRef, useState } from 'react';
import { useActiveDrag } from '../../dnd/DndKit.jsx';
import { DRAG_KIND } from '../../dnd/dragConstants.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useMatFit } from './MatFitContext.jsx';
import { boardScaleAt } from '../base/TokenSprite.jsx';
import { MAT_Z } from './matLayers.js';
import { pointerToMat, matRectForDrag } from './matPoint.js';
import { dashedLinePath, MARCH_PX_PER_S } from './orderLine.js';
import * as HeroMotion from '../../../systems/board/HeroMotion.js';
import { matW } from '../../../config/matGeometry.js';
import { createOrderAim } from './orderAim.js';
import { SpeechFrame } from './SpeechFrame.jsx';
import { SPEECH_TONE } from './speechTone.js';
import { plateUnit } from './workPlate.js';
import { calloutTopOf } from './CalloutLayer.jsx';

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
 * Over a Token the hero can work, the carried flag and the line's end snap to the Token's centre;
 * over one they cannot, a red bubble over it says why ("Needs Pickaxe"), as the drop would.
 * Nothing is mounted at rest; while carried, one `<svg>` whose two paths are rewritten once per
 * animation frame, and the ghost moved, never through React: only the bubble is React's, redrawn
 * as the Token under the pointer changes (`orderAim.js`). A hero with no figure on the mat (none
 * today: every hero stands on it) draws no line. Under reduced motion the dashes stand still.
 */
export const OrderDragLine = memo(function OrderDragLine({ matRef }) {
    const { isDragging, activePayload } = useActiveDrag();
    if (!isDragging || !carriesHero(activePayload)) return null;
    return <MarchingLine heroId={activePayload.heroId} session={activePayload} matRef={matRef} />;
});

/** The carried ghost's box (`DragGhost`), found once and again only if it was redrawn. */
function findGhost(heroId, had) {
    if (had?.isConnected) return had;
    return typeof document !== 'undefined' ? document.querySelector(`[data-order-ghost="${heroId}"]`) : null;
}

/**
 * How far to move the ghost so its middle (the pointer) lands on mat point `to`, in screen pixels,
 * as a CSS transform: '' for no move.
 */
export function snapTransform(pointer, rect, to) {
    if (!pointer || !rect || !to || !(rect.width > 0)) return '';
    const s = rect.width / matW();
    const dx = Math.round(rect.left + to.x * s - pointer.x);
    const dy = Math.round(rect.top + to.y * s - pointer.y);
    return dx || dy ? `translate(${dx}px, ${dy}px)` : '';
}

function MarchingLine({ heroId, session, matRef }) {
    const mat = useMatSize();
    const fit = useMatFit();
    const artScale = boardScaleAt(fit);
    const goldRef = useRef(null);
    const shadowRef = useRef(null);
    const [bubble, setBubble] = useState(null);

    useEffect(() => {
        let pointer = null;
        let frame = 0;
        let last = '';
        let ghost = null;
        let shift = '';
        let aimed = null;
        const aim = createOrderAim(heroId);
        const still = reducedMotion();
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const onMove = (e) => { pointer = { x: e.clientX, y: e.clientY }; };
        const draw = (now) => {
            frame = requestAnimationFrame(draw);
            const from = HeroMotion.heroPointOf(heroId);
            const matEl = matRef?.current || null;
            const rect = pointer && matEl ? matRectForDrag(matEl, session) : null;
            const at = rect ? pointerToMat(pointer, rect) : null;
            // The drop's own hit test, on the pointer: snapping moves the flag, never the aim.
            const aimNow = aim(at);
            if (aimNow !== aimed) {
                aimed = aimNow;
                setBubble(aimed.reason ? { instance: aimed.instance, reason: aimed.reason } : null);
            }
            const to = aimed.snap ? { x: aimed.instance.x, y: aimed.instance.y } : at;
            const nextShift = aimed.snap ? snapTransform(pointer, rect, to) : '';
            const g = findGhost(heroId, ghost);
            if (g !== ghost || nextShift !== shift) {
                ghost = g;
                shift = nextShift;
                if (ghost) ghost.style.transform = shift;
            }
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
            if (ghost?.isConnected) ghost.style.transform = '';
        };
    }, [heroId, session, matRef, artScale]);

    return (
        <>
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
        {bubble && <ReasonBubble instance={bubble.instance} reason={bubble.reason} fit={fit} matH={mat.h} />}
        </>
    );
}

/**
 * Why the carried hero cannot be sent to the Token under the pointer, over it: the drop's own
 * refusal callout, held for as long as the pointer stays on that Token.
 */
function ReasonBubble({ instance, reason, fit, matH }) {
    const f = fit || 1;
    const u = plateUnit(f);
    const at = { x: instance.x, y: instance.y, typeId: instance.typeId, anchorId: instance.id };
    const top = calloutTopOf(at, { fit: f, matH, u });
    return (
        <div
            data-order-reason={instance.id}
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.CALLOUT }}
        >
            <div className="absolute" style={{ left: 0, top: 0, transform: `translate(${at.x}px, ${top}px) translate(-50%, -100%)` }}>
                <SpeechFrame tone={SPEECH_TONE.CANT} u={u} tail className="order-reason-bubble whitespace-nowrap ui-text-title font-bold">
                    {reason}
                </SpeechFrame>
            </div>
        </div>
    );
}

export default OrderDragLine;
