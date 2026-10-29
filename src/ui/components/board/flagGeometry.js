/**
 * Every number about **where a hero's job flag sits** on the mat, in one place.
 * The flag is Lucide's `FlagTriangleRight` (`FlagMark`), in each hero's colour, in a box of
 * {@link MARKER_ART_PX} Token art pixels. On a Token order it peeks out from behind the top-left
 * corner of the Token's art; on a spot order its pole foot stands on the spot. Flags may overlap
 * freely and never push, nudge or hide each other.
 * Where an idle hero stands beside their flag is `HeroMotion.IDLE_SPOT`: a place they walk to,
 * not a drawing offset here.
 */

/**
 * The flag's box, in Token art pixels (drawn at the board's art scale): the icon with its dark
 * edge, and room for the white hover line round that, so the box never moves. 24 px at the mat's
 * usual size.
 */
export const MARKER_ART_PX = 12;

/**
 * Where the flag's pole foot sits in its box, as shares of its size: the icon's own foot, (6, 22)
 * of its 24 units, in a 30-unit view with 3 of margin. A spot order's flag stands it on the spot,
 * and the carried flag holds it on the pointer.
 */
export const MARKER_FOOT = Object.freeze({ x: 9 / 30, y: 25.5 / 30 });

/** The flag's cloth, for the press rule over Tokens (`flagCloth.js`): its drawn flag, inside the margin. */
export const MARKER_CLOTH = Object.freeze({ left: 2 / 12, top: 2 / 12, right: 10 / 12, bottom: 10 / 12 });

/**
 * How far up and left of the Token's centre the flag's middle sits, on each axis, as a share
 * of half the Token's drawn art, while its sprite's own corner is not yet known (`markerCorner.js`).
 * Measured on the Token sprites: along the art's top-left diagonal, half of them start within 17
 * of their 64 pixels from the corner, so at 0.55 (15 pixels in) most peek it out.
 */
export const MARKER_CORNER = 0.55;

/**
 * How many art pixels the flag's middle stands out past where the Token's art begins on its
 * top-left diagonal: the flag peeks out, its lower right tucked behind the art.
 */
export const MARKER_PEEK_PX = 2;

/**
 * How far up and left of a pinned Token's centre the flag's middle is drawn, on each axis,
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

/**
 * How far apart, in Token art pixels along the art's edge, the flags of several heroes ordered onto
 * one Token stand: a little under a flag's width, so each colour shows and each peeks out to be
 * picked up.
 */
export const MARKER_FAN_ART_PX = 9;

/**
 * Which step along the art's edge the `rank`-th flag on a shared Token takes (ranked by roster
 * order): the first stays on the corner, then one step towards the top, one towards the left, two
 * towards the top, and so on.
 */
export function fanStep(rank) {
    if (!(rank > 0)) return 0;
    const n = Math.ceil(rank / 2);
    return rank % 2 === 1 ? n : -n;
}

/**
 * Where the flag is drawn and how big, in mat units: its box's top-left and size.
 * @param {{x:number,y:number}} point the flag's own point (a spot) or the pinned Token's centre
 * @param {number|null} artRadius the pinned Token's art radius, or null for a spot
 * @param {number} artScale mat units per art pixel (`boardScaleAt(fit)`)
 * @param {number|null} [cornerOffset] a pinned flag's `markerCornerOffset`; by default
 * `MARKER_CORNER` of the art drawn for `artRadius`
 * @param {number} [fan] a pinned flag's `fanStep`: it moves that many `MARKER_FAN_ART_PX` round the
 * Token's centre at the corner's distance (positive towards the top, negative towards the left)
 */
export function markerBox(point, artRadius, artScale, cornerOffset = null, fan = 0) {
    const x = point?.x ?? 0;
    const y = point?.y ?? 0;
    const size = MARKER_ART_PX * artScale;
    if (artRadius != null) {
        const d = cornerOffset ?? markerCornerOffset(artRadius * artScale, null, artScale);
        if (!fan || !(d > 0)) return { left: x - d - size / 2, top: y - d - size / 2, size };
        const r = d * Math.SQRT2;
        const angle = -0.75 * Math.PI + (fan * MARKER_FAN_ART_PX * artScale) / r;
        return { left: x + r * Math.cos(angle) - size / 2, top: y + r * Math.sin(angle) - size / 2, size };
    }
    return { left: x - MARKER_FOOT.x * size, top: y - MARKER_FOOT.y * size, size };
}
