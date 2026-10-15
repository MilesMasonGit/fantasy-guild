// shore bands: a look shading differently near its own edge

import { distanceFields, PLAN_PIXEL_U } from './TerrainLattice.js';
import { bandOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * The shallows at the edge of the sea, and the wet sand at the edge of a beach. Each look shades
 * its own outer edge, so neither has to know the other exists: any look that declares a band
 * gets one.
 *
 * ⚠️ A band is caused by a neighbour, not by having an edge. Each band names the terrains that
 * trigger it (`against`); the default, any other ground, is right for shallows and wrong for
 * almost everything else (sand banded against everything put wet sand where the beach met the
 * forest).
 *
 * Measured on the drawn coastline from `resolveArtPixels`, never on the cells. The mat's own edge
 * is not a shore: only real ground triggers a band.
 */

/**
 * Which pixels of each banded terrain fall inside its band.
 *
 * @param {object} pixels A resolved map from `resolveArtPixels`.
 * @param {object} ground The Region's ground, for the look of each terrain.
 * @returns {{bands: Array<{terrainId: string, look: string, mask: Uint8Array, pixels: number[],
 *   appearance: {tint: string, amount: number}|null}>}} One per banded terrain that has any band:
 *   `mask` 1 inside it, `pixels` the same pixels as a list.
 */
export function buildBandMasks(pixels, ground) {
    const { width, height, palette, at, present } = pixels;
    const fields = pixels.fields || distanceFields(at, width, height);
    const bands = [];

    for (let p = 0; p < palette.length; p++) {
        if (!present[p]) continue;
        const look = ground.looks[palette[p]];
        const band = bandOf(look);
        if (!band) continue;
        const limit = (tuning(band.widthTuning) / PLAN_PIXEL_U) * 3;
        if (!(limit > 0)) continue;

        // What causes it: the named terrains, or any other ground at all.
        const triggers = band.against
            ? band.against.map(id => palette.indexOf(id)).filter(i => i >= 0 && i !== p && present[i])
            : null;
        const cause = triggers ? triggers.length > 0 : present.some((on, i) => on && i !== p);
        if (!cause) continue;

        const { pixels: near } = triggers ? fields.from(triggers, false, limit) : fields.from([p], true, limit);
        const inside = [];
        for (const i of near) if (at[i] === p) inside.push(i);
        if (!inside.length) continue;
        const mask = new Uint8Array(at.length);
        for (const i of inside) mask[i] = 1;
        bands.push({ terrainId: palette[p], look, mask, pixels: inside, appearance: bandAppearance(look) });
    }

    return { bands };
}

/**
 * How a look's band is coloured, with the strength slider applied: the slider changes the tint,
 * never the mask.
 *
 * @returns {{tint: string, amount: number}|null} Null when the look has no band, or when the
 *   strength has been turned down to nothing.
 */
export function bandAppearance(lookId) {
    const band = bandOf(lookId);
    if (!band) return null;
    const amount = band.amount * tuning('bandStrength');
    if (amount <= 0) return null;
    return { tint: band.tint, amount: Math.min(1, amount) };
}
