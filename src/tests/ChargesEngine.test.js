import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as Charges from '../systems/board/Charges.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ALERT, BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EventBus } from '../systems/core/EventBus.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { pickRecipe } from './fixtures/stations.js';

/**
 * The charges engine (Recipe & Charges rework, P1).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

function makeHero(id, level = 50) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles.
 * A lattice of mat points 160 u apart — the step the old board had — so the
 * station and the context Token beside it are neighbours at the shipped 164 u
 * Near, and one context Token reaches both stations.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`, and its instance id. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;
const idAt = (i) => tokenAt(i)?.id ?? null;

/** What ran dry on spot `i`, or null. */

function place(tile, typeId, heroId = null, uses = undefined) {
    const instance = BoardState.createTokenInstance(
        typeId, uses === undefined ? tokenStartingUses(typeId) : uses
    );
    Placement.placeTokenAt(instance, C(tile));
    pickRecipe(instance);   // the player picks a station's recipe
    TileModifiers.rebuildAround([instance]);
    if (heroId) Orders.orderAt(heroId, C(tile));
    return instance;
}

function run(ms) {
    for (let t = 0; t < ms; t += 100) BoardRunner.tick(100);
}

/** `pooled_charged_bar`: 1 Coal, 3 station charges, 2 context charges, 10s (charges no longer spent). */

const STATION = 15, CONTEXT = 16, CONTEXT_2 = 9, OTHER_STATION = 17;

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    InputAllocator.resetStarvationStats();
    TriggerSystem.init();
    GameState.state.heroes = [makeHero('hero_1'), makeHero('hero_2')];
    GameState.state.inventory.maxSlots = 50;
});

// ---------------------------------------------------------------------------
// The arithmetic, unit by unit
// ---------------------------------------------------------------------------

/**
 * ⚠️ Stations and supports never wear out (brief 230 S1a, `wearRule.js`): a `Works as` station and a
 * context Token are unlimited whatever they author. The pool arithmetic and the atomic cycle are
 * exercised on `fixture_charged_context_node`, a gathering node offering the same context tag,
 * whose 6 charges are its stock and still move.
 */
const NODE = 'fixture_charged_context_node';

describe('A charge delta moves the pool', () => {
    it('spends on a negative delta and leaves the Token alive above zero', () => {
        const instance = place(STATION, NODE);   // uses: 6
        Charges.applyDelta(instance, -2);
        expect(instance.usesRemaining).toBe(4);
        expect(tokenAt(STATION)).toBe(instance);
    });

    it('changes nothing at all on a zero delta', () => {
        const instance = place(STATION, NODE);
        const result = Charges.applyDelta(instance, 0);
        expect(result.applied).toBe(0);
        expect(instance.usesRemaining).toBe(6);
    });

    it('restores on a positive delta', () => {
        const instance = place(STATION, NODE, null, 2);
        Charges.applyDelta(instance, 3);
        expect(instance.usesRemaining).toBe(5);
    });

    /** The ceiling. Overshooting it inflates a save permanently. */
    it('never restores past the Token type’s starting charges', () => {
        const instance = place(STATION, NODE, null, 5);
        const result = Charges.applyDelta(instance, 99);
        expect(instance.usesRemaining).toBe(6);       // uses: 6, not 104
        expect(result.applied).toBe(1);
    });

    it('is a no-op on a Token already at its ceiling', () => {
        const instance = place(STATION, NODE);   // already 6
        const result = Charges.applyDelta(instance, 4);
        expect(instance.usesRemaining).toBe(6);
        expect(result.applied).toBe(0);
    });
});

describe('An unlimited Token ignores charge deltas in both directions (R-4)', () => {
    it('is not spent by a negative delta', () => {
        const instance = place(STATION, 'fixture_charged_context_unlimited');
        Charges.applyDelta(instance, -5);
        expect(instance.usesRemaining).toBeNull();
        expect(tokenAt(STATION)).toBe(instance);
    });

    it('is not filled by a positive delta', () => {
        const instance = place(STATION, 'fixture_charged_context_unlimited');
        Charges.applyDelta(instance, 5);
        expect(instance.usesRemaining).toBeNull();
    });

    /**
     * ⚠️ `null` is the opposite of `0`, not a large version of it. A comparison
     * that read it as zero would destroy the Token on the first delta.
     */
    it('is never destroyed by a delta', () => {
        const instance = place(STATION, 'fixture_charged_context_unlimited');
        for (let i = 0; i < 20; i++) Charges.applyDelta(instance, -3);
        expect(tokenAt(STATION)).toBe(instance);
        expect(instance.usesRemaining).toBeNull();
    });

    it('can afford any cost', () => {
        const instance = place(STATION, 'fixture_charged_context_unlimited');
        expect(Charges.canAfford(instance, 9999)).toBe(true);
    });
});

