import { describe, it, expect, afterEach } from 'vitest';
import { buildBandMasks, bandAppearance } from '../systems/board/TerrainBands.js';
import { resolveArtPixels, distanceFromSeeds, PLAN_PIXEL_U } from '../systems/board/TerrainLattice.js';
import { LOOKS, bandOf } from '../config/registries/terrainRegistry.js';
import { tuning, setTuning, resetTuning } from '../config/playmatTuning.js';
import { groundWith, flat } from './fixtures/ground.js';

/**
 * The waterline: the beach rim written onto the land beside the sea, the shallows on the sea's
 * edge, the wet sand on the beach's. Widths are in mat units (the tuning sliders), measured on
 * the drawn coastline.
 */

afterEach(() => resetTuning());

/** Sea on the left, a beach, then forest grass. */
const coast = () => groundWith(24, 14, (c) => (c < 8 ? 'water' : (c < 16 ? 'sand' : 'grass')));
/** Sea laid straight against forest, no sand authored. */
const seaAndWood = () => groundWith(24, 14, (c) => (c < 12 ? 'water' : 'grass'));
/** Sea laid straight against mountain rock. */
const seaAndRock = () => groundWith(24, 14, (c, r) => (c + (r >> 2) < 12 ? 'water' : 'rock'));

/** Chamfer distance (×3) from every pixel to the nearest pixel `isSeed` picks out. */
function distanceTo(pixels, isSeed) {
    const seeds = new Uint8Array(pixels.at.length);
    for (let i = 0; i < seeds.length; i++) seeds[i] = isSeed(pixels.palette[pixels.at[i]]) ? 1 : 0;
    return distanceFromSeeds(seeds, pixels.width, pixels.height);
}

const bandFor = (bands, terrainId) => bands.find(b => b.terrainId === terrainId);
const countOf = (mask) => mask.reduce((n, v) => n + (v ? 1 : 0), 0);

describe('⭐ Shallows and wet sand sit where their cause is', () => {
    it('⭐ shallows only on water beside land, and on all of it', () => {
        for (const make of [coast, seaAndWood, seaAndRock]) {
            const ground = make();
            const pixels = resolveArtPixels(ground);
            const shallows = bandFor(buildBandMasks(pixels, ground).bands, 'water');
            const limit = (tuning('shallowsWidth') / PLAN_PIXEL_U) * 3;
            const toLand = distanceTo(pixels, t => t !== 'water');
            let n = 0;
            const wrong = [];
            for (let i = 0; i < pixels.at.length; i++) {
                const isWater = pixels.palette[pixels.at[i]] === 'water';
                const want = isWater && toLand[i] < limit;
                if (Boolean(shallows.mask[i]) !== want) wrong.push(i);
                if (want) n++;
            }
            expect(wrong.slice(0, 5), `${wrong.length} pixels wrong`).toEqual([]);
            expect(n).toBeGreaterThan(0);
        }
    });

    it('⭐ wet sand only on sand beside water, and on all of it', () => {
        for (const make of [coast, seaAndWood, seaAndRock]) {
            const ground = make();
            const pixels = resolveArtPixels(ground);
            const wet = bandFor(buildBandMasks(pixels, ground).bands, 'sand');
            const limit = (tuning('wetSandWidth') / PLAN_PIXEL_U) * 3;
            const toWater = distanceTo(pixels, t => t === 'water');
            let n = 0;
            const wrong = [];
            for (let i = 0; i < pixels.at.length; i++) {
                const isSand = pixels.palette[pixels.at[i]] === 'sand';
                const want = isSand && toWater[i] < limit;
                if (Boolean(wet.mask[i]) !== want) wrong.push(i);
                if (want) n++;
            }
            expect(wrong.slice(0, 5), `${wrong.length} pixels wrong`).toEqual([]);
            expect(n).toBeGreaterThan(0);
        }
    });

    it('⭐ leaves the beach dry where it meets the grass', () => {
        // The September regression: a band caused by having an edge, rather than by what is on the
        // other side of it, wetted the beach where it met the forest.
        const ground = coast();
        const pixels = resolveArtPixels(ground);
        const wet = bandFor(buildBandMasks(pixels, ground).bands, 'sand');
        const { width, palette, at } = pixels;
        for (let i = 0; i < at.length; i++) {
            if (!wet.mask[i]) continue;
            const x = i % width;
            // Grass starts at cell 16; the sea ends at cell 8. Wet sand stays near the sea.
            expect(x, `wet sand at ${x}`).toBeLessThan(10 * 16);
            expect(palette[at[i]]).toBe('sand');
        }
    });

    it('bands nothing on a ground of one terrain: the mat\'s edge is not a shore', () => {
        for (const t of ['water', 'sand', 'grass', 'rock']) {
            const ground = groundWith(10, 6, flat(t));
            expect(buildBandMasks(resolveArtPixels(ground), ground).bands, t).toEqual([]);
        }
    });

    it('gives a band only to the looks that declare one: the sea and the coast', () => {
        const declared = Object.keys(LOOKS).filter(id => bandOf(id)).sort();
        expect(declared).toEqual(['coast', 'sea']);
        const ground = coast();
        const named = buildBandMasks(resolveArtPixels(ground), ground).bands.map(b => b.look).sort();
        expect(named).toEqual(['coast', 'sea']);
    });

    it('is identical every time', () => {
        const masks = () => {
            const ground = coast();
            return buildBandMasks(resolveArtPixels(ground), ground).bands.map(b => Array.from(b.mask).join(''));
        };
        expect(masks()).toEqual(masks());
    });
});

