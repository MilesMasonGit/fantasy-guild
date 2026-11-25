import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as InputCost from '../systems/board/InputCost.js';
import * as Shop from '../systems/board/Shop.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getCoins, addCoins } from '../systems/inventory/Coins.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { MAX_BUILD_DISCOUNT } from '../config/buildPrices.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Master Builder (brief 800 P4, Construction 99): Foundations and the buildings made on them cost
 * less while a hero holding it is in the guild. The perk is Build Discount (`BUILD_DISCOUNT`), a
 * percent off: a Foundation's Shop price (its items and its coins, each rounded up) and the
 * materials of every build on a Foundation (through `InputCost`, so the check, the card and the pay
 * agree). Only the guild's best holder counts, never the sum of several, and never more than
 * `MAX_BUILD_DISCOUNT`. Nothing about it is saved: it is read from the heroes as they stand. A
 * Foundation remembers what it was bought for, and goes back to the Shop for that.
 */

const WOOD = 'item_oak_wood';
const STONE = 'item_stone';
const COAL = 'item_coal';
const PRICE = [{ itemId: WOOD, quantity: 9 }, { itemId: STONE, quantity: 4 }];
const COINS = 5;

registerTokenTypes({
    bd_foundation: {
        id: 'bd_foundation', name: 'BD Foundation', rarity: 'common', theme: 'fixture', uses: 1,
        foundation: { kind: 'bd_kind', skill: 'construction' },
        shop: { price: PRICE, coins: COINS, section: 'general' }
    },
    bd_bench: {
        id: 'bd_bench', name: 'BD Bench', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 4 }], coins: 5, section: 'general' }
    },
    bd_workshop: {
        id: 'bd_workshop', name: 'BD Workshop', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        config: { skill: 'crafting', skillRequired: 1, cycleTimeMs: 2000, xp: 1 },
        statements: [{ id: 'stm_bd_workshop', keyword: KEYWORD.STATION, payload: { skill: 'crafting' } }]
    }
});

const BUILD = 'bd_build_workshop';
const ODD_BUILD = 'bd_build_odd';
const CRAFT = 'bd_craft';
registerRecipePools({
    construction: [
        {
            id: BUILD, name: 'Build BD Workshop', levelRequirement: 1, foundationKinds: ['bd_kind'],
            inputs: [{ itemId: COAL, quantity: 10 }],
            outputs: [{ tokenId: 'bd_workshop', chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 3000, xp: 5
        },
        {
            id: ODD_BUILD, name: 'Build BD Workshop Oddly', levelRequirement: 1, foundationKinds: ['bd_kind'],
            inputs: [{ itemId: COAL, quantity: 7 }],
            outputs: [{ tokenId: 'bd_workshop', chance: 100, minQty: 1, maxQty: 1 }],
            durationMs: 3000, xp: 5
        }
    ],
    crafting: [{
        id: CRAFT, name: 'BD Craft', levelRequirement: 1,
        inputs: [{ itemId: COAL, quantity: 5 }],
        outputs: [{ itemId: STONE, chance: 100, minQty: 1, maxQty: 1 }],
        durationMs: 2000, xp: 1
    }]
});

const discount = (id, value) => ({
    id, name: id,
    statements: [{
        id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
        payload: { type: EFFECT_TYPES.BUILD_DISCOUNT, bucket: 'flat', value }
    }]
});
registerEffects({
    bd_master_builder: discount('bd_master_builder', 20),
    bd_huge: discount('bd_huge', 80)
});

const perks = (effectId) => registerSkillPerks({ construction: { perks: effectId ? [{ level: 99, effectId }] : [] } });

function hero(id, construction) {
    return {
        id, name: id, status: 'idle', level: 50, hp: { current: 100, max: 100 },
        skills: { construction: { level: construction, xp: 0 }, crafting: { level: 10, xp: 0 } }
    };
}

const AT = { x: 700, y: 500 };
const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const bank = (itemId) => InventoryManager.getItemCount(itemId);
const onMat = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);
const priceOf = (typeId) => Shop.priceLines(typeId).map(l => [l.itemId, l.need]);
const LIST = [[WOOD, 9], [STONE, 4], ['item_coins', 5]];

function put(typeId, point = AT) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, BoardState.ORIGIN.PLACED);
    Placement.placeTokenAt(instance, point);
    TileModifiers.rebuildAround([instance]);
    return BoardState.getTokenById(instance.id);
}

const roster = (...heroes) => { GameState.state.heroes = heroes; };

beforeAll(() => Flags.init());
afterAll(() => { perks(null); Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    perks('bd_master_builder');
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.inventory.maxSlots = 50;
    roster(hero('novice', 10));
});

