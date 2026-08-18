import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { preflightWorkCycle } from '../systems/board/CardPreflight.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import { BOARD_PX } from '../ui/components/board/boardConstants.js';

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

vi.mock('../systems/progression/QuestTracker.js', () => ({
    QuestTracker: { processEvent: vi.fn() }
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

describe('D-138 — a cycle with nowhere to put its output still completes', () => {
    it('preflight no longer refuses on capacity', () => {
        fillBank(2);
        const card = { traits: [], aggregator: null };
        const outputs = [{ itemId: 'item_gold_ingot', quantity: 1 }];

        // Previously: { reason: 'capacity' }. The Work Time is spent either way;
        // the only question was whether the player got anything for it.
        expect(preflightWorkCycle(card, {}, outputs)).toBeNull();
    });

    it('still refuses when the INPUTS are missing — that rule is untouched', () => {
        const card = {
            traits: [{ type: 'inputslot', itemId: 'item_coal', quantity: 2, slotIndex: 0 }],
            assignedItems: { 0: 'item_coal' },
            aggregator: null
        };
        const failure = preflightWorkCycle(card, {}, []);
        expect(failure?.reason).toBe('inputs');
    });
});

/**
 * ⚠️ **The cascade reversed on 2026-08-07 (D-232).** These cases used to assert
 * Tray → Token Bank → the board, per D-158. Tokens now go to **storage first**:
 * a burst no longer fills the rack with things the player did not choose, and
 * the Tray holds only what was put there on purpose.
 *
 * **D-138's guarantee is untouched and is what the last case still pins:**
 * nothing is ever destroyed by a full anything.
 */
describe('Tokens cascade Tray → Token Bank → the board', () => {
    it('a Token sprite collects into the Tray first for immediate play', () => {
        SpriteLayer.addSprite('token', 'token_forest', 1, 10, 500);
        const sprite = SpriteLayer.getSprites()[0];

        expect(SpriteLayer.collectSprite(sprite.id)).toBe(true);
        expect(BoardState.getTray()).toHaveLength(1);
        expect(BoardState.getTray()[0].typeId).toBe('token_forest');
        expect(BoardState.getTray()[0].usesRemaining).toBe(500);
        expect(BoardState.tokenBankCopies('token_forest')).toHaveLength(0);
    });

    it('falls through to the Token Bank when the Tray is full', () => {
        for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
            BoardState.addToTray(BoardState.createTokenInstance('filler', 1));
        }
        SpriteLayer.addSprite('token', 'token_forest', 1, 10, 500);

        expect(SpriteLayer.collectSprite(SpriteLayer.getSprites()[0].id)).toBe(true);
        expect(BoardState.tokenBankCopies('token_forest')).toHaveLength(1);
        expect(BoardState.tokenBankCopies('token_forest')[0].usesRemaining).toBe(500);
    });

    it('a Mythic with nowhere to go WAITS on the board rather than being lost', () => {
        // One-copy-ever. This is the case D-138 exists for.
        for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
            BoardState.addToTray(BoardState.createTokenInstance('filler', 1));
        }
        SpriteLayer.addSprite('token', 'token_deck_of_many_things', 1, 10, null);

        const sprite = SpriteLayer.getSprites().find(s => s.refId === 'token_deck_of_many_things');
        SpriteLayer.collectSprite(sprite.id);

        // Wherever it ends up — Tray, Token Bank or still on the floor — there is
        // exactly one of it, and it was never destroyed. That is the whole
        // guarantee for a one-copy-ever drop.
        expect(
            BoardState.tokenBankCopies('token_deck_of_many_things').length +
            BoardState.getTray().filter(t => t.typeId === 'token_deck_of_many_things').length +
            SpriteLayer.getSprites().filter(s => s.refId === 'token_deck_of_many_things').length
        ).toBe(1);
    });

    it('preserves an unlimited-use Token’s null charges through the round trip', () => {
        SpriteLayer.addSprite('token', 'token_campfire', 1, 10, null);
        SpriteLayer.collectSprite(SpriteLayer.getSprites()[0].id);
        expect(BoardState.getTray()[0].usesRemaining).toBeNull();
    });
});

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
    it('grab-and-place takes a Token off the board without banking it (UI §6)', () => {
        SpriteLayer.addSprite('token', 'token_forest', 1, 10, 500);
        const instance = SpriteLayer.takeTokenSprite(SpriteLayer.getSprites()[0].id);

        expect(instance.typeId).toBe('token_forest');
        expect(instance.usesRemaining).toBe(500);
        expect(SpriteLayer.getSprites()).toHaveLength(0);
        expect(BoardState.getTray()).toHaveLength(0);   // no trip through storage
    });

    it('lands sprites inside the board, never off the edge', () => {
        for (const tile of [0, 6, 42, 48, 24]) {
            SpriteLayer.addSprite('item', `item_${tile}`, 1, tile);
        }
        for (const s of SpriteLayer.getSprites()) {
            expect(s.x).toBeGreaterThanOrEqual(0);
            expect(s.y).toBeGreaterThanOrEqual(0);
            expect(s.x).toBeLessThanOrEqual(BOARD_PX);
            expect(s.y).toBeLessThanOrEqual(BOARD_PX);
        }
    });

    it('does NOT merge Tokens — each carries its own charges', () => {
        // Summing two half-spent Forests into "2 Forests" would invent or
        // destroy uses. Consolidating partials is the Token Bank's job (D-77).
        SpriteLayer.addSprite('token', 'token_forest', 1, 10, 100);
        SpriteLayer.addSprite('token', 'token_forest', 1, 20, 4000);
        expect(SpriteLayer.getSprites()).toHaveLength(2);
    });

    it('collecting a floating Token routes to the Tray first, then Token Vault', () => {
        // Tray has room -> token enters Tray
        SpriteLayer.addSprite('token', 'token_forest', 1, 10, 100);
        const spriteId = SpriteLayer.getSprites()[0].id;
        expect(SpriteLayer.collectSprite(spriteId)).toBe(true);
        expect(BoardState.getTray()).toHaveLength(1);
        expect(BoardState.getTray()[0].typeId).toBe('token_forest');

        // Fill Tray to max capacity (18)
        while (BoardState.getTray().length < BoardState.TRAY_CAPACITY) {
            BoardState.addToTray(BoardState.createTokenInstance('token_forest', 100));
        }
        expect(BoardState.hasTraySpace()).toBe(false);

        // Next token collection falls through to Token Vault (Bank)
        SpriteLayer.addSprite('token', 'token_yew_stand', 1, 10, 500);
        const nextSpriteId = SpriteLayer.getSprites()[0].id;
        expect(SpriteLayer.collectSprite(nextSpriteId)).toBe(true);
        expect(BoardState.tokenBankCopies('token_yew_stand')).toHaveLength(1);
    });
});
