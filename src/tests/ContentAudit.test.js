import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { auditContent, reportContentIntegrity } from '../systems/core/ContentAudit.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';

/**
 * The content-integrity audit (CR2-108).
 *
 * ⚠️ **These tests deliberately do NOT assert that the content set is clean.**
 * It is not — the audit currently reports around fifty dangling references, and
 * that is the expected state of half-authored content. The owner's ruling is
 * warn-only: the audit exists to make the breakage visible, not to fail a
 * build over it.
 *
 * So what is worth locking down is the *mechanism*: that a broken reference is
 * caught, that an absent one is not mistaken for a broken one, and above all
 * that the audit can never throw. An audit that crashes the boot it is
 * auditing would be worse than no audit at all, and it runs inside
 * `EngineBootstrap.init()` where an exception would take the whole game down.
 *
 * ## ⚠️ Why the malformed entries below are FIXTURES
 * This suite used to assert that `data/items.json` contained an entry whose id
 * was literally `"item"` with every field blank — i.e. **that a known bug was
 * still present in live content**. The owner deleted the entry, which is the
 * correct thing to have done, and the test failed for it. A test that breaks
 * when content is *repaired* is worse than no test: it teaches you to distrust
 * the suite, and it is the exact coupling `fixtures/testTokens.js` exists to
 * prevent (engine suites test machinery; `ContentRules.test.js` tests content).
 *
 * So the malformed things are registered here, on purpose, and the assertions
 * are about the audit noticing them. Vitest isolates module registries per test
 * file, so nothing here is visible to any other suite or to the game.
 */
describe('The content-integrity audit', () => {
    afterEach(() => vi.restoreAllMocks());

    beforeAll(() => {
        registerItems({
            // The CR2-184 shape: an entry saved half-finished. A blank name is
            // the tell, and it reads as a real item everywhere it is referenced.
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
        const findings = auditContent({ openingTray: ['token_definitely_not_authored'] });
        const hit = findings.find(f => f.what.includes('token_definitely_not_authored'));
        expect(hit).toBeTruthy();
        expect(hit.where).toBe('The Tokens a new game starts with');
    });

    it('says nothing about the opening Tokens the game actually ships', async () => {
        const { OPENING_TRAY } = await import('../systems/core/EngineBootstrap.js');
        const findings = auditContent({ openingTray: OPENING_TRAY });
        const openingProblems = findings.filter(
            f => f.where === 'The Tokens a new game starts with'
        );
        expect(openingProblems).toEqual([]);
    });

    it('describes a break in words, naming both the thing and what it points at', () => {
        const [hit] = auditContent({ openingTray: ['token_ghost'] })
            .filter(f => f.where === 'The Tokens a new game starts with');
        // Readable by the person authoring content, not a stack trace.
        expect(hit.what).toContain('token_ghost');
        expect(hit.what).toContain('does not exist');
        expect(hit.what).not.toContain('undefined');
    });

    it('treats an empty reference as "not set", not as broken', () => {
        // An unset field is how content says "this Token opens no Map". If
        // these counted, the real findings would drown in hundreds of lines.
        const blank = auditContent({ openingTray: ['', null, undefined] });
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
        // An output pays in an item OR in currency (D-141). A row with neither
        // reads as a real payout in the CMS and produces nothing in game.
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
        expect(() => { findings = reportContentIntegrity({ openingTray: ['token_ghost'] }); })
            .not.toThrow();

        expect(Array.isArray(findings)).toBe(true);
        expect(warn.mock.calls.length + info.mock.calls.length).toBe(1);
    });

    it('survives an opening tray that is not a list at all', () => {
        // The audit runs during boot. Anything it is handed must produce a
        // report line at worst, never an exception.
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(() => reportContentIntegrity({ openingTray: 'not-a-list' })).not.toThrow();
        expect(warn).toHaveBeenCalled();
    });
});
