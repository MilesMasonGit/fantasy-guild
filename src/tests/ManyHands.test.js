import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as SecondRecipe from '../systems/board/SecondRecipe.js';
import * as Summons from '../systems/board/Summons.js';
import { ALERT, BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes, getTokenType as getDef } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Many Hands (brief 800 P3, Crafting 99), as the owner ruled it (2026-11-25): a crafting station
 * worked by a hero holding it runs a second chosen recipe beside the first, each on its own clock with
 * its own materials (1); only while that station's own hero holds it (2); never the same recipe as
 * the first (3); when one is short of materials the other carries on, the red mark naming the first's
 * problem and the card the second's (4); the second's progress on its own stream, never the mat's (5);
 * making stations with a recipe list only, narrowed by the effect's skill (6). With no second recipe
 * running, the first runs and draws exactly as before. Every Token, item, recipe and effect here is a
 * fixture.
 */

const material = (id) => ({ id, name: id, type: 'material', stackable: true, equipSlot: '', sprite: 'i_bones' });
registerItems({
    mh_wood: material('mh_wood'), mh_hide: material('mh_hide'), mh_charcoal: material('mh_charcoal'),
    mh_leather: material('mh_leather'), mh_rope: material('mh_rope'), mh_bar: material('mh_bar'), mh_blade: material('mh_blade')
});

const recipe = (id, input, output, durationMs, xp, extra = {}) => ({
    id, name: id, levelRequirement: 1, requiresContext: [], durationMs, xp,
    inputs: input ? [{ itemId: input, quantity: 1 }] : [],
    outputs: [{ itemId: output, chance: 100, minQty: 1, maxQty: 1 }], ...extra
});
const CHARCOAL = 'mh_recipe_charcoal';
const LEATHER = 'mh_recipe_leather';
const ROPE = 'mh_recipe_rope';
const MASTERWORK = 'mh_recipe_masterwork';
const BLADE = 'mh_recipe_blade';
registerRecipePools({
    crafting: [
        recipe(CHARCOAL, 'mh_wood', 'mh_charcoal', 1000, 1),
        recipe(LEATHER, 'mh_hide', 'mh_leather', 1500, 2),
        recipe(ROPE, null, 'mh_rope', 1200, 1),
        recipe(MASTERWORK, null, 'mh_rope', 1000, 1, { levelRequirement: 99 })
    ],
    smithing: [recipe(BLADE, 'mh_bar', 'mh_blade', 1000, 1), recipe('mh_recipe_blade_two', null, 'mh_blade', 1500, 1)]
});

