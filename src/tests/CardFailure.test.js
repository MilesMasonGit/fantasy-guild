import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from '../systems/effects/constants.js';
import { completeWorkCycle } from '../systems/cards/logic/WorkProcessor.js';
import {
    collectRequiredInputs,
    checkInputsAvailable,
    preflightWorkCycle
} from '../systems/cards/logic/CardPreflight.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(),
    success: vi.fn(), error: vi.fn(), getQueue: vi.fn(() => [])
}));

/**
 * Card work failure states (mutator_roadmap_v1.md Phase 6, §10 / §15.9).
 *
 * The headline is roadmap finding F5: `completeWorkCycle` used to grant loot
 * BEFORE consuming inputs, so a Card could pay out and only afterwards discover
 * it couldn't afford itself. The pre-flight makes the exchange atomic.
 */

const ORE = 'item_copper_ore';
const COAL = 'item_coal';
const INGOT = 'item_copper_ingot';

/** A processing-style card: consumes ORE, produces INGOT. */
function smeltingCard(overrides = {}) {
    return {
        id: 'card_smelt',
        templateId: 'card_smelt',
        name: 'Test Smelter',
        areaId: 'area_test',
        aggregator: new ModifierAggregator('card_smelt'),
        assignedItems: { 0: ORE },
        traits: [
            { type: 'workcycle', skill: 'forge' },
            { type: 'inputslot', slotIndex: 0, itemId: ORE, quantity: 2 }
        ],
        outputs: [{ itemId: INGOT, quantity: 1, chance: 100 }],
        ...overrides
    };
}

