import { describe, it, expect } from 'vitest';

import {
    progressionRows,
    groupBySkill,
    filterRows,
    recordPatch,
    NO_SKILL,
} from '../../cms/src/engine/progressionRows';
import tokenData from '../../data/tokens.json';
import recipeData from '../../data/tokenRecipes.json';

/**
 * The Progression screen's row adapter.
 *
 * ⚠️ **The field names are the whole risk here.** A Token keeps its level on
 * `config.skillRequired` and its cycle on `config.cycleTimeMs`; a recipe keeps
 * them on `levelRequirement` and `durationMs`. A list that read one name for
 * both would render a plausible table in which half the rows showed a default
 * instead of the authored value — and, once editing lands, wrote to a field
 * nothing reads. These tests exist mostly to pin that.
 *
 * Fixtures for the shapes; the shipped corpus is asserted against **rules
 * only**, never by id (house rule).
 */

function workspace() {
    return {
        tokens: {
            token_with_cycle: {
                id: 'token_with_cycle', name: 'Seam', sim: { tempo: 'medium', purpose: 'iph' },
                config: { skill: 'mining', skillRequired: 12, cycleTimeMs: 14000, xp: 6, outputs: [{ itemId: 'i' }] },
            },
            // A pooled station: a config, a skill and a level, but no I/O of
            // its own because its recipes come from the pool.
            token_station: {
                id: 'token_station', name: 'Kiln',
                config: { skill: 'crafting', skillRequired: 5, cycleTimeMs: 12000, xp: 0, inputs: [], outputs: [] },
            },
            // No config at all — a pickaxe, a buff, a Map token.
            token_inert: { id: 'token_inert', name: 'Pickaxe', config: null },
            // A cycle but no skill, like every shipped berry bush.
            token_no_skill: {
                id: 'token_no_skill', name: 'Bush',
                config: { skill: '', skillRequired: 3, cycleTimeMs: 12000, xp: 0, outputs: [{ itemId: 'i' }] },
            },
        },
        recipePools: {
            smithing: [{
                id: 'recipe_ingot', name: 'Ingot', skill: 'smithing',
                levelRequirement: 20, durationMs: 16000, xp: 25,
                sim: { tempo: 'slow', purpose: 'gph' },
            }],
        },
    };
}

const byKey = (rows, key) => rows.find((r) => r.rowKey === key);

describe('One row shape from two different records', () => {
    it('reads a Token level from config.skillRequired', () => {
        const row = byKey(progressionRows(workspace()), 'token:token_with_cycle');
        expect(row.level).toBe(12);
        expect(row.cycleTimeMs).toBe(14000);
        expect(row.skill).toBe('mining');
    });

    it('reads a recipe level from levelRequirement, not skillRequired', () => {
        const row = byKey(progressionRows(workspace()), 'recipe:recipe_ingot');
        expect(row.level).toBe(20);
        expect(row.cycleTimeMs).toBe(16000);
    });

    it('⚠️ never falls back to the default when the authored level exists', () => {
        // The failure this guards: reading `levelRequirement` off a Token, or
        // `skillRequired` off a recipe, yields undefined and the `?? 1` makes
        // it look like a deliberate level 1.
        const rows = progressionRows(workspace());
        expect(rows.filter((r) => r.level === 1)).toHaveLength(0);
    });

    it('takes Tempo and Purpose off `sim` for both kinds', () => {
        const rows = progressionRows(workspace());
        expect(byKey(rows, 'token:token_with_cycle')).toMatchObject({ tempo: 'medium', purpose: 'iph' });
        expect(byKey(rows, 'recipe:recipe_ingot')).toMatchObject({ tempo: 'slow', purpose: 'gph' });
    });

    it('carries what a writer needs to address the record', () => {
        const rows = progressionRows(workspace());
        expect(byKey(rows, 'token:token_with_cycle')).toMatchObject({ kind: 'token', id: 'token_with_cycle' });
        // A recipe lives at an index inside a pool, which is how the store
        // addresses it — an id alone cannot find it.
        expect(byKey(rows, 'recipe:recipe_ingot')).toMatchObject({
            kind: 'recipe', poolSkill: 'smithing', index: 0,
        });
    });
});

