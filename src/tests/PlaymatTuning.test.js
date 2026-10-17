import { describe, it, expect, afterEach } from 'vitest';
import {
    TUNABLES, tuning, setTuning, resetTuning, isTuned, tuningDefault, tuningReport
} from '../config/playmatTuning.js';
import { edgeProfile, resolveArtPixels } from '../systems/board/TerrainLattice.js';
import { propsForGround } from '../systems/board/TerrainProps.js';
import { buildWearMask } from '../systems/board/TerrainPatches.js';
import { buildBandMasks, bandAppearance } from '../systems/board/TerrainBands.js';
import { muteTexels, buildGroundPlan } from '../systems/board/TerrainSurface.js';
import { drawGrass, grassColours } from '../systems/board/TerrainGrass.js';
import { generatedOf } from '../config/registries/terrainRegistry.js';
import { groundWith, flat } from './fixtures/ground.js';

/**
 * The playmat tuning store — the developer panel's sliders.
 */

afterEach(() => resetTuning());

describe('The table itself', () => {
    it('gives every tunable a default inside its own range', () => {
        for (const t of TUNABLES) {
            expect(t.def, t.key).toBeGreaterThanOrEqual(t.min);
            expect(t.def, t.key).toBeLessThanOrEqual(t.max);
            expect(t.max, t.key).toBeGreaterThan(t.min);
            expect(t.step, t.key).toBeGreaterThan(0);
        }
    });

    it('has unique keys, and a label and hint for each', () => {
        expect(new Set(TUNABLES.map(t => t.key)).size).toBe(TUNABLES.length);
        for (const t of TUNABLES) {
            expect(t.label, t.key).toBeTruthy();
            expect(t.hint, t.key).toBeTruthy();
            expect(t.group, t.key).toBeTruthy();
        }
    });

    it('starts at its defaults', () => {
        for (const t of TUNABLES) {
            expect(tuning(t.key), t.key).toBe(t.def);
            expect(tuningDefault(t.key), t.key).toBe(t.def);
        }
        expect(isTuned()).toBe(false);
    });
});

describe('Setting values', () => {
    it('clamps to the declared range rather than trusting the caller', () => {
        const t = TUNABLES[0];
        setTuning(t.key, t.max + 1000);
        expect(tuning(t.key)).toBe(t.max);
        setTuning(t.key, t.min - 1000);
        expect(tuning(t.key)).toBe(t.min);
    });

    it('refuses an unknown key or a value that is not a number', () => {
        expect(setTuning('nonsense', 1)).toBe(false);
        const t = TUNABLES[0];
        expect(setTuning(t.key, NaN)).toBe(false);
        expect(setTuning(t.key, undefined)).toBe(false);
        expect(tuning(t.key)).toBe(t.def);
    });

    it('reports whether anything actually changed', () => {
        const t = TUNABLES[0];
        expect(setTuning(t.key, t.def)).toBe(false);   // already there
        expect(setTuning(t.key, t.min)).toBe(true);
        expect(isTuned()).toBe(true);
    });

    it('resets everything back to how it ships', () => {
        for (const t of TUNABLES) setTuning(t.key, t.min);
        resetTuning();
        for (const t of TUNABLES) expect(tuning(t.key), t.key).toBe(t.def);
        expect(isTuned()).toBe(false);
    });
});

describe('Copy values: the tuned look as text to paste into chat', () => {
    it('lists every slider by its label and key, marking those moved from how they ship', () => {
        setTuning('beachWidth', 20);
        setTuning('muteSaturation', 0.55);
        const text = tuningReport();
        const lines = text.split('\n');
        expect(lines[0]).toMatch(/^Playmat Tuner/);
        for (const t of TUNABLES) {
            expect(lines.some(l => l.includes(`${t.label} [${t.key}]`)), t.key).toBe(true);
        }
        expect(text).toContain('Beach width (u) [beachWidth]: 20 (ships 12) *');
        expect(text).toContain('Saturation [muteSaturation]: 0.55 (ships 0.7) *');
        expect(text).toContain('Coast swing [edgeSwing]: 0.3125\n');
        // And the same values as one line a builder can paste into code.
        expect(JSON.parse(lines.at(-1))).toMatchObject({ beachWidth: 20, muteSaturation: 0.55, edgeSwing: 0.3125 });
    });

    it('says when nothing has moved', () => {
        expect(tuningReport().split('\n')[0]).toMatch(/as it ships/);
    });
});

