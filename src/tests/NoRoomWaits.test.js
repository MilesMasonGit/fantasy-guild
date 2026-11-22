import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as Occupation from '../systems/board/Occupation.js';
import * as RoomWait from '../systems/board/RoomWait.js';
import * as Arrival from '../systems/world/Arrival.js';
import * as EventClock from '../systems/events/EventClock.js';
import * as EventTokens from '../systems/board/EventTokens.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { setEventsForTests, resetEventsForTests } from '../config/registries/eventRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { ALERT, BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn(), recordKill: vi.fn(), recordEnemyKill: vi.fn() }
}));

/**
 * ⭐ One rule for no room: nothing is paid or lost until a Token lands; it waits and retries; the
 * player is told once. Each source is tried with a full mat: a spawner, a station whose made Token
 * finds nowhere, the arrival's enemies and an event.
 */

const WOOD = 'fixture_oak_wood';

registerTokenTypes({
    fixture_nr_forest: {
        id: 'fixture_nr_forest', name: 'Fixture NR Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'fixture_passive', weight: 1 }], allowance: 3, intervalMs: 5000, upkeep: [{ itemId: WOOD, quantity: 1 }] }
    },
    fixture_nr_bench: {
        id: 'fixture_nr_bench', name: 'Fixture NR Bench', tokenType: 'station',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_flask',
        requiresHero: false,
        config: { skill: 'fixture_nr_skill', skillRequired: 1, cycleTimeMs: 10000, xp: 0 },
        statements: [{ id: 'stm_fixture_nr_bench', keyword: KEYWORD.STATION, payload: { skill: 'fixture_nr_skill' } }]
    },
    fixture_nr_tool: {
        id: 'fixture_nr_tool', name: 'Fixture NR Tool', tokenType: 'support',
        rarity: 'common', theme: 'fixture', uses: 12, sprite: 's_mining', requiresHero: false
    },
    fixture_nr_comet: {
        id: 'fixture_nr_comet', name: 'Fixture NR Comet', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: 3, sprite: 't_ore_vein_copper', requiresHero: true, staysPut: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [] }
    }
});

registerRecipePools({
    fixture_nr_skill: [{
        id: 'nr_tool_for_wood', levelRequirement: 0, requiresContext: [],
        inputs: [{ itemId: WOOD, quantity: 2 }],
        outputs: [{ tokenId: 'fixture_nr_tool', minQty: 1, maxQty: 1, chance: 100 }],
        durationMs: 10000, xp: 0
    }]
});

const FREE_AT = { x: 200, y: 200 };

/**
 * A mat packed with placed blockers at the minimum gap, clear only round `clearAt` (none when
 * null). The Token cap is lifted: crowding is the point, not the cap.
 */
function packedMat(clearAt = FREE_AT) {
    setMatTuning('matSteps', 6);
    setMatTuning('tokenCap', 2000);
    const gap = Math.ceil(MatPlacement.minGap('fixture_kitchen', 'fixture_kitchen'));
    const x0 = 64 + ((matW() - 128) % gap) / 2;
    const y0 = 64 + ((matH() - 128) % gap) / 2;
    const blockers = [];
    for (let x = x0; x <= matW() - 64; x += gap) {
        for (let y = y0; y <= matH() - 64; y += gap) {
            if (clearAt && Math.hypot(x - clearAt.x, y - clearAt.y) < gap) continue;
            blockers.push(placeAt('fixture_kitchen', x, y));
        }
    }
    return blockers;
}

/** Take off every blocker within `r` of `p`. */
function clearRound(blockers, p, r = 400) {
    for (const b of blockers) {
        if (BoardState.getTokenById(b.id) && Math.hypot(b.x - p.x, b.y - p.y) < r) BoardState.removeToken(b.id);
    }
}

/** Every `NO_ROOM_WAIT` heard until `stop()`. */
function listenTold() {
    const heard = [];
    const stop = EventBus.subscribe(BOARD_EVENTS.NO_ROOM_WAIT, (p) => heard.push(p));
    return { heard, stop };
}

/** Save the game, read it back as a load does. */
function saveAndLoad() {
    const data = JSON.parse(GameState.serializeJson());
    loadSavedState(migrateState(data.state, data.version));
}

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills, hp: { current: 100, max: 100 } };
}

let told;

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    GameState.state.heroes = [makeHero('hero_1')];
    GameState.state.inventory.maxSlots = 50;
    clearMat();
    SpawnerSystem.resetAlerts();
    RoomWait.reset();
    told = listenTold();
});

