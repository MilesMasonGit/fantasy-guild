// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

const STATUS = new Map();
vi.mock('../systems/board/Flags.js', () => ({
    statusOf: (heroId) => ({ state: STATUS.get(heroId) || 'docked', instanceId: null, typeId: null, limping: false })
}));
vi.mock('../systems/core/CatchUp.js', () => ({
    canUndo: vi.fn(() => false),
    undoLast: vi.fn(() => false),
    forgetUndo: vi.fn()
}));

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { bubblesOf, clearAllHeroBubbles, addPerks } from '../ui/components/dock/heroBarBubbles.js';
import { addFloat, clearAllFloats } from '../ui/components/board/levelUpFloats.js';
import { skillPerkView, perksReachedBy, perkTitle, perkLines } from '../ui/components/dock/heroPerks.js';
import { xpForLevel } from '../utils/XPCurve.js';

/**
 * The milestone perk on screen: the level-up float names it under the number, the hero bar gives it
 * an alert of its own, and the hero sheet's skill row lists the perks held and the next one.
 */

const h = React.createElement;

registerEffects({
    k4ui_felling: {
        id: 'k4ui_felling', name: 'Clean Felling',
        statements: [{
            id: 'stm_k4ui_felling', keyword: KEYWORD.PROVIDES,
            payload: { type: EFFECT_TYPES.LOOT_MULT, bucket: 'flat', value: 5, category: 'forestry' },
            to: { mode: 'all', value: '' }, reach: 'nearby'
        }]
    },
    k4ui_seeds: {
        id: 'k4ui_seeds', name: 'Seed Finder',
        statements: [{
            id: 'stm_k4ui_seeds', keyword: KEYWORD.PROVIDES,
            payload: { type: EFFECT_TYPES.XP_BONUS, bucket: 'percentage', value: 0.1, category: 'forestry' },
            to: { mode: 'all', value: '' }, reach: 'nearby'
        }]
    }
});

const lvl = (level) => ({ level, xp: xpForLevel(level) });
const forester = (id, level) => ({
    id, name: id, spriteId: 'hn_recruit_por', hp: { current: 11, max: 11 }, status: 'idle', equipment: {},
    skills: { forestry: lvl(level), mining: lvl(12) }
});
const texts = (heroId) => bubblesOf(heroId).map(b => b.text);
const level = (heroId, skillId, skillName, oldLevel, newLevel) =>
    act(() => { EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId, heroName: heroId, skillId, skillName, oldLevel, newLevel }); });

