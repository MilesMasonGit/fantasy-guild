/**
 * Economic simulator — the ANCHOR pass (phase P3+4).
 *
 * Covers `cms/src/engine/sim/anchorPass.js`: the election rule (plan §3.2,
 * CMS-119), each tie-break on its own, the explicit override flag, the
 * exclusions, and stickiness.
 *
 * ⚠️ **Fixture-proven only:** no shipped recipe outputs a Token and no shipped
 * Token of a deferred kind has a work cycle, so the Token-output refusal and
 * the deferred-source path are exercised by fixtures alone (finding S15). The
 * project's precedent is to say so rather than imply live coverage.
 */

import { describe, it, expect } from 'vitest';

import { adaptCorpus } from '../../cms/src/engine/sim/fieldAdapter.js';
import { runTempoPass } from '../../cms/src/engine/sim/tempoPass.js';
import { runAnchorPass } from '../../cms/src/engine/sim/anchorPass.js';

const out = (itemId, over = {}) => ({ itemId, chance: 100, minQty: 1, maxQty: 1, ...over });

const token = (id, over = {}) => ({
    id,
    name: id,
    rarity: 'common',
    tokenType: 'resource',
    uses: 10,
    config: {
        skill: 'logging',
        skillRequired: 1,
        cycleTimeMs: 16000,
        inputs: [],
        outputs: [out('item_wood')],
        ...(over.config ?? {}),
    },
    sim: { tempo: 'medium', purpose: 'iph' },
    ...over,
});

const recipe = (id, over = {}) => ({
    id,
    name: id,
    skill: 'crafting',
    levelRequirement: 1,
    durationMs: 16000,
    inputs: [],
    outputs: [out('item_wood')],
    sim: { tempo: 'medium', purpose: 'iph' },
    ...over,
});

/** Run adapt → time → anchor over a fixture. */
function elect({ tokens = {}, recipes = [], items = {} } = {}) {
    const entities = adaptCorpus({ tokens, recipes });
    const time = runTempoPass(entities);
    const tokenIds = new Set(Object.values(tokens).map(t => t.id));
    const anchor = runAnchorPass(entities, { skipped: time.skipped, items, tokenIds });
    return { entities, time, ...anchor };
}

