// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { runSim } from '../../cms/src/engine/sim/simRunner.js';
import { chooseInteger } from '../../cms/src/engine/sim/pricingPass.js';
import { toleranceFor, workspaceDials } from '../../cms/src/engine/sim/dials.js';
import { applyItemResults, migrateLegacyIntent } from '../../cms/src/engine/sim/writeBack.js';
import { buildChainTrails } from '../../cms/src/engine/sim/chain.js';
import { recalculateWorkspace } from '../../cms/src/engine/recalculate';
import { pricingFindings } from '../../cms/src/engine/ledgerReport.js';
import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { loadGameData } from '../../cms/gameData.js';
import { itemUseSourceId, usedItemOfSource } from '../config/registries/itemUse.js';
import shippedItems from '../../data/items.json';
import shippedTokens from '../../data/tokens.json';
import shippedRecipes from '../../data/tokenRecipes.json';

/**
 * ⭐ Recalculate prices an item's Use (the balancer's rule, owner-accepted): a Use's drops together
 * are worth the item used, split among them as a recipe's co-outputs are (an equal share each, a
 * piece worth its share over its abundance, never under a coin), with no labour
 * term, since a Use takes no hero and no time. A drop with other sources is elected as for any two
 * sources (the lowest level, a Use ranking at the level its item is first had, after a Token or a
 * Recipe on a tie); the Use counts as a source for the no-source checks; a Recalculate and Sync of
 * a Use reproduce themselves; and on the shipped corpus, where the Bird Nest's Use sits beside
 * Search a Bird Nest, nothing moves.
 *
 * The fixture: a level-1 Tree gives Wood and, one time in twenty, a Nest. Using a Nest gives 1 to 2
 * Seeds every time, a Gem Seed one time in four and 1 to 3 Odd Seeds one time in ten.
 *
 * ⚠️ No real workspace: the store's persistence is a no-op and the data is a throwaway folder of
 * fixture records, never `data/` (TESTING, "The CMS").
 */

const DIALS = workspaceDials();
const NEST = 'item_nest';
const USE = itemUseSourceId(NEST);
const NEST_USE = {
    drops: [
        { itemId: 'item_seed', chance: 100, minQty: 1, maxQty: 2 },
        { itemId: 'item_gem_seed', chance: 25, minQty: 1, maxQty: 1 },
        { itemId: 'item_odd_seed', chance: 10, minQty: 1, maxQty: 3 }
    ]
};
// Expected units a Nest gives of each drop: chance × the mean amount.
const ABUNDANCE = { item_seed: 1.5, item_gem_seed: 0.25, item_odd_seed: 0.2 };

const out = (itemId, over = {}) => ({ itemId, chance: 100, minQty: 1, maxQty: 1, ...over });
const token = (id, { level = 1, outputs, inputs = [], purpose = 'gph' } = {}) => ({
    id, name: id, rarity: 'common', tokenType: 'resource', uses: 10, tags: [], requiresHero: true,
    config: { skill: 'forestry', skillRequired: level, cycleTimeMs: 8000, xp: 1, inputs, outputs },
    sim: { tempo: 'fast', purpose }
});
const recipe = (id, { level = 1, inputs = [], outputs, purpose = 'gph' } = {}) => ({
    id, name: id, skill: 'crafting', levelRequirement: level, durationMs: 8000, inputs, outputs, sim: { tempo: 'fast', purpose }
});
const item = (id, extra = {}) => ({ id, name: id, description: '', type: 'material', sprite: '', stackable: true, restoreAmount: 0, equipSlot: '', autoSyncId: false, tags: [], ...extra });

const items = ({ use = true, stored = {} } = {}) => {
    const all = {
        [NEST]: item(NEST, use ? { use: structuredClone(NEST_USE) } : {}),
        item_wood: item('item_wood'),
        item_seed: item('item_seed'),
        item_gem_seed: item('item_gem_seed'),
        item_odd_seed: item('item_odd_seed')
    };
    for (const [id, valueSource] of Object.entries(stored)) all[id].valueSource = valueSource;
    return all;
};
const tree = (level = 1, extra = []) => token('token_tree', { level, outputs: [out('item_wood', { minQty: 1, maxQty: 2 }), out(NEST, { chance: 5 }), ...extra] });

const solve = ({ use = true, stored = {}, tokens = { token_tree: tree() }, recipes = {} } = {}) =>
    runSim({ items: items({ use, stored }), tokens, recipes }, DIALS);

const SEEDS = Object.keys(ABUNDANCE);
const dropsWorth = (sim, ids = SEEDS) => ids.reduce((s, id) => s + ABUNDANCE[id] * sim.values.get(id), 0);

