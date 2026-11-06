import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import {
    planWater, readWater, rasterise, waterFieldAt, riverVariety, RIVER_VARIETY, WATER_KIND, SHAPE, BANK_PAD
} from '../systems/atlas/WaterShapes.js';
import { mulberry32 } from '../systems/atlas/seededRandom.js';
import { HALL_CLEARING, hallSpot } from '../systems/atlas/Layout.js';
import { TERRAIN_CELL } from '../systems/atlas/TerrainMap.js';

/**
 * ⭐ Rivers' courses (brief 370 R1, the owner's picks A and C): real bends and a width that changes
 * along the river, each map drawing its own (how much its rivers wind, how wide their wider
 * stretches, how near the Hall they pass); a split's arms joining where its river truly runs; every
 * other water, and every river stored before, exactly as it was. On the shipped mat.
 */

const MAT = Object.freeze({ w: 1920, h: 1040 });
const CLEAR = Object.freeze({ ...hallSpot(MAT), r: HALL_CLEARING + 2 * TERRAIN_CELL });
const PLAN = Object.freeze({ x0: 1, y0: 1, step: 2, nx: 960, ny: 520 });
const recordOf = (kind, seed) => planWater({ sea: 0, kinds: [kind] }, mulberry32(seed), MAT, CLEAR).record;
const riversOf = (water) => water.shapes.filter(s => s.k === SHAPE.RIVER);
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];

/** The narrowest a river runs, half its width: a placing cell wide. */
const CHANNEL_HW = TERRAIN_CELL / 2;

/**
 * The comparison's river measure (`docs/active/research/terrain_round/_tools/trx.js`, `riverStats`)
 * on one river's own field: its length over its ends' distance (sinuosity), how far it turns per
 * 1000 units (degrees, on a 96-unit baseline), and how much its width varies (the spread of widths
 * across it over their mean).
 */
function measure(water, river) {
    const { f } = rasterise({ ...water, shapes: [river] }, PLAN);
    const at = (x, y) => {
        const i = Math.round((x - PLAN.x0) / PLAN.step);
        const j = Math.round((y - PLAN.y0) / PLAN.step);
        return i < 0 || j < 0 || i >= PLAN.nx || j >= PLAN.ny ? -1 : f[j * PLAN.nx + i];
    };
    const pts = river.points;
    const walk = [];
    let length = 0;
    for (let k = 0; k + 1 < pts.length; k++) {
        const [ax, ay] = pts[k];
        const [bx, by] = pts[k + 1];
        const L = Math.hypot(bx - ax, by - ay);
        const n = Math.max(1, Math.round(L / 8));
        for (let q = 0; q < n; q++) walk.push([ax + (bx - ax) * q / n, ay + (by - ay) * q / n]);
        length += L;
    }
    const widths = [];
    for (let w = 96; w + 96 < walk.length * 8; w += 24) {
        const i = Math.floor(w / 8);
        const a = walk[Math.max(0, i - 8)];
        const b = walk[Math.min(walk.length - 1, i + 8)];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const [nx, ny] = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
        const [x, y] = walk[i];
        if (x < 8 || y < 8 || x > MAT.w - 8 || y > MAT.h - 8 || !(at(x, y) > 0)) continue;
        let d1 = 0;
        while (d1 < 240 && at(x + nx * d1, y + ny * d1) > 0) d1 += 2;
        let d2 = 0;
        while (d2 < 240 && at(x - nx * d2, y - ny * d2) > 0) d2 += 2;
        if (d1 < 240 && d2 < 240) widths.push(d1 + d2);
    }
    const headings = [];
    for (let i = 12; i + 12 < walk.length; i += 6) {
        const a = walk[i - 12];
        const b = walk[i + 12];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        headings.push([(b[0] - a[0]) / L, (b[1] - a[1]) / L]);
    }
    let turning = 0;
    for (let i = 1; i < headings.length; i++) {
        const [px, py] = headings[i - 1];
        const [hx, hy] = headings[i];
        turning += Math.abs(Math.atan2(px * hy - py * hx, px * hx + py * hy));
    }
    const chord = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) || 1;
    const mean = widths.reduce((a, b) => a + b, 0) / widths.length;
    const spread = Math.sqrt(widths.reduce((a, b) => a + (b - mean) ** 2, 0) / widths.length);
    return { sinuosity: length / chord, turning: turning * 57.3 / (length / 1000), widthCV: spread / mean };
}

