import { describe, it, expect } from 'vitest';
import { sourceCode, matchLines } from './fixtures/sourceScan.js';

/**
 * ⭐ Flags is the one place heroes choose work (R10 section 5.1).
 */

/** Who may call what: `[pattern, allowed files, what it is]`. */
const RULES = [
    [/\bsetClaim\s*\(/g, ['systems/board/Flags.js', 'systems/board/BoardState.js'], 'writes a claim'],
    [/\bforgetWorkClaim\s*\(/g, ['systems/board/Flags.js', 'systems/board/BoardState.js'], 'drops a saved work note'],
    [/\brecordWorkClaim\s*\(/g, ['systems/board/HeroMotion.js', 'systems/board/BoardState.js'], 'records an arrival'],
    [
        /\bHeroMotion\s*\.\s*(restoreAtWork|placeAtFlag|enter|sendHome|settle|remove)\s*\(/g,
        ['systems/board/Flags.js'],
        'runs a HeroMotion lifecycle step'
    ]
];

/** HeroMotion's lifecycle, as named imports would spell it. */
const LIFECYCLE = new Set(['restoreAtWork', 'placeAtFlag', 'enter', 'sendHome', 'settle', 'remove']);
const NAMED_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*\/(HeroMotion|BoardState)(\.js)?['"]/g;

describe('Flags is the only writer of claims and the only driver of HeroMotion (CR3-562)', () => {
    const files = sourceCode();

    it('scans the game source, and finds today\'s legitimate callers', () => {
        const flags = files.find(f => f.file === 'systems/board/Flags.js');
        expect(flags).toBeDefined();
        expect(matchLines(flags.code, RULES[0][0]).length).toBeGreaterThan(0);
        expect(matchLines(flags.code, RULES[3][0]).length).toBeGreaterThan(0);
    });

    for (const [pattern, allowed, what] of RULES) {
        it(`only ${allowed.join(' / ')} ${what}`, () => {
            const offenders = [];
            for (const { file, code } of files) {
                if (allowed.includes(file)) continue;
                for (const line of matchLines(code, pattern)) offenders.push(`${file}:${line}`);
            }
            expect(offenders).toEqual([]);
        });
    }

    it('no file imports a claim writer or a lifecycle step by name (which would dodge the checks above)', () => {
        const offenders = [];
        for (const { file, code } of files) {
            for (const m of code.matchAll(NAMED_IMPORT)) {
                const names = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
                const bad = m[2] === 'HeroMotion'
                    ? names.filter(n => LIFECYCLE.has(n))
                    : names.filter(n => ['setClaim', 'forgetWorkClaim', 'recordWorkClaim'].includes(n));
                if (bad.length) offenders.push(`${file}: ${bad.join(', ')}`);
            }
        }
        expect(offenders).toEqual([]);
    });
});
