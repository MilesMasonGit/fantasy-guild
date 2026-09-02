import { describe, it, expect } from 'vitest';

import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor.js';
import { runSim } from '../../cms/src/engine/sim/simRunner.js';

import tokenData from '../../data/tokens.json';
import recipeData from '../../data/tokenRecipes.json';
import itemData from '../../data/items.json';
import mapData from '../../data/maps.json';

/**
 * The CMS connectivity auditor's Token branch.
 *
 * ## Why this suite exists
 * The auditor read a Token's producers from `token.outputs`. A Token's outputs
 * live on `token.config.outputs`, and always have — so from its first version
 * the auditor saw **no Token producer anywhere**, and filed "Unreachable Item
 * (CMS-86)" Criticals against items that Tokens produce and the simulator
 * prices without complaint. On the shipped corpus that was 35 unreachable rows
 * where 4 are real. Nothing behaved wrongly; the audit tab simply lied, loudly,
 * to anyone who did not already know which half of it to ignore.
 *
 * The bug survived because every existing check was written against fixtures in
 * the auditor's own shape. So there are two tests here and they are deliberately
 * different in kind:
 *
 * 1. **The rule, on a fixture** — a Token that produces an item makes that item
 *    reachable. This is what a shape change must not break.
 * 2. **The rule, on real content** — no item the simulator prices is reported
 *    unreachable. This is the one that would actually have caught it, because
 *    the failure was only ever visible against authored data.
 *
 * ⚠️ No shipped id is named anywhere below. Test 2 derives its subject from the
 * corpus, so the owner can author freely without breaking it.
 */

const corpus = () => ({ tokens: tokenData, recipes: recipeData, items: itemData });

const unreachable = (issues) =>
    issues.filter((i) => /Unreachable Item/.test(i.details)).map((i) => i.entityId);

describe('CMS connectivity auditor — a Token that produces an item makes it reachable', () => {
    const fixtureItems = {
        fx_audit_ore: { id: 'fx_audit_ore', name: 'Fixture Ore', type: 'material' },
    };

    it('finds the producer on `config.outputs`, where Tokens actually keep it', () => {
        const tokens = {
            fx_audit_miner: {
                id: 'fx_audit_miner',
                name: 'Fixture Miner',
                config: { inputs: [], outputs: [{ itemId: 'fx_audit_ore', chance: 100 }] },
            },
        };
        expect(unreachable(auditConnectivity({ items: fixtureItems, tokens }))).toEqual([]);
    });

    it('still finds it at the top level, so either fixture shape audits', () => {
        const tokens = {
            fx_audit_miner: {
                id: 'fx_audit_miner',
                name: 'Fixture Miner',
                outputs: [{ itemId: 'fx_audit_ore', chance: 100 }],
            },
        };
        expect(unreachable(auditConnectivity({ items: fixtureItems, tokens }))).toEqual([]);
    });

    it('still reports an item nothing produces — the check has not been defanged', () => {
        const tokens = {
            fx_audit_miner: {
                id: 'fx_audit_miner',
                name: 'Fixture Miner',
                config: { inputs: [], outputs: [] },
            },
        };
        expect(unreachable(auditConnectivity({ items: fixtureItems, tokens })))
            .toEqual(['fx_audit_ore']);
    });

    it('counts a Token\'s inputs as consumers, so its input is not a dead end', () => {
        const items = {
            ...fixtureItems,
            fx_audit_bar: { id: 'fx_audit_bar', name: 'Fixture Bar', type: 'material' },
        };
        const tokens = {
            fx_audit_miner: {
                id: 'fx_audit_miner',
                name: 'Fixture Miner',
                config: { inputs: [], outputs: [{ itemId: 'fx_audit_ore' }] },
            },
            fx_audit_smelter: {
                id: 'fx_audit_smelter',
                name: 'Fixture Smelter',
                config: {
                    inputs: [{ itemId: 'fx_audit_ore', qty: 1 }],
                    outputs: [{ itemId: 'fx_audit_bar' }],
                },
            },
        };
        const issues = auditConnectivity({ items, tokens });
        expect(issues.filter((i) => /Dead-End/.test(i.details)).map((i) => i.entityId))
            .not.toContain('fx_audit_ore');
    });
});

