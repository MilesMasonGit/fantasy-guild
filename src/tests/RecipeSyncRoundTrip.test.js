import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { recipesToFile, syncFiles } from '../../cms/src/engine/recipeSync.js';

/**
 * The CMS → game recipe sync (Recipe & Charges rework, P6a).
 *
 * `syncToGame` wrote three files and never wrote recipes at all. Adding a
 * fourth file to a sync that replaces whole files is the dangerous half of the
 * job: the CMS drops any field it does not itself model, and a recipe carries
 * several with no editor behind them, plus nine EV fields that belong to a
 * different rework and must arrive unchanged (R-6, R-11).
 *
 * So the acceptance test is a round trip on the shipped corpus: load
 * `data/tokenRecipes.json` into the CMS's pool shape, write it back out, and
 * require the bytes to match. Anything the sync silently drops or rewrites
 * fails here.
 */

const FILE = path.resolve(__dirname, '../../data/tokenRecipes.json');
/**
 * Line endings are normalised because git materialises this file with CRLF on a
 * Windows checkout while `JSON.stringify` always emits LF — without this the
 * byte-identical assertion below fails on a fresh clone, which it did the first
 * time this suite ran on `main`. What the test is guarding is that no *field* is
 * dropped, reordered or rewritten; the separator git chose is not part of that.
 */
const raw = fs.readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n');
const shipped = JSON.parse(raw);

/** The nine fields R-6 and R-11 place off limits. */
const EV_FIELDS = [
    'targetEV', 'calculatedEV', 'autoBalance', 'fieldLocks', 'profitSplit',
    'liquidityEV', 'progressionEV', 'goldPerMinute', 'xpPerMinute',
];

/**
 * Group the flat file into the CMS's skill-keyed pools — the shape
 * `useEntityStore.hydrate` takes and `recipesToFile` reads.
 *
 * The CMS has no game → CMS import path (CMS-4 removed it deliberately), so
 * this direction exists to state the round trip, not as production code.
 */
function poolsFromFile(list) {
    const pools = {};
    for (const recipe of list) {
        (pools[recipe.skill] ||= []).push(recipe);
    }
    return pools;
}

describe('Recipe sync round trip — P6a', () => {
    it('writes the shipped file back byte-identical', () => {
        const written = JSON.stringify(recipesToFile(poolsFromFile(shipped)), null, 2);
        expect(written).toBe(raw);
    });

    it('carries every EV / auto-balance field through untouched', () => {
        const written = recipesToFile(poolsFromFile(shipped));
        for (const before of shipped) {
            const after = written.find(r => r.id === before.id);
            expect(after, `${before.id} was dropped by the sync`).toBeTruthy();
            for (const field of EV_FIELDS) {
                expect(field in after, `${before.id} lost ${field}`).toBe(field in before);
                expect(after[field], `${before.id} had ${field} rewritten`).toEqual(before[field]);
            }
        }
    });

    it('carries fields the CMS has no editor for, including a Token output', () => {
        // None of the three shipped recipes declares `requiresContext` or a
        // Token output since the P2.6 prune, so the corpus alone cannot prove
        // those survive. This fixture is the only place they are exercised.
        const unmodelled = {
            id: 'recipe_fixture',
            name: 'Fixture',
            skill: 'crafting',
            levelRequirement: 2,
            durationMs: 7000,
            xp: 3,
            inputs: [{ itemId: 'item_clay', quantity: 1 }],
            requiresContext: [{ tag: 'kiln', minTier: 2, chargeCost: 3 }],
            stationChargeCost: 4,
            outputs: [{ tokenId: 'token_pot', chance: 100, minQty: 1, maxQty: 1 }],
            targetEV: 1.05,
            fieldLocks: { quantity: true, xpAwarded: false },
            profitSplit: { item: 0.8, xp: 0.2 },
        };

        const [written] = recipesToFile({ crafting: [unmodelled] });
        expect(written).toEqual(unmodelled);
        expect(JSON.stringify(written)).toBe(JSON.stringify(unmodelled));
    });

    it('stamps the pool key onto a recipe with no skill of its own', () => {
        const [written] = recipesToFile({ cooking: [{ id: 'recipe_old', name: 'Old' }] });
        expect(written.skill).toBe('cooking');
    });

    it('puts recipes in the sync payload alongside the other three files', () => {
        const files = syncFiles(
            { items: { a: 1 }, tokens: { b: 2 }, maps: { c: 3 } },
            poolsFromFile(shipped)
        );
        expect(Object.keys(files)).toEqual([
            'items.json', 'tokens.json', 'maps.json', 'tokenRecipes.json',
        ]);
        expect(files['tokenRecipes.json'].map(r => r.id)).toEqual(shipped.map(r => r.id));
    });
});
