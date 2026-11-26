// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { writeNumberPack, writeLiveNumberPack, ruledMakes, restTerms } from '../../cms/src/engine/numberPack.js';
import { setValue, proposedValue, entryConflict, validatePack } from '../../cms/src/engine/changePacks.js';

/**
 * The number pack writer's corrections (both modes): every edit that writes a time pins it
 * (`sim.timePinned`), so the pack's times survive Recalculate and Sync; a gather's yield is left as
 * the content has it, a plan's split and a craft's count by the owner's rules written
 * (BALANCE_RULES section 3: 40 arrows, 40 Arrowheads or Kunai, 5 Nails, 5 drinks; section 5: a
 * work potion's 5); a regrowing tree's rest is its Stump's regrowth at 30 s; and the content
 * session's answers on what a Live record follows (a build or Dig recipe its Token, an offering its
 * shrine, the Bait recipes their fish, chance-only extras kept, a water's catch on its fish, the two
 * rods as they are). Fixtures only; the real workspace is never read.
 *
 * ⚠️ The round trip hydrates the CMS store with persistence off (TESTING, "The CMS").
 */

const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;
beforeAll(() => {
    storedBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: noStorage });
});
afterAll(() => {
    expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore);
});
afterEach(() => useSimulationStore.getState().clearResults());

const live = { status: 'live', tier: 0 };
const TAGS = { tempo: 'quick', purpose: 'iph' };
const range = (itemId, min, max, chance = 100) => ({ itemId, chance, minQty: min, maxQty: max, baseQty: { min, max }, variable: chance < 100 });
const out1 = (itemId, qty) => range(itemId, qty, qty);
const built = (tokenId) => ({ tokenId, chance: 100, minQty: 1, maxQty: 1, baseQty: { min: 1, max: 1 }, variable: false });
const item = (id, name, type = 'material') => ({ id, name, type, plan: live });

// === Live mode ===============================================================

