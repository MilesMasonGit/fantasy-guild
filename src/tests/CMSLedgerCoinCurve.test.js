// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, within } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import LedgerSettings from '../../cms/src/components/ledger/LedgerSettings.jsx';
import { DEFAULT_LEDGER_SETTINGS } from '../../cms/src/engine/ledger/settings.js';

/**
 * ⭐ The two coin curves in the Ledger settings (BALANCE_RULES section 7): from a stage on, the
 * minutes of one hero's coin income a coin cost asks, an everyday curve (a Shop Token, a Foundation)
 * and a big one (settling a place, a Guild Hall star); each starts at the rule's points, and a point
 * edited, added and removed is saved with the settings under its own curve.
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

const stored = (field) => useEntityStore.getState().planSettings?.[field];

describe('⭐ the Coin costs card', () => {
    it('shows the everyday curve from 5 minutes at the Starter Camp; an edit, a new point and a removal are saved', () => {
        const { container } = render(React.createElement(LedgerSettings));
        const card = container.querySelector('[data-coin-curve="everyday"]');
        expect(card.textContent).toMatch(/Everyday/);
        const box = within(card).getByLabelText('Everyday coin cost minutes from Starter Camp');
        expect(box.value).toBe('5');
        expect(within(card).getByLabelText('Everyday coin cost minutes from Plane 7').value).toBe('361');
        fireEvent.change(box, { target: { value: '6' } });
        fireEvent.blur(box);
        expect(stored('coinCurve')[0]).toEqual({ tier: 0, minutes: 6 });
        expect(stored('coinCurve')).toHaveLength(7);
        expect(stored('bigCoinCurve')).toEqual(DEFAULT_LEDGER_SETTINGS.bigCoinCurve);
        fireEvent.click(within(card).getByLabelText('Remove the everyday coin cost point at Plane 7'));
        expect(stored('coinCurve').map(p => p.tier)).toEqual([0, 2, 3, 4, 5, 6]);
        fireEvent.click(within(card).getByLabelText('Add an everyday coin cost point'));
        expect(stored('coinCurve').at(-1)).toEqual({ tier: 7, minutes: 107 });
    });

    it('shows the big curve from 30 minutes at the Starter Camp, saved apart from the everyday one', () => {
        const { container } = render(React.createElement(LedgerSettings));
        const card = container.querySelector('[data-coin-curve="big"]');
        expect(card.textContent).toMatch(/Big/);
        const box = within(card).getByLabelText('Big coin cost minutes from Starter Camp');
        expect(box.value).toBe('30');
        expect(within(card).getByLabelText('Big coin cost minutes from Plane 7').value).toBe('720');
        fireEvent.change(box, { target: { value: '45' } });
        fireEvent.blur(box);
        expect(stored('bigCoinCurve')[0]).toEqual({ tier: 0, minutes: 45 });
        expect(stored('coinCurve')).toEqual(DEFAULT_LEDGER_SETTINGS.coinCurve);
        fireEvent.click(within(card).getByLabelText('Remove the big coin cost point at Starter Camp'));
        expect(stored('bigCoinCurve')[0].tier).toBe(1);
    });
});
