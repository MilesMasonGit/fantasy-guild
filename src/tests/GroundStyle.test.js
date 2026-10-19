import { describe, it, expect, afterEach } from 'vitest';
import {
    cleanColour, cleanOf, quietDecorations, detailRules, drawGrass, grassColours, grassTable, lookRules, ramp,
    COLOUR, KIND_MASK, GRASS_RULES, kindColour
} from '../systems/board/TerrainGrass.js';
import { buildGroundPlan } from '../systems/board/TerrainSurface.js';
import { groundTone } from '../systems/board/TerrainBlend.js';
import {
    buildScreenPass, screenGrid, propCell, rimShade, RIM, MAT_EDGE, groundPixel
} from '../ui/components/board/groundScreen.js';
import { LOOKS, generatedOf, SHEET_PX, PROP_PX, PROP_SHEET_CELLS } from '../config/registries/terrainRegistry.js';
import { setTuning, resetTuning, tuning, CLEAN_LOOKS, cleanKeys } from '../config/playmatTuning.js';
import { regionGround } from '../systems/atlas/regionGround.js';
import { groundWith, flat } from './fixtures/ground.js';

/**
 * The ground's look: each generated look in its Clean colours (style2.py's table P),
 * the ground drawn at twice the Tokens' pixel with its details drawn for that size, its loud little
 * things quietened toward the ground round them, and a darker rim in two hard steps.
 */

afterEach(() => resetTuning());

const MAT = Object.freeze({ w: 1760, h: 1126 });
const LAND = Object.keys(LOOKS).filter(id => !lookRules(id).water);

/** Hue in turns, saturation and value, as `colorsys.rgb_to_hsv`. */
function hsv([r, g, b]) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [((h / 6) + 1) % 1, max ? d / max : 0, max / 255];
}

/** A grid laid over a plan as the screen pass lays it: `unit` mat units a ground pixel. */
function gridOf(plan, unit) {
    const g = screenGrid({ w: plan.width * plan.unit, h: plan.height * plan.unit }, unit);
    const planCol = Int32Array.from({ length: g.cols }, (_, c) => Math.min(plan.width - 1, Math.floor(((c + 0.5) * unit) / plan.unit)));
    const planRow = Int32Array.from({ length: g.rows }, (_, r) => Math.min(plan.height - 1, Math.floor(((r + 0.5) * unit) / plan.unit)) * plan.width);
    return { ...g, planCol, planRow };
}

/** A 64 × 64 sheet of one colour. */
function solid(r, g, b) {
    const out = new Uint8ClampedArray(SHEET_PX * SHEET_PX * 4);
    for (let i = 0; i < out.length; i += 4) { out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255; }
    return out;
}

/** A plan of one flat sheet over the whole mat, as the screen pass tests build it. */
function flatPlan(seed = 1) {
    const width = MAT.w / 2;
    const height = MAT.h / 2;
    return {
        width, height, unit: 2, seed, sheets: ['flat'], sheetAt: new Uint8Array(width * height),
        tints: [], tintAt: new Int8Array(width * height).fill(-1), props: []
    };
}

