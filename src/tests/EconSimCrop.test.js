/**
 * Economic simulator — crops. A crop recipe's inputs are its seed, paid once per sowing, and a ripe
 * Field is harvested `crop.load` times before it sows again (`src/systems/board/Fields.js`). So the
 * simulator charges each harvest cycle the seed divided by the load; the outputs are per harvest as
 * authored, the cycle is the harvest cycle (`durationMs`), and `crop.growMs` takes no part in value.
 * Recalculate writes nothing onto a crop's sowing terms (its `crop` block, its inputs).
 *
 * Fixtures only: nothing here reads `data/`.
 */

import { describe, it, expect } from 'vitest';

import { adaptCorpus } from '../../cms/src/engine/sim/fieldAdapter.js';
import { runSim } from '../../cms/src/engine/sim/simRunner.js';
import { applyRecipePoolResults } from '../../cms/src/engine/sim/writeBack.js';

const out = (itemId, over = {}) => ({ itemId, chance: 100, minQty: 1, maxQty: 1, ...over });

/** A seed source: a level-1 Token that gathers seeds, so the seed has a value. */
const seedBag = {
    id: 'cx_seed_bag', name: 'cx_seed_bag', rarity: 'common', tokenType: 'resource', uses: 10,
    config: { skill: 'foraging', skillRequired: 1, cycleTimeMs: 10000, inputs: [], outputs: [out('cx_seed')] },
    sim: { tempo: 'medium', purpose: 'gph' },
};

const recipe = (id, { inputs = [{ itemId: 'cx_seed', quantity: 2 }], crop, skill = 'farming', recipeStationKinds } = {}) => {
    const r = {
        id, name: id, skill, levelRequirement: 1, durationMs: 10000,
        inputs, outputs: [out('cx_wheat', { minQty: 2, maxQty: 2 })],
        sim: { tempo: 'medium', purpose: 'gph' },
    };
    if (crop) r.crop = crop;
    if (recipeStationKinds) r.stationKinds = recipeStationKinds;
    return r;
};

/** A Field: a Farming station of kind Field with a `field` block. Its recipes are the crops. */
const field = (id = 'cx_field', { kind = 'field' } = {}) => ({
    id, name: id, rarity: 'common', tokenType: 'station',
    statements: [{ id: `stm_${id}`, keyword: 'station', payload: { skill: 'farming', stationKind: kind } }],
    field: {},
});

const ITEMS = Object.fromEntries(['cx_seed', 'cx_wheat'].map(id => [id, { id }]));
const recipeOf = (entities, id) => entities.find(e => e.id === id);
const seedLine = (entity) => entity.inputs.map(i => [i.itemId, i.quantity]);

describe('EconSim — a crop charges its seed once per sowing', () => {
    it('a recipe with a crop block charges each harvest the seed divided by the load', () => {
        const entities = adaptCorpus({ recipes: { wheat: recipe('cx_wheat_crop', { crop: { growMs: 600000, load: 4 } }) } });
        expect(seedLine(recipeOf(entities, 'cx_wheat_crop'))).toEqual([['cx_seed', 0.5]]);
    });

    it('a recipe a Field offers is a crop even with no crop block: the default load of ten', () => {
        const entities = adaptCorpus({
            tokens: { field: field() },
            recipes: { wheat: recipe('cx_wheat_crop') },
        });
        expect(seedLine(recipeOf(entities, 'cx_wheat_crop'))).toEqual([['cx_seed', 0.2]]);
    });

    it('a recipe no Field offers and with no crop block is charged its inputs every cycle', () => {
        const entities = adaptCorpus({
            tokens: { field: field() },
            recipes: { mill: recipe('cx_mill', { skill: 'cooking' }) },
        });
        expect(seedLine(recipeOf(entities, 'cx_mill'))).toEqual([['cx_seed', 2]]);
    });

    it('a Farming recipe the Field\'s kind does not offer is not a crop', () => {
        const entities = adaptCorpus({
            tokens: { field: field() },
            recipes: { mill: recipe('cx_mill', { recipeStationKinds: ['windmill'] }) },
        });
        expect(seedLine(recipeOf(entities, 'cx_mill'))).toEqual([['cx_seed', 2]]);
    });

    it('the seed is charged as the game pays it: whole seeds, summed by item', () => {
        const inputs = [{ itemId: 'cx_seed', quantity: 1 }, { itemId: 'cx_seed', quantity: 3 }];
        const entities = adaptCorpus({ recipes: { wheat: recipe('cx_wheat_crop', { inputs, crop: { load: 8 } }) } });
        expect(seedLine(recipeOf(entities, 'cx_wheat_crop'))).toEqual([['cx_seed', 0.5]]);
    });

    it('a crop is priced as a recipe paying seed ÷ load each cycle, so it is cheaper than one paying the whole seed', () => {
        const crop = runSim({ tokens: { bag: seedBag }, recipes: { w: recipe('cx_wheat_crop', { crop: { load: 4 } }) }, items: ITEMS });
        const perCycleEquivalent = runSim({
            tokens: { bag: seedBag },
            recipes: { w: recipe('cx_wheat_crop', { inputs: [{ itemId: 'cx_seed', quantity: 0.5 }] }) },
            items: ITEMS,
        });
        const wholeSeedEveryCycle = runSim({ tokens: { bag: seedBag }, recipes: { w: recipe('cx_wheat_crop') }, items: ITEMS });

        expect(crop.values.get('cx_seed')).toBeGreaterThan(0);
        expect(crop.values.get('cx_wheat')).toBe(perCycleEquivalent.values.get('cx_wheat'));
        expect(crop.values.get('cx_wheat')).toBeLessThan(wholeSeedEveryCycle.values.get('cx_wheat'));
    });

    it('growMs takes no part: two crops differing only in grow time price and time alike', () => {
        const run = (growMs) => runSim({ tokens: { bag: seedBag }, recipes: { w: recipe('cx_wheat_crop', { crop: { growMs, load: 4 } }) }, items: ITEMS });
        const quick = run(60000);
        const slow = run(6 * 3600000);
        expect(slow.values.get('cx_wheat')).toBe(quick.values.get('cx_wheat'));
        expect(slow.cycleTimes.get('cx_wheat_crop')).toBe(quick.cycleTimes.get('cx_wheat_crop'));
        expect(slow.xp.get('cx_wheat_crop')).toBe(quick.xp.get('cx_wheat_crop'));
    });

    it('Recalculate writes nothing onto how the game sows: the crop block and inputs are kept as authored', () => {
        const authored = recipe('cx_wheat_crop', { crop: { growMs: 600000, load: 4, ripeSprite: 'wheat_ripe' } });
        const snapshot = JSON.parse(JSON.stringify(authored));
        const pools = { farming: [authored] };
        const sim = runSim({ tokens: { bag: seedBag, field: field() }, recipes: { w: authored }, items: ITEMS });
        const [written] = applyRecipePoolResults(pools, sim).farming;
        expect(written.crop).toEqual(snapshot.crop);
        expect(written.inputs).toEqual(snapshot.inputs);
        expect(authored).toEqual(snapshot);
    });
});
