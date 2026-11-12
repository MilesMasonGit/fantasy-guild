import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as OutputRules from '../systems/board/OutputRules.js';
import * as Fields from '../systems/board/Fields.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as HallRules from '../systems/progression/HallRules.js';
import { effectBreakdown, EFFECT_KEY, UNIT } from '../systems/board/EffectBreakdown.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { hallRuleSentence, starSentence } from '../systems/progression/hallStarText.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword, makeStatement } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { isGatheringSkill, getAllSkillIds, getSkill, SKILL_TRADES } from '../config/registries/skillRegistry.js';
import { HALL_NODE, getUpgradeDef } from '../config/guildUpgrades.js';
import { getPaletteEntry, bucketsFor, MODIFIER_SHAPES } from '../config/registries/modifierPalette.js';
import { resetMatTuning } from '../config/matTuning.js';
import { supportTag } from '../ui/components/board/supportTags.js';
import { EFFECT_GLYPH } from '../ui/components/board/effectBadgeText.js';
import { GLYPHS } from '../ui/components/base/PixelGlyph.jsx';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';
import { buildRateBook } from '../../cms/src/engine/ledger/rates.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

withoutShippedPerks();

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Giant Harvest (brief 620 E1): a chance a gathering cycle's drops come in at ten times. Every drop
 * of the cycle, the rare table's find included; with Double Loot too, both apply (twenty times). A
 * gathering cycle is one whose work skill is a gathering skill (Mining, Forestry, Fishing, Farming);
 * any other work never rolls it. A failed cycle rolls nothing, and no rule means no draw.
 */

const ORE = 'fixture_gh_ore';
const GEM = 'fixture_gh_gem';
const LOG = 'fixture_gh_log';
const BAR = 'fixture_gh_bar';
const SEED = 'fixture_gh_seed';
const WHEAT = 'fixture_gh_wheat';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({
    [ORE]: item(ORE, 'GH Ore'), [GEM]: item(GEM, 'GH Gem'), [LOG]: item(LOG, 'GH Log'), [BAR]: item(BAR, 'GH Bar'),
    [SEED]: item(SEED, 'GH Seed'), [WHEAT]: item(WHEAT, 'GH Wheat')
});
const WHEAT_RECIPE = 'gh_recipe_wheat';
registerRecipePools({
    farming: [{
        id: WHEAT_RECIPE, name: 'GH Wheat', levelRequirement: 1, durationMs: 1000, xp: 2, stationKinds: ['field'],
        inputs: [{ itemId: SEED, quantity: 1 }],
        outputs: [{ itemId: WHEAT, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 20000, load: 3 }
    }]
});

const work = (id, skill, itemId, extra = {}) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
    tags: ['GhWork'], requiresHero: true,
    config: { skill, skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId, chance: 100, minQty: 1, maxQty: 1 }] },
    ...extra
});
let stm = 0;
const provides = (to, type, value, extra = {}) => ({
    id: `stm_gh_${++stm}`, keyword: 'provides', to, reach: 'nearby',
    payload: { type, bucket: 'flat', value, ...extra }
});
const building = (id, statements) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false, statements
});
const ALL = { mode: 'all' };

registerTokenTypes({
    gh_vein: work('gh_vein', 'mining', ORE),
    gh_rare_vein: work('gh_rare_vein', 'mining', ORE, { rareTable: { chance: 100, entries: [{ itemId: GEM, weight: 1, minQty: 1, maxQty: 1 }] } }),
    gh_tree: work('gh_tree', 'forestry', LOG),
    gh_anvil: work('gh_anvil', 'smithing', BAR),
    gh_looter: building('gh_looter', [provides(ALL, EFFECT_TYPES.LOOT_MULT, 100)]),
    gh_jinx: building('gh_jinx', [provides(ALL, EFFECT_TYPES.FAIL_CHANCE, 100)]),
    gh_giant_well: building('gh_giant_well', [provides(ALL, EFFECT_TYPES.GIANT_HARVEST, 100)]),
    gh_field: {
        id: 'gh_field', name: 'GH Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_farmland',
        requiresHero: true, field: {},
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_gh_field', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
    }
});