describe('⭐ Clean colours per look, in the palette', () => {
    it('⭐ gives every look the prototype\'s table P: the biomes their own, the waters and the lawn their biome\'s', () => {
        for (const id of Object.keys(LOOKS)) expect(CLEAN_LOOKS[id], id).toBeTruthy();
        expect(CLEAN_LOOKS.meadow).toEqual([0.72, -0.022, 1.04]);
        expect(CLEAN_LOOKS.forest).toEqual([0.80, 0.030, 1.00]);
        expect(CLEAN_LOOKS.volcano).toEqual([0.85, 0, 1.00]);
        expect(CLEAN_LOOKS.sea).toEqual(CLEAN_LOOKS.coast);
        expect(CLEAN_LOOKS.lawn).toEqual(CLEAN_LOOKS.meadow);
        for (const id of ['sea', 'lake', 'sulphur']) expect(CLEAN_LOOKS[id][1], id).toBe(0);
    });

    it('⭐ makes a colour as PIL\'s hue turn, Color and Brightness did in style4.py (within its byte rounding)', () => {
        // From PIL 12 with `colour_only`: each of the prototype's own colours through its look's P.
        const cases = [
            [[104, 179, 44], CLEAN_LOOKS.meadow, [135, 176, 74]],
            [[54, 130, 45], CLEAN_LOOKS.forest, [55, 123, 60]],
            [[206, 200, 48], CLEAN_LOOKS.meadow, [202, 178, 84]],
            [[127, 88, 65], CLEAN_LOOKS.mountain, [124, 96, 75]],
            [[215, 120, 166], CLEAN_LOOKS.flower_meadow, [208, 138, 178]],
            [[30, 90, 120], CLEAN_LOOKS.sea, [37, 89, 116]]
        ];
        for (const [rgb, p, pil] of cases) {
            const got = cleanColour(rgb, p);
            // PIL turns the hue in whole 256ths of the wheel: a yellow moves a few bytes more.
            for (let ch = 0; ch < 3; ch++) expect(Math.abs(got[ch] - pil[ch]), `${rgb} channel ${ch}`).toBeLessThanOrEqual(6);
        }
    });

    it('leaves a colour as it is at strength 1, no hue and brightness 1, and makes it its grey at strength 0', () => {
        expect(cleanColour([104, 179, 44], [1, 0, 1])).toEqual([104, 179, 44]);
        const grey = Math.round(0.299 * 104 + 0.587 * 179 + 0.114 * 44);
        expect(cleanColour([104, 179, 44], [0, 0, 1])).toEqual([grey, grey, grey]);
        expect(cleanColour([100, 100, 100], [1, 0, 1.1])).toEqual([110, 110, 110]);
        expect(cleanColour([255, 0, 0], [1, 1 / 3, 1])).toEqual([0, 255, 0]);
    });

    it('⭐ draws each look\'s table in its own Clean colours, and the rules\' own with the switch off', () => {
        for (const id of Object.keys(LOOKS)) {
            const raw = grassColours(generatedOf(id));
            const drawn = grassTable(id).colours;
            // The body ramps and the earth: never a decoration, so only the Clean colours move them.
            const p = cleanOf(id);
            expect(p, id).toEqual(CLEAN_LOOKS[id]);
            expect(drawn[0], id).toEqual(cleanColour(raw[0], p));
            setTuning('cleanOn', 0);
            expect(cleanOf(id)).toBeNull();
            expect(grassTable(id).colours[0], id).toEqual(raw[0]);
            resetTuning();
        }
    });

    it('⭐ turns the grassy looks a touch toward olive and the woods toward blue-green, and takes colour out of every biome', () => {
        const hueOf = (id, clean) => {
            setTuning('cleanOn', clean ? 1 : 0);
            const rules = lookRules(id);
            const t = grassTable(id).colours;
            resetTuning();
            return hsv(t[kindColour(rules.kinds.findIndex(k => k.id === 'lawn' || k.id === 'moss' || k.id === 'fern'), COLOUR.SOFT)]);
        };
        // Olive: toward yellow, a smaller hue for a green; blue-green: a larger one.
        expect(hueOf('meadow', true)[0]).toBeLessThan(hueOf('meadow', false)[0]);
        expect(hueOf('forest', true)[0]).toBeGreaterThan(hueOf('forest', false)[0]);
        expect(hueOf('yellowstone', true)[0]).toBeGreaterThan(hueOf('yellowstone', false)[0]);
        for (const id of ['meadow', 'flower_meadow', 'forest', 'cherry_grove', 'yellowstone', 'mountain', 'coast', 'volcano']) {
            expect(hueOf(id, true)[1], id).toBeLessThan(hueOf(id, false)[1]);
        }
    });

    it('moves one look\'s colours with its own sliders and no other look\'s', () => {
        const before = Object.fromEntries(Object.keys(LOOKS).map(id => [id, JSON.stringify(grassTable(id).colours)]));
        setTuning(cleanKeys('forest').strength, 0.4);
        for (const id of Object.keys(LOOKS)) {
            expect(JSON.stringify(grassTable(id).colours) === before[id], id).toBe(id !== 'forest');
        }
    });

    it('mixes a fade in the other ground\'s Clean colours', () => {
        const tone = groundTone('forest');
        setTuning('cleanOn', 0);
        expect(groundTone('forest')).not.toEqual(tone);
    });
});

