/**
 * Every number about **where a flag sprite sits** on the mat, in one place.
 * A flag stands exactly where it was let go: its pole foot is the flag's own mat point.
 * Flags may overlap freely and never push, nudge or hide each other.
 * Every hero's flag is the one pennant, `u_flag_pennant.png`: 32×32 art drawn at 2×. Measured on
 * its pixels: the pole runs from the top-left corner down to its foot, the art pixel (4, 31); the
 * cloth spans x 5–31, y 3–27 (the pole stands left of it, beside its lower half).
 */

/** The pennant's own art size. */
export const PENNANT_ART_PX = 32;

/** A flag is drawn at 64 px: the pennant at 2×. */
export const FLAG_PX = 64;

/** The pole's foot inside the 64 px box: the centre of art pixel (4, 31), × 2. */
export const POLE_BASE = Object.freeze({ x: 9, y: 63 });

/** The cloth inside the flag's box, as shares of its size (art x 5–31, y 3–27 of 32). */
export const FLAG_CLOTH = Object.freeze({ left: 5 / 32, top: 3 / 32, right: 32 / 32, bottom: 28 / 32 });

/**
 * Where an idle hero stands beside their flag is `HeroMotion.IDLE_SPOT`: a place they walk to,
 * not a drawing offset here.
 */

/**
 * The top-left of a flag's 64 px box, in mat units: the box placed so the **pole's foot
 * stands on the flag's point**.
 * @param {{x:number,y:number}} point the flag's mat point
 */
export function flagOrigin(point) {
    return {
        left: (point?.x ?? 0) - POLE_BASE.x,
        top: (point?.y ?? 0) - POLE_BASE.y
    };
}

/**
 * How far inside a Token's art circle a pinned flag's pole stands, in mat
 * units — just enough that the pole reads as planted in the Token.
 */
export const PIN_INSET = 12;

/**
 * Where a **pinned** flag is drawn: its pole planted at the top of its Token's art circle, so
 * the cloth flies above the Token rather than covering it. The flag's own point is the Token's
 * centre (it follows the Token); this is only where it is drawn.
 * @param {{x:number,y:number}} centre the pinned Token's centre
 * @param {number} artRadius the Token's art radius (`matGeometry.artRadiusOf`)
 */
export function pinnedFlagPoint(centre, artRadius) {
    return { x: centre.x, y: centre.y - Math.max(0, artRadius - PIN_INSET) };
}