const liveWorkspace = () => ({
    items: Object.fromEntries([
        ['item_flax', 'Flax'], ['item_flax_seed', 'Flax Seed'], ['item_worm', 'Worm'], ['item_tonic', 'Miner\'s Tonic', 'potion'],
        ['item_copper_arrow', 'Copper Arrow'], ['item_arrowheads', 'Copper Arrowheads'], ['item_feather', 'Feather'], ['item_oak_wood', 'Oak Wood'],
        ['item_bait', 'Bait'], ['item_carp', 'Carp'], ['item_ruby', 'Uncut Ruby'], ['item_gem', 'Uncut Gem'], ['item_ore', 'Copper Ore'],
        ['item_twine', 'Twine'], ['item_scrap', 'Scrap'], ['item_rod', 'Fishing Rod'], ['item_nails', 'Copper Nails'], ['item_birch_wood', 'Birch Wood'],
    ].map(([id, name, type]) => [id, item(id, name, type)])),
    tokens: {
        // Chance-only by design: nothing sure to count.
        token_geode: {
            id: 'token_geode', name: 'Geode', uses: 5, respawn: { mode: 'refill', afterMs: 1800000 }, sim: { tempo: 'medium', purpose: 'iph' }, plan: live,
            config: { skill: 'mining', skillRequired: 15, cycleTimeMs: 19000, xp: 5, inputs: [], outputs: [range('item_ruby', 1, 1, 30), range('item_gem', 1, 1, 20)] },
        },
        // A water: its catch is in its pools and on each fish, its outputs empty.
        token_pond: {
            id: 'token_pond', name: 'Pond', uses: null, sim: { tempo: 'fast', purpose: 'iph' }, plan: live,
            config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 8000, xp: 2, inputs: [], outputs: [] },
            catchPools: [{ tool: 'fishing_rod', bait: 'item_bait', catches: [{ itemId: 'item_carp', weight: 100 }] }],
        },
        token_vein: {
            id: 'token_vein', name: 'Copper Vein', uses: 5, respawn: { mode: 'refill', afterMs: 60000 }, sim: TAGS, plan: live,
            config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 6, inputs: [], outputs: [range('item_ore', 1, 3), range('item_gem', 1, 1, 5)] },
        },
        token_birch_tree: {
            id: 'token_birch_tree', name: 'Birch Tree', uses: 5, respawn: { mode: 'regrow', into: 'token_birch_stump' }, sim: TAGS, plan: live,
            config: { skill: 'forestry', skillRequired: 20, cycleTimeMs: 3000, xp: 6, inputs: [], outputs: [range('item_birch_wood', 1, 2)] },
        },
        token_birch_stump: { id: 'token_birch_stump', name: 'Birch Stump', config: null, grows: { into: 'token_birch_tree', afterMs: 600000, needsNearby: ['token_birch_forest'] }, plan: live },
        token_birch_forest: { id: 'token_birch_forest', name: 'Birch Forest', config: null, spawns: { tokenId: 'token_birch_tree', everyMs: 900000, most: 3 }, plan: live },
        token_hut: { id: 'token_hut', name: 'Hut', config: null, plan: live },
        token_shrine: { id: 'token_shrine', name: 'Nature Shrine', shrine: { maxLitMs: 600000 }, config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 12000, xp: 0, inputs: [], outputs: [] } },
    },
    effects: {},
    recipePools: {
        alchemy: [
            { id: 'recipe_tonic', name: 'Miner\'s Tonic', skill: 'alchemy', levelRequirement: 10, inputs: [{ itemId: 'item_flax', quantity: 1 }], outputs: [out1('item_tonic', 1)], xp: 2, durationMs: 4000, sim: TAGS, plan: live },
        ],
        fletching: [
            { id: 'recipe_copper_arrow', name: 'Copper Arrow', skill: 'fletching', levelRequirement: 2, inputs: [{ itemId: 'item_oak_wood', quantity: 1 }, { itemId: 'item_feather', quantity: 1 }, { itemId: 'item_arrowheads', quantity: 10 }], outputs: [out1('item_copper_arrow', 10)], xp: 2, durationMs: 4000, sim: TAGS, plan: live },
        ],
        crafting: [
            // Its Scrap is a chance extra: kept, not unclear.
            { id: 'recipe_twine', name: 'Twine', skill: 'crafting', levelRequirement: 1, inputs: [{ itemId: 'item_flax', quantity: 1 }], outputs: [out1('item_twine', 1), range('item_scrap', 1, 1, 10)], xp: 2, durationMs: 4000, sim: TAGS, plan: live },
            // Its ingredients differ from the catalogue's on purpose: numbered as they are.
            { id: 'recipe_fishing_rod', name: 'Fishing Rod', skill: 'crafting', levelRequirement: 1, inputs: [{ itemId: 'item_oak_wood', quantity: 3 }, { itemId: 'item_nails', quantity: 1 }], outputs: [out1('item_rod', 1)], xp: 2, durationMs: 16000, sim: { tempo: 'medium', purpose: 'iph' }, plan: live },
        ],
        farming: [
            { id: 'recipe_flax', name: 'Flax', skill: 'farming', levelRequirement: 4, inputs: [{ itemId: 'item_flax_seed', quantity: 1 }], outputs: [range('item_flax', 1, 2), range('item_flax_seed', 1, 1, 40), range('item_worm', 1, 1, 10)], xp: 1, durationMs: 3000, crop: { growMs: 3600000 }, sim: TAGS, plan: live },
        ],
        construction: [
            { id: 'recipe_build_hut', name: 'Build Hut', skill: 'construction', levelRequirement: 1, inputs: [{ itemId: 'item_oak_wood', quantity: 5 }], outputs: [built('token_hut')], xp: 15, durationMs: 60000, sim: { tempo: 'heavy' }, plan: live },
            { id: 'recipe_dig_vein', name: 'Dig Copper Vein', skill: 'construction', levelRequirement: 3, inputs: [{ itemId: 'item_oak_wood', quantity: 10 }], outputs: [built('token_vein')], xp: 18, durationMs: 30000, sim: { tempo: 'heavy' }, plan: live },
        ],
        faith: [
            { id: 'recipe_offer_wood', name: 'Offer Oak Wood', skill: 'faith', levelRequirement: 1, stationKinds: ['shrine'], inputs: [{ itemId: 'item_oak_wood', quantity: 2 }], outputs: [], offering: { litMs: 60000 }, durationMs: 4000, xp: 3 },
        ],
        fishing: [
            { id: 'recipe_bait_from_carp', name: 'Bait from Carp', skill: 'fishing', levelRequirement: 5, inputs: [{ itemId: 'item_carp', quantity: 1 }], outputs: [out1('item_bait', 4)], xp: 1, durationMs: 3000, sim: TAGS, plan: live },
            { id: 'recipe_bait_from_worm', name: 'Bait from Worm', skill: 'fishing', levelRequirement: 2, inputs: [{ itemId: 'item_worm', quantity: 1 }], outputs: [out1('item_bait', 2)], xp: 1, durationMs: 3000, sim: TAGS, plan: live },
        ],
    },
});