describe('⭐ a Use with no other source of its drops', () => {
    it('prices every drop from the item: together they are worth it, an equal share each, no labour', () => {
        const sim = solve();
        const worth = sim.values.get(NEST);
        expect(worth).toBeGreaterThan(10);
        expect(sim.useLevels.get(USE)).toBe(1);
        const band = toleranceFor(1, DIALS, { isAnchor: true });
        // Each of the three drops carries a third of the Nest, and a piece is worth its third ÷ its abundance; none is under a coin.
        const share = worth / SEEDS.length;
        SEEDS.forEach((id) => {
            expect(sim.elections.get(id)).toMatchObject({ sourceId: USE, kind: 'use', level: 1 });
            const detail = sim.details.get(id);
            expect(detail).toMatchObject({ use: true, targetPerHour: 0, floorEngaged: false, inputValue: worth, cycleTimeMs: null });
            expect(detail.ideal).toBeCloseTo(share / ABUNDANCE[id], 9);
            expect(detail.ideal).toBeGreaterThan(1);
            expect(sim.values.get(id)).toBe(chooseInteger(detail.ideal, band).value);
        });
        // The ideals add up to the item exactly; whole gold lands inside the band.
        expect(SEEDS.reduce((s, id) => s + ABUNDANCE[id] * sim.details.get(id).ideal, 0)).toBeCloseTo(worth, 9);
        expect(Math.abs(dropsWorth(sim) - worth) / worth).toBeLessThanOrEqual(band);
        // In proportion: a Gem Seed is six times scarcer than a Seed (0.25 against 1.5), so six times the worth a piece, not thirty-six.
        expect(sim.details.get('item_gem_seed').ideal / sim.details.get('item_seed').ideal).toBeCloseTo(ABUNDANCE.item_seed / ABUNDANCE.item_gem_seed, 9);
    });

    it('a common drop at the floor: its coins come out of the rarer drop, and the drops stay worth the item', () => {
        const worth = solve().values.get(NEST);
        // Seeds by the handful, three quarters of the Nest's worth in pieces: half the Nest is under a coin a piece for them, so they are kept at 1 coin and carry their count, and a Gem Seed one time in ten takes the rest.
        const handful = Math.round(worth * 0.75);
        const lavish = { drops: [{ itemId: 'item_seed', chance: 100, minQty: handful, maxQty: handful }, { itemId: 'item_gem_seed', chance: 10, minQty: 1, maxQty: 1 }] };
        const sim = runSim({ items: { ...items({ use: false }), [NEST]: item(NEST, { use: lavish }) }, tokens: { token_tree: tree() } }, DIALS);
        expect(sim.values.get(NEST)).toBe(worth);
        expect(handful).toBeGreaterThan(worth / 2);
        expect(sim.values.get('item_seed')).toBe(1);
        expect(sim.details.get('item_seed').ideal).toBeCloseTo(1, 9);
        expect(sim.details.get('item_gem_seed').ideal).toBeCloseTo((worth - handful) / 0.1, 9);
        const total = handful * sim.values.get('item_seed') + 0.1 * sim.values.get('item_gem_seed');
        expect(Math.abs(total - worth) / worth).toBeLessThanOrEqual(toleranceFor(1, DIALS, { isAnchor: true }));
        expect(sim.rows.some(r => r.code === 'use-off-worth')).toBe(false);
    });

    it('the guard: the same drops as a recipe, which pays its labour, come out worth more than the item', () => {
        const search = recipe('recipe_search_nest', { inputs: [{ itemId: NEST, quantity: 1 }], outputs: NEST_USE.drops.map(d => ({ ...d })), purpose: 'iph' });
        const sim = solve({ use: false, recipes: { recipe_search_nest: search } });
        const worth = sim.values.get(NEST);
        const ideal = SEEDS.reduce((s, id) => s + ABUNDANCE[id] * sim.details.get(id).ideal, 0);
        expect(ideal).toBeGreaterThan(worth * (1 + sim.dials.craftMarginPerStep) - 1e-9);
    });

    it('nothing times, tunes or pays a Use, and its drops are never moved', () => {
        const sim = solve();
        expect(sim.timing.has(USE)).toBe(false);
        expect(sim.skipped.has(USE)).toBe(false);
        expect(sim.tunings.has(USE)).toBe(false);
        expect(sim.xp.has(USE)).toBe(false);
        expect(sim.cycleTimes.has(USE)).toBe(false);
        expect(sim.rows.filter(r => r.entityId === USE && r.code !== 'integer-residual')).toEqual([]);
        expect(applyItemResults(items(), sim)[NEST].use).toEqual(NEST_USE);
    });

    it('the value and the coin worth reach the items, the source named as the Use', () => {
        const sim = solve();
        const written = applyItemResults(items(), sim, { coins: true });
        for (const id of SEEDS) {
            expect(written[id]).toMatchObject({ value: sim.values.get(id), valueSource: USE, coinWorth: sim.values.get(id) });
        }
        expect(usedItemOfSource(written.item_seed.valueSource)).toBe(NEST);
        expect(usedItemOfSource('token_tree')).toBeNull();
        // The chain inspector says what set it.
        const trail = buildChainTrails(sim).get('item_gem_seed');
        expect(trail).toMatchObject({ sourceId: USE, sourceKind: 'use', sourceTag: 'a Use: no hero, no time' });
        expect(trail.arithmetic).toMatch(/item_nest in · its drops together worth the item, split by scarcity/);
    });
});

