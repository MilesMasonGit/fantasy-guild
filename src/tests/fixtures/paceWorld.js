// Fantasy Guild — test fixture: a small world for the ledger's pace (profiles, path time, checks D).
//
// A Starter Camp of a copper vein (five charges, a minute's rest), an unlimited oak and a Still that
// makes Beer from wood; a Shop Foundation (10 Oak Wood) that takes builds: a Hut (Construction 1,
// 5 XP), a Mine (a 25 % double on the vein), a Gold Statue (a 1 % yield for 1000 wood: never worth
// it), a Mining Camp, and a Big Hut that asks Construction 15. Numbers are round so the rates read
// by hand.

const out = (itemId, chance = 100, minQty = 1, maxQty = minQty) => ({ itemId, chance, minQty, maxQty });
const tokenOut = (tokenId) => ({ tokenId, chance: 100, minQty: 1, maxQty: 1 });
const provides = (id, type, bucket, value, to, extra = {}) => ({ id: `stm_${id}`, keyword: 'provides', to, reach: 'nearby', payload: { type, bucket, value, ...extra } });

export const PACE_EFFECTS = {
    pw_fx_merry: { id: 'pw_fx_merry', name: 'Merry', statements: [provides('pw_merry', 'XP_BONUS', 'percentage', 0.1, { mode: 'all', value: '' })] },
    pw_fx_beer: {
        id: 'pw_fx_beer', name: 'Beer drink',
        statements: [{ id: 'stm_pw_beer', keyword: 'applies', to: { mode: 'all', value: '' }, target: { role: 'actor' }, when: { event: 'WORK_START', scope: 'self' }, payload: { effectId: 'pw_fx_merry', scale: 1, durationMs: 0, forCycle: true, chance: 100 } }]
    }
};

export const PACE_ITEMS = {
    item_copper_ore: { id: 'item_copper_ore', name: 'Copper Ore', type: 'material', plan: { tier: 0 } },
    item_oak_wood: { id: 'item_oak_wood', name: 'Oak Wood', type: 'material', plan: { tier: 0 } },
    item_beer: { id: 'item_beer', name: 'Beer', type: 'drink', equipSlot: 'drink', stackable: true, effects: [{ effectId: 'pw_fx_beer', scale: 1 }], plan: { tier: 0 } },
    item_copper_pickaxe: { id: 'item_copper_pickaxe', name: 'Copper Pickaxe', type: 'tool', equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 1, starter: true } },
    item_copper_woodaxe: { id: 'item_copper_woodaxe', name: 'Copper Woodaxe', type: 'tool', equipSlot: 'hand', tool: { kind: 'woodaxe', tier: 1, starter: true } }
};

const building = (id, name, extra = {}) => ({ id, name, tokenType: 'buff', uses: null, requiresHero: false, config: null, ...extra });

export const PACE_TOKENS = {
    token_guild_hall: { id: 'token_guild_hall', name: 'Guild Hall' },
    token_vein: {
        id: 'token_vein', name: 'Copper Vein', tags: ['Ore'], uses: 5, needsTool: { kind: 'pickaxe', minTier: 1 }, respawn: { mode: 'refill', afterMs: 60000 },
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [out('item_copper_ore', 100, 1, 2)] }
    },
    token_oak: {
        id: 'token_oak', name: 'Oak', uses: null, needsTool: { kind: 'woodaxe', minTier: 1 },
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 4000, xp: 1, inputs: [], outputs: [out('item_oak_wood')] }
    },
    token_still: {
        id: 'token_still', name: 'Still', uses: null,
        config: { skill: 'cooking', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [] },
        statements: [{ keyword: 'station', payload: { skill: 'cooking', stationKind: 'still' } }]
    },
    token_plot: { id: 'token_plot', name: 'Plot', uses: null, config: null, shop: { price: [{ itemId: 'item_oak_wood', quantity: 10 }] }, foundation: { kind: 'wood', skill: 'construction' } },
    token_hut: building('token_hut', 'Hut'),
    token_big_hut: building('token_big_hut', 'Big Hut'),
    token_mine: building('token_mine', 'Mine', { statements: [provides('pw_mine', 'DOUBLE_DROP', 'flat', 25, { mode: 'id', value: 'token_vein' }, { category: 'item_copper_ore' })] }),
    token_statue: building('token_statue', 'Gold Statue', { statements: [provides('pw_statue', 'YIELD', 'percentage', 0.01, { mode: 'id', value: 'token_vein' })] }),
    token_mining_camp: { id: 'token_mining_camp', name: 'Mining Camp', uses: null, config: null, camp: { skill: 'mining', reach: 280 } }
};

const build = (id, name, level, xp, durationMs, wood, tokenId) => ({
    id, name, skill: 'construction', levelRequirement: level, xp, durationMs, foundationKinds: ['wood'],
    inputs: [{ itemId: 'item_oak_wood', quantity: wood }], outputs: [tokenOut(tokenId)]
});

export const PACE_RECIPES = [
    { id: 'recipe_beer', name: 'Beer', skill: 'cooking', levelRequirement: 1, stationKinds: ['still'], durationMs: 10000, xp: 1, inputs: [{ itemId: 'item_oak_wood', quantity: 1 }], outputs: [out('item_beer')] },
    build('recipe_build_hut', 'Build Hut', 1, 5, 30000, 5, 'token_hut'),
    build('recipe_build_mine', 'Build Mine', 1, 5, 30000, 5, 'token_mine'),
    build('recipe_build_statue', 'Build Gold Statue', 1, 5, 30000, 1000, 'token_statue'),
    build('recipe_build_camp', 'Build Mining Camp', 1, 5, 30000, 20, 'token_mining_camp'),
    { ...build('recipe_build_big_hut', 'Build Big Hut', 15, 20, 60000, 10, 'token_big_hut'), plan: { tier: 1 } }
];

export const PACE_CAMP = {
    tokens: [
        { typeId: 'token_vein', x: 0, y: 0 }, { typeId: 'token_oak', x: 1, y: 0 }, { typeId: 'token_still', x: 2, y: 0 }
    ],
    bank: {}
};

/** The world as the ledger and the pace take it. */
export function paceContent() {
    return {
        items: structuredClone(PACE_ITEMS),
        tokens: structuredClone(PACE_TOKENS),
        recipes: structuredClone(PACE_RECIPES),
        effects: structuredClone(PACE_EFFECTS),
        starterCamp: structuredClone(PACE_CAMP)
    };
}

/** The same world as the CMS workspace holds it (recipes in pools by skill). */
export function paceWorkspace() {
    const c = paceContent();
    const recipePools = {};
    for (const r of c.recipes) (recipePools[r.skill] ||= []).push(r);
    return { items: c.items, tokens: c.tokens, effects: c.effects, recipePools, starterCamp: c.starterCamp, skillPerks: null };
}
