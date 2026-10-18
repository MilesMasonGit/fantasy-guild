import { describe, it, expect } from 'vitest';
import { budget, BIOME_WATER } from '../systems/atlas/Budget.js';
import { layout, HALL_CLEARING, DRY_GAP } from '../systems/atlas/Layout.js';
import {
    TERRAIN, TERRAIN_CELL, MAX_WATER_SHARE, terrainGrid, terrainAt, encodeTerrain, decodeTerrain
} from '../systems/atlas/TerrainMap.js';
import {
    planWater, readWater, rasterise, sampleWater, fieldAt, waterFieldAt, noiseLayer, noiseAt, simplify,
    WATER_KIND, WATER_VERSION, STYLE, SHAPE, SAMPLES, FAR, BANK_PAD
} from '../systems/atlas/WaterShapes.js';
import { mulberry32, seedFromText } from '../systems/atlas/seededRandom.js';
import { regionGround } from '../systems/atlas/regionGround.js';
import { buildGroundPlan } from '../systems/board/TerrainSurface.js';
import { PLAN_PIXEL_U } from '../systems/board/TerrainLattice.js';

/**
 * A Region's water as shapes (brief 180 G5, the owner's world rounds W5 to W7): lakes, ponds,
 * tarns, rivers, sulphur springs and the edge sea, made with the layout, stored with the cells,
 * drawn where they lie rather than by the cells. Content-free: synthetic Tokens, the real rules.
 */

const MAT = Object.freeze({ w: 1760, h: 1126 });
const CROWDING = Object.freeze({ hitboxPct: 80, overlapPct: 40 });
const options = (seed) => ({ seed, mat: MAT, crowding: CROWDING, artRadius: () => 64 });
const SEEDS = Array.from({ length: 8 }, (_, i) => seedFromText(`water-${i}`));

/** A one-biome map, naming one variety of its water when `inland` is given. */
const mapOf = (biome, inland = null, extra = {}) => ({
    id: `w_${biome}_${inland || 'own'}`, kind: 'base', biome, points: 30,
    nodes: [{ typeId: 'oak', weight: 3 }, { typeId: 'berry', weight: 1 }],
    ...(inland ? { inland } : {}), ...extra
});
const settle = (maps, seed) => layout(budget(maps, { cap: 128 }), options(seed));

/** The plan's lattice: a sample at each 2-unit pixel's centre. */
const PLAN = Object.freeze({ x0: 1, y0: 1, step: 2, nx: 880, ny: 563 });
const CLEAR = Object.freeze({ x: 880, y: 563, r: HALL_CLEARING + 2 * TERRAIN_CELL });

const recordOf = (kind, seed = 7) => planWater({ sea: 0, kinds: [kind] }, mulberry32(seed), MAT, CLEAR).record;
const VARIETIES = Object.values(WATER_KIND);

describe('⭐ The noise the shapes bend by', () => {
    it('gives the same value cached, by rows, or worked out from scratch', () => {
        const box = { x0: -400, y0: -400, x1: 2160, y1: 1526 };
        for (const cell of [10, 24, 60, 140]) {
            const layer = noiseLayer(1234 + cell, cell, box);
            const row = new Float64Array(PLAN.nx);
            for (const j of [0, 7, 281, 562]) {
                layer.row(PLAN, j, 0, PLAN.nx - 1, row);
                for (let i = 0; i < PLAN.nx; i += 13) {
                    const x = PLAN.x0 + i * PLAN.step;
                    const y = PLAN.y0 + j * PLAN.step;
                    expect(row[i]).toBe(noiseAt(x, y, cell, 1234 + cell));
                    expect(layer(x, y)).toBe(row[i]);
                }
            }
            // Outside the box: hashed on the spot, the same.
            expect(layer(-3000, 5000)).toBe(noiseAt(-3000, 5000, cell, 1234 + cell));
        }
    });
});

