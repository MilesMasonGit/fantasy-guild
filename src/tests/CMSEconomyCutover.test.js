import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { useGlobalStore } from '../../cms/src/stores/useGlobalStore';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore';
import { syncFiles } from '../../cms/src/engine/recipeSync';
import { DEFAULT_DIALS } from '../../cms/src/engine/sim/dials';
import { xpPerCycle } from '../../cms/src/engine/sim/xpPass';
import { RETIRED_ITEM_FIELDS } from '../../cms/src/engine/sim/writeBack';

/**
 * The economic simulator's cutover, from the store's side.
 *
 * `recalculateEconomy` is the seam the whole rework turns on: it runs the
 * passes, lands their results in the fields the game reads, and — the part with
 * the sharpest edge — **deletes the retired fields on the way past**.
 *
 * ## ⚠️ Why the stale-workspace cases are the important ones
 *
 * The CMS has no game → CMS import path. Content lives in a browser's
 * localStorage until someone presses Sync, and Sync writes **from the store**.
 * So migrating `data/` was never the hard half: a browser still holding a
 * pre-cutover workspace — items with `trueCost`/`sellPrice`, recipes with the
 * nine EV fields — would put every one of those fields straight back into the
 * game files on its next Sync. The write-back strips them instead, so a stale
 * workspace heals on its first Recalculate. These cases are that guarantee.
 */

/** A workspace as a browser that predates the cutover holds it. */
function staleWorkspace() {
    return {
        items: {
            item_log: {
                id: 'item_log', name: 'Log', type: 'material', value: null,
                trueCost: 3.5, sellPrice: 3,
            },
            item_plank: {
                id: 'item_plank', name: 'Plank', type: 'material', value: null,
                trueCost: 9, sellPrice: 8,
            },
        },
        tokens: {
            token_grove: {
                id: 'token_grove', name: 'Grove', tokenType: 'resource', rarity: 'common',
                uses: null, requiresHero: true, statements: [],
                sim: { tempo: 'fast', purpose: 'iph' },
                config: {
                    skill: 'woodcutting', skillRequired: 1, cycleTimeMs: 12000, xp: 7,
                    inputs: [],
                    outputs: [{
                        itemId: 'item_log', chance: 100, minQty: 1, maxQty: 1,
                        baseQty: { min: 1, max: 1 }, variable: false,
                    }],
                },
            },
        },
        maps: {},
        recipePools: {
            crafting: [{
                id: 'recipe_plank', name: 'Plank', skill: 'crafting', levelRequirement: 1,
                durationMs: 12000, xp: 4, stationChargeCost: 1, requiresContext: [],
                inputs: [{ itemId: 'item_log', quantity: 2 }],
                outputs: [{
                    itemId: 'item_plank', chance: 100, minQty: 1, maxQty: 1,
                    isPrimarySource: true, baseQty: { min: 1, max: 1 }, variable: false,
                }],
                sim: { tempo: 'medium', purpose: 'gph' },
                targetEV: 1.05, calculatedEV: 1.9, autoBalance: true,
                fieldLocks: { quantity: false, xpAwarded: false },
                profitSplit: { item: 0.8, xp: 0.2 },
                liquidityEV: 0.9, progressionEV: 0.4, goldPerMinute: 12, xpPerMinute: 20,
            }],
        },
    };
}

const EV_FIELDS = [
    'targetEV', 'calculatedEV', 'autoBalance', 'fieldLocks', 'profitSplit',
    'liquidityEV', 'progressionEV', 'goldPerMinute', 'xpPerMinute',
];

function load(workspace) {
    useEntityStore.setState({ ...workspace, activeEntityId: null, activeEntityType: null });
}

const recipeOf = (result) => result.recipePools.crafting[0];

