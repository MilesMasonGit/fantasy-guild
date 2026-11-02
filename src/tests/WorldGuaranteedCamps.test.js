import { describe, it, expect } from 'vitest';
import { generateWorld } from '../systems/world/generate.js';
import { cellMat, busyHeroes, MAX_HEROES } from '../systems/world/cellMat.js';
import { worldFindings, WORLD_CHECK } from '../systems/world/checks.js';
import { normaliseWorldTables, STRICT_RINGS } from '../config/worldTablesShape.js';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';
import { worldPlan, WORLD_F } from '../systems/progression/ledger/world.js';
import { tokenKey } from '../systems/progression/ledger/engine.js';
import { WORLD_FIXTURE_RAW, worldWorkspace, contentOf } from './fixtures/ledgerWorldMap.js';

/**
 * ⭐ Every Live enemy has a guaranteed place in every world (owner, 2026-11-01): the world tables may
 * list, per strict ring, the creatures' camps that ring holds in every world (`camps`). Each stands
 * in at least one cell of its ring, in a cell whose kit names it where one does, spread over the
 * ring; it stands on that cell's mat as part of the kit's combat work and is never cut by the cap.
 * Wild rings add copies through the kits, never the only one.
 */

const RING1 = ['token_wolf_den', 'token_crab_rocks', 'token_wild_hive', 'token_cow_pasture', 'token_thorn_thicket',
    'token_alpha_den', 'token_chief_tent', 'token_tide_pool', 'token_slime_pit', 'token_wind_stones', 'token_queens_hive'];
const RING2 = ['token_ember_vents', 'token_sulphur_rocks', 'token_frog_pond', 'token_smoking_crater', 'token_basking_stone', 'token_toxic_pool'];

const RAW = { ...PLACEHOLDER_WORLD_TABLES, camps: { 1: RING1, 2: [{ id: 'token_ember_vents', kits: ['highland'] }, ...RING2.slice(1)] } };
const TABLES = normaliseWorldTables(RAW);
const PLAIN = normaliseWorldTables(PLACEHOLDER_WORLD_TABLES);
const SEEDS = Array.from({ length: 150 }, (_, i) => 7 + i * 13);
const ringCells = (world, n) => world.cells.filter(c => c.ring === n);
const skillOf = (id) => (/vein|outcrop|deposit/.test(id) ? 'mining' : /tree/.test(id) ? 'forestry' : /coast|river|lake|pool/.test(id) ? 'fishing' : 'farming');

describe('⭐ the tables\' guaranteed camps', () => {
    it('are read per strict ring, as ids or { id, kits }; blanks, repeats and unknown kits dropped and said', () => {
        const t = normaliseWorldTables({
            ...PLACEHOLDER_WORLD_TABLES,
            camps: { 1: ['token_wolf_den', ' token_wolf_den ', '', { id: 'token_crab_rocks', kits: ['riverside', 'nowhere'] }], 4: ['token_x'] }
        });
        expect(t.camps[1]).toEqual([{ id: 'token_wolf_den', kits: [] }, { id: 'token_crab_rocks', kits: ['riverside'] }]);
        expect(t.camps[2]).toEqual([]);
        expect(t.camps[3]).toEqual([]);
        expect(t.camps[4]).toBeUndefined();
        expect(t.issues.some(i => /nowhere/.test(i))).toBe(true);
        expect(PLAIN.camps).toEqual({ 1: [], 2: [], 3: [] });
    });

    it('⭐ each stands in at least one cell of its ring, in every world', () => {
        for (const seed of SEEDS) {
            const world = generateWorld({ seed, tables: TABLES });
            for (const [n, ids] of [[1, RING1], [2, RING2]]) {
                const held = new Set(ringCells(world, n).flatMap(c => c.camps));
                for (const id of ids) expect(held.has(id), `${seed} ring ${n} ${id}`).toBe(true);
            }
            for (const cell of world.cells) if (cell.ring === 0 || cell.ring > 2) expect(cell.camps).toEqual([]);
        }
    });

    it('goes to a cell whose kit it names when the ring has one, and spreads over the ring', () => {
        let named = 0;
        let had = 0;
        for (const seed of SEEDS) {
            const world = generateWorld({ seed, tables: TABLES });
            const ring2 = ringCells(world, 2);
            if (ring2.some(c => c.kit === 'highland')) {
                had++;
                if (ring2.some(c => c.kit === 'highland' && c.camps.includes('token_ember_vents'))) named++;
            }
            // Eleven camps over six cells: two each, a third on one only when a kit draws it there.
            const counts = ringCells(world, 1).map(c => c.camps.length);
            expect(Math.max(...counts) - Math.min(...counts), `${seed}`).toBeLessThanOrEqual(2);
            expect(counts.reduce((a, b) => a + b, 0)).toBe(RING1.length);
        }
        expect(had).toBeGreaterThan(20);
        expect(named).toBe(had);
    });

    it('moves nothing else: the same seed generates the same world with or without them', () => {
        for (const seed of SEEDS.slice(0, 30)) {
            const strip = (w) => ({ ...w, cells: w.cells.map(({ camps, ...rest }) => rest) });
            expect(strip(generateWorld({ seed, tables: TABLES }))).toEqual(strip(generateWorld({ seed, tables: PLAIN })));
        }
    });
});