describe('⭐ Shapes as fields', () => {
    it('⭐ draws every variety exactly as the slow reference, on the plan\'s pixels and on the cells\' samples', () => {
        for (const kind of VARIETIES) {
            const water = readWater(recordOf(kind));
            expect(water.shapes.length, kind).toBeGreaterThan(0);
            for (const [lattice, every] of [[PLAN, 7], [{ x0: 4, y0: 4, step: 8, nx: 220, ny: 144 }, 2]]) {
                const { f, style } = rasterise(water, lattice);
                let checked = 0;
                for (let j = 0; j < lattice.ny; j += every) {
                    for (let i = 0; i < lattice.nx; i += every) {
                        const ref = waterFieldAt(water, lattice.x0 + i * lattice.step, lattice.y0 + j * lattice.step);
                        const p = j * lattice.nx + i;
                        if (ref.f > -BANK_PAD) {
                            if (f[p] !== ref.f || style[p] !== ref.style) throw new Error(`${kind} at ${i},${j}: ${f[p]} vs ${ref.f}`);
                            checked++;
                        } else {
                            expect(f[p]).toBeLessThanOrEqual(-BANK_PAD);
                        }
                    }
                }
                expect(checked, kind).toBeGreaterThan(20);
            }
        }
    }, 60000);

    it('is the same for the same seed, and another for another', () => {
        for (const kind of VARIETIES) {
            expect(recordOf(kind, 11), kind).toEqual(recordOf(kind, 11));
            expect(recordOf(kind, 12), kind).not.toEqual(recordOf(kind, 11));
        }
    });

    it('⭐ keeps every variety out of the Hall\'s clearing', () => {
        for (const kind of VARIETIES) {
            for (const seed of [1, 2, 3, 4, 5]) {
                const water = readWater(recordOf(kind, seed));
                for (let y = CLEAR.y - CLEAR.r; y <= CLEAR.y + CLEAR.r; y += 24) {
                    for (let x = CLEAR.x - CLEAR.r; x <= CLEAR.x + CLEAR.r; x += 24) {
                        if ((x - CLEAR.x) * (x - CLEAR.x) + (y - CLEAR.y) * (y - CLEAR.y) >= CLEAR.r * CLEAR.r) continue;
                        expect(waterFieldAt(water, x, y).f, `${kind} ${seed} at ${x},${y}`).toBeLessThanOrEqual(0);
                    }
                }
                expect(waterFieldAt(water, CLEAR.x, CLEAR.y).f).toBeLessThanOrEqual(0);
            }
        }
    });

    it('⭐ cuts water the clearing would hold with a shore round it, deepening away from it', () => {
        // A lake laid right over the Hall, by hand: the clearing stays dry, the lake goes on round it.
        const water = readWater({
            v: WATER_VERSION, salt: 9, mat: [MAT.w, MAT.h], clear: [CLEAR.x, CLEAR.y, CLEAR.r],
            shapes: [{ k: SHAPE.LAKE, lobes: [[CLEAR.x, CLEAR.y, 700]], holes: [] }]
        });
        const { f } = rasterise(water, PLAN);
        const at = (x, y) => f[Math.round((y - 1) / 2) * PLAN.nx + Math.round((x - 1) / 2)];
        for (let y = CLEAR.y - CLEAR.r + 9; y < CLEAR.y + CLEAR.r; y += 30) {
            for (let x = CLEAR.x - CLEAR.r + 9; x < CLEAR.x + CLEAR.r; x += 30) {
                if ((x - CLEAR.x) ** 2 + (y - CLEAR.y) ** 2 < (CLEAR.r - 4) ** 2) expect(at(x, y)).toBeLessThanOrEqual(0);
            }
        }
        expect(at(CLEAR.x + CLEAR.r + 60, CLEAR.y)).toBeGreaterThan(0);
        expect(at(CLEAR.x + CLEAR.r + 120, CLEAR.y)).toBeGreaterThan(at(CLEAR.x + CLEAR.r + 50, CLEAR.y));
    });

    it('makes a lake of up to a fifth of the mat, with islands or bays now and then', () => {
        const shares = [];
        let holes = 0;
        for (let seed = 1; seed <= 20; seed++) {
            const water = readWater(recordOf(WATER_KIND.LAKE, seed));
            const { f } = rasterise(water, PLAN);
            let wet = 0;
            for (let i = 0; i < f.length; i++) if (f[i] > 0) wet++;
            shares.push(wet / f.length);
            holes += water.shapes[0].holes.length;
            expect(water.shapes[0].lobes.length).toBeGreaterThanOrEqual(2);
        }
        expect(Math.max(...shares)).toBeLessThanOrEqual(0.2);
        expect(Math.min(...shares)).toBeGreaterThan(0.02);
        expect(holes).toBeGreaterThan(5);
    });

    it('widens every river downstream, and leaves no river ending in other water but its own lake, spring or split', () => {
        const near = (water, x, y, skip) => water.shapes.some((s, k) => k !== skip && (
            s.k === SHAPE.LAKE ? waterFieldAt({ ...water, shapes: [s] }, x, y).f > -40
                : s.k === SHAPE.RIVER && s.points.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 < 40 * 40)));
        for (const kind of VARIETIES) {
            for (const seed of [1, 2, 3]) {
                const water = readWater(recordOf(kind, seed));
                water.shapes.forEach((s, k) => {
                    if (s.k !== SHAPE.RIVER) return;
                    expect(s.w[1], kind).toBeGreaterThanOrEqual(s.w[0]);
                    for (const [x, y] of [s.points[0], s.points[s.points.length - 1]]) {
                        const off = x < 0 || y < 0 || x > MAT.w || y > MAT.h;
                        if (off) continue;
                        // An end on the mat joins its own water: the lake it leaves or feeds, the
                        // spring it rises in, or (a split) the river it parts from.
                        expect(near(water, x, y, k), `${kind} ${seed}: a river ends at ${x},${y} in nothing`).toBe(true);
                        if (![WATER_KIND.LAKE_RIVER, WATER_KIND.SPRING, WATER_KIND.SPLIT, WATER_KIND.RIVER].includes(kind)) {
                            throw new Error(`${kind}: a river ends on the mat`);
                        }
                    }
                });
            }
        }
    });

    it('keeps a stored river short: its path thinned to the points that shape it', () => {
        const zigzag = Array.from({ length: 200 }, (_, i) => [i, (i % 2) * 0.1]);
        expect(simplify(zigzag, 1)).toEqual([[0, 0], [199, 0.1]]);
        for (const kind of [WATER_KIND.BRAIDED, WATER_KIND.SPLIT, WATER_KIND.LAKE_RIVER]) {
            expect(JSON.stringify(recordOf(kind)).length, kind).toBeLessThan(6000);
        }
    });
});

