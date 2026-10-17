import { describe, it, expect, afterEach } from 'vitest';
import {
    ramp, lighten, toward, grassColours, grassTable, grassNoise, earthNoise, grassShapeAt, buildGrassPlan, drawGrass,
    drawsGenerated, grassCells, lookRules, shadeRatio, waterBands, poolCentres, poolRingAt,
    GRASS_RULES, COLOUR, BIT, SHORE, KIND_MASK, SLOT_SHIFT, KIND_LIMIT, kindColour
} from '../systems/board/TerrainGrass.js';
import { buildGroundPlan } from '../systems/board/TerrainSurface.js';
import { resolveArtPixels } from '../systems/board/TerrainLattice.js';
import { LOOKS, generatedOf } from '../config/registries/terrainRegistry.js';
import { setTuning, resetTuning } from '../config/playmatTuning.js';
import { groundWith, flat } from './fixtures/ground.js';
import { hallSpot, HALL_CLEARING } from '../systems/atlas/Layout.js';

/**
 * Generated ground: the owner's settled ground prototype (`docs/active/research/ground_gen`) as the
 * game draws it. Shapes per plan pixel, from smooth noise and the shore's distance; details per
 * ground pixel of the screen.
 */

afterEach(() => resetTuning());

const meadow = (seed = 5, cols = 30, rows = 18) => groundWith(cols, rows, flat('grass'), { seed, biomes: null });
const forest = (seed = 5, cols = 30, rows = 18) => groundWith(cols, rows, flat('grass'), { seed });
/** A Region all of one look's ground. */
const lookGround = (id, seed = 5, cols = 30, rows = 18) => {
    const terrain = LOOKS[id].terrain;
    const biomes = id === 'meadow' ? null : { main: id, terrains: { [id]: terrain } };
    return groundWith(cols, rows, flat(terrain), { seed, biomes });
};
/** Sea, a beach and forest grass side by side. */
const shore = (seed = 7) => groundWith(30, 16, (c) => (c < 6 ? 'water' : c < 10 ? 'sand' : 'grass'), { seed });
/** A wide sea, then a beach and forest: room for every distance the sea draws. */
const bay = (seed = 7) => groundWith(40, 20, (c) => (c < 24 ? 'water' : c < 28 ? 'sand' : 'grass'), { seed });

const LAND_LOOKS = Object.keys(LOOKS).filter(id => !lookRules(id).water);

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

