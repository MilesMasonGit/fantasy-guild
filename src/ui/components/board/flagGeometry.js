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

/**
 * The job marker's looks, in the Mat Tuner's order (its "Job marker" row stores the index): the
 * pennant above, or a small flag peeking out from behind the top-left corner of the job's Token,
 * drawn as a Lucide icon or as a pixel glyph. The owner picks one; the others then go.
 */
export const JOB_MARKER_LOOKS = Object.freeze(['pennant', 'lucide', 'pixel']);

/**
 * A small marker's box, in Token art pixels (drawn at the board's art scale): an 8-pixel flag,
 * its dark outline, and room for the white hover line round that, so the box never moves.
 */
export const MARKER_ART_PX = 12;

/**
 * Where a small marker's pole foot sits in its box, as shares of its size: a spot order's marker
 * stands it on the spot, as the pennant does. The pixel glyph's pole is its art column 1, bottom
 * row 7, inside the two-pixel margin; the Lucide icon's is the path's own foot.
 */
export const MARKER_FOOT = Object.freeze({
    lucide: Object.freeze({ x: 9 / 30, y: 25.5 / 30 }),
    pixel: Object.freeze({ x: 3.5 / 12, y: 9.5 / 12 })
});

/** A small marker's cloth for the press rule over Tokens (`flagCloth.js`): its drawn flag, inside the margin. */
export const MARKER_CLOTH = Object.freeze({ left: 2 / 12, top: 2 / 12, right: 10 / 12, bottom: 10 / 12 });

/**
 * How far up and left of the Token's centre a small marker's middle sits, on each axis, as a share
 * of half the Token's drawn art, while its sprite's own corner is not yet known (`markerCorner.js`).
 * Measured on the Token sprites: along the art's top-left diagonal, half of them start within 17
 * of their 64 pixels from the corner, so at 0.55 (15 pixels in) most peek it out.
 */
export const MARKER_CORNER = 0.55;

/**
 * How many art pixels a small marker's middle stands out past where the Token's art begins on its
 * top-left diagonal: the flag peeks out, its lower right tucked behind the art.
 */
export const MARKER_PEEK_PX = 2;

/**
 * How far up and left of a pinned Token's centre a small marker's middle is drawn, on each axis,
 * in mat units: at the top-left corner of the Token's drawn art, `MARKER_PEEK_PX` out past where
 * the sprite begins (`cornerShare`, a share of the art's width from the corner, from its pixels),
 * or by `MARKER_CORNER` while that is not known.
 * @param {number} artSize the Token's drawn art, in mat units
 * @param {number|null|undefined} cornerShare
 * @param {number} artScale mat units per art pixel
 */
export function markerCornerOffset(artSize, cornerShare, artScale) {
    const half = Math.max(0, artSize) / 2;
    if (cornerShare == null) return half * MARKER_CORNER;
    return half - (cornerShare * artSize - MARKER_PEEK_PX * artScale);
}

/** The look's name for a Mat Tuner index (anything unknown reads as the pennant). */
export function jobMarkerLook(index) {
    return JOB_MARKER_LOOKS[Math.round(index)] || 'pennant';
}

/**
 * Where a marker of `look` is drawn and how big, in mat units: its box's top-left and size.
 * @param {string} look one of `JOB_MARKER_LOOKS`
 * @param {{x:number,y:number}} point the flag's own point (a spot) or the pinned Token's centre
 * @param {number|null} artRadius the pinned Token's art radius, or null for a spot
 * @param {number} artScale mat units per art pixel (`boardScaleAt(fit)`)
 * @param {number|null} [cornerOffset] a pinned small marker's `markerCornerOffset`; by default
 * `MARKER_CORNER` of the art drawn for `artRadius`
 */
export function markerBox(look, point, artRadius, artScale, cornerOffset = null) {
    const x = point?.x ?? 0;
    const y = point?.y ?? 0;
    if (look === 'lucide' || look === 'pixel') {
        const size = MARKER_ART_PX * artScale;
        if (artRadius != null) {
            const d = cornerOffset ?? markerCornerOffset(artRadius * artScale, null, artScale);
            return { left: x - d - size / 2, top: y - d - size / 2, size };
        }
        const foot = MARKER_FOOT[look];
        return { left: x - foot.x * size, top: y - foot.y * size, size };
    }
    const size = PENNANT_ART_PX * artScale;
    const s = size / FLAG_PX;
    const p = artRadius != null ? pinnedFlagPoint({ x, y }, artRadius) : { x, y };
    return { left: p.x - POLE_BASE.x * s, top: p.y - POLE_BASE.y * s, size };
}

/** The cloth box of a marker of `look`, as shares of its box. */
export function clothOf(look) {
    return look === 'lucide' || look === 'pixel' ? MARKER_CLOTH : FLAG_CLOTH;
}
