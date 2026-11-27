import { describe, it, expect } from 'vitest';

import { applyTokenResults, applyRecipePoolResults } from '../../cms/src/engine/sim/writeBack.js';
import { adaptToken } from '../../cms/src/engine/sim/fieldAdapter.js';

/**
 * An output's chance goes back to what the author wrote (`baseChance`) when no lever moves it, as
 * its counts go back to `baseQty`: the simulator prices `baseChance`, so a chance an old tuning
 * left in data would be rolled by the game and priced by nobody. A lever that moves the chance
 * writes the lever's value; an output with no `baseChance` keeps its chance; a pinned output
 * keeps the chance it was written with, which is the one the adapter prices for it.
 */

const TAGS = { tempo: 'quick', purpose: 'iph' };
const out = (itemId, chance, extra = {}) => ({ itemId, chance, minQty: 1, maxQty: 1, baseQty: { min: 1, max: 1 }, variable: chance < 100, ...extra });
const token = (id, outputs, sim = TAGS) => ({ id, name: id, sim, config: { skill: 'farming', cycleTimeMs: 3000, outputs } });
const recipe = (id, outputs, sim = TAGS) => ({ id, name: id, skill: 'cooking', sim, durationMs: 3000, outputs });

/** A sim result in which the chance lever moved `moved`'s first output from 30 to 18, and nothing else. */
const sim = (moved) => ({
    cycleTimes: new Map(), xp: new Map(), downcycles: new Map(),
    tunings: new Map([[moved, {
        lever: 'chance',
        before: { outputs: [{ minQty: 1, maxQty: 1, chancePercent: 30 }] },
        after: { outputs: [{ minQty: 1, maxQty: 1, chancePercent: 18 }] },
    }]]),
});

describe('an output chance on the way out of Recalculate', () => {
    it('returns to its baseChance when no lever moves it', () => {
        const tokens = { t: token('t', [out('seed', 10, { baseChance: 30 })]) };
        expect(applyTokenResults(tokens, sim('other')).t.config.outputs[0]).toEqual(out('seed', 30, { baseChance: 30 }));
        const pools = { cooking: [recipe('r', [out('seed', 10, { baseChance: 30 })])] };
        expect(applyRecipePoolResults(pools, sim('other')).cooking[0].outputs[0].chance).toBe(30);
    });

    it('writes the lever value when a lever moves it', () => {
        const tokens = { t: token('t', [out('seed', 10, { baseChance: 30 })]) };
        expect(applyTokenResults(tokens, sim('t')).t.config.outputs[0]).toEqual(out('seed', 18, { baseChance: 30 }));
        const pools = { cooking: [recipe('r', [out('seed', 10, { baseChance: 30 })])] };
        expect(applyRecipePoolResults(pools, sim('r')).cooking[0].outputs[0].chance).toBe(18);
    });

    it('keeps its chance when no baseChance is authored', () => {
        const tokens = { t: token('t', [out('seed', 10)]) };
        const written = applyTokenResults(tokens, sim('other')).t.config.outputs[0];
        expect(written).toEqual(out('seed', 10));
        expect(written).toBe(tokens.t.config.outputs[0]);
    });

    it('keeps a pinned output at its written chance, the one the adapter prices', () => {
        const pinned = { ...TAGS, outputsPinned: true };
        const tokens = { t: token('t', [out('seed', 10, { baseChance: 30 })], pinned) };
        expect(applyTokenResults(tokens, sim('t')).t.config.outputs[0].chance).toBe(10);
        expect(adaptToken({ ...tokens.t, config: { ...tokens.t.config, skillRequired: 1 } }).outputs[0].chancePercent).toBe(10);
    });

    it('writes the chance the simulator priced, so the game rolls what was priced', () => {
        const t = token('t', [out('seed', 10, { baseChance: 30 })]);
        const priced = adaptToken({ ...t, config: { ...t.config, skillRequired: 1 } }).outputs[0].chancePercent;
        expect(applyTokenResults({ t }, sim('other')).t.config.outputs[0].chance).toBe(priced);
    });
});
