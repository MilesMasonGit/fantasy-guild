import { describe, it, expect } from 'vitest';
import { countdownText, elapsedText, lengthText } from '../utils/Formatters.js';

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

// One row per case in the owner's rule (docs/active/audit/topic_time_display.md, "The rule").
describe('a live countdown: whole seconds rounded up, zero parts kept', () => {
    it.each([
        ['34s', 34 * S],
        ['34s', 33.2 * S],
        ['1s', 1],
        ['1s', 0.4 * S],
        ['0s', 0],
        ['0s', -5],
        ['0s', null],
        ['59s', 59 * S],
        ['1m 0s', 59.2 * S],
        ['4m 57s', 4 * M + 56.1 * S],
        ['5m 0s', 5 * M],
        ['4m 59s', 4 * M + 59 * S],
        ['59m 59s', H - S],
        ['1h 0m', H - 0.5 * S],
        ['1h 0m', H],
        ['1h 15m', H + 15 * M],
        ['1h 15m', H + 14 * M + 1 * S],
        ['23h 59m', D - M],
        ['1d 0h', D - 30 * S],
        ['1d 0h', D],
        ['1d 4h', D + 3 * H + 10 * M],
        ['3d 7h', 3 * D + 7 * H]
    ])('reads %s', (text, ms) => {
        expect(countdownText(ms)).toBe(text);
    });
});

describe('a fixed length: one decimal under a minute, zero parts dropped', () => {
    it.each([
        ['2.5s', 2.5 * S],
        ['4s', 4 * S],
        ['4s', 4.04 * S],
        ['10.8s', 10.8 * S],
        ['2.4s', 2.4 * S],
        ['0.5s', 500],
        ['0s', 0],
        ['59.9s', 59.9 * S],
        ['1m', 59.96 * S],
        ['1m 5s', 65 * S],
        ['8m', 8 * M],
        ['10m', 10 * M],
        ['1h', H],
        ['1h 15m', H + 15 * M],
        ['1h', H + 20 * S],
        ['1d 0h', D],
        ['3d 7h', 3 * D + 7 * H]
    ])('reads %s', (text, ms) => {
        expect(lengthText(ms)).toBe(text);
    });

    it('reads like the timer it starts: grows for 8m, then 8m 0s ticking', () => {
        expect(lengthText(8 * M)).toBe('8m');
        expect(countdownText(8 * M)).toBe('8m 0s');
    });
});

describe('counting up: rounded down like a stopwatch', () => {
    it.each([
        ['12s', 12.9 * S],
        ['0s', 0.9 * S],
        ['42s', 42 * S],
        ['59s', 59.99 * S],
        ['1m 0s', M],
        ['1m 5s', 65.7 * S],
        ['59m 59s', H - 1],
        ['2h 5m', 2 * H + 5 * M + 59 * S],
        ['1h 0m', H],
        ['23h 59m', D - 1],
        ['1d 0h', D],
        ['1d 4h', D + 4 * H + 59 * M]
    ])('reads %s', (text, ms) => {
        expect(elapsedText(ms)).toBe(text);
    });
});

describe('no clock is left in player text', () => {
    it('no writer ever writes m:ss', () => {
        const samples = [0, 999, 34 * S, 4 * M + 57 * S, 75 * M, H + 4 * M + 5 * S, 2 * D];
        for (const ms of samples) {
            for (const write of [countdownText, elapsedText, lengthText]) expect(write(ms)).not.toMatch(/\d:\d/);
        }
    });
});
