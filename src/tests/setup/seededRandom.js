// Fantasy Guild — test setup: every test draws the same random numbers on every run.
//
// The game calls `Math.random()` directly, so any test that runs a fight, a
// stroll or a chance output depends on luck unless it is seeded. This file
// swaps in the bench's generator (mulberry32, `bench/lib/prelude.mjs`) and
// rewinds it before each test, seeded from a hash of the test's file and full
// name, so adding or reordering tests never shifts another test's numbers.
//
// ⚠️ The generator is ONE function object that never changes, installed
// before any game module loads. `EnemyMotion` and `HeroMotion` copy
// `Math.random` when they load, so they hold this same function and the
// rewind reaches them too. This file must not import game modules (a setup
// file that does so loads them before the test's `vi.mock` calls, which then
// fail to apply), which is why it does not call their `setRandomForTests`.
//
// A test that seeds by hand (assigning `Math.random`, `vi.spyOn(Math,
// 'random')`, `setRandomForTests(fn)`) overrides this for its own run; its
// restore puts this generator back, since that is the `Math.random` it saw.
import { beforeEach } from 'vitest';

let state = 1;

function seeded() {
    state = (state + 0x6D2B79F5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** FNV-1a, 32-bit: a stable seed from a name. */
function hashName(text) {
    let h = 0x811C9DC5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h | 0) || 1;
}

function reseed(seed) {
    state = seed;
}

/** `file > describe > … > test`, from a vitest task. */
function fullName(task) {
    const parts = [];
    for (let t = task; t; t = t.suite) {
        if (t.name) parts.unshift(t.name);
    }
    if (task?.file?.name) parts.unshift(task.file.name);
    return parts.join(' > ');
}

// Installed once per test file (this runs before the file loads), which also
// replaces anything a previous file in this worker left behind. Module-load
// and beforeAll draws happen before any test; a fixed seed keeps them the
// same on every run too.
Math.random = seeded;
reseed(1);

// ⚠️ Only rewinds, never reinstalls: a file that swaps in its own generator
// in `beforeAll` must keep it for all its tests.
// `FG_TEST_SEED=<anything> npx vitest run` shifts every test's numbers: a test
// that fails under some other seed is relying on luck.
const salt = typeof process !== 'undefined' && process.env?.FG_TEST_SEED
    ? `#${process.env.FG_TEST_SEED}` : '';

beforeEach((ctx) => {
    reseed(hashName(fullName(ctx.task) + salt));
});
