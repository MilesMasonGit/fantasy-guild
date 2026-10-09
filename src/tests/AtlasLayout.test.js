import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as Restrictions from '../systems/board/Restrictions.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { budget, ROLE } from '../systems/atlas/Budget.js';
import {
    layout, hallSpot, campBand, HALL_CLEARING, CAMP_BAND, HALL_TYPE_ID, COMFORT_GAP
} from '../systems/atlas/Layout.js';
import { mulberry32, nextSeed, seedFromText } from '../systems/atlas/seededRandom.js';
import { layoutOptions, shippedMat, shippedCrowding, cannotCheck } from '../systems/atlas/layoutInputs.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { SRC, codeOf } from './fixtures/sourceScan.js';
import { FOREST, MOUNTAIN, COAST, OVERGROWN, GOBLIN_CAMP } from './fixtures/atlasMaps.js';
import { terrainAt } from '../systems/atlas/TerrainMap.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * The generation engine's second half: a node budget and a seed → where each Token stands.
 * Most tests give the layout its geometry by hand (the shipped 11-step mat, 80 % hitbox, 40 %
 * overlap) so they read no content and no Mat Tuner; one block checks the result against the
 * game's own placement judge.
 */

const MAT = Object.freeze({ w: 1760, h: 1126 });
const CROWDING = Object.freeze({ hitboxPct: 80, overlapPct: 40 });
const ART = { big: 144, small: 32 };
const artRadius = (typeId) => ART[typeId] ?? 64;
const options = (seed, extra = {}) => ({ seed, mat: MAT, crowding: CROWDING, artRadius, ...extra });

const base = (id, points, nodes) => ({ id, kind: 'base', biome: id, points, nodes });
const mod = (id, ...effects) => ({ id, kind: 'modifier', effects });

/** A Base Map so big the cap trims it: the fullest Region the cap allows. */
const crowded = (species) => base('crowded', 1000, species.map(typeId => ({ typeId, weight: 1 })));
const fullBudget = (cap, species = ['oak', 'fir', 'copper', 'coal'], extra = []) =>
    budget([crowded(species), ...extra], { cap });

const SEEDS = Array.from({ length: 12 }, (_, i) => seedFromText(`seed-${i}`));

const hit = (typeId) => Math.round(artRadius(typeId) * CROWDING.hitboxPct / 100);
const minGap = (a, b) => (hit(a) + hit(b)) * (1 - CROWDING.overlapPct / 100);

/** Every rule a generated spot must keep, restated here so the test does not trust the module. */
function problemsOf(result, mat = MAT) {
    const problems = [];
    const hall = result.hall;
    for (const n of result.nodes) {
        const r = artRadius(n.typeId);
        if (!Number.isInteger(n.x) || !Number.isInteger(n.y)) problems.push(`${n.typeId} off the whole-unit grid`);
        if (n.x < r || n.y < r || n.x > mat.w - r || n.y > mat.h - r) problems.push(`${n.typeId} off the mat`);
        const dh = Math.sqrt((n.x - hall.x) ** 2 + (n.y - hall.y) ** 2);
        if (dh < HALL_CLEARING + r) problems.push(`${n.typeId} inside the Hall's ring (${dh.toFixed(0)} u)`);
    }
    for (let i = 0; i < result.nodes.length; i++) {
        for (let j = i + 1; j < result.nodes.length; j++) {
            const a = result.nodes[i];
            const b = result.nodes[j];
            const d2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
            if (d2 < minGap(a.typeId, b.typeId) ** 2 - 1e-6) problems.push(`${a.typeId} and ${b.typeId} crowd (${Math.sqrt(d2).toFixed(1)} u)`);
        }
    }
    return problems;
}

/** `role|typeId` → count, as a layout placed them. */
function placedCounts(result) {
    const out = {};
    for (const n of result.nodes) out[`${n.role}|${n.typeId}`] = (out[`${n.role}|${n.typeId}`] || 0) + 1;
    return out;
}
function budgetCounts(summary) {
    return Object.fromEntries(summary.entries.map(e => [`${e.role}|${e.typeId}`, e.count]));
}

