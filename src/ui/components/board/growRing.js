// The animated ring: grows out from its centre to its radius, shrinks back to it when it goes.

import { useLayoutEffect, useRef, useState } from 'react';
import { onFrame, isDrawingPaused } from './frameClock.js';
import { prefersReducedMotion } from './fx/pixelSteps.js';

/** How long the ring takes to grow from nothing to its full radius (and to shrink back). */
export const RING_GROW_MS = 250;

/**
 * A grow or shrink from `fromPx` to `toPx` art pixels, starting at `now` (ms). It runs at the speed
 * that takes a ring of `fullPx` from nothing to full in {@link RING_GROW_MS}, so a ring that stops
 * halfway shrinks back in half the time.
 * @returns {{from: number, to: number, at: number, ms: number}}
 */
export function ringTween(fromPx, toPx, fullPx, now) {
    const span = Math.abs(toPx - fromPx);
    const ms = fullPx > 0 ? RING_GROW_MS * Math.min(1, span / fullPx) : 0;
    return { from: fromPx, to: toPx, at: now, ms };
}

/** The tween's radius at `now`, in whole art pixels. */
export function ringPxAt(tween, now) {
    if (!tween.ms || now >= tween.at + tween.ms) return tween.to;
    const k = Math.max(0, (now - tween.at) / tween.ms);
    return Math.round(tween.from + (tween.to - tween.from) * k);
}

/**
 * A ring that grows and shrinks. `target` is `{ x, y, r, key? }` in mat units, or null for none;
 * `artScale` is mat units per art pixel. Returns what to draw now, or null once nothing is left:
 * `{ x, y, r, px, radius, settled, key }`, `px` the radius in whole art pixels (0 on the first
 * frame of a grow), `radius` the same in mat units (what a mark inside compares its distance
 * with), `r` and `key` the target's, `settled` once it has grown to `r`.
 * * A target appearing grows from nothing; one going (null) shrinks from wherever it is, its
 * centre held. A new `key` (another Token's ring) grows again from nothing; the same key moving
 * (a drag's landing) just follows, with no regrow.
 * * Nothing runs at rest: the frame clock is subscribed only while the radius is changing. While
 * drawing is paused (or the player asked for less motion) it jumps straight to the end, and a ring
 * caught mid-grow by a pause finishes on the first frame back.
 */
export function useGrowRing(target, artScale) {
    const goal = target ? Math.max(1, Math.round(target.r / artScale)) : 0;
    const key = target ? (target.key ?? '') : null;
    const [px, setPx] = useState(0);
    const live = useRef({ px: 0, goal: 0, full: 0, lastKey: null, last: null });
    if (target) live.current.last = target;

    useLayoutEffect(() => {
        const s = live.current;
        const restart = key !== null && s.lastKey !== null && key !== s.lastKey && s.px > 0;
        // A settled ring that only changes size (the mat's fit, a tuner) is not a grow.
        const resize = !restart && goal > 0 && s.goal > 0 && s.px === s.goal;
        if (key !== null) s.lastKey = key;
        s.goal = goal;
        if (goal) s.full = goal;
        const from = restart ? 0 : s.px;
        if (from === goal || resize || isDrawingPaused() || prefersReducedMotion()) {
            s.px = goal;
            setPx(goal);
            return undefined;
        }
        s.px = from;
        setPx(from);
        const tween = ringTween(from, goal, s.full, performance.now());
        let stop = null;
        // `performance.now()`, not the frame's own timestamp: the tween started on it, and a frame's
        // timestamp need not share its origin (jsdom's does not).
        const step = () => {
            s.px = ringPxAt(tween, performance.now());
            setPx(s.px);
            if (s.px === tween.to && stop) {
                stop();
                stop = null;
            }
        };
        stop = onFrame(step);
        return () => {
            if (stop) stop();
            stop = null;
        };
    }, [goal, key]);

    const at = target || live.current.last;
    if (!at || (!target && px === 0)) return null;
    return {
        x: at.x,
        y: at.y,
        r: at.r,
        key: at.key ?? '',
        px,
        radius: px * artScale,
        settled: goal > 0 && px === goal
    };
}
