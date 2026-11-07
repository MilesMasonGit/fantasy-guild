import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';

/**
 * The one scrolling list (UI_STYLE "Lists and scrolling"): no scrollbar, and an arrow bar above
 * and below only while the content is taller than the box. `axis="x"` turns it on its side (a row
 * of cards, the Shop): the bars stand left and right, and the parent should be a flex row. Content that fits gets no bars and
 * no empty space for them. While it scrolls, an arrow dims at its end of the list but keeps its
 * space. A press scrolls `step` pixels smoothly (about two rows: the caller knows its row
 * height), holding keeps scrolling, and the mouse wheel scrolls the box natively.
 *
 * Renders up to three siblings (bar, list, bar), so the parent should be a flex column;
 * `className` sizes and lays out the list box itself (`flex-1 min-h-0`, `max-h-[75vh]`, padding,
 * gaps). A list inside a box that grows with its content (a `max-h`) moves down by a bar when the
 * bars arrive.
 */

/** One art pixel of the arrow, in screen pixels: UI sprites draw at 2×. */
const ART_PX = 2;
/** The triangle, widest row first: 7, 5, 3, 1 art pixels. */
const TRIANGLE_ROWS = [7, 5, 3, 1];

/** How long a press must be held before it starts repeating, and how often it then repeats. */
export const HOLD_DELAY_MS = 300;
export const HOLD_REPEAT_MS = 200;
/** A press this soon after the last one carries on from where that one was heading. */
const CHAIN_MS = 450;

/** A small pixel triangle drawn as whole art pixels (not a vector icon), pointing `dir`. */
export const PixelTriangle = ({ dir = 'up' }) => {
    const long = TRIANGLE_ROWS[0];
    const short = TRIANGLE_ROWS.length;
    const sideways = dir === 'left' || dir === 'right';
    const rows = dir === 'up' || dir === 'left' ? [...TRIANGLE_ROWS].reverse() : TRIANGLE_ROWS;
    const w = sideways ? short : long;
    const h = sideways ? long : short;
    return (
        <svg
            data-pixel-triangle={dir}
            width={w * ART_PX}
            height={h * ART_PX}
            viewBox={`0 0 ${w} ${h}`}
            shapeRendering="crispEdges"
            aria-hidden="true"
            className="block"
        >
            {rows.map((len, i) => (sideways
                ? <rect key={i} x={i} y={(long - len) / 2} width={1} height={len} fill="currentColor" />
                : <rect key={i} x={(long - len) / 2} y={i} width={len} height={1} fill="currentColor" />
            ))}
        </svg>
    );
};

/** What each axis reads and writes: vertical lists by default, a row of cards with `axis="x"`. */
const AXES = Object.freeze({
    y: { pos: 'scrollTop', size: 'scrollHeight', client: 'clientHeight', offset: 'offsetHeight', by: 'top', back: 'up', fwd: 'down', overflow: 'overflow-y-auto' },
    x: { pos: 'scrollLeft', size: 'scrollWidth', client: 'clientWidth', offset: 'offsetWidth', by: 'left', back: 'left', fwd: 'right', overflow: 'overflow-x-auto' }
});
const ARROW_TITLE = Object.freeze({ up: 'Scroll up', down: 'Scroll down', left: 'Scroll left', right: 'Scroll right' });

const barClass = (compact, axis) => cn(
    'shrink-0 flex items-center justify-center select-none',
    axis === 'x' ? cn('self-stretch', compact ? 'w-5' : 'w-7') : cn('w-full', compact ? 'h-5' : 'h-7'),
    'bg-gi-base/60 text-gi-muted hover:text-gi-gold cursor-pointer',
    'disabled:opacity-30 disabled:cursor-default disabled:hover:text-gi-muted'
);

/**
 * Whether the content is taller than the box. A `flex-1` list gets the bars' height back when
 * they go and a `max-h` list does not, so inside that margin only taking them out says which:
 * guessing would flip the bars on and off at every measure, or keep them over content that fits.
 * ⚠️ Hidden and restored within this call, so nothing paints without them.
 */
function contentOverflows(el, { up, down }, a = AXES.y) {
    const over = el[a.size] - el[a.client];
    if (over <= 1) return false;
    if (!up || !down || over > up[a.offset] + down[a.offset] + 1) return true;
    up.style.display = 'none';
    down.style.display = 'none';
    const stillOver = el[a.size] - el[a.client] > 1;
    up.style.display = '';
    down.style.display = '';
    return stillOver;
}