/** Of all nodes, the share whose nearest node is of its own species. */
function sameSpeciesNeighbourShare(result) {
    const nodes = result.nodes.filter(n => n.role === ROLE.NODE);
    let same = 0;
    for (const a of nodes) {
        let best = null;
        let bestD = Infinity;
        for (const b of nodes) {
            if (a === b) continue;
            const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
            if (d < bestD) { bestD = d; best = b; }
        }
        if (best?.typeId === a.typeId) same++;
    }
    return same / nodes.length;
}

describe('the seeded random source', () => {
    it('mulberry32 repeats exactly from the same seed', () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        const drawsA = Array.from({ length: 5 }, a);
        expect(Array.from({ length: 5 }, b)).toEqual(drawsA);
        expect(drawsA.every(v => v >= 0 && v < 1)).toBe(true);
        expect(Array.from({ length: 5 }, mulberry32(43))).not.toEqual(drawsA);
    });

    it('a reroll seed follows from the last one, and text gives a stable seed', () => {
        expect(nextSeed(42)).toBe(nextSeed(42));
        expect(nextSeed(42)).not.toBe(42);
        expect(Number.isInteger(nextSeed(42)) && nextSeed(42) >= 0 && nextSeed(42) < 2 ** 32).toBe(true);
        expect(seedFromText('region-1')).toBe(seedFromText('region-1'));
        expect(seedFromText('region-1')).not.toBe(seedFromText('region-2'));
    });
});