describe('Reaching zero destroys the Token', () => {
    it('empties the spot, and nothing is owed it (Managers retired, 9.2)', () => {
        const instance = place(STATION, NODE, null, 2);
        const result = Charges.applyDelta(instance, -2);
        expect(result.depleted).toBe(true);
        expect(tokenAt(STATION)).toBeNull();
        expect(GameState.state.board.vacancies).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Atomicity — the rule the whole phase rests on
// ---------------------------------------------------------------------------

describe('A cycle it cannot pay for in full deducts nothing', () => {
    /**
     * A station is never short of its own charges: it never wears out (brief 230 S1a). A copy
     * saved holding 2, against a recipe that once cost 3 of them, runs and keeps its 2; the
     * context beside it pays nothing either (help is free).
     */
    it('a station is never short of its own charges: an old copy holding 2 runs, and keeps them', () => {
        InventoryManager.addItem('item_coal', 5);
        place(STATION, 'fixture_charge_station', 'hero_1', 2);
        const context = place(CONTEXT, NODE);

        run(10000 + 300);

        expect(InventoryManager.getItemCount('item_coal')).toBe(4);
        expect(tokenAt(STATION).usesRemaining).toBe(2);
        expect(context.usesRemaining).toBe(6);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);
        expect(tokenAt(STATION).alert ?? null).not.toBe(ALERT.CHARGES);
    });

    /** A Token's own cost: 1 to run plus 2 for its own per-cycle rule, against 2 left. */
    it('takes no item and no charge when the Token is short of its own charges', () => {
        InventoryManager.addItem('item_coal', 5);
        const kiln = place(STATION, 'fixture_own_cost_kiln', 'hero_1', 2);

        run(10000 + 2000);

        expect(InventoryManager.getItemCount('item_coal')).toBe(5);
        expect(kiln.usesRemaining).toBe(2);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(0);
        expect(kiln.alert).toBe(ALERT.CHARGES);
    });

    /** Items short: no charge may move. */
    it('takes no charge when the Bank is short of items', () => {
        const kiln = place(STATION, 'fixture_own_cost_kiln', 'hero_1');

        run(10000 + 2000);

        expect(kiln.usesRemaining).toBe(10);
        expect(kiln.alert).toBe(ALERT.INPUTS);
    });

    it('pays everything at once on a cycle it can afford', () => {
        InventoryManager.addItem('item_coal', 5);
        const kiln = place(STATION, 'fixture_own_cost_kiln', 'hero_1');
        let cycles = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p.instanceId === kiln.id) cycles++; });

        run(10000 + 300);
        off();

        expect(cycles).toBe(1);
        expect(InventoryManager.getItemCount('item_coal')).toBe(4);
        expect(kiln.usesRemaining).toBe(7);                 // 10 − (1 + 2)
        // One charcoal, or two when the kiln's own +5 % yield rolls its extra one.
        expect([1, 2]).toContain(SpriteLayer.countOnBoard('fixture_charcoal'));
    });
});

// ---------------------------------------------------------------------------
// Context Tokens: needed, never paid (help is free, owner 2026-10-24)
// ---------------------------------------------------------------------------

