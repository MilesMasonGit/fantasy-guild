import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { validateSaveData } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Shop from '../systems/board/Shop.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getCoins, addCoins, spendCoins } from '../systems/inventory/Coins.js';
import { resetMatTuning } from '../config/matTuning.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { coinsOf, shopCoinsOf, enemyCoinDropOf, coinCostFindings, COIN_ITEM_ID } from '../config/registries/coinCosts.js';
import { normaliseWorldTables } from '../config/worldTablesShape.js';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';
import { setWorldTablesForTests, resetWorldTablesForTests } from '../config/registries/worldTablesRegistry.js';
import { priceTemplateOf } from '../systems/world/generate.js';
import * as World from '../systems/world/World.js';
import { SETTLE_TEXT } from '../systems/world/Settling.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { shortWords } from '../ui/components/atlas/WorldPrice.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Coins as a cost: a Shop Token (a Foundation among them) and settling a place on the world map
 * may ask coins beside their items. Too few coins refuses as too few items do, in the same words;
 * nothing is taken by a refusal, and an unbuilt Foundation sent back returns its coins too.
 */

const WOOD = 'item_oak_wood';

registerTokenTypes({
    cc_shop_hut: {
        id: 'cc_shop_hut', name: 'Coin Hut', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 2 }], coins: 30, section: 'general' }
    },
    cc_shop_free_coins: {
        id: 'cc_shop_free_coins', name: 'Coinless Hut', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 1 }], section: 'general' }
    },
    cc_shop_found: {
        id: 'cc_shop_found', name: 'Coin Foundation', size: 1, foundation: { kind: 'wood', skill: 'construction' },
        shop: { price: [{ itemId: WOOD, quantity: 3 }], coins: 12, section: 'general' }
    }
});

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    EngineBootstrap.createDefaultGameData();
    for (const t of BoardState.tokens()) if (t.typeId !== 'token_guild_hall') BoardState.removeToken(t.id);
    GameState.state.inventory.items = {};
});

afterEach(() => {
    TileModifiers.teardown();
    resetMatTuning();
    resetWorldTablesForTests();
});

describe('reading a coin cost (pure)', () => {
    it('a whole number of 0 or more; absent or anything else is 0', () => {
        expect(coinsOf(5)).toBe(5);
        expect(coinsOf('7')).toBe(7);
        expect(coinsOf(undefined)).toBe(0);
        expect(coinsOf(-1)).toBe(0);
        expect(coinsOf(2.5)).toBe(0);
        expect(coinsOf('lots')).toBe(0);
        expect(shopCoinsOf({ shop: { price: [], coins: 9 } })).toBe(9);
        expect(shopCoinsOf({ shop: { price: [] } })).toBe(0);
        expect(shopCoinsOf({})).toBe(0);
        expect(enemyCoinDropOf({ enemy: { level: 1, coinDrop: 4 } })).toBe(4);
        expect(enemyCoinDropOf({ enemy: { level: 1 } })).toBe(0);
        expect(enemyCoinDropOf({ coinDrop: 4 })).toBe(0);
        expect(COIN_ITEM_ID).toBe('item_coins');
    });

    it('a coin cost or drop the game cannot read is an audit line', () => {
        const found = coinCostFindings({
            tokens: {
                a: { id: 'a', name: 'A', shop: { price: [], coins: -3 } },
                b: { id: 'b', name: 'B', enemy: { level: 1, coinDrop: 1.5 } },
                c: { id: 'c', name: 'C', shop: { price: [], coins: 4 }, enemy: { level: 1, coinDrop: 2 } }
            }
        });
        expect(found).toEqual([
            { entityType: 'Token', entityId: 'a', entityName: 'A', message: expect.stringMatching(/Shop coins "-3" is not a whole number of 0 or more/) },
            { entityType: 'Token', entityId: 'b', entityName: 'B', message: expect.stringMatching(/Coin drop "1.5" is not a whole number of 0 or more/) }
        ]);
    });

    it('the boot audit says it', () => {
        registerTokenTypes({ cc_bad: { id: 'cc_bad', name: 'Bad Coin Hut', size: 1, shop: { price: [], coins: 'many' } } });
        const lines = auditContent();
        expect(lines.some(f => f.where === 'Token "cc_bad"' && /Shop coins/.test(f.what))).toBe(true);
    });
});