describe('⭐ Quieter decorations, in the palette', () => {
    it('⭐ pulls a loud stroke colour the slider\'s share of the way toward its kind\'s ground, and leaves a quiet one', () => {
        const rules = lookRules('flower_meadow');
        const raw = grassColours(generatedOf('flower_meadow'));
        const table = quietDecorations(raw.map(c => [...c]), rules, 0.5, 90);
        const pink = kindColour(0, COLOUR.STROKES + rules.kinds[0].tone);
        // The pink flower's contrast with the green round it is far past 90: halfway.
        const kind = rules.kinds[0];
        const body = [0, 1, 2].map(ch => (raw[kindColour(0, COLOUR.SOFT)][ch] + raw[kindColour(0, COLOUR.GRASS + kind.body[1])][ch]) / 2);
        const cover = Math.min(0.5, kind.blades * kind.cluster * (kind.heights.reduce((a, b) => a + b, 0) / kind.heights.length));
        const ground = body.map((v, ch) => v + (raw[pink][ch] - v) * cover);
        expect(table[pink]).toEqual(raw[pink].map((v, ch) => Math.round(v + (ground[ch] - v) * 0.5)));
        // The bodies, the earth, the banks and the soft tones never move.
        for (let i = 0; i < raw.length; i++) {
            const slot = i >= COLOUR.KIND ? (i - COLOUR.KIND) % COLOUR.STRIDE : -1;
            if (slot >= COLOUR.STROKES || i === COLOUR.PEBBLE || i === COLOUR.PEBBLE_DARK) continue;
            expect(table[i], `colour ${i}`).toEqual(raw[i]);
        }
        // Nothing past the threshold: nothing moves.
        expect(quietDecorations(raw.map(c => [...c]), rules, 0.5, 765)).toEqual(raw);
        expect(quietDecorations(raw.map(c => [...c]), rules, 0, 0)).toEqual(raw);
    });

    it('⭐ never changes a body colour a kind without its own strokes shares with them', () => {
        const rules = lookRules('meadow');
        const raw = grassColours(generatedOf('meadow'));
        const lawn = rules.kinds.findIndex(k => !k.strokes);
        const table = quietDecorations(raw.map(c => [...c]), rules, 1, 0);
        for (let s = 0; s < 5; s++) expect(table[kindColour(lawn, COLOUR.GRASS + s)]).toEqual(raw[kindColour(lawn, COLOUR.GRASS + s)]);
        expect(table[kindColour(lawn, COLOUR.STROKES + 4)]).not.toEqual(raw[kindColour(lawn, COLOUR.STROKES + 4)]);
    });

    it('⭐ quietens with its slider and leaves water alone', () => {
        const flowers = () => JSON.stringify(grassTable('flower_meadow').colours);
        const sea = () => JSON.stringify(grassTable('sea').colours);
        const lake = () => JSON.stringify(grassTable('lake').colours);
        const shipped = [flowers(), sea(), lake()];
        setTuning('decorQuiet', 0);
        expect(flowers()).not.toBe(shipped[0]);
        expect(sea()).toBe(shipped[1]);
        expect(lake()).toBe(shipped[2]);
    });

    it('draws the pebbles in their own colours, which start as the earth\'s', () => {
        const raw = grassColours(generatedOf('meadow'));
        expect(raw[COLOUR.PEBBLE]).toEqual(raw[COLOUR.EARTH + 3]);
        expect(raw[COLOUR.PEBBLE_DARK]).toEqual(raw[COLOUR.EARTH]);
        for (const id of LAND) expect(grassColours(generatedOf(id)).length, id).toBeLessThanOrEqual(COLOUR.DIM);
    });
});