describe('⚠️ A stale workspace heals on its first Recalculate', () => {
    beforeEach(() => load(staleWorkspace()));
    afterEach(() => useSimulationStore.getState().clearResults());

    it('does not crash on a pre-cutover workspace', () => {
        expect(() => useEntityStore.getState().recalculateEconomy()).not.toThrow();
    });

    it('strips trueCost and sellPrice from every item', () => {
        const { items } = useEntityStore.getState().recalculateEconomy();
        for (const [id, item] of Object.entries(items)) {
            for (const field of RETIRED_ITEM_FIELDS) {
                expect(field in item, `${id} kept ${field}`).toBe(false);
            }
        }
    });

    it('strips the nine EV fields and the legacy anchor flag from every recipe', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const recipe = recipeOf(result);
        for (const field of EV_FIELDS) expect(field in recipe, `kept ${field}`).toBe(false);
        expect('isPrimarySource' in recipe.outputs[0]).toBe(false);
        // What the legacy flag *meant* survives as the anchor intent flag.
        expect(recipe.outputs[0].anchor).toBe(true);
    });

    it('⚠️ keeps them gone through a SECOND run — the fields do not come back', () => {
        const first = useEntityStore.getState().recalculateEconomy();
        const second = useEntityStore.getState().recalculateEconomy();

        for (const item of Object.values(second.items)) {
            for (const field of RETIRED_ITEM_FIELDS) expect(field in item).toBe(false);
        }
        for (const field of EV_FIELDS) expect(field in recipeOf(second)).toBe(false);
        // And the second run agrees with the first, which is the idempotence
        // the whole design rests on (plan §11).
        expect(JSON.stringify(second.items)).toBe(JSON.stringify(first.items));
        expect(JSON.stringify(second.recipePools)).toBe(JSON.stringify(first.recipePools));
    });

    it('never lets a retired field reach the sync payload', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const written = JSON.stringify(syncFiles(result));
        for (const field of [...RETIRED_ITEM_FIELDS, ...EV_FIELDS, 'isPrimarySource']) {
            expect(written.includes(`"${field}"`), `${field} reached the payload`).toBe(false);
        }
    });
});

describe('What Recalculate writes', () => {
    beforeEach(() => load(staleWorkspace()));

    it('gives every item an integer value and a source that produced it', () => {
        const { items } = useEntityStore.getState().recalculateEconomy();

        expect(Number.isInteger(items.item_log.value)).toBe(true);
        expect(items.item_log.valueSource).toBe('token_grove');
        expect(Number.isInteger(items.item_plank.value)).toBe(true);
        // The legacy `isPrimarySource` flag became an anchor flag before the
        // passes ran, so the recipe wins the election over nothing else.
        expect(items.item_plank.valueSource).toBe('recipe_plank');
    });

    it('prices a crafted item above the inputs it consumes', () => {
        const { items } = useEntityStore.getState().recalculateEconomy();
        expect(items.item_plank.value).toBeGreaterThan(items.item_log.value * 2);
    });

    it('sets the cycle time from the Tempo band, in whole seconds', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const cycle = result.tokens.token_grove.config.cycleTimeMs;
        expect(cycle % 1000).toBe(0);
        // Fast at level 1 is 8–12s; the pass takes the middle.
        expect(cycle).toBe(10000);
        expect(recipeOf(result).durationMs).toBe(16000);
    });

    /**
     * ⚠️ **Changed in P8, deliberately.** This case used to assert that
     * authored `xp` passed through untouched, which was true while XP was the
     * one derivation the simulator had not landed. P8 lands it: `xp` is now
     * derived like every other field the game reads, so the old assertion has
     * become a statement that the phase did not happen.
     *
     * What it asserts instead is the *rule* — the fields carry the §8 formula's
     * answer at the cycle time the passes settled on — rather than a literal,
     * which would only re-encode the curve in a second place.
     */
    it('derives XP into the two fields the runtime reads (P8)', () => {
        const result = useEntityStore.getState().recalculateEconomy();

        const token = result.tokens.token_grove;
        const recipe = recipeOf(result);
        const expectedFor = (level, purpose, cycleTimeMs) =>
            xpPerCycle(level, purpose, cycleTimeMs, DEFAULT_DIALS);

        expect(token.config.xp).toBe(
            expectedFor(1, 'iph', token.config.cycleTimeMs)
        );
        expect(recipe.xp).toBe(
            expectedFor(1, 'gph', recipe.durationMs)
        );
        // Both moved off what the workspace authored (7 and 4), which is the
        // point: they are no longer authored numbers.
        expect(token.config.xp).not.toBe(7);
        expect(recipe.xp).not.toBe(4);
    });

    it('⚠️ DELETES the Token’s dead top-level `xp` rather than preserving it', () => {
        /**
         * ## This assertion was reversed on 2026-09-05, deliberately
         *
         * It used to require that a top-level `xp` survived Recalculate
         * untouched, on the reasoning that deleting it was a content migration
         * deserving its own sitting rather than something smuggled into a
         * derivation phase. That reasoning was sound and the sitting has now
         * happened.
         *
         * Leaving it as it was is not an option: `data/` was cleaned of the
         * field in `0b6f258`, so a write-back that preserves it means the next
         * Sync from any pre-rework browser puts it straight back — which is
         * exactly what happened, and what took `OneRuleOnePlace`'s CR2-192
         * guard red against a corpus nobody had edited.
         *
         * `config.xp` is untouched by this and stays derived: only the dead
         * twin goes. See `RETIRED_TOKEN_FIELDS`.
         */
        useEntityStore.getState().hydrate({
            ...staleWorkspace(),
            tokens: {
                token_grove: { ...staleWorkspace().tokens.token_grove, xp: 99 },
            },
        });
        const result = useEntityStore.getState().recalculateEconomy();
        expect('xp' in result.tokens.token_grove).toBe(false);
        // The live, derived one is still there and is not the dead number.
        expect(Number.isFinite(result.tokens.token_grove.config.xp)).toBe(true);
        expect(result.tokens.token_grove.config.xp).not.toBe(99);
    });

    it('⚠️ keeps Tempo and Purpose out of the generated description (CMS-134)', () => {
        const result = useEntityStore.getState().recalculateEconomy();
        const description = result.tokens.token_grove.description.toLowerCase();
        for (const word of ['tempo', 'purpose', 'fast', 'iph', 'gph', 'xph']) {
            expect(description.includes(word), `description leaked "${word}"`).toBe(false);
        }
    });

    it('publishes an audit result the panel can render', () => {
        useEntityStore.getState().recalculateEconomy();
        const { auditResults, lastRunTimestamp } = useSimulationStore.getState();
        expect(lastRunTimestamp).toBeTruthy();
        expect(Array.isArray(auditResults)).toBe(true);
        for (const issue of auditResults) {
            expect(typeof issue.details).toBe('string');
            expect(['Critical', 'Warning', 'Info']).toContain(issue.severity);
        }
    });
});

