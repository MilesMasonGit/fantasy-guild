import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { RETIRED_TOKEN_FIELDS } from '../../cms/src/engine/sim/writeBack';

/**
 * A browser workspace saved before the **recipe & charges rework** heals on its
 * first Recalculate.
 *
 * ## Why this needed its own file
 *
 * `CMSEconomyCutover` already proves a workspace from before the *economic
 * simulator* heals. This is the generation before that one, and the two retire
 * different fields: that rework dropped `trueCost`/`sellPrice` and the nine EV
 * fields; this one dropped a Token's top-level `xp`, its `charges` and its
 * `recipePool`, and gave recipes a real `id`.
 *
 * `data/` was cleaned of all of those in `0b6f258`, but nothing taught the
 * write-back to strip them — so the next Sync from any pre-rework browser put
 * them back, and the content-rule tests went red against a corpus nobody had
 * edited.
 *
 * The fields are only half of it. An id-less recipe was flattened under a
 * synthetic `pooled_<skill>_<index>` key, so every derived result was filed
 * under a name the pool entry did not carry, and the write-back — which looks
 * results up by `recipe.id` — wrote none of them back at all.
 *
 * Fixtures only, no shipped ids: these assert the rule, not the corpus.
 */

/** A workspace as a browser that predates the recipe & charges rework holds it. */
function preReworkWorkspace() {
    return {
        items: {
            item_ore: { id: 'item_ore', name: 'Ore', type: 'material', value: null },
            item_ingot: { id: 'item_ingot', name: 'Ingot', type: 'material', value: null },
        },
        tokens: {
            token_seam: {
                id: 'token_seam', name: 'Seam', tokenType: 'resource', rarity: 'common',
                uses: 100, requiresHero: true, statements: [],
                // The three retired fields, in the shapes they are found in.
                xp: 10,
                charges: 500,
                recipePool: 'mining',
                sim: { tempo: 'medium', purpose: 'iph' },
                config: {
                    skill: 'mining', skillRequired: 1, cycleTimeMs: 12000, xp: 4,
                    inputs: [],
                    outputs: [{
                        itemId: 'item_ore', chance: 100, minQty: 1, maxQty: 2,
                        baseQty: { min: 1, max: 2 }, variable: false,
                    }],
                },
            },
            // `recipePool` nested inside config rather than at the top level.
            token_kiln: {
                id: 'token_kiln', name: 'Kiln', tokenType: 'station', rarity: 'common',
                uses: 1000, requiresHero: true, charges: 500,
                statements: [{ id: 's1', keyword: 'station', payload: { skill: 'smithing' } }],
                config: {
                    skill: 'smithing', skillRequired: 1, cycleTimeMs: 12000, xp: 0,
                    recipePool: 'smithing', inputs: [], outputs: [],
                },
            },
        },
        maps: {},
        recipePools: {
            smithing: [{
                // No id, no durationMs, no levelRequirement — the old shape.
                name: 'Bronze Ingot', skill: 'smithing', cycleTimeMs: 16000, xp: 25,
                requiresContext: [],
                inputs: [{ itemId: 'item_ore', quantity: 2 }],
                outputs: [{
                    itemId: 'item_ingot', chance: 100, minQty: 1, maxQty: 1,
                    baseQty: { min: 1, max: 1 }, variable: false,
                }],
                sim: { tempo: 'medium', purpose: 'gph' },
            }],
        },
    };
}

const load = (w) => useEntityStore.setState({ ...w, activeEntityId: null, activeEntityType: null });
const recipeOf = (result) => result.recipePools.smithing[0];

