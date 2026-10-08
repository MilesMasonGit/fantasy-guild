import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { auditContent, reportContentIntegrity } from '../systems/core/ContentAudit.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor.js';

/**
 * The content-integrity audit.
 *
 * ⚠️ **These tests deliberately do NOT assert that the content set is clean.**
 * It is not — the audit currently reports around fifty dangling references, and
 * that is the expected state of half-authored content. The owner's ruling is
 * warn-only: the audit exists to make the breakage visible, not to fail a
 * build over it.
 *
 * ## ⚠️ Why the malformed entries below are FIXTURES
 * This suite used to assert that `data/items.json` contained an entry whose id
 * was literally `"item"` with every field blank — i.e. **that a known bug was
 * still present in live content**. The owner deleted the entry, which is the
 * correct thing to have done, and the test failed for it. A test that breaks
 * when content is *repaired* is worse than no test: it teaches you to distrust
 * the suite, and it is the exact coupling `fixtures/testTokens.js` exists to
 * prevent (engine suites test machinery; `ContentRules.test.js` tests content).
 */
describe('The content-integrity audit', () => {
    afterEach(() => vi.restoreAllMocks());

    beforeAll(() => {
        registerItems({
            // A blank name is the tell, and it reads as a real item everywhere
            // it is referenced.
            fixture_audit_nameless: { id: 'fixture_audit_nameless', name: '', sprite: 'ore_copper' },
            fixture_audit_ok: { id: 'fixture_audit_ok', name: 'Audit Fixture', sprite: 'ore_copper' }
        });
        registerTokenTypes({
            fixture_audit_blank_output: {
                id: 'fixture_audit_blank_output', name: 'Audit Blank Output',
                tokenType: 'resource', sprite: 'ore_copper',
                config: {
                    skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 0,
                    inputs: [], outputs: [{ chance: 100, minQty: 1, maxQty: 1 }]
                }
            },
            fixture_audit_bad_currency: {
                id: 'fixture_audit_bad_currency', name: 'Audit Bad Currency',
                tokenType: 'market', sprite: 'ore_copper',
                config: {
                    skill: 'commerce', skillRequired: 1, cycleTimeMs: 1000, xp: 0,
                    inputs: [], outputs: [{ currency: 'doubloons', quantity: 5 }]
                }
            }
        });
    });

    it('catches an opening Token that does not exist', () => {
        const findings = auditContent({ openingTokens: ['token_definitely_not_authored'] });
        const hit = findings.find(f => f.what.includes('token_definitely_not_authored'));
        expect(hit).toBeTruthy();
        expect(hit.where).toBe('The Tokens a new game starts with');
    });

    it('says nothing about the opening Tokens the game actually ships', async () => {
        const { openingMat } = await import('../systems/core/EngineBootstrap.js');
        const findings = auditContent({ openingTokens: openingMat().map(t => t.typeId) });
        const openingProblems = findings.filter(
            f => f.where === 'The Tokens a new game starts with'
        );
        expect(openingProblems).toEqual([]);
    });

    it('describes a break in words, naming both the thing and what it points at', () => {
        const [hit] = auditContent({ openingTokens: ['token_ghost'] })
            .filter(f => f.where === 'The Tokens a new game starts with');
        // Readable by the person authoring content, not a stack trace.
        expect(hit.what).toContain('token_ghost');
        expect(hit.what).toContain('does not exist');
        expect(hit.what).not.toContain('undefined');
    });

    it('treats an empty reference as "not set", not as broken', () => {
        // An unset field is how content says "this Token opens no Map". If
        // these counted, the real findings would drown in hundreds of lines.
        const blank = auditContent({ openingTokens: ['', null, undefined] });
        expect(blank.filter(f => f.where === 'The Tokens a new game starts with')).toEqual([]);
    });

    it('finds a half-finished item — the one with no name', () => {
        const findings = auditContent();
        const hit = findings.find(f => f.where === 'Item "fixture_audit_nameless"');
        expect(hit).toBeTruthy();
        expect(hit.what).toContain('no name');
    });

    it('says nothing about a well-formed item beside it', () => {
        // The other half of the same mechanism: noticing everything is not the
        // same as noticing the right thing.
        const findings = auditContent();
        expect(findings.filter(f => f.where === 'Item "fixture_audit_ok"')).toEqual([]);
    });

    it('catches a production output that names neither an item nor a currency', () => {
        // An output pays in an item OR in currency. A row with neither reads
        // as a real payout in the CMS and produces nothing in game.
        const findings = auditContent();
        const hit = findings.find(f => f.where === 'Token "fixture_audit_blank_output"');
        expect(hit).toBeTruthy();
        expect(hit.what).toContain('neither an item nor a currency');
    });

    it('catches a payout in a currency the game does not mint', () => {
        const findings = auditContent();
        const hit = findings.find(
            f => f.where === 'Token "fixture_audit_bad_currency"' && f.what.includes('doubloons')
        );
        expect(hit).toBeTruthy();
    });

    it('reports rather than throws, and returns what it found', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const info = vi.spyOn(console, 'info').mockImplementation(() => {});

        let findings;
        expect(() => { findings = reportContentIntegrity({ openingTokens: ['token_ghost'] }); })
            .not.toThrow();

        expect(Array.isArray(findings)).toBe(true);
        expect(warn.mock.calls.length + info.mock.calls.length).toBe(1);
    });

    it('survives an opening tray that is not a list at all', () => {
        // The audit runs during boot. Anything it is handed must produce a
        // report line at worst, never an exception.
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(() => reportContentIntegrity({ openingTokens: 'not-a-list' })).not.toThrow();
        expect(warn).toHaveBeenCalled();
    });
});

