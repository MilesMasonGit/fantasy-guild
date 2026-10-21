import { FX_FRAME_MS, heldPoses } from './pixelSteps.js';
import { spriteOf, makeCopy } from './spriteCopy.js';
import { onDue } from '../frameClock.js';
import { outlineLayer } from '../../../utils/spriteFx.js';

/**
 * Effects played on one Token's art, inside its hit wrapper (`TokenHitArt`), so they move with
 * the art and stand at the Token's own place in the mat's stack. Each puts its elements in when
 * it starts and takes them away when it ends: a Token at rest carries nothing. No React state:
 * the elements are written straight to the page, as the sprite clocks do.
 */

/**
 * Put `el` in `wrapper`, over the sprite or `under` it, play `keyframes`, and take it away at the
 * end (or if it is cancelled).
 * @returns {Animation|null}
 */
export function playIn(wrapper, el, keyframes, timing, { under = false } = {}) {
    if (!wrapper || !el) return null;
    if (under) wrapper.insertBefore(el, wrapper.firstChild);
    else wrapper.appendChild(el);
    if (typeof el.animate !== 'function') {
        el.remove();
        return null;
    }
    const anim = el.animate(keyframes, { fill: 'none', ...timing });
    const done = () => el.remove();
    anim.onfinish = done;
    anim.oncancel = done;
    return anim;
}

/**
 * Run `fn` once, in the first frame `ms` from now, on the mat's shared clock (`frameClock.js`).
 * For an effect that has to read the art as it is then (a sheet's frame at the strike).
 * @returns {() => void} cancel
 */
export function later(ms, fn) {
    let off = null;
    const run = () => {
        off?.();
        off = null;
        fn();
        return Infinity;
    };
    off = onDue(run, performance.now() + Math.max(0, ms));
    return () => { off?.(); off = null; };
}

const SHOWN = Object.freeze([{ visibility: 'visible' }, { visibility: 'visible' }]);

/**
 * Colour flash: the sprite in one solid colour for `frames` effect frames, from `delay` ms.
 * @returns {Animation|null}
 */
export function flashTint(wrapper, tint, { frames = 2, delay = 0 } = {}) {
    const copy = makeCopy(spriteOf(wrapper), { tint });
    if (!copy) return null;
    return playIn(wrapper, copy, SHOWN, { duration: frames * FX_FRAME_MS, delay });
}

/**
 * Afterimage trail: `count` tinted copies under the sprite, each where the art was `k` poses
 * before, while the art plays `poses` (art pixels, as `heldPoses` takes them). The oldest copy goes
 * first; the last one is gone as the art comes home.
 * @returns {Animation[]}
 */
export function afterimages(wrapper, poses, { unit = 1, delay = 0, tint = 'white', count = 2 } = {}) {
    const sprite = spriteOf(wrapper);
    if (!sprite || !poses?.length) return [];
    const out = [];
    for (let k = count; k >= 1; k--) {
        const trail = poses.map((pose, i) => {
            const was = i - k >= 0 ? poses[i - k] : { x: 0, y: 0 };
            // Shown from the k-th pose on; the older copies leave first, one pose apart.
            const shown = i >= k && i < poses.length - (k - 1);
            return {
                ms: pose.ms,
                x: (was.x || 0) - (pose.x || 0),
                y: (was.y || 0) - (pose.y || 0),
                visibility: shown ? 'visible' : 'hidden'
            };
        });
        const { keyframes, duration } = heldPoses(trail, { unit, rest: { visibility: 'hidden' } });
        const copy = makeCopy(sprite, { tint });
        const anim = copy ? playIn(wrapper, copy, keyframes, { duration, delay }, { under: true }) : null;
        if (anim) out.push(anim);
    }
    return out;
}

/**
 * A copy of a still sprite's outline in `colour` (`OUTLINE_COLOURS`), centred where its own ring
 * is drawn, hidden until an animation shows it. Null for a sheet or a sprite with no outlines.
 */
function makeRingCopy(sprite, colour) {
    if (!sprite || sprite.sheet || typeof document === 'undefined') return null;
    const ring = outlineLayer(sprite.src, sprite.size, colour);
    if (!ring) return null;
    const across = sprite.size + 2 * ring.pad;
    const el = document.createElement('span');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-fx-ring', colour);
    Object.assign(el.style, {
        position: 'absolute',
        inset: '0px',
        margin: 'auto',
        width: `${across}px`,
        height: `${across}px`,
        backgroundImage: `url("${ring.url}")`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        pointerEvents: 'none',
        visibility: 'hidden',
        willChange: 'contents'
    });
    return el;
}

/**
 * The outline turns `colour` for `frames` effect frames: a cycle finishing (white over the green
 * for one), a Token that has just become another (white for three).
 * @returns {Animation|null}
 */
export function ringBlink(wrapper, colour, { frames = 1 } = {}) {
    const el = makeRingCopy(spriteOf(wrapper), colour);
    if (!el) return null;
    return playIn(wrapper, el, SHOWN, { duration: frames * FX_FRAME_MS });
}

const ECHO_DIRS = Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]]);

/**
 * Echo ring: the outline copied 1, 2 and then 3 art pixels out, up, right, down and left, one
 * effect frame each, behind the art: a pulse without any scaling. A rule firing on the Token.
 * @returns {Animation[]}
 */
export function echoRing(wrapper, colour = 'hover', { unit = 1 } = {}) {
    const sprite = spriteOf(wrapper);
    const out = [];
    for (const [dx, dy] of ECHO_DIRS) {
        const el = makeRingCopy(sprite, colour);
        if (!el) return out;
        const poses = [1, 2, 3].map(n => ({ ms: FX_FRAME_MS, x: dx * n, y: dy * n, visibility: 'visible' }));
        const { keyframes, duration } = heldPoses(poses, { unit, rest: { visibility: 'hidden' } });
        // Under the art: where a shifted ring crosses the sprite, the sprite stays in front.
        const anim = playIn(wrapper, el, keyframes, { duration }, { under: true });
        if (anim) out.push(anim);
    }
    return out;
}
