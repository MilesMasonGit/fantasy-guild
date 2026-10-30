import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { homeTabOf, bankTabCounts, bankTabLayout, BANK_TAB_SLOTS } from '../systems/inventory/bankTabs.js';
import { getUpgradeDef } from '../config/guildUpgrades.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { GAME_VERSION, validateSaveData } from '../state/StateSchema.js';

// Brief 310 B1: each Bank tab holds 64 item kinds; a Bank Tabs rank adds a tab and its slots.

vi.mock('../config/registries/itemRegistry.js', () => ({
    getItem: vi.fn((id) => ({ id, name: id, maxStack: 99 })),
    DEFAULT_MAX_STACK: 1e12
}));

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(),
    success: vi.fn(), error: vi.fn(), getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const inv = () => GameState.state.inventory;
const kind = (i) => `item_k${String(i).padStart(4, '0')}`;
const fill = (from, to) => { for (let i = from; i < to; i++) InventoryManager.addItem(kind(i), 1); };
const setTabRanks = (rank) => {
    GameState.state.progress.guildUpgrades = { bank_tabs: rank };
    GuildUpgradeManager.recompute();
};

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GuildUpgradeManager.recompute();
});

describe('a Bank tab holds 64 kinds', () => {
    it('starts with one tab of 64 slots', () => {
        expect(inv().groupOrder).toHaveLength(1);
        expect(inv().maxSlots).toBe(BANK_TAB_SLOTS);
        expect(BANK_TAB_SLOTS).toBe(64);
    });

    it('adds a tab and its 64 slots per Bank Tabs rank, up to 16 tabs of 1,024 slots', () => {
        setTabRanks(2);
        expect(inv().groupOrder).toHaveLength(3);
        expect(inv().maxSlots).toBe(192);
        setTabRanks(15);
        expect(inv().groupOrder).toHaveLength(16);
        expect(inv().maxSlots).toBe(1024);
        expect(getUpgradeDef('bank_tabs').maxRank).toBe(15);
    });

    it('files a new kind in the first tab with room once the first tab is full', () => {
        setTabRanks(1);
        fill(0, 64);
        const [first, second] = inv().groupOrder;
        expect(bankTabCounts(inv()).get(first)).toBe(64);
        InventoryManager.addItem('item_new', 3);
        expect(homeTabOf(inv(), 'item_new')).toBe(second);
        expect(InventoryManager.getItemCount('item_new')).toBe(3);
    });

    it('leaves a new kind on the mat when every tab is full, and still stacks a held kind', () => {
        setTabRanks(1);
        fill(0, 128);
        const overflow = vi.fn();
        const off = EventBus.subscribe(ENGINE_EVENTS.INVENTORY_OVERFLOW, overflow);
        try {
            expect(InventoryManager.lacksSlotFor('item_new')).toBe(true);
            expect(InventoryManager.addItem('item_new', 2)).toBe(0);
            expect(overflow).toHaveBeenCalledWith({ itemId: 'item_new', amount: 2 });
            expect(InventoryManager.addItem(kind(5), 4)).toBe(4);
        } finally {
            off?.();
        }
    });

    it('puts a kind back in the tab it was last filed in when that tab has room, else the first with room', () => {
        setTabRanks(2);
        const [, , third] = inv().groupOrder;
        InventoryManager.addItem('item_axe', 1);
        expect(InventoryManager.moveItemToGroup('item_axe', third)).toBe(true);
        InventoryManager.removeItem('item_axe', 1);
        InventoryManager.addItem('item_axe', 1);
        expect(homeTabOf(inv(), 'item_axe')).toBe(third);

        InventoryManager.removeItem('item_axe', 1);
        for (let i = 0; i < 64; i++) InventoryManager.addItem(`item_t3_${i}`, 1);
        for (let i = 0; i < 64; i++) InventoryManager.moveItemToGroup(`item_t3_${i}`, third);
        expect(bankTabCounts(inv()).get(third)).toBe(64);
        InventoryManager.addItem('item_axe', 1);
        expect(homeTabOf(inv(), 'item_axe')).toBe(inv().groupOrder[0]);
    });

    it('takes back a hero\'s copy of a new kind into a tab with room', () => {
        setTabRanks(1);
        fill(0, 64);
        expect(InventoryManager.putBack('item_sword')).toBe(true);
        expect(homeTabOf(inv(), 'item_sword')).toBe(inv().groupOrder[1]);
        fill(64, 127);
        expect(InventoryManager.hasRoomFor(['item_shield'])).toBe(false);
        expect(InventoryManager.putBack('item_shield')).toBe(false);
        // A copy that frees its own slot makes room for one.
        expect(InventoryManager.hasRoomFor(['item_shield'], { freed: 'item_sword' })).toBe(true);
    });

    it('refuses to move a kind into a full tab, and leaves it where it was', () => {
        setTabRanks(1);
        fill(0, 64);
        const [first, second] = inv().groupOrder;
        InventoryManager.addItem('item_b', 1);
        expect(homeTabOf(inv(), 'item_b')).toBe(second);
        expect(InventoryManager.moveItemToGroup('item_b', first)).toBe(false);
        expect(homeTabOf(inv(), 'item_b')).toBe(second);
        // Moving within its own tab is never refused.
        expect(InventoryManager.moveItemToGroup(kind(3), first, 0)).toBe(true);
        expect(bankTabLayout(inv())[first][0]).toBe(kind(3));
    });
});