describe('a Foundation\'s Shop price', () => {
    it('is as authored while nobody in the guild holds Master Builder', () => {
        expect(priceOf('bd_foundation')).toEqual(LIST);
    });

    it('is cut while a hero holding it is in the guild: items and coins, each rounded up', () => {
        roster(hero('novice', 10), hero('master', 99));
        // 9 at 20% off is 7.2, so 8; 4 is 3.2, so 4; 5 coins is 4.
        expect(priceOf('bd_foundation')).toEqual([[WOOD, 8], [STONE, 4], ['item_coins', 4]]);
        const entry = Shop.catalogue().find(e => e.typeId === 'bd_foundation');
        expect(entry.price.map(l => [l.itemId, l.need])).toEqual([[WOOD, 8], [STONE, 4], ['item_coins', 4]]);
    });

    it('counts only the guild\'s best holder, never the sum of several', () => {
        roster(hero('master', 99), hero('second', 99));
        expect(priceOf('bd_foundation')).toEqual([[WOOD, 8], [STONE, 4], ['item_coins', 4]]);
    });

    it(`never comes down by more than ${MAX_BUILD_DISCOUNT}%`, () => {
        perks('bd_huge');
        roster(hero('master', 99));
        // 80% asked, 50% given: 4.5 is 5, 2 is 2, 2.5 coins is 3.
        expect(MAX_BUILD_DISCOUNT).toBe(50);
        expect(priceOf('bd_foundation')).toEqual([[WOOD, 5], [STONE, 2], ['item_coins', 3]]);
    });

    it('goes back up once the holder leaves the guild', () => {
        roster(hero('novice', 10), hero('master', 99));
        expect(priceOf('bd_foundation')[0]).toEqual([WOOD, 8]);
        roster(hero('novice', 10));
        expect(priceOf('bd_foundation')).toEqual(LIST);
    });

    it('is the only Shop price cut: a Token sold that is no Foundation costs what it says', () => {
        roster(hero('master', 99));
        expect(priceOf('bd_bench')).toEqual([[WOOD, 4], ['item_coins', 5]]);
    });

    it('is what a purchase takes, and what the Foundation remembers it cost', () => {
        roster(hero('master', 99));
        InventoryManager.addItem(WOOD, 8);
        InventoryManager.addItem(STONE, 4);
        addCoins(4);
        expect(Shop.canBuy('bd_foundation')).toEqual({ success: true });
        const res = Shop.buyAt('bd_foundation', AT);
        expect(res.success, res.reason).toBe(true);
        expect(bank(WOOD)).toBe(0);
        expect(bank(STONE)).toBe(0);
        expect(getCoins()).toBe(0);
        expect(res.instance.paid).toEqual({ items: [{ itemId: WOOD, quantity: 8 }, { itemId: STONE, quantity: 4 }], coins: 4 });
    });

    it('is read from the heroes as they stand, after a save and load too', () => {
        roster(hero('master', 99));
        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED);
        expect(priceOf('bd_foundation')).toEqual([[WOOD, 8], [STONE, 4], ['item_coins', 4]]);
    });
});

describe('sending a Foundation back to the Shop', () => {
    it('returns what it was bought for, not the price as it stands', () => {
        roster(hero('master', 99));
        InventoryManager.addItem(WOOD, 8);
        InventoryManager.addItem(STONE, 4);
        addCoins(4);
        const f = Shop.buyAt('bd_foundation', AT).instance;

        roster(hero('novice', 10));
        const res = Shop.refund(f.id);
        expect(res).toMatchObject({ success: true, price: [{ itemId: WOOD, quantity: 8 }, { itemId: STONE, quantity: 4 }], coins: 4 });
        expect(bank(WOOD)).toBe(8);
        expect(bank(STONE)).toBe(4);
        expect(getCoins()).toBe(4);
    });

    it('one bought before it remembered its price returns the price as authored', () => {
        roster(hero('master', 99));
        const f = put('bd_foundation');
        expect(f.paid).toBeUndefined();
        expect(Shop.refund(f.id)).toMatchObject({ success: true, price: PRICE, coins: COINS });
        expect(bank(WOOD)).toBe(9);
        expect(getCoins()).toBe(COINS);
    });
});

describe('a build on a Foundation', () => {
    it('costs its materials less: the check, the card and the pay all ask the cut amount', () => {
        roster(hero('novice', 10), hero('master', 99));
        const f = put('bd_foundation');
        expect(StationRecipe.setSelectedRecipe(f, BUILD)).toBe(true);
        const [costed] = InputCost.costedInputs(f.id, [{ itemId: COAL, quantity: 10 }], 'construction');
        expect(costed).toMatchObject({ itemId: COAL, quantity: 8, exact: 8 });

        InventoryManager.addItem(COAL, 8);
        Orders.orderAt('novice', AT);
        run(4000);
        const [built] = onMat('bd_workshop');
        expect(built).toBeTruthy();
        expect(bank(COAL)).toBe(0);
        expect(built.paid).toEqual({ items: [{ itemId: COAL, quantity: 8 }], coins: 0 });
    });

    it('a cut that leaves a fraction asks the most and pays it whole by chance, as Efficiency does', () => {
        roster(hero('master', 99));
        const f = put('bd_foundation');
        // 7 at 20% off is 5.6: the check asks 6.
        expect(InputCost.exactInputQuantity(f.id, 7, 'construction')).toBeCloseTo(5.6, 9);
        expect(InputCost.costedInputs(f.id, [{ itemId: COAL, quantity: 7 }], 'construction')[0].quantity).toBe(6);
    });

    it('waits for the whole amount while nobody holds Master Builder', () => {
        const f = put('bd_foundation');
        StationRecipe.setSelectedRecipe(f, BUILD);
        InventoryManager.addItem(COAL, 8);
        Orders.orderAt('novice', AT);
        run(4000);
        expect(onMat('bd_workshop')).toHaveLength(0);
        expect(bank(COAL)).toBe(8);
        expect(BoardState.getTokenById(f.id).alert).toBe(ALERT.INPUTS);
    });

    it('a station that is no Foundation pays its inputs in full', () => {
        roster(hero('novice', 10), hero('master', 99));
        const shop = put('bd_workshop');
        expect(StationRecipe.setSelectedRecipe(shop, CRAFT)).toBe(true);
        expect(InputCost.costedInputs(shop.id, [{ itemId: COAL, quantity: 5 }], 'crafting')[0].quantity).toBe(5);
        InventoryManager.addItem(COAL, 5);
        Orders.orderAt('novice', AT);
        run(2500);
        expect(bank(COAL)).toBe(0);
        expect(bank(STONE)).toBe(0);  // made on the floor
    });
});
