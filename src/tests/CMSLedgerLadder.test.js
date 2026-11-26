// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import LedgerSettings from '../../cms/src/components/ledger/LedgerSettings.jsx';

/**
 * ⭐ The ladder in the Ledger settings (brief 880 L2): the level each tier opens at, from the
 * Starter Camp to Plane 7, the ladder's to start, an edit saved with the settings.
 *
 * ⚠️ No real workspace: the store's persistence is a no-op here (TESTING, "The CMS").
 */

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
let storedBefore;
beforeAll(() => {
    storedBefore = globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null;
    useEntityStore.persist.setOptions({ storage: noStorage });
});
beforeEach(() => useEntityStore.setState({ planSettings: null }));
afterEach(() => {
    cleanup();
    expect(globalThis.localStorage?.getItem('fantasy-guild-cms-v2') ?? null).toBe(storedBefore);
});

describe('⭐ the Tiers card', () => {
    it('shows every tier to Plane 7 at the ladder\'s level; an edit is saved', () => {
        const { container } = render(React.createElement(LedgerSettings));
        const card = container.querySelector('[data-tier-levels]');
        expect(within(card).getByLabelText('Opening level of Starter Camp').value).toBe('1');
        const dark = within(card).getByLabelText('Opening level of Plane 7');
        expect(dark.value).toBe('80');
        fireEvent.change(dark, { target: { value: '85' } });
        fireEvent.blur(dark);
        const saved = useEntityStore.getState().planSettings.tierLevels;
        expect(saved.find(p => p.tier === 7).level).toBe(85);
        expect(saved.find(p => p.tier === 6).level).toBe(60);
    });
});
