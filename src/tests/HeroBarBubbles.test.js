// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

const STATUS = new Map();
vi.mock('../systems/board/Flags.js', () => ({
    statusOf: (heroId) => ({ state: STATUS.get(heroId) || 'docked', instanceId: null, typeId: null, limping: false })
}));
vi.mock('../ui/components/drawer/HeroInspectionSheet.jsx', () => ({
    HeroInspectionSheet: () => React.createElement('div', { 'data-testid': 'hero-sheet' })
}));

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { DOCK_SLOT_PX } from '../ui/components/dock/dockHeroView.js';
import { addLevelUp, clearAllHeroBubbles, clearHeroBubble, BAR_BUBBLES_SHOWN, BAR_BUBBLE_FADE_MS } from '../ui/components/dock/heroBarBubbles.js';
import { MOMENT_TTL_MS } from '../ui/components/board/heroSpeech.js';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';

/**
 * The hero bar's level-up bubbles: the mat's words, but they stay until the player clears
 * them (a click on one bubble clears it, a click on the hero clears them all), so a long AFK
 * session can be read off the bar.
 */

const h = React.createElement;
const hero = (id, name) => ({ id, name, spriteId: 'hero_recruit_0', hp: { current: 100, max: 100 }, status: 'idle', equipment: {} });
const engine = { GameState, EventBus, BoardPlacement: { recallHeroById: vi.fn() }, EquipmentManager: { equipItem: vi.fn() } };

function mount(props = {}) {
    return render(
        h(EngineContext.Provider, { value: engine },
            h(DeckDndProvider, null, h(BottomHeroDock, { selectedHeroId: null, ...props })))
    );
}

const figure = (view, id) => view.container.querySelector(`[data-dock-hero="${id}"]`);
const bubbles = (view, id) =>
    [...view.container.querySelectorAll(`[data-bar-bubbles="${id}"] [data-bar-bubble]`)].map(n => n.textContent);
const level = (heroId, skillName, oldLevel, newLevel) =>
    act(() => { EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId, heroName: heroId, skillId: skillName.toLowerCase(), skillName, oldLevel, newLevel }); });

