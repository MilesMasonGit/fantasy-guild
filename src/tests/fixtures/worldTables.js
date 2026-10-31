// World tables for the tests: every line full in every strict ring, made-up ids, one material each

import { normaliseWorldTables } from '../../config/worldTablesShape.js';

const LINES = ['ores', 'trees', 'crops', 'herbs', 'waters', 'arcane'];
const SKILL = { ores: 'mining', trees: 'forestry', crops: 'farming', herbs: 'alchemy', waters: 'fishing', arcane: 'magic' };
const KITS = { ores: { highland: 3, riverside: 1 }, trees: { woodland: 3 }, crops: { plains: 2, woodland: 1 }, herbs: { wetland: 1 }, waters: { riverside: 2, wetland: 1 }, arcane: {} };

/** `f_<line>_<ring><letter>`: two to four per line and ring, later rings holding more. */
function originsOf(line) {
    const out = {};
    for (let ring = 1; ring <= 3; ring++) {
        const count = ring + 1;
        out[ring] = Array.from({ length: count }, (_, i) => ({ id: `f_${line}_${ring}${'abcd'[i]}`, weight: count - i }));
    }
    return out;
}

export const FIXTURE_WORLD_RAW = Object.freeze({
    version: 1,
    lines: LINES.map(id => ({ id, name: id[0].toUpperCase() + id.slice(1), skill: SKILL[id], kits: KITS[id], origins: originsOf(id) })),
    neighbours: [{ a: 'waters', b: 'herbs' }, { a: 'waters', b: 'crops' }],
    neighbourStrength: 8,
    mainPerCell: 1,
    blendsPerNeighbour: 1,
    keys: { 1: ['f_ores_1a', 'f_trees_1a'], 2: ['f_ores_2a', 'f_trees_2a'], 3: ['f_ores_3a', 'f_waters_3b'] },
    kits: ['highland', 'woodland', 'plains', 'wetland', 'riverside'].map(id => ({ id, name: id })),
    specialties: ['mining', 'forestry', 'farming', 'fishing', 'alchemy', 'combat'],
    pityWindow: 4,
    extras: [
        ...LINES.map(line => ({ id: `mod_rich_${line}`, kind: 'modifier', value: 10, lines: [line] })),
        { id: 'mod_camp', kind: 'modifier', value: 8 },
        { id: 'mod_den', kind: 'modifier', value: 8, rings: [2, 3] },
        { id: 'chest_small', kind: 'treasure', value: 6, rings: [1, 2], max: 2 },
        { id: 'chest_big', kind: 'treasure', value: 12, rings: [2, 3], max: 2 }
    ],
    ringValue: { 1: 16, 2: 24, 3: 32 },
    valueTolerance: 0.1,
    prices: {
        1: { items: [{ qty: 20 }, { qty: 10 }], skills: [{ skill: 'line', level: 5 }] },
        2: { items: [{ qty: 40 }, { qty: 20 }, { qty: 20, from: 'hall' }], skills: [{ skill: 'line', level: 15 }] },
        3: { items: [{ qty: 80 }, { qty: 40 }, { qty: 40, from: 'hall' }, { qty: 5, item: 'i_rope' }], skills: [{ skill: 'line', level: 30 }, { skill: 'specialty', level: 20 }] }
    },
    wild: {
        rings: 3, priceGrowth: 1.5, levelStep: 10, valueGrowth: 1.5, extremeShare: 0.5,
        layouts: [{ id: 'islands' }, { id: 'chasm' }, { id: 'mostly_water' }, { id: 'cramped' }]
    }
});

export const FIXTURE_WORLD_TABLES = normaliseWorldTables(FIXTURE_WORLD_RAW);

/** Each fixture origin yields its own material; the Hall's two theirs. */
export function fixtureMaterialsOf(originId) {
    if (originId.startsWith('f_')) return [`i_${originId.slice(2)}`];
    return { h_wood: ['i_wood'], h_stone: ['i_stone', 'i_flint'] }[originId] || [];
}

export const FIXTURE_HALL_ORIGINS = Object.freeze(['h_wood', 'h_stone']);

export const FIXTURE_LOOKUPS = Object.freeze({ materialsOf: fixtureMaterialsOf, hallOrigins: FIXTURE_HALL_ORIGINS });