/** A Hall star, rank 1 held, giving Giant Harvest `value` %, guild-wide unless `to` aims it. */
function holdStar(value, { to = null, category } = {}) {
    registerHallSky({
        constellations: { gh: { id: 'gh', name: 'Giant', label: { x: 1, y: 0 } } },
        stars: {
            gh_star: {
                id: 'gh_star', constellation: 'gh', name: 'Giant Seams', node: { x: 0.7, y: 0 }, links: [HALL_NODE],
                ranks: [{ tier: 1, price: [], lines: [], rules: [starRule(value, { to, category })] }]
            }
        }
    });
    GuildUpgradeManager.getRanks().gh_star = 1;
    GuildUpgradeManager.recompute();
}

function starRule(value, { to = null, category } = {}) {
    return {
        id: 'stm_gh_star', keyword: KEYWORD.PROVIDES, chargeDelta: 0, reach: 'board', target: null, when: null, upkeep: null,
        to: to || { mode: 'all', value: '' },
        payload: { type: EFFECT_TYPES.GIANT_HARVEST, bucket: 'flat', value, ...(category ? { category } : {}) }
    };
}

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 10, skills: out, hp: { current: 100, max: 100 } };
}

function put(typeId, at) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, at);
    expect(res?.success, res?.reason).not.toBe(false);
    TileModifiers.rebuildAround([instance]);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const AT = { x: 800, y: 500 };
const BESIDE = { x: 940, y: 500 };
const BELOW = { x: 800, y: 640 };

/** All of `itemId` the work has made: on the floor and already in the Bank. */
const made = (itemId) => SpriteLayer.countOnBoard(itemId) + InventoryManager.getItemCount(itemId);

/** Counts a Token's cycles and its Giant Harvest celebrations. */
function watch(instanceId) {
    const seen = { cycles: 0, failed: 0, giants: [] };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (e) => {
            if (e.instanceId !== instanceId) return;
            seen.cycles += 1;
            if (e.failed) seen.failed += 1;
        }),
        EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (e) => { if (e.giant) seen.giants.push(e); })
    ];
    seen.off = () => offs.forEach(off => off?.());
    return seen;
}

/** The worker on Token `typeId` at AT, with whatever stands beside and below it. */
function scene(typeId, ...beside) {
    const v = put(typeId, AT);
    [BESIDE, BELOW].forEach((at, i) => { if (beside[i]) put(beside[i], at); });
    expect(Orders.orderAt('worker', AT).success).toBe(true);
    return v;
}

/** Three cycles of `typeId`: the cycles seen and the `Math.random` draws they made. */
function threeCycles(typeId, ...beside) {
    const v = scene(typeId, ...beside);
    const seen = watch(v.id);
    const spy = vi.spyOn(Math, 'random');
    run(3200);
    const draws = spy.mock.calls.length;
    spy.mockRestore();
    seen.off();
    return { v, seen, draws };
}

/** Back to an empty board and the worker, for a second scene in one test. */
function fresh() {
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.clearAll();
    SpriteLayer.init();
    BoardRunner.init();
    GameState.state.heroes = [hero('worker', { mining: 10, forestry: 10, smithing: 10, farming: 10 })];
    GameState.state.inventory.maxSlots = 50;
}

beforeAll(() => { Flags.init(); TimedChanges.init(); });
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    Flags.init();
    fresh();
});

afterEach(() => {
    registerHallSky(null);
    HallRules.apply({});
    vi.restoreAllMocks();
    EventBus.setQuiet(false);
});

describe('Giant Harvest from a Hall star', () => {
    it('at 100 %, every mining cycle drops ten times what it would', () => {
        holdStar(100);
        const { seen } = threeCycles('gh_vein');
        expect(seen.cycles).toBe(3);
        expect(made(ORE)).toBe(30);
    });

    it('at 0 %, every cycle drops what it always did', () => {
        holdStar(0);
        const { seen } = threeCycles('gh_vein');
        expect(seen.cycles).toBe(3);
        expect(made(ORE)).toBe(3);
    });

    it('narrowed to Mining it reaches the vein; narrowed to Forestry it does not', () => {
        holdStar(100, { category: 'mining' });
        threeCycles('gh_vein');
        expect(made(ORE)).toBe(30);

        fresh();
        holdStar(100, { category: 'forestry' });
        threeCycles('gh_vein');
        expect(made(ORE)).toBe(3);
    });

    it('aimed at another Token, it leaves the vein alone', () => {
        holdStar(100, { to: { mode: 'id', value: 'gh_tree' } });
        threeCycles('gh_vein');
        expect(made(ORE)).toBe(3);
    });

    it('from a building\'s nearby rule too', () => {
        threeCycles('gh_vein', 'gh_giant_well');
        expect(made(ORE)).toBe(30);
    });
});

