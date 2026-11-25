import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { GameState } from '../state/GameState.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import * as Flags from '../systems/board/Flags.js';
import * as Shrines from '../systems/board/Shrines.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools, recipesForToken } from '../config/registries/recipePoolRegistry.js';
import {
    STATION_KINDS, stationKindsOfSkill, stationKindLabel, shrineOf, offeringTermsOf, SHRINE_DEFAULTS, OFFERING_DEFAULTS
} from '../config/registries/tokenConstants.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * Faith's shrines (brief 810 K3): a shrine's rules (its blessing) hold only while it is lit. A Faith
 * hero working it spends an offering each cycle, and each offering keeps it lit a while longer (its
 * recipe's `offering.litMs`), up to the shrine's most (`shrine.maxLitMs`). The lit time runs down on
 * game time whether or not anybody tends it; at nothing the blessing goes out. A shrine lit too full
 * to take another whole offering is not worked until it has burned down.
 */

const CANDLE = 'fixture_fs_candle';
const INCENSE = 'fixture_fs_incense';
const ORE = 'fixture_fs_ore';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});

const BURN_CANDLE = 'fs_burn_candle';
const BURN_INCENSE = 'fs_burn_incense';
const MAKE_CANDLE = 'fs_make_candle';
const CANDLE_LIT_MS = 30_000;
const INCENSE_LIT_MS = 90_000;
const MAX_LIT_MS = 120_000;
const OFFERING_MS = 2_000;

const SHRINE = 'fs_shrine';
const BOARD_SHRINE = 'fs_board_shrine';
const ALTAR = 'fs_altar';
const VEIN = 'fs_vein';

const works = (id, kind) => ({ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'faith', stationKind: kind } });
const blessing = (id, reach = 'nearby') => ({
    id: `stm_${id}_blessing`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach,
    payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.5 }
});
const tend = { skill: 'faith', skillRequired: 1, cycleTimeMs: OFFERING_MS, xp: 0, inputs: [], outputs: [] };
const station = (id, name, statements, extra = {}) => ({
    id, name, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_shrine_forge_major',
    requiresHero: true, config: tend, statements, ...extra
});

function registerFixtures() {
    registerItems({
        [CANDLE]: item(CANDLE, 'Fixture Candle'),
        [INCENSE]: item(INCENSE, 'Fixture Incense'),
        [ORE]: item(ORE, 'Fixture Ore')
    });
    registerRecipePools({
        faith: [
            {
                id: BURN_CANDLE, name: 'Offer a Candle', skill: 'faith', levelRequirement: 1, durationMs: OFFERING_MS, xp: 2,
                stationKinds: ['shrine'], inputs: [{ itemId: CANDLE, quantity: 1 }], outputs: [], offering: { litMs: CANDLE_LIT_MS }
            },
            {
                id: BURN_INCENSE, name: 'Offer Incense', skill: 'faith', levelRequirement: 1, durationMs: OFFERING_MS, xp: 3,
                stationKinds: ['shrine'], inputs: [{ itemId: INCENSE, quantity: 1 }], outputs: [], offering: { litMs: INCENSE_LIT_MS }
            },
            {
                id: MAKE_CANDLE, name: 'Candle', skill: 'faith', levelRequirement: 1, durationMs: 3000, xp: 1,
                stationKinds: ['altar'], inputs: [], outputs: [{ itemId: CANDLE, chance: 100, minQty: 1, maxQty: 1 }]
            }
        ]
    });
    registerTokenTypes({
        [SHRINE]: station(SHRINE, 'Fixture Shrine', [works(SHRINE, 'shrine'), blessing(SHRINE)], { shrine: { maxLitMs: MAX_LIT_MS } }),
        [BOARD_SHRINE]: station(BOARD_SHRINE, 'Fixture Board Shrine', [works(BOARD_SHRINE, 'shrine'), blessing(BOARD_SHRINE, 'board')], { shrine: { maxLitMs: MAX_LIT_MS } }),
        [ALTAR]: station(ALTAR, 'Fixture Altar', [works(ALTAR, 'altar')]),
        [VEIN]: {
            id: VEIN, name: 'Fixture Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
            sprite: 't_ore_vein_copper', requiresHero: true,
            config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 4000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
        }
    });
}