describe('Card work pre-flight (roadmap F5)', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
    });

    describe('collectRequiredInputs', () => {
        it('reads the required inputs off inputslot traits', () => {
            const req = collectRequiredInputs(smeltingCard(), null);
            expect(req).toEqual([{ itemId: ORE, quantity: 2 }]);
        });

        it('applies the Token INPUT_COST axis, so a cost mutator is what gets checked', () => {
            const card = smeltingCard();
            card.aggregator.addModifier({
                source: 'greedy', type: EFFECT_TYPES.INPUT_COST, value: 2,
                bucket: 'multiplier', target: { category: TARGET_CATEGORIES.ALL }
            });
            expect(collectRequiredInputs(card, null)).toEqual([{ itemId: ORE, quantity: 4 }]);
        });

        it('skips tool slots — a tool is held, not spent', () => {
            const card = smeltingCard({
                assignedItems: { 0: ORE },
                traits: [{ type: 'inputslot', slotIndex: 0, itemId: ORE, quantity: 1, isTool: true }]
            });
            expect(collectRequiredInputs(card, null)).toEqual([]);
        });

        it('a gathering card with no inputs requires nothing', () => {
            const card = smeltingCard({ traits: [{ type: 'workcycle', skill: 'labor' }], assignedItems: {} });
            expect(collectRequiredInputs(card, null)).toEqual([]);
        });
    });

    describe('checkInputsAvailable', () => {
        it('counts the bank', () => {
            InventoryManager.addItem(ORE, 5);
            expect(checkInputsAvailable(smeltingCard(), [{ itemId: ORE, quantity: 2 }]).ok).toBe(true);
        });

        it('counts the card stack alongside the bank', () => {
            const card = smeltingCard({ stack: [{ type: 'item', id: ORE }, { type: 'item', id: ORE }] });
            expect(checkInputsAvailable(card, [{ itemId: ORE, quantity: 2 }]).ok).toBe(true);
        });

        it('reports what is short', () => {
            InventoryManager.addItem(ORE, 1);
            const { ok, missing } = checkInputsAvailable(smeltingCard(), [{ itemId: ORE, quantity: 2 }]);
            expect(ok).toBe(false);
            expect(missing).toEqual([{ itemId: ORE, needed: 2, available: 1 }]);
        });
    });

    describe('preflightWorkCycle', () => {
        it('passes when the inputs are stocked', () => {
            InventoryManager.addItem(ORE, 10);
            expect(preflightWorkCycle(smeltingCard(), null)).toBeNull();
        });

        it('fails with reason "inputs" when starved', () => {
            const failure = preflightWorkCycle(smeltingCard(), null);
            expect(failure?.reason).toBe('inputs');
        });
    });

    describe('F5 — output and consumption are atomic', () => {
        it('a starved card produces NOTHING (the F5 bug: it used to pay out first)', () => {
            InventoryManager.addItem(ORE, 1);          // needs 2, has 1
            const card = smeltingCard();

            completeWorkCycle(card, card.traits[0]);

            // No ingot was granted…
            expect(InventoryManager.getItemCount(INGOT)).toBe(0);
            // …and the ore it couldn't afford was NOT consumed either.
            expect(InventoryManager.getItemCount(ORE)).toBe(1);
            expect(card.lastFailure?.reason).toBe('inputs');
        });

        it('a stocked card produces its output and pays its cost', () => {
            InventoryManager.addItem(ORE, 5);
            const card = smeltingCard();

            completeWorkCycle(card, card.traits[0]);

            expect(card.lastFailure).toBeNull();
            expect(InventoryManager.getItemCount(ORE)).toBe(3);      // 5 − 2
            expect(InventoryManager.getItemCount(INGOT)).toBe(1);
        });

        it('a token-doubled cost can starve a card that would otherwise succeed (§10)', () => {
            InventoryManager.addItem(ORE, 2);          // enough at base cost…
            const card = smeltingCard();
            card.aggregator.addModifier({              // …but a Trawler-style cost ×2 needs 4
                source: 'greedy', type: EFFECT_TYPES.INPUT_COST, value: 2,
                bucket: 'multiplier', target: { category: TARGET_CATEGORIES.ALL }
            });

            completeWorkCycle(card, card.traits[0]);

            expect(card.lastFailure?.reason).toBe('inputs');
            expect(InventoryManager.getItemCount(ORE)).toBe(2);      // untouched
            expect(InventoryManager.getItemCount(INGOT)).toBe(0);
        });

        it('a gathering card with no inputs still works normally', () => {
            const card = smeltingCard({
                traits: [{ type: 'workcycle', skill: 'labor' }],
                assignedItems: {},
                outputs: [{ itemId: COAL, quantity: 1, chance: 100 }]
            });

            completeWorkCycle(card, card.traits[0]);

            expect(card.lastFailure).toBeNull();
            expect(InventoryManager.getItemCount(COAL)).toBe(1);
        });
    });

    describe('bank capacity overflow (§8)', () => {
        it('canAccept mirrors the slot limit without mutating anything', () => {
            GameState.state.inventory.maxSlots = 2;
            InventoryManager.addItem(ORE, 1);
            InventoryManager.addItem(COAL, 1);

            expect(InventoryManager.canAccept(ORE, 1)).toBe(true);    // existing stack
            expect(InventoryManager.canAccept(INGOT, 1)).toBe(false); // new type, no slot
            // nothing was added by asking
            expect(InventoryManager.getItemCount(INGOT)).toBe(0);
        });

        it('a card whose output has nowhere to go FAILS instead of dropping it', () => {
            InventoryManager.addItem(ORE, 10);
            // Fill the bank so the ingot has no slot to land in.
            GameState.state.inventory.maxSlots = 2;
            InventoryManager.addItem(COAL, 1);

            const card = smeltingCard();
            completeWorkCycle(card, card.traits[0]);

            expect(card.lastFailure?.reason).toBe('capacity');
            expect(card.lastFailure.detail.blocked).toContain(INGOT);
            // Full time was spent, but nothing moved in either direction.
            expect(InventoryManager.getItemCount(INGOT)).toBe(0);
            expect(InventoryManager.getItemCount(ORE)).toBe(10);
        });

        it('a multi-output card survives when only SOME outputs are blocked', () => {
            // Task outputs are a "pick one" cluster, so a card listing
            // ingot-or-coal must not fail just because the ingot has no slot —
            // it could still have rolled the coal.
            InventoryManager.addItem(ORE, 10);            // slot 1
            InventoryManager.addItem(COAL, 1);            // slot 2 — has room
            GameState.state.inventory.maxSlots = 2;       // INGOT is now homeless

            const card = smeltingCard({
                outputs: [
                    { itemId: INGOT, quantity: 1, chance: 50 },  // blocked (no slot)
                    { itemId: COAL, quantity: 1, chance: 50 }    // storable
                ]
            });
            completeWorkCycle(card, card.traits[0]);

            expect(card.lastFailure).toBeNull();          // not a failure
        });

        it('fails only when NO output can be stored', () => {
            InventoryManager.addItem(ORE, 10);            // slot 1
            InventoryManager.addItem('item_water', 1);    // slot 2
            GameState.state.inventory.maxSlots = 2;       // both outputs homeless

            const card = smeltingCard({
                outputs: [
                    { itemId: INGOT, quantity: 1, chance: 50 },
                    { itemId: COAL, quantity: 1, chance: 50 }
                ]
            });
            completeWorkCycle(card, card.traits[0]);

            expect(card.lastFailure?.reason).toBe('capacity');
            expect(card.lastFailure.detail.blocked).toEqual([INGOT, COAL]);
            expect(InventoryManager.getItemCount(ORE)).toBe(10);   // ore untouched
        });

        it('inputs are checked before capacity — the starved card reports "inputs"', () => {
            GameState.state.inventory.maxSlots = 1;
            const card = smeltingCard();          // no ore at all
            completeWorkCycle(card, card.traits[0]);
            expect(card.lastFailure?.reason).toBe('inputs');
        });

        it('a card still succeeds when its output has room', () => {
            InventoryManager.addItem(ORE, 10);
            GameState.state.inventory.maxSlots = 20;

            const card = smeltingCard();
            completeWorkCycle(card, card.traits[0]);

            expect(card.lastFailure).toBeNull();
            expect(InventoryManager.getItemCount(INGOT)).toBe(1);
        });
    });

    describe('End of Work fires on failure too (§16)', () => {
        it('a failed card still resolves rather than no-opping', async () => {
            const { EventBus } = await import('../systems/core/EventBus.js');
            const seen = [];
            const unsub = EventBus.subscribe('module_cycle_complete', d => seen.push(d));

            const card = smeltingCard();          // starved
            completeWorkCycle(card, card.traits[0]);

            expect(seen).toHaveLength(1);
            expect(seen[0].failed).toBe(true);
            if (typeof unsub === 'function') unsub();
        });
    });
});
