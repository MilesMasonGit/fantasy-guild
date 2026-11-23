import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as Banners from '../../../systems/notifications/banners.js';
import { TONE, BANNER_KINDS } from '../../../systems/notifications/bannerKinds.js';
import { EventBus, UI_LISTENER } from '../../../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../../../systems/core/engineEvents.js';
import { SettingsManager } from '../../../systems/core/SettingsManager.js';
import { t } from '../../../i18n/index.js';
import * as BoardState from '../../../systems/board/BoardState.js';
import { TokenSprite, TOKEN_SURFACE } from '../base/TokenSprite.jsx';
import { PixelFrame, FRAME_KIND } from '../base/PixelFrame.jsx';
import { ArrowScrollList } from '../base/ArrowScrollList.jsx';
import { ItemIcon } from '../base/ItemIcon.jsx';
import { BannerArt } from '../base/BannerArt.jsx';
import { useDrawn } from '../../dev/perf/drawSwitches.js';
import { cn } from '../../utils/cn.js';
import { outlineSubjects } from './bannerHighlight.js';
import { bannersOut, cornerBanners, peeksAfter, samePeeks } from './bannerCorner.js';
import { BANNER_CORNER_TOP_PX as CORNER_TOP_PX } from './stubGeometry.js';
import { MAT_TOP_BAR_PX } from '../board/MatTopBar.jsx';
import { prefersReducedMotion } from '../board/fx/pixelSteps.js';
import { SETTLE } from '../board/HallCamera.jsx';
import { animateFx, whenOver } from '../board/fx/oneShot.js';

/**
 * The banners: what the player must not miss, in a corner at the top right of the mat, above the
 * item stubs. A show/hide icon there says how many are up (red when a problem is among them);
 * shown, every banner is listed down from it (scrolling if long), newest first; hidden, a new one
 * pops out for a few seconds (`PEEK_MS`, `bannerCorner.js`) and tucks back in. A click on the icon shows or hides
 * them all, and the choice is kept per device in the settings ({@link BANNERS_SHOWN_SETTING}).
 *
 * A banner: a big sprite on the left, a title and one line, in a studded frame with a gold edge for
 * a milestone and a red one for a problem (placeholder frames until the owner's ribbon). It drops
 * out from under the icon with one small overshoot, and a milestone gets one pass of the shine.
 * Each stays until clicked, and a click dismisses it. Hovering a banner about a hero or a Token
 * outlines it on the mat (gold; red for a problem). A kind that `pointsTo` its Token (an event's)
 * also asks, as it is clicked, for that Token to be shown on the mat (`UI_EVENTS.SHOW_ON_MAT`):
 * from the World Map or the Guild Hall back to the mat, then a short gold pulse on it.
 *
 * One corner for every view, drawn outside the cameras just under where the mat's top bar sits,
 * so a banner keeps its place on screen while the view glides between the mat, the Guild Hall and
 * the World Map. Over those two (`away`) it holds only the kinds that point to a Token, so an event
 * can be reached from there, and draws nothing without one. When the banners above or below one
 * come or go, it slides to its new place ({@link slidesBetween}) instead of jumping.
 */

/** The setting that keeps the corner shown (true, the default) or hidden. */
export const BANNERS_SHOWN_SETTING = 'notifications.bannersShown';

