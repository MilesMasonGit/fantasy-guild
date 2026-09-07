// Fantasy Guild — Shore bands: a terrain shading differently near its own edge.

import { resolveArtPixels } from './TerrainLattice.js';
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
 * A chamfer distance transform: how far each pixel is from the nearest pixel of
 * a terrain this one bands against.
 *
 * Distances are approximate — 3 for a step sideways, 4 for a diagonal, all
 * divided by 3 at the end — which is the standard cheap approximation to true
 * Euclidean distance and is well inside a pixel over the few we care about.
 *
 * @param {Set<number>|null} triggers Palette indices that count. Null means any
 *   painted terrain other than this one.
 */
function distanceToTrigger(at, size, self, triggers) {
    const INF = 0x3fff;
    const dist = new Int16Array(size * size).fill(INF);

    // Seeds are the *triggering* pixels themselves, so distance is measured to
    // the thing causing the band rather than to the nearest boundary of any
    // kind. ⚠️ Unpainted ground (-1) never triggers: a coast against the bare
    // table is the map running out, not a shore.
    for (let i = 0; i < at.length; i++) {
        const t = at[i];
        if (t < 0 || t === self) continue;
        if (triggers && !triggers.has(t)) continue;
        dist[i] = 0;
    }

    const relax = (i, j, cost) => {
        const d = dist[j] + cost;
        if (d < dist[i]) dist[i] = d;
    };

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const i = y * size + x;
            if (x > 0) relax(i, i - 1, 3);
            if (y > 0) relax(i, i - size, 3);
            if (x > 0 && y > 0) relax(i, i - size - 1, 4);
            if (x < size - 1 && y > 0) relax(i, i - size + 1, 4);
        }
    }
    for (let y = size - 1; y >= 0; y--) {
        for (let x = size - 1; x >= 0; x--) {
            const i = y * size + x;
            if (x < size - 1) relax(i, i + 1, 3);
            if (y < size - 1) relax(i, i + size, 3);
            if (x < size - 1 && y < size - 1) relax(i, i + size + 1, 4);
            if (x > 0 && y < size - 1) relax(i, i + size - 1, 4);
        }
    }

    return dist;
}

/**
 * Which pixels of each banded terrain fall inside its own band.
 *
 * @param {Array<string|null>} grid A resolved lattice.
 * @param {number} seed The save's terrain seed.
 * @returns {{size: number, bands: Array<{terrainId: string, mask: Uint8ClampedArray}>}}
 *   One mask per banded terrain, 255 inside the band. Empty when nothing on the
 *   board declares one.
 */
export function buildBandMasks(grid, seed = 0) {
    const { size, palette, at } = resolveArtPixels(grid, seed);

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

        const dist = distanceToTrigger(at, size, p, triggers);

        // Distances came back multiplied by 3 by the chamfer weights.
        const limit = width * 3;
        const mask = new Uint8ClampedArray(size * size);
        let any = false;
        for (let i = 0; i < mask.length; i++) {
            if (at[i] === p && dist[i] < limit) { mask[i] = 255; any = true; }
        }
        if (any) bands.push({ terrainId: palette[p], mask });
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
