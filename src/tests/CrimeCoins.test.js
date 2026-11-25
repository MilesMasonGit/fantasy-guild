import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getCoins } from '../systems/inventory/Coins.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Hideouts from '../systems/board/Hideouts.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { HIDEOUT_KIND, stealOf } from '../config/registries/crime.js';
import { COIN_ITEM_ID, stealCoinsOf, coinCostFindings } from '../config/registries/coinCosts.js';
import { tokenCardModel, CARD_BLOCK } from '../ui/components/board/tokenCard.js';
import { lastTheftText, stolenWords } from '../ui/components/board/hideoutCard.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ A thief steals coins (owner 2026-11-25, concept_gold_coins 12 and 13): a camp's steal table may
 * hold coins (`steal.coins`, beside its lines, as `enemy.coinDrop` sits beside a kill's drops). A
 * theft lands them as a pile at the Hideout, collected into the guild's coins, never the Bank; Coin
 * Find reaching the Hideout raises them (`CoinDrops.stolenCoins`); a caught thief takes none; an Echo
 * of the theft takes them again; a table without coins draws nothing more.
 */

const LOOT = 'fixture_cc_loot';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});

const SAFE_HIDEOUT = 'fixture_cc_safe_hideout';
const LOUD_HIDEOUT = 'fixture_cc_loud_hideout';
const RICH = 'fixture_cc_rich';
const RICH_CAMP = 'fixture_cc_rich_camp';
const PURSE = 'fixture_cc_purse_only';
const PURSE_CAMP = 'fixture_cc_purse_camp';
const POOR = 'fixture_cc_poor';
const POOR_CAMP = 'fixture_cc_poor_camp';
const ZERO = 'fixture_cc_zero';
const ZERO_CAMP = 'fixture_cc_zero_camp';
const HOUSE = 'fixture_cc_counting_house';
const ECHO_SHRINE = 'fixture_cc_echo_shrine';

const THEFT_MS = 2000;
const COINS = 10;

const works = (id) => ({ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'crime', stationKind: HIDEOUT_KIND } });
const hideout = (id, name, curve) => ({
    id, name, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_campfire',
    requiresHero: true, hideout: curve,
    config: { skill: 'crime', skillRequired: 1, cycleTimeMs: THEFT_MS, xp: 3, inputs: [], outputs: [] },
    statements: [works(id)]
});
const enemy = (id, name, steal) => ({
    id, name, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 'e_goblin', requiresHero: true,
    enemy: { level: 5, style: 'melee' },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 1, inputs: [], outputs: [] },
    steal
});
const camp = (id, name, enemyId) => ({
    id, name, tokenType: 'spawner', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_campfire', requiresHero: false,
    config: null, spawner: { spawns: [{ typeId: enemyId, weight: 1 }], allowance: 2, intervalMs: 1000, upkeep: [] }
});
const lootLine = { itemId: LOOT, chance: 100, minQty: 1, maxQty: 1 };

