/**
 * Economic simulator — the runner (phase P3+4).
 *
 * Covers `cms/src/engine/sim/simRunner.js`: the two acceptance criteria that
 * are properties of the whole assembly line rather than of any one pass —
 * **idempotence** (plan §11) and **termination** (plan §3.4) — plus the rule
 * that the passes write nothing.
 *
 * ⚠️ These tests run the engine over the real `data/` corpus. That corpus is
 * placeholder content whose Tempo/Purpose tags are provisional test substrate,
 * so nothing here asserts a *number* from it — only that the machinery behaves:
 * every item is either priced or has a row explaining why, and re-running
 * changes nothing.
 */

import { describe, it, expect } from 'vitest';

import { runSim } from '../../cms/src/engine/sim/simRunner.js';

import tokenData from '../../data/tokens.json';
import recipeData from '../../data/tokenRecipes.json';
import itemData from '../../data/items.json';

const corpus = () => ({ tokens: tokenData, recipes: recipeData, items: itemData });

/** A stable, comparable snapshot of everything a run produced. */
const snapshot = (result) => JSON.stringify({
    cycleTimes: [...result.cycleTimes.entries()].sort(),
    elections: [...result.elections.entries()].map(([k, v]) => [k, v.sourceId, v.reason]).sort(),
    values: [...result.values.entries()].sort(),
    rows: result.rows,
});

describe('EconSim — the runner', () => {
    it('runs the whole line over the shipped corpus without throwing', () => {
        const result = runSim(corpus());
        expect(result.values.size).toBeGreaterThan(0);
        expect(result.elections.size).toBeGreaterThan(0);
    });

    it('is idempotent: two runs on identical input are byte-identical (plan §11)', () => {
        expect(snapshot(runSim(corpus()))).toBe(snapshot(runSim(corpus())));
    });

    it('writes nothing — the corpus it was handed is unmutated', () => {
        const before = JSON.stringify({ tokens: tokenData, recipes: recipeData, items: itemData });
        runSim(corpus());
        expect(JSON.stringify({ tokens: tokenData, recipes: recipeData, items: itemData })).toBe(before);
    });

    it('gives every item either a value or a row saying why not', () => {
        const result = runSim(corpus());
        const explained = new Set(result.rows.filter(r => r.itemId).map(r => r.itemId));

        for (const itemId of Object.keys(itemData)) {
            if (result.values.has(itemId)) continue;
            expect(explained.has(itemId), `${itemId} is neither priced nor explained`).toBe(true);
        }
    });

    it('elects exactly one anchor per priced item, and prices each item once', () => {
        const result = runSim(corpus());
        for (const [itemId, value] of result.values) {
            expect(result.elections.has(itemId)).toBe(true);
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(1);
        }
    });

    it('terminates on a graph containing a cycle rather than hanging', () => {
        // A three-recipe ring, plus a healthy chain beside it. The healthy side
        // must still price; the ring must refuse. There is no iteration to
        // diverge — the walk stops when a sweep prices nothing.
        const ring = ['a', 'b', 'c'].map((letter, i, all) => ({
            id: `recipe_${letter}`, name: `recipe_${letter}`, skill: 'crafting', levelRequirement: 1,
            durationMs: 10000, sim: { tempo: 'fast', purpose: 'gph' },
            inputs: [{ itemId: `item_${all[(i + all.length - 1) % all.length]}`, quantity: 1 }],
            outputs: [{ itemId: `item_${letter}`, chance: 100, minQty: 1, maxQty: 1 }],
        }));

        const start = Date.now();
        const result = runSim({
            tokens: {
                token_root: {
                    id: 'token_root', name: 'Root', rarity: 'common', tokenType: 'resource', uses: 5,
                    config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 10000, inputs: [], outputs: [{ itemId: 'item_root', chance: 100, minQty: 1, maxQty: 1 }] },
                    sim: { tempo: 'fast', purpose: 'gph' },
                },
            },
            recipes: ring,
            items: { item_a: { id: 'item_a' }, item_b: { id: 'item_b' }, item_c: { id: 'item_c' }, item_root: { id: 'item_root' } },
        });

        expect(Date.now() - start).toBeLessThan(2000);
        expect(result.values.get('item_root')).toBeGreaterThan(0);
        expect(result.rows.filter(r => r.code === 'recipe-cycle')).toHaveLength(1);
        expect(result.values.has('item_a')).toBe(false);
    });

    it('rows come back sorted, criticals first', () => {
        const result = runSim(corpus());
        const order = { critical: 0, warning: 1, info: 2 };
        for (let i = 1; i < result.rows.length; i++) {
            expect(order[result.rows[i - 1].severity]).toBeLessThanOrEqual(order[result.rows[i].severity]);
        }
    });

    it('honours the shipped Charcoal anchor flag over the level-1 Mythic Campfire', () => {
        // The one shipped case where the override flag does real work: the
        // Campfire is level 1 (so it would win the rule) but mythic; the flag
        // on recipe_charcoal's output overrides.
        const result = runSim(corpus());
        expect(result.elections.get('item_charcoal').sourceId).toBe('recipe_charcoal');
        expect(result.elections.get('item_charcoal').reason).toBe('explicit anchor flag');
    });
});
