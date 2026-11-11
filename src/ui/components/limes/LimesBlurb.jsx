import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../../../systems/core/engineEvents.js';
import { LIMES_TEXT } from '../../../systems/quests/limesText.js';
import { SpeechFrame, tailInset } from '../board/SpeechFrame.jsx';
import { SPEECH_TONE } from '../board/speechTone.js';
import { LIMES_SRC, LIMES_ART_PX } from './limesSpot.js';
import { LIMES_MARK_ATTR } from './limesMark.js';
import { useLimes, stepAt, collapseLimesStep } from './limesStore.js';
import { LimesBubble, LIMES_BUBBLE_PX } from './LimesBubble.jsx';

/** The setting that shows the small Limes on every screen (Settings, Display). */
export const LIMES_BLURBS_SETTING = 'ui.limesBlurbs';

/** The small Limes's art scale: 32 px art at 1×. */
const SMALL_SCALE = 1;
/** How far the blurb stands from the small Limes and from the window's edges, in screen pixels. */
const BLURB_GAP_PX = 6;
const EDGE_PX = 8;

export function useLimesBlurbsOn() {
    const [on, setOn] = useState(() => SettingsManager.get(LIMES_BLURBS_SETTING) !== false);
    useEffect(() => EventBus.subscribe(
        ENGINE_EVENTS.SETTINGS_UPDATED,
        () => setOn(SettingsManager.get(LIMES_BLURBS_SETTING) !== false),
        UI_LISTENER
    ), []);
    return on;
}

/**
 * Where the blurb's box goes beside the small Limes at `anchor` (a client rect): under it when it
 * fits, else over it (with the tail pointing down at it), and never off the window.
 * @returns {{ left: number, top: number, above: boolean, tail: number }} screen pixels; `tail` is
 *   the tail's distance from the box's left edge
 */
export function blurbPlace(anchor, width, height, viewW, viewH) {
    const mid = anchor.left + anchor.width / 2;
    let left = Math.round(mid - width / 2);
    left = Math.max(EDGE_PX, Math.min(left, viewW - EDGE_PX - width));
    const belowTop = anchor.bottom + BLURB_GAP_PX;
    const above = belowTop + height > viewH - EDGE_PX && anchor.top - BLURB_GAP_PX - height >= EDGE_PX;
    const top = above ? Math.round(anchor.top - BLURB_GAP_PX - height) : Math.round(belowTop);
    const inset = tailInset(1);
    const tail = Math.max(inset, Math.min(width - inset, mid - left));
    return { left, top, above, tail };
}

/**
 * A screen's small Limes: hovering it shows a blurb on that screen's basic mechanic
 * (`LIMES_TEXT.blurbs[spot]`). Hidden by the Settings switch, unless a step speaks through it
 * (`limesStore.openLimesStep` with this `spot`): then it wears the gold outline and its bubble
 * stays open (Next, Close) until the step is done; Close shrinks it, and a click on Limes opens it
 * again.
 * @param {{ spot: string, className?: string }} props
 */
export function LimesBlurb({ spot, className }) {
    const on = useLimesBlurbsOn();
    const limes = useLimes();
    const step = stepAt(spot, limes);
    const [hover, setHover] = useState(false);
    // ⚠️ A state ref, not useRef: a child's layout effect runs before its parent's ref is set, so a
    // bubble mounting with its Limes (a step on a Limes the setting hid) would measure nothing.
    const [anchor, setAnchor] = useState(null);
    const words = LIMES_TEXT.blurbs[spot];
    if (!step && (!on || !words)) return null;

    const stepOpen = step && !step.collapsed;
    const size = LIMES_ART_PX * SMALL_SCALE;
    return (
        <span
            ref={setAnchor}
            data-limes-blurb={spot}
            data-limes-step={step ? step.id : undefined}
            className={`inline-flex shrink-0 cursor-help ${className || ''}`}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            onClick={(e) => { if (step) { e.stopPropagation(); collapseLimesStep(!step.collapsed); } }}
        >
            <img
                src={LIMES_SRC}
                alt={LIMES_TEXT.name}
                draggable={false}
                {...{ [LIMES_MARK_ATTR]: step ? 'glow' : undefined }}
                style={{ width: size, height: size, maxWidth: 'none', imageRendering: 'pixelated' }}
            />
            {anchor && (stepOpen || (hover && !step)) && (
                <BlurbBox anchor={anchor} spot={spot} step={stepOpen ? step : null} words={words} />
            )}
        </span>
    );
}

/** The blurb itself, on the page's top layer beside the small Limes. */
function BlurbBox({ anchor, spot, step, words }) {
    const boxRef = useRef(null);
    const [place, setPlace] = useState(null);
    useLayoutEffect(() => {
        const a = anchor.getBoundingClientRect();
        const box = boxRef.current;
        if (!a || !box) return;
        const next = blurbPlace(a, box.offsetWidth, box.offsetHeight, window.innerWidth, window.innerHeight);
        setPlace(p => (p && p.left === next.left && p.top === next.top && p.above === next.above && p.tail === next.tail ? p : next));
    }, [anchor, step?.id, step?.index, words]);
    if (typeof document === 'undefined') return null;
    const talk = step ? { kind: 'step', lines: step.lines, index: step.index, collapsed: false } : null;
    return createPortal(
        <div
            ref={boxRef}
            role={step ? 'dialog' : 'tooltip'}
            data-limes-blurb-box={spot}
            className={`fixed left-0 top-0 z-(--z-tooltip) ${step ? 'pointer-events-auto' : 'pointer-events-none'}`}
            style={{
                width: LIMES_BUBBLE_PX,
                transform: place ? `translate3d(${place.left}px, ${place.top}px, 0)` : 'translate3d(-9999px, -9999px, 0)'
            }}
        >
            {talk
                ? <LimesBubble talk={talk} tail={!!place?.above} tailLeft={`${place?.tail ?? 0}px`} />
                : (
                    <SpeechFrame tone={SPEECH_TONE.LIMES} tail={!!place?.above} tailLeft={`${place?.tail ?? 0}px`} data-limes-bubble="blurb">
                        <span data-limes-words className="block ui-text-body font-bold leading-snug whitespace-normal">{words}</span>
                    </SpeechFrame>
                )}
        </div>,
        document.body
    );
}