const liveCatalogue = () => ({ entries: [
    { id: 'flax', name: 'Flax', category: 'item', skill: 'Farming' },
    { id: 'worm', name: 'Worm', category: 'item' },
    { id: 'oak_wood', name: 'Oak Wood', category: 'item' },
    { id: 'feather', name: 'Feather', category: 'item' },
    { id: 'carp', name: 'Carp', category: 'item', skill: 'Fishing', level: 5 },
    { id: 'copper_ore', name: 'Copper Ore', category: 'item' },
    { id: 'birch_wood', name: 'Birch Wood', category: 'item' },
    { id: 'uncut_ruby', name: 'Uncut Ruby', category: 'item' },
    { id: 'uncut_gem', name: 'Uncut Gem', category: 'item' },
    { id: 'copper_nails', name: 'Copper Nails', category: 'item' },
    { id: 'miners_tonic', name: 'Miner\'s Tonic', category: 'item', type: 'work: Mining', skill: 'Alchemy', level: 10, madeWith: ['flax'] },
    { id: 'copper_arrowheads', name: 'Copper Arrowheads', category: 'item', type: 'material' },
    { id: 'copper_arrow', name: 'Copper Arrow', category: 'item', type: 'ammo, Stab', skill: 'Fletching', level: 2, madeWith: ['oak_wood', 'feather', 'copper_arrowheads'] },
    { id: 'twine', name: 'Twine', category: 'item', skill: 'Crafting', level: 1, madeWith: ['flax'] },
    { id: 'fishing_rod', name: 'Fishing Rod', category: 'item', skill: 'Crafting', level: 3, madeWith: ['bamboo', 'copper_nails', 'string'] },
    { id: 'bait', name: 'Bait', category: 'item', type: 'bait', skill: 'Fishing', level: 1, madeWith: ['carp', 'worm'] },
    { id: 'flax_field', name: 'Flax Field', category: 'token', type: 'Farm', skill: 'Farming', level: 4, gives: ['flax'] },
    { id: 'geode', name: 'Geode', category: 'token', skill: 'Mining', level: 15, gives: ['uncut_ruby', 'uncut_gem'] },
    { id: 'pond', name: 'Pond', category: 'token', type: 'Fishing spot', skill: 'Fishing', level: 1, gives: ['carp'] },
    { id: 'copper_vein', name: 'Copper Vein', category: 'token', skill: 'Mining', level: 1, gives: ['copper_ore'] },
    { id: 'birch_tree', name: 'Birch Tree', category: 'token', skill: 'Forestry', level: 20, gives: ['birch_wood'] },
    { id: 'hut', name: 'Hut', category: 'building', skill: 'Construction', level: 1 },
] });