/** The longest river of a record: a river across, a lake's longer river, a split's main arm. */
const mainOf = (water) => riversOf(water).sort((a, b) => b.points.length - a.points.length)[0];

/** How far the straight line between a river's two ends passes from the Hall, past its clearing. */
const chordFromHall = ([[ax, ay], ...rest]) => {
    const [bx, by] = rest[rest.length - 1];
    const t = Math.max(0, Math.min(1, ((CLEAR.x - ax) * (bx - ax) + (CLEAR.y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    return Math.hypot(CLEAR.x - ax - (bx - ax) * t, CLEAR.y - ay - (by - ay) * t) - CLEAR.r;
};

describe('⭐ Rivers bend and widen as the owner picked (brief 370, picks A and C)', () => {
    // The picks as the comparison measured them (`terrain_round/_tools/results.json`): a meadow
    // river 1.24 sinuous, turning 198° a thousand units, its width varying 0.16; a mountain river
    // 1.15, 166°, 0.19; a lake's river 1.23, 205°, 0.18. Before brief 370 a river across measured
    // about 1.06, 109° and 0.14 on these seeds.
    const SEEDS = Array.from({ length: 60 }, (_, i) => (i + 1) * 101);

    it('⭐ bends at least as much as the picks, and varies its width at least as much, on most maps', () => {
        const of = (kind) => SEEDS.map(seed => {
            const water = readWater(recordOf(kind, seed));
            return measure(water, mainOf(water));
        });
        const across = of(WATER_KIND.RIVER);
        expect(median(across.map(m => m.sinuosity)), 'a river across: sinuosity').toBeGreaterThanOrEqual(1.24);
        expect(median(across.map(m => m.turning)), 'a river across: turning').toBeGreaterThanOrEqual(198);
        expect(median(across.map(m => m.widthCV)), 'a river across: width').toBeGreaterThanOrEqual(0.19);
        const lake = of(WATER_KIND.LAKE_RIVER);
        expect(median(lake.map(m => m.sinuosity)), 'a lake\'s river: sinuosity').toBeGreaterThanOrEqual(1.23);
        expect(median(lake.map(m => m.turning)), 'a lake\'s river: turning').toBeGreaterThanOrEqual(205);
        expect(median(lake.map(m => m.widthCV)), 'a lake\'s river: width').toBeGreaterThanOrEqual(0.18);
    }, 60000);

    it('⭐ never doubles back on itself, by the same check as before, on any map', () => {
        let rivers = 0;
        for (const kind of [WATER_KIND.RIVER, WATER_KIND.LAKE_RIVER, WATER_KIND.SPLIT, WATER_KIND.SPRING]) {
            for (const seed of SEEDS) {
                for (const s of riversOf(readWater(recordOf(kind, seed)))) {
                    rivers++;
                    // The check rivers are made by: no two stretches nearer than three of its widths
                    // unless twice that far apart along it, and no right-angle turn within half of it.
                    const gap = 3 * 2 * Math.max(...s.w);
                    const n = s.points.length;
                    const along = [0];
                    for (let i = 1; i < n; i++) along.push(along[i - 1] + Math.hypot(s.points[i][0] - s.points[i - 1][0], s.points[i][1] - s.points[i - 1][1]));
                    for (let i = 0; i < n; i++) {
                        for (let j = i + 1; j < n; j++) {
                            if (along[j] - along[i] <= 2 * gap) continue;
                            const d = Math.hypot(s.points[i][0] - s.points[j][0], s.points[i][1] - s.points[j][1]);
                            if (d < gap) throw new Error(`${kind} ${seed}: comes back within ${d.toFixed(0)}`);
                        }
                    }
                }
            }
        }
        expect(rivers).toBeGreaterThan(300);
    }, 60000);
});

describe('⭐ Each map draws its own rivers (RIVER_VARIETY)', () => {
    const SEEDS = Array.from({ length: 90 }, (_, i) => i + 1);

    it('draws each dial from the map\'s seed alone, the same every time, across its whole range', () => {
        const draws = Array.from({ length: 400 }, (_, i) => riverVariety(i * 7919 + 13));
        expect(riverVariety(12345)).toEqual(riverVariety(12345));
        for (const dial of ['wind', 'wide', 'reach']) {
            const [lo, hi] = RIVER_VARIETY[dial];
            const values = draws.map(v => v[dial]);
            expect(Math.min(...values), dial).toBeGreaterThanOrEqual(lo);
            expect(Math.max(...values), dial).toBeLessThanOrEqual(hi);
            // Spread over the range, not stuck in one part of it.
            expect(Math.min(...values) - lo, dial).toBeLessThan((hi - lo) * 0.05);
            expect(hi - Math.max(...values), dial).toBeLessThan((hi - lo) * 0.05);
        }
    });

    /** A dial's effect: the median of `of` on the maps that drew the dial in its top half, and in its bottom half. */
    const halves = (rows, dial, of) => {
        const [lo, hi] = RIVER_VARIETY[dial];
        const mid = (lo + hi) / 2;
        return [median(rows.filter(r => r.v[dial] < mid).map(of)), median(rows.filter(r => r.v[dial] >= mid).map(of))];
    };

    it('⭐ a windier map\'s rivers wind more, a wider map\'s run wider in their wider stretches, and a map with less reach lets them pass nearer the Hall', () => {
        const rows = [];
        for (const kind of [WATER_KIND.RIVER, WATER_KIND.SPRING]) {
            for (const seed of SEEDS) {
                const record = recordOf(kind, seed);
                const water = readWater(record);
                const main = mainOf(water);
                rows.push({ kind, v: riverVariety(record.salt), main, water });
            }
        }
        // How much a river winds: its length over its line's.
        const winding = (r) => {
            let length = 0;
            for (let k = 1; k < r.main.points.length; k++) length += Math.hypot(r.main.points[k][0] - r.main.points[k - 1][0], r.main.points[k][1] - r.main.points[k - 1][1]);
            const [a, b] = [r.main.points[0], r.main.points[r.main.points.length - 1]];
            return length / Math.hypot(a[0] - b[0], a[1] - b[1]);
        };
        const [calm, windy] = halves(rows, 'wind', winding);
        expect(windy - calm, `winding ${calm.toFixed(3)} → ${windy.toFixed(3)}`).toBeGreaterThan(0.04);
        // How wide its widest stretch runs, against its usual width downstream.
        const widest = (r) => Math.max(...r.main.h) / r.main.w[1];
        const [narrow, wide] = halves(rows, 'wide', widest);
        expect(wide - narrow, `widest ${narrow.toFixed(2)} → ${wide.toFixed(2)}`).toBeGreaterThan(0.1);
        // How near the Hall a river across runs (its line, past the clearing).
        const across = rows.filter(r => r.kind === WATER_KIND.RIVER);
        const [near, far] = halves(across, 'reach', r => chordFromHall(r.main.points));
        expect(far - near, `passes ${near.toFixed(0)} → ${far.toFixed(0)} past the clearing`).toBeGreaterThan(40);
    }, 60000);
});

describe('⭐ A river is at least a placing cell wide everywhere', () => {
    it('⭐ stores no width under a cell, and its water covers a cell\'s width of its middle all along, but in the Hall\'s clearing', () => {
        let checked = 0;
        for (const kind of [WATER_KIND.RIVER, WATER_KIND.LAKE_RIVER, WATER_KIND.SPLIT, WATER_KIND.SPRING, WATER_KIND.MOUNTAIN_RIVER]) {
            for (let seed = 1; seed <= 6; seed++) {
                const water = readWater(recordOf(kind, seed));
                for (const s of riversOf(water)) {
                    expect(s.h, `${kind} ${seed}`).toBeDefined();
                    expect(Math.min(...s.h), `${kind} ${seed}`).toBeGreaterThanOrEqual(CHANNEL_HW);
                    const alone = { ...water, shapes: [s] };
                    for (let k = 0; k + 1 < s.points.length; k++) {
                        const [ax, ay] = s.points[k];
                        const [bx, by] = s.points[k + 1];
                        const L = Math.hypot(bx - ax, by - ay) || 1;
                        const [nx, ny] = [-(by - ay) / L, (bx - ax) / L];
                        for (let q = 0; q < L; q += 12) {
                            const x = ax + (bx - ax) * q / L;
                            const y = ay + (by - ay) * q / L;
                            for (const side of [-1, 1]) {
                                const px = x + nx * side * (CHANNEL_HW - 1);
                                const py = y + ny * side * (CHANNEL_HW - 1);
                                if (Math.hypot(px - CLEAR.x, py - CLEAR.y) < CLEAR.r + 40) continue;
                                checked++;
                                if (!(waterFieldAt(alone, px, py).f > 0)) throw new Error(`${kind} ${seed}: dry ${CHANNEL_HW - 1} from its middle at ${px.toFixed(0)},${py.toFixed(0)}`);
                            }
                        }
                    }
                }
            }
        }
        expect(checked).toBeGreaterThan(5000);
    }, 60000);
});

describe('⭐ A split river\'s arms join where the river runs', () => {
    it('⭐ the side channel leaves and rejoins the main arm in its water, keeps off it round the island, and the delta\'s mouths fork from the main arm\'s end', () => {
        let deltas = 0;
        for (let seed = 1; seed <= 40; seed++) {
            const water = readWater(recordOf(WATER_KIND.SPLIT, seed));
            const [main, channel, ...mouths] = riversOf(water);
            const mainOnly = { ...water, shapes: [main] };
            // Both its ends in the main arm's water, not merely near it.
            for (const [x, y] of [channel.points[0], channel.points[channel.points.length - 1]]) {
                expect(waterFieldAt(mainOnly, x, y).f, `${seed}: the channel's end at ${x},${y}`).toBeGreaterThan(CHANNEL_HW - 4);
            }
            // Round the island (past the stretches where it leaves and rejoins), its middle at least
            // its own width's half outside the main arm's water: land between them.
            const along = [0];
            for (let i = 1; i < channel.points.length; i++) along.push(along[i - 1] + Math.hypot(channel.points[i][0] - channel.points[i - 1][0], channel.points[i][1] - channel.points[i - 1][1]));
            const total = along[along.length - 1];
            channel.points.forEach(([x, y], i) => {
                if (along[i] < 150 || total - along[i] < 150) return;
                expect(waterFieldAt(mainOnly, x, y).f, `${seed}: the channel at ${x},${y}`).toBeLessThanOrEqual(-CHANNEL_HW);
            });
            // The side channel is a cell wide all along, every one of its widths the narrowest.
            expect(new Set(channel.h)).toEqual(new Set([CHANNEL_HW]));
            if (mouths.length) {
                deltas++;
                expect(mouths).toHaveLength(2);
                for (const m of mouths) expect(m.points[0], `${seed}: a mouth`).toEqual(main.points[main.points.length - 1]);
            }
        }
        expect(deltas).toBeGreaterThan(10);
    }, 60000);
});

describe('⭐ Every other water, and every river stored before, as it was', () => {
    const fnv = (text) => {
        let h = 0x811c9dc5;
        for (let i = 0; i < text.length; i++) {
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(16).padStart(8, '0');
    };
    const fieldHash = (f) => {
        let h = 0x811c9dc5;
        for (let i = 0; i < f.length; i++) {
            const v = Math.round(f[i] * 1000);
            h ^= v & 0xffff;
            h = Math.imul(h, 0x01000193);
            h ^= (v >>> 16) & 0xffff;
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(16).padStart(8, '0');
    };

    it('⭐ makes every lake, pond, tarn, spring, marsh and sea exactly as before: its map\'s layout moves only where a river runs', () => {
        // Taken on main (f0960613) before brief 370: 200 maps of each.
        const records = [];
        for (const kind of [WATER_KIND.LAKE, WATER_KIND.POND, WATER_KIND.TARN, WATER_KIND.SULPHUR, WATER_KIND.MARSH]) {
            for (let s = 1; s <= 200; s++) records.push(JSON.stringify(planWater({ sea: 0, kinds: [kind] }, mulberry32(s), MAT, CLEAR)));
        }
        for (let s = 1; s <= 200; s++) records.push(JSON.stringify(planWater({ sea: 0.3, kinds: [] }, mulberry32(s), MAT, CLEAR)));
        expect(fnv(records.join('|'))).toBe('a5c610de');
    }, 30000);

    it('⭐ draws a river stored before brief 370 with its old banks, to the bit, and never gives it widths it never had', () => {
        const { rivers } = JSON.parse(fs.readFileSync(new URL('./fixtures/riversBefore370.json', import.meta.url), 'utf8'));
        expect(rivers).toHaveLength(5);
        for (const { kind, record, field } of rivers) {
            const water = readWater(record);
            expect(riversOf(water).every(s => s.h === undefined), kind).toBe(true);
            expect(fieldHash(rasterise(water, PLAN).f), kind).toBe(field);
            expect(fieldHash(rasterise(water, PLAN, { bends: true }).f), kind).toBe(field);
        }
    }, 30000);

    it('reads a river\'s widths only when there is one a point, each above 0', () => {
        const record = recordOf(WATER_KIND.RIVER, 2);
        const river = record.shapes.find(s => s.k === SHAPE.RIVER);
        expect(river.h).toHaveLength(river.p.length / 2);
        const short = { ...record, shapes: [{ ...river, h: river.h.slice(1) }] };
        expect(readWater(short).shapes[0].h).toBeUndefined();
        const zero = { ...record, shapes: [{ ...river, h: river.h.map((v, i) => (i === 3 ? 0 : v)) }] };
        expect(readWater(zero).shapes[0].h).toBeUndefined();
    });
});

describe('⭐ The drawing\'s field with the bends', () => {
    it('⭐ is the slow reference\'s exactly wherever the water is near, and says on which side of a bend the land by a river lies', () => {
        for (const kind of [WATER_KIND.RIVER, WATER_KIND.SPLIT, WATER_KIND.LAKE_RIVER]) {
            const water = readWater(recordOf(kind, 9));
            const { f, bar } = rasterise(water, PLAN, { bends: true });
            expect(bar, kind).toBeInstanceOf(Float32Array);
            let inside = 0;
            let outside = 0;
            for (let j = 0; j < PLAN.ny; j += 5) {
                for (let i = 0; i < PLAN.nx; i += 5) {
                    const p = j * PLAN.nx + i;
                    const ref = waterFieldAt(water, PLAN.x0 + i * PLAN.step, PLAN.y0 + j * PLAN.step);
                    if (ref.f > -BANK_PAD && f[p] !== ref.f) throw new Error(`${kind} at ${i},${j}: ${f[p]} vs ${ref.f}`);
                    if (bar[p] > 0) inside++;
                    if (bar[p] < 0) outside++;
                    expect(Math.abs(bar[p])).toBeLessThanOrEqual(1);
                }
            }
            expect(inside, kind).toBeGreaterThan(20);
            expect(outside, kind).toBeGreaterThan(20);
        }
        // Without the bends, no such numbers: the cells' samples never pay for them.
        expect(rasterise(readWater(recordOf(WATER_KIND.RIVER, 9)), PLAN).bar).toBeUndefined();
    }, 60000);
});
