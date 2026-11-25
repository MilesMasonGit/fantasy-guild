import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { GameState } from '../state/GameState.js';
import { validateSaveData } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as CoinDrops from '../systems/board/CoinDrops.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getCoins } from '../systems/inventory/Coins.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { getPaletteEntry } from '../config/registries/modifierPalette.js';
import { hallRulesOf, NEVER_ON_GUILD } from '../systems/progression/hallModifiers.js';
import { COIN_ITEM_ID } from '../config/registries/coinCosts.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Enemies drop coins: an enemy's Coin drop lands as a pile of coins where it stood, collected like
 * loot into the guild's coins (never the Bank). A building with Coin Find raises the coins every enemy
 * defeated in its reach drops, and the coins a Hideout in its reach steals (the hook). No Guild Hall
 * star may carry Coin Find.
 */

const enemy = (id, coinDrop, outputs = []) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 20, sprite: 's_occult',
    enemy: { level: 2, style: 'melee', ...(coinDrop != null ? { coinDrop } : {}) },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs }
});
const coinFind = (value) => ({ id: 'stm_coin_find', keyword: 'provides', to: { mode: 'all' }, payload: { type: 'COIN_FIND', bucket: 'percentage', value } });

registerTokenTypes({
    cd_enemy_coins: enemy('cd_enemy_coins', 3, [{ itemId: 'item_blackberry', chance: 100, minQty: 1, maxQty: 1 }]),
    cd_enemy_poor: enemy('cd_enemy_poor', null, [{ itemId: 'item_blackberry', chance: 100, minQty: 1, maxQty: 1 }]),
    cd_counting_house: {
        id: 'cd_counting_house', name: 'Counting House', tokenType: 'buff', rarity: 'rare', theme: 'fixture', uses: null,
        sprite: 's_occult', statements: [coinFind(1.0)]
    },
    cd_hideout: { id: 'cd_hideout', name: 'Fixture Hideout', size: 1 }
});

const AT = { x: 400, y: 300 };

function place(typeId, at) {
    const t = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(t, at);
    return t;
}

/** `typeId` on the mat, with a Counting House beside it when `house`. */
function onMat(typeId, { house = false } = {}) {
    const target = place(typeId, AT);
    const placed = [target];
    if (house) placed.push(place('cd_counting_house', { x: AT.x + 70, y: AT.y }));
    TileModifiers.rebuildAround(placed);
    return target;
}

function kill(target) {
    const seen = [];
    const off = EventBus.subscribe('loot_generated', p => seen.push(p));
    LootSystem.handleCombatVictory({ heroId: null, enemyId: target.typeId, instanceId: target.id });
    off();
    return seen[0];
}

const coinPiles = () => SpriteLayer.getSprites().filter(s => s.refId === COIN_ITEM_ID);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.maxSlots = 50;
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    for (const t of BoardState.tokens()) BoardState.removeToken(t.id);
});

afterEach(() => vi.restoreAllMocks());

describe('⭐ a kill drops its coins', () => {
    it('⭐ lands a pile of the enemy\'s Coin drop where it stood, listed with the loot', () => {
        const loot = kill(onMat('cd_enemy_coins'));
        expect(coinPiles().map(s => s.quantity)).toEqual([3]);
        expect(loot.drops).toContainEqual(expect.objectContaining({ itemId: COIN_ITEM_ID, quantity: 3, coins: true }));
        // Not counted until collected.
        expect(getCoins()).toBe(0);
    });

    it('⭐ collecting the pile pays the guild\'s coins, never the Bank', () => {
        kill(onMat('cd_enemy_coins'));
        SpriteLayer.collectAll();
        expect(getCoins()).toBe(3);
        expect(InventoryManager.getItemCount(COIN_ITEM_ID)).toBe(0);
        expect(coinPiles()).toEqual([]);
    });

    it('a pile is collected even when the Bank is full', () => {
        kill(onMat('cd_enemy_coins'));
        GameState.state.inventory.maxSlots = 0;
        SpriteLayer.collectAll();
        expect(getCoins()).toBe(3);
    });

    it('an enemy with no Coin drop drops no coins and draws no number for them', () => {
        const target = onMat('cd_enemy_poor', { house: true });
        const loot = kill(target);
        expect(coinPiles()).toEqual([]);
        expect(loot.drops.some(d => d.coins)).toBe(false);
        const spy = vi.spyOn(Math, 'random');
        expect(CoinDrops.dropKillCoins(target.id, { enemy: { level: 2 } }, '')).toBeNull();
        expect(spy).not.toHaveBeenCalled();
    });

    it('a pile from before gold left pays the count too', () => {
        GameState.state.board.sprites.push({ id: 'old_gold', kind: 'gold', refId: 'gold', quantity: 7, x: 10, y: 10, bornAt: 0 });
        GameState.state.board.sprites.push({ id: 'old_coins', kind: 'item', refId: 'coins', quantity: 2, x: 10, y: 10, bornAt: 0 });
        SpriteLayer.collectAll();
        expect(getCoins()).toBe(9);
    });

    it('a pile left on the floor survives a save and load, and pays after', () => {
        kill(onMat('cd_enemy_coins'));
        const data = JSON.parse(JSON.stringify(GameState.serialize()));
        expect(validateSaveData(data).errors).toEqual([]);
        GameState.initFromSave(migrateState(data.state, data.version));
        expect(coinPiles().map(s => s.quantity)).toEqual([3]);
        SpriteLayer.collectAll();
        expect(getCoins()).toBe(3);
    });
});

describe('⭐ Coin Find in reach', () => {
    it('⭐ an enemy defeated in a Counting House\'s reach drops more coins', () => {
        const target = onMat('cd_enemy_coins', { house: true });
        expect(CoinDrops.killCoins(target.id, { enemy: { coinDrop: 3 } })).toBe(6);
        kill(target);
        expect(coinPiles().map(s => s.quantity)).toEqual([6]);
    });

    it('raises nothing from nothing: an enemy with no Coin drop still drops none', () => {
        kill(onMat('cd_enemy_poor', { house: true }));
        expect(coinPiles()).toEqual([]);
    });

    it('⭐ a Hideout in reach steals more coins (the hook)', () => {
        const alone = onMat('cd_hideout');
        expect(CoinDrops.stolenCoins(alone.id, 10)).toBe(10);
        BoardState.removeToken(alone.id);
        TileModifiers.clearAll();
        const beside = onMat('cd_hideout', { house: true });
        expect(CoinDrops.stolenCoins(beside.id, 10)).toBe(20);
        expect(CoinDrops.stolenCoins(beside.id, 0)).toBe(0);
    });

    it('is a building\'s effect: offered as a percentage, and a Guild Hall star cannot carry it', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.COIN_FIND);
        expect(entry).toMatchObject({ label: 'Coin Find', buckets: ['percentage'], neverOnGuild: true });
        const star = {
            id: 'cd_star', ranks: [{ price: [], lines: [], rules: [{ ...coinFind(0.5), id: 'stm_star_coin' }] }]
        };
        const { modifiers, ignored } = hallRulesOf([star], { cd_star: 1 });
        expect(modifiers).toEqual([]);
        expect(ignored).toContainEqual(expect.objectContaining({ reason: NEVER_ON_GUILD }));
    });
});
