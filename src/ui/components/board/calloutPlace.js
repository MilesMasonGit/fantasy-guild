/**
 * Where a quick popup over a Token goes so the mat's edge does not cut it off: a callout, or the
 * carried hero's red reason bubble. Mat units throughout.
 * ⚠️ The mat's box clips: on a window fitted by its height the mat reaches the very top of that
 * box, so a popup over a Token in the top row was drawn wholly or partly outside it.
 */

/** How far a callout's pop drifts up while it can still be read (`callout-pop`, components.css). */
export const CALLOUT_RISE_PX = 6;

/** A first guess at a popup's size before it is measured: one row per line of text. */
const GUESS_CHAR_PX = 6.3;
const GUESS_PAD_PX = 24;
const GUESS_ROW_PX = 26;
const GUESS_GAP_PX = 4;

export function guessCalloutSize(texts) {
    const lines = texts.length || 1;
    const longest = Math.max(0, ...texts.map(t => String(t ?? '').length));
    return { w: longest * GUESS_CHAR_PX + GUESS_PAD_PX, h: lines * GUESS_ROW_PX + (lines - 1) * GUESS_GAP_PX };
}

/**
 * `x`, `top`: where the popup would go, its bottom edge's middle (it grows upward). `w`, `h`: its
 * size. `belowTop`: where its top edge goes when it is said below the Token instead, or null when
 * it may not be. `mat`: `{ w, h }`.
 * Above when it fits, with room for its drift; else below the Token; else held inside the mat's top.
 * Across it is held inside the mat's sides, or centred on the mat when wider than it.
 * @returns {{ x: number, top: number, dx: number, below: boolean }} `top` is still its bottom edge; `dx`
 *   how far it was moved across, for a tail kept over the Token.
 */
export function keepInMat({ x, top, w, h, belowTop = null }, mat, rise = CALLOUT_RISE_PX) {
    const cx = w >= mat.w ? mat.w / 2 : Math.min(Math.max(x, w / 2), mat.w - w / 2);

    let foot = top;
    let below = false;
    if (top - h - rise < 0) {
        if (belowTop != null && belowTop + h <= mat.h) {
            foot = belowTop + h;
            below = true;
        } else {
            foot = Math.min(h + rise, mat.h);
        }
    }
    return { x: cx, top: foot, dx: cx - x, below };
}
