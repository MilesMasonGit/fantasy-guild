import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useActiveDrag, snapshotDndRegions, surfaceWithinRegions } from '../../dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE } from '../../dnd/dragConstants.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useMatFit } from './MatFitContext.jsx';
import { boardScaleAt, tokenSizeFor, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { MAT_Z } from './matLayers.js';
import { pointerToMat, matRectForDrag, onMatItself } from './matPoint.js';
import { dashedLinePath, MARCH_PX_PER_S } from './orderLine.js';
import * as HeroMotion from '../../../systems/board/HeroMotion.js';
import { matW } from '../../../config/matGeometry.js';
import { createOrderAim } from './orderAim.js';
import { SpeechFrame } from './SpeechFrame.jsx';
import { SPEECH_TONE } from './speechTone.js';
import { plateUnit } from './workPlate.js';
import { calloutTopOf } from './CalloutLayer.jsx';
import { setHintTarget } from './dragHints.js';
import { HeroDragMarks, markMatPx } from './DragMarks.jsx';
import { opaqueBoundsOf } from '../../utils/alphaHitTest.js';
import { onFrame } from './frameClock.js';
import { useSelectedHeroId } from '../../hooks/useMatSelection.js';
import { isMatBankLocked } from '../../hooks/useMatBankLock.js';

/** The line: one art pixel of gold over a black copy one art pixel down-right, as the camp ring. */
const LINE_GOLD = 'var(--color-gi-gold)';
const LINE_SHADOW = '#000';

const reducedMotion = () => typeof window !== 'undefined'
    && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/** Whether a drag carries a hero (their flag, picked up by itself, their figure or their roster tab). */
const carriesHero = (payload) => !!payload?.heroId && payload.kind === DRAG_KIND.FLAG;

/**
 * While a hero is carried to a new job, a dashed line from where they stand on the mat to the
 * point they would be sent to (the pointer: the drop's own point), its dashes marching towards it.
 * Over a Token the hero can work, the carried flag and the line's end snap to the Token's centre;
 * over one they cannot, a red bubble over it says why ("Needs Pickaxe"), as the drop would. Over any
 * Token the carried hero's drag hint marks stand centred over its sprite, under that bubble.
 * **A selected hero** (`useMatSelection.js`) shows the same, nothing carried, while the pointer is
 * on the mat itself: what a right-click there would do, by the same aim. Off the mat (a panel over
 * it, the hero bar) or while the Bank covers it, it shows nothing; any drag takes its place.
 * Nothing is mounted at rest; while carried, one `<svg>` whose two paths are rewritten once per
 * animation frame (`frameClock.onFrame`, paused with the drawing), and the ghost moved, never
 * through React: only the bubble and marks are React's, redrawn as the Token under the pointer
 * changes (`orderAim.js`). A selected hero's loop is the same one, run only while the pointer is
 * on the mat, so a selection held with the pointer elsewhere costs no frame at all. A hero with no
 * figure on the mat (none today: every hero stands on it) draws no line. Under reduced motion the
 * dashes stand still.
 */
export const OrderDragLine = memo(function OrderDragLine({ matRef }) {
    const { isDragging, activePayload } = useActiveDrag();
    const selectedHero = useSelectedHeroId();
    if (isDragging) {
        if (!carriesHero(activePayload)) return null;
        return <MarchingLine key="carried" heroId={activePayload.heroId} session={activePayload} matRef={matRef} />;
    }
    if (!selectedHero) return null;
    return <MarchingLine key="selected" heroId={selectedHero} session={null} matRef={matRef} />;
});

/**
 * How far to move the ghost from where the drag library put it so its middle stands on `target` (a
 * screen point): `rect` is the ghost's box as drawn now, with `applied` (the move it already wears)
 * in it. Measured from the box, never from the pointer: the library moves its overlay to the pointer
 * on its own schedule, a render after the pointer moved, and a move worked out from the pointer
 * would be wrong by the pointer's last step until it catches up, so the flag shook.
 * @returns {{x:number,y:number}}
 */
export function snapShift(rect, applied, target) {
    const baseX = rect.left + rect.width / 2 - applied.x;
    const baseY = rect.top + rect.height / 2 - applied.y;
    return { x: target.x - baseX, y: target.y - baseY };
}

/** The carried ghost, moved onto a screen point (`stand`) or left where the drag library puts it. */
function createGhostSnap(heroId) {
    let ghost = null;
    let target = null;
    let applied = { x: 0, y: 0 };
    // Whenever the library moves the overlay round the ghost, it is put back on the target before
    // that frame is painted (a mutation observer runs before the paint).
    const watch = typeof MutationObserver === 'function' ? new MutationObserver(() => place()) : null;
    const place = () => {
        if (!ghost?.isConnected) return;
        if (!target) {
            if (applied.x || applied.y) ghost.style.transform = '';
            applied = { x: 0, y: 0 };
            return;
        }
        const next = snapShift(ghost.getBoundingClientRect(), applied, target);
        if (Math.abs(next.x - applied.x) < 0.01 && Math.abs(next.y - applied.y) < 0.01) return;
        applied = next;
        ghost.style.transform = `translate(${next.x}px, ${next.y}px)`;
    };
    const find = () => {
        if (ghost?.isConnected) return;
        ghost = typeof document !== 'undefined' ? document.querySelector(`[data-order-ghost="${heroId}"]`) : null;
        applied = { x: 0, y: 0 };
        watch?.disconnect();
        for (let el = ghost?.parentElement; watch && el && el !== document.body; el = el.parentElement) {
            watch.observe(el, { attributes: true, attributeFilter: ['style'] });
        }
    };
    return {
        /** Stand the ghost's middle on screen point `at`, or let it follow the pointer with null. */
        stand(at) {
            find();
            target = at;
            place();
        },
        stop() {
            watch?.disconnect();
            if (ghost?.isConnected) ghost.style.transform = '';
        }
    };
}

function MarchingLine({ heroId, session, matRef }) {
    const mat = useMatSize();
    const fit = useMatFit();
    const artScale = boardScaleAt(fit);
    const goldRef = useRef(null);
    const shadowRef = useRef(null);
    const [target, setTarget] = useState(null);

    useEffect(() => {
        // Carried (`session`: the drag's payload) or selected (none): one aim, one line, one loop.
        const carried = !!session;
        let pointer = null;
        let stopFrames = null;
        let last = '';
        const ghost = carried ? createGhostSnap(heroId) : null;
        const regions = carried ? snapshotDndRegions() : null;
        // The mat's box, read once per drag; a selection outlasts a drag, so it is read again each
        // time the pointer comes back onto the mat or the window is resized, never per frame.
        let rectSession = session || {};
        let aimed = null;
        const aim = createOrderAim(heroId);
        const still = reducedMotion();
        const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const start = () => { if (!stopFrames) stopFrames = onFrame(draw); };
        const stop = () => { stopFrames?.(); stopFrames = null; };
        const onMove = (e) => {
            if (carried) {
                pointer = { x: e.clientX, y: e.clientY };
                return;
            }
            // Selected: only the mat itself takes a right-click order (never a panel over it, the
            // hero bar, or the mat under the Bank), so the hints show only there. Off it, the next
            // frame puts them out and the loop stops until the pointer is back.
            const matEl = matRef?.current || null;
            if (!onMatItself(matEl, e.target) || isMatBankLocked()) {
                pointer = null;
                return;
            }
            if (!pointer) rectSession = {};
            pointer = { x: e.clientX, y: e.clientY };
            start();
        };
        const onLeavePage = (e) => { if (!carried && !e.relatedTarget) pointer = null; };
        const onResize = () => { if (!carried) rectSession = {}; };
        function draw(now) {
            const from = HeroMotion.heroPointOf(heroId);
            const matEl = matRef?.current || null;
            // Over the bar, the Bank's column or a drawer a drop gives no order, so nothing here
            // says it would. Worked out here, not from the provider's surface, so crossing a region redraws nothing.
            const overDrawer = carried && pointer && surfaceWithinRegions(pointer.x, pointer.y, regions) === DND_SURFACE.DRAWER;
            const rect = pointer && matEl && !overDrawer ? matRectForDrag(matEl, rectSession) : null;
            const at = rect ? pointerToMat(pointer, rect) : null;
            // The drop's own hit test, on the pointer: snapping moves the flag, never the aim.
            const aimNow = aim(at);
            if (aimNow !== aimed) {
                aimed = aimNow;
                setTarget(aimed.instance ? { instance: aimed.instance, reason: aimed.reason } : null);
                // Every hero's marks, worked out once per Token entered (`dragHints.js`).
                setHintTarget(aimed.instance);
            }
            const to = aimed.snap ? { x: aimed.instance.x, y: aimed.instance.y } : at;
            if (aimed.snap && rect) {
                const s = rect.width / matW();
                ghost?.stand({ x: rect.left + to.x * s, y: rect.top + to.y * s });
            } else ghost?.stand(null);
            let d = '';
            if (from && to) {
                const cell = (p) => ({ x: Math.floor(p.x / artScale), y: Math.floor(p.y / artScale) });
                const phase = still ? 0 : ((now - t0) / 1000) * MARCH_PX_PER_S;
                d = dashedLinePath(cell(from), cell(to), phase);
            }
            // A selected hero's line with the pointer off the mat has just been put out: nothing
            // moves until it is back.
            if (!carried && !pointer) stop();
            if (d === last) return;
            last = d;
            goldRef.current?.setAttribute('d', d);
            shadowRef.current?.setAttribute('d', d);
        }
        window.addEventListener('pointermove', onMove, { passive: true });
        if (!carried) {
            window.addEventListener('pointerout', onLeavePage, { passive: true });
            window.addEventListener('resize', onResize);
        }
        if (carried) start();
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerout', onLeavePage);
            window.removeEventListener('resize', onResize);
            stop();
            ghost?.stop();
            setHintTarget(null);
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
        {target && <AimedLabel heroId={heroId} instance={target.instance} reason={target.reason} fit={fit} matH={mat.h} />}
        </>
    );
}

/**
 * The top middle of Token `instance`'s drawn sprite, in mat units: its art (`artPx` across, centred
 * on the Token's point), narrowed to the picture's opaque part when `bounds` (`opaqueBoundsOf`)
 * is known, so a sprite drawn off-centre in its picture still gets the marks over its middle.
 * @returns {{x:number, top:number}}
 */
export function spriteTopMiddle(instance, artPx, bounds = null) {
    const b = bounds || { left: 0, top: 0, right: 1, bottom: 1 };
    const left = instance.x - artPx / 2;
    return { x: left + ((b.left + b.right) / 2) * artPx, top: instance.y - artPx / 2 + b.top * artPx };
}

/** The picture a Token draws on the mat, when it is one still sprite (an animated sheet is not). */
function drawnSpriteOf(instanceId) {
    if (typeof document === 'undefined') return null;
    const art = document.querySelector(`[data-token-art][data-token-id="${instanceId}"]`);
    const img = art?.querySelector('img:not([aria-hidden="true"])');
    if (!img?.naturalWidth || img.naturalWidth !== img.naturalHeight) return null;
    return img.getAttribute('src');
}

/**
 * Over the Token under the pointer, worked out once as it is entered: the carried hero's drag hint
 * marks centred just above its sprite and, when the hero cannot be sent there, the drop's own
 * refusal over them. Where a callout would be lifted clear of a work plate or a fight's bars, the
 * column is too.
 */
function AimedLabel({ heroId, instance, reason, fit, matH }) {
    const f = fit || 1;
    const u = plateUnit(f);
    const markPx = markMatPx(f);
    const place = useMemo(() => {
        const artPx = tokenSizeFor(TOKEN_SURFACE.BOARD, instance.typeId, boardScaleAt(f));
        const sprite = spriteTopMiddle(instance, artPx, opaqueBoundsOf(drawnSpriteOf(instance.id)));
        const at = { x: instance.x, y: instance.y, typeId: instance.typeId };
        // A callout over this Token is lifted above a work plate or a fight's bars: so is the column.
        const lifted = calloutTopOf({ ...at, anchorId: instance.id }, { fit: f, matH, u });
        const plain = calloutTopOf(at, { fit: f, matH, u });
        const top = sprite.top - markPx / 8;
        return { x: sprite.x, top: lifted < plain ? Math.min(top, lifted) : top };
    }, [instance, f, matH, u, markPx]);
    return (
        <div
            data-order-aim={instance.id}
            className="absolute left-0 top-0 w-0 h-0 pointer-events-none"
            style={{ zIndex: MAT_Z.CALLOUT }}
        >
            <div
                className="absolute flex flex-col items-center"
                style={{ left: 0, top: 0, gap: markPx / 4, transform: `translate(${place.x}px, ${place.top}px) translate(-50%, -100%)` }}
            >
                {reason && (
                    <div data-order-reason={instance.id}>
                        <SpeechFrame tone={SPEECH_TONE.CANT} u={u} tail className="order-reason-bubble whitespace-nowrap ui-text-title font-bold">
                            {reason}
                        </SpeechFrame>
                    </div>
                )}
                <HeroDragMarks heroId={heroId} size={markPx} />
            </div>
        </div>
    );
}