describe('every drop of the cycle', () => {
    it('the rare table\'s find comes in at ten times as well', () => {
        holdStar(100);
        const { seen } = threeCycles('gh_rare_vein');
        expect(seen.cycles).toBe(3);
        expect(made(ORE)).toBe(30);
        expect(made(GEM)).toBe(30);
    });

    it('with Double Loot too, both apply: twenty times, the rare find included', () => {
        holdStar(100);
        const { seen } = threeCycles('gh_rare_vein', 'gh_looter');
        expect(seen.cycles).toBe(3);
        expect(made(ORE)).toBe(60);
        expect(made(GEM)).toBe(60);
    });

    it('Double Loot alone still doubles, so the twenty is ten on top of it', () => {
        const { seen } = threeCycles('gh_rare_vein', 'gh_looter');
        expect(seen.cycles).toBe(3);
        expect(made(ORE)).toBe(6);
        expect(made(GEM)).toBe(6);
    });
});

describe('only gathering work rolls it', () => {
    it('the gathering skills are Mining, Forestry, Fishing and Farming, read off the registry', () => {
        expect(['mining', 'forestry', 'fishing', 'farming'].every(isGatheringSkill)).toBe(true);
        expect(['smithing', 'crafting', 'cooking', 'alchemy', 'construction', 'melee', 'taming', '', null, 'not_a_skill']
            .some(isGatheringSkill)).toBe(false);
        expect(getAllSkillIds().filter(isGatheringSkill))
            .toEqual(getAllSkillIds().filter(id => getSkill(id).trade === SKILL_TRADES.GATHERING));
    });

    it('a forestry cycle is a gathering cycle: ten times the logs', () => {
        holdStar(100);
        threeCycles('gh_tree');
        expect(made(LOG)).toBe(30);
    });

    it('a Field\'s harvest is a gathering cycle: each harvest of its load comes in at ten times', () => {
        holdStar(100, { category: 'farming' });
        InventoryManager.addItem(SEED, 1);
        const field = put('gh_field', AT);
        expect(StationRecipe.setSelectedRecipe(field, WHEAT_RECIPE)).toBe(true);
        run(20200);
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.RIPE);
        expect(Orders.orderAt('worker', AT).success).toBe(true);
        const seen = watch(field.id);
        run(2100);
        seen.off();
        expect(seen.cycles).toBe(2);
        expect(made(WHEAT)).toBe(20);
        expect(seen.giants).toHaveLength(2);
    });

    it('a smithing cycle never rolls it, from a guild-wide star or one narrowed to Smithing, and draws nothing for it', () => {
        const plain = threeCycles('gh_anvil');
        expect(plain.seen.cycles).toBe(3);
        expect(made(BAR)).toBe(3);

        for (const category of [undefined, 'smithing']) {
            fresh();
            holdStar(100, { category });
            const starred = threeCycles('gh_anvil');
            expect(starred.seen.cycles).toBe(3);
            expect(starred.seen.giants).toHaveLength(0);
            expect(made(BAR)).toBe(3);
            expect(starred.draws).toBe(plain.draws);
        }
    });

    it('the roll itself refuses a skill that is not gathering before reading any rule', () => {
        const random = vi.spyOn(Math, 'random');
        expect(OutputRules.rollGiantHarvest('no_such_token', 'smithing')).toBe(false);
        expect(random).not.toHaveBeenCalled();
    });
});