describe('Which records get a row', () => {
    it('includes a config-less-of-I/O station, and excludes a config-less Token', () => {
        const rows = progressionRows(workspace());
        expect(byKey(rows, 'token:token_station'), 'a pooled station has a level to edit').toBeTruthy();
        expect(byKey(rows, 'token:token_inert'), 'no config means no level').toBeFalsy();
    });

    it('gives a recipe its pool as a skill when the record does not say', () => {
        const w = workspace();
        delete w.recipePools.smithing[0].skill;
        expect(byKey(progressionRows(w), 'recipe:recipe_ingot').skill).toBe('smithing');
    });

    it('survives a pool that is not an array', () => {
        const w = workspace();
        w.recipePools.broken = { not: 'an array' };
        expect(() => progressionRows(w)).not.toThrow();
    });
});

describe('Grouping and ordering', () => {
    it('orders within a skill by level, then by name', () => {
        const w = workspace();
        w.tokens.token_b = {
            id: 'token_b', name: 'Aardvark',
            config: { skill: 'mining', skillRequired: 12, outputs: [{ itemId: 'i' }] },
        };
        const groups = Object.fromEntries(groupBySkill(progressionRows(w)));
        expect(groups.mining.map((r) => r.name)).toEqual(['Aardvark', 'Seam']);
    });

    it('⚠️ sorts the No skill group last, however many rows it has', () => {
        const groups = groupBySkill(progressionRows(workspace()));
        expect(groups[groups.length - 1][0]).toBe(NO_SKILL);
    });

    it('drops skills with no rows rather than listing all 27', () => {
        const skills = groupBySkill(progressionRows(workspace())).map(([s]) => s);
        expect(skills).toHaveLength(4); // mining, crafting, smithing, no-skill
    });

    it('keeps a row whose skill the registry does not declare', () => {
        const w = workspace();
        w.tokens.token_with_cycle.config.skill = 'basketweaving';
        const rows = groupBySkill(progressionRows(w)).flatMap(([, g]) => g);
        expect(rows.some((r) => r.name === 'Seam')).toBe(true);
    });
});

describe('Filtering', () => {
    it('matches on name and on id, case-insensitively', () => {
        const rows = progressionRows(workspace());
        expect(filterRows(rows, { search: 'seam' })).toHaveLength(1);
        expect(filterRows(rows, { search: 'RECIPE_ING' })).toHaveLength(1);
    });

    it('filters to one skill, and to the no-skill group', () => {
        const rows = progressionRows(workspace());
        expect(filterRows(rows, { skill: 'mining' })).toHaveLength(1);
        expect(filterRows(rows, { skill: NO_SKILL })).toHaveLength(4);
    });
});

describe('Over the shipped corpus', () => {
    const rows = progressionRows({
        tokens: tokenData,
        recipePools: { all: recipeData },
    });

    it('gives every Token with a config a row, and none without', () => {
        const withConfig = Object.values(tokenData).filter((t) => t.config).length;
        expect(rows.filter((r) => r.kind === 'token')).toHaveLength(withConfig);
    });

    it('gives every recipe a row', () => {
        expect(rows.filter((r) => r.kind === 'recipe')).toHaveLength(recipeData.length);
    });

    it('reads a real level for every row — no row defaults silently', () => {
        for (const row of rows) {
            expect(Number.isFinite(row.level), `${row.name} has no level`).toBe(true);
            expect(row.level, `${row.name} has a level below 1`).toBeGreaterThanOrEqual(1);
        }
    });

    it('agrees with each record about its own level', () => {
        // The corpus-level version of the field-name pin: whatever the row
        // says, the record must say the same thing in its own vocabulary.
        for (const row of rows) {
            const expected = row.kind === 'token'
                ? (tokenData[row.id].config.skillRequired ?? 1)
                : (recipeData[row.index].levelRequirement ?? 1);
            expect(row.level, `${row.name} disagrees with its record`).toBe(expected);
        }
    });

    it('every row key is unique', () => {
        expect(new Set(rows.map((r) => r.rowKey)).size).toBe(rows.length);
    });
});

