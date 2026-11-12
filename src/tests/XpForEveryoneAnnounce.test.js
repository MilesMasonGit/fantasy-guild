// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';

vi.mock('../config/registries/recipePoolRegistry.js', () => ({
    listRecipes: () => [
        { id: 'r_bar', name: 'Copper Bar', skill: 'smithing', levelRequirement: 2, outputs: [{ itemId: 'item_copper_bar' }] },
        { id: 'r_pin', name: 'Copper Pin', skill: 'smithing', levelRequirement: 3, outputs: [{ itemId: 'item_pin' }] },
        { id: 'r_pie', name: 'Apple Pie', skill: 'cooking', levelRequirement: 3, outputs: [{ itemId: 'item_pie' }] },
        { id: 'r_stew', name: 'Stew', skill: 'cooking', levelRequirement: 9, outputs: [{ itemId: 'item_stew' }] }
    ]
}));
vi.mock('../systems/core/CatchUp.js', () => ({
    canUndo: vi.fn(() => false),
    undoLast: vi.fn(() => false),
    forgetUndo: vi.fn()
}));

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as Banners from '../systems/notifications/banners.js';
import { wireNotifications, unwireNotifications } from '../systems/notifications/routing.js';
import { recipesUnlockedByGift } from '../systems/notifications/recipeUnlocks.js';
import { listRecipes } from '../config/registries/recipePoolRegistry.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { floatsOf, clearAllFloats, FLOAT_MS } from '../ui/components/board/levelUpFloats.js';
import { bubblesOf, clearAllHeroBubbles } from '../ui/components/dock/heroBarBubbles.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

withoutShippedPerks();

/**
 * XP for Everyone's level-ups are said once a hero (brief 620 E2): one float over each hero who
 * rose (the Upgrade icon and the levels gained in all), one hero-bar alert, one level-up sound for
 * the purchase, and one recipe banner for what the whole gift unlocked. Never a float, an alert or a
 * sound a skill.
 */

const h = React.createElement;
const heroes = [
    { heroId: 'h1', state: 'working', x: 300, y: 500, moving: false, tokenId: null, alert: null },
    { heroId: 'h2', state: 'working', x: 700, y: 500, moving: false, tokenId: null, alert: null },
    { heroId: 'h3', state: 'working', x: 900, y: 500, moving: false, tokenId: null, alert: null }
];
const later = (ms = 10) => act(() => { vi.advanceTimersByTime(ms); });
const floatsIn = (c, heroId) => [...c.querySelectorAll(`[data-hero-bubble-stack="${heroId}"] [data-level-float]`)];

const up = (skillId, skillName, oldLevel, newLevel) => ({ skillId, skillName, oldLevel, newLevel });
/** Aela rose in three skills (four levels in all), Bram in one, Cass in none. */
const GIFT = {
    upgradeId: 'xp_all',
    amount: 250,
    heroes: [
        { heroId: 'h1', heroName: 'Aela', levelUps: [up('mining', 'Mining', 1, 3), up('smithing', 'Smithing', 1, 2), up('cooking', 'Cooking', 2, 3)] },
        { heroId: 'h2', heroName: 'Bram', levelUps: [up('smithing', 'Smithing', 1, 3)] },
        { heroId: 'h3', heroName: 'Cass', levelUps: [] }
    ]
};
const give = (payload = GIFT) => act(() => { EventBus.publish(ENGINE_EVENTS.XP_FOR_EVERYONE_GIVEN, payload); });

const sheetHero = (id, name, levels) => ({
    id, name, spriteId: 'hn_recruit_por',
    skills: Object.fromEntries(Object.entries(levels).map(([s, level]) => [s, { level, xp: 0 }]))
});