const liveIds = () => ({ ids: Object.fromEntries([
    ['flax', 'item_flax'], ['worm', 'item_worm'], ['oak_wood', 'item_oak_wood'], ['feather', 'item_feather'], ['carp', 'item_carp'],
    ['copper_ore', 'item_ore'], ['birch_wood', 'item_birch_wood'], ['uncut_ruby', 'item_ruby'], ['uncut_gem', 'item_gem'], ['copper_nails', 'item_nails'],
    ['miners_tonic', 'item_tonic'], ['copper_arrowheads', 'item_arrowheads'], ['copper_arrow', 'item_copper_arrow'], ['twine', 'item_twine'],
    ['fishing_rod', 'item_rod'], ['bait', 'item_bait'], ['flax_field', 'recipe_flax'], ['geode', 'token_geode'], ['pond', 'token_pond'],
    ['copper_vein', 'token_vein'], ['birch_tree', 'token_birch_tree'], ['hut', 'token_hut'],
].map(([k, cms]) => [k, { cms, how: 'live' }])) });

const gather = (id, name, skill, level, seconds, xp) => ({ id, name, skill, category: 'token', level, work: 'gather', inputs: [], seconds, xp, makes: 1 });
const liveRows = () => [
    { id: 'miners_tonic', name: 'Miner\'s Tonic', skill: 'Alchemy', category: 'item', type: 'work: Mining', level: 10, work: 'make', inputs: [{ id: 'flax', name: 'Flax', count: 1 }], seconds: 13, xp: 6, makes: 1 },
    { id: 'copper_arrow', name: 'Copper Arrow', skill: 'Fletching', category: 'item', type: 'ammo, Stab', level: 2, work: 'make', inputs: [{ id: 'oak_wood', name: 'Oak Wood', count: 1 }, { id: 'feather', name: 'Feather', count: 1 }, { id: 'copper_arrowheads', name: 'Copper Arrowheads', count: 40 }], seconds: 13.1, xp: 5, makes: 40 },
    { id: 'twine', name: 'Twine', skill: 'Crafting', category: 'item', level: 1, work: 'prepare', inputs: [{ id: 'flax', name: 'Flax', count: 2 }], seconds: 7.5, xp: 3, makes: 1 },
    { id: 'fishing_rod', name: 'Fishing Rod', skill: 'Crafting', category: 'item', type: 'tool', level: 3, work: 'make', inputs: [{ id: 'bamboo', name: 'Bamboo', count: 1 }, { id: 'copper_nails', name: 'Copper Nails', count: 1 }, { id: 'string', name: 'String', count: 1 }], seconds: 11.3, xp: 4, makes: 1 },
    { id: 'bait', name: 'Bait', skill: 'Fishing', category: 'item', type: 'bait', level: 1, work: 'make', inputs: [{ id: 'carp', name: 'Carp', count: 1 }, { id: 'worm', name: 'Worm', count: 1 }], seconds: 11.9, xp: 4, makes: 1 },
    { id: 'carp', name: 'Carp', skill: 'Fishing', category: 'item', level: 5, work: 'gather', inputs: [], seconds: 6.7, xp: 3, makes: 1 },
    { id: 'worm', name: 'Worm', skill: 'Farming', category: 'item', level: null, work: 'gather', why: 'No level of its own: gathered or found, no rule for it yet' },
    gather('flax_field', 'Flax Field', 'Farming', 4, 5.5, 2),
    gather('geode', 'Geode', 'Mining', 15, 7.4, 4),
    gather('pond', 'Pond', 'Fishing', 1, 5.6, 2),
    gather('copper_vein', 'Copper Vein', 'Mining', 1, 6, 2),
    gather('birch_tree', 'Birch Tree', 'Forestry', 20, 7.7, 3),
    { id: 'hut', name: 'Hut', skill: 'Construction', category: 'building', level: 1, work: null, why: 'Builds follow the one-off step rule; Construction XP has no rule yet' },
];

const runLive = (ws = liveWorkspace()) => writeLiveNumberPack(ws, liveRows(), { ids: liveIds(), catalogue: liveCatalogue(), id: 'test-live-corrections', createdAt: '2026-11-26T00:00:00Z' });
const timeOf = (e) => (e.kind === 'recipe' ? e.value.durationMs : e.value.config?.cycleTimeMs);

