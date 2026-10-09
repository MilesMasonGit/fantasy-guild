import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { GameState } from '../state/GameState.js';
import { createEmptyBoard, validateSaveData } from '../state/StateSchema.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Flags from '../systems/board/Flags.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { matW, matH } from '../config/matGeometry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { canon } from '../../bench/lib/fingerprint.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ Travel between Regions: the guild leaves one board frozen in the Atlas and takes up another.
 * Travel must do to the engine exactly what a load does, or a Region would come back subtly
 * different from how it was left; the guard for that is "there and back equals save and load".
 */

const HALL = 'fixture_atlas_hall';
const SAPLING = 'fixture_atlas_sapling';
const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = 1_800_000_000_000;

registerTokenTypes({
    // The bench's inert Hall, paying one Oak Wood on the Passive Production timer.
    [HALL]: {
        ...fixtures.BENCH_TOKENS.bench_hall, id: HALL, name: 'Atlas Hall',
        trickle: [{ itemId: 'fixture_oak_wood', quantity: 1 }]
    },
    [SAPLING]: {
        id: SAPLING, name: 'Atlas Sapling', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 'skill_nature', grows: { into: 'fixture_producer', afterMs: 10 * MIN }
    }
});

const centre = () => ({ x: Math.round(matW() / 2), y: Math.round(matH() / 2) });
const step = (n, ms = 100) => { for (let i = 0; i < n; i++) GameLoop.runHandlers(ms); };
/** Tick until `done()` holds, at most `max` ticks. */
function stepUntil(done, max) {
    for (let i = 0; i < max; i++) {
        if (done()) return true;
        GameLoop.runHandlers(100);
    }
    return done();
}
const hallOnMat = () => BoardState.tokens().filter(t => MatCap.isGuildHall(t));
const typesOnMat = () => BoardState.tokens().map(t => t.typeId);
/** What stands on the mat besides the quest Tokens (which travel with the Hall). */
const regionTypesOnMat = () => typesOnMat().filter(typeId => typeId !== 'token_quest');
const copy = (v) => JSON.parse(JSON.stringify(v));

/** A board's saved shape, minus the work notes travel deliberately drops. */
function boardWithoutNotes(board) {
    const out = copy(board);
    delete out.workClaims;
    return out;
}

/**
 * Region A: the Hall in the middle, a Forest spawner, a growing sapling, two producers and a goblin
 * camp, three heroes working. Returns the pieces.
 */
function buildRegionA() {
    const c = centre();
    const hall = fixtures.placeAt(HALL, c.x, c.y);
    const forest = fixtures.placeAt('bench_forest', c.x - 480, c.y);
    const sapling = fixtures.placeAt(SAPLING, c.x - 480, c.y + 320);
    const producer = fixtures.placeAt('fixture_producer', c.x + 320, c.y);
    const alt = fixtures.placeAt('fixture_producer_alt', c.x + 320, c.y + 320);
    const camp = fixtures.placeAt('bench_camp', c.x, c.y - 360);
    fixtures.prefillSpawners();
    const heroes = fixtures.makeHeroes(3);
    fixtures.plant(heroes[0].id, { x: producer.x, y: producer.y }, { pin: true });
    fixtures.plant(heroes[1].id, { x: alt.x, y: alt.y }, { pin: true });
    fixtures.plant(heroes[2].id, { x: camp.x + 160, y: camp.y });
    TileModifiers.rebuildAll();
    // As a new game does: this board is the first Region.
    Atlas.createStarterRegion();
    return { hall, forest, sapling, producer, alt, camp, heroes };
}

function newBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.maxSlots = 64;
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    newBoard();
});

