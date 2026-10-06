import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { EventBus } from '../systems/core/EventBus.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import { matW, matH } from '../config/matGeometry.js';

/**
 * Bank overflow — **nothing is ever lost to a full Bank.**
 */

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

/** Fill the item Bank to its slot cap with distinct types. */
function fillBank(slots = 2) {
    GameState.state.inventory.maxSlots = slots;
    for (let i = 0; i < slots; i++) InventoryManager.addItem(`item_filler_${i}`, 1);
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();          // wires the overflow subscription
});

describe('D-138 — a full Bank never destroys anything', () => {
    it('turns an unstorable item into a board sprite', () => {
        fillBank(2);
        InventoryManager.addItem('item_gold_ingot', 5);

        // The 5 exist — on the floor, not in the void.
        expect(SpriteLayer.countOnBoard('item_gold_ingot')).toBe(5);
    });

    it('keeps the item out of the Bank while the Bank is full', () => {
        fillBank(2);
        InventoryManager.addItem('item_gold_ingot', 5);
        expect(GameState.state.inventory.items.item_gold_ingot).toBeUndefined();
    });

    it('still accepts additions to a type the Bank already holds', () => {
        fillBank(2);
        expect(InventoryManager.addItem('item_filler_0', 4)).toBe(4);
        expect(SpriteLayer.countOnBoard('item_filler_0')).toBe(0);
    });

    it('collecting into a Bank that is STILL full leaves the sprite alone', () => {
        // Auto-collect cannot collect into a full Bank. A player running at
        // zero visible stacks will still see sprites accumulate at their slot
        // cap, and that accumulation IS the signal (grid concept §3.4).
        fillBank(2);
        InventoryManager.addItem('item_gold_ingot', 5);
        const sprite = SpriteLayer.getSprites()[0];

        expect(SpriteLayer.collectSprite(sprite.id)).toBe(false);
        expect(SpriteLayer.countOnBoard('item_gold_ingot')).toBe(5);
    });

    it('collects once the player makes room', () => {
        fillBank(2);
        InventoryManager.addItem('item_gold_ingot', 5);

        GameState.state.inventory.maxSlots = 3;      // a Bank Slots upgrade
        expect(SpriteLayer.collectAll()).toBe(1);

        expect(SpriteLayer.countOnBoard('item_gold_ingot')).toBe(0);
        expect(GameState.state.inventory.items.item_gold_ingot.quantity).toBe(5);
    });

    it('does not duplicate the sprite when a collect attempt fails', () => {
        // The trap: collect → addItem fails → publishes overflow → a SECOND
        // sprite appears, and every sweep doubles the pile.
        fillBank(2);
        InventoryManager.addItem('item_gold_ingot', 5);

        SpriteLayer.collectAll();
        SpriteLayer.collectAll();
        SpriteLayer.collectAll();

        expect(SpriteLayer.getSprites()).toHaveLength(1);
        expect(SpriteLayer.countOnBoard('item_gold_ingot')).toBe(5);
    });
});

// The rule itself is still covered on the live path — see `TokenCycle.test.js`
// ("waits when inputs are missing") and `Risk13Allocation.test.js` for
// starvation behaviour.

// 'Tokens collect into the Token Vault, or wait on the floor' went with Token
// loot and the Vault (Token Lifecycle 9.3): a Token a recipe makes now stands
// on the mat beside its station (`TokenOutputsOnMat.test.js`).

describe('Sprites feed Tokens directly (D-42)', () => {
    it('loot on the ground never starves a chain', () => {
        SpriteLayer.addSprite('item', 'item_coal', 3, 10);
        SpriteLayer.addSprite('item', 'item_coal', 4, 20);

        expect(SpriteLayer.consumeFromSprites('item_coal', 5)).toBe(5);
        expect(SpriteLayer.countOnBoard('item_coal')).toBe(2);
    });

    it('takes only what is there and reports the shortfall honestly', () => {
        SpriteLayer.addSprite('item', 'item_coal', 2, 10);
        expect(SpriteLayer.consumeFromSprites('item_coal', 5)).toBe(2);
        expect(SpriteLayer.countOnBoard('item_coal')).toBe(0);
    });

    it('never touches a different item', () => {
        SpriteLayer.addSprite('item', 'item_wood', 5, 10);
        expect(SpriteLayer.consumeFromSprites('item_coal', 3)).toBe(0);
        expect(SpriteLayer.countOnBoard('item_wood')).toBe(5);
    });
});

describe('Sprite behaviour', () => {
    it('lands sprites inside the board, never off the edge', () => {
        for (const tile of [0, 6, 42, 48, 24]) {
            SpriteLayer.addSprite('item', `item_${tile}`, 1, tile);
        }
        for (const s of SpriteLayer.getSprites()) {
            expect(s.x).toBeGreaterThanOrEqual(0);
            expect(s.y).toBeGreaterThanOrEqual(0);
            expect(s.x).toBeLessThanOrEqual(matW());
            expect(s.y).toBeLessThanOrEqual(matH());
        }
    });

    // 'grab-and-place', 'does NOT merge Tokens' and 'collecting a floating
    // Token routes to the Token Vault' went with Token sprites (9.3).

    it('refuses a Token sprite: only items drop as loot (Token Lifecycle 9.3)', () => {
        expect(SpriteLayer.addSprite('token', 'token_forest', 1, 10, 500)).toBeNull();
        expect(SpriteLayer.getSprites()).toHaveLength(0);
    });
});



describe('⭐ a full Bank under a loot flood (CR3-254)', () => {
    /** 30 refused piles of distinct items, over a stack cap of 10. */
    function flood() {
        fillBank(2);
        const list = GameState.state.board.sprites = [];
        for (let i = 0; i < 30; i++) {
            list.push({ id: `spr_flood_${i}`, kind: 'item', refId: `item_flood_${i}`, quantity: 1, x: 200 + i, y: 200, bornAt: i });
        }
        SettingsManager.set('gameplay.maxItemStacks', 10);
        return list;
    }

    afterEach(() => SettingsManager.set('gameplay.maxItemStacks', 40));

    it('leaves every refused pile where it is, with nothing announced', () => {
        const list = flood();
        const publish = vi.spyOn(EventBus, 'publish');
        SpriteLayer.tick(100);
        expect(list).toHaveLength(30);
        expect(publish.mock.calls.map(c => c[0])).not.toContain('state_changed');
        publish.mockRestore();
    });

    it('room appearing WITHOUT an inventory_updated (a bank_slots rank written straight into the save) is swept on the next tick', () => {
        const list = flood();
        SpriteLayer.tick(100);
        expect(list).toHaveLength(30);

        GameState.state.inventory.maxSlots = 5;           // no event at all
        SpriteLayer.tick(100);
        // The three oldest piles take the three new slots; the rest wait.
        expect(list).toHaveLength(27);
        expect(GameState.state.inventory.items.item_flood_0.quantity).toBe(1);
        expect(GameState.state.inventory.items.item_flood_2.quantity).toBe(1);
        expect(GameState.state.inventory.items.item_flood_3).toBeUndefined();
    });

    it('room made by the Guild Hall upgrade (GuildUpgradeManager.recompute) is swept on the next tick', () => {
        const list = flood();
        SpriteLayer.tick(100);
        GameState.state.progress.guildUpgrades = { bank_slots: 1 };   // +32 slots
        GuildUpgradeManager.recompute();
        SpriteLayer.tick(100);
        expect(list).toHaveLength(10);                    // back down to the stack cap
    });
});
