// @vitest-environment node
// Judging the slowdown Chrome delivered, shared by the throttled benches (bench/browser/slowdown.mjs).
import { describe, it, expect } from 'vitest';
import { parseSlowdownTarget, slowdownsOff, slowdownReject, slowdownNote } from '../../bench/browser/slowdown.mjs';
import { parseArgs } from '../../bench/browser/dragLib.mjs';

describe('the delivered slowdown', () => {
    it('is judged within 25 % of the target, not of the rate asked', () => {
        expect(slowdownsOff([4.1, 5], 4)).toEqual([]);
        expect(slowdownsOff([4.1, 5.2], 4)).toEqual([5.2]);
        expect(slowdownReject([5.2], 4)).toBe('Chrome delivered a 5.2× slowdown, not the 4× asked');
        // Asked 3.2×, delivered 4.1×: a keeper when 4× is what is wanted.
        expect(slowdownReject([4.1], 4)).toBeNull();
        expect(slowdownReject([4.1], 3.2)).not.toBeNull();
    });

    it('has nothing to judge at 1× or with no reading', () => {
        expect(slowdownsOff([9], 1)).toEqual([]);
        expect(slowdownsOff(null, 4)).toEqual([]);
        expect(slowdownNote([9], 1)).toBe('');
        expect(slowdownNote(null, 4)).toBe('');
    });

    it('prints what Chrome delivered, with a warning when off', () => {
        expect(slowdownNote([4.24, 4.61], 4)).toBe(', slowdown 4.24× → 4.61×');
        expect(slowdownNote([4.24, 6], 4)).toBe(', slowdown 4.24× → 6× ⚠ not the 4× asked');
        expect(slowdownNote([null], 4)).toBe(', slowdown ?');
    });

    it('takes a rate and refuses nonsense', () => {
        expect(parseSlowdownTarget('4')).toBe(4);
        expect(() => parseSlowdownTarget('fast')).toThrow(/--slowdown-target/);
        expect(() => parseSlowdownTarget('0')).toThrow(/--slowdown-target/);
    });
});

describe('the drag bench', () => {
    it('takes --slowdown-target', () => {
        expect(parseArgs([]).slowdownTarget).toBeNull();
        expect(parseArgs(['--cpu=3.2', '--slowdown-target=4'])).toMatchObject({ cpu: 3.2, slowdownTarget: 4 });
        expect(() => parseArgs(['--slowdown-target=x'])).toThrow(/--slowdown-target/);
    });
});
