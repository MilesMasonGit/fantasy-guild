import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import { matW, matH } from '../config/matGeometry.js';

/**
 * Bank overflow — D-138: **nothing is ever lost to a full Bank.**
 *
 * Written in Phase 0 as a skipped spec, **enabled in Phase 3** when the sprite
 * layer arrived. It supersedes `CardFailure.test.js`'s bank-capacity cases,
 * which encoded the exact behaviour this reverses.
 *
 * ## What changed
 * | Before                                          | Now                          |
 * | :--                                             | :--                          |
 * | `addItem` warned and destroyed the overflow     | It becomes a board sprite    |
 * | Preflight refused a cycle with nowhere to put it| The cycle runs; loot lands   |
 *
 * The reasoning: a full Bank should announce itself the way every other problem
 * on this board does — **visibly**, as litter piling up across the grid —
 * rather than by silently stopping production in a way that looks identical to
 * a supply shortage. It is also the only thing protecting a one-copy-ever
 * Mythic drop.
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

// D-138 ("a cycle with nowhere to put its output still completes") was asserted
// here against `CardPreflight`, which the card retirement deleted: the board
// reimplemented that rule for itself in `BoardRunner`/`InputAllocator`, and the
// card-era copy had no live caller left. The rule itself is still covered on the
// live path — see `TokenCycle.test.js` ("waits when inputs are missing, D-114")
// and `Risk13Allocation.test.js` for starvation behaviour.

// 'Tokens collect into the Token Vault, or wait on the floor' went with Token
// loot and the Vault (Token Lifecycle 9.3): a Token a recipe makes now stands
// on the mat beside its station (TL-8, `TokenOutputsOnMat.test.js`).

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