beforeEach(() => {
    vi.useFakeTimers();
    STATUS.clear();
    clearAllHeroBubbles();
    clearAllFloats();
    GameState.initNew();
    GameState.state.heroes = [forester('h1', 12)];
    setLiveMatFit(1);
    registerSkillPerks({ forestry: { perks: [{ level: 10, effectId: 'k4ui_felling' }, { level: 25, effectId: 'k4ui_seeds', scale: 2 }] } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
afterAll(() => registerSkillPerks({ forestry: { perks: [] } }));

describe('a perk named for the screen', () => {
    it('reads as its effect\'s title, with the numeral of its scale, and its rule at that scale', () => {
        expect(perkTitle({ effectId: 'k4ui_felling', scale: 1 })).toBe('Clean Felling');
        expect(perkTitle({ effectId: 'k4ui_seeds', scale: 2 })).toBe('Seed Finder II');
        expect(perkTitle({ effectId: 'gone', scale: 1 })).toBe('gone');
        expect(perkLines({ effectId: 'k4ui_seeds', scale: 2 }).join(' ')).toMatch(/20%/);
    });

    it('lists what a level holds and what comes next', () => {
        expect(skillPerkView('forestry', 9)).toEqual({ earned: [], next: [{ level: 10, effectId: 'k4ui_felling', title: 'Clean Felling' }] });
        expect(skillPerkView('forestry', 12).earned.map(p => p.title)).toEqual(['Clean Felling']);
        expect(skillPerkView('forestry', 12).next.map(p => p.title)).toEqual(['Seed Finder II']);
        expect(skillPerkView('forestry', 30).next).toEqual([]);
        expect(skillPerkView('mining', 50)).toEqual({ earned: [], next: [] });
        expect(perksReachedBy('forestry', 5, 30).map(p => p.level)).toEqual([10, 25]);
    });
});

describe('the hero bar names a perk the level-up reached', () => {
    it('gives it an alert of its own after the level alert, kept when the skill levels again', () => {
        level('h1', 'forestry', 'Forestry', 9, 10);
        expect(texts('h1')).toEqual(['10 Forestry!', 'Perk: Clean Felling']);
        level('h1', 'forestry', 'Forestry', 10, 11);
        expect(texts('h1')).toEqual(['Perk: Clean Felling', '11 Forestry!']);
        level('h1', 'mining', 'Mining', 12, 13);
        expect(texts('h1')).toEqual(['Perk: Clean Felling', '11 Forestry!', '13 Mining!']);
    });

    it('names every perk a catch-up passed, read off its summary', () => {
        act(() => {
            EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, {
                summary: { levelUps: [{ heroId: 'h1', skillId: 'forestry', skillName: 'Forestry', from: 5, to: 30 }] }, show: false
            });
            EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'catch_up' });
        });
        expect(texts('h1')).toEqual(['30 Forestry!', 'Perk: Clean Felling', 'Perk: Seed Finder II']);
    });

    it('adds the same perk once', () => {
        const once = addPerks([], 'forestry', [{ level: 10, effectId: 'k4ui_felling', title: 'Clean Felling' }]);
        const twice = addPerks(once, 'forestry', [{ level: 10, effectId: 'k4ui_felling', title: 'Clean Felling' }]);
        expect(twice.map(b => b.text)).toEqual(['Perk: Clean Felling']);
    });
});

describe('the level-up float names a perk under its number', () => {
    const heroes = [{ heroId: 'h1', state: 'working', x: 300, y: 500, moving: false, tokenId: null, alert: null }];

    it('draws the perk the level reached, and none for a level that reached none', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        act(() => { vi.advanceTimersByTime(10); });
        level('h1', 'forestry', 'Forestry', 9, 10);
        level('h1', 'mining', 'Mining', 12, 13);
        const perkOf = (key) => [...container.querySelectorAll(`[data-level-float="${key}"] [data-level-perk]`)].map(n => n.textContent);
        expect(perkOf('forestry')).toEqual(['Clean Felling']);
        expect(perkOf('mining')).toEqual([]);
    });

    it('keeps an earlier perk named when the same skill levels again while up', () => {
        let list = addFloat([], { skillId: 'forestry', skillName: 'Forestry', oldLevel: 9, newLevel: 10 }, 1000);
        list = addFloat(list, { skillId: 'forestry', skillName: 'Forestry', oldLevel: 10, newLevel: 11 }, 5000);
        expect(list).toHaveLength(1);
        expect(list[0].perks).toEqual(['Clean Felling']);
        list = addFloat(list, { skillId: 'forestry', skillName: 'Forestry', oldLevel: 24, newLevel: 25 }, 6000);
        expect(list[0].perks).toEqual(['Clean Felling', 'Seed Finder II']);
    });
});

describe('the hero sheet\'s skill row lists the perks held and the next one', () => {
    const panel = () => render(h(DeckDndProvider, null, h(BankHeroPanel, { menuRight: false, selectedHeroId: 'h1', showTabs: false })));

    it('says them on hover', () => {
        const r = panel();
        const row = r.container.querySelector('[data-skill-row="forestry"]');
        fireEvent.pointerEnter(row);
        const tip = document.body.querySelector('[data-tooltip]').textContent;
        expect(tip).toContain('10/99 Clean Felling');
        expect(tip).toContain('Next perk: 25/99 Seed Finder II');
        fireEvent.pointerLeave(row);
    });

    it('opens to each perk held with what it does, then the next; a skill with no table shows none', () => {
        const r = panel();
        fireEvent.click(r.container.querySelector('[data-skill-row="forestry"]'));
        const perks = r.container.querySelector('[data-skill-row="forestry"] [data-skill-perks]');
        expect(perks.querySelector('[data-skill-perk="k4ui_felling"]').textContent).toMatch(/^10\/99 Clean Felling.*5%/);
        expect(perks.querySelector('[data-skill-next-perk="k4ui_seeds"]').textContent).toBe('Next perk: 25/99 Seed Finder II');
        fireEvent.click(r.container.querySelector('[data-skill-row="mining"]'));
        expect(r.container.querySelector('[data-skill-row="mining"] [data-skill-perks]')).toBeNull();
    });
});
