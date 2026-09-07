// Fantasy Guild — Shore bands: a terrain shading differently near its own edge.

import { distanceFromSeeds } from './TerrainLattice.js';
import { bandOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * The shallows at the edge of the sea, and the wet sand at the edge of a beach.
 *
 * Concept §6B asks for concentric bands — deep ocean → shallow → wet sand → dry
 * sand — built from "the same contour at different insets". This is that, from
 * the other direction: rather than one terrain drawing four nested shapes,
 * **each terrain shades its own outer edge**. Ocean pales to shallows where it
 * meets land; sand darkens where it meets water. Put them side by side and the
 * four tiers fall out, with neither terrain having to know the other exists.
 *
 * Nothing here is written in terms of water or sand — any terrain that declares
 * a band gets one.
 *
 * ## ⚠️ A band is caused by a neighbour, not by having an edge
 *
 * Each band names the terrains that trigger it. That distinction is not
 * academic: banding sand against *everything* put wet sand where the beach met
 * the forest, because nothing had said that wet sand is caused by water. The
 * default — trigger on any painted neighbour — is right for shallows and wrong
 * for almost everything else, so `against` is usually worth spelling out.
 *
 * ## Distance, not insets
 *
 * A band is "within N art pixels of a triggering terrain", measured on the
 * **drawn** coastline from `resolveArtPixels` — so it follows the ragged edge
 * exactly rather than the subtile grid the edge wandered away from. Computed
 * with a two-pass chamfer transform, which is one sweep forward and one back
 * over the board; checking a neighbourhood per pixel would be 81 lookups
 * against 53,000 pixels and far too slow to run on every repaint.
 */

/**
 * Which pixels count as "the thing causing this band", as seeds for the shared
 * distance transform.
 *
 * ⚠️ Unpainted ground never triggers: a coast where the map runs out is not a
 * shore.
 */
function triggerSeeds(at, self, triggers) {
    const seeds = new Uint8ClampedArray(at.length);
    for (let i = 0; i < at.length; i++) {
        const t = at[i];
        if (t < 0 || t === self) continue;
        if (triggers && !triggers.has(t)) continue;
        seeds[i] = 1;
    }
    return seeds;
}

/**
 * Which pixels of each banded terrain fall inside its own band.
 *
 * ⚠️ Takes the resolved map rather than the lattice. It used to resolve its own,
 * which meant the art-pixel map was built twice on every repaint — about five
 * milliseconds of the sixty the renderer was costing, spent computing an answer
 * the caller already had.
 *
 * @param {object} artPixels A resolved map from `resolveArtPixels`.
 * @param {number} seed The save's terrain seed.
 * @returns {{size, bands: Array<{terrainId, mask, appearance}>}} One mask per
 *   banded terrain, 255 inside the band, with the tint it should be drawn in.
 *   Empty when nothing on the board declares one.
 */
export function buildBandMasks(artPixels, seed = 0) {
    const { size, palette, at } = artPixels;

    // Which palette entries want a band at all, resolved once.
    const bands = [];

    for (let p = 0; p < palette.length; p++) {
        const band = bandOf(palette[p]);
        if (!band) continue;
        const width = Math.max(0, band.width * tuning('bandWidth'));
        if (width <= 0) continue;

        // ⚠️ Which neighbours actually cause this band. Without it a band is a
        // property of *having an edge*, which is wrong the moment a terrain has
        // more than one kind of neighbour: sand banded against everything put
        // wet sand where the beach met the forest, 486 pixels of it, because
        // nothing had ever told it that wet sand is caused by water.
        const triggers = band.against
            ? new Set(band.against.map(id => palette.indexOf(id)).filter(i => i >= 0))
            : null;
        if (triggers && triggers.size === 0) continue;   // nothing here to band against

        const dist = distanceFromSeeds(triggerSeeds(at, p, triggers), size);

        // Distances came back multiplied by 3 by the chamfer weights.
        const limit = width * 3;
        const mask = new Uint8ClampedArray(size * size);
        let any = false;
        for (let i = 0; i < mask.length; i++) {
            if (at[i] === p && dist[i] < limit) { mask[i] = 255; any = true; }
        }
        if (any) {
            bands.push({
                terrainId: palette[p],
                mask,
                appearance: bandAppearance(palette[p])
            });
        }
    }

    return { size, bands };
}

/**
 * How a terrain's band should be coloured, with the tuning applied.
 *
 * ⚠️ Lives here rather than in the renderer so it can be tested. The strength
 * slider changes only the tint, not the mask — so with this inside the canvas
 * there was nothing outside it that could tell whether the slider did anything
 * at all, and the dead-slider test correctly refused to pass.
 *
 * @returns {{tint: string, amount: number}|null} Null when the terrain has no
 *   band, or when the strength has been turned down to nothing.
 */
export function bandAppearance(terrainId) {
    const band = bandOf(terrainId);
    if (!band) return null;
    const amount = band.amount * tuning('bandStrength');
    if (amount <= 0) return null;
    return { tint: band.tint, amount: Math.min(1, amount) };
}