const works = (skill) => [{ id: `stm_mh_${skill}_station`, keyword: KEYWORD.STATION, payload: { skill } }];
const station = (id, skill, extra = {}) => ({
    id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_industry', requiresHero: true,
    config: { skill, skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
    statements: works(skill), ...extra
});
const second = (value = 1, category = 'crafting') => ({
    id: 'stm_mh_second', keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
    payload: { type: EFFECT_TYPES.SECOND_RECIPE, bucket: 'flat', value, ...(category ? { category } : {}) }
});
registerTokenTypes({
    mh_bench: station('mh_bench', 'crafting'),
    mh_forge: station('mh_forge', 'smithing'),
    mh_banner: {
        id: 'mh_banner', name: 'MH Banner', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: false, statements: [second()]
    },
    mh_echo_stone: {
        id: 'mh_echo_stone', name: 'MH Echo Stone', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: false,
        statements: [{ id: 'stm_mh_echo', keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby', payload: { type: EFFECT_TYPES.ECHO, bucket: 'flat', value: 100 } }]
    },
    // The kinds of station that never take a second recipe.
    mh_foundation: { id: 'mh_foundation', name: 'MH Foundation', tokenType: 'structure', rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_industry', foundation: { kind: 'mh_kind', skill: 'construction' } },
    mh_field: station('mh_field', 'crafting', { field: { startsWith: CHARCOAL } }),
    mh_shrine: station('mh_shrine', 'crafting', { shrine: { maxLitMs: 60000 } }),
    mh_water: station('mh_water', 'crafting', { tags: ['water'], catchPools: [{ tool: 'fishing_rod', catches: [{ itemId: 'mh_rope', weight: 1 }] }] }),
    mh_circle: station('mh_circle', 'summoning', { summonCircle: { charges: 3, perLevel: 0 } }),
    mh_summoned_crafter: {
        id: 'mh_summoned_crafter', name: 'Summoned MH Crafter', rarity: 'common', theme: 'fixture', sprite: 's_occult',
        summon: { of: 'mh_slime', skills: { crafting: 99 }, trait: { effectId: 'mh_many_hands', scale: 1 } }
    },
    mh_slime: {
        id: 'mh_slime', name: 'MH Slime', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 5, sprite: 's_occult',
        enemy: { level: 1, style: 'melee' }, config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }
});
registerRecipePools({
    summoning: [{
        id: 'mh_recipe_call', name: 'Call', levelRequirement: 1, requiresContext: [], durationMs: 1000, xp: 0, inputs: [],
        outputs: [{ tokenId: 'mh_summoned_crafter', chance: 100, minQty: 1, maxQty: 1 }]
    }]
});

registerEffects({
    mh_many_hands: { id: 'mh_many_hands', name: 'Many Hands', statements: [second()] },
    mh_many_hands_any: { id: 'mh_many_hands_any', name: 'Many Hands (any skill)', statements: [second(1, null)] }
});

const PERK = { crafting: { perks: [{ level: 99, effectId: 'mh_many_hands' }] } };

function hero(id, crafting, smithing = 1) {
    return {
        id, name: id, status: 'idle', level: 10, hp: { current: 100, max: 100 },
        skills: { crafting: { level: crafting, xp: 0 }, smithing: { level: smithing, xp: 0 } }
    };
}

const AT = { x: 800, y: 500 };
const FAR = { x: 1500, y: 900 };

beforeAll(() => { Flags.init(); TimedChanges.init(); });
afterAll(() => {
    registerSkillPerks({ crafting: { perks: [] }, smithing: { perks: [] } });
    Flags.teardown();
});
afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
    vi.clearAllMocks();
    registerSkillPerks(PERK);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [hero('master', 99, 99), hero('novice', 50)];
    GameState.state.inventory.maxSlots = 50;
});

function run(ms, step = 100) {
    for (let t = 0; t < ms; t += step) BoardRunner.tick(step);
}
function runUntil(done, ms) {
    for (let t = 0; t < ms; t += 100) {
        if (done()) return true;
        BoardRunner.tick(100);
    }
    return done();
}

/** A station of `typeId` at the work spot, set to `first` and `secondId`, worked by `heroId`. */
function worked(heroId, { typeId = 'mh_bench', first = CHARCOAL, secondId = LEATHER, at = AT } = {}) {
    const token = placeAt(typeId, at.x, at.y);
    StationRecipe.setSelectedRecipe(token, first);
    if (secondId) expect(StationRecipe.setSecondRecipe(token, secondId)).toBe(true);
    TileModifiers.rebuildAround([at]);
    if (heroId) {
        Orders.orderAt(heroId, at);
        expect(runUntil(() => BoardState.workerOf(token.id) === heroId, 3000)).toBe(true);
    }
    return token;
}

/** Every cycle the station finishes, by lane, with what it made. */
function cycles(instanceId) {
    const seen = { first: [], second: [] };
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
        if (p.instanceId !== instanceId) return;
        (p.lane === StationRecipe.LANE.SECOND ? seen.second : seen.first).push(p.produced.slice());
    });
    return { seen, off };
}

const made = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);
const stock = (items) => { for (const [id, n] of Object.entries(items)) InventoryManager.addItem(id, n); };

