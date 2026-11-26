// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import LedgerSettings from '../../cms/src/components/ledger/LedgerSettings.jsx';

/**
 * ⭐ The coin curve in the Ledger settings (brief 870 C3): from a stage on, the minutes of one
 * hero's coin income a coin cost asks; ten minutes from the Starter Camp to start, a point edited,
 * added and removed, saved with the settings.
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

const curve = () => useEntityStore.getState().planSettings?.coinCurve;

describe('⭐ the Coin costs card', () => {
    it('shows ten minutes from the Starter Camp; an edit, a new point and a removal are saved', () => {
        const { container } = render(React.createElement(LedgerSettings));
        const card = container.querySelector('[data-coin-curve]');
        expect(card.textContent).toMatch(/Starter Camp:/);
        const box = within(card).getByLabelText('Coin cost minutes from Starter Camp');
        expect(box.value).toBe('10');
        fireEvent.change(box, { target: { value: '15' } });
        fireEvent.blur(box);
        expect(curve()).toEqual([{ tier: 0, minutes: 15 }]);
        fireEvent.click(within(card).getByLabelText('Add a coin cost point'));
        expect(curve()).toEqual([{ tier: 0, minutes: 15 }, { tier: 1, minutes: 15 }]);
        fireEvent.click(within(card).getByLabelText('Remove the coin cost point at Starter Camp'));
        expect(curve()).toEqual([{ tier: 1, minutes: 15 }]);
    });
});
