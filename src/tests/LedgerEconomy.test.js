import { describe, it, expect } from 'vitest';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { economyFindings, HUB_MIN_USES, VALUE_EFFORT_FACTOR } from '../systems/progression/ledger/economy.js';
import { runChecks, CHECKS } from '../systems/progression/ledger/checks.js';

/**
 * The ledger's checks E (brief 290 L9): a hub with one source, a stock with no sink, spawner
 * upkeep above what a spawn makes, value per effort far off its stage's middle. On a camp built
 * here, every work 10 s and one item a cycle, so effort reads by hand.
 */

const out = (itemId, chance = 100) => ({ itemId, chance, minQty: 1, maxQty: 1 });
const work = (id, itemId, extra = {}) => ({ id, name: id.replace('token_', ''), uses: null, config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [out(itemId)] }, ...extra });
const station = { id: 'token_bench', name: 'Bench', uses: null, config: { skill: 'crafting', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [] }, statements: [{ keyword: 'station', payload: { skill: 'crafting', stationKind: 'bench' } }] };
const recipe = (id, inputs, itemId, extra = {}) => ({ id, name: id.replace('recipe_', ''), skill: 'crafting', levelRequirement: 1, stationKinds: ['bench'], durationMs: 10000, xp: 1, inputs: inputs.map(([itemId, quantity]) => ({ itemId, quantity })), outputs: [out(itemId)], ...extra });

function camp({ items = {}, tokens = {}, recipes = [], placed = [] }) {
    return {
        items, tokens: { token_bench: station, ...tokens }, recipes,
        effects: {}, starterCamp: { tokens: ['token_bench', ...placed].map((typeId, x) => ({ typeId, x, y: 0 })), bank: {} }
    };
}
const item = (id, extra = {}) => ({ id, name: id.replace('item_', ''), type: 'material', plan: { tier: 0 }, ...extra });
const findings = (content) => economyFindings(buildLedger(content), content);
const of = (list, check) => list.filter(f => f.check === check).map(f => f.key);

describe('a hub with one source', () => {
    const content = () => camp({
        items: { item_ore: item('item_ore'), item_a: item('item_a'), item_b: item('item_b'), item_c: item('item_c') },
        tokens: { token_vein: work('token_vein', 'item_ore') },
        recipes: [recipe('recipe_a', [['item_ore', 1]], 'item_a'), recipe('recipe_b', [['item_ore', 2]], 'item_b'), recipe('recipe_c', [['item_ore', 3]], 'item_c')],
        placed: ['token_vein']
    });

    it(`is an item ${HUB_MIN_USES} things spend that one work alone makes`, () => {
        const f = findings(content()).find(x => x.check === 'hub-one-source' && x.key === 'item:item_ore');
        expect(f.message).toMatch(/3 things spend it/);
        expect(f.related).toContain('token:token_vein');
    });

    it('is not one with a second source, nor one fewer user', () => {
        const two = content();
        two.tokens.token_rocks = work('token_rocks', 'item_ore');
        two.starterCamp.tokens.push({ typeId: 'token_rocks', x: 9, y: 0 });
        expect(of(findings(two), 'hub-one-source')).not.toContain('item:item_ore');
        const fewer = content();
        fewer.recipes.pop();
        expect(of(findings(fewer), 'hub-one-source')).not.toContain('item:item_ore');
    });
});

describe('a stock with no sink', () => {
    const content = () => camp({
        items: { item_stone: item('item_stone'), item_wall: item('item_wall') },
        tokens: {
            token_quarry: work('token_quarry', 'item_stone'),
            token_plot: { id: 'token_plot', name: 'Plot', uses: null, config: null, shop: { price: [] }, foundation: { kind: 'stone', skill: 'construction' } },
            token_hut: { id: 'token_hut', name: 'Hut', uses: null, config: null, tokenType: 'buff' }
        },
        recipes: [{ id: 'recipe_build_hut', name: 'Build Hut', skill: 'construction', levelRequirement: 1, xp: 5, durationMs: 30000, foundationKinds: ['stone'], inputs: [{ itemId: 'item_stone', quantity: 20 }], outputs: [{ tokenId: 'token_hut', chance: 100, minQty: 1, maxQty: 1 }] }],
        placed: ['token_quarry']
    });

    it('is made over and over but only paid once at a time (a build)', () => {
        const f = findings(content()).find(x => x.check === 'no-sink' && x.key === 'item:item_stone');
        expect(f.message).toMatch(/Build Hut/);
        expect(CHECKS['no-sink']).toMatchObject({ group: 'E' });
    });

    it('is not one a recipe spends every cycle', () => {
        const c = content();
        c.recipes.push(recipe('recipe_wall', [['item_stone', 2]], 'item_wall'));
        expect(of(findings(c), 'no-sink')).not.toContain('item:item_stone');
    });
});

