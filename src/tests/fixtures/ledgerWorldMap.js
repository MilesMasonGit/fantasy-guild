// Fantasy Guild — test fixture: the ledger's small world (`ledgerWorld.js`) laid out as world tables
//
// Every line has an origin in every strict ring: the fixture's own veins, trees, hive and coast where
// it has them, a plain node (`token_<line>_<ring>`, yielding `item_<line>_<ring>`) elsewhere. One kit
// with a goblin camp and the Chief's Tent as its boss camp; iron the key of ring 2; every cell's
// extras exactly its ring's value; prices dearer ring by ring. Generated from, every world keeps
// every rule of checks F, so a test breaks one rule at a time.

import { ledgerWorkspace } from './ledgerWorld.js';
import { normaliseWorldTables } from '../../config/worldTablesShape.js';

export const LINE_SKILL = Object.freeze({ ores: 'mining', trees: 'forestry', crops: 'farming', herbs: 'alchemy', waters: 'fishing', arcane: 'magic' });

/** The fixture's own Tokens where it has them; the plain nodes fill the rest. */
const OWN = Object.freeze({
    ores: { 1: ['token_copper_vein', 'token_coal_vein'], 2: ['token_iron_vein'] },
    trees: { 1: ['token_oak_tree'] },
    crops: { 1: ['token_wild_hive'] },
    waters: { 1: ['token_coast'] }
});

const nodeId = (line, ring) => `token_${line}_${ring}`;
const itemId = (line, ring) => `item_${line}_${ring}`;

function originsOf(line) {
    const out = {};
    for (let ring = 1; ring <= 3; ring++) {
        const own = OWN[line]?.[ring] || [];
        out[ring] = [...own, nodeId(line, ring)].map((id, i) => ({ id, weight: i === 0 ? 2 : 1 }));
    }
    return out;
}

export const WORLD_FIXTURE_RAW = Object.freeze({
    version: 1,
    lines: Object.keys(LINE_SKILL).map(id => ({ id, name: id[0].toUpperCase() + id.slice(1), skill: LINE_SKILL[id], kits: { highland: 1 }, origins: originsOf(id) })),
    neighbours: [{ a: 'waters', b: 'herbs' }],
    keys: { 2: ['token_iron_vein'] },
    kits: [{ id: 'highland', name: 'Highland', biome: 'mountain', stone: 2, work: { mining: 1, forestry: 1, combat: 1 }, camps: ['token_goblin_camp'], bossCamps: ['token_chief_tent'] }],
    heroTokens: { combat: 1 },
    specialties: ['mining', 'forestry', 'farming', 'fishing', 'alchemy', 'combat'],
    pityWindow: 4,
    extras: [{ id: 'mod_deep_veins', kind: 'modifier', value: 10 }],
    ringValue: { 1: 10, 2: 10, 3: 10 },
    valueTolerance: 0.1,
    prices: {
        1: { items: [{ qty: 5 }], skills: [{ skill: 'line', level: 2 }] },
        2: { items: [{ qty: 10 }, { qty: 5, from: 'hall' }], skills: [{ skill: 'line', level: 10 }] },
        3: { items: [{ qty: 20 }, { qty: 10, from: 'hall' }], skills: [{ skill: 'line', level: 20 }] }
    },
    arrival: {
        1: { count: [3, 3], enemies: [{ id: 'token_goblin' }] },
        2: { count: [3, 3], enemies: [{ id: 'token_goblin' }] },
        3: { count: [3, 4], enemies: [{ id: 'token_goblin' }], bossChance: 0.5, bosses: [{ id: 'token_goblin_chief' }] }
    },
    wild: { rings: 1, layouts: [{ id: 'islands' }] }
});

export const WORLD_FIXTURE_TABLES = normaliseWorldTables(WORLD_FIXTURE_RAW);

/** The fixture world's content: the ledger fixture with a plain node and its material for every gap. */
export function worldWorkspace() {
    const ws = ledgerWorkspace();
    for (const [line, skill] of Object.entries(LINE_SKILL)) {
        for (let ring = 1; ring <= 3; ring++) {
            const id = nodeId(line, ring);
            const item = itemId(line, ring);
            ws.items[item] = { id: item, name: `${line} ${ring} goods`, type: 'material', plan: { tier: ring } };
            ws.tokens[id] = {
                id, name: `${line} ${ring} node`, uses: 3, respawn: { mode: 'refill', afterMs: 60000 },
                config: { skill, skillRequired: 1, cycleTimeMs: 6000, xp: 1, inputs: [], outputs: [{ itemId: item, chance: 100, minQty: 1, maxQty: 1 }] }
            };
        }
    }
    return ws;
}

/** The content as the ledger's engines take it. */
export function contentOf(ws) {
    return { items: ws.items, tokens: ws.tokens, recipePools: ws.recipePools, effects: ws.effects, starterCamp: ws.starterCamp };
}