afterEach(() => {
    SaveManager.currentSlot = null;
    GameLoop.stop();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('travel stores the old board whole and installs the other', () => {
    it('the old board goes into its Region, minus the Hall; the new mat holds only the Hall', () => {
        const { hall } = buildRegionA();
        step(100);
        SpriteLayer.collectAll();
        const before = copy(GameState.state.board);
        const quests = QuestTokens.questTokens().map(t => t.id);
        expect(quests.length).toBeGreaterThan(0);
        const a = Atlas.activeRegionId();
        const b = Atlas.devCreateEmptyRegion().id;

        expect(Atlas.travel(b)).toMatchObject({ success: true, fromRegionId: a, toRegionId: b });

        expect(Atlas.activeRegionId()).toBe(b);
        expect(Atlas.getRegion(b).board).toBeNull();
        expect(regionTypesOnMat()).toEqual([HALL]);
        expect(QuestTokens.questTokens().map(t => t.id)).toEqual(quests);
        expect(hallOnMat()[0]).toBe(hall);
        expect({ x: hall.x, y: hall.y }).toEqual(centre());

        const frozen = Atlas.getRegion(a).board;
        expect(Object.keys(frozen).sort()).toEqual(Object.keys(createEmptyBoard()).sort());
        const expected = { ...before.tokens };
        for (const id of [hall.id, ...quests]) delete expected[id];
        expect(canon(frozen.tokens)).toBe(canon(expected));
        expect(frozen.flags).toEqual(before.flags);
        expect(frozen.nextTokenOrder).toBe(before.nextTokenOrder);
        expect(frozen.nextFlagOrder).toBe(before.nextFlagOrder);
        expect(Atlas.getRegion(a).travellers[hall.id]).toEqual({ x: before.tokens[hall.id].x, y: before.tokens[hall.id].y, placedAt: before.tokens[hall.id].placedAt });
    });

    it('publishes the board swap for the engine, then GAME_RESET for the screen, and saves', () => {
        const store = new Map();
        vi.stubGlobal('localStorage', {
            getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
            removeItem: (k) => store.delete(k)
        });
        try {
            buildRegionA();
            SaveManager.currentSlot = 0;
            const a = Atlas.activeRegionId();
            const b = Atlas.devCreateEmptyRegion().id;
            const seen = [];
            const offs = [
                EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, (p) => seen.push(['swapped', p])),
                EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, (p) => seen.push(['reset', p]))
            ];
            Atlas.travel(b);
            offs.forEach(off => off());
            expect(seen).toEqual([
                ['swapped', { fromRegionId: a, toRegionId: b }],
                ['reset', { reason: 'travel' }]
            ]);
            const saved = JSON.parse(store.get(SaveManager.getSlotKey(0)));
            expect(saved.state.atlas.activeRegionId).toBe(b);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe('⭐ there and back equals save and load', () => {
    it('Tokens, clocks, charges and flags come back exactly as a save would keep them', () => {
        const { producer, forest, sapling } = buildRegionA();
        step(250);
        SpriteLayer.collectAll();
        // What the guard is about: work part-done, clocks part-run, charges part-spent.
        expect(producer.cycleElapsedMs).toBeGreaterThan(0);
        expect(producer.usesRemaining).toBeLessThan(5000);
        expect(forest.clocks.spawnMs).toBeGreaterThan(0);
        expect(BoardState.getTokenById(sapling.id).clocks.growMs).toBeGreaterThan(0);

        const saved = JSON.parse(GameState.serializeJson()).state.board;
        const a = Atlas.activeRegionId();
        const b = Atlas.devCreateEmptyRegion().id;
        Atlas.travel(b);
        Atlas.travel(a);

        const back = copy(GameState.state.board);
        expect(canon(boardWithoutNotes(back))).toBe(canon(boardWithoutNotes(saved)));
        // Heroes arrive with no claim: the notes a load would use to put them back at work are gone.
        expect(back.workClaims).toEqual({});
        // The Hall is back where it stood, in the same place in the arrival order.
        expect(BoardState.tokens().map(t => t.id)).toEqual(
            Object.values(saved.tokens).sort((x, y) => x.placedAt - y.placedAt).map(t => t.id)
        );
    });

    it('a reload keeps both Regions, the frozen one intact', async () => {
        buildRegionA();
        step(50);
        SpriteLayer.collectAll();
        const a = Atlas.activeRegionId();
        const b = Atlas.devCreateEmptyRegion().id;
        Atlas.travel(b);
        const frozen = canon(Atlas.getRegion(a).board);

        const data = JSON.parse(GameState.serializeJson());
        const state = migrateState(data.state, data.version);
        expect(validateSaveData({ version: data.version, state }).errors).toEqual([]);
        await GameState.initFromSave(state);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });

        expect(Atlas.list().map(r => r.id)).toEqual([a, b]);
        expect(Atlas.activeRegionId()).toBe(b);
        expect(canon(Atlas.getRegion(a).board)).toBe(frozen);
        expect(regionTypesOnMat()).toEqual([HALL]);
        Atlas.travel(a);
        expect(typesOnMat()).toContain('fixture_producer');
    });
});

describe('arriving rebuilds what a load rebuilds', () => {
    it('a Region\'s neighbour buffs hold on arrival, even one this session has never drawn up', async () => {
        buildRegionA();
        const a = Atlas.activeRegionId();
        const b = Atlas.devCreateEmptyRegion().id;
        Atlas.travel(b);
        const producer = fixtures.placeAt('fixture_producer', 400, 400);
        fixtures.placeAt('fixture_buff_yield', 560, 400);
        TileModifiers.rebuildAll();
        const buffed = TileModifiers.resolveAxis(producer.id, EFFECT_TYPES.YIELD, 100);
        expect(buffed).toBeGreaterThan(100);
        Atlas.travel(a);

        // A reload in Region A: the tile caches now know A's Tokens and nothing of B's.
        const data = JSON.parse(GameState.serializeJson());
        await GameState.initFromSave(migrateState(data.state, data.version));
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });

        Atlas.travel(b);
        expect(TileModifiers.resolveAxis(producer.id, EFFECT_TYPES.YIELD, 100)).toBe(buffed);
    });

    it('a spawner\'s alert stays with the board it was raised on', () => {
        const { forest } = buildRegionA();
        // Below its family cap, but the mat is full: the spawner waits with an alert up.
        BoardState.removeToken(BoardState.tokens().find(t => t.typeId === 'bench_tree').id);
        setMatTuning('tokenCap', 1);
        step(1);
        expect(SpawnerSystem.spawnerAlertOf(forest.id)).toBeTruthy();
        Atlas.travel(Atlas.devCreateEmptyRegion().id);
        expect(SpawnerSystem.spawnerAlertOf(forest.id)).toBeNull();
    });
});

describe('frozen Regions stand still', () => {
    it('a frozen Region\'s clocks, charges and loot do not move during an hour of play elsewhere', () => {
        buildRegionA();
        step(200);
        // One pile the Bank cannot take stays on the floor.
        SpriteLayer.collectAll();
        GameState.state.inventory.maxSlots = Object.keys(GameState.state.inventory.items).length;
        SpriteLayer.addSprite('item', 'item_glowcap', 3, null);
        const a = Atlas.activeRegionId();
        Atlas.travel(Atlas.devCreateEmptyRegion().id);
        const frozen = JSON.stringify(Atlas.getRegion(a).board);
        expect(Atlas.getRegion(a).board.sprites.map(s => s.refId)).toEqual(['item_glowcap']);

        const before = GameState.state.time.gameTimeMs;
        step(3600, 1000);
        expect(GameState.state.time.gameTimeMs - before).toBe(HOUR);
        expect(JSON.stringify(Atlas.getRegion(a).board)).toBe(frozen);
    });

    it('a catch-up plays only the active Region', async () => {
        const { hall } = buildRegionA();
        step(50);
        SpriteLayer.collectAll();
        const a = Atlas.activeRegionId();
        Atlas.travel(Atlas.devCreateEmptyRegion().id);
        const frozen = JSON.stringify(Atlas.getRegion(a).board);
        const lap = hall.clocks.passiveMs;

        const result = await CatchUp.run({ savedAt: NOW - HOUR, now: NOW, save: false, reset: false, yieldFn: () => Promise.resolve() });
        expect(result.simulatedMs).toBe(HOUR);
        expect(JSON.stringify(Atlas.getRegion(a).board)).toBe(frozen);
        // The Hall, which came along, kept running: twelve 5-minute laps of Passive Production.
        expect(hall.clocks.passiveMs).toBe(lap);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(12);
    });
});

describe('what travels with the guild', () => {
    it('the Hall is one instance that travels with its Passive Production clock', () => {
        const { hall } = buildRegionA();
        step(600);
        const placedAt = hall.placedAt;
        const at = { x: hall.x, y: hall.y };
        expect(hall.clocks.passiveMs).toBe(60_000);

        const a = Atlas.activeRegionId();
        const b = Atlas.devCreateEmptyRegion().id;
        Atlas.travel(b);
        expect(hallOnMat()).toEqual([hall]);
        expect(hall.clocks.passiveMs).toBe(60_000);
        expect(Object.values(Atlas.getRegion(a).board.tokens).some(t => MatCap.isGuildHall(t))).toBe(false);
        step(100);
        expect(hall.clocks.passiveMs).toBe(70_000);

        Atlas.travel(a);
        expect(hallOnMat()).toEqual([hall]);
        expect({ x: hall.x, y: hall.y }).toEqual(at);
        expect(hall.placedAt).toBe(placedAt);
        expect(Object.values(Atlas.getRegion(b).board.tokens)).toEqual([]);
    });

    it('quest Tokens travel beside the Hall, and the bounty clock is the guild\'s', () => {
        const { hall } = buildRegionA();
        expect(QuestTokens.spawnBounty()).toBeTruthy();
        QuestTokens.ensure();
        step(30);
        const quests = QuestTokens.questTokens();
        expect(quests.length).toBeGreaterThanOrEqual(2);
        const offsets = new Map(quests.map(q => [q.id, { dx: q.x - hall.x, dy: q.y - hall.y }]));
        const clock = GameState.state.quests.clockMs;

        const a = Atlas.activeRegionId();
        Atlas.travel(Atlas.devCreateEmptyRegion().id);
        expect(QuestTokens.questTokens().map(q => q.id).sort()).toEqual([...offsets.keys()].sort());
        for (const q of QuestTokens.questTokens()) {
            expect({ dx: q.x - hall.x, dy: q.y - hall.y }).toEqual(offsets.get(q.id));
        }
        expect(Object.values(Atlas.getRegion(a).board.tokens).some(t => QuestTokens.isQuestToken(t))).toBe(false);
        expect(GameState.state.quests.clockMs).toBe(clock);
        step(10);
        expect(GameState.state.quests.clockMs).toBe(clock + 1000);
    });

    it('floor loot is banked on leaving; what the Bank cannot hold stays on that Region\'s floor', () => {
        const { hall } = buildRegionA();
        // A Bank with room for two kinds of item: the third pile cannot be banked.
        expect(GameState.state.inventory.items).toEqual({});
        GameState.state.inventory.maxSlots = 2;
        SpriteLayer.addSprite('item', 'fixture_oak_wood', 5, hall.id);
        SpriteLayer.addSprite('item', 'fixture_copper_ore', 2, hall.id);
        SpriteLayer.addSprite('item', 'item_bones', 4, hall.id);

        const a = Atlas.activeRegionId();
        const b = Atlas.devCreateEmptyRegion().id;
        const result = Atlas.travel(b);
        expect(InventoryManager.getItemCount('fixture_oak_wood')).toBe(5);
        expect(InventoryManager.getItemCount('fixture_copper_ore')).toBe(2);
        expect(InventoryManager.getItemCount('item_bones')).toBe(0);
        expect(result).toMatchObject({ banked: 2, leftOnFloor: 1 });
        expect(Atlas.getRegion(a).board.sprites.map(s => [s.refId, s.quantity])).toEqual([['item_bones', 4]]);
        expect(SpriteLayer.getSprites()).toEqual([]);

        Atlas.travel(a);
        expect(SpriteLayer.getSprites().map(s => [s.refId, s.quantity])).toEqual([['item_bones', 4]]);
    });
});

describe('heroes on arrival', () => {
    it('a brand-new Region starts with every hero in the Dock, with no claim and no fight', () => {
        const { heroes } = buildRegionA();
        expect(stepUntil(() => heroes.some(h => BoardCombat.fightOfHero(h.id)), 3000)).toBe(true);
        expect(heroes.every(h => BoardState.claimOfHero(h.id))).toBe(true);

        Atlas.travel(Atlas.devCreateEmptyRegion().id);
        for (const h of heroes) {
            expect(BoardState.flagOf(h.id)).toBeNull();
            expect(Flags.statusOf(h.id).state).toBe('docked');
            expect(BoardState.claimOfHero(h.id)).toBeNull();
            expect(BoardCombat.fightOfHero(h.id)).toBeNull();
        }
    });

    it('going back, every hero stands at their flag with no claim and no fight, then goes back to work', () => {
        const { heroes } = buildRegionA();
        expect(stepUntil(() => heroes.some(h => BoardCombat.fightOfHero(h.id)), 3000)).toBe(true);
        const flags = copy(GameState.state.board).flags;
        const a = Atlas.activeRegionId();
        Atlas.travel(Atlas.devCreateEmptyRegion().id);
        Atlas.travel(a);

        expect(copy(GameState.state.board).flags).toEqual(flags);
        for (const h of heroes) {
            expect(BoardState.claimOfHero(h.id)).toBeNull();
            expect(BoardCombat.fightOfHero(h.id)).toBeNull();
            expect(BoardState.heroBodyOf(h.id)).toBeTruthy();
            expect(Flags.statusOf(h.id).state).not.toBe('docked');
        }
        // The two heroes pinned to producers are back at them on the very next tick.
        step(1);
        for (const h of heroes.slice(0, 2)) expect(BoardState.workTokenOf(h.id)).toBe(Flags.pinnedIdOf(h.id));
    });
});

describe('the Token cap counts only the active Region', () => {
    it('frozen Tokens are not counted; the ones on the mat are', () => {
        buildRegionA();
        const counted = MatCap.tokenCount();
        expect(counted).toBeGreaterThan(5);
        const a = Atlas.activeRegionId();
        Atlas.travel(Atlas.devCreateEmptyRegion().id);
        expect(MatCap.tokenCount()).toBe(0);
        fixtures.placeAt('fixture_producer', 200, 200);
        fixtures.placeAt('fixture_producer', 200, 500);
        expect(MatCap.tokenCount()).toBe(2);
        Atlas.travel(a);
        expect(MatCap.tokenCount()).toBe(counted);
    });
});

describe('travel refusals', () => {
    it('refuses the Region the guild is in and one that does not exist', () => {
        buildRegionA();
        expect(Atlas.travel(Atlas.activeRegionId()).success).toBe(false);
        expect(Atlas.travel('region_404').success).toBe(false);
        expect(Atlas.list()).toHaveLength(1);
    });

    it('refuses while a catch-up is playing', async () => {
        buildRegionA();
        const b = Atlas.devCreateEmptyRegion().id;
        let release;
        const gate = new Promise(r => { release = r; });
        const running = CatchUp.run({ savedAt: NOW - 10 * MIN, now: NOW, save: false, reset: false, sliceMs: 0, yieldFn: () => gate });
        expect(CatchUp.isRunning()).toBe(true);
        expect(Atlas.travel(b).success).toBe(false);
        release();
        await running;
        expect(Atlas.travel(b).success).toBe(true);
    });
});

/**
 * ⭐ The guard: travel there and back, then play a minute, ends exactly where saving, loading and
 * playing the same minute does, with heroes arriving without their work notes either way. Each run
 * gets fresh engine modules, as each bench scenario gets a fresh process, so module-level state
 * (fights, spawner alerts, the cycle carry-over, caches) left by one run cannot leak into the other.
 */
describe('⭐ there and back plays exactly like save and load (fresh engine per run)', () => {
    const START = 1_800_000_000_000;

    /** The bench's mulberry32, as one stable function whose state can be rewound. */
    function seededRandom() {
        let state = 1;
        let draws = 0;
        const fn = () => {
            draws++;
            state = (state + 0x6D2B79F5) | 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        return { fn, reseed(seed) { state = seed | 0; draws = 0; }, draws: () => draws };
    }

    const rng = seededRandom();
    let clockMs = START;
    const realRandom = Math.random;

    async function freshEngine() {
        vi.resetModules();
        rng.reseed(1);
        clockMs = START;
        const m = {
            SettingsManager: (await import('../systems/core/SettingsManager.js')).SettingsManager,
            EngineBootstrap: (await import('../systems/core/EngineBootstrap.js')).EngineBootstrap,
            GameLoop: (await import('../systems/core/GameLoop.js')).GameLoop,
            GameState: (await import('../state/GameState.js')).GameState,
            InventoryManager: (await import('../systems/inventory/InventoryManager.js')).InventoryManager,
            DiscoveryManager: (await import('../systems/core/DiscoveryManager.js')).DiscoveryManager,
            EventBus: (await import('../systems/core/EventBus.js')).EventBus,
            TileModifiers: await import('../systems/board/TileModifiers.js'),
            SpriteLayer: await import('../systems/board/SpriteLayer.js'),
            Atlas: await import('../systems/atlas/Atlas.js'),
            SaveMigration: await import('../systems/core/SaveMigration.js'),
            matTuning: await import('../config/matTuning.js'),
            fixtures: await import('../../bench/fixtures.mjs'),
            realistic: await import('../../bench/scenarios/realistic.mjs'),
            fingerprint: await import('../../bench/lib/fingerprint.mjs')
        };
        m.SettingsManager.init();
        m.EngineBootstrap.init();
        m.GameLoop.stop();
        m.GameState.initNew();
        m.InventoryManager.init();
        m.realistic.buildRealistic({ fixtures: m.fixtures, setMatTuning: m.matTuning.setMatTuning });
        m.TileModifiers.rebuildAll();
        m.tick = (n) => {
            for (let i = 0; i < n; i++) {
                clockMs += 100;
                m.GameLoop.runHandlers(100);
            }
        };
        // Warm: heroes at work, fights on, cycles part-done.
        m.tick(400);
        m.SpriteLayer.collectAll();
        return m;
    }

    function fingerprintOf(m) {
        globalThis.__bench = { draws: rng.draws };
        try {
            return m.fingerprint.fingerprint();
        } finally {
            delete globalThis.__bench;
        }
    }

    const results = {};

    beforeAll(async () => {
        Math.random = rng.fn;
        vi.spyOn(Date, 'now').mockImplementation(() => clockMs);
        try {
            // There and back.
            const t = await freshEngine();
            results.branchT = fingerprintOf(t);
            const home = t.Atlas.createStarterRegion().id;
            const away = t.Atlas.devCreateEmptyRegion().id;
            results.travelled = [t.Atlas.travel(away).success, t.Atlas.travel(home).success];
            rng.reseed(7);
            t.tick(600);
            results.T = fingerprintOf(t);

            // Save and load, the work notes dropped as travel drops them.
            const l = await freshEngine();
            results.branchL = fingerprintOf(l);
            const data = JSON.parse(l.GameState.serializeJson());
            data.state.board.workClaims = {};
            const state = l.SaveMigration.migrateState(data.state, data.version);
            await l.GameState.initFromSave(state);
            l.EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
            l.DiscoveryManager.init();
            l.InventoryManager.init();
            rng.reseed(7);
            l.tick(600);
            results.L = fingerprintOf(l);
        } finally {
            Math.random = realRandom;
            vi.restoreAllMocks();
            vi.spyOn(console, 'log').mockImplementation(() => {});
        }
    }, 120_000);

    it('both runs reach the branch point identically (the comparison is fair)', () => {
        expect(results.travelled).toEqual([true, true]);
        expect(results.branchT).toEqual(results.branchL);
        expect(results.branchT.tokens).toBeGreaterThan(80);
    });

    it('a minute after, Tokens, Bank, heroes, loot, the bin and every random draw agree', () => {
        expect(results.T).toEqual(results.L);
        expect(results.T.randomDraws).toBeGreaterThan(0);
        expect(results.T.heroXp).toBeGreaterThan(results.branchT.heroXp);
    });
});
