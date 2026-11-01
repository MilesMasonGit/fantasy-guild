import { describe, it, expect } from 'vitest';
import { generateWorld, ORIGIN_ROLE, EXTREME } from '../systems/world/generate.js';
import { cellMat, busyHeroes, shares, COMBAT, LAYOUT_GROUND, WILD_LAYOUT, KIT_BIOME, MAX_HEROES } from '../systems/world/cellMat.js';
import { recipesOfCell, recipesOfMat, cellRecipeId } from '../systems/world/cellRegion.js';
import { budget } from '../systems/atlas/Budget.js';
import { normaliseWorldTables, STRICT_RINGS, MAX_ARRIVAL, heroTokensOf } from '../config/worldTablesShape.js';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { materialsFromTokens, hallOriginsOf } from '../systems/world/materials.js';
import * as StarterCamp from '../systems/atlas/StarterCamp.js';

/**
 * ⭐ What a settled place's mat holds: its kit's work for four to six heroes, its
 * specialty's better things, every origin the map shows, its hidden extras, and a wild cell's
 * oddness; written as one base recipe that Budget writes exactly.
 */

const TABLES = normaliseWorldTables(PLACEHOLDER_WORLD_TABLES);
const skillOf = (id) => getTokenType(id)?.config?.skill || null;
const materialsOf = materialsFromTokens(getTokenType);
const hallOrigins = hallOriginsOf(StarterCamp.starterCamp()?.tokens, materialsOf);
const LOOKUPS = { skillOf, hallOrigins };
const worldOf = (seed) => generateWorld({ seed, tables: TABLES, materialsOf, hallOrigins });
const SEEDS = Array.from({ length: 40 }, (_, i) => 1000 + i * 7);
const strictCells = (world) => world.cells.filter(c => c.ring >= 1 && c.ring <= STRICT_RINGS);