describe('⚠️ Writing an edit back to the right field', () => {
    const rows = progressionRows(workspace());
    const tokenRow = byKey(rows, 'token:token_with_cycle');
    const recipeRow = byKey(rows, 'recipe:recipe_ingot');
    const tokenRecord = workspace().tokens.token_with_cycle;
    const recipeRecord = workspace().recipePools.smithing[0];

    it("puts a Token's level on config.skillRequired, never on levelRequirement", () => {
        const patch = recordPatch(tokenRow, tokenRecord, { level: 30 });
        expect(patch.config.skillRequired).toBe(30);
        expect('levelRequirement' in patch).toBe(false);
    });

    it("puts a recipe's level on levelRequirement, never on a config", () => {
        const patch = recordPatch(recipeRow, recipeRecord, { level: 30 });
        expect(patch.levelRequirement).toBe(30);
        expect('config' in patch).toBe(false);
    });

    it('⚠️ merges the config rather than replacing it', () => {
        // `updateToken` shallow-merges, so a bare `{ config: { skillRequired } }`
        // would silently drop the skill, the cycle time, the XP and the I/O.
        const patch = recordPatch(tokenRow, tokenRecord, { level: 30 });
        expect(patch.config).toMatchObject({
            skill: 'mining', cycleTimeMs: 14000, xp: 6,
        });
        expect(patch.config.outputs).toHaveLength(1);
    });

    it('merges sim, so setting Tempo does not clear Purpose', () => {
        const patch = recordPatch(tokenRow, tokenRecord, { tempo: 'slow' });
        expect(patch.sim).toEqual({ tempo: 'slow', purpose: 'iph' });
    });

    it('⚠️ clearing a tag deletes the key rather than writing an empty string', () => {
        // `tempoPass` skips an entity with no tempo; an empty string is an
        // *unknown* tempo, which files a different row entirely.
        const patch = recordPatch(tokenRow, tokenRecord, { tempo: '' });
        expect('tempo' in patch.sim).toBe(false);
        expect(patch.sim.purpose).toBe('iph');
    });

    it('drops sim entirely once the last tag is cleared', () => {
        const patch = recordPatch(tokenRow, tokenRecord, { tempo: '', purpose: '' });
        expect(patch.sim).toBeUndefined();
    });

    it('creates sim on a record that never had one', () => {
        const bare = workspace().tokens.token_no_skill;
        const row = byKey(rows, 'token:token_no_skill');
        expect(recordPatch(row, bare, { purpose: 'gph' }).sim).toEqual({ purpose: 'gph' });
    });

    it('floors a level at 1 and rounds a typed decimal', () => {
        expect(recordPatch(recipeRow, recipeRecord, { level: 0 }).levelRequirement).toBe(1);
        expect(recordPatch(recipeRow, recipeRecord, { level: -5 }).levelRequirement).toBe(1);
        expect(recordPatch(recipeRow, recipeRecord, { level: 12.6 }).levelRequirement).toBe(13);
    });

    it('touches nothing it was not asked to change', () => {
        expect(recordPatch(tokenRow, tokenRecord, { level: 4 })).not.toHaveProperty('sim');
        expect(recordPatch(tokenRow, tokenRecord, { tempo: 'fast' })).not.toHaveProperty('config');
        expect(recordPatch(tokenRow, tokenRecord, {})).toEqual({});
    });
});
