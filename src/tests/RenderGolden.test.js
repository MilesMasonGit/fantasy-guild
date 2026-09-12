import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import './fixtures/testTokens.js';
import { buildCorpus } from './fixtures/renderCorpus.js';

/**
 * ⭐ **Every rules sentence the game can print, pinned byte for byte** (Rules
 * Line P1).
 *
 * P1 teaches `renderStatement` to return *segments* — which word came from which
 * decision — so the editor can make those words clickable. That touches every
 * branch of a 700-line file which prints every rule in the game: the Token
 * inspector, the Guild Hall panel, the CMS, `description` fields.
 *
 * ⚠️ **A refactor that drops a comma changes rules text everywhere and nothing
 * else would fail.** That is why this file was written and its golden captured
 * BEFORE the refactor, from the renderer as it stood. The golden is the old
 * renderer's output; the test asserts the new one agrees with it exactly.
 *
 * Proven to bite before it was trusted: changing the rule/tag separator from a
 * colon to a semicolon — one character — turned 344 sentences red.
 *
 * The corpus itself lives in `fixtures/renderCorpus.js`, shared with the segment
 * test, so the two can never be protecting different sentences.
 *
 * ## Regenerating
 * ONLY when a wording change is intended:
 *
 *     UPDATE_RENDER_GOLDEN=1 npx vitest run src/tests/RenderGolden.test.js
 *
 * and read the diff of `renderGolden.json` before committing it. The diff IS
 * the review of what every player will see change.
 */

const GOLDEN_PATH = path.join(__dirname, 'fixtures', 'renderGolden.json');
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
