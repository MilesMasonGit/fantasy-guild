import { HERO_HIT_PX } from './boardConstants.js';
import { FLAG_PX } from './flagGeometry.js';

/** A health bar's fill colour, its track and its edge. */
export const HP_COLOUR = '#F09595';
export const HP_TRACK = 'rgba(10, 8, 6, 0.85)';
export const HP_EDGE = '#0d0a08';

/**
 * The bar's measures in plate pixels (one screen pixel at the mat's 2× art, `workPlate.plateUnit`):
 * a thin bar 3 art pixels tall with a 1-art-pixel black edge, the number written above it.
 */
export const HP_BAR = Object.freeze({
    /** The bar's width over a fighter, and its thickness. */
    W: 64,
    H: 6,
    /** Its hard edge, all round. */
    EDGE: 2,
    /** Between the number and the bar, and between the bar and the art under it. */
    LABEL_GAP: 4,
    GAP: 3,
    /** The fill moves in whole art pixels: 32 steps. */
    STEP: 2
});

/** How full the bar is, 0 to 1. */
export function healthFraction(cur, max) {
    if (!(max > 0)) return 0;
    return Math.max(0, Math.min(1, cur / max));
}

/** A percentage, rounded halves up (the combat rounding rule), never below 0. */
export function healthPercent(cur, max) {
    if (!(max > 0)) return 0;
    return Math.floor((Math.max(0, Number(cur) || 0) / max) * 100 + 0.5);
}

/** What a bar says: the number and the percentage, `17 · 57%`, whole, never below 0. */
export function healthText(cur, max) {
    const c = Math.max(0, Math.round(Number(cur) || 0));
    return `${c.toLocaleString()} · ${healthPercent(cur, max)}%`;
}

/** The fill's width in plate pixels: the fraction cut to whole art pixels. */
export function healthFillPx(cur, max, w = HP_BAR.W) {
    return Math.round(healthFraction(cur, max) * (w / HP_BAR.STEP)) * HP_BAR.STEP;
}

/**
 * Where a bar sits over a hero's box (`HERO_HIT_PX` × `FLAG_PX`, the art centred in it, `artPx`
 * across), `u` mat units a plate pixel: centred, its bottom a gap above the top of the art. The
 * number stands above it.
 * @returns {{left: number, top: number, width: number}}
 */
export function heroBarPlace(artPx, u = 1) {
    const width = HP_BAR.W * u;
    return {
        left: (HERO_HIT_PX - width) / 2,
        top: (FLAG_PX - artPx) / 2 - (HP_BAR.H + HP_BAR.GAP) * u,
        width
    };
}

/**
 * Where a bar sits over an enemy Token's box: centred, its bottom a gap above the box's top.
 * @returns {{left: number, top: number, width: number}}
 */
export function enemyBarPlace(boxPx, u = 1) {
    const width = HP_BAR.W * u;
    return { left: (boxPx - width) / 2, top: -(HP_BAR.H + HP_BAR.GAP) * u, width };
}
