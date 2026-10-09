import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { sourceFiles, rel, matchLines } from './fixtures/sourceScan.js';

/**
 * The Time Bank is retired: time away is caught up (`CatchUp`), never banked and replayed by
 * speeding up the live engine. Nothing under src/ may import it or name it, in code or in a
 * comment, so a stale description of it cannot creep back. Scanned as raw text, comments included.
 */
const PATTERNS = [
    /time[ _-]?bank/gi,         // TimeBankManager, TIME_BANK, time_bank, timeBankMs, "the time bank"
    /time[ _-]?scal/gi          // TimeManager.timeScale, setTimeScale, "time-scaled delta"
];

function hits() {
    const out = [];
    for (const file of sourceFiles()) {
        const text = fs.readFileSync(file, 'utf8');
        for (const pattern of PATTERNS) {
            for (const line of matchLines(text, pattern)) out.push(`${rel(file)}:${line} ${pattern.source}`);
        }
    }
    return out;
}

describe('the Time Bank is retired', () => {
    it('no module under src/ imports or names the Time Bank or the time scale', () => {
        expect(hits()).toEqual([]);
    });
});
