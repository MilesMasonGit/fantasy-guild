import { describe, it, expect } from 'vitest';
import './fixtures/testTokens.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { renderSegments } from '../systems/effects/statementText.js';
import {
    slotsOf, filterOptions, nearestOptions, slotsWithoutWords, SLOT_KIND
} from '../systems/effects/statementSlots.js';
import { buildCorpus } from './fixtures/renderCorpus.js';

/**
 * The model behind the Rules Line's typing (Rules Line P2).
 *
 * Game-side and React-free on purpose: what Enter picks, what an unrecognised
 * word offers, and which decisions have no word to click are all decisions
 * about the grammar, so they are pinned here where the suite can reach them.
 */

const momentSlot = () => slotsOf(makeStatement(KEYWORD.DEALS)).find(s => s.id === 'moment');
const labels = (opts) => opts.map(o => o.label);

describe('typing narrows best-first, because Enter takes the top hit', () => {
    it('puts an exact label ahead of one that merely mentions the word', () => {
        const hits = filterOptions(momentSlot(), 'on tick');
        expect(hits[0].label).toBe('On Tick');
    });

    it('prefers a label that starts with what was typed', () => {
        const hits = filterOptions(momentSlot(), 'on cycle');
        expect(hits[0].label).toBe('On Cycle');
    });

    it('still finds a word by its hint, but only after every label match', () => {
        const slot = momentSlot();
        const hits = filterOptions(slot, 'charge');
        const firstHintOnly = hits.findIndex(o => !o.label.toLowerCase().includes('charge'));
        const lastLabel = hits.map(o => o.label.toLowerCase().includes('charge')).lastIndexOf(true);
        if (firstHintOnly >= 0 && lastLabel >= 0) expect(lastLabel).toBeLessThan(firstHintOnly);
        expect(hits.length).toBeGreaterThan(0);
    });

    it('returns everything, in vocabulary order, when nothing is typed', () => {
        const slot = momentSlot();
        expect(filterOptions(slot, '')).toEqual(slot.options);
    });
});

describe('⭐ an unrecognised word offers the nearest real ones (E-4)', () => {
    it('turns a typo into the word that was meant', () => {
        expect(nearestOptions(momentSlot(), 'depletd')[0].label).toBe('On Depleted');
    });

    it('prefers the closer whole label when two share the typed words', () => {
        // "On Neighbour's Cycle" contains both words too, and is listed first in
        // the vocabulary — the whole-label blend is what puts On Cycle ahead.
        expect(nearestOptions(momentSlot(), 'on cycel')[0].label).toBe('On Cycle');
    });

    it('offers nothing for nothing typed', () => {
        expect(nearestOptions(momentSlot(), '   ')).toEqual([]);
    });

    it('⚠️ only ever ranks the slot’s own options — it never invents one', () => {
        const slot = momentSlot();
        const ids = new Set(slot.options.map(o => o.id));
        for (const typed of ['zzzz', 'x', 'on', 'neighbour', 'bank 10 oak']) {
            const near = nearestOptions(slot, typed);
            expect(near.length).toBeGreaterThan(0);
            expect(near.length).toBeLessThanOrEqual(5);
            expect(near.every(o => ids.has(o.id))).toBe(true);
        }
    });

    it('is deterministic', () => {
        expect(labels(nearestOptions(momentSlot(), 'strat'))).toEqual(labels(nearestOptions(momentSlot(), 'strat')));
    });
});

describe('⚠️ every decision is reachable — by its word, or explicitly', () => {
    it('names exactly the slots the sentence has no word for', () => {
        const st = { ...makeStatement(KEYWORD.DEALS), payload: { amount: 2 } };
        const missing = slotsWithoutWords(slotsOf(st), renderSegments(st)).map(s => s.id);
        // A flat hit never says "measured as", and armour is silent until ignored.
        expect(missing).toContain('magnitude');
        expect(missing).toContain('ignoresArmor');
        expect(missing).not.toContain('amount');
        expect(missing).not.toContain('role');
    });

    it('never offers a form slot as a missing word — the form is always beneath', () => {
        for (const { statement, names } of buildCorpus().filter(c => c.statement)) {
            const missing = slotsWithoutWords(slotsOf(statement), renderSegments(statement, names));
            expect(missing.some(s => s.kind === SLOT_KIND.FORM)).toBe(false);
        }
    });

    it('⭐ covers every slot across the whole corpus: worded, offered, or a form', () => {
        const bad = [];
        for (const { key, statement, names } of buildCorpus().filter(c => c.statement)) {
            const slots = slotsOf(statement);
            const segments = renderSegments(statement, names);
            const worded = new Set(segments.map(s => s.slot).filter(Boolean));
            const offered = new Set(slotsWithoutWords(slots, segments).map(s => s.id));
            for (const slot of slots) {
                if (!worded.has(slot.id) && !offered.has(slot.id) && slot.kind !== SLOT_KIND.FORM) {
                    bad.push(`${key}: ${slot.id}`);
                }
            }
        }
        expect(bad, bad.slice(0, 10).join('\n')).toEqual([]);
    });
});
