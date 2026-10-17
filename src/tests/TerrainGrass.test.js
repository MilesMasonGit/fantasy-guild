import { describe, it, expect, afterEach } from 'vitest';
import {
    ramp, lighten, grassColours, grassNoise, earthNoise, grassShapeAt, buildGrassPlan, drawGrass, drawsGenerated,
    grassCells, GRASS_RULES, COLOUR, BIT
} from '../systems/board/TerrainGrass.js';
import { buildGroundPlan } from '../systems/board/TerrainSurface.js';
import { resolveArtPixels } from '../systems/board/TerrainLattice.js';
import { LOOKS, generatedOf } from '../config/registries/terrainRegistry.js';
import { setTuning, resetTuning } from '../config/playmatTuning.js';
import { groundWith, flat } from './fixtures/ground.js';

/**
 * Generated grass: the owner's settled ground prototype (`docs/active/research/ground_gen`) as the
 * game draws it. Shapes per plan pixel, from smooth noise; details per ground pixel of the screen.
 */

afterEach(() => resetTuning());

const meadow = (seed = 5, cols = 30, rows = 18) => groundWith(cols, rows, flat('grass'), { seed, biomes: null });
const forest = (seed = 5, cols = 30, rows = 18) => groundWith(cols, rows, flat('grass'), { seed });
/** Sea, a beach and forest grass side by side. */
const shore = (seed = 7) => groundWith(30, 16, (c) => (c < 6 ? 'water' : c < 10 ? 'sand' : 'grass'), { seed });

/** The ground grid at `unit` mat units a pixel, as the screen pass lays it over the plan. */
function gridOf(plan, unit) {
    const w = plan.width * plan.unit;
    const h = plan.height * plan.unit;
    const cols = Math.ceil(w / unit - 1e-6);
    const rows = Math.ceil(h / unit - 1e-6);
    const planCol = Int32Array.from({ length: cols }, (_, c) => Math.min(plan.width - 1, Math.floor(((c + 0.5) * unit) / plan.unit)));
    const planRow = Int32Array.from({ length: rows }, (_, r) => Math.min(plan.height - 1, Math.floor(((r + 0.5) * unit) / plan.unit)) * plan.width);
    return { cols, rows, planCol, planRow };
}

/** The details at `unit`, with each ground pixel's plan shape beside them. */
function detailsOf(plan, unit = 2) {
    const g = gridOf(plan, unit);
    const { colour, kinds } = drawGrass(plan.grass, plan.seed, g.cols, g.rows, g.planCol, g.planRow);
    const shape = new Uint8Array(g.cols * g.rows);
    for (let r = 0, i = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++, i++) shape[i] = plan.grass.bits[g.planRow[r] + g.planCol[c]];
    return { ...g, colour, kinds, shape };
}

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

describe('⭐ Colours: the prototype\'s hue-shifted ramps', () => {
    it('makes the meadow\'s ramps byte for byte as the prototype does', () => {
        // From gen.py's `ramp` with final_spec.json's colours.
        expect(ramp(0.26, 0.44, 0.60)).toEqual([[38, 111, 36], [65, 144, 41], [104, 179, 44], [151, 199, 63], [188, 203, 97]]);
        expect(ramp(0.06, 0.38, 0.32, 5, 0.02, 0.06)).toEqual([[84, 69, 48], [105, 80, 57], [127, 88, 65], [145, 95, 79], [161, 101, 93]]);
        expect(ramp(0.30, 0.36, 0.58)).toEqual([[27, 79, 38], [33, 111, 34], [59, 145, 38], [100, 170, 51], [144, 190, 69]]);
        expect(ramp(0.16, 0.50, 0.62)).toEqual([[100, 135, 42], [149, 170, 46], [206, 200, 48], [208, 177, 84], [212, 169, 119]]);
        expect(lighten([127, 88, 65], 1.08)).toEqual([137, 95, 70]);
    });

    it('darkens toward blue and lightens toward yellow', () => {
        const [dark, , mid, , light] = ramp(0.26, 0.44, 0.6);
        // Green over red falls as the hue turns toward yellow.
        expect(dark[1] / dark[0]).toBeGreaterThan(mid[1] / mid[0]);
        expect(mid[1] / mid[0]).toBeGreaterThan(light[1] / light[0]);
    });

    it('lays out a look\'s table as COLOUR says, the body\'s soft tone between its two greens', () => {
        const table = grassColours(generatedOf('meadow'), 0.55);
        expect(table.length).toBe(COLOUR.COUNT);
        expect(table[COLOUR.SOFT]).toEqual([86, 163, 42]);
        expect(table[COLOUR.MIDDLE]).toEqual([137, 95, 70]);
        expect(grassColours(generatedOf('meadow'), 0)[COLOUR.SOFT]).toEqual(table[COLOUR.GRASS + 1]);
        expect(grassColours(generatedOf('meadow'), 1)[COLOUR.SOFT]).toEqual(table[COLOUR.GRASS + 2]);
    });

    it('gives the meadow and the forest their own ramps, and no other look any', () => {
        expect(generatedOf('meadow')).toBeTruthy();
        expect(generatedOf('forest')).toBeTruthy();
        for (const id of ['mountain', 'coast', 'sea']) expect(generatedOf(id), id).toBeNull();
        expect(grassColours(generatedOf('forest'))).not.toEqual(grassColours(generatedOf('meadow')));
    });
});