const SHRINE_AT = { x: 800, y: 500 };
const VEIN_AT = { x: 960, y: 500 };
const FAR_AT = { x: 1600, y: 500 };

const step = (ms, by = 100) => { for (let t = 0; t < ms; t += by) GameLoop.runHandlers(by); };
const candles = () => InventoryManager.getItemCount(CANDLE);
/** The vein's work time as the runner reads it: 4000 ms, halved while a lit shrine's blessing reaches it. */
const veinTime = (vein) => TileModifiers.workTimeOf(vein.id, 4000, 'mining');

function freshBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.clearAll();
}

/** A shrine set to burn candles, a vein in its reach, and optionally a Faith hero ordered onto the shrine. */
function build({ tended = true, typeId = SHRINE, recipe = BURN_CANDLE, offerings = 10 } = {}) {
    freshBoard();
    const shrine = fixtures.placeAt(typeId, SHRINE_AT.x, SHRINE_AT.y);
    const vein = fixtures.placeAt(VEIN, VEIN_AT.x, VEIN_AT.y);
    expect(StationRecipe.setSelectedRecipe(shrine, recipe)).toBe(true);
    if (offerings) InventoryManager.addItem(recipe === BURN_INCENSE ? INCENSE : CANDLE, offerings);
    TileModifiers.rebuildAll();
    let heroId = null;
    if (tended) {
        const [hero] = fixtures.makeHeroes(1, { faith: 10, mining: 10 });
        heroId = hero.id;
        expect(fixtures.orderAt(heroId, SHRINE_AT).success).toBe(true);
    }
    return { shrine, vein, heroId };
}

/** Save and load the game as a player's slot does. */
function reload() {
    const data = JSON.parse(GameState.serializeJson());
    loadSavedState(migrateState(data.state, data.version));
    EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
    return data;
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
    registerFixtures();
});

beforeEach(() => freshBoard());

afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('Faith splits its recipes between the Altar and its shrines', () => {
    it('the Altar and the Shrine are Faith\'s station kinds, with words', () => {
        expect(STATION_KINDS).toContain('altar');
        expect(STATION_KINDS).toContain('shrine');
        expect(stationKindsOfSkill('faith')).toEqual(['altar', 'shrine']);
        expect(stationKindLabel('altar')).toBe('Altar');
        expect(stationKindLabel('shrine')).toBe('Shrine');
    });

    it('a shrine offers its offerings, the Altar what it makes, never each other\'s', () => {
        const ids = (typeId) => recipesForToken(getTokenType(typeId)).map(r => r.id).sort();
        expect(ids(SHRINE)).toEqual([BURN_CANDLE, BURN_INCENSE]);
        expect(ids(ALTAR)).toEqual([MAKE_CANDLE]);
    });

    it('a shrine block holds its most lit time; an offering its lit time; both have defaults', () => {
        expect(shrineOf(getTokenType(SHRINE))).toEqual({ maxLitMs: MAX_LIT_MS });
        expect(shrineOf(getTokenType(VEIN))).toBeNull();
        expect(shrineOf({ shrine: {} })).toEqual({ maxLitMs: SHRINE_DEFAULTS.maxLitMs });
        expect(shrineOf({ shrine: { maxLitMs: -5 } })).toEqual({ maxLitMs: SHRINE_DEFAULTS.maxLitMs });
        expect(offeringTermsOf({ offering: { litMs: 45_000 } })).toEqual({ litMs: 45_000 });
        expect(offeringTermsOf({})).toEqual({ litMs: OFFERING_DEFAULTS.litMs });
        expect(offeringTermsOf(null)).toEqual({ litMs: OFFERING_DEFAULTS.litMs });
    });
});

