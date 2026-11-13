// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { createRegionRecord } from '../state/StateSchema.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as FixedTokens from '../systems/board/FixedTokens.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as Hand from '../systems/board/Hand.js';
import * as EventTokens from '../systems/board/EventTokens.js';
import * as EventClock from '../systems/events/EventClock.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { encodeTerrain, terrainAt, TERRAIN_CELL } from '../systems/atlas/TerrainMap.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setEventsForTests, resetEventsForTests } from '../config/registries/eventRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { summaryView } from '../ui/components/hud/catchUpSummary.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Events (brief 640 E1): the clock that lands one about once an hour of play, one at a time, drawn
 * among those that fit the place; a rich node that leaves at 0 charges or, when nobody can work
 * it, after an hour; a buff Token that leaves when its time is up, taking its boost with it; time
 * away; demolition.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const ORE = 'fixture_copper_ore';

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const provides = (id, value) => ({
    id: `stm_${id}`, keyword: 'provides', to: { mode: 'id', value: 'ev_vein' }, reach: 'nearby',
    payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value }
});

const node = (id, name, { uses, level, extra = {} }) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses, sprite: 't_ore_vein_copper',
    requiresHero: true, staysPut: true,
    config: { skill: 'mining', skillRequired: level, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [{ itemId: ORE, quantity: 6, chance: 100 }] },
    ...extra
});

const buff = (id, name, value) => ({
    id, name, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_minecart_copper',
    statements: [provides(id, value)]
});

registerTokenTypes({
    ev_comet: node('ev_comet', 'EV Copper Comet', { uses: 3, level: 1 }),
    ev_mythril: node('ev_mythril', 'EV Mythril Comet', { uses: 100, level: 60 }),
    ev_tooled: node('ev_tooled', 'EV Tooled Comet', { uses: 100, level: 1, extra: { needsTool: { kind: 'pickaxe' } } }),
    ev_shoal: node('ev_shoal', 'EV Fish Shoal', { uses: 50, level: 1, extra: { standsOn: ['water'] } }),
    ev_rain: buff('ev_rain', 'EV Rainfall', -0.2),
    ev_storm: buff('ev_storm', 'EV Storm', -0.6),
    ev_cart: { ...buff('ev_cart', 'EV Minecart', -0.3) },
    ev_vein: {
        id: 'ev_vein', name: 'EV Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 1000, sprite: 't_ore_vein_copper',
        requiresHero: true, staysPut: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [{ itemId: ORE, quantity: 1, chance: 100 }] }
    }
});

const COMET = { id: 'evt_comet', name: 'Copper Comet', typeId: 'ev_comet', kind: 'node', weight: 10 };
const MYTHRIL = { id: 'evt_mythril', name: 'Mythril Comet', typeId: 'ev_mythril', kind: 'node', weight: 10 };
const TOOLED = { id: 'evt_tooled', name: 'Tooled Comet', typeId: 'ev_tooled', kind: 'node', weight: 10 };
const SHOAL = { id: 'evt_shoal', name: 'Fish Shoal', typeId: 'ev_shoal', kind: 'node', weight: 10, ground: ['water'] };
const RAIN = { id: 'evt_rain', name: 'Rainfall', typeId: 'ev_rain', kind: 'buff', weight: 10, durationMinutes: 20 };
const STORM = { id: 'evt_storm', name: 'Storm', typeId: 'ev_storm', kind: 'buff', weight: 10, durationMinutes: 20 };

const table = (...rows) => Object.fromEntries(rows.map(r => [r.id, r]));

const VEIN = { x: 700, y: 500 };

function freshGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.rebuildAll();
}

/** Play `ms` of game time through the real tick handlers, in `step` ms ticks. */
function runFor(ms, step = 1000) {
    for (let t = 0; t < ms; t += step) GameLoop.runHandlers(step);
}

/** Make a Region of `fill(col, row)` terrain (and `biome` weights) the one the guild is in. */
function standOn(fill, biome = null) {
    const cols = Math.ceil(matW() / TERRAIN_CELL);
    const rows = Math.ceil(matH() / TERRAIN_CELL);
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(fill(c, r, cols, rows));
    const region = createRegionRecord('region_7');
    region.terrain = encodeTerrain({ cols, rows }, cells);
    region.biome = biome;
    GameState.state.atlas = { activeRegionId: region.id, nextRegionNumber: 8, regions: { [region.id]: region }, seed: null };
    return region.terrain;
}

function eventTokens() {
    return BoardState.tokens().filter(EventTokens.isEventToken);
}

