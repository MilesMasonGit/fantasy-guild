import { describe, it, expect } from 'vitest';
import {
    seedSimIntent, seedTokens, seedRecipePools,
} from '../../cms/src/stores/simIntentNormaliser';

/**
 * The CMS's simulator-intent normaliser, tested from the game's suite.
 *
 * The CMS has no test runner of its own (finding S13, accepted at CR2-006), and
 * the precedent for testing CMS code is `CMSBalanceEngine.test.js`, which
 * imports across the project boundary and runs here. This follows it.
 *
 * What matters about this normaliser is not that it computes anything clever —
 * it copies two numbers — but that it is **safe to run on every load**, because
 * it runs on every load. Two load paths reach it, as alternatives rather than
 * in sequence: the entity store's persist `merge` (a browser rehydrate) and
 * `hydrate()` (a workspace import, which bypasses persist entirely).
 *
 * ⚠️ **`merge`, not `migrate`.** zustand only calls `migrate` when the stored
 * blob carries a numeric `version`, and every workspace persisted before P2 has
 * none — so a normaliser hung on `migrate` would skip every real workspace.
 * Idempotence is the whole contract.
 */

const output = (patch = {}) => ({ itemId: 'item_x', chance: 100, minQty: 1, maxQty: 1, ...patch });

const workspace = (outputs) => ({
    tokens: {
        token_a: { id: 'token_a', config: { cycleTimeMs: 12000, outputs } },
    },
    recipePools: {
        smithing: [{ id: 'rec_a', name: 'A', outputs }],
    },
});

const tokenOutputs = (s) => s.tokens.token_a.config.outputs;
const recipeOutputs = (s) => s.recipePools.smithing[0].outputs;

describe('seeding an output\'s authored intent', () => {
    it('copies minQty/maxQty into baseQty, unchanged', () => {
        const seeded = seedSimIntent(workspace([output({ minQty: 2, maxQty: 5 })]));
        expect(tokenOutputs(seeded)[0].baseQty).toEqual({ min: 2, max: 5 });
        // Preservation, not calibration: the derived numbers are untouched.
        expect(tokenOutputs(seeded)[0].minQty).toBe(2);
        expect(tokenOutputs(seeded)[0].maxQty).toBe(5);
    });

    it('marks chance 100 as not variable and chance 25 as variable', () => {
        const seeded = seedSimIntent(workspace([
            output({ chance: 100 }),
            output({ chance: 25 }),
        ]));
        expect(tokenOutputs(seeded)[0].variable).toBe(false);
        expect(tokenOutputs(seeded)[1].variable).toBe(true);
    });

    it('treats a missing chance as always, the way the game reads it', () => {
        const entry = output();
        delete entry.chance;
        const seeded = seedSimIntent(workspace([entry]));
        expect(tokenOutputs(seeded)[0].variable).toBe(false);
    });

    it('never invents an anchor', () => {
        // There is no authored number that implies which output prices its item,
        // and a guess here would put a wrong price on a real item.
        const seeded = seedSimIntent(workspace([output({ minQty: 3, maxQty: 3 })]));
        expect(tokenOutputs(seeded)[0].anchor).toBeUndefined();
    });

    it('reaches pooled recipes as well as Tokens', () => {
        const seeded = seedSimIntent(workspace([output({ minQty: 4, maxQty: 9, chance: 50 })]));
        expect(recipeOutputs(seeded)[0].baseQty).toEqual({ min: 4, max: 9 });
        expect(recipeOutputs(seeded)[0].variable).toBe(true);
    });
});

describe('idempotence — this runs on every load, twice over', () => {
    it('changes nothing on a second pass', () => {
        const once = seedSimIntent(workspace([output({ minQty: 2, maxQty: 5, chance: 30 })]));
        const twice = seedSimIntent(once);
        expect(twice).toEqual(once);
        // Not merely equal: an unchanged workspace comes back as the same
        // object, so a reload cannot trigger a pointless re-render or a write.
        expect(twice).toBe(once);
    });

    it('leaves an output that already has a baseQty completely alone', () => {
        const authored = output({
            minQty: 1, maxQty: 1, chance: 100,
            baseQty: { min: 7, max: 7 },
            variable: true,          // deliberately disagrees with chance 100
            anchor: true,
        });
        const seeded = seedSimIntent(workspace([authored]));
        expect(tokenOutputs(seeded)[0]).toBe(authored);
        expect(tokenOutputs(seeded)[0].baseQty).toEqual({ min: 7, max: 7 });
        expect(tokenOutputs(seeded)[0].variable).toBe(true);
        expect(tokenOutputs(seeded)[0].anchor).toBe(true);
    });
});

describe('it survives the shapes a real load path hands it', () => {
    it('passes a stale versionless blob through, seeding what it can', () => {
        // What a browser holds from before P2: no `sim`, no `baseQty`, and a
        // Token with no config at all (23 of 39 shipped Tokens are like this).
        const stale = {
            items: { item_x: { id: 'item_x' } },
            tokens: {
                token_inert: { id: 'token_inert', config: null },
                token_run: { id: 'token_run', config: { outputs: [output({ minQty: 3, maxQty: 3 })] } },
            },
            maps: {},
            recipePools: {},
        };
        const seeded = seedSimIntent(stale);
        expect(seeded.tokens.token_inert.config).toBeNull();
        expect(seeded.tokens.token_run.config.outputs[0].baseQty).toEqual({ min: 3, max: 3 });
        expect(seeded.items).toBe(stale.items);
        expect(seeded.maps).toBe(stale.maps);
    });

    it('does not fall over on nothing', () => {
        expect(seedSimIntent(undefined)).toBeUndefined();
        expect(seedSimIntent(null)).toBeNull();
        expect(seedSimIntent({})).toEqual({});
        expect(seedTokens(undefined)).toBeUndefined();
        expect(seedRecipePools(undefined)).toBeUndefined();
    });

    it('leaves a Token with no outputs, and an empty pool, untouched', () => {
        const state = { tokens: { t: { config: {} } }, recipePools: { smithing: [] } };
        expect(seedSimIntent(state)).toBe(state);
    });

    it('does not touch inputs', () => {
        const state = {
            tokens: { t: { config: { inputs: [{ itemId: 'item_x', quantity: 2 }], outputs: [] } } },
        };
        expect(seedSimIntent(state).tokens.t.config.inputs[0]).toEqual({ itemId: 'item_x', quantity: 2 });
    });
});
