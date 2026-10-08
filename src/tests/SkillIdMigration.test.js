// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
    SKILL_ID_RENAMES, migrateSkillIds, migrateSkillIdsIn, migrateRecipeList, migrateRecipePools
} from '../systems/effects/skillIdMigration.js';
import { getTokenType, registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { listRecipes } from '../config/registries/recipePoolRegistry.js';
import { isSkillId } from '../config/registries/skillRegistry.js';
import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import { useSimulationStore } from '../../cms/src/stores/useSimulationStore.js';
import { syncFiles } from '../../cms/src/engine/recipeSync.js';

/**
 * Logging became Forestry. `data/` and the CMS workspace (in the author's
 * browser) still say `logging` until the owner's next Sync, so both sides
 * rewrite the old id as they load, with the same pure function.
 */

const DATA = path.resolve(__dirname, '../../data');
const shipped = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));

const yieldRule = (category) => ({
    id: 'stm_fx_yield', keyword: 'provides',
    payload: { type: 'YIELD', bucket: 'percentage', value: 0.1, ...(category ? { category } : {}) }
});
const worksAs = (skill) => ({ id: 'stm_fx_station', keyword: 'station', payload: { skill } });

/** One of everything that can name a skill, all naming `skill`. */
function everyField(skill) {
    return {
        token: {
            id: 'fx_token', name: 'Fx Token',
            config: { skill, skillRequired: 3, cycleTimeMs: 1000, inputs: [], outputs: [] },
            foundation: { kind: 'wood', skill },
            shop: { price: [], section: skill },
            statements: [worksAs(skill), yieldRule(skill)]
        },
        effect: { id: 'fx_effect', name: 'Fx Effect', statements: [worksAs(skill), yieldRule(skill)] },
        recipe: { id: 'fx_recipe', name: 'Fx Recipe', skill, inputs: [], outputs: [] },
        item: {
            id: 'fx_axe', name: 'Fx Axe', skillRequired: skill, levelRequired: 5,
            requirements: [{ skill, level: 5 }, { skill: 'mining', level: 2 }],
            statements: [yieldRule(skill)]
        }
    };
}

describe('the mapping', () => {
    it('renames logging to forestry, and forestry is a real skill', () => {
        expect(SKILL_ID_RENAMES).toEqual({ logging: 'forestry' });
        for (const [from, to] of Object.entries(SKILL_ID_RENAMES)) {
            expect(isSkillId(from), from).toBe(false);
            expect(isSkillId(to), to).toBe(true);
        }
    });

    it('rewrites logging to forestry in every field that names a skill', () => {
        const before = everyField('logging');
        const after = everyField('forestry');
        expect(migrateSkillIds(before.token)).toEqual(after.token);
        expect(migrateSkillIds(before.effect)).toEqual(after.effect);
        expect(migrateSkillIds(before.recipe)).toEqual(after.recipe);
        expect(migrateSkillIds(before.item)).toEqual(after.item);
    });

    it('does not touch the input', () => {
        const before = everyField('logging');
        const copy = structuredClone(before);
        migrateSkillIds(before.token);
        migrateSkillIds(before.item);
        expect(before).toEqual(copy);
    });

    it('is idempotent and returns the same object when nothing changes', () => {
        const current = everyField('forestry');
        for (const def of Object.values(current)) expect(migrateSkillIds(def)).toBe(def);

        const once = migrateSkillIds(everyField('logging').token);
        expect(migrateSkillIds(once)).toBe(once);

        const collection = { a: current.token, b: current.effect };
        expect(migrateSkillIdsIn(collection)).toBe(collection);
        const list = [current.recipe];
        expect(migrateRecipeList(list)).toBe(list);
        const pools = { forestry: [current.recipe] };
        expect(migrateRecipePools(pools)).toBe(pools);
    });

    it('leaves unknown ids alone', () => {
        const odd = everyField('not_a_skill');
        for (const def of Object.values(odd)) expect(migrateSkillIds(def)).toBe(def);
        expect(migrateSkillIds(null)).toBeNull();
        expect(migrateSkillIds(undefined)).toBeUndefined();
    });

    it('leaves a Token\'s level alone, and a narrowing that names a status rather than a skill', () => {
        const token = { id: 'fx', config: { skill: 'mining', skillRequired: 7 } };
        expect(migrateSkillIds(token)).toBe(token);

        const immunity = {
            id: 'fx_immune', statements: [{
                id: 'stm_fx_immune', keyword: 'provides',
                payload: { type: 'STATUS_IMMUNITY', bucket: 'flat', value: 1, category: 'logging' }
            }]
        };
        expect(migrateSkillIds(immunity)).toBe(immunity);
    });

    it('moves a logging recipe pool to forestry, merging with one already there', () => {
        const old = { id: 'r_old', skill: 'logging' };
        const kept = { id: 'r_kept', skill: 'forestry' };
        const other = { id: 'r_other', skill: 'mining' };
        const pools = { logging: [old], forestry: [kept], mining: [other] };

        const next = migrateRecipePools(pools);
        expect(Object.keys(next).sort()).toEqual(['forestry', 'mining']);
        expect(next.forestry).toEqual([kept, { id: 'r_old', skill: 'forestry' }]);
        expect(next.mining).toBe(pools.mining);
    });
});

