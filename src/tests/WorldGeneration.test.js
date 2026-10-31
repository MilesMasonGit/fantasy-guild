import { describe, it, expect, vi } from 'vitest';
import { generateWorld, arrangeWedges, neighbourScore, ORIGIN_ROLE, PROBLEM } from '../systems/world/generate.js';
import { worldFindings, WORLD_CHECK } from '../systems/world/checks.js';
import { cellId, distance, neighbours, ringCells } from '../systems/world/hex.js';
import { normaliseWorldTables, STRICT_RINGS } from '../config/worldTablesShape.js';
import { mulberry32 } from '../systems/atlas/seededRandom.js';
import { FIXTURE_WORLD_RAW, FIXTURE_WORLD_TABLES, FIXTURE_LOOKUPS } from './fixtures/worldTables.js';

/**
 * ⭐ The world's generation (brief 330 W1): a seeded hex world of origins around the Hall, its six
 * wedges shuffled with neighbour preference, and every guarantee the owner set held over thousands
 * of seeds. The checks (`checks.js`) read the finished world without trusting the generator; the
 * last block breaks a good world one rule at a time to show each check can fail.
 */

const tablesWith = (patch) => normaliseWorldTables({ ...FIXTURE_WORLD_RAW, ...patch });
/** The fixture with no wild rings, for sweeps of rules only the strict rings keep. */
const strictWith = (patch = {}) => tablesWith({ wild: { ...FIXTURE_WORLD_RAW.wild, rings: 0 }, ...patch });
const STRICT_ONLY = strictWith();
const make = (seed, tables = FIXTURE_WORLD_TABLES) => generateWorld({ seed, tables, ...FIXTURE_LOOKUPS });
const findings = (world, tables = FIXTURE_WORLD_TABLES) => worldFindings(world, tables, FIXTURE_LOOKUPS);
const byId = (world) => new Map(world.cells.map(c => [c.id, c]));
const copy = (v) => JSON.parse(JSON.stringify(v));