describe('live mode: the time pin', () => {
    it('pins every time it writes, beside the XP pin', () => {
        const { pack } = runLive();
        const timed = pack.entries.filter((e) => Number.isFinite(timeOf(e)));
        expect(timed.length).toBeGreaterThan(5);
        for (const e of timed) expect(e.value.sim, e.id).toMatchObject({ timePinned: true, xpPinned: true });
        expect(validatePack(pack, { fileName: 'test-live-corrections.json' })).toEqual({ ok: true });
    });
});

describe('live mode: output counts', () => {
    let byId;
    beforeAll(() => { byId = Object.fromEntries(runLive().pack.entries.map((e) => [e.id, e])); });

    it('leaves a gathering Token\'s outputs exactly as they are', () => {
        const ws = liveWorkspace();
        expect(byId.token_vein.value.config.outputs).toEqual(ws.tokens.token_vein.config.outputs);
        expect(byId.token_birch_tree.value.config.outputs).toEqual(ws.tokens.token_birch_tree.config.outputs);
        expect(byId.token_vein.value.config).toMatchObject({ cycleTimeMs: 6000, xp: 2, skillRequired: 1 });
    });

    it('leaves a crop\'s yield, its seed and its worm as they are', () => {
        const ws = liveWorkspace();
        expect(byId.recipe_flax.value.outputs).toEqual(ws.recipePools.farming[0].outputs);
        expect(byId.recipe_flax.value).toMatchObject({ levelRequirement: 4, durationMs: 5500, xp: 2, crop: { growMs: 3600000 } });
    });

    it('writes the owner\'s counts: 40 arrows a craft, 5 a work potion', () => {
        expect(byId.recipe_copper_arrow.value.outputs).toEqual([out1('item_copper_arrow', 40)]);
        expect(byId.recipe_copper_arrow.value.inputs).toEqual([{ itemId: 'item_oak_wood', quantity: 1 }, { itemId: 'item_feather', quantity: 1 }, { itemId: 'item_arrowheads', quantity: 40 }]);
        expect(byId.recipe_tonic.value.outputs).toEqual([out1('item_tonic', 5)]);
    });

    it('keeps a made thing\'s chance extra as it is', () => {
        expect(byId.recipe_twine.value.outputs).toEqual([out1('item_twine', 1), range('item_scrap', 1, 1, 10)]);
    });
});

describe('the owner\'s craft counts', () => {
    it('take the solver\'s count, and 5 for a work potion', () => {
        expect(ruledMakes({ makes: 40 })).toBe(40);
        expect(ruledMakes({ makes: 5, type: 'drink: Mining' })).toBe(5);
        expect(ruledMakes({ makes: 1, type: 'work: Fishing' })).toBe(5);
        expect(ruledMakes({ makes: 1, type: 'elixir' })).toBe(1);
        expect(ruledMakes({})).toBe(1);
    });
});

