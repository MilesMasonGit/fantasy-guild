import { describe, it, expect } from 'vitest';
import { sourceCode, matchLines } from './fixtures/sourceScan.js';

/**
 * ⭐ Only `BoardState.js` writes the mat's Token map (R2 section 3.5).
 */

const OWNER = 'systems/board/BoardState.js';

/** `….tokens[…] = …` (not `==`), and `delete ….tokens[…]`. */
const WRITES = [
    /\.tokens\s*\[[^\]]*\]\s*=(?!=)/g,
    /\bdelete\s+[\w$.?[\]]*\.tokens\s*\[/g,
    /Object\.assign\(\s*[\w$.]*\.tokens\s*,/g
];

describe('only BoardState writes board.tokens (CR3-001 write-path guard)', () => {
    const files = sourceCode();

    it('scans the game source (a guard that reads nothing proves nothing)', () => {
        expect(files.length).toBeGreaterThan(100);
        const owner = files.find(f => f.file === OWNER);
        expect(owner, 'BoardState.js not found').toBeDefined();
        // The owner's own writes are what the patterns look like, so they must match there.
        const ownWrites = WRITES.flatMap(re => matchLines(owner.code, re));
        expect(ownWrites.length).toBeGreaterThanOrEqual(3);
    });

    it('no other game file adds to or deletes from a Token map directly', () => {
        const offenders = [];
        for (const { file, code } of files) {
            if (file === OWNER) continue;
            for (const re of WRITES) {
                for (const line of matchLines(code, re)) offenders.push(`${file}:${line}`);
            }
        }
        expect(offenders, 'write through BoardState.addToken / removeToken instead').toEqual([]);
    });
});
