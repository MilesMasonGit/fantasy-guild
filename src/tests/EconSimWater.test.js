/**
 * Economic simulator — water. A water Token (one with catch pools) lands one catch a cycle from a
 * pool in place of its Outputs, so the simulator prices it from its pools that bite (each fish's
 * share as its chance, the Bait they spend as an input), and Recalculate never writes Outputs onto it.
 *
 * Fixtures only: nothing here reads `data/`.
 */

import { describe, it, expect } from 'vitest';

import { adaptCorpus } from '../../cms/src/engine/sim/fieldAdapter.js';
import { runSim } from '../../cms/src/engine/sim/simRunner.js';
import { applyTokenResults } from '../../cms/src/engine/sim/writeBack.js';

const out = (itemId, over = {}) => ({ itemId, chance: 100, minQty: 1, maxQty: 1, ...over });

const token = (id, { level = 1, tempo = 'medium', purpose = 'gph', outputs = [out('item_x')] } = {}) => ({
    id, name: id, rarity: 'common', tokenType: 'resource', uses: 10,
    config: { skill: 'fishing', skillRequired: level, cycleTimeMs: 10000, inputs: [], outputs },
    sim: { tempo, purpose },
});

const pool = (tool, bait, catches) => ({ tool, bait, catches: catches.map(([itemId, weight]) => ({ itemId, weight })) });

/** A lake: a rod spending worms (60 / 30 / 10). No Outputs of its own. */
const water = (id, { level = 1, tempo = 'medium', purpose = 'gph', pools, outputs } = {}) => {
    const def = {
        id, name: id, rarity: 'common', tokenType: 'resource',
        config: { skill: 'fishing', skillRequired: level, cycleTimeMs: 10000, inputs: [] },
        catchPools: pools || [
            pool('fishing_rod', 'fx_worm', [['fx_trout', 60], ['fx_salmon', 30], ['fx_shark', 10]]),
        ],
        sim: { tempo, purpose },
    };
    if (outputs) def.config.outputs = outputs;
    return def;
};

const items = (...ids) => Object.fromEntries(ids.map(id => [id, { id }]));
const FISH = items('fx_trout', 'fx_salmon', 'fx_shark', 'fx_eel', 'fx_worm');
/** Where the worms come from, so the Bait has a price. */
const WORM_BED = token('fx_worm_bed', { outputs: [out('fx_worm')] });
const orphanRows = (sim) => sim.rows.filter(r => r.code === 'orphan-item').map(r => r.itemId).sort();