describe('live mode: a tree\'s rest', () => {
    it('is its Stump\'s regrowth at 30 s, the Stump\'s needs and the Forest\'s spawning as they are', () => {
        const ws = liveWorkspace();
        const { pack, restUnclear, stumps } = runLive(ws);
        const stump = pack.entries.find((e) => e.id === 'token_birch_stump');
        expect(stump).toMatchObject({ op: 'edit', kind: 'token' });
        expect(stump.value.grows).toEqual({ into: 'token_birch_tree', afterMs: 30000, needsNearby: ['token_birch_forest'] });
        expect(pack.entries.some((e) => e.id === 'token_birch_forest')).toBe(false);
        expect(restUnclear.some((r) => r.id === 'token_birch_tree')).toBe(false);
        expect(stumps).toEqual([{ id: 'token_birch_stump', name: 'Birch Stump', tree: 'Birch Tree', afterMs: 30000 }]);
        // 7.7 s a cycle: 25.7 % that it ends, so about 30 s of work.
        expect(pack.entries.find((e) => e.id === 'token_birch_tree').value.endChance).toBe(25.7);
    });

    it('is one Stump edit however many trees regrow into it', () => {
        const ws = liveWorkspace();
        ws.tokens.token_birch_twin = { ...ws.tokens.token_birch_tree, id: 'token_birch_twin', name: 'Birch Twin' };
        const ids = liveIds();
        ids.ids.birch_twin = { cms: 'token_birch_twin', how: 'live' };
        const catalogue = liveCatalogue();
        catalogue.entries.push({ id: 'birch_twin', name: 'Birch Twin', category: 'token', skill: 'Forestry', level: 21, gives: ['birch_wood'] });
        const rows = [...liveRows(), gather('birch_twin', 'Birch Twin', 'Forestry', 21, 7.8, 3)];
        const { pack } = writeLiveNumberPack(ws, rows, { ids, catalogue, id: 'x' });
        expect(pack.entries.filter((e) => e.id === 'token_birch_stump')).toHaveLength(1);
    });

    it('stays listed where the regrow has no growth to hold it', () => {
        const ws = { tokens: { token_stump: { id: 'token_stump', name: 'Bare Stump' } } };
        const terms = restTerms({ respawn: { mode: 'regrow', into: 'token_stump' } }, 6000, ws);
        expect(terms.stump).toBeUndefined();
        expect(terms.unclear).toMatch(/its rest not/);
    });
});

describe('live mode: the content session\'s answers', () => {
    let result;
    let byId;
    const reasonOf = (list, id) => list.find((x) => x.id === id)?.reason;
    beforeAll(() => {
        result = runLive();
        byId = Object.fromEntries(result.pack.entries.map((e) => [e.id, e]));
    });

    it('follows a build recipe to the Token it places, and skips it with the building\'s reason', () => {
        expect(byId.recipe_build_hut).toBeUndefined();
        expect(reasonOf(result.skipped, 'recipe_build_hut')).toMatch(/places Hut \(catalogue hut\): Builds follow the one-off step rule/);
    });

    it('follows a Dig recipe to its vein, and leaves the vein its own row', () => {
        expect(byId.recipe_dig_vein).toBeUndefined();
        expect(reasonOf(result.skipped, 'recipe_dig_vein')).toMatch(/places Copper Vein \(catalogue copper_vein\): builds follow the one-off step rule/);
        expect(byId.token_vein.value.config.cycleTimeMs).toBe(6000);
    });

    it('follows an offering to its shrine', () => {
        expect(byId.recipe_offer_wood).toBeUndefined();
        expect(reasonOf(result.skipped, 'recipe_offer_wood')).toMatch(/an offering at Nature Shrine, which has no catalogue entry/);
        expect(result.unclear.some((u) => u.id === 'recipe_offer_wood')).toBe(false);
    });

    it('times each Bait recipe by its own fish, its fish and its Bait a craft as they are', () => {
        const bait = byId.recipe_bait_from_carp.value;
        expect(bait).toMatchObject({ levelRequirement: 5, durationMs: 6700, xp: 3 });
        expect(bait.inputs).toEqual([{ itemId: 'item_carp', quantity: 1 }]);
        expect(bait.outputs).toEqual([out1('item_bait', 4)]);
        expect(byId.recipe_bait_from_carp.note).toMatch(/timed by its Carp/);
        // Its Worm has no level of its own, so that one is listed, and neither is a clash on the shared row.
        expect(reasonOf(result.unclear, 'recipe_bait_from_worm')).toMatch(/timed by its Worm, whose row has no numbers of its own/);
        expect(result.unclear.some((u) => /matched by/.test(u.reason))).toBe(false);
    });

    it('takes a chance-only Token as it is: the Geode', () => {
        const v = byId.token_geode.value;
        expect(v.config.outputs).toEqual(liveWorkspace().tokens.token_geode.config.outputs);
        expect(v.config).toMatchObject({ skillRequired: 15, cycleTimeMs: 7400, xp: 4 });
    });

    it('reads a water\'s catch off its fish, not its outputs', () => {
        const v = byId.token_pond.value;
        expect(v.config).toMatchObject({ cycleTimeMs: 5600, xp: 2, outputs: [] });
        expect(v.catchPools).toEqual(liveWorkspace().tokens.token_pond.catchPools);
    });

    it('numbers the fishing rod as it is: its ingredients and their counts untouched', () => {
        const rod = byId.recipe_fishing_rod.value;
        expect(rod).toMatchObject({ levelRequirement: 3, durationMs: 11300, xp: 4 });
        expect(rod.inputs).toEqual(liveWorkspace().recipePools.crafting[1].inputs);
        expect(byId.recipe_fishing_rod.note).toMatch(/its ingredients as they are/);
    });
});