afterEach(() => {
    told.stop();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ a spawner with no room waits, pays nothing, and says so once', () => {
    it('misses on a full mat without paying, keeps its mark, is told once, and lands once room is made', () => {
        InventoryManager.addItem(WOOD, 10);
        const blockers = packedMat(null);
        const forest = placeAt('fixture_nr_forest', FREE_AT.x, FREE_AT.y);
        const spawned = () => BoardState.tokens().filter(t => t.typeId === 'fixture_passive');

        for (let i = 0; i < 4; i++) TimedChanges.tick(5000);
        expect(spawned()).toHaveLength(0);
        expect(InventoryManager.getItemCount(WOOD)).toBe(10);
        expect(SpawnerSystem.spawnerAlertOf(forest.id)).toEqual({ alert: ALERT.SPAWN_NO_ROOM, needs: [] });
        expect(told.heard).toEqual([expect.objectContaining({
            key: forest.id, source: RoomWait.SOURCE.SPAWNER, instanceId: forest.id, typeId: 'fixture_nr_forest', name: 'Fixture NR Forest'
        })]);

        clearRound(blockers, FREE_AT);
        TimedChanges.tick(5000);
        expect(spawned()).toHaveLength(1);
        expect(InventoryManager.getItemCount(WOOD)).toBe(9);
        expect(SpawnerSystem.spawnerAlertOf(forest.id)).toBeNull();
        expect(RoomWait.isTold(forest.id)).toBe(false);
    });

    it('a full spawner saved and reloaded shows its mark at once, and is told again', () => {
        InventoryManager.addItem(WOOD, 10);
        const blockers = packedMat(null);
        const forest = placeAt('fixture_nr_forest', FREE_AT.x, FREE_AT.y);
        for (let i = 0; i < 2; i++) TimedChanges.tick(5000);
        expect(SpawnerSystem.spawnerAlertOf(forest.id)?.alert).toBe(ALERT.SPAWN_NO_ROOM);

        saveAndLoad();
        SpawnerSystem.resetAlerts();   // a fresh page: nothing remembered
        RoomWait.reset();
        told.heard.length = 0;

        expect(SpawnerSystem.spawnerStatus(forest.id).state).toBe('spawning');
        TimedChanges.tick(100);   // the first tick's check, well before the next attempt
        expect(SpawnerSystem.spawnerStatus(forest.id).state).toBe('no_room');
        expect(SpawnerSystem.spawnerAlertOf(forest.id)).toEqual({ alert: ALERT.SPAWN_NO_ROOM, needs: [] });
        expect(told.heard).toHaveLength(1);
        expect(InventoryManager.getItemCount(WOOD)).toBe(10);

        clearRound(blockers, FREE_AT);
        TimedChanges.tick(5000);
        expect(SpawnerSystem.spawnerAlertOf(forest.id)).toBeNull();
    });

    it('a spawner with room is not marked by the check after a load', () => {
        InventoryManager.addItem(WOOD, 10);
        const forest = placeAt('fixture_nr_forest', FREE_AT.x, FREE_AT.y);
        SpawnerSystem.resetAlerts();
        TimedChanges.tick(100);
        expect(SpawnerSystem.spawnerStatus(forest.id).state).toBe('spawning');
        expect(SpawnerSystem.spawnerAlertOf(forest.id)).toBeNull();
        expect(told.heard).toHaveLength(0);
    });

    it('a spawner held by a full Token cap is told once too', () => {
        InventoryManager.addItem(WOOD, 10);
        const forest = placeAt('fixture_nr_forest', FREE_AT.x, FREE_AT.y);
        setMatTuning('tokenCap', MatCap.tokenCount());
        for (let i = 0; i < 3; i++) TimedChanges.tick(5000);
        expect(SpawnerSystem.spawnerAlertOf(forest.id)?.alert).toBe(ALERT.SPAWN_MAT_FULL);
        expect(told.heard.map(p => p.key)).toEqual([forest.id]);
        expect(InventoryManager.getItemCount(WOOD)).toBe(10);
    });
});