/** The details at `unit`, with each ground pixel's plan shape and plan index beside them. */
function detailsOf(plan, unit = 2) {
    const g = gridOf(plan, unit);
    const { colour, kinds, waves } = drawGrass(plan.grass, plan.seed, g.cols, g.rows, g.planCol, g.planRow);
    const shape = new Uint8Array(g.cols * g.rows);
    const planAt = new Int32Array(g.cols * g.rows);
    for (let r = 0, i = 0; r < g.rows; r++) {
        for (let c = 0; c < g.cols; c++, i++) {
            planAt[i] = g.planRow[r] + g.planCol[c];
            shape[i] = plan.grass.bits[planAt[i]];
        }
    }
    return { ...g, colour, kinds, waves, shape, planAt };
}

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const kindOf = (byte) => (byte & KIND_MASK) - 1;
/** Whether a colour is one of kind `k`'s strokes (its own ramp; a kind without one strokes its body). */
const strokeOf = (colour, k) => colour >= kindColour(k, COLOUR.STROKES) && colour < kindColour(k + 1, COLOUR.GRASS);
const anyStroke = (colour) => colour < COLOUR.DIM && colour >= COLOUR.KIND && (colour - COLOUR.KIND) % COLOUR.STRIDE >= COLOUR.STROKES;

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

    it('clamps a ramp that runs past white, as the prototype\'s picture did', () => {
        // The cherry grove's white petals: lightness 0.92, its lighter steps past 1.
        for (const c of ramp(0.0, 0.92, 0.20)) for (const v of c) expect(v).toBeLessThanOrEqual(255);
        expect(ramp(0.0, 0.92, 0.20)[4]).toEqual([255, 255, 255]);
    });

    it('lays out a look\'s table as COLOUR says, each kind\'s soft tone between its body\'s two tones', () => {
        const table = grassColours(generatedOf('meadow'), { soft: 0.55 });
        expect(table.length).toBe(COLOUR.KIND + 3 * COLOUR.STRIDE);
        expect(table[kindColour(0, COLOUR.SOFT)]).toEqual([86, 163, 42]);
        expect(table[COLOUR.MIDDLE]).toEqual([137, 95, 70]);
        const flat0 = grassColours(generatedOf('meadow'), { soft: 0 });
        const flat1 = grassColours(generatedOf('meadow'), { soft: 1 });
        expect(flat0[kindColour(0, COLOUR.SOFT)]).toEqual(table[kindColour(0, COLOUR.GRASS + 1)]);
        expect(flat1[kindColour(0, COLOUR.SOFT)]).toEqual(table[kindColour(0, COLOUR.GRASS + 2)]);
        // Lava's body is its ramp's two lighter tones.
        const volcano = grassColours(generatedOf('volcano'), { soft: 1 });
        expect(volcano[kindColour(1, COLOUR.SOFT)]).toEqual(volcano[kindColour(1, COLOUR.GRASS + 3)]);
    });

    it('gives every look its own rules and colours, and the sea a water table', () => {
        for (const id of Object.keys(LOOKS)) expect(generatedOf(id), id).toBeTruthy();
        expect(lookRules('sea').water).toBeTruthy();
        const tables = Object.keys(LOOKS).map(id => JSON.stringify(grassColours(generatedOf(id))));
        expect(new Set(tables).size).toBe(tables.length);
        for (const id of LAND_LOOKS) {
            expect(lookRules(id).kinds.length, id).toBeLessThanOrEqual(KIND_LIMIT);
            expect(grassColours(generatedOf(id)).length, id).toBeLessThanOrEqual(COLOUR.DIM);
        }
    });

    it('gives each kind its own body where its rules do: the mountain\'s alpine grass is green on grey rock', () => {
        const t = grassColours(generatedOf('mountain'));
        const [rock, alpine] = [t[kindColour(0, 2)], t[kindColour(1, 2)]];
        expect(alpine[1] - alpine[0]).toBeGreaterThan(40);
        expect(Math.max(...rock) - Math.min(...rock)).toBeLessThan(25);
    });
});

describe('⭐ Ground strength: every colour toward the look\'s middle tone', () => {
    const chroma = (c) => Math.max(...c) - Math.min(...c);
    const luma = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

    it('⭐ leaves every look as it is at 1', () => {
        for (const id of Object.keys(LOOKS)) {
            expect(grassColours(generatedOf(id), { strength: 1 }), id).toEqual(grassColours(generatedOf(id)));
        }
    });

    it('⭐ scales saturation and contrast by the strength, about the middle tone\'s grey', () => {
        const mid = ramp(0.26, 0.44, 0.60)[2];
        const m = luma(mid);
        const full = grassColours(generatedOf('meadow'), { strength: 1 });
        const soft = grassColours(generatedOf('meadow'), { strength: 0.85 });
        full.forEach((c, i) => {
            expect(chroma(soft[i])).toBeCloseTo(0.85 * chroma(c), -0.5);
            expect(luma(soft[i]) - m).toBeCloseTo(0.85 * (luma(c) - m), -0.5);
        });
        expect(toward([200, 100, 50], mid, 0).every(v => Math.abs(v - Math.round(m)) <= 1)).toBe(true);
    });

    it('follows its slider', () => {
        const before = grassColours(generatedOf('forest'));
        setTuning('groundStrength', 0.85);
        expect(grassColours(generatedOf('forest'))).not.toEqual(before);
    });
});

