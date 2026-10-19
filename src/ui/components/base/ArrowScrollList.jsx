import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn.js';

/**
 * The one scrolling list (UI_STYLE "Lists and scrolling"): no scrollbar, an arrow bar above
 * and below. An arrow dims at its end of the list but keeps its space, so the list never
 * jumps. A press scrolls `step` pixels smoothly (about two rows: the caller knows its row
 * height), holding keeps scrolling, and the mouse wheel scrolls the box natively.
 *
 * Renders three siblings (bar, list, bar), so the parent should be a flex column; `className`
 * sizes and lays out the list box itself (`flex-1 min-h-0`, `max-h-[75vh]`, padding, gaps).
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

/** A small pixel triangle drawn as whole art pixels (not a vector icon). */
export const PixelTriangle = ({ dir = 'up' }) => {
    const w = TRIANGLE_ROWS[0];
    const h = TRIANGLE_ROWS.length;
    const rows = dir === 'up' ? [...TRIANGLE_ROWS].reverse() : TRIANGLE_ROWS;
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
            {rows.map((len, y) => (
                <rect key={y} x={(w - len) / 2} y={y} width={len} height={1} fill="currentColor" />
            ))}
        </svg>
    );
};

const barClass = (compact) => cn(
    'shrink-0 w-full flex items-center justify-center select-none',
    compact ? 'h-5' : 'h-7',
    'bg-gi-base/60 text-gi-muted hover:text-gi-gold cursor-pointer',
    'disabled:opacity-30 disabled:cursor-default disabled:hover:text-gi-muted'
);

export const ArrowScrollList = ({
    children,
    step = 120,
    className,
    compact = false,
    barClassName,
    listProps
}) => {
    const ref = useRef(null);
    const [ends, setEnds] = useState({ top: true, bottom: true });
    const target = useRef({ top: 0, at: -Infinity });
    const hold = useRef({ delay: null, repeat: null });

    const measure = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const top = el.scrollTop <= 0;
        const bottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        setEnds(prev => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    }, []);

    // Content or box size may have changed since the last paint.
    useEffect(measure);

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
        const max = Math.max(0, el.scrollHeight - el.clientHeight);
        const now = Date.now();
        // Successive smooth scrolls restart from wherever the last one had got to, so aim at
        // where the previous press was heading instead of the current position.
        const from = now - target.current.at < CHAIN_MS ? target.current.top : el.scrollTop;
        const to = Math.min(max, Math.max(0, from + sign * step));
        if (to === from && to === el.scrollTop) return false;
        target.current = { top: to, at: now };
        el.scrollBy({ top: to - el.scrollTop, behavior: 'smooth' });
        return to !== (sign < 0 ? 0 : max);
    }, [step]);

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

    const bar = (dir) => {
        const sign = dir === 'up' ? -1 : 1;
        return (
            <button
                type="button"
                data-scroll-arrow={dir}
                title={dir === 'up' ? 'Scroll up' : 'Scroll down'}
                aria-label={dir === 'up' ? 'Scroll up' : 'Scroll down'}
                disabled={dir === 'up' ? ends.top : ends.bottom}
                onPointerDown={startHold(sign)}
                onPointerLeave={stopHold}
                // A pointer press already scrolled on pointerdown; a click with no pointer
                // (Enter or Space) has detail 0.
                onClick={(e) => { if (e.detail === 0) scrollStep(sign); }}
                className={cn(barClass(compact), barClassName)}
            >
                <PixelTriangle dir={dir} />
            </button>
        );
    };

    return (
        <>
            {bar('up')}
            <div
                {...listProps}
                ref={ref}
                data-scroll-list
                onScroll={measure}
                className={cn('overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden', className)}
            >
                {children}
            </div>
            {bar('down')}
        </>
    );
};

export default ArrowScrollList;
