import { describe, it, expect } from 'vitest';
import {
    BIOMES, WATER_SHAPES, BIOME_TERRAIN_DEFAULTS, seedBiomeTable, normaliseBiomeTable, biomeRowOf, rollBiomeTerrain
} from '../config/biomeTerrain.js';
import { normaliseWorldTables, biomeTableProblems } from '../config/worldTablesShape.js';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';
import { budget, BIOME_GROUND, BIOME_WATER } from '../systems/atlas/Budget.js';
import { WATER_KIND } from '../systems/atlas/WaterShapes.js';
import { groundCounts } from '../systems/atlas/Layout.js';
import { generateWorld, EXTREME } from '../systems/world/generate.js';
import { cellMat, LAYOUT_GROUND } from '../systems/world/cellMat.js';
import { recipesOfCell } from '../systems/world/cellRegion.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { materialsFromTokens, hallOriginsOf } from '../systems/world/materials.js';
import * as StarterCamp from '../systems/atlas/StarterCamp.js';
import { workspaceWorldFrom, withBiomeRow, worldDiff } from '../../cms/src/engine/worldTables.js';
import { seedStoredWorkspace } from '../../cms/src/engine/workspaceSeeds.js';

/**
 * ⭐ Each biome sets its terrain ranges (the world tables' `biomes`): the table at today's values
 * makes exactly the places the kits' Stone and the built-in water made; a wider range moves only
 * the number it draws; the CMS seeds its table with today's values.
 */

const skillOf = (id) => getTokenType(id)?.config?.skill || null;
const materialsOf = materialsFromTokens(getTokenType);
const hallOrigins = hallOriginsOf(StarterCamp.starterCamp()?.tokens, materialsOf);
const LOOKUPS = { skillOf, hallOrigins };
const TABLES = normaliseWorldTables(PLACEHOLDER_WORLD_TABLES);
const placesOf = (tables, seeds) => seeds.flatMap(seed => generateWorld({ seed, tables, materialsOf, hallOrigins }).cells.filter(c => c.ring >= 1));

/** Each kit's Stone before the biome table, by its biome: what the table must ship with. */
const TODAY_STONE = Object.freeze({ mountain: 5, forest: 2, meadow: 1, bog: 1, coast: 2 });

/** A place's recipe as it was written before the biome table: the kit's Stone, the built-in water. */
function legacyRecipe(base, cell, tables) {
    const kit = tables.kits.find(k => k.id === cell.kit);
    const ground = cell.extreme?.kind === EXTREME.LAYOUT ? (LAYOUT_GROUND[cell.extreme.layout] || {}) : {};
    const out = { ...base };
    delete out.water;
    delete out.inland;
    delete out.stone;
    if (Number.isFinite(ground.water)) out.water = ground.water;
    if (ground.inland) out.inland = ground.inland;
    const outcrops = (TODAY_STONE[kit?.biome] || 0) + (ground.stone || 0);
    if (outcrops > 0 || ground.ridge) out.stone = { outcrops, ridge: !!ground.ridge };
    return out;
}

