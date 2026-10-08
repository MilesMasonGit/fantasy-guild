import { HERO_HIT_PX } from './boardConstants.js';
import { FLAG_PX } from './flagGeometry.js';

/** A health bar's fill colour. */
export const HP_COLOUR = '#F09595';

/** How thick a health bar is, in mat units. */
export const HEALTH_BAR_H_U = 11;

/** The gap between a health bar and the figure it hangs over, in mat units. */
export const HEALTH_BAR_GAP_U = 3;

/** How much a Token's name is raised so it clears the bar over an enemy. */
export const HEALTH_BAR_LIFT_U = HEALTH_BAR_H_U + HEALTH_BAR_GAP_U;

/** How wide a health bar is over a Token's box and over a hero, in mat units. */
export const ENEMY_BAR_W_FRACTION = 0.6;
export const HERO_BAR_W_U = 44;

/** How full the bar is, 0 to 1. */
export function healthFraction(cur, max) {
    if (!(max > 0)) return 0;
    return Math.max(0, Math.min(1, cur / max));
}

/** The exact number drawn on a bar: `34/50`, never below 0. */
export function healthText(cur, max) {
    const c = Math.max(0, Math.round(Number(cur) || 0));
    return `${c.toLocaleString()}/${Math.round(Number(max) || 0).toLocaleString()}`;
}

/**
 * Where a bar sits over a hero's box (`HERO_HIT_PX` × `FLAG_PX`, the art centred in it, `artPx`
 * across): centred, its bottom a gap above the top of the art.
 * @returns {{left: number, top: number, width: number}}
 */
export function heroBarPlace(artPx) {
    return {
        left: (HERO_HIT_PX - HERO_BAR_W_U) / 2,
        top: (FLAG_PX - artPx) / 2 - HEALTH_BAR_H_U - HEALTH_BAR_GAP_U,
        width: HERO_BAR_W_U
    };
}

/**
 * Where a bar sits over an enemy Token's box: centred, its bottom a gap above the box's top.
 * @returns {{left: number, top: number, width: number}}
 */
export function enemyBarPlace(boxPx) {
    const width = Math.round(boxPx * ENEMY_BAR_W_FRACTION);
    return { left: (boxPx - width) / 2, top: -(HEALTH_BAR_H_U + HEALTH_BAR_GAP_U), width };
}
