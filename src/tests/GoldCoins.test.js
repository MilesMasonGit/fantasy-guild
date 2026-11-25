import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { INITIAL_STATE, GAME_VERSION, validateSaveData } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { coinWorthOf, stackWorth, coinWorthProblem, coinWorthFindings } from '../config/registries/itemCoins.js';
import { getCoins, addCoins, bankStackWorth, bankStacksWorth, sellBankStack, sellBankStacks } from '../systems/inventory/Coins.js';
import { auditContent } from '../systems/core/ContentAudit.js';

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Gold Coins, the basics: coins are a whole number on the guild, in the save (an older save
 * starts at 0); every item has a coin worth from the CMS (`coinWorth`, absent is 0); selling a
 * Bank stack, or several, pays its worth and takes the Bank's copies only.
 */

registerItems({
    gc_ore: { id: 'gc_ore', name: 'Coin Ore', type: 'material', stackable: true, coinWorth: 3 },
    gc_gem: { id: 'gc_gem', name: 'Coin Gem', type: 'material', stackable: true, coinWorth: 40 },
    gc_dust: { id: 'gc_dust', name: 'Coin Dust', type: 'material', stackable: true }
});

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.items = {};
});

describe('an item\'s coin worth', () => {
    it('reads a whole number of 0 or more, and anything else as 0', () => {
        expect(coinWorthOf({ coinWorth: 7 })).toBe(7);
        expect(coinWorthOf({ coinWorth: 0 })).toBe(0);
        expect(coinWorthOf({ coinWorth: '12' })).toBe(12);
        expect(coinWorthOf({})).toBe(0);
        expect(coinWorthOf(null)).toBe(0);
        expect(coinWorthOf({ coinWorth: -2 })).toBe(0);
        expect(coinWorthOf({ coinWorth: 1.5 })).toBe(0);
        expect(coinWorthOf({ coinWorth: 'lots' })).toBe(0);
        expect(stackWorth({ coinWorth: 3 }, 7)).toBe(21);
    });

    it('a worth the game cannot read is an audit line; absent or whole is none', () => {
        expect(coinWorthProblem({})).toBeNull();
        expect(coinWorthProblem({ coinWorth: 0 })).toBeNull();
        expect(coinWorthProblem({ coinWorth: 9 })).toBeNull();
        expect(coinWorthProblem({ coinWorth: -1 })).toMatch(/Coin worth "-1" is not a whole number of 0 or more/);
        expect(coinWorthProblem({ coinWorth: 2.5 })).toMatch(/not a whole number/);
        const found = coinWorthFindings({ items: { a: { id: 'a', name: 'A', coinWorth: -3 }, b: { id: 'b', coinWorth: 4 } } });
        expect(found).toEqual([{ entityType: 'Item', entityId: 'a', entityName: 'A', message: expect.stringMatching(/sells for nothing/) }]);
    });

    it('the boot audit says it', () => {
        registerItems({ gc_bad: { id: 'gc_bad', name: 'Bad Coin', type: 'material', coinWorth: -5 } });
        const lines = auditContent();
        expect(lines.some(f => f.where === 'Item "gc_bad"' && /Coin worth/.test(f.what))).toBe(true);
    });
});

describe('coins on the guild', () => {
    it('a new game starts with 0 coins', () => {
        expect(INITIAL_STATE.progress.coins).toBe(0);
        expect(GameState.state.progress.coins).toBe(0);
        expect(getCoins()).toBe(0);
    });

    it('adding coins announces the new count', () => {
        const heard = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.COINS_UPDATED, p => heard.push(p));
        addCoins(5);
        addCoins(0);
        off();
        expect(getCoins()).toBe(5);
        expect(heard).toEqual([{ coins: 5, added: 5 }]);
    });

    it('the count round-trips through a save', () => {
        addCoins(1234);
        const data = JSON.parse(JSON.stringify(GameState.serialize()));
        expect(validateSaveData(data).errors).toEqual([]);
        const migrated = migrateState(data.state, data.version);
        expect(migrated.progress.coins).toBe(1234);
        GameState.initFromSave(migrated);
        expect(getCoins()).toBe(1234);
    });

    it('an older save, written before coins, loads with 0', () => {
        const data = JSON.parse(JSON.stringify(GameState.serialize()));
        delete data.state.progress.coins;
        expect(data.version).toBe(GAME_VERSION);
        const migrated = migrateState(data.state, data.version);
        expect(migrated.progress.coins).toBe(0);
        GameState.initFromSave(migrated);
        expect(getCoins()).toBe(0);
        addCoins(2);
        expect(getCoins()).toBe(2);
    });
});

describe('selling from the Bank', () => {
    it('one stack pays its worth and leaves the Bank', () => {
        InventoryManager.addItem('gc_ore', 7);
        expect(bankStackWorth('gc_ore')).toEqual({ count: 7, coins: 21 });
        expect(sellBankStack('gc_ore')).toBe(21);
        expect(InventoryManager.getItemCount('gc_ore')).toBe(0);
        expect(getCoins()).toBe(21);
    });

    it('an item with no worth sells for 0: the Bank clears and the count stays', () => {
        InventoryManager.addItem('gc_dust', 4);
        expect(sellBankStack('gc_dust')).toBe(0);
        expect(InventoryManager.getItemCount('gc_dust')).toBe(0);
        expect(getCoins()).toBe(0);
    });

    it('a stack the Bank does not hold sells nothing', () => {
        expect(sellBankStack('gc_ore')).toBeNull();
        expect(getCoins()).toBe(0);
    });

    it('several stacks pay their total at once', () => {
        InventoryManager.addItem('gc_ore', 2);
        InventoryManager.addItem('gc_gem', 3);
        InventoryManager.addItem('gc_dust', 9);
        expect(bankStacksWorth(['gc_ore', 'gc_gem', 'gc_dust', 'gc_missing'])).toEqual({ stacks: 3, count: 14, coins: 126 });
        const heard = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.COINS_UPDATED, p => heard.push(p));
        expect(sellBankStacks(['gc_ore', 'gc_gem', 'gc_dust', 'gc_missing'])).toEqual({ sold: ['gc_ore', 'gc_gem', 'gc_dust'], coins: 126 });
        off();
        expect(heard).toEqual([{ coins: 126, added: 126 }]);
        for (const id of ['gc_ore', 'gc_gem', 'gc_dust']) expect(InventoryManager.getItemCount(id)).toBe(0);
        expect(getCoins()).toBe(126);
    });
});
