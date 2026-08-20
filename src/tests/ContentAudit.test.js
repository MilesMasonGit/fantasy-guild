import { describe, it, expect, vi, afterEach } from 'vitest';
import { auditContent, reportContentIntegrity } from '../systems/core/ContentAudit.js';

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
 */
describe('The content-integrity audit', () => {
    afterEach(() => vi.restoreAllMocks());

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

    it('finds the nameless placeholder entry in the item list', () => {
        // CR2-184 — `data/items.json` carries an entry with an id of literally
        // "item" and every field blank. It reads as a real item everywhere.
        const findings = auditContent();
        expect(findings.some(f => f.where === 'Item "item"')).toBe(true);
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
