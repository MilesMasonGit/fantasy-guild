// CR3-555 — EventBus.publish swallows subscriber errors in production (it
// catches, logs via console.error, and keeps going — that stays unchanged,
// see EventBus.js:67-71). In tests that is dangerous: a fix that moves work
// *into* a subscriber (CR3-157, CR3-102, CR3-305) can throw on every run and
// the suite stays green, because the assertion only checks the outcome, not
// whether every subscriber ran cleanly.
//
// This setup file makes a subscriber throw fail the test that produced it,
// test-environment only. Production behaviour is untouched.
//
// Counted 2026-10-01 against the full suite on a clean baseline (1 known
// failure / 3984 passed / 27 skipped, src/tests/AssetManager.test.js's sprite
// check): **zero** subscriber errors were produced by any test. The
// allow-list below is therefore empty — add an entry only for a specific
// test, with the owner's go-ahead and a one-line reason.
import { afterEach, beforeEach } from 'vitest';

/**
 * Tests allowed to make a subscriber throw without failing.
 * @type {{ test: string, event: string, reason: string }[]}
 */
const ALLOWED = [
    // none today — see the count above.
];

let currentTestName = '';
/** @type {{ event: string, message: string }[]} */
let caughtThisTest = [];

beforeEach((ctx) => {
    currentTestName = ctx?.task?.name ?? '';
    caughtThisTest = [];
});

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
    const message = String(args[0] ?? '');
    const match = message.match(/^EventBus: Error in subscriber for "([^"]+)"/);
    if (match) {
        caughtThisTest.push({ event: match[1], message });
    }
    originalConsoleError(...args);
};

afterEach(() => {
    if (caughtThisTest.length === 0) return;

    const unapproved = caughtThisTest.filter(
        (c) => !ALLOWED.some((a) => a.test === currentTestName && a.event === c.event)
    );
    if (unapproved.length === 0) return;

    const details = unapproved.map((c) => `  - ${c.message}`).join('\n');
    throw new Error(
        `CR3-555: an EventBus subscriber threw during "${currentTestName}". ` +
        `Production logs and continues, but a test must not pass while this ` +
        `happens silently. If this is expected, add a named entry to ALLOWED ` +
        `in src/tests/setup/eventBusErrors.js with a one-line reason.\n${details}`
    );
});
