import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { QuestManager } from '../systems/quests/QuestManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import { TRIGGER_SCOPES, getTriggerEvent } from '../config/registries/triggerRegistry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * A kill is a cycle of its own kind, a combat cycle. It takes Yield, Double Loot, Double Item, the
 * bonus drops and the XP bonus; not Refresh, Fail or Giant Harvest. Its loot counts as made (On
 * Neighbour Produces), it counts once for Limes's lessons, and a neighbour hears it as On
 * Neighbour's Kill only: no On Neighbour's Cycle, and the enemy's own On Cycle does not fire at its
 * death. Its drops are read off the Token at the kill, and the bonus drops are in its loot event.
 */

const MEAT = 'fixture_kc_meat';
const HIDE = 'fixture_kc_hide';
const NEST = 'fixture_kc_nest';
const CYCLE_MARK = 'fixture_kc_cycle_mark';
const KILL_MARK = 'fixture_kc_kill_mark';
const MADE_MARK = 'fixture_kc_made_mark';
const item = (id) => ({
    id, name: id, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems(Object.fromEntries([MEAT, HIDE, NEST, CYCLE_MARK, KILL_MARK, MADE_MARK].map(id => [id, item(id)])));

const ALL = { mode: 'all', value: '' };
let stm = 0;
const provides = (type, value, extra = {}) => ({
    id: `stm_kc_${++stm}`, keyword: KEYWORD.PROVIDES, to: ALL, reach: 'nearby',
    payload: { type, bucket: 'flat', value, ...extra }
});
/** A rule that drops one `itemId` at its bearer on `event`. */
const markOn = (itemId, event, extraWhen = {}) => ({
    id: `stm_kc_${++stm}`, keyword: KEYWORD.GRANTS, to: ALL, upkeep: null,
    payload: { type: 'BONUS_DROP', itemId, quantity: 1, chance: 100 },
    when: { event, cooldownMs: 0, ...extraWhen }
});
const building = (id, statements) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
    requiresHero: false, statements
});
const enemy = (id, outputs, statements = []) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult',
    enemy: { level: 1, style: 'melee', hp: 5, xp: 3 },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs },
    statements
});
const MEAT_LINE = { itemId: MEAT, chance: 100, minQty: 1, maxQty: 1 };

registerTokenTypes({
    kc_enemy: enemy('kc_enemy', [MEAT_LINE]),
    kc_bare_enemy: enemy('kc_bare_enemy', []),
    kc_self_enemy: enemy('kc_self_enemy', [MEAT_LINE],
        // Free to fire: a rule that costs a charge could not, as the kill has spent the enemy's one.
        [{
            ...makeStatement(KEYWORD.SPAWNS), id: 'stm_kc_self_spawn', chargeDelta: 0,
            payload: { typeId: 'kc_self_marker', placement: PLACEMENT.NEAREST_FREE, chance: 100 },
            when: { event: 'SELF_CYCLE_COMPLETE', scope: TRIGGER_SCOPES.SELF, cooldownMs: 0 }
        }]),
    kc_self_marker: building('kc_self_marker', []),
    kc_yield: building('kc_yield', [provides(EFFECT_TYPES.YIELD, 1)]),
    kc_looter: building('kc_looter', [provides(EFFECT_TYPES.LOOT_MULT, 100)]),
    kc_doubler: building('kc_doubler', [provides(EFFECT_TYPES.DOUBLE_DROP, 100, { category: MEAT })]),
    kc_nester: building('kc_nester', [{
        id: 'stm_kc_nest', keyword: KEYWORD.GRANTS, to: ALL, reach: 'nearby',
        payload: { type: EFFECT_TYPES.BONUS_DROP, itemId: NEST, quantity: 1, chance: 100 }
    }]),
    kc_scholar: building('kc_scholar', [provides(EFFECT_TYPES.XP_BONUS, 1, { bucket: 'percentage' })]),
    kc_giant_0: building('kc_giant_0', [provides(EFFECT_TYPES.GIANT_HARVEST, 0)]),
    kc_giant_100: building('kc_giant_100', [provides(EFFECT_TYPES.GIANT_HARVEST, 100)]),
    kc_jinx: building('kc_jinx', [provides(EFFECT_TYPES.FAIL_CHANCE, 100)]),
    kc_refresher: building('kc_refresher', [provides(EFFECT_TYPES.REFRESH, 100)]),
    kc_cycle_watcher: building('kc_cycle_watcher', [markOn(CYCLE_MARK, 'CYCLE_COMPLETE', { scope: TRIGGER_SCOPES.NEARBY })]),
    kc_kill_watcher: building('kc_kill_watcher', [markOn(KILL_MARK, 'COMBAT_RESOLVED', { scope: TRIGGER_SCOPES.NEARBY })]),
    kc_meat_watcher: building('kc_meat_watcher', [markOn(MADE_MARK, 'ITEM_PRODUCED', { scope: TRIGGER_SCOPES.NEARBY, watchItemId: MEAT })]),
    kc_nest_watcher: building('kc_nest_watcher', [markOn(MADE_MARK, 'ITEM_PRODUCED', { scope: TRIGGER_SCOPES.NEARBY, watchItemId: NEST })])
});