describe('the layout', () => {
    describe('is fixed by its ingredients and seed', () => {
        it('the same budget and seed give the same layout', () => {
            const summary = budget([FOREST, OVERGROWN, GOBLIN_CAMP], { cap: 128 });
            expect(layout(summary, options(7))).toEqual(layout(summary, options(7)));
        });

        it('a new seed moves only coordinates: the same Tokens, in the same order', () => {
            const summary = budget([FOREST, MOUNTAIN, GOBLIN_CAMP], { cap: 128 });
            const first = layout(summary, options(SEEDS[0]));
            const rerolled = layout(summary, options(nextSeed(SEEDS[0])));
            const shape = (r) => r.nodes.map(n => `${n.role}|${n.typeId}`);
            expect(shape(rerolled)).toEqual(shape(first));
            const moved = first.nodes.filter((n, i) => n.x !== rerolled.nodes[i].x || n.y !== rerolled.nodes[i].y);
            expect(moved.length).toBeGreaterThan(first.nodes.length * 0.9);
            expect(rerolled.hall).toEqual(first.hall);
        });

        it('ten rerolls never change the node summary', () => {
            const summary = budget([FOREST, MOUNTAIN, OVERGROWN, GOBLIN_CAMP], { cap: 128 });
            let seed = SEEDS[1];
            for (let i = 0; i < 10; i++) {
                const result = layout(summary, options(seed));
                expect(placedCounts(result)).toEqual(budgetCounts(summary));
                expect(result.unplaced).toEqual([]);
                seed = nextSeed(seed);
            }
        });

        it('reads the mat size it is given, never the Mat Tuner', () => {
            const summary = budget([FOREST, GOBLIN_CAMP], { cap: 128 });
            const before = layout(summary, options(3));
            setMatTuning('matSteps', 6);
            try {
                expect(layout(summary, options(3))).toEqual(before);
            } finally {
                resetMatTuning();
            }
            expect(() => layout(summary, { seed: 3, crowding: CROWDING, artRadius })).toThrow(/mat/);
        });

        it('lays out on any mat it is given, and keeps to it', () => {
            const summary = budget([FOREST, GOBLIN_CAMP], { cap: 128 });
            const small = { w: 1280, h: 819 };
            const result = layout(summary, options(5, { mat: small }));
            expect(result.unplaced).toEqual([]);
            expect(problemsOf(result, small)).toEqual([]);
            expect(result.hall).toEqual({ typeId: HALL_TYPE_ID, ...hallSpot(small) });
        });
    });

    describe('every Token stands on a legal spot', () => {
        it('inside the mat, clear of each other and of the Hall\'s ring, on whole units', () => {
            const summary = budget([FOREST, MOUNTAIN, OVERGROWN, GOBLIN_CAMP], { cap: 128 });
            for (const seed of SEEDS) {
                const result = layout(summary, options(seed));
                expect(result.unplaced).toEqual([]);
                expect(problemsOf(result)).toEqual([]);
            }
        });

        it('the Hall stands in the middle of the mat', () => {
            const result = layout(budget([FOREST], { cap: 128 }), options(1));
            expect(result.hall).toEqual({ typeId: HALL_TYPE_ID, x: 880, y: 563 });
        });

        it('mixed body sizes keep their own gaps', () => {
            const summary = budget([base('mixed', 1000, [
                { typeId: 'big', weight: 1 }, { typeId: 'small', weight: 2 }, { typeId: 'oak', weight: 4 }
            ])], { cap: 128 });
            for (const seed of SEEDS.slice(0, 6)) {
                const result = layout(summary, options(seed));
                expect(result.unplaced).toEqual([]);
                expect(problemsOf(result)).toEqual([]);
            }
        });

        it('big bodies still find room on a mat broken up by many small groves', () => {
            // A hundred and ten one-node species: as many lone Tokens spread evenly over the mat.
            // The six 2×2 species sort last in the budget, so they would be placed into whatever
            // holes were left.
            const many = Array.from({ length: 110 }, (_, i) => ({ typeId: `sp${String(i).padStart(3, '0')}`, weight: 1 }));
            const bigs = Array.from({ length: 6 }, (_, i) => ({ typeId: `zz_big${i}`, weight: 1 }));
            for (const b of bigs) ART[b.typeId] = 144;
            const summary = budget([base('patchwork', 1000, [...many, ...bigs])], { cap: 256 });
            expect(summary.entries.slice(-6).map(e => e.typeId)).toEqual(bigs.map(b => b.typeId));
            expect(summary.entries.slice(-6).every(e => e.count === 1)).toBe(true);
            for (const seed of SEEDS) {
                const result = layout(summary, options(seed));
                expect(result.unplaced).toEqual([]);
                expect(problemsOf(result)).toEqual([]);
            }
        });

        it('with no room left at the comfortable spacing, nodes pack down to the game\'s gap, never closer', () => {
            // A narrow mat with a full budget: the comfortable spacing would need about twice the room.
            const narrow = { w: 760, h: 1126 };
            const summary = budget([base('b', 1000, [{ typeId: 'oak', weight: 1 }])], { cap: 128 });
            for (const seed of SEEDS.slice(0, 6)) {
                const result = layout(summary, options(seed, { mat: narrow }));
                expect(result.unplaced).toEqual([]);
                expect(problemsOf(result, narrow)).toEqual([]);
                const closest = Math.min(...result.nodes.flatMap((a, i) => result.nodes.slice(i + 1)
                    .map(b => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2))));
                expect(closest).toBeLessThan(COMFORT_GAP);
            }
        });

        it('a spot the rules hook refuses is never used', () => {
            // Nothing may stand in the mat's left third.
            const allows = (typeId, point) => point.x > MAT.w / 3;
            const result = layout(budget([FOREST, GOBLIN_CAMP], { cap: 128 }), options(9, { allows }));
            expect(result.unplaced).toEqual([]);
            expect(result.nodes.every(n => n.x > MAT.w / 3)).toBe(true);
        });

        it('a Token with nowhere legal to go is reported, not forced', () => {
            const tiny = { w: 640, h: 410 };
            const result = layout(budget([base('b', 40, [{ typeId: 'oak', weight: 1 }])], { cap: 128 }), options(1, { mat: tiny }));
            expect(result.unplaced.length).toBeGreaterThan(0);
            expect(result.nodes.length + result.unplaced.length).toBe(40);
            expect(problemsOf(result, tiny)).toEqual([]);
        });
    });

    describe('fits the cap', () => {
        for (const cap of [128, 256]) {
            it(`a full Region at a cap of ${cap} places every Token legally`, () => {
                const summary = fullBudget(cap, ['oak', 'fir', 'copper', 'coal'], [
                    mod('camps', { kind: 'threat', typeId: 'goblin_camp', count: 2 }),
                    mod('ruins', { kind: 'treasure', typeId: 'ruins', count: 2 })
                ]);
                expect(summary.total).toBe(cap / 2);
                for (const seed of SEEDS) {
                    const result = layout(summary, options(seed));
                    expect(result.unplaced).toEqual([]);
                    expect(result.nodes.length).toBe(cap / 2);
                    expect(problemsOf(result)).toEqual([]);
                }
            });
        }
    });

    describe('shape', () => {
        it('same-species nodes stand together in groves', () => {
            const summary = fullBudget(128, ['oak', 'fir', 'copper', 'coal']);
            // Four equal species scattered at random would give about 1 in 4.
            const shares = SEEDS.map(seed => sameSpeciesNeighbourShare(layout(summary, options(seed))));
            const mean = shares.reduce((a, b) => a + b, 0) / shares.length;
            expect(mean).toBeGreaterThan(0.75);
            expect(Math.min(...shares)).toBeGreaterThan(0.6);
        });

        it('enemy camps stand away from the centre', () => {
            const summary = budget([FOREST, mod('camps', { kind: 'threat', typeId: 'goblin_camp', count: 10 })], { cap: 128 });
            for (const seed of SEEDS) {
                const result = layout(summary, options(seed));
                const camps = result.nodes.filter(n => n.role === ROLE.CAMP);
                expect(camps).toHaveLength(10);
                for (const camp of camps) {
                    expect(campBand(camp, artRadius(camp.typeId), MAT)).toBeGreaterThanOrEqual(CAMP_BAND);
                }
            }
        });

        it('treasures are placed once each', () => {
            const summary = budget([
                FOREST,
                mod('ruins', { kind: 'treasure', typeId: 'ruins', count: 1 }),
                mod('cache', { kind: 'treasure', typeId: 'cache', count: 2 })
            ], { cap: 128 });
            for (const seed of SEEDS.slice(0, 6)) {
                const treasures = layout(summary, options(seed)).nodes.filter(n => n.role === ROLE.TREASURE);
                expect(treasures.map(t => t.typeId).sort()).toEqual(['cache', 'cache', 'ruins']);
                const spots = new Set(treasures.map(t => `${t.x},${t.y}`));
                expect(spots.size).toBe(3);
            }
        });
    });
});

