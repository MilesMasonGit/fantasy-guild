import { boardScaleAt } from '../base/TokenSprite.jsx';

/** Limes's art: `e_slurm.png`, 32 px. */
export const LIMES_SRC = '/assets/enemies/slime/e_slurm.png';
export const LIMES_ART_PX = 32;

/**
 * Limes's pixels are twice a Token's (the owner's pick): about one Token wide on the mat. The same
 * whole-step scale the mat's sprites use (`boardScaleAt`), doubled, so it lands on whole screen
 * pixels at every fit.
 */
export const LIMES_SCALE = 2;

/** How far Limes's corner spot stands in from the mat's left and bottom edges, in mat units. */
export const LIMES_CORNER_GAP = 40;

/** Limes's drawn size on the mat at a mat fit, in mat units. */
export function limesSizeAt(fit = 1) {
    return LIMES_ART_PX * LIMES_SCALE * boardScaleAt(fit);
}

/** Limes's middle, kept wholly on the mat. */
export function clampLimesSpot(spot, size, mat) {
    const half = size / 2;
    const clamp = (v, lo, hi) => (hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
    return { x: clamp(spot.x, half, mat.w - half), y: clamp(spot.y, half, mat.h - half) };
}

/** Where Limes stands until the player moves it: the mat's bottom-left corner. */
export function limesCornerSpot(size, mat) {
    return clampLimesSpot({ x: LIMES_CORNER_GAP + size / 2, y: mat.h - LIMES_CORNER_GAP - size / 2 }, size, mat);
}

/** Limes's middle on this mat: where the player left it, or its corner. */
export function limesSpotOn(saved, size, mat) {
    return saved ? clampLimesSpot(saved, size, mat) : limesCornerSpot(size, mat);
}

/**
 * Where the bubble's box goes over Limes, in screen pixels from Limes's middle: centred over it,
 * but kept within the mat's sides, and where its tail meets it.
 * @param {number} x Limes's middle, mat units
 * @param {number} boxPx the bubble's width, screen pixels
 * @param {number} matW the mat's width, mat units
 * @param {number} fit screen pixels per mat unit
 * @returns {{ left: number, tail: number }} the box's left edge from Limes's middle, and the tail's
 *   distance from the box's left edge, both screen pixels
 */
export function bubbleAcross(x, boxPx, matW, fit, tailInsetPx = 0) {
    const xPx = x * fit;
    const wPx = matW * fit;
    let left = Math.round(xPx - boxPx / 2);
    left = Math.max(0, Math.min(left, Math.round(wPx - boxPx)));
    const tail = Math.max(tailInsetPx, Math.min(boxPx - tailInsetPx, xPx - left));
    return { left: left - xPx, tail };
}
