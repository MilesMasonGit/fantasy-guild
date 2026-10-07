// overall colouring per terrain, fading between neighbours

import { distanceFromSeeds } from './TerrainLattice.js';
import { toneOf } from '../../config/registries/terrainRegistry.js';
import { tuning } from '../../config/playmatTuning.js';

/**
 * The wash that makes a fir wood darker than an oak wood, and the fade that stops the two meeting
 * in a line.
 *
 * ⚠️ Not a band, and not a boundary: a tone colours the whole of a terrain, and its only interest
 * in the boundary is to stop being visible there. Two forests on the same grass differ by tone
 * alone, so without the fade they would meet as a hard line.
 *
 * How the fade works: each toned terrain gets a bounded distance field from its own pixels. A pixel
 * in terrain A, `d` away from terrain B, is coloured `lerp(A, B, ½(1 − d/width))`: half-and-half at
 * the boundary, pure A a full width away. Both sides compute the same thing, so the ramps meet with
 * no seam.
 *
 * ⚠️ Terrain with no tone still takes part, as somewhere to fade out toward: a meadow is the same
 * grass as an oak wood, so a tone that stopped dead at the meadow would draw the hard line this
 * exists to remove. All untoned ground shares one distance field.
 *
 * The blend is quantised to a handful of steps: every distinct tint becomes one cached recoloured
 * sprite, and a step per art pixel is finer than the eye can find at this zoom.
 */

/**
 * How many steps the fade is rounded to across its full width.
 *
 * ⚠️ Five, not eight: the fade spans about seven art pixels, so more steps put step boundaries
 * closer than the pixels themselves, at the price of a distinct recoloured sprite per step per
 * variant.
 */
const BLEND_STEPS = 5;

const hexToRgb = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
];

const toHex = (rgb) => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v)))
    .toString(16).padStart(2, '0')).join('');

/**
 * Per-pixel tone, as an index into a small table.
 *
 * @param {object} artPixels A resolved map from `resolveArtPixels`.
 * @returns {{tones: Array<{tint: string, amount: number}>, toneAt: Int16Array}}
 *   `toneAt` is -1 where the ground is left its own colour.
 */
export function buildToneMap(artPixels) {
    const { size, palette, at } = artPixels;

    const width = Math.max(0, tuning('toneBlend'));
    const strength = Math.max(0, tuning('toneStrength'));

    // A tone per palette entry. Terrain with none is a zero-strength tone, so
    // its neighbours fade out into it rather than stopping at it.
    const declared = palette.map(id => {
        const tone = toneOf(id);
        return tone
            ? { rgb: hexToRgb(tone.tint), amount: tone.amount * strength }
            : { rgb: [0, 0, 0], amount: 0 };
    });

    const anyToned = declared.some(t => t.amount > 0);
    if (!anyToned) return { tones: [], toneAt: new Int16Array(size * size).fill(-1) };

    // Only terrains that actually colour something need a field; a plain neighbour contributes by
    // being absent from every field, which leaves the pixel with its own tone weakened rather than
    // mixed.
    const limit = width * 3;
    const fields = declared.map((tone, p) => {
        if (tone.amount <= 0 || width <= 0) return null;
        const seeds = new Uint8ClampedArray(at.length);
        let any = false;
        for (let i = 0; i < at.length; i++) if (at[i] === p) { seeds[i] = 1; any = true; }
        return any ? distanceFromSeeds(seeds, size, limit) : null;
    });

    // One field for *all* untoned ground — see the note above.
    let plainField = null;
    if (width > 0) {
        const seeds = new Uint8ClampedArray(at.length);
        let any = false;
        for (let i = 0; i < at.length; i++) {
            const p = at[i];
            if (p >= 0 && declared[p].amount <= 0) { seeds[i] = 1; any = true; }
        }
        if (any) plainField = distanceFromSeeds(seeds, size, limit);
    }

    // ⚠️ Every possible result is built before the loop. The blend is quantised, so the outcomes
    // are (own terrain × nearest terrain × step); anything per-pixel has to be an integer index
    // into something prepared in advance. Only terrains that have a distance field can ever be the
    // nearest other terrain, so only those pairs are built.
    const active = [];
    for (let p = 0; p < fields.length; p++) if (fields[p]) active.push(p);

    // `PLAIN` is the sentinel destination for untoned ground: keep the colour,
    // take the strength to nothing. Blending the *colour* toward it as well
    // would drag every fade through black, which is a different effect and not
    // one anybody asked for.
    const PLAIN = palette.length;

    const tones = [];
    const stepCount = BLEND_STEPS + 1;
    const table = new Int16Array(palette.length * (palette.length + 1) * stepCount).fill(-1);

    const blend = (a, b, f) => ({
        rgb: [
            a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f,
            a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f,
            a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f
        ],
        amount: a.amount + (b.amount - a.amount) * f
    });

    // ⚠️ Only destinations that can actually be reached. `PLAIN` belongs here
    // only when there is untoned ground on the board to fade toward, and
    // `active` is empty when the blend distance is zero — so a hard join builds
    // no intermediate tones at all rather than building and never using them.
    const destinations = [...active];
    if (plainField) destinations.push(PLAIN);

    for (let own = 0; own < palette.length; own++) {
        for (const other of [own, ...destinations]) {
            for (let step = 0; step < stepCount; step++) {
                const f = (step / BLEND_STEPS) * 0.5;
                let mixed;
                if (other === own) mixed = declared[own];
                else if (other === PLAIN) {
                    mixed = { rgb: declared[own].rgb, amount: declared[own].amount * (1 - f) };
                } else {
                    mixed = blend(declared[own], declared[other], f);
                }
                if (mixed.amount <= 0.001) continue;
                table[(own * (palette.length + 1) + other) * stepCount + step] = tones.length;
                tones.push({ tint: toHex(mixed.rgb), amount: mixed.amount });
            }
        }
    }

    const toneAt = new Int16Array(size * size).fill(-1);

    for (let i = 0; i < at.length; i++) {
        const own = at[i];
        if (own < 0) continue;

        // The nearest other toned terrain, if one is within reach. Walks only the terrains that
        // have a field rather than the whole palette, since this runs once per pixel.
        let nearest = own;
        let nearestDist = limit;
        for (let a = 0; a < active.length; a++) {
            const p = active[a];
            if (p === own) continue;
            const d = fields[p][i];
            if (d < nearestDist) { nearestDist = d; nearest = p; }
        }
        if (plainField && declared[own].amount > 0) {
            const d = plainField[i];
            if (d < nearestDist) { nearestDist = d; nearest = PLAIN; }
        }

        // Half and half at the boundary, all mine a full width away — and the
        // terrain on the other side computes the mirror of this, so the two
        // ramps meet without a seam.
        const step = nearest === own
            ? 0
            : Math.round((1 - nearestDist / limit) * BLEND_STEPS);

        toneAt[i] = table[(own * (palette.length + 1) + nearest) * stepCount + step];
    }

    return { tones, toneAt };
}
