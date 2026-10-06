import { describe, it, expect } from 'vitest';
import {
    TEMPO_NAMES, TEMPO_BANDS, LEVEL_SCALE_DIVISOR,
    isTempo, levelScale, bandFor, isInBand,
} from '../config/registries/tempoBands.js';

/**
 * The tempo band table (economic simulator rework, plan §13.3).
 */

/** The band a tempo covers, in whole seconds, for readable expectations. */
const secs = (tempo, level) => {
    const b = bandFor(tempo, level);
    return [b.minMs / 1000, b.maxMs / 1000];
};

describe('the tempo vocabulary', () => {
    it('is exactly five names, in band order (Quick added by TL-21)', () => {
        expect(TEMPO_NAMES).toEqual(['quick', 'fast', 'medium', 'slow', 'heavy']);
    });

    it('recognises its own names and nothing else', () => {
        for (const t of TEMPO_NAMES) expect(isTempo(t)).toBe(true);
        expect(isTempo('brisk')).toBe(false);
        expect(isTempo('')).toBe(false);
        expect(isTempo(undefined)).toBe(false);
        expect(isTempo('Fast')).toBe(false);   // case matters, as everywhere else
    });

    it('has a band for every name and a name for every band', () => {
        expect(Object.keys(TEMPO_BANDS).sort()).toEqual([...TEMPO_NAMES].sort());
    });
});

describe('scaling', () => {
    it('is the ruled rule: 1 + (level - 1)/70, exact at level 1', () => {
        // ⚠️ Owner ruling. Plan §13.3 writes the factor as `1 + level/70`
        // but also prints the level-1 bands as round numbers, and those two
        // statements disagree by 1.4%. The printed table wins: a Token
        // authored at a round 12s and tagged Medium must be IN its band, not
        // 171ms outside it. See the note atop `tempoBands.js`.
        expect(LEVEL_SCALE_DIVISOR).toBe(70);
        expect(levelScale(1)).toBe(1);
        expect(levelScale(36)).toBeCloseTo(1.5, 10);
        expect(levelScale(71)).toBeCloseTo(2, 10);
        expect(levelScale(141)).toBeCloseTo(3, 10);
    });

    it('treats a missing or nonsense level as level 1', () => {
        const atOne = levelScale(1);
        expect(levelScale(undefined)).toBe(atOne);
        expect(levelScale(null)).toBe(atOne);
        expect(levelScale(0)).toBe(atOne);
        expect(levelScale(-5)).toBe(atOne);
        expect(levelScale('nonsense')).toBe(atOne);
    });

    it('is monotonic in level for every tempo', () => {
        for (const tempo of TEMPO_NAMES) {
            let prev = bandFor(tempo, 1);
            for (let level = 2; level <= 120; level++) {
                const next = bandFor(tempo, level);
                expect(next.minMs).toBeGreaterThan(prev.minMs);
                expect(next.maxMs).toBeGreaterThan(prev.maxMs);
                prev = next;
            }
        }
    });
});

describe('the bands stay ordered Quick < Fast < Medium < Slow < Heavy', () => {
    // Not just at level 1: a scaling bug that multiplied one row differently
    // would only show up further up the ladder.
    it.each([1, 5, 20, 40, 70, 90, 120])('at level %i', (level) => {
        const bands = TEMPO_NAMES.map((t) => bandFor(t, level));
        for (let i = 1; i < bands.length; i++) {
            expect(bands[i].minMs).toBeGreaterThan(bands[i - 1].minMs);
            expect(bands[i].maxMs).toBeGreaterThan(bands[i - 1].maxMs);
            // Contiguous, all five: each band starts where the one before it
            // ends.
            expect(bands[i].minMs).toBe(bands[i - 1].maxMs);
        }
    });
});

describe('Quick, and Fast widened (owner ruling TL-21, 2026-09-27)', () => {
    it('Quick is 2–4s at level 1, exactly', () => {
        expect(TEMPO_BANDS.quick).toEqual({ minMs: 2000, maxMs: 4000, topIsSoft: false });
        expect(bandFor('quick', 1)).toEqual({ minMs: 2000, maxMs: 4000, topIsSoft: false });
    });

    it('Fast is 4–12s at level 1 (was 8–12s)', () => {
        expect(TEMPO_BANDS.fast).toEqual({ minMs: 4000, maxMs: 12000, topIsSoft: false });
    });

    it('scales both by the same rule as every other band', () => {
        for (const level of [1, 2, 36, 40, 71, 90]) {
            for (const [tempo, lo, hi] of [['quick', 2000, 4000], ['fast', 4000, 12000]]) {
                const b = bandFor(tempo, level);
                expect(b.minMs).toBe(Math.round(lo * levelScale(level)));
                expect(b.maxMs).toBe(Math.round(hi * levelScale(level)));
            }
        }
        expect(secs('quick', 71)).toEqual([4, 8]);   // factor 2 exactly
        expect(secs('fast', 71)).toEqual([8, 24]);
    });

    it('takes the Q9 pacing numbers at level 1: 3s gathering is Quick, 6s and 8s processing are Fast', () => {
        expect(isInBand(3000, 'quick', 1)).toBe(true);
        expect(isInBand(6000, 'fast', 1)).toBe(true);
        expect(isInBand(6000, 'fast', 2)).toBe(true);     // a level-2 recipe (Copper Pickaxe)
        expect(isInBand(8000, 'fast', 1)).toBe(true);
        expect(isInBand(6000, 'quick', 1)).toBe(false);
        expect(isInBand(1999, 'quick', 1)).toBe(false);
    });

    it('Quick has a closed top, like every band but Heavy', () => {
        expect(bandFor('quick', 1).topIsSoft).toBe(false);
        expect(isInBand(600000, 'quick', 1)).toBe(false);
    });
});

