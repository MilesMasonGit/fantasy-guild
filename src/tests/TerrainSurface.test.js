import { describe, it, expect, afterEach } from 'vitest';
import { buildGroundPlan, sheetFor, muteTexels } from '../systems/board/TerrainSurface.js';
import { LOOKS, SHEETS } from '../config/registries/terrainRegistry.js';
import { setTuning, resetTuning } from '../config/playmatTuning.js';
import { groundWith, flat } from './fixtures/ground.js';

/**
 * The composed plan: one answer per pixel (which sheet, which tint), the layering rule that used
 * to be draw order, and the mute the screen pass bakes into each sheet.
 */

afterEach(() => resetTuning());

/** Sea, a beach, forest grass and mountain rock side by side. */
const hybrid = (seed = 5) => groundWith(32, 16, (c) => (c < 6 ? 'water' : c < 12 ? 'sand' : c < 22 ? 'grass' : 'rock'), { seed });
const meadow = (seed = 5) => groundWith(20, 12, flat('grass'), { seed, biomes: null });

/** Whether two typed arrays hold the same values: one loop, not one assertion per pixel. */
function same(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

/** How many pixels draw each sheet. */
function sheetCounts(plan) {
    const out = {};
    for (let i = 0; i < plan.sheetAt.length; i++) {
        const id = plan.sheets[plan.sheetAt[i]];
        out[id] = (out[id] || 0) + 1;
    }
    return out;
}

describe('Every pixel gets a sheet', () => {
    it('covers the whole mat: no pixel without ground', () => {
        const plan = buildGroundPlan(hybrid());
        expect(plan.sheetAt.length).toBe(plan.width * plan.height);
        for (const id of plan.sheets) expect(SHEETS).toContain(id);
        expect(Math.max(...new Set(plan.sheetAt))).toBeLessThan(plan.sheets.length);
    });

    it('⭐ draws each look with its own sheet (TD-2 A)', () => {
        // Meadow grass is `g_grass`, forest ground `g_grass_dark`, rock `g_stone`, the beach
        // `g_sand`, the sea `g_water`.
        const byTerrain = (plan) => {
            const out = {};
            for (let i = 0; i < plan.sheetAt.length; i++) {
                if (plan.wearAt?.[i]) continue;
                const t = plan.palette[plan.terrainAt[i]];
                (out[t] ||= new Set()).add(plan.sheets[plan.sheetAt[i]]);
            }
            return Object.fromEntries(Object.entries(out).map(([t, s]) => [t, [...s]]));
        };
        expect(byTerrain(buildGroundPlan(hybrid()))).toEqual({
            water: ['water'], sand: ['sand'], grass: ['grass_dark'], rock: ['stone']
        });
        expect(byTerrain(buildGroundPlan(meadow()))).toEqual({ grass: ['grass'] });
    });

    it('lists the look of every terrain it drew', () => {
        const plan = buildGroundPlan(hybrid());
        const looks = Object.fromEntries(plan.palette.map((t, i) => [t, plan.looks[i]]));
        expect(looks).toMatchObject({ grass: 'forest', rock: 'mountain', sand: 'coast', water: 'sea' });
    });
});

describe('⭐ Layering: tint under band under wear', () => {
    it('wears earth through grass and gravel through rock, as wear and not a second ground', () => {
        // The sheet looks' wear: generated grass draws its own earth (`TerrainGrass`).
        setTuning('grassOn', 0);
        const counts = sheetCounts(buildGroundPlan(hybrid()));
        expect(counts.dirt).toBeGreaterThan(0);
        expect(counts.gravel).toBeGreaterThan(0);
        expect(counts.grass_dark).toBeGreaterThan(counts.dirt);
        expect(counts.stone).toBeGreaterThan(counts.gravel);
    });

    it('tints the shallows and the wet sand, and nothing else', () => {
        const plan = buildGroundPlan(hybrid());
        const tinted = new Set();
        for (let i = 0; i < plan.tintAt.length; i++) {
            if (plan.tintAt[i] < 0) continue;
            tinted.add(plan.palette[plan.terrainAt[i]]);
        }
        expect([...tinted].sort()).toEqual(['sand', 'water']);
        expect(plan.tints.map(t => t.tint).sort()).toEqual([LOOKS.coast.band.tint, LOOKS.sea.band.tint].sort());
    });

    it('⭐ never tints worn ground: bare earth is not shallow water', () => {
        const plan = buildGroundPlan(hybrid());
        let worn = 0;
        let wornTinted = 0;
        for (let i = 0; i < plan.tintAt.length; i++) {
            if (!plan.wearAt?.[i]) continue;
            worn++;
            if (plan.tintAt[i] !== -1) wornTinted++;
        }
        expect(worn).toBeGreaterThan(0);
        expect(wornTinted).toBe(0);
    });

    it('keeps which band each pixel is in, apart from the drawing answer', () => {
        const plan = buildGroundPlan(hybrid());
        expect(plan.bands.map(b => b.look).sort()).toEqual(['coast', 'sea']);
        for (const band of plan.bands) {
            expect(band.mask.length).toBe(plan.width * plan.height);
        }
    });
});

describe('Alternate sheets swap per Region, never per cell', () => {
    it('uses the one sheet a look has', () => {
        expect(sheetFor(LOOKS.meadow, 1)).toBe('grass');
        expect(sheetFor(LOOKS.meadow, 99)).toBe('grass');
    });

    it('picks one alternate per seed, and every alternate comes up', () => {
        const look = { sheets: ['a', 'b'] };
        const seen = new Set();
        for (let seed = 0; seed < 40; seed++) {
            expect(sheetFor(look, seed)).toBe(sheetFor(look, seed));
            seen.add(sheetFor(look, seed));
        }
        expect([...seen].sort()).toEqual(['a', 'b']);
    });

    it('draws one sheet for a look across the whole Region', () => {
        // Under generated grass the meadow keeps its sheet beneath and wears no sheet earth.
        expect(Object.keys(sheetCounts(buildGroundPlan(meadow(12))))).toEqual(['grass']);
        setTuning('grassOn', 0);
        const counts = sheetCounts(buildGroundPlan(meadow(12)));
        expect(Object.keys(counts).sort()).toEqual(['dirt', 'grass']);
    });
});

describe('The mute, baked into a sheet\'s pixels once', () => {
    const rgba = () => Uint8ClampedArray.from([200, 100, 50, 255, 100, 100, 100, 128]);

    it('changes nothing at full brightness and saturation', () => {
        setTuning('muteBrightness', 1);
        setTuning('muteSaturation', 1);
        expect(Array.from(muteTexels(rgba()))).toEqual(Array.from(rgba()));
    });

    it('darkens and greys a colour by the tuned amounts, and leaves alpha alone', () => {
        const out = muteTexels(rgba());
        // brightness(0.85) saturate(0.7): darker, and the channels closer together.
        expect(out[0]).toBeLessThan(200);
        expect(out[0] - out[2]).toBeLessThan(150 * 0.85);
        expect(out[3]).toBe(255);
        expect(out[7]).toBe(128);
        // A grey stays grey: saturation has nothing to take from it.
        expect(out[4]).toBe(out[5]);
        expect(out[5]).toBe(out[6]);
        expect(out[4]).toBe(85);
    });

    it('works on a copy, so the decoded sheet is never altered', () => {
        const src = rgba();
        muteTexels(src);
        expect(Array.from(src)).toEqual(Array.from(rgba()));
    });
});

describe('Stability', () => {
    it('is identical every time', () => {
        const a = buildGroundPlan(hybrid(31));
        const b = buildGroundPlan(hybrid(31));
        expect(same(a.sheetAt, b.sheetAt)).toBe(true);
        expect(same(a.tintAt, b.tintAt)).toBe(true);
        expect(a.props).toEqual(b.props);
    });

    it('differs between seeds', () => {
        expect(same(buildGroundPlan(hybrid(1)).sheetAt, buildGroundPlan(hybrid(2)).sheetAt)).toBe(false);
    });
});