describe('⭐ a cell\'s mat (the placeholder tables)', () => {
    // A cell with no origin at all (the placeholder's empty Herbs and Arcane tables) is a content
    // hole the world's problems already list; every other cell is held to the band.
    it('⭐ keeps four to six heroes busy on every strict cell with an origin, over many worlds', () => {
        let lowest = Infinity;
        let highest = 0;
        for (const seed of SEEDS) {
            for (const cell of strictCells(worldOf(seed)).filter(c => c.origins.length)) {
                const busy = busyHeroes(cellMat(cell, TABLES, LOOKUPS), TABLES);
                lowest = Math.min(lowest, busy);
                highest = Math.max(highest, busy);
                expect(busy, `${seed} ${cell.id}`).toBeGreaterThanOrEqual(4);
                expect(busy, `${seed} ${cell.id}`).toBeLessThanOrEqual(MAX_HEROES);
            }
        }
        expect(highest).toBeGreaterThan(lowest);
    });

    it('covers most skills: at least three gathering skills and a camp on every kit with camps', () => {
        for (const seed of SEEDS.slice(0, 10)) {
            for (const cell of strictCells(worldOf(seed))) {
                const mat = cellMat(cell, TABLES, LOOKUPS);
                const skills = new Set(mat.nodes.map(n => n.skill).filter(Boolean));
                expect(skills.size, `${seed} ${cell.id} ${[...skills]}`).toBeGreaterThanOrEqual(3);
                expect(mat.camps.reduce((n, c) => n + c.count, 0), `${seed} ${cell.id}`).toBeGreaterThanOrEqual(1);
            }
        }
    });

    it('every origin the map shows stands on the mat', () => {
        for (const seed of SEEDS.slice(0, 10)) {
            for (const cell of strictCells(worldOf(seed))) {
                const written = new Set(cellMat(cell, TABLES, LOOKUPS).nodes.map(n => n.typeId));
                for (const o of cell.origins) expect(written.has(o.id), `${seed} ${cell.id} ${o.id}`).toBe(true);
            }
        }
    });

    it('a specialty means better things, not more: its skill is the cell\'s own origins, never the everyday ones', () => {
        let checked = 0;
        for (const seed of SEEDS) {
            for (const cell of strictCells(worldOf(seed))) {
                if (!cell.specialty || cell.specialty === COMBAT) continue;
                const mat = cellMat(cell, TABLES, LOOKUPS);
                const own = new Set(cell.origins.map(o => o.id));
                for (const n of mat.nodes.filter(x => x.skill === cell.specialty)) {
                    expect(own.has(n.typeId) || n.typeId === mat.rare, `${seed} ${cell.id} ${n.typeId}`).toBe(true);
                }
                // Not more: the specialty's skill gets the kit's work or one hero's, whichever is more.
                const kitHeroes = TABLES.kits.find(k => k.id === cell.kit).work[cell.specialty] || 0;
                expect(mat.heroes[cell.specialty]).toBe(Math.max(kitHeroes, TABLES.specialtyHeroes));
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(100);
    });

    it('a combat specialty turns one of its kit\'s camps into the kit\'s boss camp', () => {
        let seen = 0;
        for (const seed of SEEDS) {
            for (const cell of strictCells(worldOf(seed))) {
                if (cell.specialty !== COMBAT) continue;
                const kit = TABLES.kits.find(k => k.id === cell.kit);
                const camps = cellMat(cell, TABLES, LOOKUPS).camps.map(c => c.typeId);
                expect(camps.some(id => kit.bossCamps.includes(id)), `${seed} ${cell.id}`).toBe(true);
                seen++;
            }
        }
        expect(seen).toBeGreaterThan(20);
    });

    it('stands on its kit\'s ground with its kit\'s Stone; the hidden extras ride along', () => {
        const cell = strictCells(worldOf(1000)).find(c => c.extras.length);
        const mat = cellMat(cell, TABLES, LOOKUPS);
        const kit = TABLES.kits.find(k => k.id === cell.kit);
        expect(mat.biome).toBe(kit.biome);
        expect(mat.stone).toEqual({ outcrops: kit.stone, ridge: false });
        expect(mat.modifiers).toEqual([...new Set(cell.extras.filter(e => e.kind === 'modifier').map(e => e.id))]);
        expect(mat.treasures.reduce((n, t) => n + t.count, 0)).toBe(cell.extras.filter(e => e.kind === 'treasure').length);
    });

    it('carries the cell\'s arrival: 3 to 6 enemies, more further out', () => {
        const world = worldOf(1003);
        const count = (c) => c.arrival.reduce((n, r) => n + r.count, 0);
        for (const cell of world.cells.filter(c => c.ring >= 1)) {
            expect(count(cell)).toBeGreaterThanOrEqual(3);
            expect(count(cell)).toBeLessThanOrEqual(MAX_ARRIVAL);
            expect(cellMat(cell, TABLES, LOOKUPS).arrival).toEqual(cell.arrival);
        }
        const mean = (n) => {
            const ring = world.cells.filter(c => c.ring === n);
            return ring.reduce((s, c) => s + count(c), 0) / ring.length;
        };
        expect(mean(2)).toBeGreaterThan(mean(1));
        expect(mean(3)).toBeGreaterThan(mean(2));
        expect(world.cells.find(c => c.ring === 0).arrival).toEqual([]);
    });

    it('the same cell always writes the same mat', () => {
        const a = worldOf(1010).cells[9];
        const b = worldOf(1010).cells[9];
        expect(cellMat(a, TABLES, LOOKUPS)).toEqual(cellMat(b, TABLES, LOOKUPS));
    });
});

describe('a wild cell\'s oddness', () => {
    const wildCell = (extreme) => ({ ...worldOf(1000).cells.find(c => c.ring === 4), extreme });

    it('one origin almost everywhere: the focus takes its share of the nodes', () => {
        const base = wildCell(null);
        const focus = base.origins.find(o => o.role === ORIGIN_ROLE.MAIN).id;
        const plain = cellMat(base, TABLES, LOOKUPS);
        const odd = cellMat(wildCell({ kind: EXTREME.COMPOSITION, focus }), TABLES, LOOKUPS);
        const total = (m) => m.nodes.reduce((n, x) => n + x.count, 0);
        expect(total(odd)).toBe(total(plain));
        const share = odd.nodes.find(n => n.typeId === focus).count / total(odd);
        expect(share).toBeCloseTo(TABLES.wild.compositionShare, 1);
    });

    it('an odd layout changes its ground: islands and mostly water bring the sea, a chasm a ridge, cramped more Stone and nodes', () => {
        const of = (layout) => cellMat(wildCell({ kind: EXTREME.LAYOUT, layout }), TABLES, LOOKUPS);
        expect(of(WILD_LAYOUT.ISLANDS)).toMatchObject({ water: LAYOUT_GROUND.islands.water, inland: 'lake' });
        expect(of(WILD_LAYOUT.MOSTLY_WATER).water).toBe(LAYOUT_GROUND.mostly_water.water);
        expect(of(WILD_LAYOUT.CHASM).stone.ridge).toBe(true);
        const plain = cellMat(wildCell(null), TABLES, LOOKUPS);
        const cramped = of(WILD_LAYOUT.CRAMPED);
        expect(cramped.stone.outcrops).toBe(plain.stone.outcrops + LAYOUT_GROUND.cramped.stone);
        const total = (m) => m.nodes.reduce((n, x) => n + x.count, 0);
        expect(total(cramped)).toBe(Math.round(total(plain) * LAYOUT_GROUND.cramped.nodes));
    });
});

describe('the recipes a mat is written from', () => {
    it('one base recipe Budget writes exactly, then one per modifier it knows', () => {
        const cell = strictCells(worldOf(1000)).find(c => c.extras.some(e => e.kind === 'modifier'));
        const modifier = { id: 'mod_test', kind: 'modifier', effects: [] };
        const { mat, recipes } = recipesOfCell(cell, { tables: TABLES, ...LOOKUPS, name: 'Test Place', modifierRecipe: () => modifier });
        expect(recipes[0]).toMatchObject({ id: cellRecipeId(cell), kind: 'base', name: 'Test Place', biome: mat.biome });
        expect(recipes.slice(1)).toEqual(mat.modifiers.map(() => modifier));
        const summary = budget([recipes[0]], { cap: 128 });
        for (const n of mat.nodes) {
            expect(summary.entries.find(e => e.typeId === n.typeId && e.role === 'node')?.count, n.typeId).toBe(n.count);
        }
        for (const c of mat.camps) expect(summary.entries.find(e => e.typeId === c.typeId && e.role === 'camp')?.count).toBe(c.count);
        expect(summary.ground.stone).toEqual(mat.stone);
    });

    it('a mat with no Stone and no odd water names neither', () => {
        const mat = { biome: 'meadow', nodes: [{ typeId: 'a', count: 2 }], camps: [], treasures: [], modifiers: [], stone: { outcrops: 0, ridge: false }, water: null, inland: null };
        const [base] = recipesOfMat(mat, { id: 'x' });
        expect(base).toEqual({ id: 'x', kind: 'base', name: '', biome: 'meadow', points: 2, nodes: [{ typeId: 'a', weight: 2 }] });
        expect(budget([base], { cap: 128 }).ground).not.toHaveProperty('stone');
    });

    it('a kit with no row of its own stands on the placeholder kit\'s ground, else meadow', () => {
        const bare = normaliseWorldTables({ ...PLACEHOLDER_WORLD_TABLES, kits: [{ id: 'highland' }] });
        expect(cellMat({ kit: 'highland', origins: [] }, bare, LOOKUPS).biome).toBe(KIT_BIOME.highland);
        expect(cellMat({ kit: 'nowhere', origins: [] }, bare, LOOKUPS).biome).toBe('meadow');
    });

    it('shares split a whole number by weight, largest remainder first', () => {
        expect(shares({ a: 1, b: 1, c: 1 }, 4)).toEqual({ a: 2, b: 1, c: 1 });
        expect(shares({ a: 3, b: 1 }, 8)).toEqual({ a: 6, b: 2 });
        expect(shares({}, 3)).toEqual({});
        expect(heroTokensOf(TABLES, 'nothing')).toBe(5);
    });
});