describe('⭐ Shapes in the plan', () => {
    it('⭐ matches the slow reference at every pixel, with the shipped sliders and moved ones', () => {
        const check = (look) => {
            const ground = meadow(11, 16, 10);
            const pixels = resolveArtPixels(ground);
            const grass = buildGrassPlan(pixels, ground.seed, pixels.palette.map(() => look));
            let wrong = 0;
            for (let y = 0, i = 0; y < pixels.height; y++) {
                for (let x = 0; x < pixels.width; x++, i++) {
                    const ref = grassShapeAt(x, y, ground.seed, look, grass.thresholds[0]);
                    if (ref.bits !== grass.bits[i] || ref.kind + 1 !== (grass.kinds[i] & 3)) wrong++;
                }
            }
            return wrong;
        };
        expect(check('meadow')).toBe(0);
        expect(check('forest')).toBe(0);
        setTuning('grassClump', 20);
        setTuning('grassZoneScale', 0.6);
        setTuning('grassTall', 0.4);
        setTuning('grassEncroach', 0.5);
        setTuning('grassPatch', 0.3);
        setTuning('grassEarth', 2);
        expect(check('meadow')).toBe(0);
        expect(check('forest')).toBe(0);
    });

    it('⭐ is the same for the same Region every time, and another for another seed', () => {
        const a = buildGroundPlan(meadow(3)).grass;
        const b = buildGroundPlan(meadow(3)).grass;
        const c = buildGroundPlan(meadow(4)).grass;
        expect(same(a.bits, b.bits) && same(a.kinds, b.kinds)).toBe(true);
        expect(same(a.bits, c.bits)).toBe(false);
    });

    it('smooth noise stays in [0, 1) and moves a little from pixel to pixel', () => {
        let jump = 0;
        for (let x = 0; x < 400; x++) {
            const v = grassNoise(x, 17, 9, 16, 0x99);
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
            if (x) jump = Math.max(jump, Math.abs(v - grassNoise(x - 1, 17, 9, 16, 0x99)));
        }
        expect(jump).toBeLessThan(0.15);
    });

    it('draws nothing for a look that is not generated, and nothing at all with the switch off', () => {
        const ground = shore();
        const plan = buildGroundPlan(ground);
        const generated = plan.palette.map((t, p) => plan.grass.slotOf[p] >= 0);
        expect(plan.palette.filter((t, p) => generated[p])).toEqual(['grass']);
        for (let i = 0; i < plan.terrainAt.length; i++) {
            if (Boolean(plan.grass.kinds[i]) !== generated[plan.terrainAt[i]]) throw new Error(`kind at ${i}`);
        }
        setTuning('grassOn', 0);
        expect(drawsGenerated('forest')).toBe(false);
        expect(buildGroundPlan(ground).grass).toBeNull();
    });
});

