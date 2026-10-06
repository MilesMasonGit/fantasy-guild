import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import './fixtures/testTokens.js';
import { buildCorpus } from './fixtures/renderCorpus.js';

/**
 * ⭐ **Every rules sentence the game can print, pinned byte for byte** (Rules
 * Line P1).
 *
 * ⚠️ **A refactor that drops a comma changes rules text everywhere and nothing
 * else would fail.** That is why this file was written and its golden captured
 * BEFORE the refactor, from the renderer as it stood. The golden is the old
 * renderer's output; the test asserts the new one agrees with it exactly.
 */

// The house pattern for a test's own directory (see CMSBoundary, DeadEventWiring).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = path.join(HERE, 'fixtures', 'renderGolden.json');
const UPDATE = !!process.env.UPDATE_RENDER_GOLDEN;

/** Render the whole corpus. A throw is part of the behaviour, so it is pinned too. */
function renderCorpus() {
    const out = {};
    for (const { key, render } of buildCorpus()) {
        if (key in out) throw new Error(`duplicate golden key: ${key}`);
        try {
            out[key] = render();
        } catch (err) {
            out[key] = `THROWS: ${err?.message || err}`;
        }
    }
    return out;
}

describe('⭐ rules text is byte-identical to the renderer before P1', () => {
    const actual = renderCorpus();

    if (UPDATE) {
        it('writes a new golden (UPDATE_RENDER_GOLDEN is set)', () => {
            const sorted = Object.fromEntries(Object.keys(actual).sort().map(k => [k, actual[k]]));
            fs.writeFileSync(GOLDEN_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
            expect(Object.keys(sorted).length).toBeGreaterThan(0);
        });
        return;
    }

    const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));

    it('covers a corpus large enough to mean something', () => {
        expect(Object.keys(golden).length).toBeGreaterThan(500);
    });

    it('⚠️ has exactly the same cases as the golden — none added, none lost', () => {
        // A case silently dropping out of the corpus is a sentence that stopped
        // being protected, which is how a guarantee rots without failing.
        expect(Object.keys(actual).sort()).toEqual(Object.keys(golden).sort());
    });

    it('⭐ renders every case exactly as the golden says', () => {
        const drift = Object.keys(golden)
            .filter(k => actual[k] !== golden[k])
            .map(k => `${k}\n    was: ${golden[k]}\n    now: ${actual[k]}`);
        expect(drift, `${drift.length} sentence(s) changed:\n${drift.slice(0, 15).join('\n')}`).toEqual([]);
    });
});