describe('the game\'s side of the layout (layoutInputs)', () => {
    const NO_THIRD_COAST = {
        id: 'stm_atlas_coast', keyword: KEYWORD.CANNOT,
        payload: { kind: 'adjacency_limit', max: 2 },
        to: { mode: 'tag', value: 'Coast' }, when: null, upkeep: null
    };
    const resource = (id, extra = {}) => ({
        id, name: id, tokenType: 'resource', size: 1, uses: 5, requiresHero: true,
        config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 3000, inputs: [], outputs: [] }, ...extra
    });

    beforeEach(() => {
        GameState.initNew();
        clearMat();
        resetMatTuning();
        registerTokenTypes({
            atlas_t_oak: resource('atlas_t_oak'),
            atlas_t_fir: resource('atlas_t_fir'),
            atlas_t_cedar: resource('atlas_t_cedar', { size: 2 }),
            atlas_t_sapling: resource('atlas_t_sapling', { artSize: 'small' }),
            atlas_t_coast: resource('atlas_t_coast', { tags: ['Coast'], statements: [NO_THIRD_COAST] }),
            atlas_t_camp: { id: 'atlas_t_camp', name: 'Camp', tokenType: 'spawner', size: 1, uses: null, requiresHero: false, config: null },
            atlas_t_ruins: resource('atlas_t_ruins')
        });
    });
    afterEach(() => { clearMat(); resetMatTuning(); });

    it('lays out on the shipped mat, whatever this device\'s Mat Tuner says', () => {
        expect(shippedMat()).toEqual({ w: 1760, h: 1126 });
        expect(shippedCrowding()).toEqual({ hitboxPct: 80, overlapPct: 40 });
        setMatTuning('matSteps', 7);
        setMatTuning('hitboxPct', 60);
        expect(shippedMat()).toEqual({ w: 1760, h: 1126 });
        expect(shippedCrowding()).toEqual({ hitboxPct: 80, overlapPct: 40 });
    });

    it('asks about Cannot rules only when a Token in the budget has one', () => {
        expect(cannotCheck(['atlas_t_oak', 'atlas_t_fir'])).toBeNull();
        expect(typeof cannotCheck(['atlas_t_oak', 'atlas_t_coast'])).toBe('function');
    });

    for (const cap of [128, 256]) {
        it(`every generated Token passes the game's own placement check (cap ${cap})`, () => {
            const summary = budget([
                base('mixed', 1000, [
                    { typeId: 'atlas_t_oak', weight: 6 }, { typeId: 'atlas_t_fir', weight: 4 },
                    { typeId: 'atlas_t_cedar', weight: 1 }, { typeId: 'atlas_t_sapling', weight: 2 },
                    { typeId: 'atlas_t_coast', weight: 3 }
                ]),
                mod('camp', { kind: 'threat', typeId: 'atlas_t_camp', count: 2 }),
                mod('ruins', { kind: 'treasure', typeId: 'atlas_t_ruins', count: 1 })
            ], { cap });
            for (const seed of SEEDS.slice(0, 4)) {
                clearMat();
                const result = layout(summary, layoutOptions(summary, seed));
                expect(result.unplaced).toEqual([]);

                placeAt(result.hall.typeId, result.hall.x, result.hall.y);
                const placed = result.nodes.map(n => ({ node: n, instance: placeAt(n.typeId, n.x, n.y) }));
                for (const { node, instance } of placed) {
                    expect(MatPlacement.isLegal(node.typeId, node, { excludeId: instance.id }), `${node.typeId} at ${node.x},${node.y}`).toBe(true);
                }
                expect(Restrictions.violations()).toEqual([]);
                expect(BoardState.tokens()).toHaveLength(result.nodes.length + 1);
            }
        });
    }
});

