import { describe, it, expect } from 'vitest';
import {
    formatCompact, parseNotation, MAX_EXACT_INTEGER, isBeyondExactRange
} from '../utils/Formatters.js';
import { DEFAULT_MAX_STACK } from '../config/registries/itemRegistry.js';

// Locks C-15's big-number handling (watch item W-7). Economic values are
// authored and tuned freely (D-71), so the display and storage layers must
// cope with whatever the designer writes rather than assuming a range.

describe('formatCompact — the suffix ladder', () => {
    it('leaves small numbers alone', () => {
        expect(formatCompact(0)).toBe('0');
        expect(formatCompact(999)).toBe('999');
    });

    it('covers the familiar rungs', () => {
        expect(formatCompact(1_500)).toBe('1.5k');
        expect(formatCompact(2_400_000)).toBe('2.4m');
        expect(formatCompact(7_000_000_000)).toBe('7b');
        expect(formatCompact(1.2e12)).toBe('1.2t');
    });

    it('keeps going past a trillion', () => {
        // The old ladder stopped at 't' and printed raw digits above it — a
        // 16-digit wall of numbers in the UI.
        expect(formatCompact(3.4e15)).toBe('3.4qa');
        expect(formatCompact(5e18)).toBe('5qi');
        expect(formatCompact(1.1e21)).toBe('1.1sx');
        expect(formatCompact(9e33)).toBe('9dc');
    });

    it('falls back to exponential rather than printing 40 digits', () => {
        expect(formatCompact(5e40)).toMatch(/e\+?40/);
    });

    it('handles negatives and infinities without crashing', () => {
        expect(formatCompact(-2500)).toBe('-2.5k');
        expect(formatCompact(Infinity)).toBe('0');
        expect(formatCompact(NaN)).toBe('0');
    });
});

describe('parseNotation — round-trips the ladder', () => {
    it('reads every suffix formatCompact can write', () => {
        expect(parseNotation('1.5k')).toBe(1_500);
        expect(parseNotation('2m')).toBe(2e6);
        expect(parseNotation('3b')).toBe(3e9);
        expect(parseNotation('4t')).toBe(4e12);
        expect(parseNotation('5qa')).toBe(5e15);
        expect(parseNotation('6qi')).toBe(6e18);
        expect(parseNotation('7sx')).toBe(7e21);
        expect(parseNotation('9dc')).toBe(9e33);
    });

    it('does not mistake a two-letter suffix for a one-letter one', () => {
        // The regex must try 'qa' before 'k|m|b|t' or this silently misreads.
        expect(parseNotation('1qa')).toBe(1e15);
        expect(parseNotation('1qi')).toBe(1e18);
    });

    it('passes plain numbers straight through', () => {
        expect(parseNotation(42)).toBe(42);
        expect(parseNotation('42')).toBe(42);
        expect(parseNotation('')).toBe(0);
    });
});

describe('Precision ceiling (W-7)', () => {
    it('knows where JavaScript stops counting exactly', () => {
        expect(MAX_EXACT_INTEGER).toBe(Number.MAX_SAFE_INTEGER);
        expect(isBeyondExactRange(1e15)).toBe(false);
        expect(isBeyondExactRange(1e17)).toBe(true);
    });

    it('demonstrates the failure it guards against', () => {
        // Past the ceiling, adding 1 does nothing — no error, just a wrong
        // total. This is why the constant exists to be checked against.
        const beyond = MAX_EXACT_INTEGER + 2;
        expect(beyond + 1 === beyond).toBe(true);
        expect(isBeyondExactRange(beyond)).toBe(true);
    });

    it('keeps the stack ceiling well inside the exact range', () => {
        // Room for the sums and multiplications layered on top of a full stack.
        expect(DEFAULT_MAX_STACK).toBeGreaterThan(1e9);
        expect(DEFAULT_MAX_STACK * 1000).toBeLessThan(MAX_EXACT_INTEGER);
    });
});