describe('⭐ The earth, and the grass reaching into it', () => {
    /** Each plan pixel's earth noise and depth below the earth's edge, beside its shape. */
    function earthOf(ground) {
        const plan = buildGroundPlan(ground);
        const t = plan.grass.thresholds[0].earth;
        const out = [];
        for (let y = 0, i = 0; y < plan.height; y++) {
            for (let x = 0; x < plan.width; x++, i++) {
                const wear = earthNoise(x, y, ground.seed);
                out.push({ earth: Boolean(plan.grass.bits[i] & BIT.EARTH), depth: (wear - t) / (1 - t) });
            }
        }
        return out;
    }

    it('⭐ wears the earth share of the grass, and the grass takes back about two fifths of it', () => {
        setTuning('grassEncroach', 0);
        const bare = earthOf(meadow(21, 40, 24));
        const share = bare.filter(p => p.earth).length / bare.length;
        expect(share).toBeGreaterThan(LOOKS.meadow.generated.earthShare - 0.01);
        expect(share).toBeLessThan(LOOKS.meadow.generated.earthShare + 0.01);
        // With no encroachment the earth is exactly the noise above its level.
        expect(bare.filter(p => p.earth !== (p.depth > 0)).length).toBe(0);

        resetTuning();
        const reached = earthOf(meadow(21, 40, 24));
        const kept = reached.filter(p => p.earth).length / bare.length / share;
        expect(kept).toBeGreaterThan(0.45);
        expect(kept).toBeLessThan(0.75);
    });

    it('⭐ lets grass in near the earth\'s edge and never deep inside it', () => {
        const points = earthOf(meadow(22, 40, 24));
        // Never earth where the noise is below the earth's level.
        expect(points.some(p => p.earth && p.depth <= 0)).toBe(false);
        // Deep inside (the encroachment spent), all earth.
        const deep = points.filter(p => p.depth > 1 / GRASS_RULES.encroachDepth);
        expect(deep.length).toBeGreaterThan(100);
        expect(deep.every(p => p.earth)).toBe(true);
        // Just inside the edge, mostly grass: fingers and islands.
        const rim = points.filter(p => p.depth > 0 && p.depth < 0.05);
        expect(rim.filter(p => p.earth).length / rim.length).toBeLessThan(0.3);
    });

    it('follows the Earth amount slider, from none to more', () => {
        const count = () => {
            const { bits } = buildGroundPlan(meadow(23)).grass;
            return bits.reduce((n, b) => n + (b & BIT.EARTH), 0);
        };
        const shipped = count();
        expect(shipped).toBeGreaterThan(0);
        setTuning('grassEarth', 2);
        expect(count()).toBeGreaterThan(shipped * 1.5);
        setTuning('grassEarth', 0);
        expect(count()).toBe(0);
    });

    it('wears each look\'s own share: the forest a little more than the meadow, as its rules say', () => {
        setTuning('grassEncroach', 0);
        for (const [ground, look] of [[meadow(24, 40, 24), 'meadow'], [forest(24, 40, 24), 'forest']]) {
            const { bits } = buildGroundPlan(ground).grass;
            const share = bits.reduce((n, b) => n + (b & BIT.EARTH), 0) / bits.length;
            expect(share, look).toBeCloseTo(LOOKS[look].generated.earthShare, 2);
        }
        expect(LOOKS.forest.generated.earthShare).toBeGreaterThan(LOOKS.meadow.generated.earthShare);
    });
});

