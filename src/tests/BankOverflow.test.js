import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { checkOutputCapacity } from '../systems/cards/logic/CardPreflight.js';

/**
 * Bank overflow — D-138, "nothing is ever lost to a full Bank".
 *
 * ## Status: half live, half waiting for Phase 3
 * The tests in §1 pin what the game does **today**, so the inversion in Phase 3
 * is a deliberate, visible change rather than an accident. The tests in §2
 * describe D-138 and are **skipped until Phase 3 builds the sprite layer**.
 *
 * ## The inversion
 * Today a full Bank has two defences, and D-138 removes both:
 *
 *   | Today                                              | D-138 (Phase 3)                    |
 *   | :--                                                | :--                                |
 *   | `InventoryManager.addItem` returns 0 and warns —   | The overflow becomes a board       |
 *   | the item is gone                                   | sprite. Nothing is destroyed.      |
 *   | `CardPreflight.checkOutputCapacity` blocks the      | The cycle completes. The loot      |
 *   | whole cycle when no output can be stored           | lands on the floor.                |
 *
 * The design's reasoning: a Bank at capacity should announce itself the way
 * everything else on this board does — **visibly, as litter piling up across the
 * grid** — rather than through an error message. It is also the only thing that
 * protects a one-copy-ever Mythic from being lost to a full Token Bank.
 *
 * ## This file supersedes part of `CardFailure.test.js`
 * That suite's Bank-full cases (`maxSlots = 2`, "INGOT is now homeless") encode
 * exactly the behaviour D-138 reverses. When Phase 3 lands, those cases retire
 * and these take over. `CardFailure`'s *input*-failure cases are unaffected and
 * stay where they are.
 *
 * @see playmat_roadmap_v1.md Phase 0 §D, Phase 3 §D
 * @see playmat_gap_analysis.md §2.1
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
});

// ---------------------------------------------------------------------------
// §1 — Today's behaviour. Phase 3 inverts all of this.
// ---------------------------------------------------------------------------

describe('§1 Current behaviour — a full Bank destroys and refuses', () => {
    it('addItem returns 0 for a new type when every slot is taken', () => {
        fillBank(2);
        expect(InventoryManager.addItem('item_gold_ingot', 5)).toBe(0);
        expect(GameState.state.inventory.items.item_gold_ingot).toBeUndefined();
    });

    it('the quantity is not held anywhere — it is simply gone', () => {
        fillBank(2);
        InventoryManager.addItem('item_gold_ingot', 5);
        // No pending queue, no overflow store. This is the loss D-138 removes.
        const stored = Object.values(GameState.state.inventory.items)
            .reduce((n, e) => n + e.quantity, 0);
        expect(stored).toBe(2);   // just the two fillers
    });

    it('an existing stack still accepts more at the slot cap', () => {
        fillBank(2);
        // Unchanged by D-138 — slots are the cap, stacks are not (D-137).
        expect(InventoryManager.addItem('item_filler_0', 4)).toBe(4);
    });

    it('preflight blocks a cycle when NO output can be stored', () => {
        fillBank(2);
        const { ok, blocked } = checkOutputCapacity([{ itemId: 'item_gold_ingot', quantity: 1 }]);
        expect(ok).toBe(false);
        expect(blocked).toContain('item_gold_ingot');
    });

    it('preflight allows the cycle when ANY output can be stored', () => {
        fillBank(2);
        // "Pick one" cluster semantics: one storable output is enough.
        const { ok } = checkOutputCapacity([
            { itemId: 'item_gold_ingot', quantity: 1 },   // homeless
            { itemId: 'item_filler_0', quantity: 1 }      // has a stack already
        ]);
        expect(ok).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// §2 — D-138. Enable this block in Phase 3 §D and delete §1 above.
// ---------------------------------------------------------------------------

describe.skip('§2 D-138 — nothing is ever lost to a full Bank [Phase 3]', () => {
    /**
     * Phase 3 must wire, at minimum:
     *   - `InventoryManager.addItem` hands the unstorable remainder to the
     *     sprite layer instead of dropping it and warning.
     *   - `CardPreflight.preflightWorkCycle` no longer returns `reason:
     *     'capacity'` — the capacity check goes away entirely.
     *   - The same rule for the Token Bank, which is what protects a Mythic.
     *
     * The assertions below are written against the *outcome* rather than a
     * specific API, so Phase 3 is free to choose the mechanism. Adjust the
     * helper calls, not the rules.
     */

    it('a full Bank turns an incoming item into a board sprite', () => {
        fillBank(2);
        InventoryManager.addItem('item_gold_ingot', 5);
        // The 5 exist somewhere — on the floor, not in the void.
        // expect(SpriteLayer.totalOf('item_gold_ingot')).toBe(5);
    });

    it('a cycle whose output has nowhere to go still completes', () => {
        // The Work Time was spent; the Token resolved. Only the destination
        // changed. This is the direct inverse of §1's preflight block.
    });

    it('a Mythic Token can never be lost to a full Token Bank', () => {
        // One-copy-ever. It waits on the board until a slot exists.
    });

    it('collecting a sprite into a Bank that is still full leaves it on the floor', () => {
        // Auto-collect cannot collect into a full Bank — the sprites accumulate,
        // and that accumulation IS the signal (grid concept §3.4).
    });

    it('sprites survive a save and reload', () => {
        // A Mythic sitting on the floor because the Bank was full must not
        // evaporate on reload. This is the one piece of board runtime state
        // that is deliberately persisted.
    });
});
