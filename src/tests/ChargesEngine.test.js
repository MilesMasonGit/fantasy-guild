import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as Charges from '../systems/board/Charges.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { SKILL_SPEED_FACTOR } from '../config/FormulaRegistry.js';

/**
 * The charges engine (Recipe & Charges rework, P1).
 *
 * Three of these are load-bearing beyond their own assertion, because each
 * covers a bug that would be **invisible until it had corrupted a save**:
 *
 * 1. **Atomicity.** A cycle that cannot be paid in full must deduct nothing —
 *    not an item, not a station charge, not a context charge. A partial
 *    deduction silently drains the player's Bank and their Tokens for no output.
 * 2. **The unlimited no-op (R-4).** `usesRemaining === null` is *unlimited*, not
 *    zero. Getting the comparison backwards destroys the Tokens a player
 *    considers permanent, and the destruction is not undoable.
 * 3. **The positive-delta ceiling.** A `+charges` effect that overshoots the
 *    Token's starting charges inflates a save's value permanently.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/** Skill speed shortens every authored cycle — see `TokenCycle.test.js`. */
function cycleMs(base, level = 50) {
    return base / (1 + level * SKILL_SPEED_FACTOR);
}

function makeHero(id, level = 50) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level, skills, hp: { current: 100, max: 100 } };
}

function place(tile, typeId, heroId = null, uses = undefined) {
    const instance = BoardState.createTokenInstance(
        typeId, uses === undefined ? tokenStartingUses(typeId) : uses
    );
    Placement.placeToken(tile, instance);
    TileModifiers.rebuildAround(tile);
    if (heroId) Placement.placeHero(heroId, tile);
    return BoardState.getToken(tile);
}

function run(ms) {
    for (let t = 0; t < ms; t += 100) BoardRunner.tick(100);
}

/** `pooled_charged_bar`: 1 Coal, 3 station charges, 2 context charges, 10s. */
const STATION = 17, CONTEXT = 18, CONTEXT_2 = 10, OTHER_STATION = 19;

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

describe('A charge delta moves the pool', () => {
    it('spends on a negative delta and leaves the Token alive above zero', () => {
        const instance = place(STATION, 'fixture_charged_context');   // uses: 6
        Charges.applyDelta(STATION, instance, -2);
        expect(instance.usesRemaining).toBe(4);
        expect(BoardState.getToken(STATION)).toBe(instance);
    });

    it('changes nothing at all on a zero delta', () => {
        const instance = place(STATION, 'fixture_charged_context');
        const result = Charges.applyDelta(STATION, instance, 0);
        expect(result.applied).toBe(0);
        expect(instance.usesRemaining).toBe(6);
    });

    it('restores on a positive delta', () => {
        const instance = place(STATION, 'fixture_charged_context', null, 2);
        Charges.applyDelta(STATION, instance, 3);
        expect(instance.usesRemaining).toBe(5);
    });

    /** The ceiling. Overshooting it inflates a save permanently. */
    it('never restores past the Token type’s starting charges', () => {
        const instance = place(STATION, 'fixture_charged_context', null, 5);
        const result = Charges.applyDelta(STATION, instance, 99);
        expect(instance.usesRemaining).toBe(6);       // uses: 6, not 104
        expect(result.applied).toBe(1);
    });

    it('is a no-op on a Token already at its ceiling', () => {
        const instance = place(STATION, 'fixture_charged_context');   // already 6
        const result = Charges.applyDelta(STATION, instance, 4);
        expect(instance.usesRemaining).toBe(6);
        expect(result.applied).toBe(0);
    });
});

describe('An unlimited Token ignores charge deltas in both directions (R-4)', () => {
    it('is not spent by a negative delta', () => {
        const instance = place(STATION, 'fixture_charged_context_unlimited');
        Charges.applyDelta(STATION, instance, -5);
        expect(instance.usesRemaining).toBeNull();
        expect(BoardState.getToken(STATION)).toBe(instance);
    });

    it('is not filled by a positive delta', () => {
        const instance = place(STATION, 'fixture_charged_context_unlimited');
        Charges.applyDelta(STATION, instance, 5);
        expect(instance.usesRemaining).toBeNull();
    });

    /**
     * ⚠️ `null` is the opposite of `0`, not a large version of it. A comparison
     * that read it as zero would destroy the Token on the first delta.
     */
    it('is never destroyed by a delta', () => {
        const instance = place(STATION, 'fixture_charged_context_unlimited');
        for (let i = 0; i < 20; i++) Charges.applyDelta(STATION, instance, -3);
        expect(BoardState.getToken(STATION)).toBe(instance);
        expect(instance.usesRemaining).toBeNull();
    });

    it('can afford any cost', () => {
        const instance = place(STATION, 'fixture_charged_context_unlimited');
        expect(Charges.canAfford(instance, 9999)).toBe(true);
    });
});

