import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import {
    isTileAccessible, getUpgradeDefByTile, getUpgradePrice, getUpgradeDef,
    ROSTER_BASE, GUILD_UPGRADES, PLACEHOLDER_PRICE_ITEM, placeholderPrices
} from '../config/guildUpgrades.js';
import { getItem } from '../config/registries/itemRegistry.js';
import {
    UPGRADE_BOARD_SIZE as SIZE,
    UPGRADE_BOARD_GUILD_HALL_TILE as GH
} from '../config/upgradeBoardGeometry.js';

// The six upgrade tiles, named by where they sit relative to the Guild Hall so
// this file does not have to be rewritten every time the board is resized.
//
// ⚠️ These are addresses on the 7x7 UPGRADE board, which is a different surface
// from the playmat and is deliberately not resized alongside it.
const TOP = GH - SIZE;              // roster_size
const BOTTOM = GH + SIZE;           // wishing_well
const LEFT = GH - 1;                // bank_slots
const FAR_LEFT = GH - 2;            // bank_tabs
const RIGHT = GH + 1;               // token_bank_slots
const FAR_RIGHT = GH + 2;           // token_bank_tabs

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), notify: vi.fn()
}));

/** Put everything a price asks for into the Bank. */
const stock = (price) => price.forEach(p => InventoryManager.addItem(p.itemId, p.quantity));

/** The price of the next rank of an upgrade, as the manager sees it. */
const nextPrice = (id) => GuildUpgradeManager.getNextCost(id);

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    GameState.state.progress.guildUpgrades = {};
    InventoryManager.init();
});

