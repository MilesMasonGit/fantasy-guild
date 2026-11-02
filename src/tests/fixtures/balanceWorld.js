// Fantasy Guild — test fixture: a small world for the ledger's balancing preview (brief 290 L9).
//
// Everything stands in the Starter Camp and needs no tool, so each rate reads by hand: a work of
// 10 s is 360 cycles an hour. Forestry sits on the pace curve (an Oak of 5 XP: 1800 XP an hour, an
// Old Oak at Forestry 6);
// Alchemy is far too slow (Herbs of 1 XP: 360 an hour), so the Elixir planned for the camp at
// Alchemy 12 is hours late; a Gold Statue bought for 5000 wood is a long wait for one unlock; a
// Grove makes the Oak +200 % at Maxed against the buildings' 30 % target; and a Star Vein at
// Mining 90 (plane 3, no budget) leaves one source, the camp's vein, to carry Mining from 1 to 90.

const out = (itemId, chance = 100, minQty = 1, maxQty = minQty) => ({ itemId, chance, minQty, maxQty });
const tokenOut = (tokenId) => ({ tokenId, chance: 100, minQty: 1, maxQty: 1 });
const work = (id, name, skill, level, xp, itemId, extra = {}) => ({
    id, name, uses: null, config: { skill, skillRequired: level, cycleTimeMs: 10000, xp, inputs: [], outputs: [out(itemId)] }, ...extra
});
const building = (id, name, extra = {}) => ({ id, name, tokenType: 'buff', uses: null, requiresHero: false, config: null, ...extra });

export const BALANCE_EFFECTS = {
    fx_grove: {
        id: 'fx_grove', name: 'Grove',
        statements: [{ id: 'stm_grove', keyword: 'provides', to: { mode: 'id', value: 'token_oak' }, reach: 'nearby', payload: { type: 'YIELD', bucket: 'percentage', value: 2 } }]
    }
};

export const BALANCE_ITEMS = {
    item_wood: { id: 'item_wood', name: 'Wood', type: 'material', plan: { tier: 0 } },
    item_old_wood: { id: 'item_old_wood', name: 'Old Wood', type: 'material', plan: { tier: 0 } },
    item_herb: { id: 'item_herb', name: 'Herb', type: 'material', plan: { tier: 0 } },
    item_ore: { id: 'item_ore', name: 'Ore', type: 'material', plan: { tier: 0 } },
    item_tonic: { id: 'item_tonic', name: 'Tonic', type: 'material', plan: { tier: 0 } },
    item_elixir: { id: 'item_elixir', name: 'Elixir', type: 'material', plan: { tier: 0 } },
    item_star_ore: { id: 'item_star_ore', name: 'Star Ore', type: 'material', plan: { tier: 3 } }
};

export const BALANCE_TOKENS = {
    token_guild_hall: { id: 'token_guild_hall', name: 'Guild Hall' },
    token_oak: work('token_oak', 'Oak', 'forestry', 1, 5, 'item_wood'),
    token_old_oak: work('token_old_oak', 'Old Oak', 'forestry', 6, 6, 'item_old_wood'),
    token_herbs: work('token_herbs', 'Herbs', 'alchemy', 1, 1, 'item_herb'),
    token_vein: work('token_vein', 'Vein', 'mining', 1, 5, 'item_ore'),
    token_star_vein: work('token_star_vein', 'Star Vein', 'mining', 90, 5, 'item_star_ore', { plan: { tier: 3 } }),
    token_still: {
        id: 'token_still', name: 'Still', uses: null,
        config: { skill: 'alchemy', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [] },
        statements: [{ keyword: 'station', payload: { skill: 'alchemy', stationKind: 'still' } }]
    },
    token_plot: { id: 'token_plot', name: 'Plot', uses: null, config: null, shop: { price: [{ itemId: 'item_wood', quantity: 10 }] }, foundation: { kind: 'wood', skill: 'construction' } },
    token_grove: building('token_grove', 'Grove', { effects: [{ effectId: 'fx_grove', scale: 1 }], plan: { tier: 0 } }),
    token_statue: building('token_statue', 'Gold Statue', { shop: { price: [{ itemId: 'item_wood', quantity: 5000 }] }, plan: { tier: 0 } })
};

export const BALANCE_RECIPES = [
    { id: 'recipe_tonic', name: 'Tonic', skill: 'alchemy', levelRequirement: 3, stationKinds: ['still'], durationMs: 10000, xp: 5, inputs: [{ itemId: 'item_herb', quantity: 1 }], outputs: [out('item_tonic')], plan: { tier: 0 } },
    { id: 'recipe_elixir', name: 'Elixir', skill: 'alchemy', levelRequirement: 12, stationKinds: ['still'], durationMs: 10000, xp: 8, inputs: [{ itemId: 'item_herb', quantity: 2 }], outputs: [out('item_elixir')], plan: { tier: 0 } },
    { id: 'recipe_build_grove', name: 'Build Grove', skill: 'construction', levelRequirement: 1, xp: 5, durationMs: 30000, foundationKinds: ['wood'], inputs: [{ itemId: 'item_wood', quantity: 5 }], outputs: [tokenOut('token_grove')], plan: { tier: 0 } }
];

export const BALANCE_CAMP = {
    tokens: ['token_oak', 'token_old_oak', 'token_herbs', 'token_vein', 'token_star_vein', 'token_still'].map((typeId, x) => ({ typeId, x, y: 0 })),
    bank: {}
};

/** The world as the ledger and the pace take it. */
export function balanceContent() {
    return {
        items: structuredClone(BALANCE_ITEMS),
        tokens: structuredClone(BALANCE_TOKENS),
        recipes: structuredClone(BALANCE_RECIPES),
        effects: structuredClone(BALANCE_EFFECTS),
        starterCamp: structuredClone(BALANCE_CAMP)
    };
}

/**
 * A calm world: the same camp with nothing off its pace. Alchemy teaches as fast as Forestry, no
 * Elixir, no Statue, no Grove and no Star Vein.
 */
export function calmContent() {
    const c = balanceContent();
    c.tokens.token_herbs.config.xp = 5;
    delete c.items.item_elixir;
    delete c.items.item_star_ore;
    delete c.tokens.token_statue;
    delete c.tokens.token_grove;
    delete c.tokens.token_star_vein;
    c.recipes = c.recipes.filter(r => r.id === 'recipe_tonic');
    c.starterCamp.tokens = c.starterCamp.tokens.filter(t => t.typeId !== 'token_star_vein');
    return c;
}
