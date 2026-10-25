import { describe, it, expect } from 'vitest';
import { listFiles, readSource, rel, setScanTimeout } from './fixtures/sourceScan.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS, UI_EVENTS, ORPHAN_EVENTS, NO_LISTENER } from '../systems/core/engineEvents.js';

/**
 * every global event is declared in `engineEvents.js` and named by its
 * constant — "sent to nobody" is a written decision, not drift.
 */

// The publisher and listener cases run dozens of regexes over all the code: seconds alone.
setScanTimeout();

function codeOf(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const REGISTRY = 'core/engineEvents.js';
const FILES = listFiles(undefined, { ext: /\.(js|jsx|mjs)$/ })
    .filter(f => !f.endsWith(REGISTRY))
    .map(f => ({ rel: rel(f), code: codeOf(readSource(f)) }));
const ALL_CODE = FILES.map(f => f.code).join('\n');

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const GROUPS = { ENGINE_EVENTS, UI_EVENTS, ORPHAN_EVENTS };
const DECLARED = Object.entries(GROUPS).flatMap(([group, obj]) =>
    Object.entries(obj).map(([key, name]) => ({ group, key, name, ref: `${group}.${key}` })));

const tokenCache = new Map();

/** The constant plus any local alias (`const X = UI_EVENTS.Y` / `KEY: UI_EVENTS.Y`). */
function tokensFor(ref) {
    if (tokenCache.has(ref)) return tokenCache.get(ref);
    const out = [escape(ref)];
    // `(?<!\w)` finds the same aliases (a match can only start where a word starts) without
    // retrying from every letter of every word, which made this scan take seconds.
    const re = new RegExp(`(?<!\\w)(\\w+)\\s*[:=]\\s*${escape(ref)}\\b`, 'g');
    for (const m of ALL_CODE.matchAll(re)) out.push(`\\b${m[1]}`);
    tokenCache.set(ref, out);
    return out;
}

function isPublished(ref) {
    return tokensFor(ref).some(t => new RegExp(`\\.publish\\(\\s*[\\w.]*?${t}\\b`).test(ALL_CODE));
}

function isListened(ref) {
    return tokensFor(ref).some(t =>
        new RegExp(`\\.subscribe\\(\\s*[\\w.]*?${t}\\b`).test(ALL_CODE)
        || new RegExp(`useTokenEvent\\(\\s*[\\w.]*?${t}\\b`).test(ALL_CODE)
        || new RegExp(`\\[[^\\]]*${t}\\b[^\\]]*\\]`).test(ALL_CODE)
        || new RegExp(`event:\\s*${t}\\b`).test(ALL_CODE));
}

describe('global events are declared and named by constant (CR3-559)', () => {
    it('scans the source', () => {
        expect(FILES.length).toBeGreaterThan(200);
        expect(DECLARED.length).toBeGreaterThan(50);
    });

    it('no event is published or subscribed by raw string', () => {
        const hits = [];
        for (const { rel, code } of FILES) {
            if (rel === 'systems/core/EventBus.js') continue;
            for (const m of code.matchAll(/\.(publish|subscribe|unsubscribe)\(\s*(['"`])[^'"`]*\2/g)) hits.push(`${rel}: ${m[0]}`);
        }
        expect(hits).toEqual([]);
    });

    it('every name is declared once, and none collides with a board event', () => {
        const names = DECLARED.map(d => d.name);
        expect(new Set(names).size).toBe(names.length);
        const board = new Set(Object.values(BOARD_EVENTS));
        expect(names.filter(n => board.has(n))).toEqual([]);
    });

    it('no declared name is listed raw in an event array', () => {
        const hits = [];
        for (const { name } of DECLARED) {
            const q = `['"\`]${escape(name)}['"\`]`;
            const re = new RegExp(`\\[[^\\]]*${q}[^\\]]*\\]`);
            for (const { rel, code } of FILES) {
                // Quest target types reuse some event names as a different vocabulary.
                const prose = code.replace(/targetType:\s*(['"`])[^'"`]*\1/g, '');
                if (re.test(prose)) hits.push(`${rel}: ${name}`);
            }
        }
        expect(hits).toEqual([]);
    });

    it('every engine and UI event has a publisher', () => {
        const missing = DECLARED.filter(d => d.group !== 'ORPHAN_EVENTS' && !isPublished(d.ref)).map(d => d.ref);
        expect(missing).toEqual([]);
    });

    it('ORPHAN_EVENTS have no publisher (the list may only shrink)', () => {
        const published = DECLARED.filter(d => d.group === 'ORPHAN_EVENTS' && isPublished(d.ref)).map(d => d.ref);
        expect(published).toEqual([]);
    });

    it('CR3-107: an engine event with no listener is a written decision', () => {
        const unlistened = DECLARED.filter(d => d.group === 'ENGINE_EVENTS' && !isListened(d.ref)).map(d => d.name).sort();
        expect(unlistened).toEqual(Object.keys(NO_LISTENER).sort());
    });

    it('every UI event has a listener', () => {
        const unlistened = DECLARED.filter(d => d.group === 'UI_EVENTS' && !isListened(d.ref)).map(d => d.ref);
        expect(unlistened).toEqual([]);
    });
});