describe('⭐ The ground at twice the Tokens\' pixel', () => {
    it('⭐ ships at two Token pixels a ground pixel, the slider moving it from 1 to 3', () => {
        expect(groundPixel()).toBe(2);
        setTuning('groundPixel', 1);
        expect(groundPixel()).toBe(1);
        setTuning('groundPixel', 3);
        expect(groundPixel()).toBe(3);
    });

    it('⭐ draws the details as the prototype did at one Token pixel a ground pixel', () => {
        const d = detailRules(1);
        for (const L of [1, 2, 3, 4, 7, 9]) expect(d.size(L)).toBe(L);
        for (const p of [0.004, 0.054, 0.3]) {
            expect(d.many(p)).toBe(p);
            expect(d.count(p)).toBe(p);
        }
        expect(d).toMatchObject({ line: 1, reach: 3, back: 1, sunken: 2 });
        for (const n of [1, 2, 3, 5, 7]) expect(d.clusterOf(n)).toEqual({ count: n, rarer: 1 });
        expect(d.small).toEqual({
            pebbles: GRASS_RULES.pebbles, wide: true, tufts: GRASS_RULES.earthTufts,
            blades: [...GRASS_RULES.earthTuftBlades], heights: [...GRASS_RULES.earthTuftHeights], hang: true
        });
    });

    it('⭐ sizes the details for a ground pixel two Token pixels across', () => {
        const d = detailRules(2);
        // Lengths in Token pixels to the nearest whole ground pixel, never none.
        expect([3, 3, 4].map(d.size)).toEqual([2, 2, 2]);
        expect([2, 2, 3].map(d.size)).toEqual([1, 1, 2]);
        expect([1, 2, 2].map(d.size)).toEqual([1, 1, 1]);
        expect([6, 7, 8, 9].map(d.size)).toEqual([3, 4, 4, 5]);
        // A cluster's footprint stays three Token pixels square: two ground pixels, as many blades to it.
        expect(d).toMatchObject({ reach: 2, back: 0, sunken: 1, line: 0.5 });
        expect(d.clusterOf(5)).toEqual({ count: 3, rarer: 1 });
        expect(d.clusterOf(2)).toEqual({ count: 1, rarer: 8 / 9 });
        // Clusters come 2 ^ marksAt as often a ground pixel; waves as often to the sea.
        expect(d.many(0.05)).toBeCloseTo(0.05 * 2 ** GRASS_RULES.marksAt, 12);
        expect(d.count(0.007)).toBeCloseTo(0.028, 12);
        expect(d.many(0.9)).toBe(1);
        // A pebble a ground pixel and its shadow, as much of the earth covered as before.
        expect(d.small.wide).toBe(false);
        expect(d.small.pebbles * 2).toBeCloseTo(GRASS_RULES.pebbles * 2.5, 12);
        expect(d.small.hang).toBe(false);
    });

    it('⭐ draws no blade taller at two Token pixels than half its height in Token pixels, rounded', () => {
        const plan = buildGroundPlan(groundWith(40, 24, flat('grass'), { seed: 61, biomes: null }));
        const tallest = (pixel) => {
            const g = gridOf(plan, 2 * pixel);
            const { colour, kinds } = drawGrass(plan.grass, plan.seed, g.cols, g.rows, g.planCol, g.planRow, null, pixel);
            const rules = lookRules('meadow');
            // The tall grass's tone, a run of it straight down: no other mark draws it.
            const k = rules.kinds.findIndex(x => x.id === 'tall');
            const tone = kindColour(k, COLOUR.STROKES + rules.kinds[k].tone);
            let longest = 0;
            const runs = [];
            for (let c = 0; c < g.cols; c++) {
                let run = 0;
                for (let r = 0; r < g.rows; r++) {
                    const i = r * g.cols + c;
                    if (colour[i] === tone && ((kinds[i] & KIND_MASK) - 1) === k) run++;
                    else { if (run) runs.push(run); run = 0; }
                    longest = Math.max(longest, run);
                }
            }
            return { longest, mean: runs.reduce((a, b) => a + b, 0) / runs.length };
        };
        const one = tallest(1);
        const two = tallest(2);
        expect(one.mean).toBeGreaterThan(1.8);
        expect(two.mean).toBeLessThan(one.mean * 0.75);
        expect(two.longest).toBeLessThanOrEqual(one.longest);
    });

    it('⭐ lays half as many ground pixels across the mat, each read from the plan under its centre', () => {
        const plan = flatPlan();
        const one = buildScreenPass(plan, { mat: MAT, unit: 2, sheet: () => solid(10, 20, 30) });
        const two = buildScreenPass(plan, { mat: MAT, unit: 4, pixel: 2, sheet: () => solid(10, 20, 30) });
        expect([one.cols, one.rows]).toEqual([880, 563]);
        expect([two.cols, two.rows]).toEqual([440, 282]);
    });

    it('⭐ draws the same picture for the same Region and window every time, another for another seed', () => {
        const ground = (seed) => regionGround({ seed }, MAT);
        const a = buildGroundPlan(ground(31));
        const first = buildScreenPass(a, { mat: MAT, unit: 4, pixel: 2, sheet: () => null }).data.slice();
        const second = buildScreenPass(buildGroundPlan(ground(31)), { mat: MAT, unit: 4, pixel: 2, sheet: () => null }).data;
        expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true);
        const other = buildScreenPass(buildGroundPlan(ground(32)), { mat: MAT, unit: 4, pixel: 2, sheet: () => null }).data;
        expect(Buffer.from(other).equals(Buffer.from(first))).toBe(false);
    });

    it('⭐ draws a ground pixel about as busy as a Token pixel was: a quarter of the changes across the mat', () => {
        const plan = buildGroundPlan(regionGround({ seed: 77 }, MAT));
        const busy = (pixel) => {
            const g = gridOf(plan, 2 * pixel);
            const { colour } = drawGrass(plan.grass, plan.seed, g.cols, g.rows, g.planCol, g.planRow, null, pixel);
            let differ = 0;
            let n = 0;
            for (let r = 0; r < g.rows; r++) {
                for (let c = 0; c + 1 < g.cols; c++) {
                    const i = r * g.cols + c;
                    if (colour[i] === COLOUR.NONE || colour[i + 1] === COLOUR.NONE) continue;
                    n++;
                    if (colour[i] !== colour[i + 1]) differ++;
                }
            }
            return differ / n;
        };
        const one = busy(1);
        const two = busy(2);
        // As often a change from one ground pixel to the next as from one Token pixel to the next
        // before: on the mat, a quarter as many, each a coarser mark.
        expect(two / one).toBeGreaterThan(0.8);
        expect(two / one).toBeLessThan(1.25);
    });
});

