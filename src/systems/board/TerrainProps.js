// Fantasy Guild — Scenery scattered over the terrain (dynamic terrain P4).

import { LATTICE_SIZE, SUBTILE_PX, hash01, subtileArtPx } from './TerrainLattice.js';
import { propsOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * Where every tree stands, worked out from the painted board.
 *
 * Pure data, not drawing. That is deliberate and it is the lesson from P3,
 * where the strip geometry lived inside the renderer, was wrong, and could not
 * be asserted on from anywhere. Everything here comes out as a list the renderer
 * only has to paint in the order given.
 *
 * ## Props are 16px art, drawn at the ground's own zoom
 *
 * The ground is 8px art at 4× (or 16px at 2× on the other art set), so one
 * "world pixel" is four screen pixels either way. A prop drawn at a different
 * zoom would have finer pixels than the ground it stands on and read as pasted
 * on rather than part of the scene — the same mistake as cutting a coastline
 * finer than the ground it runs through. So props follow the ground's zoom and
 * change size when the art set is switched, because the whole world's pixel
 * scale changes with it.
 *
 * ## They stand on a point, they do not fill a cell
 *
 * A prop is anchored at a scattered point inside a subtile — never its centre,
 * which would line every tree up on a lattice and undo the whole effect — and
 * drawn with its **base** at that point. So a 64px tree occupies the ground it
 * stands on and reaches up into the subtiles above it, exactly as a tree does.
 *
 * ## Depth
 *
 * The list comes back sorted by that anchor point's y, so painting it in order
 * puts nearer trees over farther ones. Sorting by the base rather than by the
 * top is what makes overlapping trees stack correctly: what matters is which
 * one is standing in front.
 */

/**
 * How much of a subtile a prop's anchor may roam over, as a fraction, centred.
 *
 * Never the full subtile: an anchor hard against an edge puts half the tree in
 * the next subtile along, which reads as a tree growing out of whatever terrain
 * is over there. The remaining margin keeps every trunk on the ground that grew
 * it while still scattering them well off centre.
 */
const anchorSpan = () => tuning('propScatter');

/**
 * Separate hash channels, so the four questions asked of each subtile are
 * independent. Sharing one would tie them together — turning the density up
 * would also move every surviving tree and change which species it was, which
 * makes tuning the look impossible.
 */
const CHANNEL_PRESENCE = 0x9101;
const CHANNEL_WHICH = 0x9102;
const CHANNEL_X = 0x9103;
const CHANNEL_Y = 0x9104;

/** Props are 16px whatever the ground art set is. */
export const PROP_ART_PX = 16;

/** How big a prop draws, in board pixels — the ground's zoom applied to 16px. */
export function propSizePx() {
    return PROP_ART_PX * (SUBTILE_PX / subtileArtPx());
}

/**
 * Every prop on the board, in the order it should be painted.
 *
 * @param {Array<string|null>} grid A resolved lattice from `resolveLattice`.
 * @param {number} seed The save's terrain seed.
 * @returns {Array<{propId, x, y, anchorX, anchorY, sx, sy, size}>}
 *   `x`/`y` are the sprite's top-left in board pixels, already offset so the
 *   sprite's base sits on its anchor; `anchorX`/`anchorY` are that base;
 *   `sx`/`sy` the subtile it grew in. Sorted back-to-front.
 */
export function propsForBoard(grid, seed = 0) {
    const size = propSizePx();
    // One art pixel of a prop, in board pixels. Anchors snap to this so a
    // sprite lands on the pixel grid rather than half a pixel off it.
    const worldPixel = size / PROP_ART_PX;
    const snap = (v) => Math.round(v / worldPixel) * worldPixel;
    const out = [];

    for (let sy = 0; sy < LATTICE_SIZE; sy++) {
        for (let sx = 0; sx < LATTICE_SIZE; sx++) {
            const terrainId = grid[sy * LATTICE_SIZE + sx];
            if (!terrainId) continue;

            const scatter = propsOf(terrainId);
            if (!scatter) continue;

            // Whether this subtile carries anything at all. Its own draw is
            // kept on a separate hash channel from the position and the choice
            // of tree, so changing the density does not also reshuffle where
            // the survivors stand.
            const density = scatter.density * tuning('propDensity');
            if (hash01(sx, sy, CHANNEL_PRESENCE, seed) >= density) continue;

            const pick = Math.floor(
                hash01(sx, sy, CHANNEL_WHICH, seed) * scatter.props.length
            );
            const propId = scatter.props[Math.min(pick, scatter.props.length - 1)];

            // The scatter is centred, so turning it to zero plants every prop
            // dead centre rather than pushing them all into one corner.
            const span = anchorSpan();
            const margin = (1 - span) / 2;
            const anchorX =
                (sx + margin + hash01(sx, sy, CHANNEL_X, seed) * span) * SUBTILE_PX;
            const anchorY =
                (sy + margin + hash01(sx, sy, CHANNEL_Y, seed) * span) * SUBTILE_PX;

            out.push({
                propId,
                x: snap(anchorX - size / 2),   // base-centred on the anchor
                y: snap(anchorY - size),
                anchorX, anchorY,
                // The subtile that grew it, kept so callers can check the trunk
                // never wandered onto ground that did not ask for it.
                sx, sy,
                size
            });
        }
    }

    // Painter's order: whatever stands lower on the board is nearer the viewer
    // and goes on top. Ties broken by x so the order is total and stable.
    out.sort((a, b) => (a.anchorY - b.anchorY) || (a.x - b.x));
    return out;
}
