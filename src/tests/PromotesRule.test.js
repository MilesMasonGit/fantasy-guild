import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

import { KEYWORD, KEYWORDS, getKeyword, makeStatement, blankPayload, promotedJobOf } from '../systems/effects/statements.js';
import { slotsOf, costSlots } from '../systems/effects/statementSlots.js';
import { renderStatement, renderSegments } from '../systems/effects/statementText.js';
import { deriveTokenType } from '../config/registries/tokenTypeDerivation.js';
import { TOKEN_TYPES } from '../config/registries/tokenConstants.js';
import { JOBS } from '../config/registries/jobRegistry.js';
import { provisionalName } from '../systems/effects/effectMigration.js';
import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import Statements from '../../cms/src/components/editors/Statements.jsx';

/**
 * ⭐ **The Promotes rule — the vocabulary** (Promotes rule P1).
 *
 * Owner rulings 2026-09-12: promotion is a rule, reading "Promotes the hero to
 * Knight.", on Tokens only. P1 makes it writable and readable; nothing in the
 * engine reads it until P3.
 */

const promotes = (jobId) => ({ ...makeStatement(KEYWORD.PROMOTES), payload: { jobId } });
const slot = (st) => slotsOf(st).find((s) => s.id === 'jobId');

describe('the keyword', () => {
    it('is declared once, for Tokens only, with no When, filter, reach or upkeep', () => {
        const k = getKeyword(KEYWORD.PROMOTES);
        expect(KEYWORDS.filter((x) => x.id === 'promotes')).toHaveLength(1);
        expect(k).toMatchObject({ label: 'Promotes', when: 'never', filter: false, upkeep: false, tokensOnly: true });
        expect(k.reach).toBeFalsy();
        expect(k.targetsRole).toBeFalsy();
    });

    it('starts blank, and a new rule carries no moment, target or filter', () => {
        expect(blankPayload(KEYWORD.PROMOTES)).toEqual({ jobId: '' });
        const st = makeStatement(KEYWORD.PROMOTES);
        expect(st.when).toBeNull();
        expect(st.target).toBeNull();
        expect(st.to).toBeNull();
    });

    it('is the only keyword declared Tokens-only', () => {
        expect(KEYWORDS.filter((k) => k.tokensOnly).map((k) => k.id)).toEqual(['promotes']);
    });
});

describe('the job slot', () => {
    it('offers every job with a parent — never the Recruit', () => {
        const ids = slot(promotes('')).options.map((o) => o.id);
        const expected = Object.values(JOBS).filter((j) => j.parent).map((j) => j.id);
        expect(ids).toEqual(expected);
        expect(ids).toContain('knight');
        expect(ids).toContain('fighter');
        expect(ids).not.toContain('recruit');
    });

    it('says where each job is promoted from', () => {
        const knight = slot(promotes('')).options.find((o) => o.id === 'knight');
        expect(knight).toMatchObject({ label: 'Knight', hint: 'from Fighter' });
    });

    it('writes the picked job and keeps the rest of the payload', () => {
        const st = { ...promotes(''), payload: { jobId: '', extra: 1 } };
        expect(slot(st).patch('knight')).toEqual({ payload: { jobId: 'knight', extra: 1 } });
    });

    it('is the only decision: no role, reach or filter slots', () => {
        expect(slotsOf(promotes('knight')).map((s) => s.id)).toEqual(['keyword', 'jobId']);
    });
});

describe('⭐ the sentence (owner, 2026-09-12)', () => {
    it('reads "Promotes the hero to Knight."', () => {
        expect(renderStatement(promotes('knight'))).toBe('Promotes the hero to Knight.');
        expect(renderStatement(promotes('alchemist'))).toBe('Promotes the hero to Alchemist.');
    });

    it('shows a blank as a word to click, and keeps an unknown job visible', () => {
        expect(renderStatement(promotes(''))).toBe('Promotes the hero to ….');
        expect(renderStatement(promotes('not_a_job'))).toBe('Promotes the hero to not_a_job.');
    });

    it('makes the verb and the job clickable words', () => {
        const tagged = renderSegments(promotes('knight')).filter((s) => s.slot);
        expect(tagged.map((s) => [s.text, s.slot])).toEqual([['Promotes', 'keyword'], ['Knight', 'jobId']]);
    });
});

