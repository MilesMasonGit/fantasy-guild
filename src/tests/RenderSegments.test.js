import { describe, it, expect } from 'vitest';
import './fixtures/testTokens.js';
import { buildCorpus } from './fixtures/renderCorpus.js';
import { renderSegments, renderStatement } from '../systems/effects/statementText.js';
import { slotsOf } from '../systems/effects/statementSlots.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';

/**
 * ⭐ **Which word came from which decision** (Rules Line P1, E-2).
 *
 * `renderSegments` is the renderer's own output, annotated: each run of text
 * either belongs to the sentence (connective tissue — "damage to", "on the
 * board") or IS a decision, and names the editor slot that decision lives in.
 * P2 makes exactly those runs clickable.
 *
 * The golden test proves the words did not change. This one proves the
 * annotations are TRUE, over the same corpus:
 *
 * 1. the segments join back to exactly the sentence;
 * 2. every tagged word names a slot `slotsOf` actually emits for that
 *    statement — a word tagged with a slot the editor lacks is a click that
 *    opens nothing;
 * 3. a decision is one span, never split into fragments or padded with spaces,
 *    so what the author clicks is the word and only the word.
 *
 * ⚠️ There is still **no parser**. Segments are produced alongside the string,
 * by the same code path that writes it; nothing reads text back into meaning.
 */

const cases = buildCorpus().filter(c => c.statement);

/** "On Cycle|moment" — a readable form for exact-shape assertions. */
const shape = (segs) => segs.map(s => (s.slot ? `${s.text}|${s.slot}` : s.text));

describe('segments are the sentence', () => {
    it('walks a corpus of single statements', () => {
        expect(cases.length).toBeGreaterThan(1000);
    });

    it('⭐ join back to exactly what renderStatement prints, for every case', () => {
        const bad = [];
        for (const { key, statement, names } of cases) {
            const joined = renderSegments(statement, names).map(s => s.text).join('');
            const printed = renderStatement(statement, names);
            if (joined !== printed) bad.push(`${key}\n    joined:  ${joined}\n    printed: ${printed}`);
        }
        expect(bad, bad.slice(0, 10).join('\n')).toEqual([]);
    });

    it('never emits an empty segment', () => {
        const bad = cases
            .filter(({ statement, names }) => renderSegments(statement, names).some(s => typeof s.text !== 'string' || s.text === ''))
            .map(c => c.key);
        expect(bad).toEqual([]);
    });
});

describe('⚠️ every clickable word opens a slot that exists', () => {
    it('names only slots slotsOf emits for that very statement', () => {
        const bad = [];
        for (const { key, statement, names } of cases) {
            const available = new Set(slotsOf(statement).map(s => s.id));
            for (const seg of renderSegments(statement, names)) {
                if (seg.slot && !available.has(seg.slot)) {
                    bad.push(`${key}: "${seg.text}" → ${seg.slot} (has: ${[...available].join(', ') || 'none'})`);
                }
            }
        }
        expect(bad, bad.slice(0, 15).join('\n')).toEqual([]);
    });

    it('⚠️ tags nothing at all on a statement the editor has no slots for', () => {
        // An unknown keyword has no slots, so nothing in its sentence may pretend
        // to be clickable.
        const segs = renderSegments({ keyword: 'not_a_keyword', payload: {} });
        expect(segs.filter(s => s.slot)).toEqual([]);
    });

    it('reaches the decisions an author actually edits', () => {
        // Guards against a quietly coarse renderer: a segment form that tagged
        // nothing would pass every test above. These are the slots P2 needs.
        const seen = new Set();
        for (const { statement, names } of cases) {
            for (const seg of renderSegments(statement, names)) if (seg.slot) seen.add(seg.slot);
        }
        for (const slot of [
            'moment', 'watchItem', 'threshold', 'cooldown', 'keyword', 'role',
            'amount', 'magnitude', 'stat', 'counted', 'ignoresArmor',
            'type', 'value', 'category', 'reach', 'filterMode', 'filterValue', 'filters',
            // `statusId` and `stacks` are gone: Applies offers library effects only (P4).
            'typeId', 'placement', 'effectId', 'durationMs',
            'kind', 'tag', 'payload',
            // P4: every decision the retired forms held now has a word.
            'quantity', 'itemId', 'chance', 'skill', 'tier', 'tokenIds', 'max', 'target',
            // Promotes rule P1.
            'jobId'
        ]) {
            expect(seen.has(slot), `no word in the whole corpus is tagged "${slot}"`).toBe(true);
        }
    });
});

describe('a decision is one clean span', () => {
    it('keeps whitespace out of every tagged word', () => {
        const bad = [];
        for (const { key, statement, names } of cases) {
            for (const seg of renderSegments(statement, names)) {
                if (seg.slot && seg.text !== seg.text.trim()) bad.push(`${key}: "${seg.text}"|${seg.slot}`);
            }
        }
        expect(bad, bad.slice(0, 10).join('\n')).toEqual([]);
    });

    it('never puts two spans of the same kind side by side', () => {
        // Two adjacent literals, or two adjacent spans for one slot, are one run
        // that got split — which would render as two separate click targets.
        const bad = [];
        for (const { key, statement, names } of cases) {
            const segs = renderSegments(statement, names);
            for (let i = 1; i < segs.length; i++) {
                if ((segs[i].slot || null) === (segs[i - 1].slot || null)) {
                    bad.push(`${key}: "${segs[i - 1].text}" + "${segs[i].text}"`);
                    break;
                }
            }
        }
        expect(bad, bad.slice(0, 10).join('\n')).toEqual([]);
    });
});

describe('⭐ the two shapes P0 was judged on, pinned exactly', () => {
    it('On Cycle: deals 2 damage to the hero.', () => {
        const st = { ...makeStatement(KEYWORD.DEALS), payload: { amount: 2 } };
        expect(shape(renderSegments(st))).toEqual([
            'On Cycle|moment', ': ', 'deals|keyword', ' ', '2|amount', ' damage to ', 'the hero|role', '.'
        ]);
    });

    it('Makes adjacent Coast Tokens work 5% faster.', () => {
        const st = {
            ...makeStatement(KEYWORD.PROVIDES),
            payload: { type: 'WORK_TIME', bucket: 'percentage', value: -0.05 },
            to: { mode: 'tag', value: 'Coast' }
        };
        expect(shape(renderSegments(st))).toEqual([
            'Makes|keyword', ' ', 'adjacent|reach', ' ', 'Coast|filterValue', ' ', 'Tokens|filterMode',
            ' ', 'work|type', ' ', '5%|value', ' ', 'faster|type', '.'
        ]);
    });
});
