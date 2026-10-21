import { FX_FRAME_MS, arcPoses, heldPoses, prefersReducedMotion } from '../components/board/fx/pixelSteps.js';
import { afterimages, playIn } from '../components/board/fx/tokenFx.js';
import { spriteOf, makeCopy } from '../components/board/fx/spriteCopy.js';

/**
 * Loot leaving its Token and joining a pile, in whole art pixels and stepped time, like the
 * landing hop (`fx/pixelSteps.js`).
 * ⚠️ The keyframes carry only the flight's offset, never the element's own centring: the sprite
 * centres itself with the CSS `translate` property (Tailwind's `-translate-x-1/2`), which composes
 * with `transform` instead of being replaced by it. Nothing is held after the landing.
 */

/** How long one pose of the hop holds. */
export const HOP_POSE_MS = 40;
/** Poses in the air, from the Token to the spot it lands on. */
export const HOP_POSES = 12;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * The hop as held poses, art pixels from where it lands: a real arc up and over from its Token
 * (higher for a longer throw), the impact, then a one-pixel bounce. Each pose also says how high
 * the item is off the ground there (`lift`), which its shadow takes back.
 * @param {number} fx mat units from the landing spot back to the Token, across
 * @param {number} fy the same, down
 * @param {number} unit mat units per art pixel
 */
export function lootHopPoses(fx, fy, unit = 1) {
    const peak = clamp(Math.round(Math.hypot(fx / unit, fy / unit) / 3), 6, 18);
    return arcPoses(fx, fy, { unit, peak, steps: HOP_POSES, ms: HOP_POSE_MS });
}

/**
 * A dropped item hops out of its Token in an arc and lands with a one-pixel bounce (effect 4). Its
 * hard shadow stays on the ground under it, never rising with it, and two white afterimages trail
 * it through the air.
 * @param {HTMLElement} element the loot sprite's own element (its box)
 * @param {number} fx mat units from the landing spot back to where it came from, across
 * @param {number} fy the same, down
 * @param {{unit?: number}} [options] mat units per art pixel
 * @returns {Animation|null} the hop
 */
export function playLootArc(element, fx, fy, { unit = 1 } = {}) {
    if (!element || typeof element.animate !== 'function' || (fx === 0 && fy === 0)) return null;
    if (prefersReducedMotion()) return null;
    const poses = lootHopPoses(fx, fy, unit);
    const hop = heldPoses(poses.map(({ ms, x, y }) => ({ ms, x, y })), { unit });
    let anim;
    try {
        anim = element.animate(hop.keyframes, { duration: hop.duration, fill: 'none' });
    } catch {
        return null;
    }
    // The shadow keeps to the ground: it takes back the height of each pose.
    const shadow = element.querySelector('[data-sprite-shadow]');
    if (shadow) {
        const ground = heldPoses(poses.map(({ ms, lift }) => ({ ms, x: 0, y: lift })), { unit });
        shadow.animate(ground.keyframes, { duration: ground.duration, fill: 'none' });
    }
    const art = element.querySelector('img')?.parentElement;
    if (art) afterimages(art, poses.slice(0, HOP_POSES).map(({ ms, x, y }) => ({ ms, x, y })), { unit });
    return anim;
}

/** Joining a pile: three steps over, then half the pixels, a quarter, gone. */
const ABSORB_FRAMES = 5;

/**
 * Loot sliding into a matching pile beside it: three whole-pixel steps over to the pile, then a
 * pixel dissolve (half its pixels, a quarter, gone), with no scaling and no fade (the engine takes
 * the sprite away just after).
 * @param {HTMLElement} element the loot sprite's own element
 * @param {number} dx mat units to the pile, across
 * @param {number} dy the same, down
 * @param {{unit?: number}} [options]
 * @returns {Animation|null}
 */
export function playAbsorptionSlide(element, dx, dy, { unit = 1 } = {}) {
    if (!element || typeof element.animate !== 'function') return null;
    if (prefersReducedMotion()) return null;
    const ax = dx / unit;
    const ay = dy / unit;
    const slide = [1, 2, 3, 3, 3].map(n => ({ ms: FX_FRAME_MS, x: (ax * n) / 3, y: (ay * n) / 3, visibility: 'visible' }));
    const box = heldPoses(slide, { unit, rest: { x: ax, y: ay, visibility: 'hidden' } });
    let anim;
    try {
        anim = element.animate(box.keyframes, { duration: box.duration, fill: 'forwards' });
    } catch {
        return null;
    }
    const art = element.querySelector('img')?.parentElement;
    const sprite = spriteOf(art);
    const copies = [[50, 3], [25, 4]].map(([share, frame]) => [makeCopy(sprite, { dither: share }), frame]);
    if (copies.every(([c]) => c)) {
        // What it was drawn with goes as the dissolve starts: the picture, its shadow, its count.
        const gone = heldPoses([{ ms: 3 * FX_FRAME_MS, visibility: 'visible' }, { ms: 2 * FX_FRAME_MS, visibility: 'hidden' }], { rest: { visibility: 'hidden' } });
        for (const el of [...art.children, ...[...element.children].filter(c => !c.contains(art))]) {
            el.animate(gone.keyframes, { duration: gone.duration, fill: 'forwards' });
        }
        for (const [copy, frame] of copies) {
            const shown = Array.from({ length: ABSORB_FRAMES }, (_, i) => ({ ms: FX_FRAME_MS, visibility: i === frame ? 'visible' : 'hidden' }));
            const k = heldPoses(shown, { rest: { visibility: 'hidden' } });
            playIn(art, copy, k.keyframes, { duration: k.duration });
        }
    }
    return anim;
}