describe('⭐ No dead sliders', () => {
    /**
     * What each tunable is supposed to change, as something comparable.
     *
     * A knob missing from this table is a knob nobody has claimed an effect
     * for, and the test below fails on that too, so adding a slider without
     * wiring it up cannot pass quietly.
     */
    const seed = 4242;
    /**
     * Sea, a beach along half of it, forest and mountain: every look's wear, band and scatter is
     * on it, and the sea meets the forest where the beach stops, so the beach rim has work to do.
     */
    const ground = () => groundWith(24, 12, (c, r) => (c < 5 ? 'water' : c < 9 && r < 6 ? 'sand' : c < 17 ? 'grass' : 'rock'), { seed });

    /** A mask summarised as a count plus a checksum: any two masks that differ at all differ here. */
    const summary = (mask) => {
        if (!mask) return 'none';
        let on = 0;
        let sum = 0;
        for (let i = 0; i < mask.length; i++) if (mask[i]) { on++; sum += i; }
        return `${on}:${sum}`;
    };

    const edges = () => JSON.stringify(Array.from({ length: 11 }, (_, i) => edgeProfile(4, i, 'v', seed)));
    const props = () => {
        const g = ground();
        return JSON.stringify(propsForGround(g, resolveArtPixels(g)));
    };
    const wear = () => {
        const g = ground();
        return summary(buildWearMask(resolveArtPixels(g), g).mask);
    };
    const band = (terrainId) => () => {
        const g = ground();
        const found = buildBandMasks(resolveArtPixels(g), g).bands.find(b => b.terrainId === terrainId);
        return summary(found?.mask);
    };
    const beach = () => {
        const { at, palette } = resolveArtPixels(ground());
        const sand = palette.indexOf('sand');
        return String(at.reduce((n, v) => n + (v === sand ? 1 : 0), 0));
    };
    const mute = () => Array.from(muteTexels(Uint8ClampedArray.from([200, 120, 60, 255]))).join(',');
    /** The plan's shade answer: which factor each pixel takes, and the factors. */
    const shade = () => {
        const plan = buildGroundPlan(ground());
        let sum = 0;
        for (let i = 0; i < plan.shadeAt.length; i++) sum += plan.shadeAt[i] * ((i % 9973) + 1);
        return `${sum}|${plan.shades.join(',')}`;
    };

    /** The sheet looks' lip only shows with the generated grass off: the forest draws its own. */
    const sheetShade = () => {
        setTuning('grassOn', 0);
        return shade();
    };
    /** Any array summarised by its values and where they are. */
    const weighted = (arr) => {
        let sum = 0;
        for (let i = 0; i < arr.length; i++) sum += arr[i] * ((i % 9973) + 1);
        return String(sum);
    };
    /** The generated grass's shapes in the plan. */
    const grassShape = () => {
        const { grass } = buildGroundPlan(ground());
        return grass ? `${weighted(grass.bits)}|${weighted(grass.kinds)}` : 'none';
    };
    /** The generated grass's details on a ground grid the size of the plan. */
    const grassDetail = () => {
        const plan = buildGroundPlan(ground());
        const planCol = Int32Array.from({ length: plan.width }, (_, c) => c);
        const planRow = Int32Array.from({ length: plan.height }, (_, r) => r * plan.width);
        return weighted(drawGrass(plan.grass, plan.seed, plan.width, plan.height, planCol, planRow).colour);
    };
    const grassColour = () => JSON.stringify(grassColours(generatedOf('forest')));
    /** Yellowstone's sulphur lakes in the plan. */
    const lakes = () => {
        const g = groundWith(55, 36, flat('grass'), { seed, biomes: { main: 'yellowstone', terrains: { yellowstone: 'grass' } } });
        return summary(buildGroundPlan(g).grass.ring);
    };

    const OBSERVES = {
        edgeSwing: edges,
        edgeRoughness: edges,
        beachWidth: beach,
        shallowsWidth: band('water'),
        wetSandWidth: band('sand'),
        // ⚠️ Strength changes the tint, not the mask, so it is observed through the appearance.
        bandStrength: () => JSON.stringify(['sea', 'coast'].map(id => bandAppearance(id))),
        patternOn: shade,
        patternScale: shade,
        patternStrength: shade,
        patchCoverage: wear,
        wearClump: wear,
        wearEdgeWidth: sheetShade,
        wearRim: sheetShade,
        wearFringe: sheetShade,
        wearMiddle: wear,
        grassOn: grassShape,
        grassStrokes: grassDetail,
        grassPatch: grassShape,
        grassPatchFloor: grassDetail,
        grassZoneScale: grassShape,
        grassTall: grassShape,
        grassDry: grassShape,
        grassEarth: grassShape,
        grassEncroach: grassShape,
        grassBodySoft: grassColour,
        grassClump: grassShape,
        grassMounds: grassDetail,
        groundLakes: lakes,
        groundStrength: grassColour,
        propDensity: props,
        propGroupSize: props,
        propGroupSpread: props,
        propScatter: props,
        muteBrightness: mute,
        muteSaturation: mute
    };

    it('every tunable in the table is claimed to change something', () => {
        for (const t of TUNABLES) {
            expect(OBSERVES[t.key], `${t.key} has no declared effect`).toBeDefined();
        }
        expect(Object.keys(OBSERVES).sort()).toEqual(TUNABLES.map(t => t.key).sort());
    });

    it('⚠️ every tunable actually changes what it claims to', () => {
        // A slider that saves and repaints but alters nothing is indistinguishable from a working
        // one until an afternoon has gone on it.
        for (const t of TUNABLES) {
            const observe = OBSERVES[t.key];
            resetTuning();
            setTuning(t.key, t.min);
            const atMin = observe();
            setTuning(t.key, t.max);
            const atMax = observe();
            expect(atMin, `${t.key} does nothing between ${t.min} and ${t.max}`).not.toBe(atMax);
        }
    });
});

describe('The sliders the tile era needed are gone', () => {
    it('has no tile bleed, bleed smoothness or tone slider, and its widths are in mat units', () => {
        const keys = TUNABLES.map(t => t.key);
        for (const gone of ['ownerJitter', 'ownerCoarseShare', 'toneBlend', 'toneStrength', 'fringeWidth', 'bandWidth', 'patchScale']) {
            expect(keys).not.toContain(gone);
        }
        for (const key of ['beachWidth', 'shallowsWidth', 'wetSandWidth', 'wearClump']) {
            const t = TUNABLES.find(x => x.key === key);
            expect(t.label, key).toMatch(/\(u\)$/);
            expect(t.step % 2, key).toBe(0);
        }
    });
});