describe('spending coins', () => {
    it('takes a whole amount the guild holds, announcing it; refuses more than it holds, taking nothing', () => {
        addCoins(10);
        const heard = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.COINS_UPDATED, p => heard.push(p));
        expect(spendCoins(4)).toBe(true);
        expect(spendCoins(0)).toBe(true);
        expect(spendCoins(7)).toBe(false);
        off();
        expect(getCoins()).toBe(6);
        expect(heard).toEqual([{ coins: 6, spent: 4 }]);
    });
});

describe('⭐ a Shop Token that asks coins', () => {
    it('shows the coins beside its items, with what the guild holds', () => {
        InventoryManager.addItem(WOOD, 5);
        addCoins(10);
        expect(Shop.priceLines('cc_shop_hut')).toEqual([
            { itemId: WOOD, name: expect.any(String), need: 2, have: 5, enough: true },
            { itemId: COIN_ITEM_ID, name: 'Coins', need: 30, have: 10, enough: false, coins: true }
        ]);
        // A price with no coins shows no coin line.
        expect(Shop.priceLines('cc_shop_free_coins').some(l => l.coins)).toBe(false);
    });

    it('⭐ too few coins refuses in the words too few items use, taking nothing', () => {
        InventoryManager.addItem(WOOD, 5);
        addCoins(10);
        expect(Shop.canBuy('cc_shop_hut')).toEqual({ success: false, reason: 'Need 20× Coins' });
        const result = Shop.buy('cc_shop_hut');
        expect(result).toMatchObject({ success: false, reason: 'Need 20× Coins' });
        expect(InventoryManager.getItemCount(WOOD)).toBe(5);
        expect(getCoins()).toBe(10);
        expect(BoardState.tokens().some(t => t.typeId === 'cc_shop_hut')).toBe(false);
        // Short of both: the items first, then the coins, one sentence.
        GameState.state.inventory.items = {};
        expect(Shop.canBuy('cc_shop_hut').reason).toMatch(/^Need 2× .+, 20× Coins$/);
    });

    it('⭐ with enough of both, the purchase takes the items and the coins', () => {
        InventoryManager.addItem(WOOD, 5);
        addCoins(45);
        const result = Shop.buy('cc_shop_hut');
        expect(result.success, result.reason).toBe(true);
        expect(InventoryManager.getItemCount(WOOD)).toBe(3);
        expect(getCoins()).toBe(15);
        expect(BoardState.tokens().filter(t => t.typeId === 'cc_shop_hut')).toHaveLength(1);
    });

    it('a Token whose price asks no coins buys exactly as before, coins untouched', () => {
        InventoryManager.addItem(WOOD, 1);
        addCoins(3);
        expect(Shop.buy('cc_shop_free_coins').success).toBe(true);
        expect(getCoins()).toBe(3);
    });

    it('⭐ an unbuilt Foundation sent back returns its coins with its items', () => {
        InventoryManager.addItem(WOOD, 3);
        addCoins(12);
        const bought = Shop.buy('cc_shop_found');
        expect(bought.success, bought.reason).toBe(true);
        expect(getCoins()).toBe(0);
        const back = Shop.refund(bought.instance.id);
        expect(back.success, back.reason).toBe(true);
        expect(back.coins).toBe(12);
        expect(getCoins()).toBe(12);
        expect(InventoryManager.getItemCount(WOOD)).toBe(3);
    });

    it('the coins spent survive a save and load', () => {
        InventoryManager.addItem(WOOD, 2);
        addCoins(31);
        expect(Shop.buy('cc_shop_hut').success).toBe(true);
        const data = JSON.parse(JSON.stringify(GameState.serialize()));
        expect(validateSaveData(data).errors).toEqual([]);
        GameState.initFromSave(migrateState(data.state, data.version));
        expect(getCoins()).toBe(1);
    });
});

