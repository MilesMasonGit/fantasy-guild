import { describe, it, expect, afterEach } from 'vitest';
import { buildToneMap } from '../systems/board/TerrainTones.js';
import { resolveArtPixels, LATTICE_SIZE } from '../systems/board/TerrainLattice.js';
import { TERRAIN_TYPES, toneOf } from '../config/registries/terrainRegistry.js';
import { setTuning, resetTuning } from '../config/playmatTuning.js';

/**
 * Biome tones, and the fade that stops two of them meeting in a line.
 *
 * The property that matters is the one that is hard to see and easy to lose:
 * **the fade is symmetric**. Each side computes its own ramp independently, so
 * if they disagreed about the mix at the boundary there would be a step there —
 * which is the exact thing this feature exists to remove.
 */

afterEach(() => resetTuning());

const flat = (id) => new Array(LATTICE_SIZE * LATTICE_SIZE).fill(id);

/** Oak wood on the left, fir wood on the right: same grass, tone alone. */
function twoWoods() {
    const grid = new Array(LATTICE_SIZE * LATTICE_SIZE);
    for (let sy = 0; sy < LATTICE_SIZE; sy++) {
        for (let sx = 0; sx < LATTICE_SIZE; sx++) {
            grid[sy * LATTICE_SIZE + sx] =
                sx < LATTICE_SIZE / 2 ? 'forest' : 'fir_forest';
        }
    }
    return grid;
}

const toneOfPixel = (map, i) => (map.toneAt[i] >= 0 ? map.tones[map.toneAt[i]] : null);

describe('A tone colours its whole terrain', () => {
    it('gives nothing to terrain that declared no tone', () => {
        for (const id of Object.keys(TERRAIN_TYPES)) {
            if (toneOf(id)) continue;
            const map = buildToneMap(resolveArtPixels(flat(id), 5));
            expect(map.tones, id).toEqual([]);
        }
    });

    it('colours a toned terrain uniformly when nothing else is near', () => {
        const map = buildToneMap(resolveArtPixels(flat('fir_forest'), 5));
        const distinct = new Set(Array.from(map.toneAt));
        expect(distinct.size).toBe(1);            // one tone, everywhere
        expect([...distinct][0]).toBeGreaterThanOrEqual(0);
    });

    it('uses the terrain’s own declared colour away from any boundary', () => {
        const map = buildToneMap(resolveArtPixels(flat('forest'), 5));
        const tone = toneOfPixel(map, 0);
        expect(tone.tint.toLowerCase()).toBe(toneOf('forest').tint.toLowerCase());
    });
});

describe('⭐ Two tones fade into each other', () => {
    /** Mean tone strength per art-pixel column, grass only. */
    function strengthByColumn(map, pixels) {
        const { size } = pixels;
        const out = [];
        for (let x = 0; x < size; x++) {
            let sum = 0;
            let n = 0;
            for (let y = 0; y < size; y++) {
                const tone = toneOfPixel(map, y * size + x);
                if (tone) { sum += tone.amount; n++; }
            }
            out.push(n ? sum / n : 0);
        }
        return out;
    }

    it('produces intermediate tones, not just the two ends', () => {
        const pixels = resolveArtPixels(twoWoods(), 5);
        const map = buildToneMap(pixels);
        const ends = [toneOf('forest').amount, toneOf('fir_forest').amount];
        const between = map.tones.filter(t =>
            t.amount > Math.min(...ends) + 0.01 && t.amount < Math.max(...ends) - 0.01
        );
        expect(between.length).toBeGreaterThan(1);
    });

    it('⭐ changes gradually across the join rather than stepping', () => {
        // The whole point. A hard line would show as one big jump between
        // neighbouring columns; a fade shows as many small ones.
        const pixels = resolveArtPixels(twoWoods(), 5);
        const strengths = strengthByColumn(buildToneMap(pixels), pixels);
        const mid = Math.floor(pixels.size / 2);

        const left = strengths[mid - 20];
        const right = strengths[mid + 20];
        const total = Math.abs(right - left);
        expect(total).toBeGreaterThan(0.01);      // the two woods do differ

        let biggest = 0;
        for (let x = mid - 20; x < mid + 20; x++) {
            biggest = Math.max(biggest, Math.abs(strengths[x + 1] - strengths[x]));
        }
        // No single column may carry more than a third of the whole change.
        expect(biggest).toBeLessThan(total / 3);
    });

    it('is back to its own colour well away from the boundary', () => {
        const pixels = resolveArtPixels(twoWoods(), 5);
        const map = buildToneMap(pixels);
        const own = toneOf('fir_forest');
        const far = toneOfPixel(map, 10 * pixels.size + pixels.size - 3);
        expect(far.amount).toBeCloseTo(own.amount, 2);
    });

    it('⚠️ fades out toward a neighbour with no tone at all', () => {
        // A toned wood beside a plain meadow must fade *out*, not stop dead —
        // which is why terrain without a tone still takes part, at strength zero.
        const grid = new Array(LATTICE_SIZE * LATTICE_SIZE);
        for (let sy = 0; sy < LATTICE_SIZE; sy++) {
            for (let sx = 0; sx < LATTICE_SIZE; sx++) {
                grid[sy * LATTICE_SIZE + sx] =
                    sx < LATTICE_SIZE / 2 ? 'fir_forest' : 'shore';
            }
        }
        const pixels = resolveArtPixels(grid, 5);
        const map = buildToneMap(pixels);
        const strengths = strengthByColumn(map, pixels);
        const mid = Math.floor(pixels.size / 2);
        expect(strengths[mid - 25]).toBeGreaterThan(strengths[mid - 2]);
    });
});

describe('Width, quantisation and stability', () => {
    it('a blend distance of zero gives a hard join', () => {
        setTuning('toneBlend', 0);
        const map = buildToneMap(resolveArtPixels(twoWoods(), 5));
        // Only the two terrains' own tones survive — nothing in between.
        const amounts = new Set(map.tones.map(t => t.amount.toFixed(3)));
        expect(amounts.size).toBeLessThanOrEqual(2);
    });

    it('a strength of zero removes the colouring entirely', () => {
        setTuning('toneStrength', 0);
        expect(buildToneMap(resolveArtPixels(twoWoods(), 5)).tones).toEqual([]);
    });

    it('⚠️ keeps the number of distinct tones small', () => {
        // Each one becomes a separately cached recoloured sprite per variant, so
        // an unquantised gradient would mean a cache entry per pixel. This was
        // 172 before the blend was restricted to reachable pairs.
        const map = buildToneMap(resolveArtPixels(twoWoods(), 5));
        expect(map.tones.length).toBeLessThan(40);
    });

    it('is identical every time', () => {
        const a = buildToneMap(resolveArtPixels(twoWoods(), 12));
        const b = buildToneMap(resolveArtPixels(twoWoods(), 12));
        expect(Array.from(a.toneAt)).toEqual(Array.from(b.toneAt));
        expect(a.tones).toEqual(b.tones);
    });
});
