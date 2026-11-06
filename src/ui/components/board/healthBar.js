import { HERO_HIT_PX, HERO_BOX_PX } from './boardConstants.js';

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
 * The mat's fighter bar in plate pixels (one screen pixel at the mat's 2× art, `workPlate.plateUnit`):
 * a small edition of the hero bar's `VitalBar`, its fill on a stepped black edge with the numbers
 * written on it. The fight panel keeps the thin `HP_BAR`.
 */
export const MAT_BAR = Object.freeze({
    W: 64,
    H: 14,
    /** The black edge, all round, inside the bar's box. */
    EDGE: 2,
    /** Between the bar and the top of the art under it. */
    GAP: 3,
    /** The fill moves in whole art pixels. */
    STEP: 2
});

/** What a mat bar says: `19/24`, whole, never below 0, with separators. */
export function matHealthText(cur, max) {
    const c = Math.max(0, Math.round(Number(cur) || 0));
    const m = Math.max(0, Math.round(Number(max) || 0));
    return `${c.toLocaleString('en-US')}/${m.toLocaleString('en-US')}`;
}

/**
 * Where a bar sits over a hero's box (`HERO_HIT_PX` × `HERO_BOX_PX`, the art centred in it, `artPx`
 * across), `u` mat units a plate pixel: centred, its bottom a gap above the top of the art.
 * @returns {{left: number, top: number, width: number}}
 */
export function heroBarPlace(artPx, u = 1) {
    const width = MAT_BAR.W * u;
    return {
        left: (HERO_HIT_PX - width) / 2,
        top: (HERO_BOX_PX - artPx) / 2 - (MAT_BAR.H + MAT_BAR.GAP) * u,
        width
    };
}

/**
 * Where a bar sits over an enemy Token's box: centred, its bottom a gap above the box's top.
 * @returns {{left: number, top: number, width: number}}
 */
export function enemyBarPlace(boxPx, u = 1) {
    const width = MAT_BAR.W * u;
    return { left: (boxPx - width) / 2, top: -(MAT_BAR.H + MAT_BAR.GAP) * u, width };
}

/**
 * The fight button's measures in plate pixels: the 8 × 8 fight glyph at 2× in the chamfer frame,
 * standing between the two fighters' bars, `GAP` clear of each.
 */
export const CHIP = Object.freeze({ GLYPH: 16, PAD: 2, BAND: 6, GAP: 4 });
export const CHIP_PX = CHIP.GLYPH + 2 * (CHIP.PAD + CHIP.BAND);

/**
 * How far a fighter's bar moves outward, away from the other fighter, in mat units, so the fight
 * button fits between the two bars: none while the fighters stand far enough apart (`apart`, the
 * distance between their centres in mat units), else just enough.
 */
export function fightBarShift(apart, u = 1) {
    const d = Math.abs(Number(apart) || 0);
    const need = (MAT_BAR.W / 2 + CHIP.GAP + CHIP_PX / 2) * u;
    return Math.max(0, need - d / 2);
}

/**
 * Where the fight button stands, in mat units: halfway between the fighters, its middle on the
 * lower of the two bars' middles (a boss's bar rides higher; the button stays on the hero's line).
 * `heroArtTop` and `enemyBoxTop` are the tops of the hero's art and the enemy's box. Whole screen
 * pixels at `fit`.
 * @returns {{left: number, top: number, size: number, unit: number}}
 */
export function fightButtonPlace({ heroX, enemyX, heroArtTop, enemyBoxTop, u = 1, fit = 1 }) {
    const mid = (MAT_BAR.GAP + MAT_BAR.H / 2) * u;
    const y = Math.max(heroArtTop - mid, enemyBoxTop - mid);
    const size = CHIP_PX * u;
    const snap = (v) => Math.round(v * fit) / fit;
    return { left: snap((heroX + enemyX) / 2 - size / 2), top: snap(y - size / 2), size, unit: u };
}

/**
 * How far over the top of a fighter's art its fight reaches, in mat units (`u` a plate pixel): the
 * bar with its numbers on it, and the fight button between the bars, whose middle is on the bar's.
 * Speech, callouts and "used" bubbles over a fighter go above this (owner, 2026-10-25: nothing
 * covers the number).
 */
export function fightReach(u = 1) {
    return (MAT_BAR.GAP + Math.max(MAT_BAR.H, MAT_BAR.H / 2 + CHIP_PX / 2)) * u;
}

/**
 * The y something said over a fighter rests its foot on: `y` where that is already clear of the
 * fight over `artTop` (the top of the fighter's art), else `gap` above the fight's reach.
 */
export function clearOfFight(y, artTop, u = 1, gap = 0) {
    return Math.min(y, artTop - fightReach(u) - gap);
}