describe('Band widths and strength (tuning, in mat units)', () => {
    const area = (terrainId) => {
        const ground = coast();
        const band = bandFor(buildBandMasks(resolveArtPixels(ground), ground).bands, terrainId);
        return band ? countOf(band.mask) : 0;
    };

    it('widens the shallows with their slider, and zero turns them off', () => {
        const normal = area('water');
        setTuning('shallowsWidth', 0);
        expect(area('water')).toBe(0);
        setTuning('shallowsWidth', 32);
        expect(area('water')).toBeGreaterThan(normal);
    });

    it('widens the wet sand with its slider, and zero turns it off', () => {
        const normal = area('sand');
        setTuning('wetSandWidth', 0);
        expect(area('sand')).toBe(0);
        setTuning('wetSandWidth', 20);
        expect(area('sand')).toBeGreaterThan(normal);
    });

    it('strength changes the tint, not the band', () => {
        const before = bandAppearance('sea');
        setTuning('bandStrength', 2);
        expect(bandAppearance('sea').amount).toBeGreaterThan(before.amount);
        setTuning('bandStrength', 0);
        expect(bandAppearance('sea')).toBeNull();
        expect(bandAppearance('meadow')).toBeNull();
    });
});

describe('⭐ The beach rim', () => {
    /** Every terrain a water pixel touches, eight ways. */
    function waterTouches(pixels) {
        const { width, height, palette, at } = pixels;
        const found = new Set();
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (palette[at[y * width + x]] !== 'water') continue;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                        const t = palette[at[ny * width + nx]];
                        if (t !== 'water') found.add(t);
                    }
                }
            }
        }
        return found;
    }

    it('⭐ water never meets grass or rock without the beach rim', () => {
        for (const make of [seaAndWood, seaAndRock, coast]) {
            expect([...waterTouches(resolveArtPixels(make()))]).toEqual(['sand']);
        }
    });

    it('is cut where none was authored, and only by a ground with a fringe (the sea)', () => {
        const plain = resolveArtPixels(seaAndWood(), false);
        const cut = resolveArtPixels(seaAndWood());
        expect(plain.fringes).toEqual([]);
        expect(cut.fringes.map(f => f.terrainId)).toEqual(['sand']);
        expect([...waterTouches(plain)].sort()).toEqual(['grass']);
    });

    it('never eats into the water itself', () => {
        const plain = resolveArtPixels(seaAndWood(), false);
        const cut = resolveArtPixels(seaAndWood());
        const water = (p) => Array.from(p.at).filter(i => p.palette[i] === 'water').length;
        expect(water(cut)).toBe(water(plain));
    });

    it('widens with its slider (mat units), and zero removes it', () => {
        const sand = () => {
            const p = resolveArtPixels(seaAndWood());
            return Array.from(p.at).filter(i => p.palette[i] === 'sand').length;
        };
        const normal = sand();
        setTuning('beachWidth', 0);
        expect(sand()).toBe(0);
        setTuning('beachWidth', 24);
        expect(sand()).toBeGreaterThan(normal);
    });
});
