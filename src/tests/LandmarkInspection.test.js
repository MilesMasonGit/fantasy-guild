// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { landmarkLines, LANDMARK_TEXT } from '../ui/components/drawer/landmarkLines.js';
import { TokenInspection } from '../ui/components/drawer/TokenInspection.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ Inspecting a landmark (an endgame site) shows the skill, level and items its challenge needs,
 * read from the type's own fields, with placeholder lines where the owner has not written them yet.
 */

const names = { skillName: (id) => ({ forestry: 'Forestry' }[id] || id), itemName: (id) => ({ item_seed: 'World Seed' }[id] || id) };

const SITE = {
    id: 'fixture_li_site', name: 'Stump of the World Tree', landmark: true, tokenType: 'resource',
    rarity: 'mythic', uses: null, size: 1, sprite: 'skill_nature',
    config: { skill: 'forestry', skillRequired: 99, cycleTimeMs: 600000, xp: 0, inputs: [{ itemId: 'item_seed', quantity: 100 }], outputs: [] }
};
const BARE = { id: 'fixture_li_bare', name: 'Unwritten Site', landmark: true, tokenType: 'resource', uses: null, size: 1, sprite: 'skill_nature' };

afterEach(() => cleanup());

describe('what a landmark\'s inspection says', () => {
    it('the skill at its level and every item, from the type', () => {
        expect(landmarkLines(SITE, names)).toEqual({
            title: LANDMARK_TEXT.TITLE,
            lines: [
                { label: LANDMARK_TEXT.NEEDS, value: 'Forestry 99' },
                { label: '', value: '100 × World Seed' }
            ],
            note: LANDMARK_TEXT.FIXED
        });
    });

    it('placeholder lines where the site is not written yet', () => {
        const { lines } = landmarkLines(BARE, names);
        expect(lines).toEqual([
            { label: LANDMARK_TEXT.NEEDS, value: LANDMARK_TEXT.NO_SKILL, placeholder: true },
            { label: '', value: LANDMARK_TEXT.NO_ITEMS, placeholder: true }
        ]);
    });

    it('nothing for a Token that is not a landmark', () => {
        expect(landmarkLines({ ...SITE, landmark: false }, names)).toBeNull();
        expect(landmarkLines(null, names)).toBeNull();
    });

    it('the inspection panel shows it', () => {
        registerItems({ item_li_seed: { id: 'item_li_seed', name: 'World Seed', type: 'material', sprite: 'wood_oak' } });
        registerTokenTypes({
            [SITE.id]: { ...SITE, config: { ...SITE.config, inputs: [{ itemId: 'item_li_seed', quantity: 100 }] } },
            [BARE.id]: BARE
        });
        const site = render(React.createElement(TokenInspection, { typeId: SITE.id }));
        const block = site.container.querySelector('[data-landmark]');
        expect(block.textContent).toContain(LANDMARK_TEXT.TITLE);
        expect(block.textContent).toContain('99');
        expect(block.textContent).toContain('100 × World Seed');
        expect(block.textContent).toContain(LANDMARK_TEXT.FIXED);
        cleanup();
        const bare = render(React.createElement(TokenInspection, { typeId: BARE.id }));
        expect(bare.container.querySelector('[data-landmark]').textContent).toContain(LANDMARK_TEXT.NO_ITEMS);
    });
});