describe('⭐ Cells from shapes', () => {
    it('⭐ makes a cell water when the water covers at least half its sample points, unless kept dry', () => {
        const grid = terrainGrid(MAT);
        const water = readWater(recordOf(WATER_KIND.LAKE_RIVER, 3));
        const keepDry = (i) => i % 7 === 0;
        const { water: cells, sample } = sampleWater(water, grid, TERRAIN_CELL, keepDry);
        let wetCells = 0;
        for (let r = 0; r < grid.rows; r++) {
            for (let c = 0; c < grid.cols; c++) {
                let wet = 0;
                for (let j = 0; j < SAMPLES; j++) {
                    for (let i = 0; i < SAMPLES; i++) {
                        const x = c * TERRAIN_CELL + (i + 0.5) * (TERRAIN_CELL / SAMPLES);
                        const y = r * TERRAIN_CELL + (j + 0.5) * (TERRAIN_CELL / SAMPLES);
                        if (waterFieldAt(water, x, y).f > 0) wet++;
                    }
                }
                const index = r * grid.cols + c;
                expect(cells[index], `cell ${c},${r}`).toBe(wet >= 8 && !keepDry(index) ? 1 : 0);
                wetCells += cells[index];
            }
        }
        expect(wetCells).toBeGreaterThan(50);
        // Read between the samples: each sample itself, and in between on the line.
        const { x0, y0, step } = sample.lattice;
        expect(fieldAt(sample, x0 + 5 * step, y0 + 9 * step)).toBe(sample.f[9 * sample.lattice.nx + 5]);
    });

    it('⭐ keeps the Hall\'s clearing dry and the water within the most a mat may hold', () => {
        for (const kind of VARIETIES) {
            for (const seed of SEEDS.slice(0, 3)) {
                const result = settle([mapOf('meadow', kind)], seed);
                const { cols, rows } = result.terrain;
                let wet = 0;
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const x = (c + 0.5) * TERRAIN_CELL;
                        const y = (r + 0.5) * TERRAIN_CELL;
                        const water = terrainAt(result.terrain, x, y) === TERRAIN.WATER;
                        if (water) wet++;
                        if ((x - result.hall.x) ** 2 + (y - result.hall.y) ** 2 < HALL_CLEARING ** 2) expect(water).toBe(false);
                    }
                }
                expect(wet / (cols * rows), kind).toBeLessThanOrEqual(MAX_WATER_SHARE);
                expect(wet, kind).toBeGreaterThan(0);
            }
        }
        // A sea as big as a mat allows and a lake besides: the lake goes, the sea stays.
        const flood = settle([mapOf('meadow', WATER_KIND.LAKE, { water: 1 })], SEEDS[0]);
        const share = [...flood.terrain.cells].filter(ch => flood.terrain.legend[parseInt(ch, 36)] === TERRAIN.WATER).length / flood.terrain.cells.length;
        expect(share).toBeLessThanOrEqual(MAX_WATER_SHARE + 0.02);
        expect(flood.terrain.water.shapes.map(s => s.k)).toEqual([SHAPE.SEA]);
    });

    it('⭐ stands no dry Token on drawn water and no boat off it', () => {
        const needs = { boat: ['water'] };
        const terrainAllows = (typeId, terrain) => (needs[typeId] ? terrain === TERRAIN.WATER : terrain !== TERRAIN.WATER);
        let boats = 0;
        for (const kind of VARIETIES) {
            const map = { ...mapOf('meadow', kind), nodes: [{ typeId: 'oak', weight: 6 }, { typeId: 'boat', weight: 1 }] };
            for (const seed of SEEDS.slice(0, 2)) {
                const summary = budget([map], { cap: 128 });
                const result = layout(summary, { ...options(seed), terrainAllows });
                const water = readWater(result.terrain.water);
                const { sample } = sampleWater(water, terrainGrid(MAT), TERRAIN_CELL);
                for (const n of result.nodes) {
                    const drawn = waterFieldAt(water, n.x, n.y).f;
                    if (n.typeId === 'boat') {
                        boats++;
                        expect(drawn, `${kind}: boat at ${n.x},${n.y}`).toBeGreaterThan(0);
                    } else {
                        expect(drawn, `${kind}: ${n.typeId} at ${n.x},${n.y}`).toBeLessThan(0);
                        expect(fieldAt(sample, n.x, n.y)).toBeLessThanOrEqual(-DRY_GAP);
                    }
                }
            }
        }
        expect(boats).toBeGreaterThan(10);
    });
});