/**
 * The Map check, from the store's side (phase P7).
 *
 * The pass itself is covered by `EconSimMaps.test.js`; what is only reachable
 * here is the **wiring** — that Recalculate hands the Maps to the check, lands
 * the two things it derives (pool weights, per-Token scrap values) in the
 * store, publishes the table, and leaves every authored Map field alone.
 */
describe('What Recalculate writes for Maps', () => {
    beforeEach(() => {
        const workspace = staleWorkspace();
        workspace.maps = {
            map_fixture_grove: {
                id: 'map_fixture_grove', name: 'Fixture Grove', price: 1000,
                materials: [{ itemId: 'item_log', quantity: 2 }],
                // An authored weight the derivation must overwrite.
                pool: [{ kind: 'token', refId: 'token_grove', weight: 7 }],
            },
        };
        workspace.tokens.token_shelf = {
            id: 'token_shelf', name: 'Shelf', tokenType: 'buff', rarity: 'rare',
            uses: 5, requiresHero: false, statements: [], config: null,
        };
        load(workspace);
    });
    afterEach(() => useSimulationStore.getState().clearResults());

    it('derives the pool weight from rarity, overwriting what was authored', () => {
        const { maps } = useEntityStore.getState().recalculateEconomy();
        // The referenced Token is Common, and Common is the table's top row.
        expect(maps.map_fixture_grove.pool[0].weight).toBe(100);
    });

    it('leaves the Map\'s authored fields exactly as typed', () => {
        const { maps } = useEntityStore.getState().recalculateEconomy();
        const map = maps.map_fixture_grove;
        expect(map.price).toBe(1000);
        expect(map.materials).toEqual([{ itemId: 'item_log', quantity: 2 }]);
        expect(map.pool[0].refId).toBe('token_grove');
        expect(map.pool).toHaveLength(1);
    });

    it('writes a scrap value onto a Token some pool hands over', () => {
        const { tokens } = useEntityStore.getState().recalculateEconomy();
        expect(Number.isInteger(tokens.token_grove.scrapValue)).toBe(true);
        expect(tokens.token_grove.scrapValue).toBeGreaterThan(0);
    });

    it('⚠️ writes no scrap value at all onto a Token no pool contains', () => {
        // Not a zero: `TokenBank.sellValue` falls back to its rarity table for
        // a Token the sim has not priced, and a written zero would make it
        // unsellable rather than merely unpriced.
        const { tokens } = useEntityStore.getState().recalculateEconomy();
        expect('scrapValue' in tokens.token_shelf).toBe(false);
    });

    it('publishes the Map table for the panel', () => {
        useEntityStore.getState().recalculateEconomy();
        const { mapReports } = useSimulationStore.getState();
        expect(mapReports).toHaveLength(1);
        const [report] = mapReports;
        expect(report.id).toBe('map_fixture_grove');
        expect(report.cost).toBeGreaterThan(1000); // price plus its materials
        expect(typeof report.pass).toBe('boolean');
    });

    it('is idempotent — a second run writes the same weights and values', () => {
        const first = useEntityStore.getState().recalculateEconomy();
        const second = useEntityStore.getState().recalculateEconomy();
        expect(second.maps.map_fixture_grove.pool[0].weight)
            .toBe(first.maps.map_fixture_grove.pool[0].weight);
        expect(second.tokens.token_grove.scrapValue).toBe(first.tokens.token_grove.scrapValue);
    });
});