describe('⭐ a drop with another source: elected as for two sources', () => {
    it('a recipe at the Use\'s level wins the tie; the Use takes the drop at its value and splits the rest', () => {
        const maker = recipe('recipe_seed', { outputs: [out('item_seed')] });
        const sim = solve({ recipes: { recipe_seed: maker } });
        expect(sim.elections.get('item_seed')).toMatchObject({ sourceId: 'recipe_seed', kind: 'recipe' });
        const worth = sim.values.get(NEST);
        // The Seed keeps its worth; the two drops the Use prices share the rest equally.
        const inherited = ABUNDANCE.item_seed * sim.values.get('item_seed');
        const share = (worth - inherited) / 2;
        expect(sim.details.get('item_gem_seed').ideal).toBeCloseTo(share / ABUNDANCE.item_gem_seed, 9);
        expect(sim.details.get('item_odd_seed').ideal).toBeCloseTo(share / ABUNDANCE.item_odd_seed, 9);
        expect(sim.elections.get('item_gem_seed').sourceId).toBe(USE);
    });

    it('a later recipe loses to the Use, inherits the drop and is judged by its own earnings', () => {
        const maker = recipe('recipe_seed', { level: 10, outputs: [out('item_seed')] });
        const sim = solve({ recipes: { recipe_seed: maker } });
        expect(sim.elections.get('item_seed').sourceId).toBe(USE);
        const judged = sim.tunings.get('recipe_seed');
        expect(judged).toMatchObject({ isAnchor: false });
        // Its earnings are read at the Use's price of the drop.
        expect(judged.before.revenuePerHour).toBeCloseTo(sim.values.get('item_seed') * judged.before.cyclesPerHour, 6);
    });

    it('a Use ranks at the level its item is first had, not the level its item is priced at', () => {
        const maker = recipe('recipe_seed', { level: 10, outputs: [out('item_seed')] });
        // A Nest first had at level 12: the level-10 recipe now out-ranks the Use.
        const late = solve({ tokens: { token_tree: tree(12) }, recipes: { recipe_seed: maker } });
        expect(late.useLevels.get(USE)).toBe(12);
        expect(late.elections.get('item_seed').sourceId).toBe('recipe_seed');
        // A level-3 bush also gives Nests; the Nest stays priced from the stored level-12 Tree, but is had at 3.
        const bush = token('token_bush', { level: 3, outputs: [out('item_wood'), out(NEST, { chance: 5 })] });
        const both = solve({ tokens: { token_tree: tree(12), token_bush: bush }, recipes: { recipe_seed: maker }, stored: { [NEST]: 'token_tree' } });
        expect(both.elections.get(NEST).sourceId).toBe('token_tree');
        expect(both.useLevels.get(USE)).toBe(3);
        expect(both.elections.get('item_seed').sourceId).toBe(USE);
    });

    it('the Token the item comes from, giving the same drop, wins the tie: nothing waits on itself', () => {
        const sim = solve({ tokens: { token_tree: tree(1, [out('item_seed', { chance: 20 })]) } });
        expect(sim.elections.get('item_seed').sourceId).toBe('token_tree');
        for (const id of [NEST, ...SEEDS]) expect(sim.values.has(id), id).toBe(true);
        expect(sim.rows.filter(r => r.code === 'blocked-chain' || r.code === 'recipe-cycle')).toEqual([]);
    });

    it('a stored election is kept over a Use that would out-rank it, and the Use takes over once it goes', () => {
        const search = recipe('recipe_search_nest', { level: 5, inputs: [{ itemId: NEST, quantity: 1 }], outputs: NEST_USE.drops.map(d => ({ ...d })), purpose: 'iph' });
        const stored = Object.fromEntries(SEEDS.map(id => [id, 'recipe_search_nest']));
        const kept = solve({ recipes: { recipe_search_nest: search }, stored });
        for (const id of SEEDS) {
            expect(kept.elections.get(id)).toMatchObject({ sourceId: 'recipe_search_nest', sticky: true });
            expect(kept.rows.some(r => r.code === 'anchor-candidate-changed' && r.itemId === id && r.entityId === USE)).toBe(true);
        }
        const retired = solve({ stored });
        for (const id of SEEDS) {
            expect(retired.elections.get(id).sourceId).toBe(USE);
            expect(retired.rows.some(r => r.code === 'stale-election' && r.itemId === id)).toBe(true);
        }
        // A Use stored as the source is kept too.
        const again = solve({ recipes: { recipe_search_nest: { ...search, levelRequirement: 1 } }, stored: Object.fromEntries(SEEDS.map(id => [id, USE])) });
        for (const id of SEEDS) expect(again.elections.get(id)).toMatchObject({ sourceId: USE, sticky: true });
    });

    it('a Use whose drops are all priced elsewhere, worth far more than its item, is named', () => {
        const base = solve({ use: false });
        const wood = base.values.get('item_wood');
        const worth = base.values.get(NEST);
        const woodUse = (qty) => runSim({
            items: { ...items({ use: false }), [NEST]: item(NEST, { use: { drops: [{ itemId: 'item_wood', chance: 100, minQty: qty, maxQty: qty }] } }) },
            tokens: { token_tree: tree() }
        }, DIALS);
        const rich = woodUse(Math.ceil(3 * worth / wood));
        expect(rich.values.get(NEST)).toBe(worth);
        expect(rich.rows.find(r => r.code === 'use-off-worth')).toMatchObject({ entityId: USE, itemId: NEST, severity: 'info', detail: { anchors: [] } });
        // The guard: about its worth in Wood, nothing is said; nor of a Use pricing its own drops.
        expect(woodUse(Math.max(1, Math.round(worth / wood))).rows.some(r => r.code === 'use-off-worth')).toBe(false);
        expect(solve().rows.some(r => r.code === 'use-off-worth')).toBe(false);
    });
});

