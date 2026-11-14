import { memo, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as Banners from '../../../systems/notifications/banners.js';
import { TONE, BANNER_KINDS } from '../../../systems/notifications/bannerKinds.js';
import { EventBus } from '../../../systems/core/EventBus.js';
import { UI_EVENTS } from '../../../systems/core/engineEvents.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { BannerArt } from '../base/BannerArt.jsx';
import { useDrawn } from '../../dev/perf/drawSwitches.js';
import { cn } from '../../utils/cn.js';
import { outlineSubjects } from './bannerHighlight.js';
import { MAT_TOP_BAR_PX } from '../board/MatTopBar.jsx';
import { prefersReducedMotion } from '../board/fx/pixelSteps.js';
import { SETTLE } from '../board/HallCamera.jsx';
import { animateFx, whenOver } from '../board/fx/oneShot.js';

/**
 * The banners: what the player must not miss, at the top centre of the mat, dropping from behind
 * the top bar with one small overshoot. A big sprite on the left, a title and one line, in a
 * studded frame with a gold edge for a milestone and a red one for a problem (placeholder frames
 * until the owner's ribbon). A milestone gets one pass of the shine.
 *
 * Each stays until clicked, and a click dismisses it. Up to three stack, newest on top; past
 * three a "+N" tab counts the rest. Hovering a banner about a hero or a Token outlines it on the
 * mat (gold; red for a problem). A kind that `pointsTo` its Token (an event's) also asks, as it is
 * clicked, for that Token to be shown on the mat (`UI_EVENTS.SHOW_ON_MAT`): from the World Map or
 * the Guild Hall back to the mat, then a short gold pulse on it.
 *
 * One stack for every view, drawn outside the cameras just under where the mat's top bar sits, so a
 * banner keeps its place on screen while the view glides between the mat, the Guild Hall and the
 * World Map. Over those two (`away`) it shows only the kinds that point to a Token, so an event can
 * be reached from there; the others wait for the mat. When the banners above or below one come or
 * go, it slides to its new place ({@link slidesBetween}) instead of jumping.
 */

export const BANNER_WIDTH_PX = 480;
/** The sprite box: item art (32 px) at 2x, hero faces and upgrade icons (64 px) at 1x. */
const SPRITE_PX = 64;
/** How long the lift takes before the banner is gone (`gi-banner-lift`). */
const LIFT_MS = 200;
/** How long a banner takes to slide to its new place in the stack. */
export const SLIDE_MS = 300;
const SLIDE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** The `data-banner-slot` of the "+N" tab, which slides with the banners. */
const WAITING_SLOT = 'waiting';

/**
 * How far each banner that stayed in the stack must start from its new place to seem to slide
 * there from its old one: `[{ id, dy }]`, `dy` the old top less the new, for every id in both maps
 * whose top moved. A banner just come has no old place (it drops in by its own animation).
 * @param {Map<string, number>} before  each slot's top as last drawn
 * @param {Map<string, number>} after  each slot's top now
 */
export function slidesBetween(before, after) {
    const out = [];
    for (const [id, top] of after) {
        const was = before.get(id);
        if (was != null && was !== top) out.push({ id, dy: was - top });
    }
    return out;
}

/** Each slot's top inside the stack, by its `data-banner-slot`. */
function slotTops(box) {
    const tops = new Map();
    if (!box) return tops;
    for (const el of box.children) {
        const id = el.getAttribute('data-banner-slot');
        if (id) tops.set(id, el.offsetTop);
    }
    return tops;
}

/**
 * Slide every banner that moved since the last draw from its old place to its new one. Added to the
 * banner's own drop or lift (`composite: 'add'`), so a banner still dropping in keeps dropping.
 */
function useSlides(boxRef) {
    const tops = useRef(new Map());
    useLayoutEffect(() => {
        const box = boxRef.current;
        const now = slotTops(box);
        const moves = box && !prefersReducedMotion() ? slidesBetween(tops.current, now) : [];
        tops.current = now;
        const slides = [];
        for (const { id, dy } of moves) {
            const el = box.querySelector(`[data-banner-slot="${id}"]`);
            try {
                const slide = animateFx(
                    el,
                    [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0px)' }],
                    { duration: SLIDE_MS, easing: SLIDE_EASING, composite: 'add' }
                );
                if (!slide) continue;
                slide.pause();
                // Never left holding a banner off its place: a hidden window draws no frame.
                whenOver(slide, SETTLE.maxMs + SLIDE_MS, () => {});
                slides.push(slide);
            } catch {
                // A browser without composite animations jumps, as before.
            }
        }
        if (slides.length) whenFramesFlow(() => { for (const s of slides) s.play(); });
    });
}

/**
 * Run `fn` once frames follow each other within `SETTLE.gapMs` again, at most `SETTLE.maxMs` from
 * now. ⚠️ A view change mounts a whole screen (the World Map's first frame can take most of a
 * second); a slide started before that stall would have run its course before it was ever drawn.
 * Until then the banners hold where they were.
 */
function whenFramesFlow(fn) {
    if (typeof requestAnimationFrame !== 'function') {
        fn();
        return;
    }
    let done = false;
    const once = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        fn();
    };
    const timer = setTimeout(once, SETTLE.maxMs);
    let last = null;
    const step = (t) => {
        if (done) return;
        const steady = last != null && t - last <= SETTLE.gapMs;
        last = t;
        if (steady) once();
        else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

const BannerSprite = ({ sprite }) => {
    if (!sprite) return <div style={{ width: SPRITE_PX, height: SPRITE_PX }} />;
    if (sprite.kind === 'item') {
        return <ItemIcon item={sprite.id} size={SPRITE_PX} title={null} className="shrink-0" />;
    }
    // A Token (an event's): its board art at 1x.
    if (sprite.kind === 'token') {
        return (
            <span data-banner-token={sprite.id} className="shrink-0 flex items-center justify-center" style={{ width: SPRITE_PX, height: SPRITE_PX }}>
                <TokenSprite typeId={sprite.id} surface={TOKEN_SURFACE.INSPECT} size={SPRITE_PX} alt="" />
            </span>
        );
    }
    // A place: a square of its area banner at 1x, never shrunk.
    if (sprite.kind === 'area') {
        return (
            <div data-banner-area={sprite.id} className="relative shrink-0 overflow-hidden" style={{ width: SPRITE_PX, height: SPRITE_PX }}>
                <BannerArt banner={sprite.id} scale={1} />
            </div>
        );
    }
    return (
        <img
            src={sprite.src}
            alt=""
            draggable={false}
            width={SPRITE_PX}
            height={SPRITE_PX}
            className="select-none pointer-events-none"
            style={{ imageRendering: 'pixelated' }}
        />
    );
};

/** One banner. */
export const Banner = memo(function Banner({ banner }) {
    const [leaving, setLeaving] = useState(false);
    const timer = useRef(null);
    const problem = banner.tone === TONE.PROBLEM;
    useEffect(() => () => {
        // Clicked and taken away before its lift ended (the banners switched off mid-lift, or the
        // view filtered it out): it is still dismissed.
        if (timer.current !== null) Banners.dismiss(banner.id);
        clearTimeout(timer.current);
        outlineSubjects([]);
    }, []);   // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <button
            type="button"
            data-banner={banner.kind}
            data-banner-slot={banner.id}
            data-banner-tone={banner.tone}
            data-banner-leaving={leaving ? 'true' : undefined}
            className="gi-banner pointer-events-auto block text-left cursor-pointer shrink-0"
            style={{ width: BANNER_WIDTH_PX }}
            onMouseEnter={() => banner.subjects.length && outlineSubjects(banner.subjects, problem ? 'red' : 'gold')}
            onMouseLeave={() => outlineSubjects([])}
            onClick={() => {
                if (leaving) return;
                setLeaving(true);
                outlineSubjects([]);
                if (BANNER_KINDS[banner.kind]?.pointsTo) {
                    const subjects = banner.subjects.filter(s => s.type !== 'token' || BoardState.getTokenById(s.id));
                    if (subjects.length) EventBus.publish(UI_EVENTS.SHOW_ON_MAT, { subjects });
                }
                timer.current = setTimeout(() => Banners.dismiss(banner.id), LIFT_MS);
            }}
        >
            <PixelFrame
                kind={FRAME_KIND.STUDS}
                frameClassName={cn(
                    'relative overflow-hidden flex items-center gap-3 px-2 py-1 font-pixel text-amber-100',
                    problem ? 'ui-frame-studs-red' : 'ui-frame-studs-gold gi-banner-shine'
                )}
            >
                <BannerSprite sprite={banner.sprite} />
                <div className="flex flex-col min-w-0 flex-1">
                    <span
                        data-banner-title
                        className="ui-text-title font-bold"
                        style={{ color: problem ? 'var(--color-ui-red)' : 'var(--color-ui-gold)' }}
                    >
                        {banner.title}
                    </span>
                    {banner.line && <span data-banner-line className="ui-text-body">{banner.line}</span>}
                </div>
            </PixelFrame>
        </button>
    );
});

/** @param {{away?: boolean}} props `away`: the World Map or the Guild Hall is the view: only kinds that point to a Token. */
export const BannerStack = memo(function BannerStack({ away = false }) {
    const drawn = useDrawn('notifications');
    useSyncExternalStore(Banners.subscribe, Banners.getVersion);
    const boxRef = useRef(null);
    useSlides(boxRef);
    if (!drawn) return null;
    const view = Banners.getView();
    const shown = away ? view.shown.filter(b => BANNER_KINDS[b.kind]?.pointsTo) : view.shown;
    const waiting = away ? 0 : view.waiting;
    const { problemWaiting } = view;
    if (!shown.length) return null;
    return (
        // Clipped at the top edge, so a banner seems to come from behind the top bar.
        <div className="absolute inset-x-0 bottom-0 overflow-hidden pointer-events-none z-30" style={{ top: MAT_TOP_BAR_PX }}>
            <div ref={boxRef} data-banners={away ? 'away' : 'mat'} className="absolute top-1 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
                {shown.map(b => <Banner key={b.id} banner={b} />)}
                {waiting > 0 && (
                    <PixelFrame
                        kind={FRAME_KIND.CHAMFER}
                        data-banner-slot={WAITING_SLOT}
                        data-banners-waiting={waiting}
                        title={`${waiting} more waiting: click a banner to see the next`}
                        className="pointer-events-auto"
                        frameClassName="px-2 font-pixel ui-text-body font-bold"
                        frameStyle={{ color: problemWaiting ? 'var(--color-ui-red)' : 'var(--color-ui-gold)' }}
                    >
                        +{waiting}
                    </PixelFrame>
                )}
            </div>
        </div>
    );
});