/** Mat points 160 u apart: side by side is Near (164 u). */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });
const FOE = 10;
const BESIDE = [11, 9, 4, 16];

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    Object.values(hero.skills).forEach(s => { s.level = 50; s.xp = 0; });
    return hero;
}

function put(typeId, tile) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    const res = Placement.placeTokenAt(instance, C(tile));
    expect(res?.success, res?.reason).not.toBe(false);
    TileModifiers.rebuildAround([instance]);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const onFloor = (itemId) => SpriteLayer.countOnBoard(itemId);

/**
 * One kill of `enemyType` with each of `beside` next to it: its loot events, its cycle events and the
 * `Math.random` draws the whole run made.
 */
function oneKill(enemyType = 'kc_enemy', beside = []) {
    const foe = put(enemyType, FOE);
    beside.forEach((typeId, i) => put(typeId, BESIDE[i]));
    const seen = { loot: [], cycles: [], giants: 0 };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.LOOT_GENERATED, p => seen.loot.push(p)),
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, p => { if (p.instanceId === foe.id) seen.cycles.push(p); }),
        EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, p => { if (p.giant) seen.giants++; })
    ];
    expect(Orders.orderAt('hero_1', C(FOE)).success).toBe(true);
    const spy = vi.spyOn(Math, 'random');
    run(60000);
    seen.draws = spy.mock.calls.length;
    spy.mockRestore();
    offs.forEach(off => off());
    expect(seen.loot).toHaveLength(1);
    expect(seen.cycles).toHaveLength(1);
    seen.foe = foe;
    seen.drops = seen.loot[0].drops.map(d => [d.itemId, d.quantity]);
    return seen;
}