describe('⭐ a Use counts as a source for the no-source checks', () => {
    it('the simulator: no orphan, and every drop priced; the guard: without the Use each is an orphan', () => {
        const sim = solve();
        expect(sim.rows.filter(r => r.code === 'orphan-item')).toEqual([]);
        const bare = solve({ use: false });
        for (const id of SEEDS) {
            expect(bare.values.has(id)).toBe(false);
            expect(bare.rows.some(r => r.code === 'orphan-item' && r.itemId === id && r.severity === 'critical')).toBe(true);
        }
    });

    const workspace = (use) => ({
        items: items({ use }),
        tokens: { token_tree: tree() },
        recipePools: {},
        effects: {}
    });

    it('Recalculate\'s audit and the ledger\'s pricing findings: nothing calls a drop unsourced', () => {
        const { report } = recalculateWorkspace(workspace(true), DIALS, { now: () => 1 });
        // A simulator row reaches the audit as prose naming the item.
        const about = (issues, id) => issues.filter(i => i.entityId === id || new RegExp(`\\b${id}\\b`).test(i.details));
        for (const id of SEEDS) {
            expect(about(report.auditIssues, id).filter(i => i.severity === 'Critical'), id).toEqual([]);
            expect(report.items[id]).toMatchObject({ valueSource: USE });
            expect(report.items[id].value).toBeGreaterThan(0);
        }
        expect(pricingFindings(report.sim.rows, report).filter(f => SEEDS.includes(f.key.replace('item:', '')))).toEqual([]);
        // The guard: without the Use, each drop is a no-source Critical.
        const bare = recalculateWorkspace(workspace(false), DIALS, { now: () => 1 }).report;
        for (const id of SEEDS) {
            expect(about(bare.auditIssues, id).some(i => i.severity === 'Critical' && /\[orphan-item\]/.test(i.details)), id).toBe(true);
            expect(bare.items[id]).toMatchObject({ value: null, valueSource: null });
        }
    });
});