beforeEach(() => {
    vi.useFakeTimers();
    clearAllFloats();
    clearAllHeroBubbles();
    GameState.initNew();
    // The guild after the gift: the levels the payload says they reached.
    GameState.state.heroes = [
        sheetHero('h1', 'Aela', { mining: 3, smithing: 2, cooking: 3 }),
        sheetHero('h2', 'Bram', { mining: 1, smithing: 3, cooking: 1 }),
        sheetHero('h3', 'Cass', { mining: 1, smithing: 1, cooking: 2 })
    ];
    Banners.reset();
    wireNotifications();
});
afterEach(() => {
    unwireNotifications();
    Banners.reset();
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('one float a hero over the mat', () => {
    it('the Upgrade icon and the levels gained in all, over each hero who rose, none for the rest', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        give();
        const [a] = floatsIn(container, 'h1');
        expect(floatsIn(container, 'h1')).toHaveLength(1);
        expect(a.getAttribute('data-level-float')).toBe('xp_for_everyone');
        expect(a.querySelector('img').getAttribute('src')).toBe('/assets/ui/u_upgrade.png');
        expect(a.querySelector('img').style.width).toBe('32px');
        expect(a.querySelector('[data-level-value]').textContent).toBe('+4');
        expect(a.querySelector('[data-level-flash]')).toBeNull();
        expect(floatsIn(container, 'h2').map(f => f.querySelector('[data-level-value]').textContent)).toEqual(['+2']);
        expect(floatsIn(container, 'h3')).toEqual([]);
    });

    it('a second gift while it is up adds to it, and it goes after its time like any float', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        give();
        later(5000);
        give({ ...GIFT, heroes: [GIFT.heroes[0]] });
        expect(floatsOf('h1', Date.now()).map(f => f.levels)).toEqual([8]);
        expect(floatsIn(container, 'h1')).toHaveLength(1);
        expect(floatsIn(container, 'h1')[0].querySelector('[data-level-value]').textContent).toBe('+8');
        later(FLOAT_MS + 100);
        expect(floatsIn(container, 'h1')).toEqual([]);
    });

    it('sits beside a skill float of an ordinary level-up', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        act(() => { EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId: 'h1', skillId: 'mining', skillName: 'Mining', oldLevel: 3, newLevel: 4 }); });
        give();
        expect(floatsIn(container, 'h1').map(f => f.getAttribute('data-level-float'))).toEqual(['mining', 'xp_for_everyone']);
    });
});

describe('one alert a hero on the hero bar', () => {
    it('says the levels gained in all, once, beside no alert a skill', () => {
        give();
        expect(bubblesOf('h1').map(b => b.text)).toEqual(['+4 levels!']);
        expect(bubblesOf('h2').map(b => b.text)).toEqual(['+2 levels!']);
        expect(bubblesOf('h3')).toEqual([]);
        give({ ...GIFT, heroes: [{ heroId: 'h2', heroName: 'Bram', levelUps: [up('mining', 'Mining', 1, 2)] }] });
        expect(bubblesOf('h2').map(b => b.text)).toEqual(['+3 levels!']);
    });

    it('a single level reads as one', () => {
        give({ ...GIFT, heroes: [{ heroId: 'h3', heroName: 'Cass', levelUps: [up('mining', 'Mining', 1, 2)] }] });
        expect(bubblesOf('h3').map(b => b.text)).toEqual(['+1 level!']);
    });
});

describe('one sound for the purchase', () => {
    it('plays the level-up sound once, and none when nobody rose', () => {
        const play = vi.spyOn(AudioSystem, 'playSfx').mockImplementation(() => {});
        vi.spyOn(AudioSystem, 'playNextTrack').mockImplementation(() => {});
        AudioSystem.init();
        give();
        expect(play.mock.calls.filter(([clip]) => clip === 'levelup')).toHaveLength(1);
        give({ ...GIFT, heroes: [GIFT.heroes[2]] });
        expect(play.mock.calls.filter(([clip]) => clip === 'levelup')).toHaveLength(1);
    });
});

describe('one recipe banner for what the gift unlocked', () => {
    it('lists every recipe the guild could not make before, with the heroes who reached them', () => {
        give();
        const all = Banners.getAll().filter(b => b.kind === 'recipe');
        expect(all).toHaveLength(1);
        expect(all[0].parts.heroes).toEqual(['Aela', 'Bram']);
        // Smithing: the guild's best was 1 before, 3 now; Cooking: Cass already held 2, so Pie (3) is new.
        expect([...all[0].parts.recipes].sort()).toEqual(['Apple Pie', 'Copper Bar', 'Copper Pin']);
        expect(all[0].subjects.map(s => s.id)).toEqual(['h1', 'h2']);
    });

    it('reads the guild\'s best before the gift, not after it (everyone rose at once)', () => {
        const rows = recipesUnlockedByGift(listRecipes(), GameState.heroes, GIFT.heroes);
        expect(rows.map(r => [r.heroId, r.recipes.map(x => x.id)])).toEqual([
            ['h1', ['r_bar', 'r_pie']],
            ['h2', ['r_bar', 'r_pin']]
        ]);
        // Nothing new when someone already stood at those levels.
        GameState.state.heroes.push(sheetHero('h4', 'Dara', { smithing: 5, cooking: 5 }));
        expect(recipesUnlockedByGift(listRecipes(), GameState.heroes, GIFT.heroes)).toEqual([]);
    });

    it('says nothing when the gift unlocked nothing', () => {
        give({ ...GIFT, heroes: [GIFT.heroes[2]] });
        expect(Banners.getAll()).toEqual([]);
    });
});
