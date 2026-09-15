// Fantasy Guild — where a flag is drawn (Free Playmat slice 1.5b-ii, FPP-20)

import { TILE_PX, tileCentre } from '../../../config/boardGeometry.js';

/**
 * Every number about **where a flag sprite sits** on the board, in one place.
 *
 * ⭐ **Free placement (slices 1.6/1.7) changes only {@link flagOrigin}.**
 * Everything else — the gear, the idle chip, the idle hero, the fan-out — is
 * measured from the box it returns.
 *
 * The owner's flag art is 64×64 and drawn at 2× (FP-77). Measured from
 * `hero_flag_*.png`: the pole leaves the grass tuft at about (20, 58) in the art,
 * the cloth spans x 12–62, y 11–36, and the pole's top is at (10, 1).
 */

/** A flag, and an idle hero, are drawn at 128 px (FP-77). */
export const FLAG_PX = 128;
export const IDLE_HERO_PX = 128;

/** The pole's base inside the 128 px box (art (20, 58) × 2). */
export const POLE_BASE = Object.freeze({ x: 40, y: 116 });

/** How far the pole base is pushed out of the tile, into the gap (FPP-20). */
export const POLE_GAP_PUSH_PX = 8;

/** Each further flag on one tile shifts this far right; earlier flags stay in front. */
export const FLAG_FAN_PX = 20;

/** At most this many flags are drawn on one tile; the rest are counted in a "+N" chip. */
export const MAX_FLAGS_SHOWN = 3;

/** The gear badge (~28 px) at the top-right of the cloth, inside the flag's box. */
export const GEAR_PX = 28;
export const GEAR_OFFSET = Object.freeze({ left: 96, top: 12 });

/** The idle "…" chip, near the top of the pole. */
export const IDLE_CHIP_OFFSET = Object.freeze({ left: 24, top: -6 });

/** The "+N" chip for flags past the third, beside the last one drawn. */
export const MORE_CHIP_OFFSET = Object.freeze({ left: 60, top: 96 });

/**
 * An idle hero stands beside their flag, just right of the pole — on today's
 * grid, over the tile itself (FP-29).
 */
export const IDLE_HERO_OFFSET = Object.freeze({ left: POLE_BASE.x + POLE_GAP_PUSH_PX, top: -20 });

/**
 * ⭐ The top-left of a flag's 128 px box, in board pixels.
 *
 * **On today's grid** the pole's base stands at the **bottom-left corner of the
 * flag's tile**, pushed {@link POLE_GAP_PUSH_PX} into the gap (FPP-20), so the
 * cloth lies over the Token's left side and the charge badge (bottom-right)
 * stays readable. `point` — where the flag really stands — is unused on the
 * grid; free placement will draw from it instead.
 *
 * @param {{x:number,y:number}} point the flag's mat point
 * @param {number} tile the tile that point is on
 */
export function flagOrigin(point, tile) {
    // The tile's corner comes from its centre, so it follows the old landing
    // area's place on the mat (OLD_AREA_ORIGIN, FP-92).
    const centre = tileCentre(tile);
    const poleX = centre.x - TILE_PX / 2 - POLE_GAP_PUSH_PX;
    const poleY = centre.y + TILE_PX / 2 + POLE_GAP_PUSH_PX;
    return { left: poleX - POLE_BASE.x, top: poleY - POLE_BASE.y };
}

/** The box of the `slot`-th flag on a tile: the fan-out, measured from {@link flagOrigin}. */
export function fannedOrigin(point, tile, slot = 0) {
    const { left, top } = flagOrigin(point, tile);
    return { left: left + slot * FLAG_FAN_PX, top };
}
