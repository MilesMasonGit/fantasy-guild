import { onDue } from '../frameClock.js';

/**
 * Held poses written on the shared sprite clock, for what plays all the time on a busy mat.
 * ⚠️ Not `el.animate`. An animation kept on the main thread (`will-change: contents`, as everything
 * among the resting Tokens must be: tailwind.css, at `.gi-token-land`) makes Chrome run a style pass
 * in every frame while it runs, even through the long still part of its loop, and one worked Token
 * is enough to pay it. Written here, a frame where no pose changes costs nothing.
 */

const mod = (a, n) => ((a % n) + n) % n;

/** The transform of a pose: a translate in whole art pixels, in mat units. */
export const poseTransform = (x = 0, y = 0, unit = 1) => `translate(${Math.round(x) * unit}px, ${Math.round(y) * unit}px)`;

/**
 * Loop `poses` on `el` for as long as it runs: each period starts on a beat of `startAt`, plays the
 * poses and rests at home for the remainder. Nothing else writes `transform` on `el` meanwhile.
 * @param {HTMLElement} el
 * @param {Array<{ms: number, x?: number, y?: number}>} poses in art pixels
 * @param {{startAt: number, periodMs: number, unit?: number}} options `startAt` in `performance.now()` ms
 * @returns {() => void} stop: the element goes back to no transform at all
 */
export function loopPoses(el, poses, { startAt, periodMs, unit = 1 }) {
    const moving = (poses || []).filter(p => p && p.ms > 0);
    let shown = null;
    const draw = (now) => {
        const into = mod(now - startAt, periodMs);
        let at = 0;
        let pose = null;
        for (const p of moving) {
            if (into < at + p.ms) { pose = p; break; }
            at += p.ms;
        }
        const css = pose ? poseTransform(pose.x, pose.y, unit) : poseTransform(0, 0, unit);
        if (css !== shown) {
            shown = css;
            el.style.transform = css;
        }
        // The next pose's start; at rest, the next period's.
        return now - into + (pose ? at + pose.ms : periodMs);
    };
    const off = onDue(draw, draw(performance.now()));
    return () => {
        off();
        el.style.transform = '';
    };
}