describe('a save with Bank Slots ranks', () => {
    /** A save from before brief 310: Bank Slots rank 3 (160 slots), `tabs` tabs, `kinds` kinds all in the first tab. */
    function oldSave(kinds, tabRanks) {
        GameState.initNew();
        const state = GameState.serialize().state;
        state.progress.guildUpgrades = { bank_slots: 3, bank_tabs: tabRanks, roster_size: 1 };
        state.inventory.maxSlots = 64 + 3 * 32;
        state.inventory.maxTabs = 1 + tabRanks;
        state.inventory.groupOrder = ['default-loot'];
        state.inventory.groupDefs = { 'default-loot': { id: 'default-loot', title: 'Loot', isCustom: false, orderedItems: [] } };
        for (let t = 2; t <= 1 + tabRanks; t++) {
            const id = `bank-tab-${t}`;
            state.inventory.groupOrder.push(id);
            state.inventory.groupDefs[id] = { id, title: `Tab ${t}`, isCustom: false, orderedItems: [] };
        }
        state.inventory.items = {};
        for (let i = 0; i < kinds; i++) state.inventory.items[kind(i)] = { quantity: i + 1, dur: null };
        state.inventory.groupDefs['default-loot'].orderedItems = [kind(kinds - 1), kind(0)];
        return state;
    }

    async function load(state) {
        const migrated = migrateState(state, GAME_VERSION);
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).errors).toEqual([]);
        await GameState.initFromSave(migrated);
        InventoryManager.init();
        GuildUpgradeManager.recompute();
    }

    it('drops the Bank Slots ranks silently and keeps the rest', async () => {
        await load(oldSave(10, 1));
        expect(GameState.state.progress.guildUpgrades).toEqual({ bank_tabs: 1, roster_size: 1 });
        expect(inv().maxSlots).toBe(128);
    });

    it('spills a first tab holding more than 64 kinds into the tabs with room, losing nothing', async () => {
        await load(oldSave(150, 2));
        const counts = bankTabCounts(inv());
        expect([...counts.values()]).toEqual([64, 64, 22]);
        for (let i = 0; i < 150; i++) expect(InventoryManager.getItemCount(kind(i))).toBe(i + 1);
        // The tab's manual order is kept in front: what moved came off its end.
        const first = bankTabLayout(inv())[inv().groupOrder[0]];
        expect(first.slice(0, 2)).toEqual([kind(149), kind(0)]);
    });

    it('keeps what finds no room in its tab until the player moves it, and takes no new kind', async () => {
        await load(oldSave(100, 0));
        expect(Object.keys(inv().items)).toHaveLength(100);
        expect(bankTabCounts(inv()).get('default-loot')).toBe(100);
        for (let i = 0; i < 100; i++) expect(InventoryManager.getItemCount(kind(i))).toBe(i + 1);
        expect(InventoryManager.lacksSlotFor('item_new')).toBe(true);
        expect(InventoryManager.addItem(kind(7), 1)).toBe(1);

        // A Bank Tabs rank later gives the extra a home.
        setTabRanks(1);
        expect([...bankTabCounts(inv()).values()]).toEqual([64, 36]);
        expect(Object.keys(inv().items)).toHaveLength(100);
    });
});