/**
 * Names that point at no skill or job: a renamed or dropped skill (Logging,
 * Explore) or job leaves content that loads silently and does nothing.
 */
describe('The audit names content pointing at a skill or job that does not exist', () => {
    const recipe = (id) => ({ id, name: id, levelRequirement: 1, durationMs: 1000, xp: 0, inputs: [], outputs: [] });
    const rule = (id, keyword, payload) => ({ id, keyword, payload });

    beforeAll(() => {
        registerTokenTypes({
            fixture_unknown_work_skill: {
                id: 'fixture_unknown_work_skill', name: 'Unknown Work Skill', requiresHero: true,
                config: { skill: 'fx_no_such_skill', skillRequired: 1, cycleTimeMs: 1000, xp: 0, inputs: [], outputs: [] }
            },
            fixture_unknown_station: {
                id: 'fixture_unknown_station', name: 'Unknown Station',
                statements: [rule('stm_fx_unknown_station', 'station', { skill: 'fx_no_such_station_skill' })]
            },
            fixture_unknown_job: {
                id: 'fixture_unknown_job', name: 'Unknown Academy',
                statements: [rule('stm_fx_unknown_job', 'promotes', { jobId: 'fx_no_such_job' })]
            },
            fixture_unknown_scope: {
                id: 'fixture_unknown_scope', name: 'Unknown Scope',
                statements: [rule('stm_fx_unknown_scope', 'provides',
                    { type: 'YIELD', bucket: 'percentage', value: 0.1, category: 'fx_no_such_scope' })]
            },
            fixture_unknown_section: {
                id: 'fixture_unknown_section', name: 'Unknown Section',
                shop: { price: [], section: 'fx_no_such_section' }
            },
            fixture_known_refs: {
                id: 'fixture_known_refs', name: 'Known Refs', requiresHero: true,
                shop: { price: [], section: 'general' },
                config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 0, inputs: [], outputs: [] },
                statements: [
                    rule('stm_fx_known_job', 'promotes', { jobId: 'paladin' }),
                    rule('stm_fx_blank_job', 'promotes', { jobId: '' }),
                    rule('stm_fx_combat_scope', 'provides', { type: 'YIELD', bucket: 'percentage', value: 0.1, category: 'combat' }),
                    rule('stm_fx_skill_scope', 'provides', { type: 'YIELD', bucket: 'percentage', value: 0.1, category: 'stealth' }),
                    rule('stm_fx_status_scope', 'provides', { type: 'STATUS_IMMUNITY', bucket: 'flat', value: 1, category: 'poisoned' })
                ]
            }
        });
        registerRecipePools({ fx_no_such_recipe_skill: [recipe('fixture_unknown_recipe_skill')] });
        registerItems({
            fixture_unknown_requirement: {
                id: 'fixture_unknown_requirement', name: 'Unknown Requirement', equipSlot: 'hand',
                requirements: [{ skill: 'fx_no_such_requirement', level: 5 }]
            }
        });
    });

    const at = (where) => auditContent().filter(f => f.where === where).map(f => f.what);

    it('names a Token whose work skill does not exist', () => {
        expect(at('Token "fixture_unknown_work_skill"')).toContainEqual(
            expect.stringMatching(/skill "fx_no_such_skill", which does not exist/));
        expect(at('Token "fixture_unknown_station"')).toContainEqual(
            expect.stringMatching(/skill "fx_no_such_station_skill", which does not exist/));
    });

    it('names a recipe whose skill does not exist', () => {
        expect(at('Recipe "fixture_unknown_recipe_skill"')).toContainEqual(
            expect.stringMatching(/skill "fx_no_such_recipe_skill", which does not exist/));
    });

    it('names a Promotes rule whose job does not exist', () => {
        expect(at('Token "fixture_unknown_job"')).toContainEqual(
            expect.stringMatching(/job "fx_no_such_job", which does not exist/));
    });

    it('names a rule scoped to an unknown skill', () => {
        expect(at('Token "fixture_unknown_scope"')).toContainEqual(
            expect.stringMatching(/skill "fx_no_such_scope", which does not exist/));
    });

    it('names a Shop section that is neither a skill nor general', () => {
        expect(at('Token "fixture_unknown_section"')).toContainEqual(
            expect.stringMatching(/Shop section "fx_no_such_section", which is neither a skill nor General/));
    });

    it('names an item that needs a skill that does not exist', () => {
        expect(at('Item "fixture_unknown_requirement"')).toContainEqual(
            expect.stringMatching(/skill "fx_no_such_requirement", which does not exist/));
    });

    it('says nothing about real skills and jobs, General, a combat or status scope, or a blank job', () => {
        expect(at('Token "fixture_known_refs"').filter(w => /does not exist|neither a skill/.test(w))).toEqual([]);
    });

    it('the CMS Economy Audit names the same things in the same words', () => {
        const tokens = {
            fixture_unknown_work_skill: getTokenType('fixture_unknown_work_skill'),
            fixture_unknown_job: getTokenType('fixture_unknown_job'),
            fixture_unknown_section: getTokenType('fixture_unknown_section')
        };
        const recipes = { fixture_unknown_recipe_skill: { ...recipe('fixture_unknown_recipe_skill'), skill: 'fx_no_such_recipe_skill' } };
        const cms = auditConnectivity({ tokens, recipes, items: {}, effects: {} }).map(i => i.details);
        const game = auditContent().map(f => f.what);
        for (const fragment of ['"fx_no_such_skill"', '"fx_no_such_job"', '"fx_no_such_section"', '"fx_no_such_recipe_skill"']) {
            const fromCms = cms.find(d => d.includes(fragment));
            expect(fromCms, fragment).toBeTruthy();
            expect(game, fragment).toContain(fromCms);
        }
    });
});