describe('Guild Hall 7x7 Upgrade Board', () => {
    it('configures tile mappings correctly around center Guild Hall', () => {
        expect(getUpgradeDefByTile(TOP)?.id).toBe('roster_size');
        expect(getUpgradeDefByTile(LEFT)?.id).toBe('bank_slots');
        expect(getUpgradeDefByTile(FAR_LEFT)?.id).toBe('bank_tabs');
        expect(getUpgradeDefByTile(RIGHT)?.id).toBe('token_bank_slots');
        expect(getUpgradeDefByTile(FAR_RIGHT)?.id).toBe('token_bank_tabs');
    });

    it('makes the 4 cardinal tiles directly nearby to center accessible by default', () => {
        const ranks = {};
        expect(isTileAccessible(TOP, ranks)).toBe(true);
        expect(isTileAccessible(LEFT, ranks)).toBe(true);
        expect(isTileAccessible(RIGHT, ranks)).toBe(true);
        expect(isTileAccessible(BOTTOM, ranks)).toBe(true);
    });

    it('locks the outer tiles until their direct cardinal neighbor has rank >= 1', () => {
        const ranks = {};
        expect(isTileAccessible(FAR_LEFT, ranks)).toBe(false);  // Bank Tabs needs Bank Slots
        expect(isTileAccessible(FAR_RIGHT, ranks)).toBe(false); // Vault Tabs needs Vault Slots

        ranks.bank_slots = 1;
        expect(isTileAccessible(FAR_LEFT, ranks)).toBe(true);   // Bank Tabs now unlocked!
        expect(isTileAccessible(FAR_RIGHT, ranks)).toBe(false); // Vault Tabs still locked

        ranks.token_bank_slots = 1;
        expect(isTileAccessible(FAR_RIGHT, ranks)).toBe(true);  // Vault Tabs now unlocked!
    });

    it('refuses purchase of locked tile', () => {
        const res = GuildUpgradeManager.purchase('bank_tabs');
        expect(res.success).toBe(false);
        expect(res.error).toContain('Requires nearby upgrade');
    });

    it('allows purchasing roster_size rank 0 for free and recruits initial starter hero', () => {
        expect(GameState.heroes.length).toBe(0);
        const def = getUpgradeDef('roster_size');
        // The first recruit is free: an empty item list, and an empty Bank pays it.
        expect(getUpgradePrice(def, 0)).toEqual([]);

        const res = GuildUpgradeManager.purchase('roster_size');
        expect(res.success).toBe(true);
        expect(GuildUpgradeManager.getRank('roster_size')).toBe(1);
        expect(GameState.heroes.length).toBe(1);
        // D-251: the cap is ROSTER_BASE + rank, not the raw rank. This used to
        // assert `1` against the drifted `Math.max(1, rank)` formula, which
        // contradicted the roster-of-twelve tests in RosterAndMarkets.
        expect(GameState.progress.rosterLimit).toBe(ROSTER_BASE + 1);
    });

    // Was 'charges gold' until slice 2.1 (2026-09-25): Hall upgrades now cost
    // items (SP-65), so the second recruit is paid from the Bank and gold is
    // left alone.
    it('recruits another hero on subsequent roster_size upgrades by paying items', () => {
        GuildUpgradeManager.purchase('roster_size'); // Rank 1 (free)
        expect(GameState.heroes.length).toBe(1);

        const price = nextPrice('roster_size');
        expect(price.length).toBeGreaterThan(0);
        stock(price);

        const res = GuildUpgradeManager.purchase('roster_size'); // Rank 2
        expect(res.success).toBe(true);
        expect(GuildUpgradeManager.getRank('roster_size')).toBe(2);
        expect(GameState.heroes.length).toBe(2);
        expect(GameState.progress.rosterLimit).toBe(ROSTER_BASE + 2);
        price.forEach(p => expect(InventoryManager.getItemCount(p.itemId)).toBe(0));
        expect(GameState.state.currency).toBeUndefined();   // no gold anywhere (9.4)
    });

    it('unlocks dependent tracks upon upgrading predecessor', () => {
        expect(GuildUpgradeManager.isAccessible('bank_tabs')).toBe(false);

        // Buy bank_slots
        stock(nextPrice('bank_slots'));
        GuildUpgradeManager.purchase('bank_slots');
        expect(GuildUpgradeManager.getRank('bank_slots')).toBe(1);

        // Now bank_tabs should be accessible and purchasable
        expect(GuildUpgradeManager.isAccessible('bank_tabs')).toBe(true);
        stock(nextPrice('bank_tabs'));
        const res = GuildUpgradeManager.purchase('bank_tabs');
        expect(res.success).toBe(true);
        expect(GuildUpgradeManager.getRank('bank_tabs')).toBe(1);
    });
});

/**
 * Slice 2.1 (Token Lifecycle roadmap v1, 2026-09-25): every Guild Hall upgrade
 * track costs a list of items per rank, never gold (SP-65). TL-5 placeholder:
 * rank n costs 10·n Oak Wood; Bunk Beds and the Wishing Well keep a free first
 * rank.
 */