describe('ruling 1: two lanes, each with its own cycle and materials', () => {
    it('the station runs its second recipe beside the first, on its own clock', () => {
        stock({ mh_wood: 50, mh_hide: 50 });
        const bench = worked('master');
        const { seen, off } = cycles(bench.id);
        run(6000);
        off();
        // Charcoal every second, Leather every second and a half, side by side.
        expect(seen.first.length).toBe(6);
        expect(seen.second.length).toBe(4);
        expect(seen.first.every(p => p.join() === 'mh_charcoal')).toBe(true);
        expect(seen.second.every(p => p.join() === 'mh_leather')).toBe(true);
        expect(made('mh_charcoal')).toBe(6);
        expect(made('mh_leather')).toBe(4);
        // Each pays its own materials.
        expect(InventoryManager.getItemCount('mh_wood')).toBe(50 - 6);
        expect(InventoryManager.getItemCount('mh_hide')).toBe(50 - 4);
        // And teaches its own XP: 6 × 1 and 4 × 2.
        expect(GameState.state.heroes[0].skills.crafting.xp).toBe(6 + 8);
    });

    it('each lane keeps its own progress', () => {
        stock({ mh_wood: 50, mh_hide: 50 });
        const bench = worked('master');
        const start = { first: bench.cycleElapsedMs || 0, second: bench.secondElapsedMs || 0 };
        run(700);
        expect(bench.cycleElapsedMs - start.first).toBe(700);
        expect(bench.secondElapsedMs - start.second).toBe(700);
        run(500);
        // The first finished at 1000 and is 200 into its next; the second is still on its first.
        expect(bench.cycleElapsedMs).toBe((start.first + 1200) % 1000);
        expect(bench.secondElapsedMs).toBe(start.second + 1200);
    });

    it('the second announces its own start and end, marked as the second', () => {
        stock({ mh_wood: 50, mh_hide: 50 });
        const bench = worked(null);
        const starts = [];
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_START, (p) => { if (p.instanceId === bench.id) starts.push(p.lane ?? 1); });
        Orders.orderAt('master', AT);
        run(3100);
        off();
        expect(starts.filter(l => l === 1)).toHaveLength(4);
        expect(starts.filter(l => l === 2)).toHaveLength(3);
    });
});

describe('ruling 2: only while the hero working that station holds it', () => {
    it('a hero without it runs the first recipe alone', () => {
        stock({ mh_wood: 50, mh_hide: 50 });
        const bench = worked('novice');
        const { seen, off } = cycles(bench.id);
        run(4000);
        off();
        expect(seen.first.length).toBe(4);
        expect(seen.second).toHaveLength(0);
        expect(InventoryManager.getItemCount('mh_hide')).toBe(50);
        expect(SecondRecipe.isOpenNow(bench, getDef('mh_bench'))).toBe(false);
    });

    it('stops when the holder leaves, its progress forfeit, and keeps its pick', () => {
        stock({ mh_wood: 50, mh_hide: 50 });
        const bench = worked('master');
        run(700);
        expect(bench.secondElapsedMs).toBeGreaterThan(0);
        const resets = [];
        const off = EventBus.subscribe(BOARD_EVENTS.SECOND_PROGRESS, (p) => { if (p.instanceId === bench.id) resets.push(p.percent); });
        Flags.sendHome('master');
        run(200);
        off();
        expect(BoardState.workerOf(bench.id)).toBeNull();
        expect(bench.secondElapsedMs).toBe(0);
        expect(resets).toContain(0);
        expect(bench.secondRecipeId).toBe(LEATHER);

        // A hero without the perk takes over: the first runs, the second waits.
        Orders.orderAt('novice', AT);
        expect(runUntil(() => BoardState.workerOf(bench.id) === 'novice', 3000)).toBe(true);
        const { seen, off: stop } = cycles(bench.id);
        run(3000);
        stop();
        expect(seen.first.length).toBe(3);
        expect(seen.second).toHaveLength(0);
        expect(bench.secondElapsedMs).toBe(0);
    });

    it('another hero holding it elsewhere in the guild opens nothing', () => {
        stock({ mh_wood: 50, mh_hide: 50 });
        // The master idles at the far side; the novice works the bench.
        Orders.orderAt('master', FAR);
        const bench = worked('novice');
        const { seen, off } = cycles(bench.id);
        run(3000);
        off();
        expect(seen.second).toHaveLength(0);
    });

    it('a Token in reach carrying it opens nothing: it is the hero\'s', () => {
        stock({ mh_wood: 50, mh_hide: 50 });
        placeAt('mh_banner', AT.x + 120, AT.y);
        const bench = worked('novice');
        const { seen, off } = cycles(bench.id);
        run(3000);
        off();
        expect(seen.second).toHaveLength(0);
    });

    it('a holder short of the second recipe\'s own level runs the first, the card says why', () => {
        stock({ mh_wood: 50 });
        registerSkillPerks({ crafting: { perks: [{ level: 50, effectId: 'mh_many_hands' }] } });
        const bench = worked('novice', { secondId: MASTERWORK });
        const { seen, off } = cycles(bench.id);
        run(3000);
        off();
        expect(seen.first.length).toBe(3);
        expect(seen.second).toHaveLength(0);
        expect(bench.secondAlert).toBe(ALERT.ACCESS);
        expect(bench.alert ?? null).toBeNull();
    });
});