describe('a shrine gives its blessing only while it is lit', () => {
    it('a new shrine is out: its blessing reaches nothing', () => {
        const { shrine, vein } = build({ tended: false });
        expect(Shrines.isLit(shrine)).toBe(false);
        expect(veinTime(vein)).toBe(4000);
    });

    it('a Faith hero working it spends an offering each cycle, and each keeps it lit a while longer', () => {
        const { shrine, vein } = build();
        step(OFFERING_MS);
        expect(candles()).toBe(9);
        expect(Shrines.isLit(shrine)).toBe(true);
        expect(Shrines.litMsOf(shrine)).toBeGreaterThan(CANDLE_LIT_MS - 200);
        expect(Shrines.litMsOf(shrine)).toBeLessThanOrEqual(CANDLE_LIT_MS);
        // The blessing reaches the vein in its reach.
        expect(veinTime(vein)).toBe(2000);
        step(OFFERING_MS);
        expect(candles()).toBe(8);
        expect(Shrines.litMsOf(shrine)).toBeGreaterThan(2 * CANDLE_LIT_MS - OFFERING_MS - 200);
    });

    it('a shrine\'s blessing never reaches a Token out of its reach', () => {
        const { shrine } = build();
        const far = fixtures.placeAt(VEIN, FAR_AT.x, FAR_AT.y);
        TileModifiers.rebuildAll();
        step(OFFERING_MS);
        expect(Shrines.isLit(shrine)).toBe(true);
        expect(veinTime(far)).toBe(4000);
    });

    it('each offering keeps it lit for its own time', () => {
        const { shrine } = build({ recipe: BURN_INCENSE });
        step(OFFERING_MS);
        expect(InventoryManager.getItemCount(INCENSE)).toBe(9);
        expect(Shrines.litMsOf(shrine)).toBeGreaterThan(INCENSE_LIT_MS - 200);
        expect(Shrines.litMsOf(shrine)).toBeLessThanOrEqual(INCENSE_LIT_MS);
    });

    it('untended, the lit time runs down on game time and the blessing goes out at nothing, said once', () => {
        const { shrine, vein, heroId } = build({ offerings: 1 });
        step(OFFERING_MS);
        expect(Shrines.isLit(shrine)).toBe(true);
        // The hero has nothing left to offer: they stay, and the shrine burns down.
        expect(candles()).toBe(0);
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.SHRINE_LIT, (p) => heard.push(p));
        step(CANDLE_LIT_MS - 1000);
        expect(Shrines.isLit(shrine)).toBe(true);
        expect(veinTime(vein)).toBe(2000);
        step(2000);
        expect(Shrines.isLit(shrine)).toBe(false);
        expect(Shrines.litMsOf(shrine)).toBe(0);
        expect(veinTime(vein)).toBe(4000);
        off();
        expect(heard).toEqual([{ instanceId: shrine.id, lit: false, litMs: 0, maxLitMs: MAX_LIT_MS }]);
        // With no offering in the Bank, the hero's shrine says it needs one.
        expect(WorkCheck.fixableReason(shrine.id, shrine, heroId).reason).toBe(ALERT.INPUTS);
    });

    it('lighting says so with the lit time, once per offering', () => {
        const { shrine } = build();
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.SHRINE_LIT, (p) => heard.push(p));
        step(OFFERING_MS);
        off();
        expect(heard).toHaveLength(1);
        expect(heard[0]).toMatchObject({ instanceId: shrine.id, lit: true, maxLitMs: MAX_LIT_MS });
        expect(heard[0].litMs).toBeGreaterThan(CANDLE_LIT_MS - 200);
    });

    it('nobody spends an offering on a shrine too full to take a whole one; the hero waits and tends it once it has burned down', () => {
        const { shrine, heroId } = build();
        // 120 s at most, 30 s an offering: four offerings fill it, the fourth landing as the first has burned 6 s.
        step(4 * OFFERING_MS + 100);
        expect(candles()).toBe(6);
        expect(WorkCheck.fixableReason(shrine.id, shrine, heroId).reason).toBe(ALERT.SHRINE_FULL);
        expect(WorkCheck.isAway(shrine)).toBe(true);
        // Waiting by it is the hero's job, not idling.
        step(1000);
        expect(Flags.waitingOf(heroId)).toMatchObject({ instanceId: shrine.id, kind: 'node' });
        // About 20 s later there is room for a whole candle again, and the hero offers one.
        step(20_000);
        expect(candles()).toBe(6);
        step(12_000);
        expect(candles()).toBe(5);
        expect(Shrines.litMsOf(shrine)).toBeLessThanOrEqual(MAX_LIT_MS);
    });

    it('a shrine that is out always takes an offering, even one that lights it past its most', () => {
        const { shrine } = build({ recipe: BURN_INCENSE });
        shrine.shrine = { litMs: 0 };
        getTokenType(SHRINE).shrine.maxLitMs = 60_000;
        try {
            step(OFFERING_MS);
            expect(Shrines.litMsOf(shrine)).toBe(60_000);
        } finally {
            getTokenType(SHRINE).shrine.maxLitMs = MAX_LIT_MS;
        }
    });

    it('a board-wide blessing goes out with its shrine too', () => {
        const { shrine } = build({ typeId: BOARD_SHRINE, offerings: 1 });
        const far = fixtures.placeAt(VEIN, FAR_AT.x, FAR_AT.y);
        TileModifiers.rebuildAll();
        step(OFFERING_MS);
        expect(veinTime(far)).toBe(2000);
        step(CANDLE_LIT_MS + 1000);
        expect(Shrines.isLit(shrine)).toBe(false);
        expect(veinTime(far)).toBe(4000);
    });
});

