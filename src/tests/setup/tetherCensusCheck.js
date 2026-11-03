// `SpawnerSystem` keeps what each enemy camp spawned as a count in its census, rebuilt only when
// a Token joins or leaves the mat or a tether is written. A way of changing a tether that the census
// did not hear of would leave a camp counting wrong, and it would show only as a camp that spawns one
// too many, some time later. So, under the test suite, every count is compared with a walk of the
// mat, and any test that saw a difference fails, whatever it was testing. A plain throw would not do:
// `GameLoop.runHandlers` and `EventBus.publish` both catch and log.
import { afterEach, beforeEach } from 'vitest';

let mismatches = [];

beforeEach(() => {
    mismatches = [];
});

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
    const message = String(args[0] ?? '');
    if (message.startsWith('Tether census out of step')) mismatches.push(message);
    originalConsoleError(...args);
};

afterEach(() => {
    if (mismatches.length === 0) return;
    const shown = mismatches.slice(0, 5).map((m) => `  - ${m}`).join('\n');
    throw new Error(
        `The tether census differed from a walk of the mat ${mismatches.length} time(s). Write every ` +
        `tether with BoardState.setTether.\n${shown}`
    );
});