describe('isInBand', () => {
    /**
     * ⚠️ **Endpoints are INCLUSIVE at both ends** — pinned here so nobody has to
     * infer it. The bands are contiguous, so a cycle exactly on a shared
     * boundary is in both of the bands that meet there. That is intended:
     * `isInBand` answers "is this a defensible Fast Token?", not "which band
     * owns this number?".
     */
    it.each([1, 40, 90])('includes both endpoints exactly, at level %i', (level) => {
        for (const tempo of TEMPO_NAMES) {
            const { minMs, maxMs, topIsSoft } = bandFor(tempo, level);
            expect(isInBand(minMs, tempo, level)).toBe(true);
            expect(isInBand(maxMs, tempo, level)).toBe(true);
            expect(isInBand(minMs - 1, tempo, level)).toBe(false);
            expect(isInBand(maxMs + 1, tempo, level)).toBe(topIsSoft);
        }
    });

    it('agrees with bandFor across a spread of values', () => {
        for (const tempo of TEMPO_NAMES) {
            for (const level of [1, 12, 40, 90]) {
                const { minMs, maxMs, topIsSoft } = bandFor(tempo, level);
                for (let ms = 1000; ms <= 400000; ms += 997) {
                    const expected = ms >= minMs && (topIsSoft || ms <= maxMs);
                    expect(isInBand(ms, tempo, level)).toBe(expected);
                }
            }
        }
    });

    it('says no to an unknown tempo and to a non-number', () => {
        expect(isInBand(15000, 'brisk', 1)).toBe(false);
        expect(isInBand(15000, undefined, 1)).toBe(false);
        expect(isInBand(NaN, 'medium', 1)).toBe(false);
        expect(isInBand(undefined, 'medium', 1)).toBe(false);
    });

    it('leaves Heavy\'s top open and every other top closed', () => {
        expect(bandFor('heavy', 1).topIsSoft).toBe(true);
        expect(isInBand(600000, 'heavy', 1)).toBe(true);
        for (const tempo of ['quick', 'fast', 'medium', 'slow']) {
            expect(bandFor(tempo, 1).topIsSoft).toBe(false);
            expect(isInBand(600000, tempo, 1)).toBe(false);
        }
    });

    it('has no band for a tempo it does not know', () => {
        expect(bandFor('brisk', 1)).toBeNull();
    });
});

describe('⚠️ the table reproduces plan §13.3\'s printed columns', () => {
    /**
     * §13.3 as printed, in seconds. Quick is not in the plan at all and is
     * pinned in its own block above.
     *
     *   | Tempo | Level 1 | Level 40 | Level 90 |
     *   | Fast | 4–12 | 6–19 | 9–28 | ← floor is, not the plan's
     *   | Medium | 12–20 | 19–31 | 27–46 |
     *   | Slow | 20–30 | 31–47 | 46–69 |
     *   | Heavy | 30–120 | 47–188 | 69–274 |
     */
    const PRINTED = {
        1: { fast: [4, 12], medium: [12, 20], slow: [20, 30], heavy: [30, 120] },
        40: { fast: [6, 19], medium: [19, 31], slow: [31, 47], heavy: [47, 188] },
        90: { fast: [9, 28], medium: [27, 46], slow: [46, 69], heavy: [69, 274] },
    };

    /**
     * How far a computed value may sit from the printed one: one second, or 1.5%
     * for the big numbers, whichever is larger.
     */
    const tolerance = (printed) => Math.max(1, printed * 0.015);

    for (const [level, rows] of Object.entries(PRINTED)) {
        for (const [tempo, [lo, hi]] of Object.entries(rows)) {
            it(`${tempo} at level ${level} is ${lo}–${hi}s`, () => {
                const [gotLo, gotHi] = secs(tempo, Number(level));
                expect(Math.abs(gotLo - lo)).toBeLessThanOrEqual(tolerance(lo));
                expect(Math.abs(gotHi - hi)).toBeLessThanOrEqual(tolerance(hi));
            });
        }
    }

    it('⚠️ is exact at level 1 — a round authored number is in its band', () => {
        // The whole point of the owner's ruling. Every level-1 band edge is
        // the printed second, to the millisecond, so authoring 12000ms and
        // tagging Medium does not produce a spurious out-of-band warning.
        for (const [tempo, [lo, hi]] of Object.entries(PRINTED[1])) {
            const band = bandFor(tempo, 1);
            expect(band.minMs).toBe(lo * 1000);
            expect(band.maxMs).toBe(hi * 1000);
            expect(isInBand(lo * 1000, tempo, 1)).toBe(true);
            expect(isInBand(hi * 1000, tempo, 1)).toBe(true);
        }
    });

    it('gets the level-40 and level-90 columns to within 1.5s', () => {
        // The tight half of the check above, stated as its own assertion so a
        // drift into the tolerance's slack is visible rather than absorbed.
        //
        // ⚠️ 1.5s, not the 0.6s the literal `1 + level/70` achieved. The owner
        // ruled level-1 exactness worth that cost (see `tempoBands.js`), and
        // 1.43s of rounding error on bands tens of seconds wide is the price.
        // Still far tighter than the rejected `(70+level)/71` reading, which
        // misses by 3.58s — so this keeps doing its real job of catching a
        // *wrong mechanism*, not merely a different rounding.
        let worst = 0;
        for (const level of [40, 90]) {
            for (const [tempo, [lo, hi]] of Object.entries(PRINTED[level])) {
                const [gotLo, gotHi] = secs(tempo, level);
                worst = Math.max(worst, Math.abs(gotLo - lo), Math.abs(gotHi - hi));
            }
        }
        expect(worst).toBeLessThanOrEqual(1.5);
    });
});