describe('Nearby context Tokens are needed, and never paid', () => {
    it('no provider pays, whatever the recipe’s charge cost: a gathering node offering the tag included', () => {
        const node = place(CONTEXT, NODE, null, 2);
        place(CONTEXT_2, NODE);
        // The reader measures from the station Token itself (slice 1.6b), so one stands there.
        place(STATION, 'fixture_charge_station');

        const plan = Charges.planContextCharges(
            idAt(STATION), [{ tag: 'ctx_fixture_charged', minTier: 1, chargeCost: 3 }]
        );

        expect(plan).toEqual({ ok: true, debits: [], missing: [] });
        expect(node.usesRemaining).toBe(2);
    });

    it('a tag nobody near offers is still missing', () => {
        place(STATION, 'fixture_charge_station');
        const plan = Charges.planContextCharges(
            idAt(STATION), [{ tag: 'ctx_fixture_charged', minTier: 1, chargeCost: 2 }]
        );
        expect(plan).toEqual({ ok: false, debits: [], missing: [{ tag: 'ctx_fixture_charged', reason: 'absent' }] });
    });

    it('a pure context Token is a support and pays nothing, whatever it holds (brief 230 S1a)', () => {
        place(CONTEXT, 'fixture_charged_context', null, 6);
        place(STATION, 'fixture_charge_station');

        const plan = Charges.planContextCharges(
            idAt(STATION), [{ tag: 'ctx_fixture_charged', minTier: 1, chargeCost: 2 }]
        );

        expect(plan.ok).toBe(true);
        expect(plan.debits).toEqual([]);
    });

    it('charges nothing when an unlimited provider supplies the tag (R-4)', () => {
        place(CONTEXT, NODE);
        place(CONTEXT_2, 'fixture_charged_context_unlimited');
        // The reader measures from the station Token itself (slice 1.6b), so one stands there.
        place(STATION, 'fixture_charge_station');

        const plan = Charges.planContextCharges(
            idAt(STATION), [{ tag: 'ctx_fixture_charged', minTier: 1, chargeCost: 2 }]
        );

        expect(plan.ok).toBe(true);
        expect(plan.debits).toEqual([]);
    });

    it('one context Token serves several stations, for nothing', () => {
        InventoryManager.addItem('item_coal', 20);
        place(STATION, 'fixture_charge_station', 'hero_1');
        place(OTHER_STATION, 'fixture_charge_station', 'hero_2');
        const context = place(CONTEXT, NODE);   // 6 charges

        run((10000 + 300) * 2);

        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(4);
        expect(context.usesRemaining).toBe(6);
    });
});

// ---------------------------------------------------------------------------
// Effect-level deltas, through the trigger engine
// ---------------------------------------------------------------------------

describe('An effect block spends its own charge delta', () => {
    /** The producer beside it completes cycles; each completion fires the buff. */
    function producerBeside(tile, buffTypeId, uses = undefined) {
        place(tile, 'fixture_producer', 'hero_1');
        return place(tile + 1, buffTypeId, null, uses);
    }

    it('spends nothing on a zero delta', () => {
        const buff = producerBeside(STATION, 'fixture_trigger_free');
        run(12000 * 2 + 600);
        expect(buff.usesRemaining).toBe(3);
        expect(tokenAt(STATION + 1)).toBe(buff);
    });

    it('spends the authored amount on a negative delta', () => {
        const buff = producerBeside(STATION, 'fixture_trigger_costly');   // −2 of 3
        run(12000 + 300);
        expect(buff.usesRemaining).toBe(1);
    });

    /**
     * Concept §3.2: the effect **cannot activate** below its cost. It does not
     * fire for free and it does not go into debt — so the Token sits at 1 charge
     * indefinitely rather than being destroyed by a firing it could not pay for.
     */
    it('cannot fire at all once its cost exceeds the charges left', () => {
        const buff = producerBeside(STATION, 'fixture_trigger_costly');
        run(12000 * 4 + 600);
        expect(buff.usesRemaining).toBe(1);
        expect(tokenAt(STATION + 1)).toBe(buff);
    });

    it('restores on a positive delta, ceilinged at the starting charges', () => {
        const buff = producerBeside(STATION, 'fixture_trigger_restoring', 1);  // +2 of 4
        run(12000 + 300);
        expect(buff.usesRemaining).toBe(3);
        run(12000 * 3 + 600);
        expect(buff.usesRemaining).toBe(4);            // never 5, 7, 9…
    });

    it('leaves an unlimited Token alone whatever the delta says (R-4)', () => {
        const buff = producerBeside(STATION, 'fixture_trigger_unlimited');
        run(12000 * 3 + 600);
        expect(buff.usesRemaining).toBeNull();
        expect(tokenAt(STATION + 1)).toBe(buff);
    });

    /** No `chargeDelta` authored means one charge, as every statement did before. */
    it('spends one charge for a statement that authors no delta', () => {
        const buff = producerBeside(STATION, 'fixture_trigger_wearing');   // uses: 3
        run(12000 + 300);
        expect(buff.usesRemaining).toBe(2);
    });
});