describe('what else knows about it', () => {
    it('makes a Token a "promotion" Token — above the station rung', () => {
        expect(TOKEN_TYPES).toContain('promotion');
        const both = { statements: [promotes('knight'), { ...makeStatement(KEYWORD.STATION), payload: { skill: 'cooking' } }] };
        expect(deriveTokenType(both).type).toBe('promotion');
        const withCycle = { statements: [promotes('knight')], config: { outputs: [{ itemId: 'x', quantity: 1 }] } };
        expect(deriveTokenType(withCycle).type).toBe('promotion');
    });

    it('reads the first job a Token names', () => {
        expect(promotedJobOf({ statements: [promotes(''), promotes('knight'), promotes('scout')] })).toBe('knight');
        expect(promotedJobOf({ statements: [promotes('')] })).toBeNull();
        expect(promotedJobOf({ statements: [] })).toBeNull();
    });

    it('names a new effect after the job it trains', () => {
        expect(provisionalName(promotes('knight'))).toBe('Knight Training');
        expect(provisionalName(promotes(''))).toBe('Promotion');
    });

    it('costs nothing by default until the engine spends on it (P3)', () => {
        expect(costSlots(makeStatement(KEYWORD.PROMOTES)).find((s) => s.id === 'charge').value).toBe(0);
    });
});

describe('⚠️ the CMS offers it on Tokens only (PR-3)', () => {
    const originalFetch = globalThis.fetch;
    const reset = () => useEntityStore.setState({
        items: {}, tokens: {}, effects: {}, maps: {}, recipePools: {}, activeEntityId: null, activeEntityType: null
    });
    beforeEach(() => {
        globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
        reset();
    });
    afterEach(() => {
        cleanup();
        globalThis.fetch = originalFetch;
        reset();
    });

    const store = () => useEntityStore.getState();
    const menuLabels = (container) => {
        fireEvent.click([...container.querySelectorAll('button')].find((b) => b.textContent.includes('New rule')));
        return [...container.querySelectorAll('button')].map((b) => b.textContent);
    };

    it('lists Promotes in a Token’s New rule menu', () => {
        const tokenId = store().addToken({ name: 'Knight’s Barracks' });
        const { container } = render(React.createElement(Statements, { token: store().tokens[tokenId] }));
        expect(menuLabels(container).some((l) => l.startsWith('Promotes'))).toBe(true);
    });

    it('leaves it out of an item’s New rule menu', () => {
        const itemId = store().addItem({ name: 'Knight’s Manual' });
        const { container } = render(React.createElement(Statements, { item: store().items[itemId] }));
        const labels = menuLabels(container);
        expect(labels.some((l) => l.startsWith('Promotes'))).toBe(false);
        expect(labels.some((l) => l.startsWith('Provides'))).toBe(true);
    });

    it('warns when an item is given a Promotes effect anyway', () => {
        const itemId = store().addItem({ name: 'Knight’s Manual' });
        const effectId = store().addEffect({ name: 'Knight Training', statements: [promotes('knight')] });
        store().addEffectRef('items', itemId, effectId);
        const { container } = render(React.createElement(Statements, { item: store().items[itemId] }));
        expect(container.querySelector('[data-token-only-warning]').textContent).toContain('Promotes only works on a Token');
    });

    it('does not warn on a Token, and the job is a word to retype', () => {
        const tokenId = store().addToken({ name: 'Knight’s Barracks' });
        const effectId = store().addEffect({ name: 'Knight Training', statements: [promotes('fighter')] });
        store().addEffectRef('tokens', tokenId, effectId);
        const { container } = render(React.createElement(Statements, { token: store().tokens[tokenId] }));
        expect(container.querySelector('[data-token-only-warning]')).toBeNull();

        fireEvent.click(container.querySelector('[data-rules-line] [data-slot="jobId"]'));
        const box = container.querySelector('[data-retyping]');
        fireEvent.change(box, { target: { value: 'Knight' } });
        fireEvent.keyDown(box, { key: 'Enter' });
        expect(store().effects[effectId].statements[0].payload.jobId).toBe('knight');
        expect(container.querySelector('[data-rules-line]').textContent).toBe('Promotes the hero to Knight.');
    });
});