describe('EconSim — a water Token is priced from its pools that bite, Bait and all', () => {
    it('a fish caught only from a pool is priced, not an orphan', () => {
        const sim = runSim({ tokens: { bed: WORM_BED, lake: water('fx_lake') }, items: FISH });
        for (const fish of ['fx_trout', 'fx_salmon', 'fx_shark']) {
            expect(sim.values.get(fish), fish).toBeGreaterThan(0);
            expect(sim.elections.get(fish)?.sourceId, fish).toBe('fx_lake');
        }
        expect(orphanRows(sim)).not.toContain('fx_trout');
    });

    it('each fish is one catch a cycle at its share: the rare one is worth more', () => {
        const [lake] = adaptCorpus({ tokens: { lake: water('fx_lake') } });
        expect(lake.outputs.map(o => [o.itemId, o.chance, o.avgQty])).toEqual([
            ['fx_trout', 0.6, 1], ['fx_salmon', 0.3, 1], ['fx_shark', 0.1, 1],
        ]);
        const sim = runSim({ tokens: { bed: WORM_BED, lake: water('fx_lake') }, items: FISH });
        expect(sim.values.get('fx_shark')).toBeGreaterThan(sim.values.get('fx_salmon'));
        expect(sim.values.get('fx_salmon')).toBeGreaterThan(sim.values.get('fx_trout'));
    });

    it("a fish's price includes its Bait: the same lake with dearer worms prices its fish higher", () => {
        const cheap = runSim({ tokens: { bed: WORM_BED, lake: water('fx_lake') }, items: FISH });
        const dear = { ...FISH, fx_trout: { id: 'fx_trout', fish: { bait: 5 } }, fx_salmon: { id: 'fx_salmon', fish: { bait: 5 } }, fx_shark: { id: 'fx_shark', fish: { bait: 5 } } };
        const [adapted] = adaptCorpus({ tokens: { lake: water('fx_lake') }, items: dear });
        expect(adapted.inputs).toEqual([{ itemId: 'fx_worm', quantity: 5 }]);
        const sim = runSim({ tokens: { bed: WORM_BED, lake: water('fx_lake') }, items: dear });
        expect(sim.values.get('fx_shark')).toBeGreaterThan(cheap.values.get('fx_shark'));
    });

    it("a rod pool naming no Bait never bites and is not counted, and the Token's own Outputs are ignored", () => {
        const lake = water('fx_lake', { outputs: [out('fx_old_shrimp')], pools: [
            pool('fishing_rod', 'fx_worm', [['fx_trout', 60], ['fx_salmon', 30], ['fx_shark', 10]]),
            pool('fishing_rod', null, [['fx_eel', 1]]),
        ] });
        const [adapted] = adaptCorpus({ tokens: { lake } });
        expect(adapted.outputs.map(o => o.itemId)).toEqual(['fx_trout', 'fx_salmon', 'fx_shark']);
        const sim = runSim({ tokens: { bed: WORM_BED, lake }, items: { ...FISH, ...items('fx_old_shrimp') } });
        expect(orphanRows(sim)).toEqual(['fx_eel', 'fx_old_shrimp']);
    });

    it('several pools that bite (a rod and a free Trap) still make one catch a cycle, shared evenly', () => {
        const pools = [
            pool('fishing_rod', 'fx_worm', [['fx_trout', 1], ['fx_salmon', 1]]),
            pool('fishing_trap', null, [['fx_trout', 1]]),
        ];
        const [adapted] = adaptCorpus({ tokens: { lake: water('fx_lake', { pools }) } });
        expect(adapted.outputs.map(o => [o.itemId, o.chance])).toEqual([['fx_trout', 0.75], ['fx_salmon', 0.25]]);
        expect(adapted.outputs.reduce((s, o) => s + o.abundance, 0)).toBeCloseTo(1, 10);
        // Half the catches spend a worm.
        expect(adapted.inputs).toEqual([{ itemId: 'fx_worm', quantity: 0.5 }]);
    });

    it('water whose only pool never bites produces nothing to price from', () => {
        const pools = [pool('fishing_rod', null, [['fx_eel', 1]])];
        const [adapted] = adaptCorpus({ tokens: { sea: water('fx_sea', { pools }) } });
        expect(adapted.outputs).toEqual([]);
    });
});

describe('EconSim — Recalculate never writes Outputs onto a water Token', () => {
    it('a water with no Outputs gets none, even when the lever policy tunes it', () => {
        const tokens = {
            anchor: token('fx_a_pond', { outputs: [out('fx_trout')] }),
            lake: water('fx_lake', { level: 40, purpose: 'iph', pools: [pool('fishing_trap', null, [['fx_trout', 1]])] }),
        };
        const sim = runSim({ tokens, items: FISH });
        expect(sim.tunings.get('fx_lake')?.lever).toBe('quantity');
        const written = applyTokenResults(tokens, sim);
        expect('outputs' in written.lake.config).toBe(false);
        expect(written.anchor.config.outputs).toBeDefined();
    });

    it('a water\'s authored Outputs are kept exactly as typed', () => {
        // Out of step with its intent: a write-back of a Token that is not water would re-derive it.
        const authored = [out('fx_old_shrimp', { baseQty: { min: 2, max: 3 } })];
        const tokens = { lake: water('fx_lake', { outputs: authored }) };
        const sim = runSim({ tokens, items: { ...FISH, ...items('fx_old_shrimp') } });
        const written = applyTokenResults(tokens, sim);
        expect(written.lake.config.outputs).toBe(authored);
        expect(written.lake.catchPools).toBe(tokens.lake.catchPools);
    });
});
