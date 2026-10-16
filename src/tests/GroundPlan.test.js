import { describe, it, expect, afterEach } from 'vitest';
import { budget } from '../systems/atlas/Budget.js';
import { layout, HALL_CLEARING, hallSpot } from '../systems/atlas/Layout.js';
import { DEV_MAPS } from '../systems/atlas/devMaps.js';
import { regionGround } from '../systems/atlas/regionGround.js';
import { buildGroundPlan } from '../systems/board/TerrainSurface.js';
import { patchNoise } from '../systems/board/TerrainPatches.js';
import { PLAN_PIXEL_U, CELL_PX, edgeAmplitude } from '../systems/board/TerrainLattice.js';
import { LOOKS } from '../config/registries/terrainRegistry.js';
import { tuning, resetTuning } from '../config/playmatTuning.js';
import { createRegionRecord } from '../state/StateSchema.js';

/**
 * The ground plan of a settled Region (terrain roadmap decision 7a): what is on the ground at
 * every 2-unit pixel of the shipped mat, from the Region's stored cell map and seed alone. Built
 * from the dev console's map recipes through the real budget and layout.
 */

afterEach(() => resetTuning());

const MAT = Object.freeze({ w: 1760, h: 1126 });

function settled(names, seed) {
    const summary = budget(names.map(n => DEV_MAPS[n]), { cap: 128 });
    const result = layout(summary, {
        seed, mat: MAT, crowding: { hitboxPct: 80, overlapPct: 40 }, artRadius: () => 64
    });
    return { ...createRegionRecord('region_2'), seed, ground: summary.ground, terrain: result.terrain, layout: result };
}

const planOf = (region) => buildGroundPlan(regionGround(region, MAT));

/** Whether two typed arrays hold the same values: one loop, not one assertion per pixel. */
function same(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

describe('⭐ The plan of a stored map', () => {
    it('⭐ is the same on every build, and changes with the seed', () => {
        const a = planOf(settled(['forest', 'coast'], 101));
        const b = planOf(settled(['forest', 'coast'], 101));
        expect([a.width, a.height]).toEqual([880, 563]);
        expect(same(b.terrainAt, a.terrainAt)).toBe(true);
        expect(same(b.sheetAt, a.sheetAt)).toBe(true);
        expect(same(b.tintAt, a.tintAt)).toBe(true);
        expect(b.props).toEqual(a.props);

        // The same stored map under another seed: the same cells, other edges, wear and scatter.
        const region = settled(['forest', 'coast'], 101);
        const reseeded = planOf({ ...region, seed: 102 });
        expect(same(reseeded.terrainAt, a.terrainAt)).toBe(false);
        expect(same(reseeded.sheetAt, a.sheetAt)).toBe(false);
        expect(reseeded.props).not.toEqual(a.props);
    });

    it('keeps every cell\'s pixels its terrain except near a boundary: the edge swing, or the beach', () => {
        const region = settled(['forest', 'coast'], 103);
        const ground = regionGround(region, MAT);
        const plan = buildGroundPlan(ground);
        const reach = edgeAmplitude() + tuning('beachWidth') / PLAN_PIXEL_U;
        const cellTerrain = (c, r) => ground.terrains[ground.cells[r * ground.cols + c]];
        let moved = 0;
        for (let i = 0; i < plan.terrainAt.length; i++) {
            const x = i % plan.width;
            const y = (i - x) / plan.width;
            const cx = Math.floor(x / CELL_PX);
            const cy = Math.floor(y / CELL_PX);
            if (plan.palette[plan.terrainAt[i]] === cellTerrain(cx, cy)) continue;
            moved++;
            // Some cell within reach of this pixel holds a different terrain.
            let near = false;
            for (let dy = -1; dy <= 1 && !near; dy++) {
                for (let dx = -1; dx <= 1 && !near; dx++) {
                    const c = cx + dx;
                    const r = cy + dy;
                    if (c < 0 || r < 0 || c >= ground.cols || r >= ground.rows) continue;
                    if (cellTerrain(c, r) === cellTerrain(cx, cy)) continue;
                    const nearestX = Math.max(c * CELL_PX, Math.min(x, (c + 1) * CELL_PX - 1));
                    const nearestY = Math.max(r * CELL_PX, Math.min(y, (r + 1) * CELL_PX - 1));
                    near = Math.max(Math.abs(nearestX - x), Math.abs(nearestY - y)) <= reach;
                }
            }
            expect(near, `pixel ${x},${y}`).toBe(true);
        }
        expect(moved).toBeGreaterThan(0);
    });

    it('⭐ never lets water meet grass or rock without the beach rim', () => {
        for (const [names, seed] of [[['forest', 'coast'], 104], [['mountain', 'coast'], 105], [['coast'], 106]]) {
            const plan = planOf(settled(names, seed));
            const { width, height, palette, terrainAt } = plan;
            const water = palette.indexOf('water');
            expect(water, names.join('+')).toBeGreaterThanOrEqual(0);
            let shore = 0;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (terrainAt[y * width + x] !== water) continue;
                    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                        const t = palette[terrainAt[ny * width + nx]];
                        if (t === 'water') continue;
                        shore++;
                        expect(t, `${names.join('+')}: water at ${x},${y} meets ${t}`).toBe('sand');
                    }
                }
            }
            expect(shore).toBeGreaterThan(0);
        }
    });

    it('⭐ stands no prop with its foot off its own ground or on water', () => {
        for (const [names, seed] of [[['forest', 'coast'], 107], [['mountain', 'coast'], 108], [['forest', 'mountain'], 109]]) {
            const plan = planOf(settled(names, seed));
            expect(plan.props.length, names.join('+')).toBeGreaterThan(20);
            for (const p of plan.props) {
                const i = p.footY * plan.width + p.footX;
                const terrain = plan.palette[plan.terrainAt[i]];
                expect(terrain).not.toBe('water');
                expect(plan.looks[plan.terrainAt[i]], `${p.sheet} at ${p.footX},${p.footY}`).toBe(p.look);
            }
        }
    });
});