describe('⭐ Recalculate and Sync reproduce a Use', () => {
    const tmpRoots = [];
    const dataDir = (records) => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-use-priced-'));
        tmpRoots.push(root);
        const data = path.join(root, 'data');
        fs.mkdirSync(data);
        fs.mkdirSync(path.join(root, 'plan'));
        fs.writeFileSync(path.join(data, 'items.json'), JSON.stringify(records, null, 2));
        fs.writeFileSync(path.join(data, 'tokens.json'), JSON.stringify({ token_tree: tree() }, null, 2));
        fs.writeFileSync(path.join(data, 'tokenRecipes.json'), '[]');
        fs.writeFileSync(path.join(data, 'effects.json'), '{}');
        return { dataRoot: data, planRoot: path.join(root, 'plan') };
    };
    const store = () => useEntityStore.getState();
    const restore = (records) => store().hydrate(loadGameData(dataDir(records)));
    const synced = () => JSON.parse(JSON.stringify(syncFiles(store().recalculateEconomy({}))));

    const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    let storedBefore;
    beforeAll(() => {
        storedBefore = globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null;
        useEntityStore.persist.setOptions({ storage: noStorage });
    });
    beforeEach(() => restore(items()));
    afterEach(() => {
        useSimulationStore.getState().clearResults();
        expect(globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null).toBe(storedBefore);
    });
    afterAll(() => { for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true }); });

    it('a second Recalculate and Sync from what the first wrote changes nothing', () => {
        const first = synced();
        for (const id of SEEDS) expect(first['items.json'][id].valueSource).toBe(USE);
        restore(first['items.json']);
        const second = synced();
        expect(JSON.stringify(second['items.json'])).toBe(JSON.stringify(first['items.json']));
        expect(JSON.stringify(second['tokens.json'])).toBe(JSON.stringify(first['tokens.json']));
    });
});

describe('⭐ the shipped corpus', () => {
    const solveShipped = (recipeList, stored = shippedItems) => {
        const recipePools = {};
        for (const r of recipeList) (recipePools[r.skill] ||= []).push(r);
        const migrated = migrateLegacyIntent({ tokens: shippedTokens, recipePools });
        const recipes = Object.fromEntries(Object.values(migrated.recipePools).flat().map(r => [r.id, r]));
        const sim = runSim({ items: stored, tokens: migrated.tokens, recipes }, DIALS);
        return { sim, items: applyItemResults(stored, sim) };
    };
    const BIRD_NEST = 'item_bird_nest';
    const drops = shippedItems[BIRD_NEST]?.use?.drops ?? [];

    it('the Bird Nest\'s Use is a source of every one of its drops, and with Search a Bird Nest beside it nothing moves', () => {
        expect(drops.length).toBeGreaterThan(0);
        const { sim, items: solved } = solveShipped(shippedRecipes);
        for (const d of drops) {
            expect((sim.candidates.get(d.itemId) || []).some(c => c.entity.id === itemUseSourceId(BIRD_NEST)), d.itemId).toBe(true);
        }
        for (const [id, def] of Object.entries(shippedItems)) {
            expect(solved[id].value, id).toBe(def.value);
            expect(solved[id].valueSource, id).toBe(def.valueSource);
        }
        expect(sim.rows.some(r => r.entityId === itemUseSourceId(BIRD_NEST) && r.severity !== 'info')).toBe(false);
    });

    const searchId = 'recipe_search_bird_nest';
    it.skipIf(!shippedRecipes.some(r => r.id === searchId))('with Search a Bird Nest retired, its seeds keep a value from the Use, worth the Nest together', () => {
        const { sim, items: solved } = solveShipped(shippedRecipes.filter(r => r.id !== searchId));
        const was = drops.filter(d => shippedItems[d.itemId].valueSource === searchId);
        expect(was.length).toBeGreaterThan(0);
        for (const d of was) {
            expect(solved[d.itemId].valueSource, d.itemId).toBe(itemUseSourceId(BIRD_NEST));
            expect(solved[d.itemId].value, d.itemId).toBeGreaterThan(0);
        }
        // No new warning about a seed: the crops that over-earn on their seeds today still do, and nothing else.
        const seeds = new Set(drops.map(d => d.itemId));
        const loud = (rows) => new Set(rows.filter(r => r.severity !== 'info' && seeds.has(r.itemId)).map(r => `${r.code}|${r.itemId}|${r.entityId}`));
        const today = loud(solveShipped(shippedRecipes).sim.rows);
        for (const key of loud(sim.rows)) expect(today.has(key), key).toBe(true);
        const worth = solved[BIRD_NEST].value;
        const total = drops.reduce((s, d) => s + (d.chance / 100) * ((d.minQty + d.maxQty) / 2) * solved[d.itemId].value, 0);
        expect(Math.abs(total - worth) / worth).toBeLessThanOrEqual(toleranceFor(sim.useLevels.get(itemUseSourceId(BIRD_NEST)), DIALS));
    });
});