describe('⚠️ no rule, no draw', () => {
    it('the roll on gathering work draws nothing with no rule or one at 0 %, and once at 100 %', () => {
        const v = put('gh_vein', AT);
        const random = vi.spyOn(Math, 'random');
        expect(OutputRules.rollGiantHarvest(v.id, 'mining')).toBe(false);
        expect(random).not.toHaveBeenCalled();
        holdStar(0);
        expect(OutputRules.rollGiantHarvest(v.id, 'mining')).toBe(false);
        expect(random).not.toHaveBeenCalled();
        holdStar(100);
        expect(OutputRules.rollGiantHarvest(v.id, 'mining')).toBe(true);
        expect(random).toHaveBeenCalledTimes(1);
    });

    it('no rule, or a rule at 0 %, draws nothing for it; at 100 % it draws once a cycle', () => {
        const none = threeCycles('gh_vein').draws;
        fresh();
        holdStar(0);
        expect(threeCycles('gh_vein').draws).toBe(none);
        fresh();
        holdStar(100);
        expect(threeCycles('gh_vein').draws).toBe(none + 3);
    });

    it('a failed cycle rolls nothing: no find, nothing dropped and not one draw for it', () => {
        const jinxed = threeCycles('gh_vein', 'gh_jinx');
        expect(jinxed.seen.failed).toBe(3);
        fresh();
        holdStar(100);
        const starred = threeCycles('gh_vein', 'gh_jinx');
        expect(starred.seen.failed).toBe(3);
        expect(starred.draws).toBe(jinxed.draws);
        expect(starred.seen.giants).toHaveLength(0);
        expect(made(ORE)).toBe(0);
    });
});

describe('the celebration on the mat', () => {
    it('each hit says so once over its Token (the mat draws the burst and the "Giant!" float); a miss says nothing', () => {
        holdStar(100);
        const { v, seen } = threeCycles('gh_vein');
        expect(seen.giants).toEqual([{ instanceId: v.id, giant: true }, { instanceId: v.id, giant: true }, { instanceId: v.id, giant: true }]);

        fresh();
        holdStar(0);
        expect(threeCycles('gh_vein').seen.giants).toHaveLength(0);
    });

    it('a catch-up (a quiet bus) celebrates nothing, and still drops ten times', () => {
        holdStar(100);
        EventBus.setQuiet(true);
        const { seen } = threeCycles('gh_vein');
        EventBus.setQuiet(false);
        expect(seen.giants).toHaveLength(0);
        expect(made(ORE)).toBe(30);
    });
});

describe('the badge on the Token card', () => {
    it('a Hall star\'s Giant Harvest shows on a gathering Token as a chance, with the star as its source', () => {
        holdStar(25);
        const vein = put('gh_vein', AT);
        const badge = effectBreakdown(vein.id).effects.find(b => b.key === EFFECT_KEY.GIANT_HARVEST);
        expect(badge).toMatchObject({ name: 'Giant Harvest', unit: UNIT.CHANCE, total: 25, counted: 25, held: false });
        expect(badge.sources.map(s => [s.kind, s.name, s.amount])).toEqual([['star', 'Hall star Giant Seams I', 25]]);
    });

    it('follows UI_STYLE\'s order: after Lucky, before Abundance', () => {
        const keys = Object.values(EFFECT_KEY);
        expect(keys.indexOf(EFFECT_KEY.GIANT_HARVEST)).toBe(keys.indexOf(EFFECT_KEY.LUCKY) + 1);
    });

    it('no badge on work that is not gathering, nor at 0 %', () => {
        holdStar(25);
        const anvil = put('gh_anvil', AT);
        expect(effectBreakdown(anvil.id).effects.find(b => b.key === EFFECT_KEY.GIANT_HARVEST)).toBeUndefined();
        holdStar(0);
        const vein = put('gh_vein', BELOW);
        expect(effectBreakdown(vein.id).effects.find(b => b.key === EFFECT_KEY.GIANT_HARVEST)).toBeUndefined();
    });

    it('has a placeholder icon', () => {
        expect(GLYPHS[EFFECT_GLYPH[EFFECT_KEY.GIANT_HARVEST]]).toBeDefined();
    });
});