describe('live mode: round trip', () => {
    it('every time the pack writes survives Recalculate and Sync', () => {
        const ws = liveWorkspace();
        const { pack } = runLive(ws);
        let accepted = ws;
        for (const e of pack.entries) {
            expect(entryConflict(accepted, e).conflict).toBe(false);
            accepted = { ...accepted, ...setValue(accepted, e.kind, e.id, proposedValue(e)) };
        }
        useEntityStore.getState().hydrate(accepted);
        const files = JSON.parse(JSON.stringify(syncFiles(useEntityStore.getState().recalculateEconomy({}))));
        const synced = (e) => (e.kind === 'recipe' ? files['tokenRecipes.json'].find((r) => r.id === e.id)?.durationMs : files['tokens.json'][e.id]?.config?.cycleTimeMs);
        const timed = pack.entries.filter((e) => Number.isFinite(timeOf(e)));
        expect(timed.map((e) => `${e.id} ${synced(e)}`)).toEqual(timed.map((e) => `${e.id} ${timeOf(e)}`));
        expect(files['tokens.json'].token_birch_stump.grows.afterMs).toBe(30000);
    });
});

// === Planned mode ============================================================

const planned = (extra) => ({ status: 'planned', tier: 2, note: 'fixture', ...extra });
const plannedWorkspace = () => ({
    items: {
        item_ore: { id: 'item_ore', name: 'Ore', type: 'material', plan: live },
        item_gem: { id: 'item_gem', name: 'Gem', type: 'material', plan: live },
        item_herb: { id: 'item_herb', name: 'Herb', type: 'material', plan: live },
        item_seed: { id: 'item_seed', name: 'Seed', type: 'material', plan: live },
        item_wood: { id: 'item_wood', name: 'Wood', type: 'material', plan: live },
        item_draught: { id: 'item_draught', name: 'Angler\'s Draught', type: 'potion', plan: planned({ catalogueId: 'anglers_draught', skill: 'alchemy', level: 30, madeWith: ['item_herb'] }) },
    },
    tokens: {
        // Its outputs already written: they stay as they are.
        token_deep_vein: {
            id: 'token_deep_vein', name: 'Deep Vein', uses: 5, respawn: { mode: 'refill', afterMs: 90000 },
            config: { skill: 'mining', outputs: [range('item_ore', 2, 4), range('item_gem', 1, 1, 5)] },
            plan: planned({ catalogueId: 'deep_vein', skill: 'mining', level: 30, gives: ['item_ore'] }),
        },
        token_herb_patch: { id: 'token_herb_patch', name: 'Herb Patch', plan: planned({ catalogueId: 'herb_patch', skill: 'farming', level: 30, gives: ['item_herb'] }) },
        token_ash_tree: { id: 'token_ash_tree', name: 'Ash Tree', uses: 5, respawn: { mode: 'regrow', into: 'token_ash_stump' }, plan: planned({ catalogueId: 'ash_tree', skill: 'forestry', level: 30, gives: ['item_wood'] }) },
        token_ash_stump: { id: 'token_ash_stump', name: 'Ash Stump', config: null, grows: { into: 'token_ash_tree', afterMs: 600000, needsNearby: ['token_ash_forest'] }, plan: planned({}) },
        // Its Stump is Live: a Planned pack must not reach it.
        token_elm_tree: { id: 'token_elm_tree', name: 'Elm Tree', uses: 5, respawn: { mode: 'regrow', into: 'token_elm_stump' }, plan: planned({ catalogueId: 'elm_tree', skill: 'forestry', level: 31, gives: ['item_wood'] }) },
        token_elm_stump: { id: 'token_elm_stump', name: 'Elm Stump', config: null, grows: { into: 'token_elm_tree', afterMs: 600000 }, plan: live },
    },
    effects: {},
    recipePools: {
        farming: [{ id: 'recipe_herb_bed', name: 'Herb Bed', skill: 'farming', inputs: [{ itemId: 'item_seed', quantity: 1 }], plan: planned({ catalogueId: 'herb_bed', skill: 'farming', level: 32, gives: ['item_herb', 'item_seed'], split: [{ itemId: 'item_herb', share: 2 }, { itemId: 'item_seed', share: 0.4 }] }) }],
    },
});
const plannedRows = () => [
    { id: 'anglers_draught', name: 'Angler\'s Draught', skill: 'Alchemy', category: 'item', type: 'work: Fishing', planned: 30, level: 30, work: 'make', inputs: [{ id: 'herb', name: 'Herb', count: 1 }], seconds: 15, xp: 12, makes: 1 },
    { ...gather('deep_vein', 'Deep Vein', 'Mining', 30, 7, 5), planned: 30 },
    { ...gather('herb_patch', 'Herb Patch', 'Farming', 30, 7, 5), planned: 30 },
    { ...gather('ash_tree', 'Ash Tree', 'Forestry', 30, 7.5, 5), planned: 30 },
    { ...gather('elm_tree', 'Elm Tree', 'Forestry', 31, 7.5, 5), planned: 31 },
    { ...gather('herb_bed', 'Herb Bed', 'Farming', 32, 7.6, 5), planned: 32 },
];