describe('⭐ Props keep their size, drawn at the ground\'s pixel', () => {
    /** A prop sheet with cell `index` holding `paint(x, y)` (an RGB or null for clear). */
    function sheetWith(index, paint) {
        const side = PROP_PX * PROP_SHEET_CELLS;
        const out = new Uint8ClampedArray(side * side * 4);
        const ox = (index % PROP_SHEET_CELLS) * PROP_PX;
        const oy = Math.floor(index / PROP_SHEET_CELLS) * PROP_PX;
        for (let y = 0; y < PROP_PX; y++) {
            for (let x = 0; x < PROP_PX; x++) {
                const rgb = paint(x, y);
                if (!rgb) continue;
                out.set([...rgb, 255], ((oy + y) * side + ox + x) * 4);
            }
        }
        return out;
    }

    it('⭐ gives each 2 × 2 block its most common opaque colour when half of it is opaque, else leaves it clear', () => {
        const src = sheetWith(5, (x, y) => {
            if (x < 2 && y < 2) return x === 1 && y === 1 ? [9, 9, 9] : [200, 0, 0];   // 3 red, 1 grey: red
            if (x >= 2 && x < 4 && y < 2) return x === 2 && y === 0 ? [0, 200, 0] : null; // 1 of 4 opaque: clear
            if (x >= 4 && x < 6 && y < 2) return y === 0 ? [0, 0, 200] : [0, 200, 0];   // a tie: the first found
            return null;
        });
        const { side, bytes } = propCell(src, 5, 2);
        expect(side).toBe(8);
        const at = (bx, by) => Array.from(bytes.slice((by * side + bx) * 4, (by * side + bx) * 4 + 4));
        expect(at(0, 0)).toEqual([200, 0, 0, 255]);
        expect(at(1, 0)).toEqual([0, 0, 0, 0]);
        expect(at(2, 0)).toEqual([0, 0, 200, 255]);
        expect(at(3, 3)).toEqual([0, 0, 0, 0]);
    });

    it('draws a cell as drawn at one Token pixel a ground pixel', () => {
        const src = sheetWith(2, (x, y) => ((x + y) % 3 ? [x * 10, y * 10, 77] : null));
        const { side, bytes } = propCell(src, 2, 1);
        expect(side).toBe(PROP_PX);
        for (let y = 0; y < PROP_PX; y++) {
            for (let x = 0; x < PROP_PX; x++) {
                const o = (y * side + x) * 4;
                expect(bytes[o + 3]).toBe((x + y) % 3 ? 255 : 0);
                if ((x + y) % 3) expect([bytes[o], bytes[o + 1], bytes[o + 2]]).toEqual([x * 10, y * 10, 77]);
            }
        }
    });

    it('⭐ stands a prop at two Token pixels with its foot on the ground pixel under the plan\'s foot, half as many pixels across', () => {
        const prop = { sheet: 'p', index: 0, footX: 450, footY: 300 };
        const plan = { ...flatPlan(), props: [prop] };
        const src = sheetWith(0, () => [200, 100, 50]);
        const pass = buildScreenPass(plan, { mat: MAT, unit: 4, pixel: 2, sheet: () => solid(9, 9, 9), prop: () => src });
        const footC = Math.floor(((prop.footX + 0.5) * 2) / 4);
        const footR = Math.floor(((prop.footY + 0.5) * 2) / 4);
        const px = (c, r) => Array.from(pass.data.slice((r * pass.cols + c) * 4, (r * pass.cols + c) * 4 + 3));
        expect(px(footC, footR)).toEqual([200, 100, 50]);
        expect(px(footC - 4, footR - 7)).toEqual([200, 100, 50]);
        expect(px(footC + 3, footR)).toEqual([200, 100, 50]);
        expect(px(footC - 5, footR)).toEqual([9, 9, 9]);
        expect(px(footC + 4, footR)).toEqual([9, 9, 9]);
        expect(px(footC, footR - 8)).toEqual([9, 9, 9]);
    });

    it('⭐ pulls a loud prop pixel on generated ground toward its box, then draws it in its look\'s Clean colours', () => {
        const plan = buildGroundPlan(regionGround({ seed: 77 }, MAT));
        const p = plan.props.find(x => x.look === 'meadow' && x.footX > 200 && x.footX < 680 && x.footY > 150 && x.footY < 410);
        expect(p).toBeTruthy();
        const lone = { ...plan, props: [{ ...p, shade: 1 }] };
        // A prop all one loud magenta.
        const src = sheetWith(p.index, () => [255, 0, 255]);
        const draw = () => buildScreenPass(lone, { mat: MAT, unit: 4, pixel: 2, sheet: () => null, prop: () => src });
        const c = Math.floor(((p.footX + 0.5) * 2) / 4);
        const r = Math.floor(((p.footY + 0.5) * 2) / 4);
        const at = (pass) => Array.from(pass.data.slice((r * pass.cols + c) * 4, (r * pass.cols + c) * 4 + 3));
        const quiet = at(draw());
        setTuning('decorQuiet', 0);
        const loud = at(draw());
        expect(loud).toEqual(cleanColour([255, 0, 255], CLEAN_LOOKS.meadow));
        // Halfway to a box of magenta over green: still pinkish, but much nearer the grass.
        expect(quiet[1]).toBeGreaterThan(loud[1] + 30);
        expect(quiet[0]).toBeLessThan(loud[0]);
    });
});

