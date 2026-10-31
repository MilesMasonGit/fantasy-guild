import { TICK_INTERVAL_MS } from '../../../config/loopConstants.js';

/**
 * The transition for a walking enemy's one-tick glide over `(dx, dy)` mat units, at `pxPerUnit`
 * screen pixels a mat unit: one jump per screen pixel of the longer axis, never a smooth slide.
 * ⚠️ Its boxes are painted on the main thread (`will-change: contents`, the crisp-pixel rule at
 * `.gi-token-land` in tailwind.css), and a smooth glide there made Chrome re-layerize and repaint
 * on every frame while any enemy walked. Pixel art painted there lands on whole pixels anyway, so
 * jumping a pixel at a time shows the same moves while Chrome draws only the frames that move.
 * `start`, not `end`: the last jump lands a jump before the tick is over, so a next step that
 * arrives a frame early does not cut it off and leave the box a pixel behind (with one jump, it
 * would never move at all).
 * A step of a pixel or less simply lands: `'none'`.
 */
export function walkerGlide(dx, dy, pxPerUnit, ms = TICK_INTERVAL_MS) {
    // The small allowance keeps a float a hair over a whole pixel from counting one jump more.
    const jumps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * pxPerUnit - 1e-6);
    return jumps > 1 ? `transform ${ms}ms steps(${jumps}, start)` : 'none';
}