describe('ruling 3: a different recipe from the first', () => {
    it('the second setter refuses the first\'s recipe and one outside the pool', () => {
        const bench = worked(null, { secondId: null });
        expect(StationRecipe.setSecondRecipe(bench, CHARCOAL)).toBe(false);
        expect(StationRecipe.setSecondRecipe(bench, BLADE)).toBe(false);
        expect(StationRecipe.setSecondRecipe(bench, 'no_such_recipe')).toBe(false);
        expect(bench.secondRecipeId).toBeUndefined();
        expect(StationRecipe.setSecondRecipe(bench, ROPE)).toBe(true);
        expect(bench.secondRecipeId).toBe(ROPE);
    });

    it('the first set to the second\'s recipe clears the second', () => {
        const bench = worked(null, { secondId: ROPE });
        expect(StationRecipe.setSelectedRecipe(bench, ROPE)).toBe(true);
        expect(bench.selectedRecipeId).toBe(ROPE);
        expect(bench.secondRecipeId).toBeUndefined();
    });

    it('a station whose two picks are the same (an edited save) runs the first alone', () => {
        stock({ mh_wood: 50 });
        const bench = worked(null, { secondId: null });
        bench.secondRecipeId = CHARCOAL;
        Orders.orderAt('master', AT);
        const { seen, off } = cycles(bench.id);
        run(3100);
        off();
        expect(seen.first.length).toBe(3);
        expect(seen.second).toHaveLength(0);
    });

    it('a second pick starts its cycle from zero and leaves the first\'s alone', () => {
        stock({ mh_wood: 50, mh_hide: 50 });
        const bench = worked('master');
        run(700);
        const first = bench.cycleElapsedMs;
        expect(StationRecipe.setSecondRecipe(bench, ROPE)).toBe(true);
        expect(bench.secondElapsedMs).toBe(0);
        expect(bench.cycleElapsedMs).toBe(first);
    });

    it('clearing the second stops it', () => {
        stock({ mh_wood: 50, mh_hide: 50 });
        const bench = worked('master');
        run(700);
        expect(StationRecipe.clearSecondRecipe(bench)).toBe(true);
        expect(bench.secondRecipeId).toBeUndefined();
        expect(bench.secondElapsedMs).toBeUndefined();
        const { seen, off } = cycles(bench.id);
        run(3000);
        off();
        expect(seen.second).toHaveLength(0);
    });
});

describe('ruling 4: one short of materials, the other carries on', () => {
    it('the second short: the first carries on, no mark on the mat, the card\'s problem is the second\'s', () => {
        stock({ mh_wood: 50 });
        const news = [];
        const offNews = EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, (p) => news.push(p));
        const bench = worked('master');
        const { seen, off } = cycles(bench.id);
        run(4000);
        off();
        offNews();
        expect(seen.first.length).toBe(4);
        expect(seen.second).toHaveLength(0);
        expect(bench.alert ?? null).toBeNull();
        expect(bench.secondAlert).toBe(ALERT.INPUTS);
        // Nothing on the news for the second's want: the card says it.
        expect(news).toEqual([]);
        // Hide arrives: the second starts, the card's problem goes.
        stock({ mh_hide: 5 });
        run(1600);
        expect(bench.secondAlert).toBeUndefined();
        expect(made('mh_leather')).toBe(1);
    });

    it('the first short: the red mark is the first\'s, the hero takes the station and stays, the second carries on', () => {
        stock({ mh_hide: 50 });
        const bench = worked('master');
        const { seen, off } = cycles(bench.id);
        run(4500);
        off();
        expect(bench.alert).toBe(ALERT.INPUTS);
        expect(BoardState.workerOf(bench.id)).toBe('master');
        expect(seen.first).toHaveLength(0);
        expect(seen.second.length).toBe(3);
        expect(bench.secondAlert).toBeUndefined();
        // Working the second, the hero is not idle.
        expect(BoardRunner.isHeroIdle('master')).toBe(false);
    });

    it('the first running dry under a working hero: the hero stays and the second carries on', () => {
        stock({ mh_wood: 2, mh_hide: 50 });
        const bench = worked('master');
        const { seen, off } = cycles(bench.id);
        run(4500);
        off();
        expect(seen.first).toHaveLength(2);
        expect(seen.second.length).toBe(3);
        expect(bench.alert).toBe(ALERT.INPUTS);
        expect(BoardState.workerOf(bench.id)).toBe('master');
    });

    it('a hero without it is not sent to a station whose first is short', () => {
        stock({ mh_hide: 50 });
        const bench = worked(null);
        Orders.orderAt('novice', AT);
        run(1000);
        expect(BoardState.workerOf(bench.id)).toBeNull();
    });

    it('both short: both wait, each with its own problem, and the hero is idle', () => {
        stock({ mh_wood: 1, mh_hide: 1 });
        const bench = worked('master');
        run(2000);
        expect(bench.alert).toBe(ALERT.INPUTS);
        expect(bench.secondAlert).toBe(ALERT.INPUTS);
        expect(BoardState.workerOf(bench.id)).toBe('master');
        expect(BoardRunner.isHeroIdle('master')).toBe(true);
    });
});

