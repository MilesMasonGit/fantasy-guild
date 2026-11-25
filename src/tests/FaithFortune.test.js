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
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Fortune from '../systems/board/Fortune.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { renderStatement, effectParts } from '../systems/effects/statementText.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { rareTableOf, rarestEntry } from '../config/registries/rareTables.js';
import { getPaletteEntry, MODIFIER_SHAPES } from '../config/registries/modifierPalette.js';
import { effectTag } from '../config/registries/effectWords.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * Fortune, the Shrine of Fortune's blessing (owner 2026-11-25): every so many finished cycles of a
 * Token in a lit shrine's reach, that Token gives its rarest drop for certain. The rule's number is
 * how far each finished cycle counts toward it, in percent (25: every fourth cycle); two shrines add
 * up. The count is the Token's own, and saved.
 * "Rarest" is the lowest-chance entry of the Token's rare table, or with no rare table its
 * lowest-chance item line; a Token whose lines all drop for certain has none, and Fortune counts
 * nothing there.
 */

const ORE = 'fixture_ff_ore';
const GEM = 'fixture_ff_gem';
const PEARL = 'fixture_ff_pearl';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});

// A chance far too small to come up in a test's handful of cycles: what lands, Fortune gave.
const NEVER = 0.0001;

const TABLE_VEIN = 'ff_table_vein';
const LINE_VEIN = 'ff_line_vein';
const PLAIN_VEIN = 'ff_plain_vein';
const SHRINE = 'ff_shrine';
const MINING_SHRINE = 'ff_mining_shrine';
const ECHO_SHRINE = 'ff_echo_shrine';
const JINX = 'ff_jinx';

const CYCLE_MS = 1000;
const POINTS = 25;

const blessing = (id, value, extra = {}) => ({
    id: `stm_${id}_fortune`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
    payload: { type: EFFECT_TYPES.FORTUNE, bucket: 'flat', value, ...extra }
});
const shrine = (id, statements) => ({
    id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_shrine_forest',
    requiresHero: true, shrine: { maxLitMs: 600_000 },
    config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
    statements: [{ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'faith', stationKind: 'shrine' } }, ...statements]
});
const vein = (id, outputs, extra = {}) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_ore_vein_copper',
    requiresHero: true,
    config: { skill: 'mining', skillRequired: 1, cycleTimeMs: CYCLE_MS, xp: 1, inputs: [], outputs },
    ...extra
});
const sure = (itemId) => ({ itemId, chance: 100, minQty: 1, maxQty: 1 });

function registerFixtures() {
    registerItems({ [ORE]: item(ORE, 'Fortune Ore'), [GEM]: item(GEM, 'Fortune Gem'), [PEARL]: item(PEARL, 'Fortune Pearl') });
    registerTokenTypes({
        // A rare table of two finds: the Pearl is the rarer (weight 1 of 10).
        [TABLE_VEIN]: vein(TABLE_VEIN, [sure(ORE)], {
            rareTable: { chance: NEVER, entries: [{ itemId: GEM, weight: 9, minQty: 1, maxQty: 1 }, { itemId: PEARL, weight: 1, minQty: 1, maxQty: 1 }] }
        }),
        // No rare table: its rarest line is the Gem.
        [LINE_VEIN]: vein(LINE_VEIN, [sure(ORE), { itemId: PEARL, chance: 5, minQty: 1, maxQty: 1 }, { itemId: GEM, chance: NEVER, minQty: 1, maxQty: 1 }]),
        // Neither: every line drops for certain.
        [PLAIN_VEIN]: vein(PLAIN_VEIN, [sure(ORE)]),
        [SHRINE]: shrine(SHRINE, [blessing(SHRINE, POINTS)]),
        [MINING_SHRINE]: shrine(MINING_SHRINE, [blessing(MINING_SHRINE, POINTS, { category: 'forestry' })]),
        [ECHO_SHRINE]: shrine(ECHO_SHRINE, [{
            id: `stm_${ECHO_SHRINE}_echo`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
            payload: { type: EFFECT_TYPES.ECHO, bucket: 'flat', value: 100 }
        }]),
        [JINX]: {
            id: JINX, name: 'Jinx', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', requiresHero: false,
            statements: [{ id: 'stm_ff_jinx', keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
                payload: { type: EFFECT_TYPES.FAIL_CHANCE, bucket: 'flat', value: 100 } }]
        }
    });
}