describe('a lit shrine through a save and time away', () => {
    it('a save keeps its lit time: loaded, it still blesses and goes on burning down', () => {
        const { shrine, vein } = build({ offerings: 1 });
        step(OFFERING_MS);
        const left = Shrines.litMsOf(shrine);
        expect(left).toBeGreaterThan(0);
        reload();
        const loaded = BoardState.getTokenById(shrine.id);
        expect(loaded).not.toBe(shrine);
        expect(Shrines.litMsOf(loaded)).toBe(left);
        expect(Shrines.isLit(loaded)).toBe(true);
        expect(veinTime(BoardState.getTokenById(vein.id))).toBe(2000);
        step(left + 1000);
        expect(Shrines.isLit(loaded)).toBe(false);
        expect(veinTime(BoardState.getTokenById(vein.id))).toBe(2000 * 2);
    });

    it('a saved shrine that is out loads out', () => {
        const { shrine, vein } = build({ tended: false });
        reload();
        expect(Shrines.isLit(BoardState.getTokenById(shrine.id))).toBe(false);
        expect(veinTime(BoardState.getTokenById(vein.id))).toBe(4000);
    });

    it('time away untended: out once its lit time has run, through the game\'s own catch-up', async () => {
        const { shrine, vein, heroId } = build({ offerings: 1 });
        step(OFFERING_MS);
        // The hero goes home: nobody tends it while the player is away.
        Flags.furl(heroId);
        expect(Shrines.isLit(shrine)).toBe(true);
        const NOW = 1_800_000_000_000;
        await CatchUp.run({ save: false, yieldFn: () => Promise.resolve(), savedAt: NOW - 10 * 60_000, now: NOW });
        expect(Shrines.isLit(shrine)).toBe(false);
        expect(veinTime(vein)).toBe(4000);
    });

    it('time away tended: the catch-up spends the offerings the time needs, as the plain loop in its 1 s steps does', async () => {
        const AWAY = 3 * 60_000;
        const run = (stepMs) => {
            const { shrine } = build({ offerings: 8 });
            step(AWAY, stepMs);
            return { candles: candles(), litMs: Shrines.litMsOf(shrine), lit: Shrines.isLit(shrine) };
        };
        const small = run(100);
        const big = run(1000);
        const { shrine } = build({ offerings: 8 });
        const NOW = 1_800_000_000_000;
        await CatchUp.run({ save: false, yieldFn: () => Promise.resolve(), savedAt: NOW - AWAY, now: NOW });
        const caught = { candles: candles(), litMs: Shrines.litMsOf(shrine), lit: Shrines.isLit(shrine) };
        expect(caught).toEqual(big);
        // A 2 min shrine burning 30 s candles fills on four, then takes one every 30 s: the eight are
        // gone a little over 2 min in, and at 3 min it still burns on what was offered last.
        expect(small.candles).toBe(0);
        expect(caught.candles).toBe(0);
        expect(caught.lit).toBe(true);
        expect(caught.litMs).toBeGreaterThan(30_000);
        expect(caught.litMs).toBeLessThan(90_000);
        // The small steps and the big ones agree within a step on how long it has left.
        expect(Math.abs(small.litMs - caught.litMs)).toBeLessThanOrEqual(2000);
    });
});
