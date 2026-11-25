import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { validateSaveData } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getCoins, addCoins } from '../systems/inventory/Coins.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { registerHallSky, authoredHallSky } from '../config/registries/hallStarRegistry.js';
import { normaliseRank } from '../config/hallStars.js';
import { getUpgradeDef, getUpgradeCoins } from '../config/guildUpgrades.js';
import { hallStarFindings } from '../systems/core/hallStarRule.js';
import { COIN_ITEM_ID } from '../config/registries/coinCosts.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ A Guild Hall star's rank may ask coins beside its items (`ranks[n].coins`): too few coins
 * refuses the purchase through the path too few items take, in the same words, taking nothing; a
 * buy of several ranks asks their coins together. No star effect touches coins (`CoinDrops`).
 */

const WOOD = 'item_oak_wood';
const STAR = 'star_cc_coin';

function installSky() {
    const shipped = authoredHallSky();
    registerHallSky({
        constellations: { ...(shipped.constellations || {}), cc_coins: { id: 'cc_coins', name: 'Coins', label: { x: 3, y: 3 } } },
        stars: {
            ...(shipped.stars || {}),
            [STAR]: {
                id: STAR, constellation: 'cc_coins', name: 'Coin Star', node: { x: 3, y: 2 }, links: ['hall'],
                ranks: [
                    { tier: 1, price: [{ itemId: WOOD, quantity: 2 }], coins: 30, rules: [], lines: [] },
                    { tier: 1, price: [{ itemId: WOOD, quantity: 3 }], coins: 50, rules: [], lines: [] },
                    { tier: 1, price: [{ itemId: WOOD, quantity: 1 }], rules: [], lines: [] }
                ]
            }
        }
    });
}

beforeEach(() => {
    GameState.initNew();
    GameState.state.progress.guildUpgrades = {};
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.inventory.items = {};
    installSky();
});

afterEach(() => {
    registerHallSky(null);
    GuildUpgradeManager.recompute();
});

describe('a rank\'s coins (pure)', () => {
    it('reads a whole number of 0 or more; absent or anything else is 0', () => {
        expect(normaliseRank({ price: [], coins: 12 }).coins).toBe(12);
        // None is written as none, so a sky without coins is written by Sync as before.
        expect(normaliseRank({ price: [] })).not.toHaveProperty('coins');
        expect(normaliseRank({ price: [], coins: -1 })).not.toHaveProperty('coins');
        expect(normaliseRank({ price: [], coins: 1.5 })).not.toHaveProperty('coins');
        expect(normaliseRank({ price: [], coins: 0 })).not.toHaveProperty('coins');
        const def = getUpgradeDef(STAR);
        expect([0, 1, 2].map(r => getUpgradeCoins(def, r))).toEqual([30, 50, 0]);
    });

    it('a rank\'s coins the game cannot read is an audit line', () => {
        const sky = authoredHallSky();
        const bad = { id: 'star_cc_bad', constellation: 'cc_coins', name: 'Bad', node: { x: 1, y: 1 }, links: ['hall'], ranks: [{ price: [], coins: 'many', rules: [], lines: [] }] };
        const found = hallStarFindings({
            sky: { constellations: { ...sky.constellations, cc_coins: { id: 'cc_coins', name: 'Coins', label: { x: 0, y: 0 } } }, stars: { ...sky.stars, star_cc_bad: bad } },
            items: {}, tokens: {}
        });
        expect(found.some(f => f.entityId === 'star_cc_bad' && /rank 1's coins "many" is not a whole number of 0 or more/.test(f.message))).toBe(true);
    });
});

describe('⭐ buying a star rank that asks coins', () => {
    it('⭐ too few coins refuses in the words too few items use, taking nothing', () => {
        InventoryManager.addItem(WOOD, 5);
        addCoins(10);
        expect(GuildUpgradeManager.canAfford(STAR)).toBe(false);
        expect(GuildUpgradeManager.getShortfall(GuildUpgradeManager.getNextCost(STAR), GuildUpgradeManager.getRanksCoins(STAR, 1)))
            .toEqual([{ itemId: COIN_ITEM_ID, name: 'Coins', needed: 30, have: 10, coins: true }]);
        const result = GuildUpgradeManager.purchase(STAR);
        expect(result).toEqual({ success: false, error: 'Not enough items: need 30 Coins (have 10)' });
        expect(GuildUpgradeManager.getRank(STAR)).toBe(0);
        expect(InventoryManager.getItemCount(WOOD)).toBe(5);
        expect(getCoins()).toBe(10);
    });

    it('⭐ with enough of both it buys the rank and takes the items and the coins', () => {
        InventoryManager.addItem(WOOD, 5);
        addCoins(35);
        expect(GuildUpgradeManager.canAfford(STAR)).toBe(true);
        expect(GuildUpgradeManager.purchase(STAR)).toEqual({ success: true });
        expect(GuildUpgradeManager.getRank(STAR)).toBe(1);
        expect(InventoryManager.getItemCount(WOOD)).toBe(3);
        expect(getCoins()).toBe(5);
    });

    it('several ranks at once ask their coins together', () => {
        InventoryManager.addItem(WOOD, 6);
        addCoins(79);
        expect(GuildUpgradeManager.getRanksCoins(STAR, 3)).toBe(80);
        expect(GuildUpgradeManager.canAffordRanks(STAR, 3)).toBe(false);
        expect(GuildUpgradeManager.purchaseRanks(STAR, 3).success).toBe(false);
        addCoins(1);
        expect(GuildUpgradeManager.purchaseRanks(STAR, 3)).toEqual({ success: true });
        expect(GuildUpgradeManager.getRank(STAR)).toBe(3);
        expect(getCoins()).toBe(0);
    });

    it('a rank asking no coins buys with coins untouched', () => {
        GameState.state.progress.guildUpgrades[STAR] = 2;
        InventoryManager.addItem(WOOD, 1);
        addCoins(4);
        expect(GuildUpgradeManager.purchase(STAR)).toEqual({ success: true });
        expect(getCoins()).toBe(4);
    });

    it('the rank and the coins spent survive a save and load', () => {
        InventoryManager.addItem(WOOD, 2);
        addCoins(31);
        expect(GuildUpgradeManager.purchase(STAR).success).toBe(true);
        const data = JSON.parse(JSON.stringify(GameState.serialize()));
        expect(validateSaveData(data).errors).toEqual([]);
        GameState.initFromSave(migrateState(data.state, data.version));
        expect(getCoins()).toBe(1);
        expect(GuildUpgradeManager.getRank(STAR)).toBe(1);
        expect(GuildUpgradeManager.getRanksCoins(STAR, 1)).toBe(50);
    });
});