export const BANNER_WIDTH_PX = 480;
/** The sprite box: item art (32 px) at 2x, hero faces and upgrade icons (64 px) at 1x. */
const SPRITE_PX = 64;
/** How long the lift takes before the banner is gone (`gi-banner-lift`). */
const LIFT_MS = 200;
/** How long a banner takes to slide to its new place in the stack. */
export const SLIDE_MS = 300;
const SLIDE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

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
export const Banner = memo(function Banner({ banner, tucking = false }) {
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
            data-banner-leaving={leaving || tucking ? 'true' : undefined}
            className="gi-banner pointer-events-auto block text-left cursor-pointer shrink-0"
            style={{ width: BANNER_WIDTH_PX }}
            onMouseEnter={() => banner.subjects.length && outlineSubjects(banner.subjects, problem ? 'red' : 'gold')}
            onMouseLeave={() => outlineSubjects([])}
            onClick={() => {
                if (leaving || tucking) return;
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

/** The icon's sprite at 1x: gold while only milestones wait, red with a problem among them. */
const ICON_SRC = { calm: '/assets/ui/u_alert_yellow.png', problem: '/assets/ui/u_alert_red.png' };
const ICON_SPRITE_PX = 32;

/** Whether the corner is open, kept per device in the settings. */
function useCornerOpen() {
    const read = () => SettingsManager.get(BANNERS_SHOWN_SETTING) !== false;
    const [open, setOpen] = useState(read);
    useEffect(() => EventBus.subscribe(ENGINE_EVENTS.SETTINGS_UPDATED, () => setOpen(read()), UI_LISTENER), []);
    return open;
}

/**
 * The banners popped out of a hidden corner, each until its time is up ({@link peeksAfter}). The
 * banners up when the corner first draws are old news: none of them pops.
 */
function usePeeks(list, open) {
    const seen = useRef(null);
    const [peeks, setPeeks] = useState(() => new Map());
    const [clock, setClock] = useState(0);
    useLayoutEffect(() => {
        if (seen.current === null) {
            seen.current = new Set(list.map(b => b.id));
            return;
        }
        const next = peeksAfter({ banners: list, seen: seen.current, peeks, open, now: Date.now() });
        seen.current = next.seen;
        if (!samePeeks(next.peeks, peeks)) setPeeks(next.peeks);
    }, [list, open, clock]);   // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!peeks.size) return undefined;
        const due = Math.min(...peeks.values()) - Date.now();
        const timer = setTimeout(() => setClock(c => c + 1), Math.max(0, due));
        return () => clearTimeout(timer);
    }, [peeks]);
    return peeks;
}

/**
 * The banners that just went back into the icon (the corner closed, or a pop-out's time was up),
 * still drawn for their lift. Banners that left the list altogether (clicked, cleared) are not
 * among them: those lift on their own or simply go.
 */
function useTucking(out, list) {
    const last = useRef(out);
    const [tucking, setTucking] = useState([]);
    useLayoutEffect(() => {
        const outIds = new Set(out.map(b => b.id));
        const upIds = new Set(list.map(b => b.id));
        const gone = last.current.filter(b => !outIds.has(b.id) && upIds.has(b.id));
        last.current = out;
        if (!gone.length || prefersReducedMotion()) {
            if (tucking.some(b => outIds.has(b.id) || !upIds.has(b.id))) setTucking(t => t.filter(b => !outIds.has(b.id) && upIds.has(b.id)));
            return undefined;
        }
        setTucking(t => [...t.filter(b => !outIds.has(b.id) && upIds.has(b.id) && !gone.some(g => g.id === b.id)), ...gone]);
        const ids = new Set(gone.map(b => b.id));
        const timer = setTimeout(() => setTucking(t => t.filter(b => !ids.has(b.id))), LIFT_MS);
        return () => clearTimeout(timer);
    }, [out, list]);   // eslint-disable-line react-hooks/exhaustive-deps
    return tucking;
}

/**
 * The corner's icon: how many banners wait, red when a problem is among them. A click shows them
 * all or hides them all, and the choice is kept.
 */
const CornerIcon = ({ open, count, problem }) => (
    <PixelFrame
        kind={FRAME_KIND.CHAMFER}
        className="pointer-events-auto shrink-0"
        frameClassName={cn('flex items-center', open && 'brightness-125')}
    >
        <button
            type="button"
            data-banner-corner={open ? 'open' : 'hidden'}
            data-banner-count={count}
            data-banner-problem={problem ? 'true' : undefined}
            title={open ? t('banners.corner.hide') : t('banners.corner.show')}
            aria-pressed={open}
            onClick={() => SettingsManager.set(BANNERS_SHOWN_SETTING, !open)}
            className="flex items-center gap-1 px-1 cursor-pointer font-pixel ui-text-body font-bold"
            style={{ height: ICON_SPRITE_PX, color: problem ? 'var(--color-ui-red)' : 'var(--color-ui-gold)' }}
        >
            <img
                src={problem ? ICON_SRC.problem : ICON_SRC.calm}
                alt=""
                draggable={false}
                width={ICON_SPRITE_PX}
                height={ICON_SPRITE_PX}
                className={cn('select-none pointer-events-none', !count && 'opacity-40 grayscale')}
                style={{ imageRendering: 'pixelated' }}
            />
            {count > 0 && <span data-banner-count-text>{count}</span>}
        </button>
    </PixelFrame>
);

/** @param {{away?: boolean}} props `away`: the World Map or the Guild Hall is the view: only kinds that point to a Token. */
export const BannerStack = memo(function BannerStack({ away = false }) {
    const drawn = useDrawn('notifications');
    useSyncExternalStore(Banners.subscribe, Banners.getVersion);
    const open = useCornerOpen();
    const boxRef = useRef(null);
    const { shown } = Banners.getView();
    const { list, count, problem } = useMemo(() => cornerBanners(shown, away), [shown, away]);
    const peeks = usePeeks(list, open);
    const out = useMemo(() => bannersOut(list, open, peeks), [list, open, peeks]);
    const tucking = useTucking(out, list);
    useSlides(boxRef);
    if (!drawn) return null;
    if (away && !count) return null;
    const drawnOut = [...out, ...tucking.filter(b => !out.some(o => o.id === b.id))];
    return (
        <div className="absolute inset-x-0 bottom-0 pointer-events-none z-30" style={{ top: MAT_TOP_BAR_PX }}>
            <div
                data-banners={away ? 'away' : 'mat'}
                className="absolute right-0 flex flex-col items-end gap-1"
                style={{ top: CORNER_TOP_PX, bottom: CORNER_TOP_PX }}
            >
                <CornerIcon open={open} count={count} problem={problem} />
                {drawnOut.length > 0 && (
                    // Clipped at the top edge, so a banner seems to come out from under the icon.
                    <div className="min-h-0 flex flex-col pointer-events-auto pr-1 pb-1">
                        <ArrowScrollList compact step={160} className="min-h-0 flex flex-col">
                            <div ref={boxRef} data-banners-list className="flex flex-col items-end gap-1.5">
                                {drawnOut.map(b => <Banner key={b.id} banner={b} tucking={!out.includes(b)} />)}
                            </div>
                        </ArrowScrollList>
                    </div>
                )}
            </div>
        </div>
    );
});
