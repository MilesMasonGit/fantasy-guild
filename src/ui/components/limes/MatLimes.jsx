import { memo, useLayoutEffect, useRef, useState } from 'react';
import { useGameState } from '../../hooks/useGameState.js';
import { useMatSize } from '../../hooks/useMatSize.js';
import { useMatFit } from '../board/MatFitContext.jsx';
import { MAT_Z } from '../board/matLayers.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { activeRegion, REGION_KIND } from '../../../systems/atlas/Atlas.js';
import * as LimesGuide from '../../../systems/quests/LimesGuide.js';
import { LIMES_TEXT } from '../../../systems/quests/limesText.js';
import { LIMES_SRC, limesSizeAt, limesSpotOn, clampLimesSpot, bubbleAcross } from './limesSpot.js';
import { useLimes, clickLimes, matConversation, noteLimesMoved } from './limesStore.js';
import { LimesBubble, LIMES_BUBBLE_PX } from './LimesBubble.jsx';
import { tailInset, speechTailDrop } from '../board/SpeechFrame.jsx';

/** How far the pointer must move, in screen pixels, before a press on Limes is a drag, not a click. */
const DRAG_START_PX = 6;
/** Clear air between Limes's head and its bubble's tail, in screen pixels. */
const BUBBLE_GAP_PX = 4;

const atStarterCamp = () => activeRegion()?.kind === REGION_KIND.STARTER;
const savedKey = () => {
    const s = LimesGuide.limesSpot();
    return s ? `${s.x},${s.y}` : '';
};

/** A mat length put on whole screen pixels, so the art and the frame stay crisp through the mat's zoom. */
const snap = (v, fit) => Math.round(v * fit) / fit;

/**
 * Limes on the Starter Camp's mat (only there): the guide's sprite, which the player can drag
 * anywhere on the mat (its spot is saved) and click to talk, and its speech bubble above it.
 * ⚠️ Not a Token: never on the board, never worked, not in the cap; the engine never sees it.
 * ⚠️ It takes the pointer only on its own drawn pixels and its bubble: its box is alpha-tested
 * like a hero's (`data-alpha-test`), so a press on a see-through pixel reaches the Token or flag
 * beneath (`pressRouting`), and while anything is carried it lets everything through
 * (`components.css`), so a Token can be put down where it stands. A Token wholly under its
 * pixels is reached by moving Limes aside.
 */
export const MatLimes = memo(function MatLimes() {
    const here = useGameState(atStarterCamp, [ENGINE_EVENTS.ATLAS_CHANGED, ENGINE_EVENTS.GAME_RESET]);
    // A load or a new game redraws Limes at the save's spot; a move says so in the store.
    useGameState(savedKey, [ENGINE_EVENTS.GAME_RESET]);
    const fit = useMatFit() || 1;
    const mat = useMatSize();
    const limes = useLimes();
    const [drag, setDrag] = useState(null);
    const press = useRef(null);

    if (!here) return null;

    const size = limesSizeAt(fit);
    const spot = drag ?? limesSpotOn(LimesGuide.limesSpot(), size, mat);
    const left = snap(spot.x - size / 2, fit);
    const top = snap(spot.y - size / 2, fit);

    const onPointerDown = (e) => {
        if (e.button !== 0 || e.isPrimary === false) return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const matEl = e.currentTarget.closest('[data-mat-board]');
        const rect = matEl?.getBoundingClientRect();
        press.current = {
            x: e.clientX, y: e.clientY, from: spot, moved: false,
            // Screen pixels per mat unit, read off the mat as drawn.
            scale: rect && rect.width > 0 ? rect.width / mat.w : fit
        };
    };
    const onPointerMove = (e) => {
        const p = press.current;
        if (!p) return;
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        if (!p.moved && Math.hypot(dx, dy) < DRAG_START_PX) return;
        p.moved = true;
        setDrag(clampLimesSpot({ x: p.from.x + dx / p.scale, y: p.from.y + dy / p.scale }, size, mat));
    };
    const onPointerUp = (e) => {
        const p = press.current;
        press.current = null;
        if (!p) return;
        e.stopPropagation();
        if (p.moved) {
            const to = clampLimesSpot({ x: p.from.x + (e.clientX - p.x) / p.scale, y: p.from.y + (e.clientY - p.y) / p.scale }, size, mat);
            LimesGuide.setLimesSpot(to);
            noteLimesMoved();
            setDrag(null);
        } else {
            clickLimes();
        }
    };
    const onPointerCancel = () => { press.current = null; setDrag(null); };

    const talk = matConversation(limes);

    return (
        <div data-limes className="absolute left-0 top-0 w-0 h-0">
            <div
                role="button"
                tabIndex={0}
                aria-label={LIMES_TEXT.name}
                data-limes-sprite
                data-alpha-test="true"
                data-limes-dragging={drag ? 'true' : undefined}
                className="absolute pointer-events-auto cursor-pointer select-none touch-none"
                style={{ left, top, width: size, height: size, zIndex: MAT_Z.LIMES }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickLimes(); } }}
            >
                <img
                    src={LIMES_SRC}
                    alt=""
                    draggable={false}
                    className="block pointer-events-none"
                    style={{ width: size, height: size, maxWidth: 'none', maxHeight: 'none', imageRendering: 'pixelated' }}
                />
            </div>
            {talk && !drag && (
                <MatLimesBubble talk={talk} x={spot.x} headTop={top} fit={fit} matW={mat.w} />
            )}
        </div>
    );
});

/**
 * The bubble over Limes, drawn at screen size whatever the mat's fit: the mat is zoomed to fit the
 * window, and this box zooms back by the same amount, so its words and pixel frame are the
 * screen's own pixels. Centred over Limes, kept within the mat's sides; below Limes when there is
 * no room above.
 */
function MatLimesBubble({ talk, x, headTop, fit, matW }) {
    const boxRef = useRef(null);
    const [below, setBelow] = useState(false);
    const boxPx = talk.collapsed ? null : LIMES_BUBBLE_PX;
    const [measured, setMeasured] = useState(LIMES_BUBBLE_PX);
    useLayoutEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const h = el.offsetHeight;
        const w = el.offsetWidth;
        if (w) setMeasured(w);
        setBelow(headTop * fit < h + BUBBLE_GAP_PX + speechTailDrop(1));
    }, [talk.kind, talk.index, talk.collapsed, headTop, fit]);
    const across = bubbleAcross(x, boxPx ?? measured, matW, fit, tailInset(1));
    const anchorLeft = snap(x, fit);
    return (
        <div
            data-limes-bubble-anchor
            className="absolute w-0 h-0"
            style={{ left: anchorLeft, top: below ? headTop + limesSizeAt(fit) : headTop, zIndex: MAT_Z.LIMES_BUBBLE }}
        >
            <div className="absolute left-0 top-0 w-0 h-0" style={{ zoom: 1 / fit }}>
                <div
                    ref={boxRef}
                    className="absolute pointer-events-auto"
                    style={{
                        left: across.left,
                        ...(below ? { top: BUBBLE_GAP_PX } : { bottom: BUBBLE_GAP_PX + speechTailDrop(1) }),
                        width: boxPx ?? 'max-content'
                    }}
                >
                    <LimesBubble talk={talk} tail={!below} tailLeft={`${across.tail}px`} />
                </div>
            </div>
        </div>
    );
}