describe('⭐ Kinds of grass in ragged zones', () => {
    const kindsOf = (ground) => {
        const plan = buildGroundPlan(ground);
        return { plan, kinds: Array.from(plan.grass.kinds, k => (k & 3) - 1) };
    };

    it('⭐ shares the grass between tall, lawn and dry as the sliders say', () => {
        const { kinds } = kindsOf(meadow(31, 55, 35));
        const share = (k) => kinds.filter(v => v === k).length / kinds.length;
        expect(share(0)).toBeCloseTo(0.23, 1);
        expect(share(2)).toBeCloseTo(0.27, 1);
        expect(share(1)).toBeCloseTo(0.5, 1);
        setTuning('grassTall', 0);
        setTuning('grassDry', 0.5);
        const moved = kindsOf(meadow(31, 55, 35)).kinds;
        expect(moved.includes(0)).toBe(false);
        expect(moved.filter(v => v === 2).length / moved.length).toBeCloseTo(0.5, 1);
    });

    it('⭐ keeps lawn between tall and dry: they never touch', () => {
        const { plan, kinds } = kindsOf(meadow(32, 55, 35));
        const w = plan.width;
        let touching = 0;
        for (let i = 0; i < kinds.length; i++) {
            if (kinds[i] !== 0) continue;
            const x = i % w;
            for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (kinds[j] === 2) touching++;
        }
        expect(touching).toBe(0);
    });

    it('grows the zones with the zone scale', () => {
        const borders = () => {
            const { plan, kinds } = kindsOf(meadow(34, 55, 35));
            let n = 0;
            for (let i = 1; i < kinds.length; i++) if (i % plan.width && kinds[i] !== kinds[i - 1]) n++;
            return n;
        };
        setTuning('grassZoneScale', 0.6);
        const small = borders();
        setTuning('grassZoneScale', 2.4);
        expect(borders()).toBeLessThan(small * 0.6);
    });
});

