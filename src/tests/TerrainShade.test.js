import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { buildShadePattern, shadeNoise, buildWearEdges, PATTERN_SHARES } from '../systems/board/TerrainShade.js';
import { buildWearMask } from '../systems/board/TerrainPatches.js';
import { buildGroundPlan } from '../systems/board/TerrainSurface.js';
import { resolveArtPixels, PLAN_PIXEL_U } from '../systems/board/TerrainLattice.js';
import { LOOKS } from '../config/registries/terrainRegistry.js';
import { tuning, setTuning, resetTuning } from '../config/playmatTuning.js';
import { groundWith, flat } from './fixtures/ground.js';

/**
 * Structure in the ground without new art: every look's sheet a few percent lighter or darker in
 * large stepped areas, and each worn patch with a darker rim on its earth and a lighter fringe on
 * the grass round it.
 */

afterEach(() => resetTuning());

const W = 400;
const H = 260;

/** The ground of one look everywhere: meadow needs no biome to own the grass. */
const lookGround = (lookId, seed = 5, cols = 40, rows = 24) => {
    const terrain = LOOKS[lookId].terrain;
    const biomes = lookId === 'meadow' ? null : { main: lookId, terrains: { [lookId]: terrain } };
    return groundWith(cols, rows, flat(terrain), { seed, biomes });
};

/** The mean length of a run of one level along the rows. */
function meanRun(levelAt, width) {
    let runs = 0;
    for (let i = 0; i < levelAt.length; i++) if (i % width === 0 || levelAt[i] !== levelAt[i - 1]) runs++;
    return levelAt.length / runs;
}

describe('⭐ The shade pattern is stepped, large and calm', () => {
    it('⭐ puts every pixel in one of three shades, at about the shares it asks', () => {
        const { levelAt } = buildShadePattern(W, H, 7);
        const counts = { '-1': 0, 0: 0, 1: 0 };
        for (const v of levelAt) counts[v]++;
        expect(counts['-1'] + counts[0] + counts[1]).toBe(W * H);
        expect(counts['-1'] / (W * H)).toBeGreaterThan(PATTERN_SHARES.dark * 0.6);
        expect(counts['-1'] / (W * H)).toBeLessThan(PATTERN_SHARES.dark * 1.4);
        expect(counts[1] / (W * H)).toBeGreaterThan(PATTERN_SHARES.light * 0.6);
        expect(counts[1] / (W * H)).toBeLessThan(PATTERN_SHARES.light * 1.4);
    });

    it('⭐ steps between neighbouring shades, never jumping darker to lighter, never speckled', () => {
        const { levelAt } = buildShadePattern(W, H, 8);
        let jumps = 0;
        let lonely = 0;
        for (let y = 1; y < H - 1; y++) {
            for (let x = 1; x < W - 1; x++) {
                const i = y * W + x;
                const v = levelAt[i];
                if (Math.abs(v - levelAt[i + 1]) > 1 || Math.abs(v - levelAt[i + W]) > 1) jumps++;
                if (v !== levelAt[i - 1] && v !== levelAt[i + 1] && v !== levelAt[i - W] && v !== levelAt[i + W]) lonely++;
            }
        }
        expect(jumps).toBe(0);
        expect(lonely).toBeLessThan(W * H * 0.001);
    });

    it('⭐ makes areas several Tokens wide, growing with the scale slider', () => {
        // A Token is 128 units: 64 plan pixels.
        const tokenPx = 128 / PLAN_PIXEL_U;
        const atDefault = meanRun(buildShadePattern(W, H, 9).levelAt, W);
        expect(atDefault).toBeGreaterThan(tokenPx);
        setTuning('patternScale', 128);
        const small = meanRun(buildShadePattern(W, H, 9).levelAt, W);
        setTuning('patternScale', 768);
        const large = meanRun(buildShadePattern(W, H, 9).levelAt, W);
        expect(large).toBeGreaterThan(small * 2);
    });

    it('⭐ gives exactly the reference noise\'s answer at every pixel', () => {
        const { levelAt, cell, thresholds } = buildShadePattern(W, H, 10);
        const [low, high] = thresholds;
        const wrong = [];
        for (let i = 0; i < levelAt.length; i++) {
            const x = i % W;
            const y = (i - x) / W;
            const v = shadeNoise(x, y, 10, cell);
            const want = v < low ? -1 : v > high ? 1 : 0;
            if (levelAt[i] !== want) wrong.push(`${x},${y}`);
        }
        expect(wrong.slice(0, 5), `${wrong.length} pixels differ`).toEqual([]);
    });

    it('is the same every time, and differs between seeds', () => {
        const a = buildShadePattern(W, H, 11).levelAt;
        expect(Array.from(buildShadePattern(W, H, 11).levelAt)).toEqual(Array.from(a));
        expect(Array.from(buildShadePattern(W, H, 12).levelAt)).not.toEqual(Array.from(a));
    });

    it('turns off with its switch or at zero strength', () => {
        setTuning('patternOn', 0);
        expect(buildShadePattern(W, H, 1).levelAt).toBeNull();
        resetTuning();
        setTuning('patternStrength', 0);
        expect(buildShadePattern(W, H, 1).levelAt).toBeNull();
    });
});

