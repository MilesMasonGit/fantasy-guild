import { useEffect } from 'react';
import { onDue } from '../frameClock.js';
import { prefersReducedMotion } from './pixelSteps.js';

/**
 * Where a repeating pulse stands `t` ms after it began: the held pose (`x`/`y` in art pixels, as
 * `pixelSteps.js`), and how many ms from its start the next change falls. The poses play at the
 * start of every `everyMs`; between them the mark rests at home.
 * @param {Array<{ms: number, x?: number, y?: number}>} poses
 * @param {number} everyMs
 * @param {number} t
 * @returns {{x: number, y: number, next: number}}
 */
export function pulsePoseAt(poses, everyMs, t) {
    const every = Math.max(1, everyMs);
    const cycle = Math.floor(Math.max(0, t) / every);
    const base = cycle * every;
    let at = base;
    for (const p of poses) {
        if (!(p.ms > 0)) continue;
        if (t < at + p.ms && at + p.ms <= base + every) {
            return { x: Math.round(p.x || 0), y: Math.round(p.y || 0), next: at + p.ms };
        }
        at += p.ms;
    }
    return { x: 0, y: 0, next: base + every };
}

/**
 * Pulses the element in `ref` with `poses` every `everyMs` while `active`: a CSS translate of whole
 * art pixels (`unit` mat units each), written straight onto the element at each change of pose.
 * It runs on the frame clock's due times (`onDue`): one timer between poses and no frame at rest,
 * nothing while drawing is paused, and none at all for a player who asked for less motion.
 * Inactive, the element is back home.
 * @param {{current: HTMLElement|null}} ref
 * @param {boolean} active
 * @param {{poses: Array<{ms: number, x?: number, y?: number}>, everyMs: number, unit?: number}} options
 */
export function usePosePulse(ref, active, { poses, everyMs, unit = 1 }) {
    useEffect(() => {
        const el = ref.current;
        if (!active || !el || prefersReducedMotion()) return undefined;
        const start = performance.now();
        let drawn = '';
        const step = (now) => {
            const pose = pulsePoseAt(poses, everyMs, now - start);
            const transform = pose.x || pose.y ? `translate(${pose.x * unit}px, ${pose.y * unit}px)` : '';
            if (transform !== drawn) {
                drawn = transform;
                el.style.transform = transform;
            }
            return start + pose.next;
        };
        const stop = onDue(step, start);
        return () => {
            stop();
            el.style.transform = '';
        };
    }, [ref, active, poses, everyMs, unit]);
}