describe('⭐ a station whose made Token finds no room keeps it, starts nothing new, and lands it when room appears', () => {
    const C = { x: 600, y: 400 };
    const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
    const tools = () => BoardState.tokens().filter(t => t.typeId === 'fixture_nr_tool');

    function bench() {
        const instance = BoardState.createTokenInstance('fixture_nr_bench', tokenStartingUses('fixture_nr_bench'));
        Placement.placeTokenAt(instance, C);
        instance.selectedRecipeId = 'nr_tool_for_wood';
        Orders.orderAt('hero_1', C);
        return instance;
    }

    /** A cycle that passed its room check and paid, whose Token then found nowhere to land. */
    function finishedWithNoRoom() {
        InventoryManager.addItem(WOOD, 10);
        const station = bench();
        const real = Placement.placeProduct;
        const spy = vi.spyOn(Placement, 'placeProduct').mockImplementationOnce(() => ({ success: false, reason: 'The mat is full' }));
        run(10000);
        spy.mockRestore();
        expect(Placement.placeProduct).toBe(real);
        // No room from here on, until the test makes some.
        setMatTuning('tokenCap', MatCap.tokenCount());
        return station;
    }

    it('the Token waits in the station: paid once, nothing lost, no new cycle, its mark up, told once', () => {
        const station = finishedWithNoRoom();
        run(30000);

        expect(tools()).toHaveLength(0);
        expect(station.waitingOutput).toEqual(['fixture_nr_tool']);
        expect(InventoryManager.getItemCount(WOOD)).toBe(8);
        expect(station.cycleElapsedMs).toBe(0);
        expect(station.alert).toBe(ALERT.NO_ROOM);
        expect(told.heard).toEqual([expect.objectContaining({
            key: station.id, source: RoomWait.SOURCE.STATION, instanceId: station.id, name: 'Fixture NR Bench'
        })]);
    });

    it('lands it the moment there is room, then works again', () => {
        const station = finishedWithNoRoom();
        run(5000);
        setMatTuning('tokenCap', 2000);
        run(100);

        expect(tools()).toHaveLength(1);
        expect(station.waitingOutput).toBeUndefined();
        expect(station.alert).not.toBe(ALERT.NO_ROOM);
        expect(RoomWait.isTold(station.id)).toBe(false);
        run(10000);
        expect(tools()).toHaveLength(2);
        expect(InventoryManager.getItemCount(WOOD)).toBe(6);
    });

    it('an unstaffed station waiting with a Token keeps its mark', () => {
        const station = finishedWithNoRoom();
        Orders.clearOrder?.('hero_1');
        GameState.state.heroes = [];
        run(2000);
        expect(station.alert).toBe(ALERT.NO_ROOM);
        expect(station.waitingOutput).toEqual(['fixture_nr_tool']);
    });

    it('the waiting Token survives a save and a load, and lands after it', () => {
        const station = finishedWithNoRoom();
        saveAndLoad();
        const loaded = BoardState.getTokenById(station.id);
        expect(loaded.waitingOutput).toEqual(['fixture_nr_tool']);
        run(1000);
        expect(tools()).toHaveLength(0);
        setMatTuning('tokenCap', 2000);
        run(100);
        expect(tools()).toHaveLength(1);
        expect(BoardState.getTokenById(station.id).waitingOutput).toBeUndefined();
    });

    it('a cycle held before paying for want of room is told once, however long it waits', () => {
        InventoryManager.addItem(WOOD, 10);
        const station = bench();
        setMatTuning('tokenCap', MatCap.tokenCount());
        run(30000);
        expect(station.alert).toBe(ALERT.NO_ROOM);
        expect(InventoryManager.getItemCount(WOOD)).toBe(10);
        expect(told.heard.map(p => p.key)).toEqual([station.id]);
    });
});