describe('CMS connectivity auditor — over the shipped corpus', () => {
    it('reports no item unreachable that the simulator prices from a Token', () => {
        const priced = runSim(corpus()).values;
        const reported = new Set(
            unreachable(auditConnectivity({
                items: itemData,
                tokens: tokenData,
                recipes: recipeData,
                maps: mapData,
            }))
        );

        // Every item some Token's outputs produce, derived — never named.
        const tokenProduced = new Set();
        for (const token of Object.values(tokenData)) {
            for (const out of (token.config?.outputs || token.outputs || [])) {
                const id = out.itemId || out.id;
                if (id) tokenProduced.add(id);
            }
        }
        expect(tokenProduced.size, 'no Token in the corpus produces anything').toBeGreaterThan(0);

        for (const itemId of tokenProduced) {
            if (!priced.has(itemId)) continue;
            expect(reported.has(itemId), `${itemId} is priced by the sim but audited unreachable`)
                .toBe(false);
        }
    });
});

describe('CMS connectivity auditor — Pacing Gaps reads the real skill fields', () => {
    /**
     * ⚠️ Pillar 3 was inert for the same reason Pillar 1 was, and was found
     * while fixing it. It filtered on `t.skill`/`t.skillId` and read
     * `t.skillRequirement`, but a Token keeps those at `config.skill` and
     * `config.skillRequired` — and `OneRuleOnePlace` separately asserts no
     * Token carries a top-level `skill`. So every skill's token list came back
     * empty and **no pacing gap had ever been reported** in the auditor's life.
     *
     * These assert the rule against fixtures rather than against whatever
     * gaps the shipped corpus happens to have, because content moves.
     */
    const worker = (id, skill, level) => ({
        id, name: id, tokenType: 'resource',
        config: { skill, skillRequired: level, cycleTimeMs: 10000, inputs: [], outputs: [] },
    });

    it('reports a gap between two Tokens far apart in one skill', () => {
        const issues = auditConnectivity({
            items: {}, recipes: {}, maps: {},
            tokens: { a: worker('tok_low', 'logging', 1), b: worker('tok_high', 'logging', 70) },
        }, []);
        const gaps = issues.filter((i) => i.issueType === 'Pacing Gap');
        expect(gaps.length).toBeGreaterThan(0);
        // The row names the skill by its display name, not its id.
        expect(gaps[0].entityId).toBe('logging');
        expect(gaps[0].details).toMatch(/level 1 and 70/);
    });

    it('reports nothing when the ladder is evenly spaced', () => {
        const tokens = {};
        for (let lv = 1; lv <= 60; lv += 10) tokens[`t${lv}`] = worker(`tok_${lv}`, 'logging', lv);
        const issues = auditConnectivity({ items: {}, recipes: {}, maps: {}, tokens }, []);
        expect(issues.filter((i) => i.issueType === 'Pacing Gap')).toEqual([]);
    });

    it('⚠️ is not silently inert — a top-level-only Token still counts', () => {
        // The fallback that keeps a differently-shaped fixture auditing. If
        // this and the config form both stopped matching, the pillar would go
        // quiet again and every other test here would still pass.
        const issues = auditConnectivity({
            items: {}, recipes: {}, maps: {},
            tokens: {
                a: { id: 'tok_flat_low', name: 'lo', tokenType: 'resource', skill: 'mining', skillRequirement: 1 },
                b: { id: 'tok_flat_high', name: 'hi', tokenType: 'resource', skill: 'mining', skillRequirement: 60 },
            },
        }, []);
        expect(issues.filter((i) => i.issueType === 'Pacing Gap').length).toBeGreaterThan(0);
    });
});