describe('⭐ the biome table at today\'s values', () => {
    it('the built-in rows are the generator\'s own: Budget\'s water lists and sea shares, the water shapes, the nine biomes', () => {
        expect([...BIOMES].sort()).toEqual(Object.keys(BIOME_GROUND).sort());
        expect([...WATER_SHAPES].sort()).toEqual(Object.values(WATER_KIND).sort());
        for (const biome of BIOMES) {
            expect(BIOME_TERRAIN_DEFAULTS[biome].water, biome).toEqual(BIOME_WATER[biome]);
            expect(BIOME_TERRAIN_DEFAULTS[biome].sea, biome).toEqual([BIOME_GROUND[biome].water, BIOME_GROUND[biome].water]);
        }
    });

    it('each kit\'s old Stone is its biome\'s least and most; biomes with no kit have none', () => {
        expect(TABLES.kits.every(k => !('stone' in k))).toBe(true);
        for (const biome of BIOMES) expect(TABLES.biomes[biome].stone, biome).toEqual([TODAY_STONE[biome] || 0, TODAY_STONE[biome] || 0]);
        expect(TABLES.biomesMissing).toEqual([]);
    });

    it('⭐ every place, strict and wild, writes exactly the budget it wrote before (same water, same Stone, same nodes)', () => {
        let checked = 0;
        const kits = new Set();
        for (const cell of placesOf(TABLES, [1, 7, 42, 1000, 31337])) {
            const { recipes } = recipesOfCell(cell, { tables: TABLES, ...LOOKUPS });
            const now = budget(recipes, { cap: 128 });
            const before = budget([legacyRecipe(recipes[0], cell, TABLES)], { cap: 128 });
            expect(now, `cell ${cell.id}`).toEqual(before);
            kits.add(cell.kit);
            checked++;
        }
        expect(checked).toBeGreaterThan(100);
        expect(kits.size).toBe(5);
    });

    it('so the layout draws the same ground from the same seed', () => {
        const mat = { w: 2400, h: 1600 };
        for (const cell of placesOf(TABLES, [3]).slice(0, 12)) {
            const { recipes } = recipesOfCell(cell, { tables: TABLES, ...LOOKUPS });
            const before = budget([legacyRecipe(recipes[0], cell, TABLES)], { cap: 128 });
            expect(groundCounts(budget(recipes, { cap: 128 }), { seed: cell.seed, mat }), `cell ${cell.id}`)
                .toEqual(groundCounts(before, { seed: cell.seed, mat }));
        }
    });
});

describe('a range wider than one value', () => {
    const wide = (rows) => normaliseWorldTables({ ...PLACEHOLDER_WORLD_TABLES, biomes: { ...seedBiomeTable(PLACEHOLDER_WORLD_TABLES.kits), ...rows } });

    it('moves only the drawn number: the Stone within its range, everything else as at today\'s values', () => {
        const wideStone = wide({ meadow: { water: [...BIOME_WATER.meadow], sea: [0, 0], stone: [1, 6] } });
        const seen = new Set();
        let checked = 0;
        for (const cell of placesOf(TABLES, [1, 7, 42, 1000]).filter(c => c.kit === 'plains' && !c.extreme)) {
            const today = cellMat(cell, TABLES, LOOKUPS);
            const rolled = cellMat(cell, wideStone, LOOKUPS);
            expect(rolled.stone.outcrops).toBeGreaterThanOrEqual(1);
            expect(rolled.stone.outcrops).toBeLessThanOrEqual(6);
            seen.add(rolled.stone.outcrops);
            expect({ ...rolled, stone: today.stone }).toEqual(today);
            expect(cellMat(cell, wideStone, LOOKUPS)).toEqual(rolled);
            checked++;
        }
        expect(checked).toBeGreaterThan(5);
        expect(seen.size).toBeGreaterThan(1);
    });

    it('a sea range draws a share between its ends; the Stone keeps its roll', () => {
        const wideSea = wide({ coast: { water: [], sea: [0.1, 0.4], stone: [2, 2] } });
        let checked = 0;
        for (const cell of placesOf(TABLES, [1, 7, 42]).filter(c => c.kit === 'riverside' && !c.extreme)) {
            const today = cellMat(cell, TABLES, LOOKUPS);
            const rolled = cellMat(cell, wideSea, LOOKUPS);
            expect(rolled.water).toBeGreaterThanOrEqual(0.1);
            expect(rolled.water).toBeLessThanOrEqual(0.4);
            expect({ ...rolled, water: today.water }).toEqual(today);
            checked++;
        }
        expect(checked).toBeGreaterThan(3);
    });

    it('a roll of one value takes exactly it; a range\'s ends both come up', () => {
        const draws = (values) => { let i = 0; return () => values[i++]; };
        expect(rollBiomeTerrain({ stone: [3, 3], sea: [0.3, 0.3] }, draws([0.99, 0.99]))).toEqual({ stone: 3, sea: 0.3 });
        expect(rollBiomeTerrain({ stone: [1, 6], sea: [0, 0.2] }, draws([0, 0]))).toEqual({ stone: 1, sea: 0 });
        expect(rollBiomeTerrain({ stone: [1, 6], sea: [0, 0.2] }, draws([0.9999, 0.5])).stone).toBe(6);
    });
});

