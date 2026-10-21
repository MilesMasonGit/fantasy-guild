import { describe, it, expect } from 'vitest';
import { formatPlaytime } from '../ui/modals/SlotSelectionModal.jsx';

// The saved playtime is the game clock's tick deltas summed: milliseconds.
describe('the slot card reads playtime from milliseconds', () => {
    it('76 seconds of play reads 1m, not 21h 6m', () => {
        expect(formatPlaytime(76_000)).toBe('1m');
    });
    it('under a minute, and a missing value, read < 1 min', () => {
        expect(formatPlaytime(59_000)).toBe('< 1 min');
        expect(formatPlaytime(undefined)).toBe('< 1 min');
    });
    it('two hours and five minutes reads 2h 5m', () => {
        expect(formatPlaytime((2 * 3600 + 5 * 60) * 1000)).toBe('2h 5m');
    });
});
