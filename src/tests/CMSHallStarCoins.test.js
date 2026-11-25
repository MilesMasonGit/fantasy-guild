// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';

import { useEntityStore } from '../../cms/src/stores/useEntityStore';
import HallStarsPage from '../../cms/src/components/hallStars/HallStarsPage.jsx';
import { hallSkyFile } from '../../cms/src/engine/hallSky.js';
import { normaliseStar } from '../config/hallStars.js';

/**
 * ⭐ A Guild Hall star's rank coins in the CMS: the Guild Hall page edits each rank's coins (a whole
 * number above 0, or none), the sky file carries them, and the game's normaliser reads them back.
 * No-op storage; nothing reaches `data/`.
 */

const WORKSPACE_KEY = 'fantasy-guild-cms-v2';
const noStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const MINING = { id: 'mining', name: 'Mining', label: { x: 1.1, y: -0.6 }, skill: 'mining' };
const STAR = {
    id: 'star_cc_coins', constellation: 'mining', name: 'Coin Lore', description: '', node: { x: 1, y: -0.2 }, links: ['hall'],
    ranks: [{ tier: 1, price: [{ itemId: 'item_copper_ore', quantity: 10 }], rules: [], lines: [] }]
};
const store = () => useEntityStore.getState();
let storedBefore;

beforeAll(() => {
    storedBefore = localStorage.getItem(WORKSPACE_KEY);
    useEntityStore.persist.setOptions({ storage: noStorage });
});
afterAll(() => expect(localStorage.getItem(WORKSPACE_KEY)).toBe(storedBefore));
beforeEach(() => store().hydrate({
    items: { item_copper_ore: { id: 'item_copper_ore', name: 'Copper Ore' } }, tokens: {}, effects: {}, recipePools: {},
    starterCamp: null, skillPerks: null, hallConstellations: { mining: MINING }, hallStars: { [STAR.id]: STAR }
}));
afterEach(() => cleanup());

describe('⭐ a star rank\'s coins on the Guild Hall page', () => {
    it('writes a whole number above 0, clears anything else, and the sky file carries it to the game', () => {
        const { container } = render(React.createElement(HallStarsPage));
        const star = container.querySelector(`[data-hall-star="${STAR.id}"]`);
        fireEvent.click([...star.querySelectorAll('button')].find(b => b.textContent.includes('1 rank')));
        const input = star.querySelector('[data-hall-rank-coins]');
        fireEvent.change(input, { target: { value: '45' } });
        expect(store().hallStars[STAR.id].ranks[0].coins).toBe(45);
        const file = hallSkyFile(store());
        expect(normaliseStar(file.stars[STAR.id], STAR.id).ranks[0].coins).toBe(45);
        for (const value of ['0', '', '2.5', '-1']) {
            fireEvent.change(input, { target: { value } });
            expect(store().hallStars[STAR.id].ranks[0], value).not.toHaveProperty('coins');
        }
    });
});
