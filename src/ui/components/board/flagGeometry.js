// Fantasy Guild — where a flag is drawn (Free Playmat slice 1.6c, FP-83)

/**
 * Every number about **where a flag sprite sits** on the mat, in one place.
 *
 * ⭐ **A flag stands exactly where it was let go** (FP-83, FP-94): its pole base
 * is the flag's own mat point. Everything else — the gear and the idle chip —
 * is measured from the box {@link flagOrigin} returns.
 *
 * The grid-era fan-out, the "+N" chip and the tile-corner pole (FPP-20) are
 * **gone** with the grid renderer (slice 1.6c-2): flags may overlap freely and
 * never push, nudge or hide each other (FP-83).
 *
 * The owner's flag art is 64×64 and drawn at 2× (FP-77). Measured from
 * `hero_flag_*.png`: the pole leaves the grass tuft at about (20, 58) in the art,
 * the cloth spans x 12–62, y 11–36, and the pole's top is at (10, 1).
 */

/** A flag is drawn at 128 px (FP-77). */
export const FLAG_PX = 128;

/** The pole's base inside the 128 px box (art (20, 58) × 2). */
export const POLE_BASE = Object.freeze({ x: 40, y: 116 });

/** The gear badge (~28 px) at the top-right of the cloth, inside the flag's box. */
export const GEAR_PX = 28;
export const GEAR_OFFSET = Object.freeze({ left: 96, top: 12 });

/** The idle "…" chip, near the top of the pole. */
export const IDLE_CHIP_OFFSET = Object.freeze({ left: 24, top: -6 });

/*
 * Where an idle hero stands beside their flag is `HeroMotion.IDLE_SPOT` since
 * Hero Movement M2 — a place they walk to, not a drawing offset here.
 */

/**
 * ⭐ The top-left of a flag's 128 px box, in mat units: the box placed so the
 * **pole's base stands on the flag's point**.
 *
 * @param {{x:number,y:number}} point the flag's mat point
 */
export function flagOrigin(point) {
    return {
        left: (point?.x ?? 0) - POLE_BASE.x,
        top: (point?.y ?? 0) - POLE_BASE.y
    };
}