export const ArrowScrollList = ({
    children,
    step = 120,
    className,
    compact = false,
    barClassName,
    listProps,
    axis = 'y'
}) => {
    const a = AXES[axis] || AXES.y;
    const ref = useRef(null);
    const [ends, setEnds] = useState({ top: true, bottom: true, scrolls: false });
    const bars = useRef({ up: null, down: null });
    const target = useRef({ top: 0, at: -Infinity });
    const hold = useRef({ delay: null, repeat: null });

    const measure = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const top = el[a.pos] <= 0;
        const bottom = el[a.pos] + el[a.client] >= el[a.size] - 1;
        const scrolls = contentOverflows(el, bars.current, a);
        setEnds(prev => (prev.top === top && prev.bottom === bottom && prev.scrolls === scrolls ? prev : { top, bottom, scrolls }));
    }, [a]);

    // Content or box size may have changed since the last paint. Before the paint, so a list
    // that needs bars never shows a frame without them.
    useLayoutEffect(measure);

    useEffect(() => {
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [measure]);

    // Children that change size without this list re-rendering (a live count, an opened
    // section) still move the ends.
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        for (const child of el.children) ro.observe(child);
        return () => ro.disconnect();
    });

    /** Scrolls one step; false when that end was already reached. */
    const scrollStep = useCallback((sign) => {
        const el = ref.current;
        if (!el) return false;
        const max = Math.max(0, el[a.size] - el[a.client]);
        const now = Date.now();
        // Successive smooth scrolls restart from wherever the last one had got to, so aim at
        // where the previous press was heading instead of the current position.
        const from = now - target.current.at < CHAIN_MS ? target.current.top : el[a.pos];
        const to = Math.min(max, Math.max(0, from + sign * step));
        if (to === from && to === el[a.pos]) return false;
        target.current = { top: to, at: now };
        el.scrollBy({ [a.by]: to - el[a.pos], behavior: 'smooth' });
        return to !== (sign < 0 ? 0 : max);
    }, [step, a]);

    const stopHold = useCallback(() => {
        clearTimeout(hold.current.delay);
        clearInterval(hold.current.repeat);
        hold.current = { delay: null, repeat: null };
    }, []);

    const startHold = (sign) => (e) => {
        if (e.button !== 0) return;
        stopHold();
        if (!scrollStep(sign)) return;
        hold.current.delay = setTimeout(() => {
            hold.current.repeat = setInterval(() => {
                if (!scrollStep(sign)) stopHold();
            }, HOLD_REPEAT_MS);
        }, HOLD_DELAY_MS);
    };

    // The arrow can dim (disabled) under a held pointer, and a disabled button gets no
    // pointerup, so the release is heard on the window.
    useEffect(() => {
        window.addEventListener('pointerup', stopHold);
        window.addEventListener('pointercancel', stopHold);
        window.addEventListener('blur', stopHold);
        return () => {
            stopHold();
            window.removeEventListener('pointerup', stopHold);
            window.removeEventListener('pointercancel', stopHold);
            window.removeEventListener('blur', stopHold);
        };
    }, [stopHold]);

    // `bars.current` keeps the names up and down on both axes: up is the start, down the end.
    const bar = (end) => {
        const sign = end === 'up' ? -1 : 1;
        const dir = end === 'up' ? a.back : a.fwd;
        return (
            <button
                type="button"
                ref={(node) => { bars.current[end] = node; }}
                data-scroll-arrow={dir}
                title={ARROW_TITLE[dir]}
                aria-label={ARROW_TITLE[dir]}
                disabled={end === 'up' ? ends.top : ends.bottom}
                onPointerDown={startHold(sign)}
                onPointerLeave={stopHold}
                // A pointer press already scrolled on pointerdown; a click with no pointer
                // (Enter or Space) has detail 0.
                onClick={(e) => { if (e.detail === 0) scrollStep(sign); }}
                className={cn(barClass(compact, axis), barClassName)}
            >
                <PixelTriangle dir={dir} />
            </button>
        );
    };

    return (
        <>
            {ends.scrolls && bar('up')}
            <div
                {...listProps}
                ref={ref}
                data-scroll-list
                onScroll={measure}
                className={cn(a.overflow, '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden', className)}
            >
                {children}
            </div>
            {ends.scrolls && bar('down')}
        </>
    );
};

export default ArrowScrollList;