function registerFixtures() {
    registerItems({ [LOOT]: item(LOOT, 'Fixture Loot') });
    registerTokenTypes({
        [SAFE_HIDEOUT]: hideout(SAFE_HIDEOUT, 'Fixture Safe Hideout', { evenChance: 0, perLevel: 0, minChance: 0, maxChance: 0 }),
        [LOUD_HIDEOUT]: hideout(LOUD_HIDEOUT, 'Fixture Loud Hideout', { evenChance: 100, perLevel: 0, minChance: 100, maxChance: 100 }),
        [RICH]: enemy(RICH, 'Fixture Rich Goblin', { coins: COINS, outputs: [lootLine] }),
        [RICH_CAMP]: camp(RICH_CAMP, 'Fixture Rich Camp', RICH),
        [PURSE]: enemy(PURSE, 'Fixture Purse Goblin', { coins: COINS }),
        [PURSE_CAMP]: camp(PURSE_CAMP, 'Fixture Purse Camp', PURSE),
        [POOR]: enemy(POOR, 'Fixture Poor Goblin', { outputs: [lootLine] }),
        [POOR_CAMP]: camp(POOR_CAMP, 'Fixture Poor Camp', POOR),
        [ZERO]: enemy(ZERO, 'Fixture Zero Goblin', { coins: 0, outputs: [lootLine] }),
        [ZERO_CAMP]: camp(ZERO_CAMP, 'Fixture Zero Camp', ZERO),
        [HOUSE]: {
            id: HOUSE, name: 'Fixture Counting House', tokenType: 'buff', rarity: 'rare', theme: 'fixture', uses: null, sprite: 's_occult',
            statements: [{ id: 'stm_cc_find', keyword: KEYWORD.PROVIDES, to: { mode: 'all' }, payload: { type: EFFECT_TYPES.COIN_FIND, bucket: 'percentage', value: 1.0 } }]
        },
        [ECHO_SHRINE]: {
            id: ECHO_SHRINE, name: 'Fixture Echo Shrine', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
            sprite: 't_shrine_forest', requiresHero: true, shrine: { maxLitMs: 600_000 },
            config: { skill: 'faith', skillRequired: 1, cycleTimeMs: 2000, xp: 0, inputs: [], outputs: [] },
            statements: [
                { id: `stm_${ECHO_SHRINE}_works`, keyword: KEYWORD.STATION, payload: { skill: 'faith', stationKind: 'shrine' } },
                { id: `stm_${ECHO_SHRINE}_echo`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
                    payload: { type: EFFECT_TYPES.ECHO, bucket: 'flat', value: 100 } }
            ]
        }
    });
}

// The Hideout and its camp 160 apart; a building west of the Hideout reaches it and not the camp,
// one east of the camp reaches the camp and not the Hideout (the reach is 240).
const HIDEOUT_AT = { x: 800, y: 500 };
const CAMP_AT = { x: 960, y: 500 };
const BY_HIDEOUT = { x: 640, y: 500 };
const BY_CAMP_ONLY = { x: 1120, y: 500 };
const SHRINE_AT = { x: 800, y: 660 };

const step = (ms, by = 100) => { for (let t = 0; t < ms; t += by) GameLoop.runHandlers(by); };
/** The coins come in: on the mat as piles, or already counted. */
const coinsIn = () => SpriteLayer.countOnBoard(COIN_ITEM_ID) + getCoins();
const coinPiles = () => SpriteLayer.getSprites().filter(s => s.refId === COIN_ITEM_ID);

function freshBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    TileModifiers.clearAll();
}

/** A Hideout robbing a filled camp of `campTypeId`, a Crime 30 thief on it, and what else stands near. */
function build({ hideoutType = SAFE_HIDEOUT, campType = RICH_CAMP, house = null, shrine = false } = {}) {
    freshBoard();
    const hide = fixtures.placeAt(hideoutType, HIDEOUT_AT.x, HIDEOUT_AT.y);
    const robbed = fixtures.placeAt(campType, CAMP_AT.x, CAMP_AT.y);
    for (let i = 0; i < 5; i++) SpawnerSystem.attemptSpawn(robbed, getTokenType(campType), Math.random);
    if (house) fixtures.placeAt(HOUSE, house.x, house.y);
    if (shrine) fixtures.placeAt(ECHO_SHRINE, SHRINE_AT.x, SHRINE_AT.y).shrine = { litMs: 600_000 };
    TileModifiers.rebuildAll();
    expect(Hideouts.setTarget(hide, robbed.id)).toBe(true);
    const [hero] = fixtures.makeHeroes(1, { crime: 30, melee: 50 });
    expect(fixtures.orderAt(hero.id, HIDEOUT_AT).success).toBe(true);
    return { hide, robbed, heroId: hero.id };
}