describe('⭐ The ground round the Hall is plain ground: no clearing (decision 4)', () => {
    it('⭐ follows the same rule inside the Hall\'s ring as anywhere: the look\'s sheet, worn where the noise says', () => {
        const region = settled(['forest', 'mountain'], 110);
        const ground = regionGround(region, MAT);
        const plan = buildGroundPlan(ground);
        const hall = hallSpot(MAT);
        const ring = HALL_CLEARING / PLAN_PIXEL_U;
        const cx = hall.x / PLAN_PIXEL_U;
        const cy = hall.y / PLAN_PIXEL_U;
        let checked = 0;
        let worn = 0;
        const wrong = [];
        for (let y = Math.floor(cy - ring); y <= Math.ceil(cy + ring); y++) {
            for (let x = Math.floor(cx - ring); x <= Math.ceil(cx + ring); x++) {
                if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > ring * ring) continue;
                const i = y * plan.width + x;
                const t = plan.terrainAt[i];
                const look = LOOKS[plan.looks[t]];
                const wears = patchNoise(x, y, ground.seed, plan.wear.cell) < plan.wear.thresholds[t];
                if (Boolean(plan.wearAt[i]) !== wears) wrong.push(`wear at ${x},${y}`);
                if (plan.sheets[plan.sheetAt[i]] !== (wears ? look.wear.sheet : look.sheets[0])) wrong.push(`sheet at ${x},${y}`);
                checked++;
                if (wears) worn++;
            }
        }
        expect(wrong.slice(0, 5), `${wrong.length} wrong`).toEqual([]);
        expect(checked).toBeGreaterThan(30000);
        // Wear at its ordinary share, not a worn patch (the tile era's hamlet wore 45 %).
        expect(worn / checked).toBeLessThan(0.3);
    });

    it('does not know where the Hall stands: the plan reads no board', () => {
        const region = settled(['forest', 'coast'], 111);
        const hallAt = (x, y) => ({ ...region, board: { tokens: { hall: { typeId: 'token_guild_hall', x, y } } } });
        const a = planOf(hallAt(880, 563));
        const b = planOf(hallAt(300, 300));
        expect(same(b.sheetAt, a.sheetAt)).toBe(true);
        expect(b.props).toEqual(a.props);
    });
});

describe('⭐ Looks', () => {
    it('⭐ draws the meadow for terrain: null, as the Starter Camp is', () => {
        const record = { ...createRegionRecord('region_1'), kind: 'starter', seed: 1 };
        const plan = planOf(record);
        expect([plan.width, plan.height]).toEqual([880, 563]);
        expect(plan.looks).toEqual(['meadow']);
        expect(new Set(plan.sheets.filter((s, i) => plan.sheetAt.includes(i)))).toEqual(new Set(['grass', 'dirt']));
        expect(plan.bands).toEqual([]);
        expect(plan.props.length).toBeGreaterThan(0);
        expect(new Set(plan.props.map(p => p.look))).toEqual(new Set(['meadow']));
    });

    it('⭐ gives a hybrid\'s grass the forest look and its rock the mountain look', () => {
        const plan = planOf(settled(['forest', 'mountain'], 112));
        const counts = {};
        for (let i = 0; i < plan.sheetAt.length; i++) {
            if (plan.wearAt[i]) continue;
            const key = `${plan.palette[plan.terrainAt[i]]}>${plan.sheets[plan.sheetAt[i]]}`;
            counts[key] = (counts[key] || 0) + 1;
        }
        expect(Object.keys(counts).sort()).toEqual(['grass>grass_dark', 'rock>stone']);
        expect(counts['grass>grass_dark']).toBeGreaterThan(10000);
        expect(counts['rock>stone']).toBeGreaterThan(10000);
    });
});