beforeEach(() => {
    vi.useFakeTimers();
    STATUS.clear();
    clearAllHeroBubbles();
    GameState.initNew();
    GameState.state.heroes = [hero('h1', 'Aldric'), hero('h2', 'Brenna')];
    setLiveMatFit(1);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe('level-up wording on the bar', () => {
    it('is the mat bubble wording, (+n) only when two or more levels merged', () => {
        let list = addLevelUp([], { skillName: 'Mining', oldLevel: 24, newLevel: 25 });
        expect(list.map(b => b.text)).toEqual(['LVL UP! 25 Mining!']);
        list = addLevelUp(list, { skillName: 'Mining', oldLevel: 25, newLevel: 26 });
        expect(list.map(b => b.text)).toEqual(['LVL UP! 26 Mining! (+2)']);
        list = addLevelUp(list, { skillName: 'Forestry', oldLevel: 3, newLevel: 4 });
        list = addLevelUp(list, { skillName: 'Mining', oldLevel: 26, newLevel: 29 });
        expect(list.map(b => b.text)).toEqual(['LVL UP! 4 Forestry!', 'LVL UP! 29 Mining! (+5)']);
    });
});

describe('the hero bar level-up bubbles', () => {
    it('appear over the hero who levelled, and only that hero', () => {
        const view = mount();
        level('h1', 'Mining', 24, 25);
        expect(bubbles(view, 'h1')).toEqual(['LVL UP! 25 Mining!']);
        expect(bubbles(view, 'h2')).toEqual([]);
    });

    it('persist across ticks long after the mat bubble would have gone', async () => {
        const view = mount();
        level('h1', 'Mining', 24, 25);
        for (let i = 0; i < 20; i++) {
            await act(async () => {
                vi.advanceTimersByTime(MOMENT_TTL_MS * 10);
                EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, {});
                EventBus.publish(ENGINE_EVENTS.STATE_CHANGED, {});
                await Promise.resolve();
            });
        }
        expect(bubbles(view, 'h1')).toEqual(['LVL UP! 25 Mining!']);
    });

    it('merge levels of one skill with the (+n) rule, one bubble per skill', () => {
        const view = mount();
        for (let l = 21; l <= 25; l++) level('h1', 'Mining', l - 1, l);
        level('h1', 'Forestry', 3, 4);
        expect(bubbles(view, 'h1')).toEqual(['LVL UP! 25 Mining! (+5)', 'LVL UP! 4 Forestry!']);
    });

    it('clicking a bubble fades it out and clears that one bubble only, without opening the hero', () => {
        const onSelectHero = vi.fn();
        const view = mount({ onSelectHero });
        level('h1', 'Mining', 24, 25);
        level('h1', 'Forestry', 3, 4);
        level('h2', 'Fishing', 9, 10);
        const mining = view.container.querySelector('[data-bar-bubbles="h1"] [data-bar-bubble="level:Mining"]');
        fireEvent.click(mining);
        // Still drawn while it fades, marked as fading.
        expect(bubbles(view, 'h1')).toEqual(['LVL UP! 25 Mining!', 'LVL UP! 4 Forestry!']);
        expect(mining.getAttribute('data-bar-bubble-fading')).toBe('true');
        act(() => { vi.advanceTimersByTime(BAR_BUBBLE_FADE_MS + 10); });
        expect(bubbles(view, 'h1')).toEqual(['LVL UP! 4 Forestry!']);
        expect(bubbles(view, 'h2')).toEqual(['LVL UP! 10 Fishing!']);
        expect(onSelectHero).not.toHaveBeenCalled();
    });

    it('clearHeroBubble removes one skill\'s bubble and leaves the rest', () => {
        const view = mount();
        level('h1', 'Mining', 24, 25);
        level('h1', 'Forestry', 3, 4);
        act(() => clearHeroBubble('h1', 'level:Forestry'));
        expect(bubbles(view, 'h1')).toEqual(['LVL UP! 25 Mining!']);
        act(() => clearHeroBubble('h1', 'level:Mining'));
        expect(view.container.querySelector('[data-bar-bubbles="h1"]')).toBeNull();
    });

    it('draws the numbers in their own colour', () => {
        const view = mount();
        for (let l = 2; l <= 50; l++) level('h1', 'Melee', l - 1, l);
        const b = view.container.querySelector('[data-bar-bubble="level:Melee"]');
        expect(b.textContent).toBe('LVL UP! 50 Melee! (+49)');
        expect([...b.querySelectorAll('[data-bubble-num]')].map(n => n.textContent)).toEqual(['50', '(+49)']);
    });

    it('clicking the hero clears their bubbles and still selects them', () => {
        const onSelectHero = vi.fn();
        const view = mount({ onSelectHero });
        level('h1', 'Mining', 24, 25);
        level('h2', 'Fishing', 9, 10);
        fireEvent.click(figure(view, 'h1'));
        expect(onSelectHero).toHaveBeenCalledWith('h1');
        expect(bubbles(view, 'h1')).toEqual([]);
        expect(bubbles(view, 'h2')).toEqual(['LVL UP! 10 Fishing!']);
    });

    it('a cleared skill counts afresh from its next level-up', () => {
        const view = mount();
        level('h1', 'Mining', 24, 25);
        level('h1', 'Mining', 25, 26);
        fireEvent.click(figure(view, 'h1'));
        level('h1', 'Mining', 26, 27);
        expect(bubbles(view, 'h1')).toEqual(['LVL UP! 27 Mining!']);
    });

    it(`shows the newest ${BAR_BUBBLES_SHOWN} and pages through the rest with arrows`, () => {
        const view = mount();
        ['Mining', 'Forestry', 'Fishing', 'Cooking', 'Smithing'].forEach((s, i) => level('h1', s, i, i + 1));
        const q = (sel) => view.container.querySelector(`[data-bar-bubbles="h1"] ${sel}`);
        expect(bubbles(view, 'h1')).toEqual([
            'LVL UP! 3 Fishing!', 'LVL UP! 4 Cooking!', 'LVL UP! 5 Smithing!'
        ]);
        expect(view.container.querySelector('[data-bar-bubble-more]')).toBeNull();
        expect(q('[data-bar-bubble-page]').textContent).toBe('1/2');
        expect(q('[data-bar-bubble-newer]').disabled).toBe(true);

        fireEvent.click(q('[data-bar-bubble-older]'));
        expect(bubbles(view, 'h1')).toEqual(['LVL UP! 1 Mining!', 'LVL UP! 2 Forestry!']);
        expect(q('[data-bar-bubble-page]').textContent).toBe('2/2');
        expect(q('[data-bar-bubble-older]').disabled).toBe(true);

        fireEvent.click(q('[data-bar-bubble-newer]'));
        expect(bubbles(view, 'h1')).toEqual([
            'LVL UP! 3 Fishing!', 'LVL UP! 4 Cooking!', 'LVL UP! 5 Smithing!'
        ]);
    });

    it('paging clears nothing and opens nothing', () => {
        const onSelectHero = vi.fn();
        const view = mount({ onSelectHero });
        ['Mining', 'Forestry', 'Fishing', 'Cooking'].forEach((s, i) => level('h1', s, i, i + 1));
        fireEvent.click(view.container.querySelector('[data-bar-bubbles="h1"] [data-bar-bubble-older]'));
        act(() => { vi.advanceTimersByTime(BAR_BUBBLE_FADE_MS * 4); });
        expect(bubbles(view, 'h1')).toEqual(['LVL UP! 1 Mining!']);
        expect(onSelectHero).not.toHaveBeenCalled();
    });

    it('shows no arrows with three bubbles or fewer', () => {
        const view = mount();
        ['Mining', 'Forestry', 'Fishing'].forEach((s, i) => level('h1', s, i, i + 1));
        expect(view.container.querySelector('[data-bar-bubbles="h1"] [data-bar-bubble-older]')).toBeNull();
    });

    it('a new or loaded game empties them; a dev time-skip does not', () => {
        const view = mount();
        level('h1', 'Mining', 24, 25);
        act(() => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'dev_time_skip' }); });
        expect(bubbles(view, 'h1')).toEqual(['LVL UP! 25 Mining!']);
        act(() => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' }); });
        expect(bubbles(view, 'h1')).toEqual([]);
    });
});