/** One theft, and what it said. */
function oneTheft() {
    const heard = [];
    const off = EventBus.subscribe(BOARD_EVENTS.THEFT, (p) => heard.push(p));
    step(THEFT_MS + 100);
    off();
    return heard;
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

describe('a steal table\'s coins (pure)', () => {
    it('a whole number of 0 or more beside the lines; absent or anything else is 0', () => {
        expect(stealCoinsOf(getTokenType(RICH))).toBe(COINS);
        expect(stealCoinsOf(getTokenType(POOR))).toBe(0);
        expect(stealCoinsOf({ steal: { coins: 2.5 } })).toBe(0);
        expect(stealCoinsOf({ steal: { coins: -3 } })).toBe(0);
        expect(stealCoinsOf({ steal: { coins: '7' } })).toBe(7);
        expect(stealCoinsOf({})).toBe(0);
        expect(stealOf(getTokenType(RICH)).coins).toBe(COINS);
        expect(stealOf(getTokenType(POOR)).coins).toBe(0);
    });

    it('a table of coins alone is a table: its camp can be robbed', () => {
        expect(stealOf(getTokenType(PURSE))).toMatchObject({ coins: COINS, outputs: [], rareTable: null });
        expect(stealOf({ steal: { coins: 0 } })).toBeNull();
        freshBoard();
        const hide = fixtures.placeAt(SAFE_HIDEOUT, HIDEOUT_AT.x, HIDEOUT_AT.y);
        const purse = fixtures.placeAt(PURSE_CAMP, CAMP_AT.x, CAMP_AT.y);
        expect(Hideouts.campsInReach(hide).map(c => c.id)).toEqual([purse.id]);
    });

    it('steal coins the game cannot read are an audit line, for the boot audit and the Economy Audit', () => {
        const tokens = {
            bad: { id: 'bad', name: 'Bad Thief Mark', enemy: { level: 1 }, steal: { coins: 1.5, outputs: [lootLine] } },
            fine: { id: 'fine', name: 'Fine Mark', enemy: { level: 1 }, steal: { coins: 4 } }
        };
        expect(coinCostFindings({ tokens })).toEqual([
            expect.objectContaining({ entityId: 'bad', message: expect.stringMatching(/steal table's coins "1\.5" is not a whole number/) })
        ]);
        registerTokenTypes({ fixture_cc_bad: { ...enemy('fixture_cc_bad', 'Fixture Bad Thief Mark', { coins: 'lots', outputs: [lootLine] }) } });
        const lines = auditContent();
        expect(lines.some(f => f.where === 'Token "fixture_cc_bad"' && /steal table's coins/.test(f.what))).toBe(true);
    });
});

describe('⭐ a theft takes its camp\'s coins', () => {
    it('⭐ lands them as a pile at the Hideout, beside the lines, and says them with the theft', () => {
        const { hide } = build();
        const heard = oneTheft();
        expect(coinPiles().map(s => s.quantity)).toEqual([COINS]);
        expect(coinPiles().every(s => s.fromX === hide.x && s.fromY === hide.y)).toBe(true);
        expect(SpriteLayer.countOnBoard(LOOT)).toBe(1);
        expect(heard).toHaveLength(1);
        expect(heard[0].items).toEqual(expect.arrayContaining([
            { itemId: LOOT, quantity: 1 },
            expect.objectContaining({ itemId: COIN_ITEM_ID, quantity: COINS, coins: true })
        ]));
    });

    it('⭐ collected, the pile pays the guild\'s coins, never the Bank', () => {
        build();
        oneTheft();
        SpriteLayer.collectAll();
        expect(getCoins()).toBe(COINS);
        expect(InventoryManager.getItemCount(COIN_ITEM_ID)).toBe(0);
    });

    it('a camp of coins alone is robbed for its coins', () => {
        build({ campType: PURSE_CAMP });
        const heard = oneTheft();
        expect(coinsIn()).toBe(COINS);
        expect(heard[0].items).toEqual([expect.objectContaining({ itemId: COIN_ITEM_ID, quantity: COINS, coins: true })]);
    });

    it('⭐ Coin Find reaching the Hideout raises them', () => {
        build({ house: BY_HIDEOUT });
        oneTheft();
        expect(coinsIn()).toBe(COINS * 2);
    });

    it('Coin Find reaching only the camp does not: a theft is raised where it is made', () => {
        build({ house: BY_CAMP_ONLY });
        oneTheft();
        expect(coinsIn()).toBe(COINS);
    });

    it('a thief caught takes no coins', () => {
        build({ hideoutType: LOUD_HIDEOUT, house: BY_HIDEOUT });
        const heard = oneTheft();
        expect(heard[0].caught).toBe(true);
        expect(coinsIn()).toBe(0);
    });

    it('⭐ an Echo of the theft takes its coins again, said once, added up', () => {
        build({ shrine: true, house: BY_HIDEOUT });
        const heard = oneTheft();
        expect(heard).toHaveLength(1);
        expect(coinsIn()).toBe(COINS * 2 * 2);
        expect(heard[0].items).toEqual(expect.arrayContaining([
            { itemId: LOOT, quantity: 2 },
            expect.objectContaining({ itemId: COIN_ITEM_ID, quantity: COINS * 2 * 2, coins: true })
        ]));
    });

    it('a table without coins, or with 0, draws no more numbers than before and lands no pile', () => {
        const draws = (campType) => {
            build({ campType, house: BY_HIDEOUT });
            const spy = vi.spyOn(Math, 'random');
            oneTheft();
            const n = spy.mock.calls.length;
            spy.mockRestore();
            return n;
        };
        const none = draws(POOR_CAMP);
        expect(coinPiles()).toEqual([]);
        expect(draws(ZERO_CAMP)).toBe(none);
        expect(coinPiles()).toEqual([]);
        // A pile lands where any drop does, so a table with coins draws for its landing alone.
        expect(draws(RICH_CAMP)).toBeGreaterThan(none);
    });

    it('time away: the catch-up steals coins as the plain loop in its 1 s steps does', async () => {
        const AWAY = 60_000;
        build({ house: BY_HIDEOUT });
        step(AWAY, 1000);
        const live = coinsIn();
        build({ house: BY_HIDEOUT });
        const NOW = 1_800_000_000_000;
        await CatchUp.run({ save: false, yieldFn: () => Promise.resolve(), savedAt: NOW - AWAY, now: NOW });
        expect(coinsIn()).toBe(live);
        expect(live).toBeGreaterThanOrEqual(COINS * 2 * 25);
    });
});

describe('the Hideout\'s card and its words', () => {
    it('what a theft takes lists the coins, Coin Find at the Hideout counted', () => {
        const { hide } = build({ house: BY_HIDEOUT });
        const theft = tokenCardModel(SAFE_HIDEOUT, hide.id).blocks.find(b => b.id === CARD_BLOCK.THEFT);
        expect(theft.steals).toEqual([
            { itemId: LOOT, min: 1, max: 1, chance: 100 },
            { itemId: COIN_ITEM_ID, min: COINS * 2, max: COINS * 2, chance: 100, coins: true }
        ]);
    });

    it('the last theft and the bubble over the Hideout name its coins in words', () => {
        const last = { caught: false, items: [{ itemId: LOOT, quantity: 1 }, { itemId: COIN_ITEM_ID, quantity: 1, coins: true }] };
        expect(lastTheftText(last, () => 'Fixture Loot')).toBe('Stole 1 Fixture Loot, 1 coin');
        expect(lastTheftText({ caught: false, items: [{ itemId: COIN_ITEM_ID, quantity: 12, coins: true }] }, () => 'Coins')).toBe('Stole 12 coins');
        expect(stolenWords(last.items, () => 'Fixture Loot')).toEqual(['1 Fixture Loot', '1 coin']);
    });
});
