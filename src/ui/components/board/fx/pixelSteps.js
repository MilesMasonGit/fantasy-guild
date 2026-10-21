/**
 * Motion for pixel art: poses in whole art pixels, each held for its time, then a jump to the next.
 * ⚠️ `steps(1, end)` on every keyframe is the point: a smooth curve between whole-pixel poses
 * spends most of its time at fractional offsets, and pixel art drawn a fraction of a pixel off is
 * resampled soft (tailwind.css, at `.gi-token-land`).
 */

/** How long one effect frame holds: a blink, a chip's hop, a number's rise. */
export const FX_FRAME_MS = 60;

const HOLD = 'steps(1, end)';

/** CSS for a pose: the translate in mat units (`unit` per art pixel), and any other props it carries. */
function poseStyle(pose, unit, props) {
    const out = {
        transform: `translate(${Math.round(pose.x || 0) * unit}px, ${Math.round(pose.y || 0) * unit}px)`
    };
    for (const p of props) if (pose[p] !== undefined) out[p] = pose[p];
    return out;
}

/**
 * Web Animations keyframes for a list of held poses.
 * @param {Array<{ms: number, x?: number, y?: number}>} poses `x`/`y` in art pixels; any other
 *        field (`visibility`, `opacity`) is carried into the keyframe as a CSS property
 * @param {object} [options]
 * @param {number} [options.unit] mat units (CSS px) per art pixel
 * @param {object} [options.rest] the pose after the last one (default: home, as the first pose's props)
 * @returns {{keyframes: Array<object>, duration: number}}
 */
export function heldPoses(poses, { unit = 1, rest = null } = {}) {
    const list = (poses || []).filter(p => p && p.ms > 0);
    const duration = list.reduce((sum, p) => sum + p.ms, 0);
    if (!duration) return { keyframes: [], duration: 0 };
    const props = [...new Set(list.flatMap(p => Object.keys(p)))].filter(k => !['ms', 'x', 'y'].includes(k));
    let t = 0;
    const keyframes = list.map(pose => {
        const k = { offset: t / duration, easing: HOLD, ...poseStyle(pose, unit, props) };
        t += pose.ms;
        return k;
    });
    const home = rest || {};
    const last = { offset: 1, ...poseStyle(home, unit, props) };
    for (const p of props) if (last[p] === undefined) last[p] = list[0][p];
    keyframes.push(last);
    return { keyframes, duration };
}

/**
 * Play held poses on an element. One-shot; nothing is held after the end.
 * @returns {Animation|null} null where the browser cannot animate
 */
export function playPoses(el, poses, { unit = 1, rest = null, delay = 0, fill = 'none' } = {}) {
    if (!el || typeof el.animate !== 'function') return null;
    const { keyframes, duration } = heldPoses(poses, { unit, rest });
    if (!duration) return null;
    return el.animate(keyframes, { duration, delay, fill });
}

/** Whether the player asked for less motion. */
export function prefersReducedMotion() {
    try {
        return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}