describe('purity guards', () => {
    const FILES = ['Budget.js', 'Layout.js', 'TerrainMap.js', 'seededRandom.js', 'layoutInputs.js'];
    const code = (file) => codeOf(fs.readFileSync(`${SRC}/systems/atlas/${file}`, 'utf8'));

    it('no module of the generation engine draws from Math.random', () => {
        for (const file of FILES) expect(code(file), file).not.toMatch(/Math\s*\.\s*random/);
    });

    it('Budget and Layout use no maths whose last bit may differ between browser engines', () => {
        for (const file of ['Budget.js', 'Layout.js', 'TerrainMap.js', 'seededRandom.js']) {
            expect(code(file), file).not.toMatch(/\*\*|Math\s*\.\s*(hypot|pow|sin|cos|tan|atan2?|exp|log\w*|cbrt)\b/);
        }
    });

    it('Budget, Layout and TerrainMap read no clock, no board and no Mat Tuner', () => {
        const imports = (file) => [...code(file).matchAll(/from\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
        expect(imports('Layout.js')).toEqual(['./seededRandom.js', './TerrainMap.js']);
        expect(imports('Budget.js')).toEqual(['../../config/registries/tokenRegistry.js', './TerrainMap.js']);
        expect(imports('TerrainMap.js')).toEqual([]);
        for (const file of ['Budget.js', 'Layout.js', 'TerrainMap.js']) {
            expect(code(file), file).not.toMatch(/Date\s*\.\s*now|performance\s*\.\s*now|new Date/);
        }
    });
});

/**
 * The preview the director judges the shape by. Prints only when run with `--silent=false`
 * (passing tests are silent).
 */
describe('ASCII preview', () => {
    const GLYPH = {
        token_oak_tree: 'O', token_fir_tree: 'F', token_redberry_bush: 'R', token_blackberry_bush: 'B',
        token_copper_ore_vein: 'C', token_coal_vein: 'K', token_stone_outcrop: 'S', token_goblin_camp: 'G', token_coast: 'W'
    };

    /**
     * One character per 32 × 64 u of mat (characters are about twice as tall as wide): a Token's
     * centre in capitals, the rest of its art in lower case, the Hall's clearing blank.
     */
    function ascii(result, { cell = 32 } = {}) {
        const cols = Math.ceil(MAT.w / cell);
        const lines = Math.ceil(MAT.h / (cell * 2));
        const at = (n) => [Math.floor(n.x / cell), Math.floor(n.y / (cell * 2))];
        const out = [];
        for (let r = 0; r < lines; r++) {
            let line = '';
            for (let c = 0; c < cols; c++) {
                const x = (c + 0.5) * cell;
                const y = (r + 0.5) * cell * 2;
                let ch = (x - result.hall.x) ** 2 + (y - result.hall.y) ** 2 < HALL_CLEARING ** 2 ? ' ' : '.';
                let nearest = Infinity;
                for (const n of result.nodes) {
                    const d = (x - n.x) ** 2 + (y - n.y) ** 2;
                    // Most of the art circle: real art does not fill its circle to the rim.
                    if (d < 0.55 * artRadius(n.typeId) ** 2 && d < nearest) {
                        nearest = d;
                        ch = (GLYPH[n.typeId] ?? '?').toLowerCase();
                    }
                }
                for (const n of result.nodes) {
                    const [nc, nr] = at(n);
                    if (nc === c && nr === r) ch = GLYPH[n.typeId] ?? '?';
                }
                const [hc, hr] = at(result.hall);
                if (hc === c && hr === r) ch = 'H';
                line += ch;
            }
            out.push(line);
        }
        return out.join('\n');
    }

    /** The terrain map, one character per 32 u cell: , grass ^ rock : sand ~ water, Tokens' centres on top. */
    function groundPicture(result) {
        const GROUND = { grass: ',', rock: '^', sand: ':', water: '~' };
        const { cols, rows, cell } = result.terrain;
        const out = [];
        for (let r = 0; r < rows; r++) {
            let line = '';
            for (let c = 0; c < cols; c++) {
                let ch = GROUND[terrainAt(result.terrain, (c + 0.5) * cell, (r + 0.5) * cell)] ?? '?';
                for (const n of result.nodes) {
                    if (Math.floor(n.x / cell) === c && Math.floor(n.y / cell) === r) ch = GLYPH[n.typeId] ?? '?';
                }
                if (Math.floor(result.hall.x / cell) === c && Math.floor(result.hall.y / cell) === r) ch = 'H';
                line += ch;
            }
            out.push(line);
        }
        return out.join('\n');
    }

    it('prints a Forest + Overgrown and a Mountain + Goblin Camp layout, and a Coast\'s ground', () => {
        const legend = 'H Hall · O Oak · R Redberry · B Blackberry · C Copper · K Coal · S Stone · G Goblin Camp · W Coast '
            + '(capital = centre, lower case = the rest of its art, blank = the Hall\'s clearing)';
        const out = [legend];
        const cases = [
            ['Forest + Overgrown', [FOREST, OVERGROWN], false],
            ['Mountain + Goblin Camp', [MOUNTAIN, GOBLIN_CAMP], false],
            ['Coast + Forest + Goblin Camp', [COAST, FOREST, GOBLIN_CAMP], true]
        ];
        for (const [label, slots, withGround] of cases) {
            const summary = budget(slots, { cap: 128 });
            const seed = seedFromText(label);
            const result = layout(summary, options(seed));
            expect(result.unplaced).toEqual([]);
            const picture = ascii(result);
            expect(picture.split('\n')).toHaveLength(18);
            out.push(`\n${label} (seed ${seed}; ${summary.entries.map(e => `${e.count} ${e.typeId}`).join(', ')})\n${picture}`);
            if (withGround) out.push(`\n${label}, its ground (, grass ^ rock : sand ~ water; one character per 32 u cell)\n${groundPicture(result)}`);
        }
        console.log(out.join('\n'));
    });
});
