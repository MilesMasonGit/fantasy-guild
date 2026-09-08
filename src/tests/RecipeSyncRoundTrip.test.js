import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { recipesToFile, syncFiles } from '../../cms/src/engine/recipeSync.js';
import { runSim } from '../../cms/src/engine/sim/simRunner.js';
import {
    migrateLegacyIntent,
    applyRecipePoolResults,
    RETIRED_RECIPE_FIELDS,
    RETIRED_OUTPUT_FIELDS,
} from '../../cms/src/engine/sim/writeBack.js';

/**
 * The CMS → game recipe sync.
 *
 * ## What this test is for now
 *
 * It began as a round trip that pinned the **nine EV fields** through a sync
 * that deliberately routed recipes *around* the economy pass, because the
 * solver of the day rewrote them. Both halves of that are gone: the EV fields
 * are deleted, and the bypass with them (plan §16). So the suite keeps the
 * round trip and changes what it is a round trip *of*:
 *
 * 1. **Authored intent survives byte-for-byte.** The CMS's known failure mode
 *    is that sync drops whatever the writer does not name, and a recipe still
 *    carries fields with no editor behind them.
 * 2. **Derived fields match a fresh solve.** The file is not a place numbers go
 *    to drift; re-solving the shipped corpus must reproduce it.
 * 3. **⚠️ Retired fields injected into the store do not reach the file.** This
 *    is the strip-on-write pin, and it is the one that matters most: a browser
 *    workspace saved before the cutover still holds those fields, and sync
 *    writes from the store.
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

/** Re-solve a pool set exactly the way `recalculateEconomy` does. */
function solve(recipePools, { items = {}, tokens = {} } = {}) {
    const migrated = migrateLegacyIntent({ tokens, recipePools });
    const recipes = {};
    for (const [skillId, pool] of Object.entries(migrated.recipePools)) {
        pool.forEach((r, i) => {
            const id = r.id || `pooled_${skillId}_${i}`;
            recipes[id] = { ...r, id, skill: r.skill || skillId };
        });
    }
    const sim = runSim({ items, tokens: migrated.tokens, recipes });
    return applyRecipePoolResults(migrated.recipePools, sim);
}

describe('Recipe sync round trip', () => {
    it('writes the shipped file back byte-identical', () => {
        const written = JSON.stringify(recipesToFile(poolsFromFile(shipped)), null, 2);
        expect(written).toBe(raw);
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
            sim: { tempo: 'medium', purpose: 'iph' },
            downcycle: false,
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
        const files = syncFiles({
            items: { a: 1 },
            tokens: { b: 2 },
            maps: { c: 3 },
            recipePools: poolsFromFile(shipped),
        });
        expect(Object.keys(files)).toEqual([
            // `effects.json` joined the payload in Unified Effects P1. It is not
            // optional: `tokens.json` now holds references into it, so a sync
            // that wrote one without the other would leave every Token's rules
            // pointing at nothing.
            'items.json', 'tokens.json', 'maps.json', 'tokenRecipes.json', 'effects.json',
        ]);
        expect(files['tokenRecipes.json'].map(r => r.id)).toEqual(shipped.map(r => r.id));
    });
});

describe('⚠️ Retired fields cannot get back into the file (strip-on-write)', () => {
    /**
     * A workspace as a browser that predates the cutover still holds it: every
     * recipe carrying the nine EV fields and the legacy `isPrimarySource` flag.
     */
    function stalePools() {
        const pools = poolsFromFile(JSON.parse(raw));
        for (const pool of Object.values(pools)) {
            for (let i = 0; i < pool.length; i++) {
                pool[i] = {
                    ...pool[i],
                    targetEV: 1.05,
                    calculatedEV: 4.2,
                    autoBalance: true,
                    fieldLocks: { quantity: false, xpAwarded: false },
                    profitSplit: { item: 0.8, xp: 0.2 },
                    liquidityEV: 0.5,
                    progressionEV: 0.5,
                    goldPerMinute: -35.64,
                    xpPerMinute: 48,
                    outputs: pool[i].outputs.map(o => ({ ...o, isPrimarySource: true })),
                };
            }
        }
        return pools;
    }

    it('strips every EV field a stale workspace carries', () => {
        const written = recipesToFile(solve(stalePools()));
        expect(written).toHaveLength(shipped.length);
        for (const recipe of written) {
            for (const field of RETIRED_RECIPE_FIELDS) {
                expect(field in recipe, `${recipe.id} kept ${field}`).toBe(false);
            }
        }
    });

    it('strips the legacy anchor flag, keeping what it meant', () => {
        const written = recipesToFile(solve(stalePools()));
        for (const recipe of written) {
            for (const output of recipe.outputs) {
                for (const field of RETIRED_OUTPUT_FIELDS) {
                    expect(field in output, `${recipe.id} kept ${field}`).toBe(false);
                }
                // `isPrimarySource: true` was the old way of saying "anchor".
                expect(output.anchor).toBe(true);
            }
        }
    });

    it('⚠️ stays stripped on a SECOND pass — the fields do not come back', () => {
        const once = solve(stalePools());
        const twice = solve(once);
        expect(JSON.stringify(recipesToFile(twice)))
            .toBe(JSON.stringify(recipesToFile(once)));
        for (const recipe of recipesToFile(twice)) {
            for (const field of RETIRED_RECIPE_FIELDS) {
                expect(field in recipe).toBe(false);
            }
        }
    });
});

describe('Derived recipe fields match a fresh solve (the drift alarm)', () => {
    it('reproduces the shipped file from the shipped intent', () => {
        const written = recipesToFile(solve(poolsFromFile(shipped)));
        expect(JSON.stringify(written, null, 2)).toBe(raw);
    });
});