describe('⭐ Water by biome', () => {
    it('⭐ gives each biome its own water, the main biome\'s in a Region of several', () => {
        expect(budget([mapOf('meadow')], { cap: 128 }).ground.inland).toEqual([...BIOME_WATER.meadow]);
        const kindsOf = (biome, seed) => {
            const water = settle([mapOf(biome)], seed).terrain.water;
            return water ? water.shapes.map(s => (s.k === SHAPE.LAKE ? `${s.k}${s.lobes.length}` : s.k)) : [];
        };
        for (const seed of SEEDS.slice(0, 4)) {
            const meadow = kindsOf('meadow', seed);
            expect(meadow.some(k => k.startsWith(SHAPE.LAKE) || k === SHAPE.RIVER)).toBe(true);
            expect(kindsOf('flower_meadow', seed).length).toBeGreaterThan(0);
            expect(kindsOf('forest', seed)).toEqual(['lake2']);
            expect(kindsOf('cherry_grove', seed)).toEqual(['lake2']);
            const mountain = kindsOf('mountain', seed);
            expect([['lake1'], [SHAPE.RIVER, SHAPE.RIVER, SHAPE.RIVER, SHAPE.RIVER]]).toContainEqual(mountain);
            const springs = kindsOf('yellowstone', seed);
            expect(springs.length).toBeGreaterThan(8);
            expect(new Set(springs)).toEqual(new Set([SHAPE.POOL]));
            expect(kindsOf('volcano', seed)).toEqual([]);
            expect(kindsOf('coast', seed)).toEqual([SHAPE.SEA]);
        }
        // A forest with a little mountain: the forest's pond, no tarn.
        const hybrid = settle([mapOf('forest'), { ...mapOf('mountain'), points: 10 }], SEEDS[0]).terrain.water;
        expect(hybrid.shapes.map(s => s.k)).toEqual([SHAPE.LAKE]);
        // Every variety comes up in the meadow's draws, a lake with its river most.
        const seen = {};
        for (let s = 0; s < 60; s++) {
            const { kind } = planWater({ sea: 0, kinds: BIOME_WATER.meadow }, mulberry32(s), MAT, CLEAR);
            seen[kind] = (seen[kind] || 0) + 1;
        }
        expect(Object.keys(seen).sort()).toEqual([...new Set(BIOME_WATER.meadow)].sort());
        expect(seen[WATER_KIND.LAKE_RIVER]).toBe(Math.max(...Object.values(seen)));
    });

    it('lines a Coast\'s own groves along the sea, not round a pond', () => {
        const coast = { id: 'w_coast', kind: 'base', biome: 'coast', points: 12, nodes: [{ typeId: 'fishing_spot', weight: 1 }] };
        for (const seed of SEEDS.slice(0, 4)) {
            const result = settle([coast, mapOf('forest')], seed);
            const water = readWater(result.terrain.water);
            const spots = result.nodes.filter(n => n.typeId === 'fishing_spot');
            const bySea = spots.filter(n => {
                const sea = { ...water, shapes: water.shapes.filter(s => s.k === SHAPE.SEA) };
                return waterFieldAt(sea, n.x, n.y).f > -8 * TERRAIN_CELL;
            });
            expect(bySea.length / spots.length).toBeGreaterThanOrEqual(0.8);
        }
    });
});