describe('⭐ a guaranteed camp on its cell\'s mat', () => {
    const kitWith = (work) => ({ ...PLACEHOLDER_WORLD_TABLES.kits[0], work, camps: ['token_goblin_camp'], bossCamps: ['token_chief_tent'] });
    const cellOf = (camps, specialty = 'mining') => ({
        id: '1,-1', q: 1, r: -1, ring: 1, tier: 1, wedge: 'ores', wild: false, seed: 42, kit: 'highland', specialty,
        origins: [{ id: 'token_copper_ore_vein', line: 'ores', role: 'main' }], extras: [], camps, arrival: [], extreme: null
    });
    const tablesWithKit = (work) => normaliseWorldTables({ ...PLACEHOLDER_WORLD_TABLES, kits: [kitWith(work), ...PLACEHOLDER_WORLD_TABLES.kits.slice(1)] });

    it('fills the kit\'s combat work first: no everyday camp beside it', () => {
        const mat = cellMat(cellOf(['token_wolf_den']), tablesWithKit({ mining: 3, combat: 1 }), { skillOf });
        expect(mat.camps).toEqual([{ typeId: 'token_wolf_den', count: 1 }]);
    });

    it('stands there even when the kit has no combat work', () => {
        const mat = cellMat(cellOf(['token_wolf_den', 'token_alpha_den']), tablesWithKit({ mining: 3 }), { skillOf });
        expect(mat.camps.map(c => c.typeId).sort()).toEqual(['token_alpha_den', 'token_wolf_den']);
    });

    it('beside a combat specialty\'s boss camp, and never cut by the cap', () => {
        const tables = tablesWithKit({ mining: 3, forestry: 2, combat: 1 });
        const mat = cellMat(cellOf(['token_wolf_den', 'token_alpha_den', 'token_slime_pit', 'token_tide_pool'], 'combat'), tables, { skillOf });
        const ids = mat.camps.map(c => c.typeId);
        expect(ids).toEqual(expect.arrayContaining(['token_chief_tent', 'token_wolf_den', 'token_alpha_den', 'token_slime_pit', 'token_tide_pool']));
        expect(busyHeroes(mat, tables)).toBeLessThanOrEqual(MAX_HEROES);
        // Camps alone past the cap: the guarantee wins, none of them gives way.
        const six = ['token_wolf_den', 'token_alpha_den', 'token_slime_pit', 'token_tide_pool', 'token_crab_rocks', 'token_wild_hive'];
        const crowded = cellMat(cellOf(six), tablesWithKit({ mining: 1 }), { skillOf });
        expect(crowded.camps.map(c => c.typeId).sort()).toEqual([...six].sort());
    });
});

describe('⭐ the world\'s checks and the ledger see them', () => {
    it('a ring missing a camp its tables guarantee is a coverage finding', () => {
        const world = generateWorld({ seed: 5, tables: TABLES });
        expect(worldFindings(world, TABLES).filter(f => f.check === WORLD_CHECK.COVERAGE)).toEqual([]);
        for (const cell of ringCells(world, 1)) cell.camps = cell.camps.filter(id => id !== 'token_wind_stones');
        const hits = worldFindings(world, TABLES).filter(f => f.check === WORLD_CHECK.COVERAGE);
        expect(hits).toHaveLength(1);
        expect(hits[0]).toMatchObject({ ring: 1, origin: 'token_wind_stones' });
    });

    it('⭐ a boss camp only a combat specialty drew is covered in every world once a ring guarantees it', () => {
        const noBoss = { ...WORLD_FIXTURE_RAW, kits: [{ ...WORLD_FIXTURE_RAW.kits[0], bossCamps: [] }], arrival: { ...WORLD_FIXTURE_RAW.arrival, 3: { count: [3, 3], enemies: [{ id: 'token_goblin' }] } } };
        const covered = (raw, seed) => !worldPlan(contentOf(worldWorkspace()), { seed, baseTables: normaliseWorldTables(raw) })
            .findings.some(f => f.check === WORLD_F.COVERAGE && [tokenKey('token_chief_tent'), tokenKey('token_goblin_chief')].includes(f.subject));
        const seeds = [1, 2, 3, 4, 5, 6];
        expect(seeds.some(s => !covered(noBoss, s))).toBe(true);
        for (const s of seeds) expect(covered({ ...noBoss, camps: { 1: ['token_chief_tent'] } }, s), `seed ${s}`).toBe(true);
    });

    it('the placeholder tables generate as before: no ring guarantees a camp', () => {
        for (const seed of SEEDS.slice(0, 10)) {
            for (const cell of generateWorld({ seed, tables: PLAIN }).cells) expect(cell.camps).toEqual([]);
        }
        for (let n = 1; n <= STRICT_RINGS; n++) expect(PLAIN.camps[n]).toEqual([]);
    });
});
