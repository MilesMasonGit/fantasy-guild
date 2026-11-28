// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import { worldDiff, withPlacePriceGrowth } from '../../cms/src/engine/worldTables.js';
import PlacePrices from '../../cms/src/components/ledger/PlacePrices.jsx';
import { PLACEHOLDER_WORLD_TABLES } from '../config/worldPlaceholder.js';
import { coinsText, furtherPlaces } from '../../cms/src/engine/ledgerCoins.js';

/**
 * The CMS shows and edits the world's place price growth (owner, 2026-11-27): each further place in
 * a ring asks the ring's coins and item quantities times the growth once more, the levels unchanged.
 */

const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const store = () => useEntityStore.getState();

function record(extra = {}) {
    const raw = JSON.parse(JSON.stringify(PLACEHOLDER_WORLD_TABLES));
    raw.prices[1].coins = 2100;
    raw.prices[2].coins = 13000;
    return { ...raw, ...extra };
}

const cellText = (container, ring, n) => container.querySelector(`[data-place-price="${ring}:${n}"] [data-place-coins]`)?.textContent;

let worldBefore;
beforeAll(() => {
    useEntityStore.persist.setOptions({ storage: noStorage });
    worldBefore = store().world;
});
afterEach(() => {
    cleanup();
    useEntityStore.setState({ world: worldBefore });
});
afterAll(() => useEntityStore.setState({ world: worldBefore }));

describe('the place prices card', () => {
    it('shows the 1st, 2nd and 3rd place of a ring and its last, at 1.25 when the tables say none', () => {
        useEntityStore.setState({ world: record() });
        const { container } = render(React.createElement(PlacePrices));
        const rows = [...container.querySelectorAll('[data-place-price]')].map(r => r.getAttribute('data-place-price'));
        expect(rows).toEqual(['1:1', '1:2', '1:3', '1:6', '2:1', '2:2', '2:3', '2:12', '3:1', '3:2', '3:3', '3:18']);
        expect(container.querySelector('input[aria-label="Place price growth"]').value).toBe('1.25');
        expect([1, 2, 3, 6].map(n => cellText(container, 1, n))).toEqual(['2,100', '2,625', '3,281', '6,409']);
        expect(cellText(container, 2, 1)).toBe('13,000');
        const levels = [...container.querySelectorAll('[data-place-price^="1:"] td:last-child')].map(td => td.textContent);
        expect(new Set(levels).size).toBe(1);
    });

    it('editing the growth writes it to the world record, and the review sees it', () => {
        useEntityStore.setState({ world: record() });
        const { container } = render(React.createElement(PlacePrices));
        const box = container.querySelector('input[aria-label="Place price growth"]');
        act(() => {
            fireEvent.change(box, { target: { value: '1.5' } });
            fireEvent.blur(box);
        });
        expect(store().world.placePriceGrowth).toBe(1.5);
        expect(cellText(container, 1, 2)).toBe('3,150');
        expect(worldDiff(record(), store().world).some(d => d.text === 'placePriceGrowth changed')).toBe(true);
    });

    it('a growth under 1 is not written', () => {
        const w = record();
        expect(withPlacePriceGrowth(w, 0.5)).toBe(w);
        expect(withPlacePriceGrowth(w, 1.1).placePriceGrowth).toBe(1.1);
    });
});

describe('the coin read-out prices each place of a ring by its order', () => {
    const result = (extra = {}) => ({
        supply: [], drops: [], thefts: [], worth: { priced: 0, pinned: 0, inPlay: true }, ms: 0,
        prices: [{ kind: 'ring', id: 'ring:1', name: 'Ring 1', ring: 1, coins: 2100, tier: 1, proposed: null, why: 'test' },
            { kind: 'ring', id: 'ring:2', name: 'Ring 2', ring: 2, coins: 0, tier: 2, proposed: null, why: 'test' }],
        ...extra
    });

    it('the 2nd, 3rd and last place at 1.25 by default; a ring asking none says nothing more', () => {
        expect(furtherPlaces(2100, 1)).toEqual([{ place: 2, coins: 2625 }, { place: 3, coins: 3281 }, { place: 6, coins: 6409 }]);
        const text = coinsText(result());
        expect(text).toMatch(/Ring 1 \(ring at .*\): asks 2100 for its first place, each further place 1\.25 times the one before \(2nd 2625, 3rd 3281, 6th 6409\)/);
        expect(text).toMatch(/Ring 2 \(ring at .*\): asks none;/);
    });

    it('follows the growth the workspace sets', () => {
        expect(coinsText(result({ placePriceGrowth: 2 }))).toMatch(/2 times the one before \(2nd 4200, 3rd 8400, 6th 67200\)/);
    });
});
