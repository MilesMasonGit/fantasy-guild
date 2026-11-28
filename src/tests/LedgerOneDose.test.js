import { describe, it, expect } from 'vitest';
import { buildLedger } from '../systems/progression/ledger/engine.js';
import { buildPace, PROFILE } from '../../cms/src/engine/ledger/pace.js';
import { paceContent } from './fixtures/paceWorld.js';

/** These numbers were worked out for a camp of two nodes, the sparse layout; the pace times the dense one by default. */
const SPARSE = { layout: 'sparse' };

/**
 * ⭐ A hero holds one drink-type consumable at a time (owner, 2026-11-26): a drink, a work potion or
 * an elixir, never two. The ledger's Typical takes the best one whose batch pays back, Maxed the
 * best one whatever its batch. Poisons, bait, arrows and Motes are not boosts and are not counted.
 */

const VEIN = { token: 'token_vein' };
const paceOf = (content, settings = null) => buildPace(content, buildLedger(content), { ...SPARSE, ...settings });
const provides = (id, type, bucket, value, to, extra = {}) => ({ id: `stm_${id}`, keyword: 'provides', to, reach: 'nearby', payload: { type, bucket, value, ...extra } });

/** The pace world (Beer: +10 % XP on any work) with two mining potions brewed at the Still from Oak Wood: a Small one (+5 % yield) and a Big one (+100 %). */
function doseContent() {
    const c = paceContent();
    for (const [key, name, pct] of [['small', 'Small Draught', 0.05], ['big', 'Big Draught', 1]]) {
        c.effects[`fx_${key}_yield`] = { id: `fx_${key}_yield`, name: `${name} yield`, statements: [provides(`${key}_yield`, 'YIELD', 'percentage', pct, { mode: 'all', value: '' })] };
        c.effects[`fx_${key}`] = {
            id: `fx_${key}`, name,
            statements: [{ id: `stm_${key}`, keyword: 'applies', to: { mode: 'all', value: '' }, target: { role: 'actor' }, when: { event: 'WORK_START', scope: 'self', skill: 'mining' }, payload: { effectId: `fx_${key}_yield`, scale: 1, durationMs: 0, forCycle: true, chance: 100 } }]
        };
        c.items[`item_${key}_draught`] = { id: `item_${key}_draught`, name, type: 'potion', equipSlot: 'consumable', stackable: true, effects: [{ effectId: `fx_${key}`, scale: 1 }], plan: { tier: 0 } };
        c.recipes.push({ id: `recipe_${key}_draught`, name, skill: 'cooking', levelRequirement: 1, stationKinds: ['still'], durationMs: 3000, xp: 1, inputs: [{ itemId: 'item_oak_wood', quantity: 1 }], outputs: [{ itemId: `item_${key}_draught`, chance: 100, minQty: 1, maxQty: 1 }] });
    }
    return c;
}

const DOSES = new Set(['item_beer', 'item_small_draught', 'item_big_draught']);
const dosesOf = (pick) => (pick.setup.consumables || []).filter(id => DOSES.has(id));

describe('one drink-type consumable at a time', () => {
    it('⭐ Typical takes the best one whose batch pays back, and only one', () => {
        const pace = paceOf(doseContent(), { batchPayback: 1e-6 });
        const typical = pace.rateAt(VEIN, PROFILE.TYPICAL);
        expect(dosesOf(typical)).toEqual(['item_big_draught']);
        expect(typical.chosen.filter(c => DOSES.has(c.id)).map(c => c.id)).toEqual(['item_big_draught']);
    });

    it('⭐ Maxed holds the best one whatever its batch, never a drink beside a potion', () => {
        const pace = paceOf(doseContent(), { batchPayback: 1e-6 });
        expect(dosesOf(pace.rateAt(VEIN, PROFILE.MAXED))).toEqual(['item_big_draught']);
        // No batch pays back: Typical holds none, Maxed still the best.
        const strict = paceOf(doseContent(), { batchPayback: 1e9 });
        expect(dosesOf(strict.rateAt(VEIN, PROFILE.TYPICAL))).toEqual([]);
        expect(dosesOf(strict.rateAt(VEIN, PROFILE.MAXED))).toEqual(['item_big_draught']);
    });

    it('⭐ Maxed swaps Typical\'s dose for a better one its batch keeps from Typical', () => {
        // A 5 min brew: on the vein's camp and mines Typical holds, the Big Draught's batch pays back about 0.62x its
        // making, the Beer's and the Small Draught's about 1.34x. At 1x the Big one is dropped and Typical holds one of
        // the two that pass (the Small Draught lifts the camp more), and Maxed the Big Draught in its place.
        const c = doseContent();
        c.recipes.find(r => r.id === 'recipe_big_draught').durationMs = 300000;
        const pace = paceOf(c, { batchPayback: 1 });
        const typical = pace.rateAt(VEIN, PROFILE.TYPICAL);
        expect(typical.batches.get('item_big_draught').ratio).toBeLessThan(1);
        expect(dosesOf(typical)).toEqual(['item_small_draught']);
        expect(typical.batches.get('item_small_draught').ratio).toBeGreaterThanOrEqual(1);
        expect(dosesOf(pace.rateAt(VEIN, PROFILE.MAXED))).toEqual(['item_big_draught']);
        expect(pace.rateAt(VEIN, PROFILE.MAXED).chosen.filter(x => DOSES.has(x.id)).map(x => x.id)).toEqual(['item_big_draught']);
    });
});
