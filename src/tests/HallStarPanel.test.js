// @vitest-environment jsdom
// A Guild Hall star in words and pictures (brief 390 G2, G3): the one sentence built from its rules,
// its brief numbers by rank, the item outline the sky draws over it, and the Hall's Effects listing
// the lap as a boost with no time on each output.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { getUpgradeDef, GUILD_UPGRADES } from '../config/guildUpgrades.js';
import { normaliseStar } from '../config/hallStars.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { qaHallSky } from '../ui/dev/qaHallSky.js';
import { starSentence, starAmount } from '../systems/progression/hallStarText.js';
import { outlineSpriteName, outlineSrc, edgeCells } from '../ui/components/board/hallStarOutline.js';
import { GuildHallEffectsList } from '../ui/components/board/GuildHallEffectsPopover.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), notify: vi.fn()
}));

const def = (id) => getUpgradeDef(id);

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    GameState.state.progress.guildUpgrades = {};
    InventoryManager.init();
    registerHallSky(qaHallSky());
    GuildUpgradeManager.recompute();
});

afterEach(() => {
    cleanup();
    registerHallSky(null);
    GuildUpgradeManager.recompute();
});

describe('a star\'s sentence, built from its rules', () => {
    it('reads every kind of star as one plain sentence with no number', () => {
        expect(starSentence(def('qa_mining_xp'))).toBe('Every Mining Token awards more XP.');
        expect(starSentence(def('qa_mining_yield'))).toBe('Every Mining Token gives more yield.');
        expect(starSentence(def('qa_mining_speed'))).toBe('Every Mining Token works faster.');
        expect(starSentence(def('qa_mining_camp_reach'))).toBe('Every Mining Camp hands out work further away.');
        expect(starSentence(def('qa_infirmary'))).toBe('Every hero recovers from a wound faster.');
        expect(starSentence(def('qa_food_slot'))).toBe('Every hero gets more Food slots.');
        expect(starSentence(def('qa_well_copper'))).toBe('The Guild Hall draws Copper Ore every lap, no hero needed.');
        for (const d of GUILD_UPGRADES) {
            expect(starSentence(d), d.id).toMatch(/^[A-Z].*\.$/);
            expect(starSentence(d), d.id).not.toMatch(/\d+%/);
        }
    });

    it('says the built-in tracks in their own sentence', () => {
        expect(starSentence(def('bank_tabs'))).toBe('Every rank opens another Bank tab, room for 64 more kinds of items.');
        expect(starSentence(def('roster_size'))).toBe('Every rank makes room for one more hero.');
        expect(starSentence(def('wishing_well'))).toBe('The Guild Hall draws Water every lap, no hero needed.');
    });

    it('names several reached Tokens once, and a figure they share once', () => {
        const twin = {
            id: 'twin', constellation: 'qa_forestry', name: 'Twin', node: { x: 0, y: 0 }, links: ['hall'],
            ranks: [{
                price: [],
                rules: ['Oak', 'Fir'].map(tag => ({
                    keyword: 'provides', to: { mode: 'tag', value: tag }, reach: 'board',
                    payload: { type: 'GROW_TIME', bucket: 'percentage', value: -0.1 }
                }))
            }]
        };
        registerHallSky({ ...qaHallSky(), stars: { ...qaHallSky().stars, twin } });
        expect(starSentence(def('twin'))).toBe('Every Oak and Fir Token grows and refills faster.');
        expect(starAmount(def('twin'), 1)).toBe('10% faster');
    });
});

describe('a star\'s brief numbers', () => {
    it('gives what a rank holds, nothing at rank 0, and no time on a Passive Production line', () => {
        expect(starAmount(def('qa_mining_xp'), 0)).toBeNull();
        expect(starAmount(def('qa_mining_xp'), 1)).toBe('50% more XP');
        expect(starAmount(def('qa_well_copper'), 2)).toBe('20 Copper Ore');
        expect(starAmount(def('qa_food_slot'), 1)).toBe('1 more Food slot');
        expect(starAmount(def('wishing_well'), 3)).toBe('30 Water');
        expect(starAmount(def('roster_size'), 2)).toBe('2 heroes');
        expect(starAmount(def('bank_tabs'), 0)).toBe('1 tab');
        expect(starAmount(def('bank_tabs'), 15)).toBe('16 tabs');
    });
});

describe('the item outline over each star', () => {
    it('picks an item by the star\'s kind, the skill\'s own for speed and yield', () => {
        expect(outlineSpriteName(def('qa_mining_speed'))).toBe('i_pick_copper');
        expect(outlineSpriteName(def('qa_mining_yield'))).toBe('i_ore_copper');
        expect(outlineSpriteName(def('qa_mining_xp'))).toBe('i_feather');
        expect(outlineSpriteName(def('qa_mining_camp_reach'))).toBe('i_torch');
        expect(outlineSpriteName(def('qa_vein_rest'))).toBe('i_ore_iron');
        expect(outlineSpriteName(def('qa_oak_regrow'))).toBe('i_seedling_oak');
        expect(outlineSpriteName(def('qa_infirmary'))).toBe('i_potion_round_red');
        expect(outlineSpriteName(def('qa_food_slot'))).toBe('i_bread');
        expect(outlineSpriteName(def('qa_well_copper'))).toBe('item_copper_ore');
        expect(outlineSpriteName(def('bank_tabs'))).toBe('i_key_gold');
        expect(outlineSrc(def('qa_well_copper'))).toMatch(/^\/assets\/.*i_ore_copper\.png$/);
        expect(outlineSrc(def('qa_mining_xp'))).toMatch(/^\/assets\/.*i_feather\.png$/);
    });

    it('takes a star\'s own `outline` over its kind\'s, and Sync keeps the field', () => {
        const raw = { ...qaHallSky().stars.qa_mining_xp, outline: 'item_coal' };
        expect(normaliseStar(raw).outline).toBe('item_coal');
        expect(normaliseStar(qaHallSky().stars.qa_mining_xp).outline).toBeUndefined();
        registerHallSky({ ...qaHallSky(), stars: { ...qaHallSky().stars, qa_mining_xp: raw } });
        expect(outlineSpriteName(def('qa_mining_xp'))).toBe('item_coal');
        expect(outlineSrc(def('qa_mining_xp'))).toMatch(/i_coal\.png$/);
    });

    it('draws the silhouette\'s edge only: a filled cell beside an empty one', () => {
        // A 3 x 3 square on a 5 x 5 grid: its middle cell is inside, the other eight are edge.
        const filled = (x, y) => x >= 1 && x <= 3 && y >= 1 && y <= 3;
        const edge = edgeCells(filled, 5);
        expect(edge).toHaveLength(8);
        expect(edge).not.toContainEqual([2, 2]);
    });
});

describe('the Hall\'s Effects', () => {
    it('lists the lap first among the boosts, and no time on any output', async () => {
        const { container } = render(React.createElement(GuildHallEffectsList));
        await act(async () => {
            GameState.state.progress.guildUpgrades = { wishing_well: 1, qa_well_copper: 1, qa_mining_xp: 1 };
            GuildUpgradeManager.recompute();
            EventBus.publish(ENGINE_EVENTS.GUILD_UPGRADES_UPDATED, {});
        });
        expect(container.querySelector('[data-hall-effect-lap]').textContent).toBe('Outputs arrive once a lap: every 10:00');
        for (const output of container.querySelectorAll('[data-hall-effect-output]')) {
            expect(output.textContent).not.toMatch(/every|\d:\d\d/);
        }
        expect(container.textContent).toContain('Boosts');
        expect(container.textContent).not.toContain('Modifiers');
    });
});
