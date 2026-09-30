import { describe, it, expect } from 'vitest';
import { importClosure } from './fixtures/sourceScan.js';

/**
 * ⭐ The content-grammar modules stay pure (CR3-510, R9 section 5.5).
 *
 * These files live under `systems/`, but they are really a shared
 * content-model layer: the CMS (`cms/src`) imports each of them directly, and
 * `src/config/` builds on them. Today none of them reaches game state, the
 * event bus, an engine manager or React. If one ever did, opening the CMS
 * would quietly start booting engine state, and config would grow a hidden
 * engine dependency. `FreeMatGuards.test.js` guards the grid the same way.
 *
 * The rule is on the whole IMPORT CLOSURE (everything each one loads, through
 * any chain of imports), not just its own import lines.
 */

const CONTENT_GRAMMAR = [
    'systems/effects/statements.js',
    'systems/effects/effectLibrary.js',
    'systems/effects/effectMigration.js',
    'systems/effects/statementText.js',
    'systems/effects/statementSlots.js',
    'systems/effects/constants.js',
    'systems/core/lifecycleAudit.js',
    'systems/core/workSkillRule.js'
];

/** What a pure content module must never load, and why. */
const FORBIDDEN = [
    [/^state\//, 'game state'],
    [/^systems\/core\/EventBus\.js$/, 'the event bus'],
    [/^systems\/.*Manager\.js$/, 'an engine manager'],
    [/\.jsx$/, 'React UI']
];

describe('the CMS-loaded content-grammar modules stay pure (CR3-510)', () => {
    it('every listed module exists and the closure walk finds its imports', () => {
        for (const file of CONTENT_GRAMMAR) {
            const closure = importClosure(file);
            expect(closure.has(file), `${file} not found`).toBe(true);
        }
        // statementText renders statements, so it must at least reach statements.js.
        expect(importClosure('systems/effects/statementText.js').has('systems/effects/statements.js')).toBe(true);
    });

    for (const file of CONTENT_GRAMMAR) {
        it(`${file} reaches no game state, event bus, manager or React`, () => {
            const bad = [];
            for (const dep of importClosure(file)) {
                for (const [pattern, why] of FORBIDDEN) {
                    if (pattern.test(dep)) bad.push(`${dep} (${why})`);
                }
            }
            expect(bad).toEqual([]);
        });
    }
});