/** The bench's mulberry32, so two runs draw the same stream. */
function seeded(seed) {
    let state = seed | 0;
    return () => {
        state = (state + 0x6D2B79F5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function fresh() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
}

beforeAll(() => {
    Flags.init();
    LootSystem.init();
    BoardCombat.init();
    TriggerSystem.init();
});
afterAll(() => { Flags.teardown(); TriggerSystem.teardown(); });
beforeEach(() => fresh());
afterEach(() => vi.restoreAllMocks());

describe('what reaches a kill', () => {
    it('plain: the enemy drops its own line once', () => {
        expect(oneKill().drops).toEqual([[MEAT, 1]]);
        expect(onFloor(MEAT)).toBe(1);
    });

    it('Yield widens it', () => {
        expect(oneKill('kc_enemy', ['kc_yield']).drops).toEqual([[MEAT, 2]]);
    });

    it('Double Loot doubles it', () => {
        expect(oneKill('kc_enemy', ['kc_looter']).drops).toEqual([[MEAT, 2]]);
    });

    it('Double Item on the item doubles it', () => {
        expect(oneKill('kc_enemy', ['kc_doubler']).drops).toEqual([[MEAT, 2]]);
    });

    it('a bonus drop lands beside the kill, doubled by Double Loot, and is in the loot event (the Drops line and the time-away tally)', () => {
        const plain = oneKill('kc_enemy', ['kc_nester']);
        expect(plain.drops).toEqual([[MEAT, 1], [NEST, 1]]);
        expect(plain.loot[0].drops.find(d => d.itemId === NEST)).toMatchObject({ bonus: true, itemName: NEST });
        expect(onFloor(NEST)).toBe(1);

        fresh();
        expect(oneKill('kc_enemy', ['kc_nester', 'kc_looter']).drops).toEqual([[MEAT, 2], [NEST, 2]]);
    });

    it('the XP bonus widens the kill\'s XP', () => {
        const xpOf = () => GameState.state.heroes[0].skills.melee.xp;
        oneKill();
        const plain = xpOf();
        expect(plain).toBeGreaterThan(0);
        fresh();
        oneKill('kc_enemy', ['kc_scholar']);
        expect(xpOf()).toBeGreaterThan(plain);
    });
});

describe('what does not reach a kill', () => {
    it('Giant Harvest: no ten times, no celebration and not one draw for it', () => {
        vi.spyOn(Math, 'random').mockImplementation(seeded(7));
        const off = oneKill('kc_enemy', ['kc_giant_0']);
        vi.restoreAllMocks();
        fresh();
        vi.spyOn(Math, 'random').mockImplementation(seeded(7));
        const on = oneKill('kc_enemy', ['kc_giant_100']);
        expect(on.drops).toEqual([[MEAT, 1]]);
        expect(on.giants).toBe(0);
        expect(on.draws).toBe(off.draws);
    });

    it('Fail: a kill beside a sure failure still pays, and is not a failed cycle', () => {
        const seen = oneKill('kc_enemy', ['kc_jinx']);
        expect(seen.drops).toEqual([[MEAT, 1]]);
        expect(seen.cycles[0].failed).toBe(false);
        expect(GameState.state.heroes[0].skills.melee.xp).toBeGreaterThan(0);
    });

    it('Refresh: a kill beside a sure refresh still uses the enemy up', () => {
        const seen = oneKill('kc_enemy', ['kc_refresher']);
        expect(seen.foe.usesRemaining).toBe(0);
        expect(BoardState.getTokenById(seen.foe.id)).toBeNull();
    });
});

describe('the kill\'s cycle', () => {
    it('is marked a kill and carries the loot it landed, bonus drops too', () => {
        const seen = oneKill('kc_enemy', ['kc_nester']);
        expect(seen.cycles[0]).toMatchObject({ kill: true, failed: false, produced: [MEAT, NEST] });
    });

    it('a kill with no loot carries none', () => {
        expect(oneKill('kc_bare_enemy').cycles[0].produced).toEqual([]);
    });

    it('counts in the Token-type tally as the enemy\'s cycle', () => {
        oneKill();
        expect(GameState.state.collection.cyclesByTokenType.kc_enemy).toBe(1);
    });
});

describe('what a neighbour hears', () => {
    it('On Neighbour\'s Kill fires once; On Neighbour\'s Cycle does not fire', () => {
        oneKill('kc_enemy', ['kc_kill_watcher', 'kc_cycle_watcher']);
        expect(onFloor(KILL_MARK)).toBe(1);
        expect(onFloor(CYCLE_MARK)).toBe(0);
    });

    it('On Neighbour Produces hears the kill\'s loot, a bonus drop included', () => {
        oneKill('kc_enemy', ['kc_meat_watcher']);
        expect(onFloor(MADE_MARK)).toBe(1);
        fresh();
        oneKill('kc_enemy', ['kc_nester', 'kc_nest_watcher']);
        expect(onFloor(MADE_MARK)).toBe(1);
    });

    it('...and not an item the kill did not drop', () => {
        oneKill('kc_bare_enemy', ['kc_meat_watcher']);
        expect(onFloor(MADE_MARK)).toBe(0);
    });

    it('the enemy\'s own On Cycle rule does not fire at its death', () => {
        oneKill('kc_self_enemy');
        expect(BoardState.tokens().filter(t => t.typeId === 'kc_self_marker')).toHaveLength(0);
    });

    it('the two work moments say they are work\'s alone; On Neighbour Produces is not', () => {
        expect(getTriggerEvent('CYCLE_COMPLETE').workOnly).toBe(true);
        expect(getTriggerEvent('SELF_CYCLE_COMPLETE').workOnly).toBe(true);
        expect(getTriggerEvent('ITEM_PRODUCED').workOnly).toBeFalsy();
        expect(getTriggerEvent('COMBAT_RESOLVED').workOnly).toBeFalsy();
    });
});

describe('Limes\'s lessons', () => {
    beforeEach(() => QuestManager.init());
    afterEach(() => QuestManager.cleanup());

    it('a kill counts once, as a victory, never as a work cycle', () => {
        const reports = vi.spyOn(QuestManager, 'reportProgress');
        oneKill();
        const kinds = reports.mock.calls.map(c => c[0]);
        expect(kinds.filter(k => k === 'combat_victory')).toHaveLength(1);
        expect(kinds).not.toContain('cycle_completed');
    });
});

describe('the drop list', () => {
    it('is read at the kill: an edit made mid-fight pays on this kill', () => {
        registerTokenTypes({ kc_edited: enemy('kc_edited', [MEAT_LINE]) });
        const foe = put('kc_edited', FOE);
        const loot = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.LOOT_GENERATED, p => loot.push(p));
        expect(Orders.orderAt('hero_1', C(FOE)).success).toBe(true);
        run(100);
        expect(BoardCombat.getFight(foe.id)).toBeTruthy();
        registerTokenTypes({ kc_edited: enemy('kc_edited', [{ itemId: HIDE, chance: 100, minQty: 3, maxQty: 3 }]) });
        run(60000);
        off();
        expect(loot.map(p => p.drops.map(d => [d.itemId, d.quantity]))).toEqual([[[HIDE, 3]]]);
    });
});