/** The placeholder tables with ring 1 and ring 3 asking coins. */
function tablesWithCoins() {
    const p = PLACEHOLDER_WORLD_TABLES.prices;
    return { ...PLACEHOLDER_WORLD_TABLES, prices: { ...p, 1: { ...p[1], coins: 40 }, 3: { ...p[3], coins: 100 } } };
}

describe('a world price that asks coins (pure)', () => {
    it('reads a ring\'s coins, 0 when absent, and grows them in the wild rings', () => {
        const tables = normaliseWorldTables(tablesWithCoins());
        expect(tables.prices[1].coins).toBe(40);
        expect(tables.prices[2].coins).toBe(0);
        expect(priceTemplateOf(tables, 3).coins).toBe(100);
        expect(priceTemplateOf(tables, 4).coins).toBe(Math.round(100 * tables.wild.priceGrowth));
        expect(normaliseWorldTables(PLACEHOLDER_WORLD_TABLES).prices[1].coins).toBe(0);
    });

    it('a coin price the game cannot read is an issue of the tables, and asks none', () => {
        const p = PLACEHOLDER_WORLD_TABLES.prices;
        const tables = normaliseWorldTables({ ...PLACEHOLDER_WORLD_TABLES, prices: { ...p, 2: { ...p[2], coins: -5 } } });
        expect(tables.prices[2].coins).toBe(0);
        expect(tables.issues.some(i => /Ring 2's coins "-5" is not a whole number of 0 or more/.test(i))).toBe(true);
    });
});

describe('⭐ settling a place that asks coins', () => {
    function settleReady() {
        World.createWorld({ seed: 4242 });
        setWorldTablesForTests(tablesWithCoins());
        const cell = World.currentWorld().cells.find(c => c.ring === 1);
        GameState.state.progress.rosterLimit = 4;
        const hero = HeroManager.addHero(generateHero());
        for (const { skill, level } of cell.requires.skills) addXP(hero.id, skill, xpForLevel(level) - (hero.skills[skill]?.xp || 0));
        for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty);
        return cell;
    }

    it('⭐ the price shows the coins; too few refuses as too few items do, taking nothing', () => {
        const cell = settleReady();
        addCoins(25);
        const price = World.priceOf(cell);
        expect(price.coins).toEqual({ need: 40, have: 25, short: true });
        expect(price.met).toBe(false);
        expect(shortWords(price)).toMatch(/15 coins/);
        const before = cell.requires.items.map(i => InventoryManager.getItemCount(i.itemId));
        expect(World.settleCell(cell.id)).toMatchObject({ success: false, reason: SETTLE_TEXT.SHORT });
        expect(cell.requires.items.map(i => InventoryManager.getItemCount(i.itemId))).toEqual(before);
        expect(getCoins()).toBe(25);
    });

    it('⭐ with enough coins it settles and takes them with the items', () => {
        const cell = settleReady();
        addCoins(55);
        expect(World.priceOf(cell).met).toBe(true);
        const result = World.settleCell(cell.id);
        expect(result.success, result.reason).toBe(true);
        expect(getCoins()).toBe(15);
        for (const { itemId } of cell.requires.items) expect(InventoryManager.getItemCount(itemId)).toBe(0);
    });

    it('a ring asking no coins shows no coin row and settles with coins untouched', () => {
        // The placeholder tables ask no coins anywhere: the shipped ones do from ring 1.
        setWorldTablesForTests(PLACEHOLDER_WORLD_TABLES);
        World.createWorld({ seed: 4242 });
        const cell = World.currentWorld().cells.find(c => c.ring === 1);
        expect(World.priceOf(cell).coins).toBeNull();
        GameState.state.progress.rosterLimit = 4;
        const hero = HeroManager.addHero(generateHero());
        for (const { skill, level } of cell.requires.skills) addXP(hero.id, skill, xpForLevel(level) - (hero.skills[skill]?.xp || 0));
        for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty);
        addCoins(25);
        const result = World.settleCell(cell.id);
        expect(result.success, result.reason).toBe(true);
        expect(getCoins()).toBe(25);
    });
});
