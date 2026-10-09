
/**
 * Every number about **where a flag sprite sits** on the mat, in one place.
 * A flag stands exactly where it was let go: its pole base is the flag's own mat point.
 * Flags may overlap freely and never push, nudge or hide each other.
 * The flag art is 64×64 and drawn at 2×. Measured from `hero_flag_*.png`: the pole leaves the
 * grass tuft at about (20, 58) in the art, the cloth spans x 12–62, y 11–36, and the pole's
 * top is at (10, 1).
 */

/** A flag is drawn at 128 px. */
export const FLAG_PX = 128;

/** The pole's base inside the 128 px box (art (20, 58) × 2). */
export const POLE_BASE = Object.freeze({ x: 40, y: 116 });

/** The cloth inside the flag's box, as shares of its size (art x 12–62, y 11–36 of 64). */
export const FLAG_CLOTH = Object.freeze({ left: 12 / 64, top: 11 / 64, right: 62 / 64, bottom: 36 / 64 });

/**
 * Where an idle hero stands beside their flag is `HeroMotion.IDLE_SPOT`: a place they walk to,
 * not a drawing offset here.
 */

/**
 * The top-left of a flag's 128 px box, in mat units: the box placed so the **pole's base
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