describe('the bar is laid out for eight heroes', () => {
    it('has no backdrop: the mat\'s edge with one thin line', () => {
        const view = mount();
        const dock = view.container.querySelector('[data-bottom-hero-dock]');
        expect(dock.className.split(' ').filter(c => c.startsWith('bg-'))).toEqual([]);
        expect(dock.className).toContain('border-t');
    });

    it('gives every hero the same slot, and keeps each hero\'s bubbles inside it', () => {
        GameState.state.heroes = Array.from({ length: 8 }, (_, i) => hero(`h${i + 1}`, `Hero ${i + 1}`));
        const view = mount();
        const slots = [...view.container.querySelectorAll('[data-dock-slot]')];
        expect(slots).toHaveLength(8);
        for (const s of slots) expect(s.style.flex).toBe(`0 1 ${DOCK_SLOT_PX}px`);
        // Eight full slots fit the 1600 px window the draw bench uses, beside the nav (150 px)
        // and the notification strip (28 px), with the bar's own padding.
        expect(DOCK_SLOT_PX * 8).toBeLessThanOrEqual(1600 - 150 - 28 - 16);
        level('h3', 'Mining', 24, 25);
        const stack = view.container.querySelector('[data-bar-bubbles="h3"]');
        // Never wider than the hero's own slot, so neighbours' bubbles cannot overlap.
        expect(stack.style.maxWidth).toBe('100%');
        expect(figure(view, 'h3').contains(stack)).toBe(true);
    });
});
