import { describe, it, expect } from 'vitest';
import { elapsedText } from '../utils/Formatters.js';

// The saved playtime is the game clock's tick deltas summed: milliseconds.
describe('the slot card reads playtime from milliseconds', () => {
    it('76 seconds of play reads 1m 16s, not 21h 6m', () => {
        expect(elapsedText(76_000)).toBe('1m 16s');
    });
    it('under a minute reads its seconds, rounded down; a missing value reads 0s', () => {
        expect(elapsedText(59_900)).toBe('59s');
        expect(elapsedText(undefined)).toBe('0s');
    });
    it('two hours and five minutes reads 2h 5m', () => {
        expect(elapsedText((2 * 3600 + 5 * 60) * 1000)).toBe('2h 5m');
    });
});