describe('spawner upkeep above what a spawn makes', () => {
    const content = ({ uses = 2, regrows = false } = {}) => camp({
        items: { item_seed: item('item_seed', { value: 100 }), item_berry: item('item_berry', { value: 10 }) },
        tokens: {
            token_bush: work('token_bush', 'item_berry', { uses, ...(regrows ? { respawn: { mode: 'refill', afterMs: 60000 } } : {}) }),
            token_patch: { id: 'token_patch', name: 'Patch', uses: null, config: null, spawner: { spawns: [{ typeId: 'token_bush', weight: 1 }], allowance: 3, intervalMs: 30000, upkeep: [{ itemId: 'item_seed', quantity: 1 }] } },
            token_seeder: work('token_seeder', 'item_seed')
        },
        placed: ['token_patch', 'token_seeder']
    });

    it('is a spawn worth less over its life than the upkeep paid for it', () => {
        // Two berries (20) for one seed (100).
        const f = findings(content()).find(x => x.check === 'spawner-upkeep');
        expect(f).toMatchObject({ key: 'token:token_patch' });
        expect(f.message).toMatch(/worth 100/);
        expect(f.message).toMatch(/only 20 worth/);
    });

    it('is not one whose spawn pays its upkeep back, or comes back after it runs out', () => {
        expect(of(findings(content({ uses: 20 })), 'spawner-upkeep')).toEqual([]);
        expect(of(findings(content({ regrows: true })), 'spawner-upkeep')).toEqual([]);
    });
});

describe('value per effort far off the norm', () => {
    const content = (odd) => {
        const items = {};
        const tokens = {};
        const placed = [];
        for (let i = 0; i < 6; i++) {
            items[`item_g${i}`] = item(`item_g${i}`, { value: i === 0 ? odd : 10 });
            tokens[`token_g${i}`] = work(`token_g${i}`, `item_g${i}`);
            placed.push(`token_g${i}`);
        }
        return camp({ items, tokens, placed });
    };

    it(`is an item worth over ${VALUE_EFFORT_FACTOR} times its stage's middle per minute of work, either way`, () => {
        expect(of(findings(content(1000)), 'value-effort')).toEqual(['item:item_g0']);
        expect(of(findings(content(1)), 'value-effort')).toEqual(['item:item_g0']);
        expect(of(findings(content(30)), 'value-effort')).toEqual([]);
    });
});

describe('checks E in the list', () => {
    it('are filed under Economy and silenced on a Parked entry like any check', () => {
        const c = camp({
            items: { item_ore: item('item_ore', { plan: { tier: 0, status: 'parked' } }), item_a: item('item_a'), item_b: item('item_b'), item_c: item('item_c') },
            tokens: { token_vein: work('token_vein', 'item_ore') },
            recipes: [recipe('recipe_a', [['item_ore', 1]], 'item_a'), recipe('recipe_b', [['item_ore', 1]], 'item_b'), recipe('recipe_c', [['item_ore', 1]], 'item_c')],
            placed: ['token_vein']
        });
        const ledger = buildLedger(c);
        const extra = economyFindings(ledger, c);
        expect(of(extra, 'hub-one-source')).toContain('item:item_ore');
        const listed = runChecks(ledger, c, { extra });
        expect(listed.filter(f => f.key === 'item:item_ore' && f.group === 'E')).toEqual([]);
    });
});