describe('ruling 5: the second\'s progress is the card\'s alone', () => {
    it('the mat\'s progress stream is the first\'s alone; the second has its own, read off its own clock', () => {
        stock({ mh_wood: 50, mh_hide: 50 });
        const bench = worked('master');
        const mat = [];
        const card = [];
        const offs = [
            EventBus.subscribe(BOARD_EVENTS.PROGRESS, (p) => { if (p.instanceId === bench.id) mat.push({ ...p, clock: bench.cycleElapsedMs }); }),
            EventBus.subscribe(BOARD_EVENTS.SECOND_PROGRESS, (p) => { if (p.instanceId === bench.id) card.push({ ...p, clock: bench.secondElapsedMs }); })
        ];
        run(3000);
        offs.forEach(off => off());
        expect(mat.length).toBeGreaterThan(5);
        expect(card.length).toBeGreaterThan(5);
        expect(mat.every(p => p.cycleTimeMs === 1000 && p.elapsedMs === p.clock)).toBe(true);
        expect(card.every(p => p.cycleTimeMs === 1500 && p.elapsedMs === p.clock)).toBe(true);
    });
});

describe('ruling 6: making stations with a recipe list, narrowed by the effect\'s skill', () => {
    it('never a Foundation, Field, water, Hideout, shrine, Laboratory or Summoning Circle', () => {
        expect(StationRecipe.takesSecondRecipe(getDef('mh_bench'))).toBe(true);
        expect(StationRecipe.takesSecondRecipe(getDef('mh_forge'))).toBe(true);
        for (const id of ['mh_foundation', 'mh_field', 'mh_shrine', 'mh_water', 'mh_circle']) {
            expect(StationRecipe.takesSecondRecipe(getDef(id)), id).toBe(false);
            const token = placeAt(id, AT.x, AT.y);
            expect(StationRecipe.setSecondRecipe(token, ROPE), id).toBe(false);
            BoardState.removeToken(token.id);
        }
        // A Hideout and a Laboratory run no recipe: no pool, so nothing to choose a second from.
        expect(StationRecipe.takesSecondRecipe({ id: 'x', name: 'x', statements: [{ keyword: KEYWORD.STATION, payload: { skill: 'crime', stationKind: 'hideout' } }], config: { skill: 'crime' } })).toBe(false);
        expect(StationRecipe.takesSecondRecipe({ id: 'y', name: 'y', statements: [{ keyword: KEYWORD.STATION, payload: { skill: 'science', stationKind: 'laboratory' } }], config: { skill: 'science' } })).toBe(false);
    });

    it('a Crafting perk opens no Smithing station; one naming no skill opens every making station', () => {
        stock({ mh_bar: 50 });
        const forge = worked('master', { typeId: 'mh_forge', first: BLADE, secondId: 'mh_recipe_blade_two' });
        let { seen, off } = cycles(forge.id);
        run(3000);
        off();
        expect(seen.first.length).toBe(3);
        expect(seen.second).toHaveLength(0);

        registerSkillPerks({ smithing: { perks: [{ level: 99, effectId: 'mh_many_hands_any' }] } });
        ({ seen, off } = cycles(forge.id));
        run(3000);
        off();
        expect(seen.second.length).toBe(2);
    });
});