describe('Guild Hall upgrades are paid in items', () => {
    it('uses the live Oak Wood id, which exists in the item registry', () => {
        expect(PLACEHOLDER_PRICE_ITEM).toBe('item_oak_wood');
        expect(getItem(PLACEHOLDER_PRICE_ITEM)).toBeTruthy();
    });

    it('gives every track a per-rank list of { itemId, quantity }, scaling with rank', () => {
        for (const def of GUILD_UPGRADES) {
            expect(def.prices).toHaveLength(def.maxRank);
            expect(def.costBase).toBeUndefined();
            const freeFirst = def.id === 'roster_size' || def.id === 'wishing_well';
            for (let owned = 0; owned < def.maxRank; owned++) {
                const target = owned + 1;
                const price = getUpgradePrice(def, owned);
                if (freeFirst && target === 1) {
                    expect(price).toEqual([]);
                } else {
                    expect(price).toEqual([{ itemId: PLACEHOLDER_PRICE_ITEM, quantity: 10 * target }]);
                }
            }
            expect(getUpgradePrice(def, def.maxRank)).toBeNull();
        }
    });

    it('lets the helper name a different item and amount per upgrade', () => {
        expect(placeholderPrices(3, { itemId: 'item_x', perRank: 4 })).toEqual([
            [{ itemId: 'item_x', quantity: 4 }],
            [{ itemId: 'item_x', quantity: 8 }],
            [{ itemId: 'item_x', quantity: 12 }]
        ]);
    });

    it('succeeds and deducts exactly the price from the Bank, leaving gold alone', () => {
        const [{ itemId, quantity }] = nextPrice('bank_slots');
        InventoryManager.addItem(itemId, quantity + 7);

        const res = GuildUpgradeManager.purchase('bank_slots');
        expect(res.success).toBe(true);
        expect(GuildUpgradeManager.getRank('bank_slots')).toBe(1);
        expect(InventoryManager.getItemCount(itemId)).toBe(7);
        expect(GameState.state.currency).toBeUndefined();   // no gold anywhere (9.4)
    });

    it('refuses when the Bank is short, names what is missing, and takes nothing', () => {
        const [{ itemId, quantity }] = nextPrice('bank_slots');
        InventoryManager.addItem(itemId, quantity - 1);

        const res = GuildUpgradeManager.purchase('bank_slots');
        expect(res.success).toBe(false);
        expect(res.error).toContain(getItem(itemId).name);
        expect(res.error).toContain(`need ${quantity}`);
        expect(res.error).toContain(`have ${quantity - 1}`);
        expect(GuildUpgradeManager.getRank('bank_slots')).toBe(0);
        expect(InventoryManager.getItemCount(itemId)).toBe(quantity - 1);
        expect(GameState.state.currency).toBeUndefined();   // no gold anywhere (9.4)
    });

    it('is all or nothing across a multi-item price', () => {
        const def = getUpgradeDef('bank_slots');
        const saved = def.prices;
        const [first] = nextPrice('bank_slots');
        // A second item the Bank does not hold: the first must not be taken.
        def.prices = [[first, { itemId: 'item_charcoal', quantity: 3 }], ...saved.slice(1)];
        try {
            InventoryManager.addItem(first.itemId, first.quantity);
            const res = GuildUpgradeManager.purchase('bank_slots');
            expect(res.success).toBe(false);
            expect(res.error).toContain(getItem('item_charcoal').name);
            expect(InventoryManager.getItemCount(first.itemId)).toBe(first.quantity);
            expect(GuildUpgradeManager.getRank('bank_slots')).toBe(0);

            InventoryManager.addItem('item_charcoal', 3);
            expect(GuildUpgradeManager.purchase('bank_slots').success).toBe(true);
            expect(InventoryManager.getItemCount(first.itemId)).toBe(0);
            expect(InventoryManager.getItemCount('item_charcoal')).toBe(0);
        } finally {
            def.prices = saved;
        }
    });

    it('charges more for each later rank', () => {
        const paid = [];
        for (let i = 0; i < 3; i++) {
            const price = nextPrice('bank_slots');
            paid.push(price[0].quantity);
            stock(price);
            expect(GuildUpgradeManager.purchase('bank_slots').success).toBe(true);
        }
        expect(paid).toEqual([10, 20, 30]);
    });

    it('keeps the first recruit free on an empty Bank, then asks items for the second', () => {
        expect(GuildUpgradeManager.canAfford('roster_size')).toBe(true);
        expect(GuildUpgradeManager.purchase('roster_size').success).toBe(true);
        expect(GameState.heroes.length).toBe(1);

        expect(GuildUpgradeManager.canAfford('roster_size')).toBe(false);
        const refused = GuildUpgradeManager.purchase('roster_size');
        expect(refused.success).toBe(false);
        expect(GameState.heroes.length).toBe(1);

        stock(nextPrice('roster_size'));
        expect(GuildUpgradeManager.canAfford('roster_size')).toBe(true);
        expect(GuildUpgradeManager.purchase('roster_size').success).toBe(true);
        expect(GameState.heroes.length).toBe(2);
    });
});
