import { describe, it, expect } from 'vitest';

/**
 * Guards `src/tests/setup/seededRandom.js`: every test starts its `Math.random` from a seed
 * of its own file and full name, so its draws are the same on every run.
 */

/** The setup's generator and name hash, written out again so the guard does not trust it. */
function expectedDraws(name, count) {
    if (process.env.FG_TEST_SEED) name += `#${process.env.FG_TEST_SEED}`;
    let h = 0x811C9DC5;
    for (let i = 0; i < name.length; i++) {
        h ^= name.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    let state = (h | 0) || 1;
    const out = [];
    for (let i = 0; i < count; i++) {
        state = (state + 0x6D2B79F5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        out.push(((t ^ (t >>> 14)) >>> 0) / 4294967296);
    }
    return out;
}

describe('seeded Math.random', () => {
    it('starts each test from its own name', ({ task }) => {
        const name = `${task.file.name} > seeded Math.random > starts each test from its own name`;
        const drawn = [Math.random(), Math.random(), Math.random()];
        expect(drawn).toEqual(expectedDraws(name, 3));
    });

    it('rewinds before the next test, whatever the last one drew', ({ task }) => {
        const name = `${task.file.name} > seeded Math.random > rewinds before the next test, whatever the last one drew`;
        expect(Math.random()).toBe(expectedDraws(name, 1)[0]);
    });
});