describe('the first recipe runs and draws exactly as before when no second runs', () => {
    /** A counting seeded stream, as the bench's work check pins one. */
    function counting(seed) {
        let state = seed;
        const s = { draws: 0 };
        s.fn = () => {
            s.draws += 1;
            state = (state + 0x6D2B79F5) | 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        return s;
    }
    /** The first recipe's whole story over a run: each cycle's output, the progress, the draws. */
    function story(setUp) {
        clearMat();
        SpriteLayer.init();
        const before = { wood: InventoryManager.getItemCount('mh_wood'), hide: InventoryManager.getItemCount('mh_hide'), charcoal: made('mh_charcoal') };
        stock({ mh_wood: 30, mh_hide: 30 });
        const s = counting(77);
        vi.spyOn(Math, 'random').mockImplementation(s.fn);
        const bench = setUp();
        const out = [];
        const offs = [
            EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.instanceId === bench.id) out.push(`done ${p.lane ?? 1} ${p.produced.join()} at ${bench.cycleElapsedMs}`); })
        ];
        run(8000);
        offs.forEach(off => off());
        Flags.sendHome(BoardState.workerOf(bench.id));
        run(100);
        vi.restoreAllMocks();
        const used = (id, was) => was + 30 - InventoryManager.getItemCount(id);
        return { out, draws: s.draws, wood: used('mh_wood', before.wood), hide: used('mh_hide', before.hide), charcoal: made('mh_charcoal') - before.charcoal };
    }

    it('a holder with no second recipe set, a second set with no holder, and no perk at all agree', () => {
        // A Token rule with a chance draws on every cycle, so the stream has something to compare.
        registerTokenTypes({
            mh_lucky_charm: {
                id: 'mh_lucky_charm', name: 'MH Charm', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
                statements: [{ id: 'stm_mh_dl', keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby', payload: { type: EFFECT_TYPES.LOOT_MULT, bucket: 'flat', value: 40 } }]
            }
        });
        const charm = () => placeAt('mh_lucky_charm', AT.x + 120, AT.y);
        registerSkillPerks({ crafting: { perks: [] } });
        const plain = story(() => { charm(); return worked('master', { secondId: null }); });
        registerSkillPerks(PERK);
        const holderNoSecond = story(() => { charm(); return worked('master', { secondId: null }); });
        const secondNoHolder = story(() => { charm(); return worked('novice'); });
        expect(plain.draws).toBeGreaterThan(0);
        expect(holderNoSecond).toEqual(plain);
        expect(secondNoHolder.out).toEqual(plain.out);
        expect(secondNoHolder.draws).toBe(plain.draws);
        expect(secondNoHolder.wood).toBe(plain.wood);
        expect(secondNoHolder.charcoal).toBe(plain.charcoal);
        expect(plain.hide).toBe(0);
        expect(secondNoHolder.hide).toBe(0);
        expect(plain.out.length).toBe(8);
    });
});

describe('the Echo and Summoned workers', () => {
    it('an Echo reaching the station repeats each lane\'s cycle, outputs and XP alike', () => {
        stock({ mh_wood: 50, mh_hide: 50 });
        placeAt('mh_echo_stone', AT.x + 120, AT.y);
        const bench = worked('master');
        const { seen, off } = cycles(bench.id);
        run(3000);
        off();
        expect(seen.first.length).toBe(3);
        expect(seen.second.length).toBe(2);
        // Each cycle's output lands twice; the materials are paid once a cycle.
        expect(made('mh_charcoal')).toBe(6);
        expect(made('mh_leather')).toBe(4);
        expect(InventoryManager.getItemCount('mh_hide')).toBe(48);
        expect(GameState.state.heroes[0].skills.crafting.xp).toBe(2 * (3 * 1 + 2 * 2));
    });

    it('a Summoned worker whose trait is Many Hands works both, one charge a finished cycle in each', () => {
        stock({ mh_wood: 50, mh_hide: 50 });
        const circle = placeAt('mh_circle', FAR.x, FAR.y);
        const summon = Summons.chargeFromCircle(circle, 'mh_summoned_crafter', null);
        expect(summon).toBeTruthy();
        const charges = Summons.chargesOf(summon.id);
        expect(charges).toBe(3);
        const bench = worked(summon.id);
        const { seen, off } = cycles(bench.id);
        // Charcoal at 1 s and Leather at 1.5 s: two finished cycles, two charges spent.
        run(1550);
        expect(seen.first).toHaveLength(1);
        expect(seen.second).toHaveLength(1);
        expect(Summons.chargesOf(summon.id)).toBe(1);
        // The next Charcoal at 2 s spends the last, and it leaves.
        run(500);
        off();
        expect(seen.first).toHaveLength(2);
        expect(seen.second).toHaveLength(1);
        expect(Summons.chargesOf(summon.id)).toBeNull();
        expect(BoardState.workerOf(bench.id)).toBeNull();
        expect(bench.secondElapsedMs).toBe(0);
    });
});