describe('An anchor election is sticky', () => {
    it('keeps a stored valueSource when a new source would out-rank it', () => {
        const workspace = staleWorkspace();
        // A second, equally eligible source for the same item, whose id sorts
        // first — so the election rule alone would pick it.
        workspace.tokens.token_a_grove = {
            ...workspace.tokens.token_grove,
            id: 'token_a_grove', name: 'Alternative Grove',
        };
        workspace.items.item_log.valueSource = 'token_grove';
        load(workspace);

        const { items } = useEntityStore.getState().recalculateEconomy();
        expect(items.item_log.valueSource).toBe('token_grove');
    });

    it('re-elects when the stored source is no longer a source at all', () => {
        const workspace = staleWorkspace();
        workspace.items.item_log.valueSource = 'token_deleted';
        load(workspace);

        const { items } = useEntityStore.getState().recalculateEconomy();
        expect(items.item_log.valueSource).toBe('token_grove');
    });
});

describe('The dial store', () => {
    it('ships the whole §14 dial set under one key', () => {
        expect(useGlobalStore.getState().simDials).toEqual(DEFAULT_DIALS);
    });

    it('hands the dials to the passes — turning one moves a price', () => {
        load(staleWorkspace());
        const base = useEntityStore.getState().recalculateEconomy(useGlobalStore.getState());

        const doubled = useEntityStore.getState().recalculateEconomy({
            simDials: {
                ...DEFAULT_DIALS,
                gphPins: Object.fromEntries(
                    Object.entries(DEFAULT_DIALS.gphPins).map(([l, g]) => [l, g * 4])
                ),
            },
        });

        expect(doubled.items.item_log.value).toBeGreaterThan(base.items.item_log.value);
    });

    /**
     * ⚠️ **The versionless path is the one that matters.** zustand calls
     * `migrate` only when the stored blob's `version` is a *number*; a
     * workspace opened and never edited was written before the key existed, so
     * it reaches `merge` and nothing else. A dial set installed only in
     * `migrate` would be undefined on exactly those browsers.
     */
    describe('rehydration fills the dials on every path', () => {
        const options = useGlobalStore.persist.getOptions();

        it('fills them through merge, which every rehydration calls', () => {
            const versionless = { gphTargets: { 1: 999 } };   // no `version` key at all
            const merged = options.merge(versionless, useGlobalStore.getState());
            expect(merged.simDials).toEqual(DEFAULT_DIALS);
            expect(merged.gphTargets).toEqual({ 1: 999 });
        });

        it('keeps a dial the developer turned, and fills in the rest', () => {
            const turned = { simDials: { craftMarginPerStep: 0.5 } };
            const merged = options.merge(turned, useGlobalStore.getState());
            expect(merged.simDials.craftMarginPerStep).toBe(0.5);
            expect(merged.simDials.gphPins).toEqual(DEFAULT_DIALS.gphPins);
        });

        it('survives a null persisted blob', () => {
            const merged = options.merge(null, useGlobalStore.getState());
            expect(merged.simDials).toEqual(DEFAULT_DIALS);
        });

        it('migrates a version-0 blob without losing it', () => {
            const migrated = options.migrate({ mapTargetROI: 12 }, 0);
            expect(migrated.mapTargetROI).toBe(12);
        });

        it('passes a version-1 blob straight through to merge', () => {
            const blob = { mapTargetROI: 12 };
            expect(options.migrate(blob, 1)).toBe(blob);
        });
    });
});
