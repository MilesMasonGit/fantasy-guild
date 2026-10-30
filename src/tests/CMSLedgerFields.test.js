// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore.js';
import ItemEditor from '../../cms/src/components/editors/ItemEditor.jsx';
import TokenEditor from '../../cms/src/components/editors/TokenEditor.jsx';

/**
 * The editors' Plan section: an entry's status, the tier the owner sets and a note, written as the
 * record's `ledger` block. The store is reset around every test; nothing reaches the author's workspace.
 */

const originalFetch = globalThis.fetch;
const resetStore = () => useEntityStore.setState({
    items: {}, tokens: {}, effects: {}, recipePools: {}, activeEntityId: null, activeEntityType: null,
});

beforeEach(() => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
    resetStore();
});
afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    resetStore();
});

const store = () => useEntityStore.getState();

describe('the Plan section', () => {
    it('shows an item with no ledger as Live with no tier, and writes what the owner picks', () => {
        const id = store().addItem({ name: 'Iron Ingot' });
        store().setActiveEntity(id, 'item');
        const view = render(React.createElement(ItemEditor));
        const status = view.getByLabelText('Status');
        const tier = view.getByLabelText('Tier');
        expect(status.value).toBe('live');
        expect(tier.value).toBe('');
        expect(store().items[id].ledger).toBeUndefined();

        fireEvent.change(tier, { target: { value: '2' } });
        expect(store().items[id].ledger).toEqual({ tier: 2 });
        fireEvent.change(status, { target: { value: 'planned' } });
        fireEvent.change(view.getByLabelText('Note'), { target: { value: 'plane 2 smelting' } });
        expect(store().items[id].ledger).toEqual({ tier: 2, status: 'planned', note: 'plane 2 smelting' });
        expect(view.getByText(/never synced to the game/)).toBeTruthy();
    });

    it('removes the block when it is cleared back to nothing', () => {
        const id = store().addItem({ name: 'Copper Ore', ledger: { tier: 1 } });
        store().setActiveEntity(id, 'item');
        const view = render(React.createElement(ItemEditor));
        fireEvent.change(view.getByLabelText('Tier'), { target: { value: '' } });
        expect('ledger' in store().items[id] ? store().items[id].ledger : undefined).toBeUndefined();
    });

    it('sets a Token, an enemy included, the same way', () => {
        const id = store().addToken({ name: 'Goblin Chief', enemy: { level: 20 } });
        store().setActiveEntity(id, 'token');
        const view = render(React.createElement(TokenEditor));
        fireEvent.change(view.getByLabelText('Status'), { target: { value: 'parked' } });
        expect(store().tokens[id].ledger).toEqual({ status: 'parked' });
    });
});
