import { describe, it, expect } from 'vitest';
import { sourceCode } from './fixtures/sourceScan.js';

/**
 * During a catch-up the bus skips listeners tagged `UI_LISTENER`; an untagged listener under
 * `src/ui` would keep drawing through 24 hours of game played in seconds. So every subscription
 * the UI makes passes the tag as its third argument.
 */

/** The text of each `EventBus.subscribe(...)` call's arguments, split at the top level. */
function subscribeCalls(code) {
    const calls = [];
    const re = /\bEventBus\.subscribe\(/g;
    for (const m of code.matchAll(re)) {
        let depth = 0;
        let quote = null;
        let arg = '';
        const args = [];
        for (let i = m.index + m[0].length; i < code.length; i++) {
            const ch = code[i];
            if (quote) {
                arg += ch;
                if (ch === '\\') { arg += code[++i]; continue; }
                if (ch === quote) quote = null;
                continue;
            }
            if (ch === '\'' || ch === '"' || ch === '`') { quote = ch; arg += ch; continue; }
            if ('([{'.includes(ch)) depth++;
            if (')]}'.includes(ch)) {
                if (depth === 0) { args.push(arg.trim()); break; }
                depth--;
            }
            if (ch === ',' && depth === 0) { args.push(arg.trim()); arg = ''; continue; }
            arg += ch;
        }
        calls.push(args.filter(a => a !== ''));
    }
    return calls;
}

describe('the UI\'s listeners are tagged', () => {
    const files = sourceCode().filter(({ file }) => file.startsWith('ui/'));

    it('finds the UI\'s subscriptions', () => {
        const total = files.reduce((n, { code }) => n + subscribeCalls(code).length, 0);
        expect(total).toBeGreaterThan(50);
    });

    it('every subscribe under src/ui is tagged', () => {
        const untagged = [];
        for (const { file, code } of files) {
            for (const args of subscribeCalls(code)) {
                if (args.length !== 3 || args[2] !== 'UI_LISTENER') untagged.push(`${file}: subscribe(${args[0]}, …)`);
            }
        }
        expect(untagged).toEqual([]);
    });
});
