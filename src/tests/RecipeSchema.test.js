import { describe, it, expect } from 'vitest';

import recipes from '../../data/tokenRecipes.json';
import legacyEV from './fixtures/legacyRecipeEV.json';
import items from '../../data/items.json';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

/**
 * The merged recipe schema (rework phase P0).
 *
 * `data/tokenRecipes.json` is a flat array of recipes, each carrying its own
 * `skill`. It used to be an object keyed by skill with no per-recipe id, which
 * meant a recipe was identified only by its index in a pool. P2 saves a
 * station's chosen recipe as `selectedRecipeId`, and an index renumbers every
 * time someone inserts a recipe in the CMS — so `id` is the field this whole
 * rework rests on and the first thing asserted here.
 *
 * The retirement assertions matter as much as the shape ones: a field is only
 * really gone when a test fails if it comes back.
 */
describe('Recipe schema — P0', () => {
    const SKILL_IDS = new Set(getAllSkillIds());

    it('is a flat array, not an object keyed by skill', () => {
        expect(Array.isArray(recipes)).toBe(true);
    });

    it('gives every recipe a non-empty, globally unique id', () => {
        for (const r of recipes) {
            expect(typeof r.id, `${r.name} has no id`).toBe('string');
            expect(r.id.length, `${r.name} has an empty id`).toBeGreaterThan(0);
        }
        const ids = recipes.map(r => r.id);
        expect(new Set(ids).size, 'duplicate recipe ids').toBe(ids.length);
    });

    it('keys every recipe on a skill the game actually has', () => {
        // The source file was keyed on `culinary` and `industry`, which are not
        // skills — tokenConstants.js:26 records the CMS episode that produced
        // them. Skill was recovered from the subskill's parent instead (R-9).
        for (const r of recipes) {
            expect(SKILL_IDS.has(r.skill), `${r.id} has unknown skill "${r.skill}"`).toBe(true);
        }
    });

    it('carries no retired field', () => {
        // subskillId → skill (R-2); energyCost → gone with the vital (R-3);
        // baseTickTime/cycleTimeMs → durationMs; xpAwarded → xp;
        // skillRequirement duplicated levelRequirement on all 18 that had both.
        const RETIRED = [
            'subskillId', 'energyCost', 'baseTickTime', 'cycleTimeMs', 'xpAwarded',
            'skillRequirement', 'encounterChance', 'encounterTableId', 'autoSyncId'
        ];
        for (const r of recipes) {
            for (const field of RETIRED) {
                expect(field in r, `${r.id} still carries ${field}`).toBe(false);
            }
            for (const o of r.outputs) {
                expect('dropChance' in o, `${r.id} output still carries dropChance`).toBe(false);
            }
        }
    });

    it('gives every recipe a positive duration, a level gate and an xp award', () => {
        for (const r of recipes) {
            expect(r.durationMs, `${r.id} durationMs`).toBeGreaterThan(0);
            expect(r.levelRequirement, `${r.id} levelRequirement`).toBeGreaterThanOrEqual(1);
            expect(r.xp, `${r.id} xp`).toBeGreaterThanOrEqual(0);
            expect(r.stationChargeCost, `${r.id} stationChargeCost`).toBeGreaterThanOrEqual(0);
        }
    });

    it('states every context requirement as an object, never a bare tag', () => {
        for (const r of recipes) {
            expect(Array.isArray(r.requiresContext), `${r.id} requiresContext`).toBe(true);
            for (const c of r.requiresContext) {
                expect(typeof c, `${r.id} has a bare-string context requirement`).toBe('object');
                expect(typeof c.tag).toBe('string');
                expect(c.minTier).toBeGreaterThanOrEqual(1);
                expect(c.chargeCost).toBeGreaterThanOrEqual(0);
            }
        }
    });

    /**
     * ⚠️ The single most likely migration bug.
     *
     * The source file used `chance: 1` to mean certain; every other recipe and
     * Token config in the game uses `chance: 100`. Copying the number across
     * unchanged would have turned all 23 recipes into 1% drops that still look
     * correct in the CMS.
     */
    it('states every output chance on the 100-means-certain scale', () => {
        for (const r of recipes) {
            for (const o of r.outputs) {
                expect(o.chance, `${r.id} chance out of range`).toBeGreaterThan(1);
                expect(o.chance, `${r.id} chance out of range`).toBeLessThanOrEqual(100);
            }
        }
    });

    it('gives every output exactly one of itemId, tokenId or currency', () => {
        for (const r of recipes) {
            expect(r.outputs.length, `${r.id} has no outputs`).toBeGreaterThan(0);
            for (const o of r.outputs) {
                const kinds = ['itemId', 'tokenId', 'currency'].filter(k => o[k] != null);
                expect(kinds.length, `${r.id} output declares ${kinds.join('+') || 'nothing'}`).toBe(1);
                expect(o.minQty).toBeGreaterThanOrEqual(1);
                expect(o.maxQty).toBeGreaterThanOrEqual(o.minQty);
            }
        }
    });

    it('gives every input an itemId and a quantity', () => {
        for (const r of recipes) {
            for (const i of r.inputs) {
                expect(typeof i.itemId, `${r.id} input has no itemId`).toBe('string');
                expect(i.quantity, `${r.id} input quantity`).toBeGreaterThanOrEqual(1);
                expect('tag' in i, `${r.id} input still carries a context tag`).toBe(false);
            }
        }
    });

    /**
     * R-6 / R-11: the nine EV fields belong to the economic simulator rework.
     * This rework moved the file they live in and changed nothing else about
     * them — not their values, not their names, not their nesting. Checked
     * against a snapshot of the pre-migration file, which git otherwise keeps
     * only in history.
     */
    it('carries the EV fields across unchanged and still flat', () => {
        for (const r of recipes) {
            const before = legacyEV[r.id];
            expect(before, `${r.id} is not in the pre-migration snapshot`).toBeDefined();
            for (const [field, value] of Object.entries(before)) {
                expect(r[field], `${r.id}.${field} changed during migration`).toEqual(value);
            }
        }
        expect(Object.keys(legacyEV).length, 'a recipe was lost in migration').toBe(recipes.length);
    });

    /**
     * Not an assertion that the content is good — an assertion that we know how
     * bad it is. 30 of the items these recipes reference do not exist in
     * `data/items.json`, and no station points at any of these skills' pools,
     * so none of them can run. Authoring the missing items is content work, not
     * P0's. This test exists so that fixing them is visible when it happens
     * rather than silent.
     */
    it('records that the migrated corpus still references unauthored items', () => {
        const known = new Set(Object.keys(items));
        const missing = new Set();
        for (const r of recipes) {
            for (const i of r.inputs) if (!known.has(i.itemId)) missing.add(i.itemId);
            for (const o of r.outputs) if (o.itemId && !known.has(o.itemId)) missing.add(o.itemId);
        }
        expect(missing.size).toBe(30);
    });
});
