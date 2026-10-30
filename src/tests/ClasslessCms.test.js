// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import Statements, { StatementList } from '../../cms/src/components/editors/Statements.jsx';

/**
 * Classless heroes in the CMS (brief 270 K1): the job editor is gone. The Promotes rule, the only
 * place a job was picked, is offered by neither rule menu; older content holding one still reads,
 * marked retired, so the author can find and delete it.
 *
 * ⚠️ No real workspace: the store's persistence is a no-op here (TESTING, "The CMS").
 */

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const reset = () => useEntityStore.setState({
    items: {}, tokens: {}, effects: {}, maps: {}, recipePools: {}, activeEntityId: null, activeEntityType: null
});
const originalFetch = globalThis.fetch;
let storedBefore;
beforeAll(() => {
    storedBefore = globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null;
    useEntityStore.persist.setOptions({ storage: noStorage });
});
beforeEach(() => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
    reset();
});
afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    reset();
    expect(globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null).toBe(storedBefore);
});

const store = () => useEntityStore.getState();
const menuLabels = (container, opener) => {
    fireEvent.click([...container.querySelectorAll('button')].find((b) => b.textContent.includes(opener)));
    return [...container.querySelectorAll('button')].map((b) => b.textContent);
};

describe('the job editor is gone', () => {
    it('a Token’s New rule menu offers no Promotes', () => {
        const tokenId = store().addToken({ name: 'Old Barracks' });
        const { container } = render(React.createElement(Statements, { token: store().tokens[tokenId] }));
        const labels = menuLabels(container, 'New rule');
        expect(labels.some((l) => l.startsWith('Promotes'))).toBe(false);
        expect(labels.some((l) => l.startsWith('Provides'))).toBe(true);
    });

    it('an effect’s Add rule menu offers no Promotes', () => {
        const { container } = render(React.createElement(StatementList, { statements: [], onChange: () => {}, content: { tokens: {}, items: {}, effects: {} } }));
        const labels = menuLabels(container, 'Add rule');
        expect(labels.some((l) => l.startsWith('Promotes'))).toBe(false);
        expect(labels.some((l) => l.startsWith('Provides'))).toBe(true);
    });

    it('an older Promotes rule still shows, marked retired', () => {
        const statement = { ...makeStatement(KEYWORD.PROMOTES), payload: { jobId: 'knight' } };
        const { container } = render(React.createElement(StatementList, { statements: [statement], onChange: () => {}, content: { tokens: {}, items: {}, effects: {} } }));
        expect(container.textContent).toContain('Promotes the hero to knight (retired)');
    });
});