describe('EconSim — ANCHOR pass', () => {
    describe('the rule: lowest level, then commoner rarity, then Token before Recipe', () => {
        it('elects the lowest-level source', () => {
            const { elections } = elect({
                tokens: {
                    a: token('token_high', { config: { skillRequired: 20, cycleTimeMs: 16000, outputs: [out('item_wood')], inputs: [] } }),
                    b: token('token_low', { config: { skillRequired: 3, cycleTimeMs: 16000, outputs: [out('item_wood')], inputs: [] } }),
                },
                items: { item_wood: { id: 'item_wood' } },
            });
            expect(elections.get('item_wood').sourceId).toBe('token_low');
            expect(elections.get('item_wood').reason).toBe('lowest level (3) · common · Token');
        });

        it('breaks a level tie to the more common rarity', () => {
            const { elections } = elect({
                tokens: {
                    a: token('token_mythic', { rarity: 'mythic' }),
                    b: token('token_rare', { rarity: 'rare' }),
                    c: token('token_common', { rarity: 'common' }),
                },
                items: { item_wood: { id: 'item_wood' } },
            });
            expect(elections.get('item_wood').sourceId).toBe('token_common');
        });

        it('breaks a level-and-rarity tie to the Token, not the Recipe', () => {
            const { elections } = elect({
                tokens: { a: token('token_source') },
                recipes: [recipe('recipe_source')],
                items: { item_wood: { id: 'item_wood' } },
            });
            expect(elections.get('item_wood').sourceId).toBe('token_source');
        });

        it('⚠️ elects a Recipe over an equal-level UNCOMMON Token — rarity decides before kind', () => {
            // A Recipe carries no rarity and ranks as `common`, so it wins the
            // second tie-break against anything rarer and never reaches the
            // third. That is the stated order working, not a bug: a Recipe is
            // the most universally available source there is, which is what
            // "the everyday source most players meet first" means. Pinned
            // because the consequence is easy to mistake for a defect, and
            // because ranking Recipes worst instead would make the
            // Token-before-Recipe tie-break dead code.
            const { elections } = elect({
                tokens: { a: token('token_uncommon', { rarity: 'uncommon' }) },
                recipes: [recipe('recipe_source')],
                items: { item_wood: { id: 'item_wood' } },
            });
            expect(elections.get('item_wood').sourceId).toBe('recipe_source');
        });

        it('still elects a Recipe when it is the lower-level source — level beats kind', () => {
            const { elections } = elect({
                tokens: { a: token('token_source', { config: { skillRequired: 9, cycleTimeMs: 16000, outputs: [out('item_wood')], inputs: [] } }) },
                recipes: [recipe('recipe_source', { levelRequirement: 2 })],
                items: { item_wood: { id: 'item_wood' } },
            });
            expect(elections.get('item_wood').sourceId).toBe('recipe_source');
        });
    });

    describe('the explicit flag overrides the rule', () => {
        it('elects a flagged higher-level Recipe over an unflagged level-1 Mythic Token', () => {
            // Exactly the shipped Charcoal shape: token_campfire is level 1 but
            // mythic; recipe_charcoal is level 5 and carries the flag.
            const { elections } = elect({
                tokens: { a: token('token_campfire', { rarity: 'mythic', config: { skillRequired: 1, cycleTimeMs: 25000, inputs: [], outputs: [out('item_charcoal')] } }) },
                recipes: [recipe('recipe_charcoal', { levelRequirement: 5, outputs: [out('item_charcoal', { anchor: true })] })],
                items: { item_charcoal: { id: 'item_charcoal' } },
            });
            expect(elections.get('item_charcoal').sourceId).toBe('recipe_charcoal');
            expect(elections.get('item_charcoal').reason).toBe('explicit anchor flag');
        });

        it('notes it when two outputs claim the same item', () => {
            const { elections, rows } = elect({
                tokens: {
                    a: token('token_a', { config: { skillRequired: 1, cycleTimeMs: 16000, inputs: [], outputs: [out('item_wood', { anchor: true })] } }),
                    b: token('token_b', { config: { skillRequired: 4, cycleTimeMs: 16000, inputs: [], outputs: [out('item_wood', { anchor: true })] } }),
                },
                items: { item_wood: { id: 'item_wood' } },
            });
            expect(rows.some(r => r.code === 'multiple-anchor-flags')).toBe(true);
            expect(elections.get('item_wood').sourceId).toBe('token_a');
        });
    });

    describe('the exclusions', () => {
        it('a passive Token never anchors, and says so rather than vanishing', () => {
            const { elections, rows } = elect({
                tokens: {
                    a: token('token_wind_trap', { tokenType: 'passive' }),
                    b: token('token_grove', { config: { skillRequired: 8, cycleTimeMs: 16000, inputs: [], outputs: [out('item_wood')] } }),
                },
                items: { item_wood: { id: 'item_wood' } },
            });
            expect(elections.get('item_wood').sourceId).toBe('token_grove');
            const row = rows.find(r => r.code === 'deferred-scope-source');
            expect(row.severity).toBe('info');
            expect(row.entityId).toBe('token_wind_trap');
        });

        it('an item sourced only by deferred kinds is Critical (CMS-86)', () => {
            const { elections, rows } = elect({
                tokens: { a: token('token_wind_trap', { tokenType: 'passive' }) },
                items: { item_wood: { id: 'item_wood' } },
            });
            expect(elections.has('item_wood')).toBe(false);
            expect(rows.find(r => r.code === 'deferred-only-item').severity).toBe('critical');
        });

        it('a downcycle recipe never anchors (CMS-130)', () => {
            const { elections } = elect({
                recipes: [
                    recipe('recipe_smelt_down', { downcycle: true, levelRequirement: 1, outputs: [out('item_wood')] }),
                    recipe('recipe_normal', { levelRequirement: 30, outputs: [out('item_wood')] }),
                ],
                items: { item_wood: { id: 'item_wood' } },
            });
            expect(elections.get('item_wood').sourceId).toBe('recipe_normal');
        });

        it('a recipe that outputs a Token is refused outright (CMS-128, fixture-proven)', () => {
            const { refused, elections, rows } = elect({
                tokens: { t: token('token_product', { config: null }) },
                recipes: [recipe('recipe_makes_token', { outputs: [out('token_product')] })],
                items: {},
            });
            expect(refused.has('recipe_makes_token')).toBe(true);
            expect(elections.has('token_product')).toBe(false);
            const row = rows.find(r => r.code === 'token-output-recipe');
            expect(row.severity).toBe('critical');
            expect(row.message).toContain('deferred shape');
        });

        it('an item with no source at all is Critical', () => {
            const { rows } = elect({ items: { item_lonely: { id: 'item_lonely' } } });
            const row = rows.find(r => r.code === 'orphan-item');
            expect(row.severity).toBe('critical');
            expect(row.itemId).toBe('item_lonely');
        });

        it('an item whose every source is untagged is Info, not Critical (A10)', () => {
            const fixture = { tokens: { a: token('token_untagged', { sim: undefined }) }, items: { item_wood: { id: 'item_wood' } } };
            const before = JSON.stringify(fixture);
            const { elections, rows } = elect(fixture);

            expect(elections.has('item_wood')).toBe(false);
            const row = rows.find(r => r.code === 'untagged-only-item');
            expect(row.severity).toBe('info');
            expect(rows.some(r => r.severity === 'critical')).toBe(false);
            // Skipped *untouched*: the pass mutates nothing it declines to handle.
            expect(JSON.stringify(fixture)).toBe(before);
        });
    });

    describe('stickiness (plan §3.2, problem P9)', () => {
        it('keeps a stored election and files an Info row naming the challenger', () => {
            const { elections, rows } = elect({
                tokens: {
                    a: token('token_oakwood_grove', { config: { skillRequired: 5, cycleTimeMs: 16000, inputs: [], outputs: [out('item_wood')] } }),
                    b: token('token_willow_sapling', { config: { skillRequired: 1, cycleTimeMs: 16000, inputs: [], outputs: [out('item_wood')] } }),
                },
                items: { item_wood: { id: 'item_wood', valueSource: 'token_oakwood_grove' } },
            });

            // The lower-level newcomer would win on the rule — and does not,
            // because adding one Token must never silently re-price a chain.
            expect(elections.get('item_wood').sourceId).toBe('token_oakwood_grove');
            expect(elections.get('item_wood').sticky).toBe(true);

            const row = rows.find(r => r.code === 'anchor-candidate-changed');
            expect(row.severity).toBe('info');
            expect(row.message).toContain('token_willow_sapling');
            expect(row.message).toContain('token_oakwood_grove');
            expect(row.detail.wouldElect).toBe('token_willow_sapling');
        });

        it('files no challenger row when the stored election is still the winner', () => {
            const { rows } = elect({
                tokens: { a: token('token_grove') },
                items: { item_wood: { id: 'item_wood', valueSource: 'token_grove' } },
            });
            expect(rows.some(r => r.code === 'anchor-candidate-changed')).toBe(false);
        });

        it('re-elects when the stored anchor is no longer an eligible source', () => {
            const { elections, rows } = elect({
                tokens: { a: token('token_grove') },
                items: { item_wood: { id: 'item_wood', valueSource: 'token_deleted' } },
            });
            expect(elections.get('item_wood').sourceId).toBe('token_grove');
            expect(rows.find(r => r.code === 'stale-election').severity).toBe('info');
        });
    });
});