describe('⭐ The plan carries the shade as a factor per pixel', () => {
    it('⭐ draws the darker and lighter shades a strength each way, the rest as drawn', () => {
        setTuning('wearEdgeWidth', 0);
        const plan = buildGroundPlan(lookGround('meadow'));
        const s = tuning('patternStrength');
        expect(plan.shades[0]).toBe(1);
        const used = new Set(Array.from(plan.shadeAt).map(v => plan.shades[v]));
        expect([...used].sort((a, b) => a - b)).toEqual([1 - s, 1, 1 + s]);
        for (let i = 0; i < plan.shadeAt.length; i += 97) {
            expect(plan.shades[plan.shadeAt[i]]).toBe([1 - s, 1, 1 + s][plan.pattern.levelAt[i] + 1]);
        }
    });

    it('draws everything as drawn with the pattern and the lips off', () => {
        setTuning('patternOn', 0);
        setTuning('wearEdgeWidth', 0);
        const plan = buildGroundPlan(lookGround('meadow'));
        expect(plan.shades).toEqual([1]);
        expect(plan.shadeAt.every(v => v === 0)).toBe(true);
        expect(plan.props.every(p => p.shade === 1)).toBe(true);
    });

    it('⭐ puts every prop in the light of the ground under its foot', () => {
        const plan = buildGroundPlan(lookGround('forest'));
        const s = tuning('patternStrength');
        expect(plan.props.length).toBeGreaterThan(0);
        const seen = new Set();
        for (const p of plan.props) {
            const level = plan.pattern.levelAt[p.footY * plan.width + p.footX];
            expect(p.shade).toBe([1 - s, 1, 1 + s][level + 1]);
            seen.add(p.shade);
        }
        expect(seen.size).toBeGreaterThan(1);
    });
});

describe('⭐ A worn patch has a darker rim, and a lighter fringe round it', () => {
    // The lip of a sheet look's wear: generated grass draws its own earth edge (`TerrainGrass`).
    beforeEach(() => setTuning('grassOn', 0));

    /** Every pixel within `steps` side steps of `i` (a diamond). */
    const within = (i, steps, width, n, fn) => {
        const x = i % width;
        for (let dy = -steps; dy <= steps; dy++) {
            for (let dx = -steps + Math.abs(dy); dx <= steps - Math.abs(dy); dx++) {
                const j = i + dy * width + dx;
                if (j < 0 || j >= n || x + dx < 0 || x + dx >= width) continue;
                if (fn(j)) return true;
            }
        }
        return false;
    };

    it('⭐ sits the rim on the earth side and the fringe on the grass side, the width apart', () => {
        for (const width of [2, 4]) {
            setTuning('wearEdgeWidth', width);
            const steps = width / PLAN_PIXEL_U;
            const ground = lookGround('meadow', 21);
            const pixels = resolveArtPixels(ground);
            const wear = buildWearMask(pixels, ground);
            const { rim, fringe } = buildWearEdges(pixels, wear, ground);
            const n = wear.mask.length;
            expect(rim.length).toBeGreaterThan(0);
            expect(fringe.length).toBeGreaterThan(0);
            for (const i of rim) {
                expect(wear.mask[i], `rim ${i} on earth`).toBe(1);
                expect(within(i, steps, pixels.width, n, j => !wear.mask[j]), `rim ${i} near grass`).toBe(true);
            }
            for (const i of fringe) {
                expect(wear.mask[i], `fringe ${i} on grass`).toBe(0);
                expect(within(i, steps, pixels.width, n, j => wear.mask[j] === 1), `fringe ${i} near earth`).toBe(true);
            }
            // Every worn pixel touching grass is rim: the lip runs all the way round.
            const isRim = new Set(rim);
            for (const i of wear.worn) {
                if (within(i, 1, pixels.width, n, j => !wear.mask[j])) expect(isRim.has(i), `edge ${i}`).toBe(true);
            }
        }
    });

    it('⭐ draws the rim darker and the fringe lighter than the pattern around them', () => {
        const plan = buildGroundPlan(lookGround('meadow', 22));
        const s = tuning('patternStrength');
        const levels = [1 - s, 1, 1 + s];
        for (const i of plan.edges.rim) {
            const base = levels[plan.pattern.levelAt[i] + 1];
            expect(plan.shades[plan.shadeAt[i]]).toBeCloseTo(base * (1 - tuning('wearRim')), 9);
        }
        for (const i of plan.edges.fringe) {
            const base = levels[plan.pattern.levelAt[i] + 1];
            expect(plan.shades[plan.shadeAt[i]]).toBeCloseTo(base * (1 + tuning('wearFringe')), 9);
        }
        expect(plan.edges.rim.length).toBeGreaterThan(0);
    });

    it('grows with the width slider, and goes with width 0', () => {
        const count = () => {
            const plan = buildGroundPlan(lookGround('forest', 23));
            return plan.edges.rim.length + plan.edges.fringe.length;
        };
        setTuning('wearEdgeWidth', 2);
        const one = count();
        setTuning('wearEdgeWidth', 4);
        expect(count()).toBeGreaterThan(one * 1.6);
        setTuning('wearEdgeWidth', 0);
        expect(count()).toBe(0);
    });

    it('only on the looks that ask for it: earth through grass, not gravel through rock', () => {
        expect(LOOKS.meadow.wear.rim).toBe(true);
        expect(LOOKS.forest.wear.rim).toBe(true);
        expect(LOOKS.mountain.wear.rim).toBeFalsy();
        const plan = buildGroundPlan(lookGround('mountain', 24));
        expect(plan.wear.worn.length).toBeGreaterThan(0);
        expect(plan.edges).toEqual({ rim: [], fringe: [] });
    });

    it('⭐ never puts a fringe on the sand or the sea', () => {
        const ground = groundWith(24, 14, (c) => (c < 6 ? 'water' : (c < 9 ? 'sand' : 'grass')), { seed: 25 });
        setTuning('patchCoverage', 3);
        const plan = buildGroundPlan(ground);
        expect(plan.edges.fringe.length).toBeGreaterThan(0);
        for (const i of [...plan.edges.fringe, ...plan.edges.rim]) {
            expect(plan.palette[plan.terrainAt[i]], `lip at ${i}`).toBe('grass');
        }
    });
});