describe('⭐ Each look its own share of the shade pattern', () => {
    it('⭐ gives the forest twice the meadow\'s, as the prototype\'s 0.12 against 0.06, and the sea none', () => {
        expect(shadeRatio('meadow')).toBe(1);
        expect(shadeRatio('forest')).toBe(2);
        expect(shadeRatio('sea')).toBe(0);
        expect(shadeRatio('yellowstone')).toBeCloseTo(0.10 / 0.06, 9);
        expect(shadeRatio('coast')).toBeCloseTo(0.05 / 0.06, 9);
    });

    it('keeps the lakes, the wet sand and the waterline out of the pattern, as the prototype drew them flat', () => {
        const { unshaded } = grassTable('yellowstone');
        for (let k = 0; k < 5; k++) expect(unshaded[COLOUR.RING + k]).toBe(1);
        expect(unshaded[COLOUR.WET]).toBe(1);
        expect(unshaded[kindColour(0, COLOUR.GRASS + 2)]).toBe(0);
    });
});

describe('⭐ Shapes in the plan', () => {
    it('⭐ matches the slow reference at every pixel for every land look, with the shipped sliders and moved ones', () => {
        const check = (look) => {
            const ground = meadow(11, 16, 10);
            const pixels = resolveArtPixels(ground);
            const grass = buildGrassPlan(pixels, ground.seed, pixels.palette.map(() => look));
            let wrong = 0;
            for (let y = 0, i = 0; y < pixels.height; y++) {
                for (let x = 0; x < pixels.width; x++, i++) {
                    const ref = grassShapeAt(x, y, ground.seed, look, grass.thresholds[0]);
                    if (ref.bits !== grass.bits[i] || ref.kind + 1 !== (grass.kinds[i] & KIND_MASK)) wrong++;
                }
            }
            return wrong;
        };
        for (const id of LAND_LOOKS) expect(check(id), id).toBe(0);
        setTuning('grassClump', 20);
        setTuning('grassZoneScale', 0.6);
        setTuning('grassTall', 0.4);
        setTuning('grassEncroach', 0.5);
        setTuning('grassPatch', 0.3);
        setTuning('grassEarth', 2);
        for (const id of LAND_LOOKS) expect(check(id), id).toBe(0);
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

    it('draws every ground of a shore, and nothing at all with the switch off', () => {
        const ground = shore();
        const plan = buildGroundPlan(ground);
        expect(plan.palette.filter((t, p) => plan.grass.slotOf[p] >= 0).sort()).toEqual(['grass', 'sand', 'water']);
        expect(plan.grass.kinds.every(k => k > 0)).toBe(true);
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

    it('wears each look\'s own share: the forest a little more than the meadow, the mountain\'s gravel less, the sand none', () => {
        setTuning('grassEncroach', 0);
        for (const id of ['meadow', 'forest', 'mountain', 'yellowstone', 'coast', 'volcano', 'cherry_grove']) {
            const { bits } = buildGroundPlan(lookGround(id, 24, 40, 24)).grass;
            const share = bits.reduce((n, b) => n + (b & BIT.EARTH), 0) / bits.length;
            expect(share, id).toBeCloseTo(LOOKS[id].generated.earthShare, 2);
        }
        expect(LOOKS.forest.generated.earthShare).toBeGreaterThan(LOOKS.meadow.generated.earthShare);
    });
});

describe('⭐ Kinds of ground in ragged zones', () => {
    const kindsOf = (ground) => {
        const plan = buildGroundPlan(ground);
        return { plan, kinds: Array.from(plan.grass.kinds, kindOf) };
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

    it('⭐ lays the flower meadow\'s drifts between calm lawn, every kind in its band of the noise', () => {
        const { kinds } = kindsOf(lookGround('flower_meadow', 35, 55, 35));
        const share = (k) => kinds.filter(v => v === k).length / kinds.length;
        // Six bands: pink, lawn, purple, lawn, white, lawn: the lawn three of them, in the middle.
        expect(share(1)).toBeGreaterThan(0.4);
        for (const k of [0, 2, 3]) expect(share(k), `kind ${k}`).toBeGreaterThan(0.02);
    });

    it('⭐ draws the mountain\'s alpine grass in long thin seams, stretched along x and broken by the gap', () => {
        const { plan, kinds } = kindsOf(lookGround('mountain', 36, 55, 35));
        const w = plan.width;
        const h = plan.height;
        const alpine = kinds.filter(k => k === 1).length / kinds.length;
        expect(alpine).toBeGreaterThan(0.01);
        expect(alpine).toBeLessThan(0.12);
        // The bands lie along x: the scree's edge is crossed far more often going down than across.
        let acrossX = 0;
        let acrossY = 0;
        for (let i = 0; i < kinds.length - w; i++) {
            if (i % w < w - 1 && (kinds[i] === 2) !== (kinds[i + 1] === 2)) acrossX++;
            if ((kinds[i] === 2) !== (kinds[i + w] === 2)) acrossY++;
        }
        expect(acrossY).toBeGreaterThan(acrossX * 1.2);
        void h;
        // Its band is cut into pieces by the gap, and stretched three times along x.
        expect(lookRules('mountain').zones.gap.band).toBe(1);
        const cells = grassCells('mountain');
        expect(cells.zoneX).toBe(3 * cells.zoneY);
    });

    it('⭐ lays the cherry grove\'s green patches over its zones where their own noise rises', () => {
        const { kinds } = kindsOf(lookGround('cherry_grove', 37, 55, 35));
        const green = kinds.filter(k => k === 3).length / kinds.length;
        expect(green).toBeGreaterThan(0.03);
        expect(green).toBeLessThan(0.35);
    });
});

describe('⭐ Details per ground pixel', () => {
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
                const kind = kindOf(d.kinds[i]);
                const ok = (k >= COLOUR.EARTH && k <= COLOUR.MIDDLE) || k === kindColour(kind, 2) || k === kindColour(kind, 3);
                if (!ok) throw new Error(`colour ${k} on earth at ${i}, unit ${unit}`);
            }
            expect(earth).toBeGreaterThan(1000);
        }
    });

    it('⭐ keeps each kind\'s strokes on its own kind of ground', () => {
        for (const id of ['meadow', 'mountain', 'flower_meadow', 'volcano']) {
            const d = detailsOf(buildGroundPlan(lookGround(id, 44, 55, 35)));
            const kinds = lookRules(id).kinds;
            const counts = kinds.map(() => 0);
            for (let i = 0; i < d.colour.length; i++) {
                const k = d.colour[i];
                const owner = kinds.findIndex((kind, j) => kind.strokes && strokeOf(k, j));
                if (owner < 0) continue;
                counts[owner]++;
                // A stroke stands on its own kind; a kind's shadow and the earth's edge are not strokes.
                if (kindOf(d.kinds[i]) !== owner) throw new Error(`${id}: kind ${owner}'s stroke on kind ${kindOf(d.kinds[i])} at ${i}`);
            }
            kinds.forEach((kind, j) => {
                if (kind.strokes) expect(counts[j], `${id} ${kind.id}`).toBeGreaterThan(50);
            });
        }
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
                const k = d.colour[i];
                if (anyStroke(k) || k === kindColour(kindOf(d.kinds[i]), COLOUR.GRASS)) strokes++;
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
        const strokes = () => detailsOf(buildGroundPlan(meadow(46))).colour.filter(anyStroke).length;
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
        const shadowsOf = (plan) => {
            const d = detailsOf(plan);
            const land = (i) => d.kinds[i] && !lookRules(plan.grass.looks[d.kinds[i] >> SLOT_SHIFT]).water;
            const out = [];
            for (let i = 0; i < d.colour.length; i++) {
                if (!land(i) || (d.shape[i] & BIT.EARTH)) continue;
                if (d.colour[i] === kindColour(kindOf(d.kinds[i]), COLOUR.GRASS + 1)) out.push(i);
            }
            return { d, out };
        };
        const { d, out } = shadowsOf(buildGroundPlan(shore(47)));
        for (const i of out) {
            // Its mound: straight above or above to the left, of the same kind.
            const above = [i - d.cols, i - d.cols - 1].filter(j => d.kinds[j] === d.kinds[i] && (d.shape[j] & BIT.MOUND));
            expect(above.length, `shadow at ${i}`).toBeGreaterThan(0);
        }
        expect(out.length).toBeGreaterThan(200);
        setTuning('grassMounds', 0);
        expect(shadowsOf(buildGroundPlan(shore(47))).out.length).toBe(0);
    });

    it('reuses the buffers it is handed, and draws the same into them', () => {
        const plan = buildGroundPlan(shore(49));
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
        expect(table[kindColour(0, COLOUR.STROKES + 2)]).toEqual(ramp(0.36, 0.30, 0.55)[2]);
        expect(table[kindColour(2, COLOUR.STROKES + 2)]).toEqual(ramp(0.085, 0.38, 0.45)[2]);
        // Litter is laid at 0.08 a pixel, the meadow's dry grass at 0.054: thicker on its kind.
        const highShare = (ground) => {
            const d = detailsOf(buildGroundPlan(ground));
            let high = 0;
            let strokes = 0;
            for (let i = 0; i < d.colour.length; i++) {
                if (kindOf(d.kinds[i]) !== 2 || (d.shape[i] & BIT.EARTH)) continue;
                high++;
                if (strokeOf(d.colour[i], 2)) strokes++;
            }
            return strokes / high;
        };
        expect(highShare(forest(51, 40, 24))).toBeGreaterThan(highShare(meadow(51, 40, 24)) * 1.15);
    });

    it('reads the clump size in mat units: 32 is the prototype\'s 16 pixels', () => {
        expect(grassCells('meadow').clump).toBe(16);
        expect(grassCells('meadow').zone).toBe(55);
        expect(grassCells('forest').zone).toBe(75);
        expect(grassCells('volcano').zoneX).toBe(110);
    });

    it('⭐ reaches the cherry grove\'s green blades over the patches\' top edge, and shades the moss under them', () => {
        const plan = buildGroundPlan(lookGround('cherry_grove', 52, 55, 35));
        const d = detailsOf(plan);
        const green = (b) => kindOf(b) === 3;
        let over = 0;
        let dimmed = 0;
        for (let i = d.cols; i < d.colour.length; i++) {
            const k = d.colour[i];
            if (!green(d.kinds[i]) && k >= kindColour(3, 0) && k < kindColour(3, COLOUR.SOFT)) over++;
            if (k >= COLOUR.DIM) {
                dimmed++;
                expect(green(d.kinds[i - d.cols]), `shadow at ${i}`).toBe(true);
            }
        }
        expect(over).toBeGreaterThan(100);
        expect(dimmed).toBeGreaterThan(100);
    });
});

describe('⭐ The sea and the shore', () => {
    /** Each water ground pixel's distance class, and the class's lower distance. */
    const seaOf = (seed) => {
        const plan = buildGroundPlan(bay(seed));
        const d = detailsOf(plan);
        const slot = plan.grass.looks.indexOf('sea');
        const bands = plan.grass.bands[slot];
        const from = (cls) => (cls <= 1 ? 0 : bands[cls - 2]);
        return { plan, d, slot, bands, from };
    };
    const water = LOOKS.sea.generated.water;

    it('⭐ draws foam at the shore, then shallows, then deeper water, step by step out to sea', () => {
        const { plan, d, slot, from } = seaOf(61);
        let foam = 0;
        let deep = 0;
        for (let i = 0; i < d.colour.length; i++) {
            if (d.kinds[i] >> SLOT_SHIFT !== slot || !(d.kinds[i] & KIND_MASK)) continue;
            const f = from(plan.grass.shore[d.planAt[i]]);
            const k = d.colour[i];
            if (k === COLOUR.FOAM) { foam++; expect(f, `foam at ${i}`).toBeLessThan(water.foam); }
            if (k === COLOUR.SEA && f < water.deep) {
                // Sea[0] near the shore is only ever a wave's trough.
                expect(f).toBeGreaterThanOrEqual(water.shallow);
            }
            if (k === COLOUR.SEA && f >= water.deep) deep++;
        }
        expect(foam).toBeGreaterThan(100);
        expect(deep).toBeGreaterThan(1000);
    });

    it('⭐ keeps the drawn shore on the computed one: the shore class 1 lies against the land', () => {
        const { plan } = seaOf(62);
        const slot = plan.grass.looks.indexOf('sea');
        const w = plan.width;
        let touching = 0;
        for (let i = 0; i < plan.grass.kinds.length; i++) {
            if ((plan.grass.kinds[i] >> SLOT_SHIFT) !== slot || i % w === w - 1) continue;
            const right = plan.grass.kinds[i + 1];
            if (right && (right >> SLOT_SHIFT) !== slot) {
                touching++;
                expect(plan.grass.shore[i], `water at ${i} beside land`).toBeLessThanOrEqual(2);
            }
        }
        expect(touching).toBeGreaterThan(50);
    });

    it('⭐ spaces the waves: none starts within the gap of another\'s crest', () => {
        const { d } = seaOf(63);
        const g = water.waveGap;
        expect(d.waves.length).toBeGreaterThan(20);
        for (let a = 0; a < d.waves.length; a++) {
            for (let b = a + 1; b < d.waves.length; b++) {
                const [p, q] = [d.waves[a], d.waves[b]];
                if (Math.abs(p.y - q.y) > g) continue;
                const apart = p.x + p.length - 1 < q.x - g || p.x > q.x + q.length + g - 1;
                if (!apart) throw new Error(`waves at ${p.x},${p.y} and ${q.x},${q.y} too close`);
            }
        }
    });

    it('⭐ grows the waves with distance from the shore: short near, long far out, a second crest farthest', () => {
        const { plan, d, from } = seaOf(64);
        const near = [];
        const far = [];
        for (const wv of d.waves) {
            const f = from(plan.grass.shore[d.planAt[wv.y * d.cols + wv.x]]);
            expect(f).toBeGreaterThanOrEqual(water.shallow);
            const lens = water.waveLengths.filter(([at]) => f >= at).pop()[1];
            expect(lens, `length ${wv.length} at ${f}`).toContain(wv.length);
            (f < water.waveLengths[1][0] ? near : f >= water.waveLengths[3][0] ? far : []).push(wv);
            expect(wv.far).toBe(f >= water.farThick);
        }
        const mean = (xs) => xs.reduce((n, w) => n + w.length, 0) / xs.length;
        expect(near.length).toBeGreaterThan(3);
        expect(far.length).toBeGreaterThan(3);
        expect(mean(far)).toBeGreaterThan(mean(near) * 3);
    });

    it('lists the sea\'s distances in order, every rule\'s step among them', () => {
        const bands = waterBands(water);
        expect([...bands].sort((a, b) => a - b)).toEqual(bands);
        for (const at of [water.foam, water.shallow, water.deep, water.farThick, ...water.waveLengths.map(([x]) => x)]) expect(bands).toContain(at);
    });

    it('⭐ wets the sand by the water and dithers its waterline, and nowhere else', () => {
        const plan = buildGroundPlan(bay(65));
        const d = detailsOf(plan);
        const sand = plan.grass.looks.indexOf('coast');
        let wet = 0;
        const sea = plan.grass.looks.indexOf('sea');
        for (let i = 0; i < d.colour.length; i++) {
            const k = d.colour[i];
            if ((k !== COLOUR.WET && k !== COLOUR.LINE) || (d.kinds[i] >> SLOT_SHIFT) === sea) continue;
            expect(d.kinds[i] >> SLOT_SHIFT, `wet at ${i}`).toBe(sand);
            expect([SHORE.WET, SHORE.LINE]).toContain(plan.grass.shore[d.planAt[i]]);
            wet++;
        }
        expect(wet).toBeGreaterThan(200);
        // The beach's far side, by the forest, is dry.
        for (let i = 0; i < plan.grass.shore.length; i++) {
            if (plan.grass.shore[i] >= SHORE.LINE) expect(i % plan.width).toBeLessThan(28 * 16 - 4);
        }
    });
});

describe('⭐ Yellowstone\'s sulphur lakes', () => {
    const lakeGround = (seed = 71) => lookGround('yellowstone', seed, 40, 24);
    /** The Hall's ring on the plan, which the plan keeps its lakes out of. */
    const clearOf = (ground) => {
        const hall = hallSpot(ground.mat);
        return { x: hall.x / 2, y: hall.y / 2, r: HALL_CLEARING / 2 };
    };

    it('⭐ match the slow reference at every pixel', () => {
        const ground = lakeGround();
        const plan = buildGroundPlan(ground);
        const pools = lookRules('yellowstone').pools;
        const centres = poolCentres(plan.width, plan.height, ground.seed, pools, clearOf(ground));
        expect(centres.length).toBeGreaterThan(0);
        let wrong = 0;
        let lake = 0;
        for (let y = 0, i = 0; y < plan.height; y++) {
            for (let x = 0; x < plan.width; x++, i++) {
                const ref = poolRingAt(x, y, ground.seed, pools, centres);
                if (ref !== plan.grass.ring[i]) wrong++;
                if (ref) lake++;
            }
        }
        expect(wrong).toBe(0);
        expect(lake).toBeGreaterThan(1000);
    });

    it('⭐ ring each lake from its milky middle out to the pale yellow crust', () => {
        const ground = lakeGround(72);
        const plan = buildGroundPlan(ground);
        const pools = lookRules('yellowstone').pools;
        const steps = [0, 0.3, 0.55, 0.7, 0.8];
        const sums = steps.map(() => 0);
        const counts = steps.map(() => 0);
        for (const { x, y, r } of poolCentres(plan.width, plan.height, ground.seed, pools, clearOf(ground))) {
            expect(plan.grass.ring[Math.round(y) * plan.width + Math.round(x)]).toBe(1);
            steps.forEach((t, k) => {
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 0.75], [0, -0.75]]) {
                    const v = plan.grass.ring[Math.round(y + dy * t * r) * plan.width + Math.round(x + dx * t * r)];
                    if (v) { sums[k] += v; counts[k]++; }
                }
            });
        }
        const means = sums.map((v, k) => v / counts[k]);
        for (let k = 1; k < means.length; k++) expect(means[k], `at ${steps[k]} of the radius`).toBeGreaterThan(means[k - 1]);
    });

    it('come as often as the prototype\'s, per piece of the mat its size, and follow the slider', () => {
        const pools = lookRules('yellowstone').pools;
        expect(poolCentres(320, 200, 1, pools).length).toBe(2);
        expect(poolCentres(880, 563, 1, pools).length).toBe(15);
        setTuning('groundLakes', 0);
        expect(poolCentres(880, 563, 1, pools).length).toBe(0);
        expect(buildGroundPlan(lakeGround()).grass.ring).toBeNull();
    });

    it('⭐ keep out of the Guild Hall\'s ring', () => {
        const pools = lookRules('yellowstone').pools;
        const clear = { x: 440, y: 281, r: 112 };
        for (let seed = 1; seed <= 20; seed++) {
            const centres = poolCentres(880, 563, seed, pools, clear);
            expect(centres.length).toBeGreaterThan(10);
            for (let y = 169; y <= 393; y += 4) {
                for (let x = 328; x <= 552; x += 4) {
                    if (Math.hypot(x - clear.x, y - clear.y) > clear.r) continue;
                    expect(poolRingAt(x, y, seed, pools, centres), `seed ${seed} at ${x},${y}`).toBe(0);
                }
            }
        }
    });

    it('keep the scatter out of the lakes', () => {
        const plan = buildGroundPlan(lakeGround(74));
        expect(plan.props.length).toBeGreaterThan(0);
        for (const p of plan.props) expect(plan.grass.ring[p.footY * plan.width + p.footX], `${p.sheet} at ${p.footX},${p.footY}`).toBe(0);
    });

    it('draw their rings over the ground in the screen\'s details', () => {
        const plan = buildGroundPlan(lakeGround(73));
        const d = detailsOf(plan);
        let rings = 0;
        for (let i = 0; i < d.colour.length; i++) {
            const v = plan.grass.ring[d.planAt[i]];
            if (!v) continue;
            rings++;
            expect(d.colour[i]).toBe(COLOUR.RING + v - 1);
        }
        expect(rings).toBeGreaterThan(1000);
    });
});
