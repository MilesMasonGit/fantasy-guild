/**
 * Every number about **where a hero's job flag sits** on the mat, in one place.
 * The flag is Lucide's `FlagTriangleRight` (`FlagMark`), in each hero's colour, in a box of
 * {@link MARKER_ART_PX} Token art pixels. On a Token order it stands in the Token's middle; on a
 * spot order its pole foot stands on the spot. Flags may overlap freely and never push, nudge or
 * hide each other.
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
 * How far apart, in Token art pixels, the flags of several heroes ordered onto one Token stand side
 * by side in its middle: a little over the drawn flag's width, so each colour shows.
 */
export const MARKER_SIDE_ART_PX = 9;

/**
 * The flag's place in a row of `count` flags centred on a Token, in steps of
 * {@link MARKER_SIDE_ART_PX}: 0 for one flag, -0.5 and 0.5 for two, -1, 0 and 1 for three.
 */
export const sideSlot = (rank, count) => (count > 1 ? rank - (count - 1) / 2 : 0);

/**
 * How often a shown flag pulses, in ms: a hop of whole art pixels (`REACH_DOT_PULSE`), then held
 * still until the next.
 */
export const MARKER_PULSE_EVERY_MS = 1000;

/**
 * Where the flag is drawn and how big, in mat units: its box's top-left and size.
 * - On a Token (`onToken`): its box centred on the Token's centre, moved `slot` steps of
 * {@link MARKER_SIDE_ART_PX} across (several heroes side by side), on whole art pixels.
 * - On a spot: its pole foot on the spot.
 * @param {{x:number,y:number}} point the flag's own point (a spot) or the pinned Token's centre
 * @param {boolean} onToken whether `point` is a Token's centre
 * @param {number} artScale mat units per art pixel (`boardScaleAt(fit)`)
 * @param {number} [slot] a pinned flag's {@link sideSlot}
 */
export function markerBox(point, onToken, artScale, slot = 0) {
    const x = point?.x ?? 0;
    const y = point?.y ?? 0;
    const size = MARKER_ART_PX * artScale;
    if (onToken) {
        const left = Math.round((x + slot * MARKER_SIDE_ART_PX * artScale) / artScale - MARKER_ART_PX / 2) * artScale;
        const top = Math.round(y / artScale - MARKER_ART_PX / 2) * artScale;
        return { left, top, size };
    }
    return { left: x - MARKER_FOOT.x * size, top: y - MARKER_FOOT.y * size, size };
}