describe('A pre-rework workspace heals on its first Recalculate', () => {
    beforeEach(() => load(preReworkWorkspace()));
    afterEach(() => useSimulationStore.getState().clearResults());

    it('does not crash', () => {
        expect(() => useEntityStore.getState().recalculateEconomy()).not.toThrow();
    });

    it('strips every retired field from every Token', () => {
        const { tokens } = useEntityStore.getState().recalculateEconomy();
        for (const [id, token] of Object.entries(tokens)) {
            for (const field of RETIRED_TOKEN_FIELDS) {
                expect(field in token, `${id} kept top-level ${field}`).toBe(false);
            }
            expect('recipePool' in (token.config || {}), `${id} kept config.recipePool`).toBe(false);
        }
    });

    it('keeps the live charge field and the derived config.xp', () => {
        const { tokens } = useEntityStore.getState().recalculateEconomy();
        // `uses` is authored and is what `liveCharges` reads — it must survive
        // the removal of its retired twin.
        expect(tokens.token_seam.uses).toBe(100);
        expect(tokens.token_kiln.uses).toBe(1000);
        // `config.xp` is derived and live; only the top-level one was dead.
        expect(Number.isFinite(tokens.token_seam.config.xp)).toBe(true);
    });

    it('gives an id-less recipe a readable id derived from its name', () => {
        const recipe = recipeOf(useEntityStore.getState().recalculateEconomy());
        expect(recipe.id).toBe('recipe_bronze_ingot');
    });

    it('renames the legacy cycleTimeMs onto durationMs and gates the level', () => {
        const recipe = recipeOf(useEntityStore.getState().recalculateEconomy());
        expect('cycleTimeMs' in recipe, 'kept the retired cycleTimeMs').toBe(false);
        expect(recipe.durationMs).toBeGreaterThan(0);
        expect(recipe.levelRequirement).toBe(1);
    });

    it('writes the stationChargeCost the runtime was already assuming', () => {
        // `Charges.js` falls back to `DEFAULT_STATION_CHARGE_COST` (1) and
        // `makeRecipe` seeds 1, so this changes no behaviour — it only stops
        // the field being absent, which the recipe schema does not allow.
        const recipe = recipeOf(useEntityStore.getState().recalculateEconomy());
        expect(recipe.stationChargeCost).toBe(1);
    });

    it('does not overwrite an authored stationChargeCost', () => {
        const w = preReworkWorkspace();
        w.recipePools.smithing[0].stationChargeCost = 3;
        load(w);
        const recipe = recipeOf(useEntityStore.getState().recalculateEconomy());
        expect(recipe.stationChargeCost).toBe(3);
    });

    it('writes the derived results a synthetic id used to swallow', () => {
        const recipe = recipeOf(useEntityStore.getState().recalculateEconomy());
        // With no id the sim filed everything under `pooled_smithing_0`, the
        // write-back looked up `undefined`, and the recipe came out unchanged.
        expect(Number.isFinite(recipe.durationMs)).toBe(true);
        expect(Number.isFinite(recipe.xp)).toBe(true);
    });

    it('never lets a retired Token field reach the sync payload', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const files = syncFiles(result);

        // Structural, not a substring search: `xp` is a live field on a
        // recipe and on `config`, so only its position makes it retired.
        const written = files['tokens.json'];

        expect(Object.keys(written).length, 'no Tokens in the payload').toBeGreaterThan(0);
        for (const [id, token] of Object.entries(written)) {
            for (const field of RETIRED_TOKEN_FIELDS) {
                expect(field in token, `${id} synced a retired ${field}`).toBe(false);
            }
            expect('recipePool' in (token.config || {}), `${id} synced config.recipePool`).toBe(false);
        }
    });

    it('stays healed through a SECOND run, and the two runs agree', () => {
        const first = useEntityStore.getState().recalculateEconomy();
        const second = useEntityStore.getState().recalculateEconomy();

        for (const token of Object.values(second.tokens)) {
            for (const field of RETIRED_TOKEN_FIELDS) expect(field in token).toBe(false);
        }
        // The generated id must be stable, or every run would rename the recipe.
        expect(recipeOf(second).id).toBe(recipeOf(first).id);
        expect(JSON.stringify(second.recipePools)).toBe(JSON.stringify(first.recipePools));
        expect(JSON.stringify(second.tokens)).toBe(JSON.stringify(first.tokens));
    });
});

describe('An already-current workspace is left alone', () => {
    afterEach(() => useSimulationStore.getState().clearResults());

    it('does not rename a recipe that already has an id', () => {
        const w = preReworkWorkspace();
        w.recipePools.smithing[0].id = 'recipe_authored_by_hand';
        w.recipePools.smithing[0].durationMs = 16000;
        w.recipePools.smithing[0].levelRequirement = 5;
        delete w.recipePools.smithing[0].cycleTimeMs;
        load(w);

        const recipe = recipeOf(useEntityStore.getState().recalculateEconomy());
        expect(recipe.id).toBe('recipe_authored_by_hand');
        expect(recipe.levelRequirement).toBe(5);
    });

    it('gives two same-named id-less recipes distinct ids', () => {
        const w = preReworkWorkspace();
        w.recipePools.cooking = [{
            name: 'Bronze Ingot', skill: 'cooking', cycleTimeMs: 12000, xp: 1,
            inputs: [], outputs: [],
        }];
        load(w);

        const result = useEntityStore.getState().recalculateEconomy();
        const ids = [result.recipePools.smithing[0].id, result.recipePools.cooking[0].id];
        expect(new Set(ids).size, `collided: ${ids.join(', ')}`).toBe(2);
    });
});