describe('World generation: determinism', () => {
    it('the same seed and tables make the same world, to the last field', () => {
        for (const seed of [0, 1, 7, 123456789, 4294967295]) {
            expect(JSON.stringify(make(seed))).toBe(JSON.stringify(make(seed)));
        }
    });

    it('different seeds make different worlds', () => {
        const seen = new Set();
        for (let seed = 1; seed <= 50; seed++) seen.add(JSON.stringify(make(seed).cells.map(c => [c.wedge, c.origins, c.specialty])));
        expect(seen.size).toBe(50);
    });

    it('never draws from Math.random, so generating a world cannot change what the game rolls next', () => {
        const spy = vi.spyOn(Math, 'random');
        make(42);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('a ring added outward later moves nothing inside it', () => {
        const small = generateWorld({ seed: 99, tables: tablesWith({ wild: { ...FIXTURE_WORLD_RAW.wild, rings: 1 } }), ...FIXTURE_LOOKUPS });
        const large = make(99);
        const inner = large.cells.filter(c => c.ring <= small.rings);
        expect(JSON.stringify(small.cells)).toBe(JSON.stringify(inner));
    });
});

describe('World generation: the shape', () => {
    const world = make(2026);

    it('the Hall\'s cell, three strict rings and the wild rings beyond: 1 + 6 + 12 + 18 + 24 + 30 + 36 cells', () => {
        expect(world.strictRings).toBe(3);
        expect(world.rings).toBe(6);
        expect(world.cells).toHaveLength(127);
        expect(world.cells[0]).toMatchObject({ id: '0,0', ring: 0, tier: 0, wedge: null, wild: false, requires: null });
        expect(world.cells[0].origins.map(o => o.id)).toEqual(['h_wood', 'h_stone']);
        expect(world.cells[0].origins.every(o => o.role === ORIGIN_ROLE.HALL)).toBe(true);
    });

    it('tier by ring: each strict ring its own tier, every wild ring the last strict tier, marked wild', () => {
        for (const cell of world.cells) {
            expect(cell.tier).toBe(Math.min(cell.ring, STRICT_RINGS));
            expect(cell.wild).toBe(cell.ring > STRICT_RINGS);
            if (cell.wild) expect(cell.extreme).not.toBeNull();
            else expect(cell.extreme).toBeNull();
        }
    });

    it('six wedges, one line each, n cells of each in ring n', () => {
        expect(new Set(world.wedges).size).toBe(6);
        for (let n = 1; n <= world.rings; n++) {
            for (const line of world.wedges) expect(world.cells.filter(c => c.ring === n && c.wedge === line)).toHaveLength(n);
        }
    });

    it('a cell\'s main origins come from its own line\'s table for its ring', () => {
        for (const cell of world.cells.filter(c => c.ring >= 1 && c.ring <= STRICT_RINGS)) {
            const table = FIXTURE_WORLD_TABLES.lines.find(l => l.id === cell.wedge).origins[cell.ring].map(o => o.id);
            const mains = cell.origins.filter(o => o.role === ORIGIN_ROLE.MAIN);
            expect(mains.length).toBeGreaterThanOrEqual(1);
            for (const o of mains) expect(table).toContain(o.id);
        }
    });

    it('blends come only from a wedge the cell touches, from that line\'s table of the cell\'s ring', () => {
        const cells = byId(world);
        for (const cell of world.cells.filter(c => c.ring >= 1 && c.ring <= STRICT_RINGS)) {
            for (const o of cell.origins.filter(x => x.role === ORIGIN_ROLE.BLEND)) {
                const touches = neighbours(cell).some(n => cells.get(cellId(n.q, n.r))?.wedge === o.line);
                expect(touches).toBe(true);
                expect(FIXTURE_WORLD_TABLES.lines.find(l => l.id === o.line).origins[cell.ring].map(x => x.id)).toContain(o.id);
            }
        }
    });

    it('a cell inside its wedge, touching no other, has no blend', () => {
        const ring3 = world.cells.filter(c => c.ring === 3);
        const middles = ringCells(3).filter(c => c.step === 1).map(c => byId(world).get(cellId(c.q, c.r)));
        expect(middles).toHaveLength(6);
        for (const cell of middles) expect(cell.origins.some(o => o.role === ORIGIN_ROLE.BLEND)).toBe(false);
        expect(ring3.some(c => c.origins.some(o => o.role === ORIGIN_ROLE.BLEND))).toBe(true);
    });
});

describe('World generation: the guarantees hold over thousands of seeds', () => {
    it('3000 seeds, strict rings: every check passes and nothing is left unmet', () => {
        const failed = [];
        for (let seed = 1; seed <= 3000; seed++) {
            const world = make(seed, STRICT_ONLY);
            const found = findings(world, STRICT_ONLY);
            if (found.length || world.problems.length) failed.push({ seed, found: found.slice(0, 3), problems: world.problems.slice(0, 3) });
        }
        expect(failed).toEqual([]);
    }, 120000);

    it('500 seeds with the wild rings: every check passes', () => {
        const failed = [];
        for (let seed = 10001; seed <= 10500; seed++) {
            const world = make(seed);
            const found = findings(world);
            if (found.length || world.problems.length) failed.push({ seed, found: found.slice(0, 3), problems: world.problems.slice(0, 3) });
        }
        expect(failed).toEqual([]);
    }, 120000);

    it('every origin the tables list sits in the inner rings, and each key within a step of every cell one ring in', () => {
        for (let seed = 1; seed <= 200; seed++) {
            const world = make(seed, STRICT_ONLY);
            const cells = byId(world);
            const inner = new Set(world.cells.filter(c => c.ring >= 1).flatMap(c => c.origins.map(o => o.id)));
            for (const line of FIXTURE_WORLD_TABLES.lines) {
                for (let n = 1; n <= 3; n++) for (const o of line.origins[n]) expect(inner.has(o.id)).toBe(true);
            }
            for (let n = 1; n <= 3; n++) {
                for (const key of FIXTURE_WORLD_TABLES.keys[n]) {
                    for (const cell of world.cells.filter(c => c.ring === n - 1)) {
                        const out = neighbours(cell).map(x => cells.get(cellId(x.q, x.r))).filter(c => c?.ring === n);
                        expect(out.some(c => c.origins.some(o => o.id === key))).toBe(true);
                    }
                }
            }
        }
    });

    it('a key no line lists is put out by the key step alone, still within reach of every cell one ring in', () => {
        const tables = strictWith({ keys: { 1: [], 2: ['k_banner'], 3: [] } });
        for (let seed = 1; seed <= 300; seed++) {
            const world = make(seed, tables);
            expect(findings(world, tables).filter(f => f.check === WORLD_CHECK.KEY_REACH)).toEqual([]);
            const holders = world.cells.filter(c => c.origins.some(o => o.id === 'k_banner'));
            expect(holders.every(c => c.ring === 2)).toBe(true);
            // Every ring-1 cell needs one, and a ring-2 cell reaches at most two: three is the least.
            expect(holders.length).toBeGreaterThanOrEqual(3);
            expect(holders.length).toBeLessThanOrEqual(6);
            expect(holders.every(c => c.origins.find(o => o.id === 'k_banner').role === ORIGIN_ROLE.KEY)).toBe(true);
        }
    });

    it('prices: materials of earlier rings only, from at most two places, one of them beside the cell; dearer every ring out', () => {
        for (let seed = 1; seed <= 100; seed++) {
            const world = make(seed);
            const cells = byId(world);
            for (const cell of world.cells.filter(c => c.ring >= 1)) {
                expect(cell.payFrom.length).toBeGreaterThanOrEqual(1);
                expect(cell.payFrom.length).toBeLessThanOrEqual(2);
                const places = cell.payFrom.map(id => cells.get(id));
                expect(places.every(p => p.ring < cell.ring)).toBe(true);
                expect(places.some(p => distance(p, cell) === 1 && p.ring === cell.ring - 1)).toBe(true);
            }
            const total = (c) => c.requires.items.reduce((n, i) => n + i.qty, 0);
            for (let n = 2; n <= world.rings; n++) {
                const here = world.cells.filter(c => c.ring === n).map(total);
                const before = world.cells.filter(c => c.ring === n - 1).map(total);
                expect(Math.min(...here)).toBeGreaterThan(Math.max(...before));
            }
        }
    });
});

describe('World generation: the wedges prefer natural neighbours', () => {
    const shuffleRates = (tables, seeds = 3000) => {
        let both = 0;
        let any = 0;
        const sideOfLine = new Map(tables.lines.map(l => [l.id, new Array(6).fill(0)]));
        for (let seed = 1; seed <= seeds; seed++) {
            const order = arrangeWedges(tables, mulberry32(seed));
            expect([...order].sort()).toEqual(tables.lines.map(l => l.id).sort());
            const score = neighbourScore(tables, order);
            if (score >= 2) both++;
            if (score >= 1) any++;
            order.forEach((line, side) => sideOfLine.get(line)[side]++);
        }
        return { both: both / seeds, any: any / seeds, sideOfLine };
    };

    it('Waters lands between Herbs and Crops about half the time, beside at least one nearly always', () => {
        // Exact odds at strength 8: 12 orders of 120 score 2, 72 score 1, so 768/1380 and 1344/1380.
        const { both, any, sideOfLine } = shuffleRates(FIXTURE_WORLD_TABLES);
        expect(both).toBeGreaterThan(0.50);
        expect(both).toBeLessThan(0.62);
        expect(any).toBeGreaterThan(0.95);
        // Still shuffled: every line points every way about one time in six.
        for (const counts of sideOfLine.values()) for (const n of counts) expect(n / 3000).toBeGreaterThan(0.13);
    });

    it('with no preference the same pairs meet only by chance', () => {
        const { both, any } = shuffleRates(tablesWith({ neighbourStrength: 1 }));
        // Chance: 12 of 120 orders, and 84 of 120.
        expect(both).toBeGreaterThan(0.07);
        expect(both).toBeLessThan(0.13);
        expect(any).toBeGreaterThan(0.65);
        expect(any).toBeLessThan(0.75);
    });
});

describe('World generation: specialties, kits and the value budget', () => {
    it('each strict ring\'s bag holds every specialty n times, and the pity rule spreads them round the ring', () => {
        for (let seed = 1; seed <= 300; seed++) {
            const world = make(seed, STRICT_ONLY);
            for (let n = 1; n <= 3; n++) {
                const walk = ringCells(n).map(c => byId(world).get(cellId(c.q, c.r)).specialty);
                for (const s of FIXTURE_WORLD_TABLES.specialties) expect(walk.filter(x => x === s)).toHaveLength(n);
                // Six specialties and a window of four: every run of six cells round a ring, across
                // its seam too, holds each once.
                const twice = [...walk, ...walk];
                for (let i = 0; i < walk.length; i++) expect(new Set(twice.slice(i, i + 6)).size).toBe(6);
            }
        }
    });

    it('with a seventh specialty the pity rule still holds, though ring 1\'s six cells cannot hold all seven', () => {
        const tables = strictWith({ specialties: [...FIXTURE_WORLD_RAW.specialties, 'enchanting'] });
        expect(tables.issues.some(i => /ring 1/.test(i))).toBe(true);
        for (let seed = 1; seed <= 300; seed++) {
            const found = findings(make(seed, tables), tables);
            expect(found.filter(f => f.check === WORLD_CHECK.PITY || f.check === WORLD_CHECK.BAG)).toEqual([]);
        }
    });

    it('a pity window longer than the ring leaves the bag to chance', () => {
        const tables = strictWith({ pityWindow: 50 });
        let clustered = 0;
        for (let seed = 1; seed <= 200; seed++) {
            const world = make(seed, tables);
            const walk = ringCells(3).map(c => byId(world).get(cellId(c.q, c.r)).specialty);
            for (let i = 0; i + 1 < walk.length; i++) if (walk[i] === walk[i + 1]) clustered++;
            expect(findings(world, tables).filter(f => f.check === WORLD_CHECK.PITY)).toEqual([]);
        }
        expect(clustered).toBeGreaterThan(0);
    });

    it('kits follow the line\'s lean; a line with no lean takes any kit', () => {
        const counts = {};
        for (let seed = 1; seed <= 300; seed++) {
            for (const cell of make(seed, STRICT_ONLY).cells.filter(c => c.ring > 0)) {
                const key = `${cell.wedge}:${cell.kit}`;
                counts[key] = (counts[key] || 0) + 1;
                if (cell.wedge === 'trees') expect(cell.kit).toBe('woodland');
                if (cell.wedge === 'herbs') expect(cell.kit).toBe('wetland');
                if (cell.wedge === 'ores') expect(['highland', 'riverside']).toContain(cell.kit);
            }
        }
        expect(counts['ores:highland']).toBeGreaterThan(counts['ores:riverside'] * 2);
        for (const kit of ['highland', 'woodland', 'plains', 'wetland', 'riverside']) expect(counts[`arcane:${kit}`]).toBeGreaterThan(0);
    });

    it('a strict cell\'s hidden extras are worth its ring\'s value within 10 %', () => {
        for (let seed = 1; seed <= 300; seed++) {
            for (const cell of make(seed, STRICT_ONLY).cells.filter(c => c.ring > 0)) {
                const target = FIXTURE_WORLD_TABLES.ringValue[cell.ring];
                expect(Math.abs(cell.value - target)).toBeLessThanOrEqual(target * 0.1);
                expect(cell.extras.reduce((n, e) => n + e.value, 0)).toBe(cell.value);
            }
        }
    });

    it('extras that cannot reach a ring\'s value are reported, not stretched', () => {
        const tables = tablesWith({ extras: [{ id: 'mod_tiny', kind: 'modifier', value: 1 }] });
        const world = make(5, tables);
        const value = world.problems.filter(p => p.kind === PROBLEM.VALUE);
        expect(value).toHaveLength(36);
        expect(findings(world, tables).filter(f => f.check === WORLD_CHECK.VALUE)).toHaveLength(36);
    });
});

describe('World generation: holes in the tables are listed, never papered over', () => {
    it('a line with nothing for a ring: its cells there have no main origin, said once per line and ring', () => {
        const raw = copy(FIXTURE_WORLD_RAW);
        raw.lines.find(l => l.id === 'arcane').origins = { 1: [], 2: [], 3: [] };
        const tables = normaliseWorldTables(raw);
        const world = make(3, tables);
        expect(world.problems.filter(p => p.kind === PROBLEM.EMPTY_TABLE).map(p => p.ring)).toEqual([1, 2, 3]);
        const found = findings(world, tables);
        expect(found.filter(f => f.check === WORLD_CHECK.NO_MAIN).length).toBe(1 + 2 + 3 + 4 + 5 + 6);
    });

    it('no specialties listed: said once, and no cell gets one', () => {
        const world = make(3, tablesWith({ specialties: [] }));
        expect(world.problems.map(p => p.kind)).toContain(PROBLEM.NO_SPECIALTIES);
        expect(world.cells.every(c => c.specialty === null)).toBe(true);
    });
});

describe('World checks: each one can fail', () => {
    const good = make(77);
    const cellOf = (world, ring, pick = 0) => world.cells.filter(c => c.ring === ring)[pick];

    it('a good world has no findings', () => {
        expect(findings(good)).toEqual([]);
    });

    it('a key moved out of reach', () => {
        const world = copy(good);
        for (const cell of world.cells.filter(c => c.ring === 2)) cell.origins = cell.origins.filter(o => o.id !== 'f_ores_2a');
        expect(findings(world).some(f => f.check === WORLD_CHECK.KEY_REACH)).toBe(true);
    });

    it('a specialty bag gone uneven, and the pity rule broken', () => {
        const uneven = copy(good);
        cellOf(uneven, 2, 0).specialty = cellOf(uneven, 2, 1).specialty;
        expect(findings(uneven).some(f => f.check === WORLD_CHECK.BAG)).toBe(true);

        const late = copy(good);
        // An even bag, but at the fifth cell Mining comes back while Alchemy and Combat are overdue.
        const walk = ringCells(2).map(c => byId(late).get(cellId(c.q, c.r)));
        const order = ['mining', 'forestry', 'farming', 'fishing', 'mining', 'alchemy', 'combat', 'forestry', 'farming', 'fishing', 'alchemy', 'combat'];
        walk.forEach((cell, i) => { cell.specialty = order[i]; });
        expect(findings(late).some(f => f.check === WORLD_CHECK.PITY)).toBe(true);
    });

    it('extras off the ring\'s value', () => {
        const world = copy(good);
        const cell = cellOf(world, 1);
        cell.extras.push({ id: 'mod_camp', kind: 'modifier', value: 8 });
        cell.value += 8;
        expect(findings(world).some(f => f.check === WORLD_CHECK.VALUE)).toBe(true);
    });

    it('iron to reach iron: a ring-2 cell asking a ring-2 material', () => {
        const world = copy(good);
        const cell = cellOf(world, 2);
        cell.requires.items[0].itemId = 'i_ores_2a';
        expect(findings(world).some(f => f.check === WORLD_CHECK.PRICE_RING)).toBe(true);
    });

    it('a price gathered from too many places, or from a place not beside the cell', () => {
        const far = copy(good);
        const cell = cellOf(far, 3);
        const notBeside = far.cells.find(c => c.ring === 2 && distance(c, cell) > 1);
        cell.payFrom = [notBeside.id];
        expect(findings(far).some(f => f.check === WORLD_CHECK.PRICE_PLACES && f.cellId === cell.id)).toBe(true);

        const many = copy(good);
        const c3 = cellOf(many, 3);
        c3.payFrom = [...c3.payFrom, '0,0', cellOf(many, 1).id];
        expect(findings(many).some(f => f.check === WORLD_CHECK.PRICE_PLACES && f.cellId === c3.id)).toBe(true);
    });

    it('a ring no dearer than the one before', () => {
        const world = copy(good);
        cellOf(world, 2).requires.items = [{ itemId: 'i_ores_1a', qty: 1 }];
        expect(findings(world).some(f => f.check === WORLD_CHECK.PRICE_RISES)).toBe(true);
    });

    it('an origin the tables list missing from the inner rings', () => {
        const world = copy(good);
        for (const cell of world.cells.filter(c => c.ring >= 1 && c.ring <= 3)) cell.origins = cell.origins.filter(o => o.id !== 'f_herbs_3d');
        expect(findings(world).some(f => f.check === WORLD_CHECK.COVERAGE)).toBe(true);
    });

    it('a wrong tier, a wild cell with no extreme, a kit the tables do not list, a moved wedge', () => {
        const world = copy(good);
        cellOf(world, 2).tier = 1;
        cellOf(world, 5).extreme = null;
        cellOf(world, 1).kit = 'tundra';
        cellOf(world, 3, 4).wedge = world.wedges[0] === cellOf(world, 3, 4).wedge ? world.wedges[1] : world.wedges[0];
        const checks = new Set(findings(world).map(f => f.check));
        for (const check of [WORLD_CHECK.TIER, WORLD_CHECK.WILD, WORLD_CHECK.KIT, WORLD_CHECK.SHAPE]) expect(checks.has(check)).toBe(true);
    });
});