const WORK = { x: 800, y: 500 };
const BESIDE = { x: 960, y: 500 };
const OTHER_SIDE = { x: 640, y: 500 };
const FAR = { x: 1700, y: 500 };

const step = (ms, by = 100) => { for (let t = 0; t < ms; t += by) GameLoop.runHandlers(by); };
const lootOf = (itemId) => SpriteLayer.countOnBoard(itemId) + InventoryManager.getItemCount(itemId);

function freshBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.clearAll();
}

/** A shrine at `at`, lit for ten minutes (lighting itself is `FaithShrines.test.js`'). */
function litShrine(typeId = SHRINE, at = BESIDE) {
    const s = fixtures.placeAt(typeId, at.x, at.y);
    s.shrine = { litMs: 600_000 };
    TileModifiers.rebuildAll();
    return s;
}

/** A vein at WORK, a miner on it, and the shrines `setUp` places. */
function build(veinType = TABLE_VEIN, setUp = () => litShrine()) {
    freshBoard();
    const v = fixtures.placeAt(veinType, WORK.x, WORK.y);
    setUp();
    TileModifiers.rebuildAll();
    const [hero] = fixtures.makeHeroes(1, { mining: 10 });
    expect(fixtures.orderAt(hero.id, WORK).success).toBe(true);
    return { vein: v, heroId: hero.id };
}

/** Run `n` of the vein's cycles (each finishes inside the step after its time). */
const cycles = (n) => step(n * CYCLE_MS + 50);

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

describe('the rarest drop', () => {
    it('is the rare table\'s lowest-chance entry, the first of equals', () => {
        const table = rareTableOf({ rareTable: { chance: 1, entries: [
            { itemId: GEM, weight: 5 }, { itemId: PEARL, weight: 2 }, { itemId: ORE, weight: 2 }
        ] } });
        expect(rarestEntry(table).itemId).toBe(PEARL);
    });

    it('with no rare table, the lowest-chance item line; with every line sure, none', () => {
        const lines = [sure(ORE), { itemId: PEARL, chance: 5 }, { itemId: GEM, chance: 0.5 }, { tokenId: 'a_token', chance: 0.1 }];
        expect(Fortune.rarestDropOf({}, lines)).toEqual({ line: lines[2] });
        expect(Fortune.rarestDropOf({}, [sure(ORE)])).toBeNull();
        expect(Fortune.rarestDropOf({}, [])).toBeNull();
        const withTable = { rareTable: { chance: 1, entries: [{ itemId: PEARL, weight: 1 }] } };
        expect(Fortune.rarestDropOf(withTable, lines).entry.itemId).toBe(PEARL);
    });
});