describe('⭐ Stored with the cells', () => {
    it('⭐ round-trips through the save, and a map without shapes, or of another version, draws from its cells', () => {
        const result = settle([mapOf('meadow', WATER_KIND.SPLIT)], SEEDS[1]);
        const stored = JSON.parse(JSON.stringify(result.terrain));
        expect(stored.water.v).toBe(WATER_VERSION);
        const decoded = decodeTerrain(stored);
        expect(decoded.water).toEqual(readWater(result.terrain.water));
        expect(decodeTerrain({ ...stored, water: undefined }).water).toBeNull();
        expect(decodeTerrain({ ...stored, water: { ...stored.water, v: WATER_VERSION + 1 } }).water).toBeNull();
        // A shape that is not one is left out, never guessed at.
        const odd = { ...stored.water, shapes: [...stored.water.shapes, { k: 'lake', lobes: 'no' }, { k: 'volcano' }] };
        expect(decodeTerrain({ ...stored, water: odd }).water.shapes).toHaveLength(stored.water.shapes.length);
        // Encoding with the shapes keeps the cells as they were.
        const grid = { cols: stored.cols, rows: stored.rows };
        const terrains = [...stored.cells].map(ch => stored.legend[parseInt(ch, 36)]);
        expect(encodeTerrain(grid, terrains, stored.water)).toEqual(stored);
        expect(encodeTerrain(grid, terrains).water).toBeUndefined();
    });

    it('⭐ draws a smooth shore: the sea no longer steps a whole cell from one row of pixels to the next', () => {
        const coast = { id: 'w_coast', kind: 'base', biome: 'coast', points: 12, nodes: [{ typeId: 'fishing_spot', weight: 1 }] };
        for (const seed of SEEDS.slice(0, 4)) {
            const result = settle([coast], seed);
            const sea = result.terrain.water.shapes[0];
            /** How often the shore moves half a cell or more from one line of pixels along the sea's edge to the next. */
            const jumps = (terrain) => {
                const plan = buildGroundPlan(regionGround({ seed, ground: { main: 'coast', terrains: { coast: 'sand' } }, terrain }, MAT));
                const wet = (x, y) => plan.palette[plan.terrainAt[y * plan.width + x]].startsWith('water');
                const byRow = sea.side % 2 === 1;
                const lines = byRow ? plan.height : plan.width;
                const depth = byRow ? plan.width : plan.height;
                const from = sea.side === 0 || sea.side === 3;
                let last = null;
                let big = 0;
                for (let a = 0; a < lines; a++) {
                    let d = 0;
                    while (d < depth) {
                        const k = from ? d : depth - 1 - d;
                        if (!(byRow ? wet(k, a) : wet(a, k))) break;
                        d++;
                    }
                    if (last !== null && Math.abs(d - last) >= (TERRAIN_CELL / PLAN_PIXEL_U) / 2) big++;
                    last = d;
                }
                return big;
            };
            const { water: _shapes, ...cellsOnly } = result.terrain;
            expect(jumps(result.terrain), `seed ${seed}`).toBeLessThanOrEqual(2);
            // The same cells drawn the old way step at every line of cells the coast moves across.
            expect(jumps(cellsOnly), `seed ${seed}`).toBeGreaterThan(4);
        }
    });
});

describe('the field reads FAR where nothing reaches', () => {
    it('leaves a mat with no water at FAR, and no water at all for a biome that brings none', () => {
        const { f } = rasterise(null, { x0: 1, y0: 1, step: 2, nx: 10, ny: 10 });
        expect([...f].every(v => v === FAR)).toBe(true);
        expect(planWater({ sea: 0, kinds: [] }, mulberry32(1), MAT, CLEAR).record).toBeNull();
        expect(settle([mapOf('volcano')], SEEDS[0]).terrain.water).toBeUndefined();
        expect(STYLE.NONE).toBe(0);
    });
});