/** Every `EVENT_ENDED` heard until `stop()`. */
function listenEnded() {
    const heard = [];
    const off = EventBus.subscribe(BOARD_EVENTS.EVENT_ENDED, (p) => heard.push(p));
    return { heard, stop: off };
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

beforeEach(() => {
    EventClock.setEnabled(true);
});

afterEach(() => {
    EventClock.setEnabled(false);
    resetEventsForTests();
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the switch', () => {
    it('starts off: the engine never lands an event unless something turns it on', async () => {
        vi.resetModules();
        const fresh = await import('../systems/events/EventClock.js');
        expect(fresh.isEnabled()).toBe(false);
    });

    it('while off, the clock stands and nothing lands, however long the game plays', () => {
        setEventsForTests(table(COMET));
        freshGame();
        EventClock.setEnabled(false);
        runFor(2 * HOUR);
        expect(EventClock.clockMs()).toBe(0);
        expect(eventTokens()).toEqual([]);
    });

    it('with no events in the table, nothing lands and the game plays on', () => {
        setEventsForTests({});
        freshGame();
        runFor(2 * HOUR);
        expect(eventTokens()).toEqual([]);
    });
});

describe('the clock', () => {
    it('lands an event after an hour of play, not before', () => {
        setEventsForTests(table(COMET));
        freshGame();
        runFor(HOUR - 1000);
        expect(eventTokens()).toEqual([]);
        expect(EventClock.clockMs()).toBe(HOUR - 1000);
        expect(EventClock.nextEventInMs()).toBe(1000);

        runFor(1000);
        const [landed] = eventTokens();
        expect(landed?.typeId).toBe('ev_comet');
        expect(landed.event).toMatchObject({ id: COMET.id, kind: 'node', name: 'Copper Comet' });
        expect(BoardState.originOf(landed)).toBe(BoardState.ORIGIN.SPAWNED);
        expect(landed.usesRemaining).toBe(3);
        expect(EventClock.clockMs()).toBe(0);
        expect(EventClock.nextEventInMs()).toBeNull();
    });

    it('one at a time: the clock waits while an event stands, and counts the hour from when it ended', () => {
        setEventsForTests(table({ ...RAIN, durationMinutes: 90 }));
        freshGame();
        const ended = listenEnded();
        runFor(HOUR);
        const [first] = eventTokens();
        expect(first?.typeId).toBe('ev_rain');

        runFor(89 * MIN);
        expect(eventTokens().map(t => t.id)).toEqual([first.id]);
        expect(EventClock.clockMs()).toBe(0);

        runFor(MIN);
        expect(eventTokens()).toEqual([]);
        expect(ended.heard).toEqual([expect.objectContaining({ instanceId: first.id, eventId: RAIN.id, reason: EventTokens.ENDED.TIME_UP })]);

        runFor(59 * MIN);
        expect(eventTokens()).toEqual([]);
        runFor(MIN);
        const [second] = eventTokens();
        expect(second?.typeId).toBe('ev_rain');
        expect(second.id).not.toBe(first.id);
        ended.stop();
    });

    it('when nothing fits, it tries again a few minutes later', () => {
        setEventsForTests(table(SHOAL));
        freshGame();
        runFor(HOUR);
        expect(eventTokens()).toEqual([]);
        expect(EventClock.nextEventInMs()).toBe(EventClock.EVENT_RETRY_MS);
    });

    it('a demolished event Token goes at once, with no hero, and the hour starts from then', () => {
        setEventsForTests(table(COMET));
        freshGame();
        const ended = listenEnded();
        const res = EventClock.landNow(COMET.id);
        expect(res.success).toBe(true);

        expect(Demolition.mark(res.instance.id)).toMatchObject({ success: true, removed: true });
        expect(BoardState.getTokenById(res.instance.id)).toBeNull();
        expect(ended.heard).toEqual([expect.objectContaining({ instanceId: res.instance.id, reason: EventTokens.ENDED.DEMOLISHED })]);

        runFor(1000);
        expect(EventClock.clockMs()).toBe(1000);
        ended.stop();
    });

    it('an event Token never counts toward the mat cap', () => {
        setEventsForTests(table(COMET));
        freshGame();
        const before = MatCap.tokenCount();
        const { instance } = EventClock.landNow(COMET.id);
        expect(MatCap.countsTowardCap(instance)).toBe(false);
        expect(MatCap.tokenCount()).toBe(before);
    });
});

describe('where an event lands', () => {
    it('a shoal never lands without water; the comet beside it in the table always does', () => {
        setEventsForTests(table(SHOAL, COMET));
        freshGame();
        expect(EventClock.fittingEvents().map(e => e.id)).toEqual([COMET.id]);
        for (let i = 0; i < 12; i++) {
            const landed = EventClock.landNext();
            expect(landed?.typeId).toBe('ev_comet');
            BoardState.removeToken(landed.id);
        }
    });

    it('with water on the mat, the shoal lands on water', () => {
        setEventsForTests(table(SHOAL));
        freshGame();
        // A lake on the left third of the mat.
        const map = standOn((c, r, cols) => (c < cols / 3 ? 'water' : 'grass'));
        for (let i = 0; i < 8; i++) {
            const landed = EventClock.landNext();
            expect(landed?.typeId).toBe('ev_shoal');
            expect(terrainAt(map, landed.x, landed.y)).toBe('water');
            BoardState.removeToken(landed.id);
        }
    });

    it('an event\'s own ground narrows where its Token lands', () => {
        setEventsForTests(table({ ...COMET, ground: ['rock'] }));
        freshGame();
        expect(EventClock.fittingEvents()).toEqual([]);
        const map = standOn((c, r, cols) => (c > (2 * cols) / 3 ? 'rock' : 'grass'));
        for (let i = 0; i < 8; i++) {
            const landed = EventClock.landNext();
            expect(terrainAt(map, landed.x, landed.y)).toBe('rock');
            BoardState.removeToken(landed.id);
        }
    });

    it('an event that lists biomes lands only in a Region of one of them', () => {
        setEventsForTests(table({ ...COMET, biomes: ['coast'] }));
        freshGame();
        expect(EventClock.regionBiomes()).toEqual(['meadow']);
        expect(EventClock.fittingEvents()).toEqual([]);
        standOn(() => 'grass', { forest: 2, coast: 1 });
        expect(EventClock.fittingEvents().map(e => e.id)).toEqual([COMET.id]);
    });

    it('is drawn by weight among those that fit', () => {
        setEventsForTests(table({ ...COMET, weight: 30 }, { ...RAIN, weight: 10 }));
        freshGame();
        const counts = { ev_comet: 0, ev_rain: 0 };
        for (let i = 0; i < 400; i++) {
            const landed = EventClock.landNext();
            counts[landed.typeId]++;
            BoardState.removeToken(landed.id);
        }
        // 3 to 1, give or take the luck of 400 draws.
        expect(counts.ev_comet / 400).toBeGreaterThan(0.68);
        expect(counts.ev_comet / 400).toBeLessThan(0.82);
    });
});

describe('a rich node', () => {
    it('stays put, is worked like any node and leaves at 0 charges', () => {
        setEventsForTests(table(COMET));
        freshGame();
        const ended = listenEnded();
        const [miner] = fixtures.makeHeroes(1, { mining: 10 });
        const { instance } = EventClock.landNow(COMET.id);
        expect(FixedTokens.isFixed(instance)).toBe(true);
        fixtures.orderAt(miner.id, { x: instance.x, y: instance.y });

        runFor(5 * MIN, 100);
        expect(BoardState.getTokenById(instance.id)).toBeNull();
        expect(InventoryManager.getItemCount(ORE) + SpriteLayer.countOnBoard(ORE)).toBe(18);
        expect(ended.heard).toEqual([expect.objectContaining({ instanceId: instance.id, reason: EventTokens.ENDED.WORKED_OUT })]);
        ended.stop();
    });

    it('one no hero can work (level) leaves after an hour', () => {
        setEventsForTests(table(MYTHRIL));
        freshGame();
        fixtures.makeHeroes(1, { mining: 10 });
        const ended = listenEnded();
        const { instance } = EventClock.landNow(MYTHRIL.id);
        expect(EventTokens.someHeroCanWork(instance)).toBe(false);

        runFor(59 * MIN);
        expect(BoardState.getTokenById(instance.id)).not.toBeNull();
        expect(EventTokens.leavesInMs(instance)).toBe(MIN);
        runFor(MIN);
        expect(BoardState.getTokenById(instance.id)).toBeNull();
        expect(ended.heard).toEqual([expect.objectContaining({ instanceId: instance.id, reason: EventTokens.ENDED.UNWORKED })]);
        ended.stop();
    });

    it('one no hero can work (no tool in hand) leaves after an hour too', () => {
        setEventsForTests(table(TOOLED));
        freshGame();
        fixtures.makeHeroes(1, { mining: 90 });
        const { instance } = EventClock.landNow(TOOLED.id);
        expect(EventTokens.someHeroCanWork(instance)).toBe(false);
        runFor(HOUR);
        expect(BoardState.getTokenById(instance.id)).toBeNull();
    });

    it('one a hero could work stays, its leaving clock held at zero, until it is worked out', () => {
        setEventsForTests(table(MYTHRIL));
        freshGame();
        fixtures.makeHeroes(1, { mining: 70 });
        const { instance } = EventClock.landNow(MYTHRIL.id);
        expect(EventTokens.someHeroCanWork(instance)).toBe(true);
        runFor(2 * HOUR);
        expect(BoardState.getTokenById(instance.id)).toBe(instance);
        expect(instance.clocks?.[EventTokens.EVENT_CLOCK] ?? 0).toBe(0);
        expect(EventTokens.leavesInMs(instance)).toBeNull();
    });
});

describe('a buff Token', () => {
    /** Land `event` and move its Token beside the vein, as a player's drag would. */
    function landBeside(event, at = { x: VEIN.x + 150, y: VEIN.y }) {
        const { instance } = EventClock.landNow(event.id);
        BoardState.setTokenPoint(instance.id, at.x, at.y);
        TileModifiers.rebuildAll();
        return instance;
    }

    it('is movable, gives its boost in reach, and leaves when its time is up, taking the boost with it', () => {
        setEventsForTests(table(RAIN));
        freshGame();
        const ended = listenEnded();
        const vein = fixtures.placeAt('ev_vein', VEIN.x, VEIN.y);
        TileModifiers.rebuildAll();
        expect(TileModifiers.workTimeOf(vein.id, 10000, 'mining')).toBe(10000);

        const rain = landBeside(RAIN);
        expect(FixedTokens.isFixed(rain)).toBe(false);
        expect(TileModifiers.workTimeOf(vein.id, 10000, 'mining')).toBe(8000);
        expect(EventTokens.leavesInMs(rain)).toBe(20 * MIN);

        runFor(20 * MIN - 1000);
        expect(BoardState.getTokenById(rain.id)).not.toBeNull();
        expect(EventTokens.leavesInMs(rain)).toBe(1000);
        runFor(1000);
        expect(BoardState.getTokenById(rain.id)).toBeNull();
        expect(TileModifiers.workTimeOf(vein.id, 10000, 'mining')).toBe(10000);
        expect(ended.heard).toEqual([expect.objectContaining({ instanceId: rain.id, reason: EventTokens.ENDED.TIME_UP })]);
        ended.stop();
    });

    it('adds to a building\'s boost of the same kind, inside the same limit', () => {
        setEventsForTests(table(RAIN, STORM));
        freshGame();
        const vein = fixtures.placeAt('ev_vein', VEIN.x, VEIN.y);
        fixtures.placeAt('ev_cart', VEIN.x - 150, VEIN.y);
        TileModifiers.rebuildAll();
        expect(TileModifiers.workTimeOf(vein.id, 10000, 'mining')).toBe(7000);

        const rain = landBeside(RAIN);
        // −30 % and −20 % make −50 %.
        expect(TileModifiers.workTimeOf(vein.id, 10000, 'mining')).toBe(5000);
        Demolition.mark(rain.id);

        landBeside(STORM);
        // −30 % and −60 % would be −90 %: no stack cuts more than 80 %.
        expect(TileModifiers.workTimeOf(vein.id, 10000, 'mining')).toBe(2000);
    });

    it('waits in the player\'s hand: its time up while carried, it leaves once put down', () => {
        setEventsForTests(table(RAIN));
        freshGame();
        const { instance } = EventClock.landNow(RAIN.id);
        Hand.setInHand(instance.id, true);
        runFor(25 * MIN);
        expect(BoardState.getTokenById(instance.id)).toBe(instance);
        Hand.setInHand(instance.id, false);
        runFor(1000);
        expect(BoardState.getTokenById(instance.id)).toBeNull();
    });
});

describe('time away', () => {
    const NOW = 1_800_000_000_000;

    it('events land and end during a catch-up, and the return report names them', async () => {
        setEventsForTests(table(RAIN));
        freshGame();
        const before = EventClock.landNow(RAIN.id).instance;

        const result = await CatchUp.run({ savedAt: NOW - 2 * HOUR, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        // The one standing left after 20 minutes; the next came an hour later and left 20 minutes on.
        expect(result.summary.events).toEqual([
            expect.objectContaining({ instanceId: before.id, eventId: RAIN.id, landed: false, ended: EventTokens.ENDED.TIME_UP }),
            expect.objectContaining({ eventId: RAIN.id, typeId: 'ev_rain', name: 'Rainfall', landed: true, ended: EventTokens.ENDED.TIME_UP })
        ]);
        const view = summaryView(result);
        expect(view.hasNews).toBe(true);
        expect(view.events.map(e => [e.name, e.landed, e.state])).toEqual([
            ['Rainfall', false, 'time_up'],
            ['Rainfall', true, 'time_up']
        ]);
    }, 60_000);

    it('an event still standing at the end is reported as still here', async () => {
        setEventsForTests(table(COMET));
        freshGame();
        fixtures.makeHeroes(1, { mining: 10 });
        const result = await CatchUp.run({ savedAt: NOW - (HOUR + 10 * MIN), now: NOW, save: false, yieldFn: () => Promise.resolve() });
        expect(result.summary.events).toEqual([expect.objectContaining({ eventId: COMET.id, landed: true, ended: null })]);
        expect(summaryView(result).events[0].state).toBe('here');
    }, 60_000);
});