describe('Reaching zero destroys the Token', () => {
    it('empties the tile and leaves a vacancy behind it', () => {
        const instance = place(STATION, 'fixture_charged_context', null, 2);
        const result = Charges.applyDelta(STATION, instance, -2);
        expect(result.depleted).toBe(true);
        expect(BoardState.getToken(STATION)).toBeNull();
        expect(BoardState.getVacancy(STATION)?.typeId).toBe('fixture_charged_context');
    });
});

// ---------------------------------------------------------------------------
// Atomicity — the rule the whole phase rests on
// ---------------------------------------------------------------------------

describe('A cycle it cannot pay for in full deducts nothing', () => {
    /** Station short on its own charges: 2 left, the recipe wants 3. */
    it('takes no item and no charge when the station is short of charges', () => {
        InventoryManager.addItem('item_coal', 5);
        place(STATION, 'fixture_charge_station', 'hero_1', 2);
        const context = place(CONTEXT, 'fixture_charged_context');

        run(cycleMs(10000) + 2000);

        expect(InventoryManager.getItemCount('item_coal')).toBe(5);
        expect(BoardState.getToken(STATION).usesRemaining).toBe(2);
        expect(context.usesRemaining).toBe(6);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(0);
        expect(BoardState.getToken(STATION).alert).toBe(ALERT.CHARGES);
    });

    /** Context short: 1 charge left, the recipe wants 2 off it. */
    it('takes no item and no station charge when the context Token is short', () => {
        InventoryManager.addItem('item_coal', 5);
        place(STATION, 'fixture_charge_station', 'hero_1');
        const context = place(CONTEXT, 'fixture_charged_context', null, 1);

        run(cycleMs(10000) + 2000);

        expect(InventoryManager.getItemCount('item_coal')).toBe(5);
        expect(BoardState.getToken(STATION).usesRemaining).toBe(10);
        expect(BoardState.getToken(CONTEXT)).toBe(context);
        expect(context.usesRemaining).toBe(1);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(0);
    });

    /** Items short: no charge of either kind may move. */
    it('takes no charge of either kind when the Bank is short of items', () => {
        place(STATION, 'fixture_charge_station', 'hero_1');
        const context = place(CONTEXT, 'fixture_charged_context');

        run(cycleMs(10000) + 2000);

        expect(BoardState.getToken(STATION).usesRemaining).toBe(10);
        expect(context.usesRemaining).toBe(6);
        expect(BoardState.getToken(STATION).alert).toBe(ALERT.INPUTS);
    });

    it('pays everything at once on a cycle it can afford', () => {
        InventoryManager.addItem('item_coal', 5);
        place(STATION, 'fixture_charge_station', 'hero_1');
        const context = place(CONTEXT, 'fixture_charged_context');

        run(cycleMs(10000) + 300);

        expect(InventoryManager.getItemCount('item_coal')).toBe(4);
        expect(BoardState.getToken(STATION).usesRemaining).toBe(7);   // 10 − 3
        expect(context.usesRemaining).toBe(4);                        // 6 − 2
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Sharing and prioritisation
// ---------------------------------------------------------------------------

describe('Adjacent context Tokens are chosen and shared', () => {
    /**
     * Concept §3.3: the near-depleted tile clears first, so the board tidies
     * itself rather than leaving every provider at a fraction.
     */
    it('draws from the Token with the fewest charges left first', () => {
        const scarce = place(CONTEXT, 'fixture_charged_context', null, 2);
        const full = place(CONTEXT_2, 'fixture_charged_context');

        const plan = Charges.planContextCharges(
            STATION, [{ tag: 'ctx_fixture_charged', minTier: 1, chargeCost: 2 }]
        );

        expect(plan.ok).toBe(true);
        expect(plan.debits).toEqual([
            { tile: CONTEXT, instance: scarce, amount: 2 }
        ]);
        expect(full.usesRemaining).toBe(6);
    });

    it('spreads one requirement across providers when the first cannot cover it', () => {
        place(CONTEXT, 'fixture_charged_context', null, 1);
        place(CONTEXT_2, 'fixture_charged_context');

        const plan = Charges.planContextCharges(
            STATION, [{ tag: 'ctx_fixture_charged', minTier: 1, chargeCost: 3 }]
        );

        expect(plan.ok).toBe(true);
        expect(plan.debits.map(d => [d.tile, d.amount]).sort())
            .toEqual([[CONTEXT, 1], [CONTEXT_2, 2]].sort());
    });

    it('charges nothing when an unlimited provider supplies the tag (R-4)', () => {
        place(CONTEXT, 'fixture_charged_context');
        place(CONTEXT_2, 'fixture_charged_context_unlimited');

        const plan = Charges.planContextCharges(
            STATION, [{ tag: 'ctx_fixture_charged', minTier: 1, chargeCost: 2 }]
        );

        expect(plan.ok).toBe(true);
        expect(plan.debits).toEqual([]);
    });

    /**
     * First-come, first-served (concept §3.3). One context Token between two
     * stations serves both, and the charges simply run out sooner — sharing is a
     * rate trade, not free value (D-157).
     */
    it('serves several stations from one Token until it runs dry', () => {
        InventoryManager.addItem('item_coal', 20);
        place(STATION, 'fixture_charge_station', 'hero_1');
        place(OTHER_STATION, 'fixture_charge_station', 'hero_2');
        const context = place(CONTEXT, 'fixture_charged_context');   // 6 charges

        run(cycleMs(10000) + 300);

        // Both stations completed the same cycle and each took 2.
        expect(context.usesRemaining).toBe(2);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(2);

        run(cycleMs(10000) + 300);

        // The second round could only afford one of them; the Token is gone and
        // the tile it stood on is empty.
        expect(BoardState.getToken(CONTEXT)).toBeNull();
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(3);
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
        run(cycleMs(12000) * 2 + 600);
        expect(buff.usesRemaining).toBe(3);
        expect(BoardState.getToken(STATION + 1)).toBe(buff);
    });

    it('spends the authored amount on a negative delta', () => {
        const buff = producerBeside(STATION, 'fixture_trigger_costly');   // −2 of 3
        run(cycleMs(12000) + 300);
        expect(buff.usesRemaining).toBe(1);
    });

    /**
     * Concept §3.2: the effect **cannot activate** below its cost. It does not
     * fire for free and it does not go into debt — so the Token sits at 1 charge
     * indefinitely rather than being destroyed by a firing it could not pay for.
     */
    it('cannot fire at all once its cost exceeds the charges left', () => {
        const buff = producerBeside(STATION, 'fixture_trigger_costly');
        run(cycleMs(12000) * 4 + 600);
        expect(buff.usesRemaining).toBe(1);
        expect(BoardState.getToken(STATION + 1)).toBe(buff);
    });

    it('restores on a positive delta, ceilinged at the starting charges', () => {
        const buff = producerBeside(STATION, 'fixture_trigger_restoring', 1);  // +2 of 4
        run(cycleMs(12000) + 300);
        expect(buff.usesRemaining).toBe(3);
        run(cycleMs(12000) * 3 + 600);
        expect(buff.usesRemaining).toBe(4);            // never 5, 7, 9…
    });

    it('leaves an unlimited Token alone whatever the delta says (R-4)', () => {
        const buff = producerBeside(STATION, 'fixture_trigger_unlimited');
        run(cycleMs(12000) * 3 + 600);
        expect(buff.usesRemaining).toBeNull();
        expect(BoardState.getToken(STATION + 1)).toBe(buff);
    });

    /** No `chargeDelta` authored means one charge, as every statement did before. */
    it('spends one charge for a statement that authors no delta', () => {
        const buff = producerBeside(STATION, 'fixture_trigger_wearing');   // uses: 3
        run(cycleMs(12000) + 300);
        expect(buff.usesRemaining).toBe(2);
    });
});
