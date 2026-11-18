import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { bankTabLayout, mergeTabOrder, reorderTabIds } from '../systems/inventory/bankTabs.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { GAME_VERSION, validateSaveData } from '../state/StateSchema.js';
import { wordStartsMatch } from '../ui/components/drawer/bankSort.js';

// The Bank's order: a dragged tile takes the target's place, an item that runs out keeps its
// place through reorders and sorts, and an item filed into a tab goes where the player sees the end.

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
const first = () => inv().groupOrder[0];
const second = () => inv().groupOrder[1];
const shown = (gid) => bankTabLayout(inv())[gid];

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.progress.guildUpgrades = { bank_tabs: 1 };
    GuildUpgradeManager.recompute();
    for (const id of ['a', 'b', 'c', 'd', 'e']) InventoryManager.addItem(id, 1);
});

describe('dragging a Bank tile onto another', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];

    it('a forward drop takes the target place', () => {
        expect(reorderTabIds(ids, 'a', 'b')).toEqual(['b', 'a', 'c', 'd', 'e']);
        expect(reorderTabIds(ids, 'a', 'd')).toEqual(['b', 'c', 'd', 'a', 'e']);
        expect(reorderTabIds(ids, 'a', 'e')).toEqual(['b', 'c', 'd', 'e', 'a']);
    });

    it('a backward drop takes the target place too', () => {
        expect(reorderTabIds(ids, 'd', 'b')).toEqual(['a', 'd', 'b', 'c', 'e']);
        expect(reorderTabIds(ids, 'e', 'a')).toEqual(['e', 'a', 'b', 'c', 'd']);
    });

    it('a drop on itself or an unknown tile changes nothing', () => {
        expect(reorderTabIds(ids, 'c', 'c')).toEqual(ids);
        expect(reorderTabIds(ids, 'c', 'zz')).toEqual(ids);
    });

    it('drags the first tile over two others in the game state', () => {
        InventoryManager.setGroupOrder(first(), reorderTabIds(shown(first()), 'a', 'c'));
        expect(shown(first())).toEqual(['b', 'c', 'a', 'd', 'e']);
    });
});

describe('an item that runs out keeps its place', () => {
    it('through a reorder of the other tiles', () => {
        InventoryManager.setGroupOrder(first(), ['c', 'a', 'b', 'd', 'e']);
        InventoryManager.removeItem('a', 1);
        expect(shown(first())).toEqual(['c', 'b', 'd', 'e']);
        // The tiles the player sees, reordered: 'a' is not among them.
        InventoryManager.setGroupOrder(first(), reorderTabIds(shown(first()), 'e', 'c'));
        InventoryManager.addItem('a', 1);
        expect(shown(first())).toEqual(['e', 'c', 'a', 'b', 'd']);
    });

    it('at the front through a sort of the rest', () => {
        InventoryManager.setGroupOrder(first(), ['e', 'a', 'b', 'c', 'd']);
        InventoryManager.removeItem('e', 1);
        InventoryManager.setGroupOrder(first(), ['d', 'c', 'b', 'a']);
        InventoryManager.addItem('e', 1);
        expect(shown(first())).toEqual(['e', 'd', 'c', 'b', 'a']);
    });

    it('several hidden ids keep their order after the id they followed', () => {
        expect(mergeTabOrder(['x', 'a', 'h1', 'h2', 'b', 'h3'], ['b', 'a']))
            .toEqual(['x', 'b', 'h3', 'a', 'h1', 'h2']);
        expect(mergeTabOrder(undefined, ['a'])).toEqual(['a']);
        expect(mergeTabOrder(['a', 'h', 'h'], ['a'])).toEqual(['a', 'h']);
    });
});

describe('filing an item into a tab', () => {
    it('puts it at the end the player sees in a never-arranged tab', () => {
        expect(inv().groupDefs[first()].orderedItems).toEqual([]);
        InventoryManager.moveItemToGroup('a', second());
        expect(InventoryManager.moveItemToGroup('a', first())).toBe(true);
        expect(shown(first())).toEqual(['b', 'c', 'd', 'e', 'a']);
    });

    it('dropped on its own tab button goes to the end', () => {
        expect(InventoryManager.moveItemToGroup('b', first())).toBe(true);
        expect(shown(first())).toEqual(['a', 'c', 'd', 'e', 'b']);
    });

    it('dropped on a tile of a never-arranged tab takes that tile place', () => {
        InventoryManager.moveItemToGroup('e', second());
        // The Bank passes the target tile's index in the order shown.
        expect(InventoryManager.moveItemToGroup('e', first(), shown(first()).indexOf('c'))).toBe(true);
        expect(shown(first())).toEqual(['a', 'b', 'e', 'c', 'd']);
    });

    it('keeps an out-of-stock id of the target tab at its place', () => {
        InventoryManager.setGroupOrder(first(), ['d', 'a', 'b', 'c']);
        InventoryManager.removeItem('a', 1);
        InventoryManager.moveItemToGroup('e', second());
        InventoryManager.moveItemToGroup('e', first());
        InventoryManager.addItem('a', 1);
        expect(shown(first())).toEqual(['d', 'a', 'b', 'c', 'e']);
    });
});

describe('a saved tab order', () => {
    it('from an older save still loads, out-of-stock ids and all', () => {
        GameState.initNew();
        const state = GameState.serialize().state;
        state.inventory.items = { a: { quantity: 1, dur: null }, b: { quantity: 2, dur: null }, c: { quantity: 3, dur: null } };
        state.inventory.groupDefs['default-loot'].orderedItems = ['c', 'gone', 'a'];
        const migrated = migrateState(state, GAME_VERSION);
        expect(validateSaveData({ version: GAME_VERSION, state: migrated }).errors).toEqual([]);
        loadSavedState(migrated);
        InventoryManager.init();
        expect(shown('default-loot')).toEqual(['c', 'a', 'b']);
        InventoryManager.setGroupOrder('default-loot', ['b', 'a', 'c']);
        expect(inv().groupDefs['default-loot'].orderedItems).toEqual(['b', 'a', 'c', 'gone']);
    });
});

describe('Bank search and apostrophes', () => {
    it('finds a possessive typed with or without its apostrophe', () => {
        expect(wordStartsMatch("Fighter's Charm", 'fighters')).toBe(true);
        expect(wordStartsMatch("Fighter's Charm", "fighter's")).toBe(true);
        expect(wordStartsMatch("Fighter's Charm", 'fighter')).toBe(true);
        expect(wordStartsMatch("Chief's Tent Map", 'chiefs tent')).toBe(true);
        expect(wordStartsMatch('Chief’s Tent Map', 'chiefs')).toBe(true);
        expect(wordStartsMatch('Fighters Charm', "fighter's")).toBe(true);
    });

    it('still matches only word starts', () => {
        expect(wordStartsMatch('Iron Ore', 'ore')).toBe(true);
        expect(wordStartsMatch('Forest Map', 'ore')).toBe(false);
        expect(wordStartsMatch("Chief's Tent Map", 'hiefs')).toBe(false);
    });
});
