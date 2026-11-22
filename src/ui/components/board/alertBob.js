import { useLayoutEffect } from 'react';
import { onDue } from './frameClock.js';

/**
 * The alert "!"'s bob: over a Token's art or a hero's head it rises two art pixels and sinks
 * again, in whole art-pixel stops, on a slow loop.
 * ⚠️ Written on the shared sprite clock (`onDue`), as floor loot's bob is (`lootBob.js`), never a
 * CSS animation: a keyframed transform gets a composited layer per mark, and everything drawn over
 * it another. Here a mark is plain paint, written only in the frames where its stop changes, and it
 * stops with every other clock while drawing is paused (minimised).
 * Every mark keeps the same phase, so all of them step in the same frames.
 */

/** How high the mark stands at each stop, in art pixels above its rest. */
export const ALERT_BOB_STOPS = Object.freeze([0, 1, 2, 2, 1, 0]);
export const ALERT_BOB_STOP_MS = 250;
export const ALERT_BOB_PERIOD_MS = ALERT_BOB_STOPS.length * ALERT_BOB_STOP_MS;

/** The height, in art pixels, at `now` (`performance.now()` ms). */
export function alertBobAt(now) {
    const into = ((now % ALERT_BOB_PERIOD_MS) + ALERT_BOB_PERIOD_MS) % ALERT_BOB_PERIOD_MS;
    return ALERT_BOB_STOPS[Math.floor(into / ALERT_BOB_STOP_MS)];
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Bob `el` from now on, `unit` mat units an art pixel. With reduced motion it stays at rest and
 * nothing is written.
 * @returns {() => void} stop
 */
export function startAlertBob(el, unit) {
    if (!el || reducedMotion()) return () => {};
    let shown = null;
    const draw = (now) => {
        const height = alertBobAt(now);
        if (height !== shown) {
            shown = height;
            el.style.transform = height ? `translateY(${-height * unit}px)` : '';
        }
        return (Math.floor(now / ALERT_BOB_STOP_MS) + 1) * ALERT_BOB_STOP_MS;
    };
    const stop = onDue(draw, draw(performance.now()));
    return () => {
        stop();
        el.style.transform = '';
    };
}

/** Bob the element in `ref` while `on`. */
export function useAlertBob(ref, unit, on = true) {
    useLayoutEffect(() => (on ? startAlertBob(ref.current, unit) : undefined), [ref, unit, on]);
}