describe('⭐ arrival enemies with no room wait, saved with the arrival, and land as room appears', () => {
    const ARRIVAL = [{ typeId: 'fixture_enemy', count: 2 }];

    it('none is left out: they wait, the mat stays held and is not cleared, told once', () => {
        packedMat(null);
        const result = Arrival.occupy(ARRIVAL, { seed: 7 });
        expect(result.ids).toEqual([]);
        expect(result.unplaced).toEqual(['fixture_enemy', 'fixture_enemy']);
        expect(Arrival.waitingEnemies()).toHaveLength(2);
        expect(Occupation.isOccupied()).toBe(true);
        expect(Arrival.checkCleared({ quiet: true })).toBe(false);
        expect(told.heard).toEqual([expect.objectContaining({ key: RoomWait.ARRIVAL_KEY, source: RoomWait.SOURCE.ARRIVAL, instanceId: null })]);

        expect(Arrival.landWaiting()).toEqual([]);
        expect(Arrival.waitingEnemies()).toHaveLength(2);
    });

    it('they land once room is made, stand like the rest, and only then can the mat be cleared', () => {
        const blockers = packedMat(null);
        Arrival.occupy(ARRIVAL, { seed: 7 });
        const [first, second] = Arrival.waitingEnemies().map(w => ({ ...w }));
        clearRound(blockers, first, 200);

        const landed = Arrival.landWaiting();
        expect(landed).toContain(first.id);
        const enemy = BoardState.getTokenById(first.id);
        expect(enemy).toMatchObject({ typeId: 'fixture_enemy', arrival: true, tether: null, usesRemaining: 1 });
        expect(Occupation.arrivalOf().ids).toContain(first.id);

        if (landed.length === 1) {
            expect(Arrival.waitingEnemies().map(w => w.id)).toEqual([second.id]);
            BoardState.removeToken(first.id);
            expect(Arrival.checkCleared({ quiet: true })).toBe(false);
            clearRound(blockers, second, 200);
            expect(Arrival.landWaiting()).toEqual([second.id]);
        }
        expect(Arrival.waitingEnemies()).toEqual([]);
        expect(Occupation.arrivalOf().waiting).toBeUndefined();
        expect(RoomWait.isTold(RoomWait.ARRIVAL_KEY)).toBe(false);
        for (const id of Occupation.arrivalOf().ids) BoardState.removeToken(id);
        expect(Arrival.checkCleared({ quiet: true })).toBe(true);
    });

    it('the waiting enemies survive a save and a load', () => {
        const blockers = packedMat(null);
        Arrival.occupy(ARRIVAL, { seed: 7 });
        const waiting = Arrival.waitingEnemies().map(w => ({ ...w }));
        saveAndLoad();
        expect(Arrival.waitingEnemies()).toEqual(waiting);
        expect(Occupation.isOccupied()).toBe(true);
        clearRound(blockers, waiting[0], 200);
        expect(Arrival.landWaiting().length).toBeGreaterThan(0);
    });

    it('arrival enemies stand outside the Token cap, as event Tokens do', () => {
        const before = MatCap.tokenCount();
        const result = Arrival.occupy(ARRIVAL, { seed: 7 });
        expect(result.ids).toHaveLength(2);
        expect(MatCap.tokenCount()).toBe(before);
        expect(MatCap.countsTowardCap(BoardState.getTokenById(result.ids[0]))).toBe(false);
    });
});

describe('⭐ an event that finds no room tries again in 5 minutes and says so once', () => {
    const COMET = { id: 'evt_nr_comet', name: 'NR Comet', typeId: 'fixture_nr_comet', kind: 'node', weight: 10 };

    afterEach(() => {
        EventClock.setEnabled(false);
        resetEventsForTests();
    });

    it('a full mat: the retry stays 5 minutes, told once over several tries, and no event Token appears', () => {
        setEventsForTests({ [COMET.id]: COMET });
        EventClock.setEnabled(true);
        packedMat(null);
        EventClock.tick(1000);
        for (let i = 0; i < 3; i++) {
            EventClock.tick(EventClock.nextEventInMs());
            expect(EventClock.nextEventInMs()).toBe(EventClock.EVENT_RETRY_MS);
        }
        expect(BoardState.tokens().filter(EventTokens.isEventToken)).toEqual([]);
        expect(told.heard).toEqual([expect.objectContaining({ key: RoomWait.EVENT_KEY, source: RoomWait.SOURCE.EVENT, instanceId: null })]);
    });

    it('with no event fitting the place there is nothing to tell', () => {
        setEventsForTests({});
        EventClock.setEnabled(true);
        EventClock.tick(1000);
        EventClock.tick(EventClock.nextEventInMs());
        expect(told.heard).toEqual([]);
    });
});

// The Shop refuses before paying and says why: `Shop.test.js` ('refuses on a mat with no legal spot
// anywhere, and takes nothing', 'a refusal is said on the mat where it was dropped').

describe('told once, and a wait begun during time away is told when the player is back', () => {
    it('a quiet bus (a catch-up) publishes once, then live play tells it once more', () => {
        EventBus.setQuiet(true);
        try {
            expect(RoomWait.tell('tok_x', { source: RoomWait.SOURCE.STATION, instanceId: 'tok_x' })).toBe(true);
            expect(RoomWait.tell('tok_x', { source: RoomWait.SOURCE.STATION, instanceId: 'tok_x' })).toBe(false);
        } finally {
            EventBus.setQuiet(false);
        }
        expect(RoomWait.isTold('tok_x')).toBe(false);
        expect(RoomWait.tell('tok_x', { source: RoomWait.SOURCE.STATION, instanceId: 'tok_x' })).toBe(true);
        expect(RoomWait.tell('tok_x', { source: RoomWait.SOURCE.STATION, instanceId: 'tok_x' })).toBe(false);
        expect(told.heard).toHaveLength(2);
        RoomWait.landed('tok_x');
        expect(RoomWait.tell('tok_x', { source: RoomWait.SOURCE.STATION, instanceId: 'tok_x' })).toBe(true);
    });
});