describe('⭐ Details per ground pixel', () => {
    const STROKES = (k) => (k >= COLOUR.LOW && k < COLOUR.EARTH) || k === COLOUR.GRASS + 4;

    it('⭐ is the same for the same Region and window, and another for another seed', () => {
        const a = detailsOf(buildGroundPlan(meadow(41)));
        const b = detailsOf(buildGroundPlan(meadow(41)));
        const c = detailsOf(buildGroundPlan(meadow(42)));
        expect(same(a.colour, b.colour)).toBe(true);
        expect(same(a.colour, c.colour)).toBe(false);
    });

    it('⭐ keeps strokes off the earth: on earth the only grass is the tufts\' two colours', () => {
        for (const unit of [2, 1.35, 2.6]) {
            const d = detailsOf(buildGroundPlan(meadow(43)), unit);
            let earth = 0;
            for (let i = 0; i < d.colour.length; i++) {
                if (!(d.shape[i] & BIT.EARTH)) continue;
                earth++;
                const k = d.colour[i];
                const ok = (k >= COLOUR.EARTH && k <= COLOUR.MIDDLE) || k === COLOUR.GRASS + 2 || k === COLOUR.GRASS + 3;
                if (!ok) throw new Error(`colour ${k} on earth at ${i}, unit ${unit}`);
            }
            expect(earth).toBeGreaterThan(1000);
        }
    });

    it('⭐ keeps each kind\'s strokes on its own kind of grass', () => {
        const d = detailsOf(buildGroundPlan(meadow(44, 55, 35)));
        let tall = 0;
        let dry = 0;
        for (let i = 0; i < d.colour.length; i++) {
            const k = d.colour[i];
            const kind = (d.kinds[i] & 3) - 1;
            if (k >= COLOUR.LOW && k < COLOUR.HIGH) { tall++; expect(kind).toBe(0); }
            if (k >= COLOUR.HIGH && k < COLOUR.EARTH) { dry++; expect(kind).toBe(2); }
        }
        expect(tall).toBeGreaterThan(500);
        expect(dry).toBeGreaterThan(500);
    });

    it('⭐ draws strokes a ground pixel wide at every fit: as many to a pixel, whatever its size', () => {
        const plan = buildGroundPlan(meadow(45, 40, 24));
        const density = (unit) => {
            const d = detailsOf(plan, unit);
            let strokes = 0;
            let grass = 0;
            for (let i = 0; i < d.colour.length; i++) {
                if (d.colour[i] === COLOUR.NONE) continue;
                grass++;
                if (STROKES(d.colour[i]) || d.colour[i] === COLOUR.GRASS) strokes++;
            }
            return strokes / grass;
        };
        const atOne = density(2);
        for (const unit of [1.35, 2.6, 4]) {
            expect(density(unit) / atOne, `unit ${unit}`).toBeGreaterThan(0.85);
            expect(density(unit) / atOne, `unit ${unit}`).toBeLessThan(1.15);
        }
    });

    it('follows the stroke density and the patches', () => {
        const strokes = () => detailsOf(buildGroundPlan(meadow(46))).colour.filter(STROKES).length;
        const shipped = strokes();
        expect(shipped).toBeGreaterThan(0);
        setTuning('grassStrokes', 2);
        expect(strokes()).toBeGreaterThan(shipped * 1.5);
        setTuning('grassStrokes', 0);
        expect(strokes()).toBe(0);
        resetTuning();
        // Every pixel outside a patch, and nothing kept outside: no strokes.
        setTuning('grassPatch', 1);
        setTuning('grassPatchFloor', 0);
        expect(strokes()).toBe(0);
    });

    it('⭐ shades a mound under its own kind only, so no edge follows a zone or a beach', () => {
        const d = detailsOf(buildGroundPlan(shore(47)));
        const MOUND = BIT.MOUND;
        let shadows = 0;
        for (let i = 0; i < d.colour.length; i++) {
            if (d.colour[i] !== COLOUR.GRASS + 1) continue;
            shadows++;
            // Its mound: straight above or above to the left, of the same kind.
            const above = [i - d.cols, i - d.cols - 1].filter(j => d.kinds[j] === d.kinds[i] && (d.shape[j] & MOUND));
            expect(above.length, `shadow at ${i}`).toBeGreaterThan(0);
        }
        expect(shadows).toBeGreaterThan(200);
        setTuning('grassMounds', 0);
        expect(detailsOf(buildGroundPlan(shore(47))).colour.includes(COLOUR.GRASS + 1)).toBe(false);
    });

    it('⭐ leaves the beach and the sea to their sheets: nothing drawn off the generated ground', () => {
        const d = detailsOf(buildGroundPlan(shore(48)));
        let off = 0;
        for (let i = 0; i < d.colour.length; i++) {
            if (d.kinds[i]) continue;
            off++;
            expect(d.colour[i]).toBe(COLOUR.NONE);
        }
        expect(off).toBeGreaterThan(1000);
    });

    it('reuses the buffers it is handed, and draws the same into them', () => {
        const plan = buildGroundPlan(meadow(49));
        const g = gridOf(plan, 2);
        const fresh = drawGrass(plan.grass, plan.seed, g.cols, g.rows, g.planCol, g.planRow).colour.slice();
        const scratch = {};
        const first = drawGrass(plan.grass, plan.seed, g.cols, g.rows, g.planCol, g.planRow, scratch);
        const second = drawGrass(plan.grass, plan.seed, g.cols, g.rows, g.planCol, g.planRow, scratch);
        expect(second.colour).toBe(first.colour);
        expect(same(second.colour, fresh)).toBe(true);
    });

    it('⭐ draws the forest\'s own kinds: ferns at the low end, leaf litter thick at the high end', () => {
        const table = grassColours(generatedOf('forest'));
        expect(table[COLOUR.LOW + 2]).toEqual(ramp(0.36, 0.30, 0.55)[2]);
        expect(table[COLOUR.HIGH + 2]).toEqual(ramp(0.085, 0.38, 0.45)[2]);
        // Litter is laid at 0.08 a pixel, the meadow's dry grass at 0.054: thicker on its kind.
        const highShare = (ground) => {
            const d = detailsOf(buildGroundPlan(ground));
            let high = 0;
            let strokes = 0;
            for (let i = 0; i < d.colour.length; i++) {
                if ((d.kinds[i] & 3) !== 3 || (d.shape[i] & BIT.EARTH)) continue;
                high++;
                if (d.colour[i] >= COLOUR.HIGH && d.colour[i] < COLOUR.EARTH) strokes++;
            }
            return strokes / high;
        };
        expect(highShare(forest(51, 40, 24))).toBeGreaterThan(highShare(meadow(51, 40, 24)) * 1.15);
    });

    it('reads the clump size in mat units: 32 is the prototype\'s 16 pixels', () => {
        expect(grassCells('meadow').clump).toBe(16);
        expect(grassCells('meadow').zone).toBe(55);
        expect(grassCells('forest').zone).toBe(75);
    });
});
