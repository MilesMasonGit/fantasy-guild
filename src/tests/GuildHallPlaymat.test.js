import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import {
    isUpgradeAccessible, getUpgradeLinks, getUpgradeWebLinks, getLockDetail, LOCK_KIND, HALL_NODE,
    getUpgradePrice, getUpgradeDef,
    ROSTER_BASE, GUILD_UPGRADES, PLACEHOLDER_PRICE_ITEM, placeholderPrices
} from '../config/guildUpgrades.js';
import { getItem } from '../config/registries/itemRegistry.js';

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

/**
 * B9: the Hall's upgrades are a web. An upgrade opens once ANY node linked to
 * it has rank >= 1, or straight away when it is linked to the Hall. Before B9
 * they sat on a 7x7 grid and opened by cardinal neighbour.
 */
describe('Guild Hall upgrade web', () => {
    it('gives every upgrade a node position and at least one link, and no tile index', () => {
        for (const def of GUILD_UPGRADES) {
            expect(def.tileIndex, def.id).toBeUndefined();
            expect(Number.isFinite(def.node?.x), def.id).toBe(true);
            expect(Number.isFinite(def.node?.y), def.id).toBe(true);
            expect(def.links.length, def.id).toBeGreaterThan(0);
            for (const to of def.links) {
                expect(to === HALL_NODE || !!getUpgradeDef(to), `${def.id} -> ${to}`).toBe(true);
            }
        }
        expect(getUpgradeDef('token_bank_slots')).toBeNull();
        expect(getUpgradeDef('token_bank_tabs')).toBeNull();
    });

    it('keeps no two nodes on the same spot, nor on the Hall', () => {
        const spots = GUILD_UPGRADES.map(d => `${d.node.x},${d.node.y}`);
        expect(new Set(spots).size).toBe(spots.length);
        expect(spots).not.toContain('0,0');
    });

    it('counts a link from both ends and draws each line once', () => {
        expect(getUpgradeLinks('bank_slots')).toEqual(expect.arrayContaining([HALL_NODE, 'bank_tabs', 'flag_radius']));
        expect(getUpgradeLinks('bank_tabs')).toEqual(['bank_slots']);
        const keys = getUpgradeWebLinks().map(l => [l.from, l.to].sort().join('|'));
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys.length).toBe(GUILD_UPGRADES.reduce((n, d) => n + d.links.length, 0));
    });

    // Starting reachability is exactly what the 7x7 grid gave before B9: the
    // four tiles beside the Hall open, Bank Tabs (beyond Bank Slots) and
    // Scouting Flags (between Bunk Beds and Bank Slots) shut.
    it('matches the old grid: the same upgrades open and shut on a new game', () => {
        const open = GUILD_UPGRADES.filter(d => isUpgradeAccessible(d.id, {})).map(d => d.id).sort();
        expect(open).toEqual(['bank_slots', 'notice_board', 'roster_size', 'wishing_well']);
    });

    it('opens a node once ANY linked node has rank >= 1', () => {
        expect(isUpgradeAccessible('bank_tabs', {})).toBe(false);
        expect(isUpgradeAccessible('bank_tabs', { bank_slots: 1 })).toBe(true);

        // Scouting Flags is linked to two nodes: either one opens it.
        expect(isUpgradeAccessible('flag_radius', {})).toBe(false);
        expect(isUpgradeAccessible('flag_radius', { roster_size: 1 })).toBe(true);
        expect(isUpgradeAccessible('flag_radius', { bank_slots: 1 })).toBe(true);
        // A bought node that is NOT linked does not.
        expect(isUpgradeAccessible('flag_radius', { notice_board: 3, wishing_well: 1 })).toBe(false);
    });

    it('matches the old grid after every single first purchase', () => {
        // The old rule, per tile: bank_tabs needed bank_slots; flag_radius
        // needed bank_slots or roster_size. Nothing else was ever shut.
        const oldOpen = (id, ranks) => {
            if (id === 'bank_tabs') return (ranks.bank_slots || 0) >= 1;
            if (id === 'flag_radius') return (ranks.bank_slots || 0) >= 1 || (ranks.roster_size || 0) >= 1;
            return true;
        };
        for (const bought of GUILD_UPGRADES) {
            const ranks = { [bought.id]: 1 };
            for (const def of GUILD_UPGRADES) {
                expect(isUpgradeAccessible(def.id, ranks), `${def.id} after ${bought.id}`).toBe(oldOpen(def.id, ranks));
            }
        }
    });

    it('lets an upgrade gate itself however its links stand (the skill-lock hook)', () => {
        const def = getUpgradeDef('notice_board');
        const saved = def.gate;
        def.gate = () => ({ kind: LOCK_KIND.SKILL, text: 'Requires Blacksmithing 5' });
        try {
            expect(isUpgradeAccessible('notice_board', {})).toBe(false);
            expect(getLockDetail('notice_board', {})).toEqual({ kind: LOCK_KIND.SKILL, text: 'Requires Blacksmithing 5' });
            InventoryManager.addItem('item_oak_wood', 1000);
            const res = GuildUpgradeManager.purchase('notice_board');
            expect(res.success).toBe(false);
            expect(res.error).toBe('Requires Blacksmithing 5');
            expect(GuildUpgradeManager.getRank('notice_board')).toBe(0);
        } finally {
            if (saved === undefined) delete def.gate; else def.gate = saved;
        }
        expect(isUpgradeAccessible('notice_board', {})).toBe(true);
    });

    it('reports a link lock with its kind, and nothing for an open node', () => {
        const detail = getLockDetail('bank_tabs', {});
        expect(detail.kind).toBe(LOCK_KIND.LINK);
        expect(detail.text).toContain('Bank Slots');
        expect(getLockDetail('bank_slots', {})).toBeNull();
    });

    it('keeps ranks keyed by upgrade id, so saves need no migration', () => {
        stock(nextPrice('bank_slots'));
        expect(GuildUpgradeManager.purchase('bank_slots').success).toBe(true);
        expect(GameState.state.progress.guildUpgrades).toEqual({ bank_slots: 1 });
        // A save written before B9 carries the same shape and opens the same way.
        GameState.state.progress.guildUpgrades = { roster_size: 2, bank_slots: 1, bank_tabs: 3 };
        expect(GuildUpgradeManager.isAccessible('flag_radius')).toBe(true);
        expect(GuildUpgradeManager.getRank('bank_tabs')).toBe(3);
    });

    it('refuses purchase of a locked upgrade', () => {
        const res = GuildUpgradeManager.purchase('bank_tabs');
        expect(res.success).toBe(false);
        expect(res.error).toContain('Requires a linked upgrade');
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
        // the cap is ROSTER_BASE + rank, not the raw rank. This used to assert
        // `1` against the drifted `Math.max(1, rank)` formula, which
        // contradicted the roster-of-twelve tests in RosterAndMarkets.
        expect(GameState.progress.rosterLimit).toBe(ROSTER_BASE + 1);
    });

    // Was 'charges gold' until slice 2.1: Hall upgrades now cost items, so
    // the second recruit is paid from the Bank and gold is left alone.
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
 * Slice 2.1 (Token Lifecycle roadmap v1): every Guild Hall upgrade track costs
 * a list of items per rank, never gold.
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