describe('⭐ A darker rim in two hard steps', () => {
    const levels = (dark) => [1 - dark, 1 - dark * RIM.band, 1];

    it('⭐ is two steps darker in a ragged band round the edge, as style5.py drew it: 4 and 11 Token pixels at its width', () => {
        const width = 22;
        const { at, reach } = rimShade(MAT, 5, { width, dark: 0.38 });
        expect(RIM.edge * width).toBeCloseTo(8, 9);
        expect(levels(0.38).map(v => +v.toFixed(2))).toEqual([0.62, 0.8, 1]);
        expect(reach).toBeCloseTo(width + RIM.rag * width, 9);
        const seen = new Set();
        for (let y = 300; y < 800; y += 1.7) {
            for (let x = 0; x < 40; x += 0.5) {
                const f = at(x, y);
                seen.add(f.toFixed(4));
                // Deep enough: as drawn; near enough: the darkest step; nothing between the steps.
                if (x >= reach) expect(f).toBe(1);
                if (x < RIM.edge * width - RIM.rag * width) expect(f).toBeCloseTo(0.62, 9);
                if (x >= RIM.edge * width + RIM.rag * width && x < width - RIM.rag * width) expect(f).toBeCloseTo(0.8, 9);
            }
        }
        expect([...seen].sort()).toEqual(levels(0.38).map(v => v.toFixed(4)).sort());
    });

    it('⭐ is ragged: the line between its steps wanders along the edge, by the Region\'s seed', () => {
        const width = 22;
        const lines = (seed) => {
            const { at } = rimShade(MAT, seed, { width, dark: 0.38 });
            const out = [];
            for (let y = 100; y < 1000; y += 2) {
                let x = 0;
                while (at(x, y) < 0.7) x += 0.5;
                out.push(x);
            }
            return out;
        };
        const a = lines(5);
        expect(new Set(a).size).toBeGreaterThan(4);
        expect(Math.max(...a) - Math.min(...a)).toBeGreaterThan(3);
        expect(lines(5)).toEqual(a);
        expect(lines(6)).not.toEqual(a);
    });

    it('⭐ follows the rounded corners: as deep in from the corner\'s curve as from a side', () => {
        const { at } = rimShade(MAT, 5, { width: 22, dark: 0.38 });
        const R = MAT_EDGE.radius;
        // A point 40 units in along the corner's diagonal from its curve is past the rim.
        const d = R - (R - 40) / Math.SQRT2;
        expect(at(R - (R - 40) / Math.SQRT2 + 0.01, d + 0.01)).toBe(1);
        // And one 2 units in from the curve is in its darkest step.
        const e = R - (R - 2) / Math.SQRT2;
        expect(at(e, e)).toBeCloseTo(0.62, 9);
    });

    it('⭐ draws in hard steps on screen, in place of the soft inset shadow, and the inset shadow back with the rim off', () => {
        const row = (pass) => Array.from({ length: 60 }, (_, c) => pass.data[(140 * pass.cols + c) * 4]);
        const on = buildScreenPass(flatPlan(), { mat: MAT, unit: 4, pixel: 2, sheet: () => solid(200, 200, 200) });
        const values = new Set(row(on).slice(1));
        // Inside the outermost pixel (lifted by the faint light edge): the two steps and the ground.
        expect([...values].sort((a, b) => a - b)).toEqual([124, 160, 200]);
        setTuning('rimOn', 0);
        const off = buildScreenPass(flatPlan(), { mat: MAT, unit: 4, pixel: 2, sheet: () => solid(200, 200, 200) });
        expect(new Set(row(off).slice(1)).size).toBeGreaterThan(6);
    });

    it('widens and darkens with its sliders', () => {
        const count = (pass, v) => Array.from({ length: 60 }, (_, c) => pass.data[(140 * pass.cols + c) * 4]).filter(x => x === v).length;
        const base = buildScreenPass(flatPlan(), { mat: MAT, unit: 4, pixel: 2, sheet: () => solid(200, 200, 200) });
        setTuning('rimWidth', 44);
        const wide = buildScreenPass(flatPlan(), { mat: MAT, unit: 4, pixel: 2, sheet: () => solid(200, 200, 200) });
        expect(count(wide, 160) + count(wide, 124)).toBeGreaterThan(count(base, 160) + count(base, 124));
        resetTuning();
        setTuning('rimDark', 0.5);
        const darker = buildScreenPass(flatPlan(), { mat: MAT, unit: 4, pixel: 2, sheet: () => solid(200, 200, 200) });
        expect(count(darker, 100)).toBeGreaterThan(0);
        expect(tuning('rimDark')).toBe(0.5);
    });
});

describe('the prototype\'s ramps stay as they were: the Clean colours come after', () => {
    it('keeps grassColours without a look as the rules make it', () => {
        expect(grassColours(generatedOf('meadow')).slice(0, 5)).toEqual(ramp(0.06, 0.38, 0.32, 5, 0.02, 0.06));
    });
});