describe('the game migrates content as it loads it', () => {
    it('the game loads data\'s Oak Tree as a forestry Token', () => {
        expect(getTokenType('token_oak_tree').config.skill).toBe('forestry');
    });

    it('and the Oak Forest in the Forestry section of the Shop', () => {
        expect(getTokenType('token_oak_forest').shop.section).toBe('forestry');
    });

    it('no loaded Token or recipe still names logging', () => {
        for (const id of ['token_oak_tree', 'token_oak_forest']) {
            expect(JSON.stringify(getTokenType(id)), id).not.toMatch(/"logging"/);
        }
        expect(listRecipes().filter(r => r.skill === 'logging')).toEqual([]);
    });

    it('⚠️ fixtures registered by tests are NOT migrated, so a test means what it says', () => {
        // The migration runs in the JSON loaders only. A test fixture that still
        // named logging would otherwise pass while its heroes hold no such skill.
        registerTokenTypes({
            fixture_still_logging: {
                id: 'fixture_still_logging', name: 'Still Logging',
                config: { skill: 'logging', skillRequired: 1, cycleTimeMs: 1000, inputs: [], outputs: [] }
            }
        });
        expect(getTokenType('fixture_still_logging').config.skill).toBe('logging');
    });
});

describe('the CMS workspace migrates on every load path', () => {
    const NOOP = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    let storageBefore;

    beforeAll(() => {
        storageBefore = localStorage.getItem('fantasy-guild-cms-v2');
        useEntityStore.persist.setOptions({ storage: NOOP });
    });
    beforeEach(() => useEntityStore.setState({
        items: {}, tokens: {}, effects: {}, maps: {}, recipePools: {}, activeEntityId: null, activeEntityType: null
    }));
    afterEach(() => {
        useSimulationStore.getState().clearResults();
        expect(localStorage.getItem('fantasy-guild-cms-v2')).toBe(storageBefore);
    });

    /** A workspace as an old CMS holds it: references into the library, recipes keyed by skill. */
    function oldWorkspace() {
        const f = everyField('logging');
        const { statements: _inline, ...token } = f.token;
        return {
            tokens: { fx_token: { ...token, effects: [{ effectId: 'fx_effect', scale: 1 }] } },
            effects: { fx_effect: f.effect },
            items: { fx_axe: f.item },
            recipePools: { logging: [f.recipe] }
        };
    }

    const expectMigrated = (state) => {
        expect(state.tokens.fx_token.config.skill).toBe('forestry');
        expect(state.tokens.fx_token.foundation.skill).toBe('forestry');
        expect(state.tokens.fx_token.shop.section).toBe('forestry');
        expect(state.effects.fx_effect.statements.map(s => s.payload.skill || s.payload.category))
            .toEqual(['forestry', 'forestry']);
        expect(state.items.fx_axe.skillRequired).toBe('forestry');
        expect(state.items.fx_axe.requirements[0].skill).toBe('forestry');
        expect(Object.keys(state.recipePools)).toEqual(['forestry']);
        expect(state.recipePools.forestry[0].skill).toBe('forestry');
    };

    it('the CMS store migrates on import (hydrate)', () => {
        useEntityStore.getState().hydrate(oldWorkspace());
        expectMigrated(useEntityStore.getState());
    });

    it('the CMS store migrates on merge (every reload)', () => {
        expectMigrated(useEntityStore.persist.getOptions().merge(oldWorkspace(), useEntityStore.getState()));
    });

    it('the CMS store migrates on migrate (a numbered version change)', () => {
        expectMigrated(useEntityStore.persist.getOptions().migrate(oldWorkspace(), 0));
    });

    it('a Sync after migration writes forestry', () => {
        useEntityStore.getState().hydrate(oldWorkspace());
        const files = syncFiles(useEntityStore.getState().recalculateEconomy());

        expect(files['tokens.json'].fx_token.config.skill).toBe('forestry');
        expect(files['tokens.json'].fx_token.shop.section).toBe('forestry');
        expect(files['tokenRecipes.json'].map(r => r.skill)).toEqual(['forestry']);
        expect(files['items.json'].fx_axe.requirements[0].skill).toBe('forestry');
        expect(JSON.stringify(files)).not.toMatch(/"logging"/);
    });

    it('the shipped content, loaded into the CMS, comes out as forestry', () => {
        const recipePools = {};
        for (const r of shipped('tokenRecipes.json')) (recipePools[r.skill] ||= []).push(r);
        useEntityStore.getState().hydrate({
            tokens: shipped('tokens.json'), items: shipped('items.json'),
            effects: shipped('effects.json'), recipePools
        });
        const state = useEntityStore.getState();
        expect(state.tokens.token_oak_tree.config.skill).toBe('forestry');
        expect(JSON.stringify({ t: state.tokens, i: state.items, e: state.effects, r: state.recipePools }))
            .not.toMatch(/"logging"/);
    });
});