describe('Fortune: a sure rare find every so many finished cycles', () => {
    it('at 25, every fourth cycle gives the rare table\'s rarest find, and only that', () => {
        const { vein } = build();
        cycles(3);
        expect(lootOf(PEARL)).toBe(0);
        expect(Fortune.countOf(vein)).toBe(75);
        cycles(1);
        expect(lootOf(PEARL)).toBe(1);
        expect(lootOf(GEM)).toBe(0);
        expect(Fortune.countOf(vein)).toBe(0);
        cycles(4);
        expect(lootOf(PEARL)).toBe(2);
        expect(lootOf(ORE)).toBe(8);
    });

    it('with no rare table, the rarest line lands for certain on that cycle', () => {
        build(LINE_VEIN);
        cycles(4);
        expect(lootOf(GEM)).toBe(1);
        cycles(4);
        expect(lootOf(GEM)).toBe(2);
    });

    it('a Token whose every line is sure has no rarest drop: nothing is counted', () => {
        const { vein } = build(PLAIN_VEIN);
        cycles(8);
        expect(Fortune.countOf(vein)).toBe(0);
        expect(vein.fortune).toBeUndefined();
        expect(lootOf(ORE)).toBe(8);
    });

    it('a failed cycle counts nothing', () => {
        const { vein } = build(TABLE_VEIN, () => { litShrine(); fixtures.placeAt(JINX, OTHER_SIDE.x, OTHER_SIDE.y); });
        cycles(3);
        expect(Fortune.countOf(vein)).toBe(0);
        cycles(1);
        expect(Fortune.countOf(vein)).toBe(0);
        expect(lootOf(PEARL)).toBe(0);
    });

    it('an Echo is no cycle of its own: it counts nothing, and the sure find lands once', () => {
        const { vein } = build(TABLE_VEIN, () => { litShrine(); litShrine(ECHO_SHRINE, OTHER_SIDE); });
        cycles(3);
        expect(Fortune.countOf(vein)).toBe(75);
        expect(lootOf(ORE)).toBe(6);
        cycles(1);
        expect(lootOf(PEARL)).toBe(1);
        expect(lootOf(ORE)).toBe(8);
    });

    it('blessings add up: two shrines count twice as fast', () => {
        build(TABLE_VEIN, () => { litShrine(); litShrine(SHRINE, OTHER_SIDE); });
        cycles(2);
        expect(lootOf(PEARL)).toBe(1);
        cycles(2);
        expect(lootOf(PEARL)).toBe(2);
    });

    it('out of reach, out, or narrowed to another skill: nothing is counted and nothing more is drawn', () => {
        const drawsWith = (setUp) => {
            const { vein } = build(TABLE_VEIN, setUp);
            const draws = vi.spyOn(Math, 'random');
            cycles(4);
            const calls = draws.mock.calls.length;
            draws.mockRestore();
            expect(Fortune.countOf(vein)).toBe(0);
            expect(lootOf(PEARL)).toBe(0);
            return calls;
        };
        const none = drawsWith(() => {});
        expect(drawsWith(() => litShrine(SHRINE, FAR))).toBe(none);
        expect(drawsWith(() => fixtures.placeAt(SHRINE, BESIDE.x, BESIDE.y))).toBe(none);
        expect(drawsWith(() => litShrine(MINING_SHRINE))).toBe(none);
    });

    it('the sure find is said on the mat, from the shrine', () => {
        const { vein } = build();
        const fired = [];
        const off = EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => { if (p.instanceId === vein.id) fired.push(p); });
        cycles(4);
        off();
        expect(fired).toEqual([expect.objectContaining({ instanceId: vein.id, fortune: true })]);
        expect(fired[0].fromTokenId).toBeTruthy();
    });
});

describe('Fortune\'s count through a save and time away', () => {
    it('a save keeps the count: loaded, the next cycle that fills it gives the find', () => {
        const { vein } = build();
        cycles(3);
        expect(Fortune.countOf(vein)).toBe(75);
        reload();
        const loaded = BoardState.getTokenById(vein.id);
        expect(loaded).not.toBe(vein);
        expect(Fortune.countOf(loaded)).toBe(75);
        cycles(1);
        expect(lootOf(PEARL)).toBe(1);
    });

    it('time away: the catch-up counts and gives the finds as the plain loop in its 1 s steps does', async () => {
        const AWAY = 30_000;
        const live = (() => {
            const { vein } = build();
            step(AWAY, 1000);
            return { pearls: lootOf(PEARL), ore: lootOf(ORE), count: Fortune.countOf(vein) };
        })();
        const { vein } = build();
        const NOW = 1_800_000_000_000;
        await CatchUp.run({ save: false, yieldFn: () => Promise.resolve(), savedAt: NOW - AWAY, now: NOW });
        const caught = { pearls: lootOf(PEARL), ore: lootOf(ORE), count: Fortune.countOf(vein) };
        expect(caught).toEqual(live);
        expect(caught.pearls).toBe(Math.floor(caught.ore / 4));
        expect(caught.pearls).toBeGreaterThanOrEqual(5);
    });
});

describe('Fortune in the CMS', () => {
    it('is offered on a Token as a blessing, narrowed by skill, and reads as what it does', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.FORTUNE);
        expect(entry).toMatchObject({ label: 'Fortune', shape: MODIFIER_SHAPES.PROC, blessing: true, categories: 'skill' });
        expect(paletteForKeyword(KEYWORD.PROVIDES, false, { onToken: true }).map(e => e.type)).toContain(EFFECT_TYPES.FORTUNE);
        const payload = { type: EFFECT_TYPES.FORTUNE, bucket: 'flat', value: 10 };
        expect(effectTag(entry, payload).text).toBe('Fortune 10%');
        expect(renderStatement({ keyword: KEYWORD.PROVIDES, reach: 'nearby', to: { mode: 'all', value: '' }, payload }))
            .toBe('Fortune 10% on every nearby Token.');
        expect(effectParts({ keyword: KEYWORD.PROVIDES, payload })).toEqual({
            before: 'have each finished cycle count', size: '10%', after: 'toward a sure rare find'
        });
    });
});