describe('reading the table', () => {
    it('a malformed row falls back field by field; a reversed range is put the right way round', () => {
        const row = biomeRowOf({ water: ['pond', 'whirlpool', 'pond'], sea: [0.5, 0.2], stone: 'lots' }, BIOME_TERRAIN_DEFAULTS.mountain);
        expect(row).toEqual({ water: ['pond', 'pond'], sea: [0.2, 0.5], stone: [5, 5] });
        expect(biomeRowOf({ stone: 3 }).stone).toEqual([3, 3]);
    });

    it('a table that leaves a biome out: that biome takes its built-in row and the content check names it', () => {
        const { meadow: _gone, ...rest } = seedBiomeTable();
        const tables = normaliseWorldTables({ ...PLACEHOLDER_WORLD_TABLES, biomes: rest });
        expect(tables.biomes.meadow).toEqual(biomeRowOf(BIOME_TERRAIN_DEFAULTS.meadow));
        expect(biomeTableProblems(tables)).toEqual(['The biome meadow has no terrain row: it uses the built-in one']);
        expect(normaliseBiomeTable(undefined).missing).toEqual([]);
        expect(biomeTableProblems(TABLES)).toEqual([]);
    });

    it('a kit on a biome with no row is named', () => {
        const kits = [...PLACEHOLDER_WORLD_TABLES.kits, { id: 'ashland', name: 'Ashland', biome: 'ashfield', work: { mining: 1 } }];
        const tables = normaliseWorldTables({ ...PLACEHOLDER_WORLD_TABLES, kits });
        expect(biomeTableProblems(tables)).toEqual(['The Ashland kit stands on a biome "ashfield" with no terrain row: its places get no water and no Stone']);
    });
});

describe('the CMS seeds its table with today\'s values', () => {
    const OLD = { ...PLACEHOLDER_WORLD_TABLES, kits: PLACEHOLDER_WORLD_TABLES.kits.map(k => ({ ...k, stone: TODAY_STONE[k.biome] })) };

    it('a record with no table gets one from its kits\' Stone, and its kits drop the Stone', () => {
        const seeded = workspaceWorldFrom(OLD);
        expect(seeded.kits.some(k => 'stone' in k)).toBe(false);
        for (const biome of BIOMES) expect(seeded.biomes[biome].stone, biome).toEqual([TODAY_STONE[biome] || 0, TODAY_STONE[biome] || 0]);
        expect(normaliseWorldTables(seeded).biomes).toEqual(normaliseWorldTables(OLD).biomes);
        expect(workspaceWorldFrom(seeded)).toBe(seeded);
    });

    it('every load path seeds it: a stored workspace too, and once only', () => {
        const stored = seedStoredWorkspace({ items: {}, tokens: {}, effects: {}, recipePools: {}, world: OLD });
        expect(stored.world.biomes).toEqual(seedBiomeTable(OLD.kits));
        expect(seedStoredWorkspace(stored).world).toBe(stored.world);
    });

    it('an edited row lands in the record and shows on the review page', () => {
        const seeded = workspaceWorldFrom(OLD);
        const edited = withBiomeRow(seeded, 'meadow', { water: ['lake'], sea: [0, 0], stone: [1, 4] });
        expect(edited.biomes.meadow.stone).toEqual([1, 4]);
        expect(edited.biomes.forest).toBe(seeded.biomes.forest);
        expect(worldDiff(seeded, edited)).toEqual([{ kind: 'changed', text: 'biomes changed' }]);
        expect(withBiomeRow(null, 'meadow', {})).toBe(null);
    });
});