describe('in the CMS and the rules text', () => {
    it('is offered as Giant Harvest, a flat percent chance narrowed by skill, with the owner\'s words', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.GIANT_HARVEST);
        expect(entry).toMatchObject({ label: 'Giant Harvest', shape: MODIFIER_SHAPES.PROC, categories: 'skill', skillTrade: SKILL_TRADES.GATHERING });
        expect(bucketsFor(entry)).toEqual(['flat']);
        expect(entry.hint).toMatch(/^A chance a gathering cycle's drops come in at ten times/);
        expect(paletteForKeyword(KEYWORD.PROVIDES).some(p => p.type === EFFECT_TYPES.GIANT_HARVEST)).toBe(true);
    });

    it('its "only for" picker offers the gathering skills alone', () => {
        const statement = { ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.GIANT_HARVEST, bucket: 'flat', value: 1 } };
        const only = slotsOf(statement).find(s => s.id === 'category');
        expect(only.options.map(o => o.id)).toEqual(['', ...getAllSkillIds().filter(isGatheringSkill)]);
        expect(only.options[0].label).toBe('Any gathering skill');
    });

    it('reads in plain words on a Token, on a hero, as a support\'s tag and on a Hall star', () => {
        const rule = (value, extra = {}) => ({ id: 's', keyword: 'provides', to: ALL, reach: 'nearby', payload: { type: EFFECT_TYPES.GIANT_HARVEST, bucket: 'flat', value, ...extra } });
        expect(renderStatement(rule(2, { category: 'mining' })))
            .toBe('Makes every nearby Token have a 2% chance a gathering cycle\'s drops come in at ten times, but only for Mining work.');
        expect(renderStatement(rule(-1))).toBe('Makes every nearby Token have 1% less chance a gathering cycle\'s drops come in at ten times.');
        expect(renderStatement(rule(2), { carried: true })).toBe('Gives the hero a 2% chance a gathering cycle\'s drops come in at ten times.');
        expect(supportTag({ type: EFFECT_TYPES.GIANT_HARVEST, bucket: 'flat', value: 2 })).toBe('+2 % Giant Harvest');
        expect(hallRuleSentence(starRule(1, { category: 'mining' })))
            .toBe('Makes every Token on the board have a 1% chance a gathering cycle\'s drops come in at ten times, but only for Mining work.');
        holdStar(1, { category: 'mining' });
        expect(starSentence(getUpgradeDef('gh_star'))).toBe('Every Mining Token has a chance a gathering cycle\'s drops come in at ten times.');
    });
});

describe('the CMS rate calculator', () => {
    const content = (extraTokens = {}) => ({
        tokens: {
            lr_vein: work('lr_vein', 'mining', ORE, { rareTable: { chance: 10, entries: [{ itemId: GEM, weight: 1, minQty: 1, maxQty: 1 }] } }),
            lr_anvil: work('lr_anvil', 'smithing', BAR),
            lr_giant: building('lr_giant', [provides(ALL, EFFECT_TYPES.GIANT_HARVEST, 10)]),
            lr_looter: building('lr_looter', [provides(ALL, EFFECT_TYPES.LOOT_MULT, 50)]),
            ...extraTokens
        },
        items: Object.fromEntries([ORE, GEM, BAR].map(id => [id, { id, name: id, type: 'material', stackable: true, equipSlot: '' }])),
        recipes: [], effects: {}, starterCamp: { tokens: [] }
    });

    it('counts a gathering cycle\'s drops at 1 + 9 × the chance, the rare finds too, beside Double Loot', () => {
        const book = buildRateBook(content());
        const plain = book.rateOf({ token: 'lr_vein' });
        const giant = book.rateOf({ token: 'lr_vein' }, { supports: ['lr_giant'] });
        // 10 % at ten times: 1.9 times as much on average.
        expect(giant.items[ORE] / plain.items[ORE]).toBeCloseTo(1.9, 9);
        expect(giant.items[GEM] / plain.items[GEM]).toBeCloseTo(1.9, 9);
        expect(giant.unmodelled.some(u => u.what === EFFECT_TYPES.GIANT_HARVEST)).toBe(false);
        // With Double Loot at 50 %: 1.5 × 1.9.
        const both = book.rateOf({ token: 'lr_vein' }, { supports: ['lr_giant', 'lr_looter'] });
        expect(both.items[ORE] / plain.items[ORE]).toBeCloseTo(1.5 * 1.9, 9);
    });

    it('leaves work that is not gathering as it was', () => {
        const book = buildRateBook(content());
        const plain = book.rateOf({ token: 'lr_anvil' });
        const giant = book.rateOf({ token: 'lr_anvil' }, { supports: ['lr_giant'] });
        expect(giant.items[BAR]).toBeCloseTo(plain.items[BAR], 9);
    });
});