describe('Planned mode', () => {
    let result;
    let byId;
    beforeAll(() => {
        result = writeNumberPack(plannedWorkspace(), plannedRows(), { id: 'test-planned-corrections', createdAt: '2026-11-26T00:00:00Z' });
        byId = Object.fromEntries(result.pack.entries.map((e) => [e.id, e]));
    });

    it('pins every time it writes', () => {
        const timed = result.pack.entries.filter((e) => Number.isFinite(timeOf(e)));
        expect(timed.map((e) => e.id).sort()).toEqual(['recipe_draught', 'recipe_herb_bed', 'token_ash_tree', 'token_deep_vein', 'token_elm_tree', 'token_herb_patch']);
        for (const e of timed) expect(e.value.sim, e.id).toMatchObject({ timePinned: true });
    });

    it('leaves a gathering Token\'s written outputs as they are, and gives a new one a line of 1', () => {
        expect(byId.token_deep_vein.value.config.outputs).toEqual(plannedWorkspace().tokens.token_deep_vein.config.outputs);
        expect(byId.token_herb_patch.value.config.outputs).toEqual([out1('item_herb', 1)]);
    });

    it('makes 5 a work potion craft', () => {
        expect(byId.recipe_draught.value.outputs).toEqual([out1('item_draught', 5)]);
        expect(result.filled.find((x) => x.id === 'item_draught').makes).toBe(5);
    });

    it('writes a crop\'s plan.split as shares', () => {
        expect(byId.recipe_herb_bed.value.outputs).toEqual([out1('item_herb', 2), { ...out1('item_seed', 1), chance: 40 }]);
    });

    it('gives a Planned Stump its tree\'s rest, and never a Live one', () => {
        expect(byId.token_ash_stump.value.grows).toEqual({ into: 'token_ash_tree', afterMs: 30000, needsNearby: ['token_ash_forest'] });
        expect(byId.token_elm_stump).toBeUndefined();
        expect(result.restUnclear.find((r) => r.id === 'token_elm_tree').reason).toMatch(/Stump token_elm_stump is not Planned/);
        for (const e of result.pack.entries) expect(e.value.plan.status, e.id).toBe('planned');
    });
});
