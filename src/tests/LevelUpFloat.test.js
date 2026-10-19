// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { CatchUpOverlay } from '../ui/components/hud/CatchUpOverlay.jsx';
import {
    FLOAT_MS, FLASH_MS, ROLL_MAX_VALUES, rollValues, addFloat, floatsOf, clearAllFloats
} from '../ui/components/board/levelUpFloats.js';

vi.mock('../systems/core/CatchUp.js', () => ({
    canUndo: vi.fn(() => false),
    undoLast: vi.fn(() => false),
    forgetUndo: vi.fn()
}));

/**
 * The level-up moment on the mat: the levelled skill's icon and number float over the hero for
 * about 30 s; the old number flashes gold and rolls up to the new one; several sit side by side;
 * after time away they roll from old to new. No LVL UP! line.
 */

const h = React.createElement;

beforeEach(() => {
    vi.useFakeTimers();
    clearAllFloats();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

const heroes = [
    { heroId: 'h1', state: 'working', x: 300, y: 500, moving: false, tokenId: null, alert: null },
    { heroId: 'h2', state: 'working', x: 700, y: 500, moving: false, tokenId: null, alert: null }
];
const later = (ms = 10) => act(() => { vi.advanceTimersByTime(ms); });
const level = (heroId, skillId, skillName, oldLevel, newLevel) =>
    act(() => { EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId, skillId, skillName, oldLevel, newLevel }); });
const floatsIn = (c, heroId) => [...c.querySelectorAll(`[data-hero-bubble-stack="${heroId}"] [data-level-float]`)];
const values = (el) => [...el.querySelectorAll('[data-level-value]')].map(n => Number(n.textContent));

describe('a level-up floats over the hero', () => {
    it('shows the skill icon (2×) and the number above that hero only, with no LVL UP! line', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        level('h1', 'mining', 'Mining', 24, 25);
        const [f] = floatsIn(container, 'h1');
        expect(f.getAttribute('data-level-float')).toBe('mining');
        const icon = f.querySelector('img');
        expect(icon.getAttribute('src')).toBe('/assets/skills/s_mining.png');
        // 16 art pixels at the mat's 2× at a fit of 1.
        expect(icon.style.width).toBe('32px');
        expect(icon.style.imageRendering).toBe('pixelated');
        expect(f.querySelector('[data-level-window]').className).toContain('ui-text-display');
        expect(floatsIn(container, 'h2')).toEqual([]);
        expect(container.textContent).not.toMatch(/LVL UP/i);
        expect(container.querySelector('[data-hero-bubble]')).toBeNull();
        // In the hero's own stack, so it hangs over the head and follows them.
        const stack = container.querySelector('[data-hero-bubble-stack="h1"]');
        expect(stack.style.transform).toContain('translate(300px');
    });

    it('stays about 30 s, fading at the end, then is gone', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        level('h1', 'mining', 'Mining', 24, 25);
        const f = floatsIn(container, 'h1')[0];
        expect(f.className).toContain('gi-lvl-float');
        expect(parseFloat(f.style.animationDelay)).toBeGreaterThan(FLOAT_MS - 1000);
        later(FLOAT_MS - 1000);
        expect(floatsIn(container, 'h1')).toHaveLength(1);
        later(1500);
        expect(floatsIn(container, 'h1')).toHaveLength(0);
        expect(container.querySelector('[data-hero-bubble-stack="h1"]')).toBeNull();
    });

    it('two skills at once sit side by side, each on its own timer', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        level('h1', 'mining', 'Mining', 24, 25);
        later(10_000);
        level('h1', 'logging', 'Logging', 9, 10);
        const row = container.querySelector('[data-hero-bubble-stack="h1"] [data-level-floats]');
        expect(row.className).toContain('flex');
        expect(row.className).not.toContain('flex-col');
        expect(floatsIn(container, 'h1').map(f => f.getAttribute('data-level-float'))).toEqual(['mining', 'logging']);
        later(FLOAT_MS - 10_000 + 600);
        expect(floatsIn(container, 'h1').map(f => f.getAttribute('data-level-float'))).toEqual(['logging']);
    });

    it('the old number flashes gold, then rolls up to the new one', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        level('h1', 'mining', 'Mining', 49, 50);
        const f = floatsIn(container, 'h1')[0];
        expect(values(f)).toEqual([49, 50]);
        const flash = f.querySelector('[data-level-flash]');
        expect(flash.textContent).toBe('49');
        expect(flash.className).toContain('gi-lvl-gold');
        expect(flash.className).toContain('gi-lvl-flash');
        const roll = f.querySelector('[data-level-roll]');
        expect(roll.className).toContain('gi-lvl-roll');
        expect(roll.style.animationDelay).toBe(`${FLASH_MS}ms`);
        expect(roll.style.animationTimingFunction).toMatch(/^steps\(/);
        expect(roll.style.getPropertyValue('--lvl-roll-y')).toBe('-50%');
    });

    it('several levels in one go roll from the first old number to the last new one', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        for (let l = 25; l <= 34; l++) level('h1', 'mining', 'Mining', l - 1, l);
        const f = floatsIn(container, 'h1')[0];
        expect(f.getAttribute('data-level-from')).toBe('24');
        expect(f.getAttribute('data-level-to')).toBe('34');
        const v = values(f);
        expect(v[0]).toBe(24);
        expect(v[v.length - 1]).toBe(34);
        expect(v.length).toBeLessThanOrEqual(ROLL_MAX_VALUES);
    });

    it('a skill levelling again after its roll rolls on from the number it shows', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        level('h1', 'mining', 'Mining', 24, 25);
        later(5000);
        level('h1', 'mining', 'Mining', 25, 26);
        const fs = floatsIn(container, 'h1');
        expect(fs).toHaveLength(1);
        expect(values(fs[0])).toEqual([25, 26]);
    });
});

describe('the float rules', () => {
    it('rollValues passes every level on a short jump and a few on a long one', () => {
        expect(rollValues(24, 25)).toEqual([24, 25]);
        expect(rollValues(3, 7)).toEqual([3, 4, 5, 6, 7]);
        const long = rollValues(1, 99);
        expect(long).toHaveLength(ROLL_MAX_VALUES);
        expect(long[0]).toBe(1);
        expect(long[long.length - 1]).toBe(99);
        expect([...long].sort((a, b) => a - b)).toEqual(long);
        expect(rollValues(5, 5)).toEqual([5]);
    });

    it('addFloat keeps one per skill in its place', () => {
        let list = addFloat([], { skillId: 'mining', skillName: 'Mining', oldLevel: 1, newLevel: 2 }, 0);
        list = addFloat(list, { skillId: 'logging', skillName: 'Logging', oldLevel: 1, newLevel: 2 }, 100);
        list = addFloat(list, { skillId: 'mining', skillName: 'Mining', oldLevel: 2, newLevel: 3 }, 5000);
        expect(list.map(f => [f.key, f.from, f.to])).toEqual([['mining', 2, 3], ['logging', 1, 2]]);
    });
});

describe('after time away', () => {
    const away = (show) => act(() => {
        EventBus.publish(ENGINE_EVENTS.CATCH_UP_FINISHED, {
            show,
            summary: { levelUps: [
                { heroId: 'h1', skillId: 'mining', skillName: 'Mining', from: 10, to: 14 },
                { heroId: 'h1', skillId: 'logging', skillName: 'Logging', from: 3, to: 4 }
            ] }
        });
        EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'catch_up' });
    });

    it('a silent catch-up floats its level-ups at once, rolling from old to new', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        away(false);
        const fs = floatsIn(container, 'h1');
        expect(fs.map(f => f.getAttribute('data-level-float'))).toEqual(['mining', 'logging']);
        expect(values(fs[0])).toEqual([10, 11, 12, 13, 14]);
    });

    it('a shown catch-up waits for "While you were away" to close, then rolls for its full time', () => {
        const overlay = render(h(CatchUpOverlay));
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        away(true);
        expect(floatsOf('h1')).toEqual([]);
        expect(floatsIn(container, 'h1')).toHaveLength(0);
        later(FLOAT_MS * 2);
        expect(floatsOf('h1')).toEqual([]);

        const closed = vi.fn();
        const off = EventBus.subscribe(UI_EVENTS.CATCH_UP_SUMMARY_CLOSED, closed);
        fireEvent.click(overlay.container.querySelector('[data-summary-close]'));
        off();
        expect(closed).toHaveBeenCalledTimes(1);
        expect(floatsIn(container, 'h1').map(values)).toEqual([[10, 11, 12, 13, 14], [3, 4]]);
        later(FLOAT_MS - 1000);
        expect(floatsIn(container, 'h1')).toHaveLength(2);
    });

    it('another save loading clears them', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        level('h1', 'mining', 'Mining', 24, 25);
        act(() => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' }); });
        later(600);
        expect(floatsIn(container, 'h1')).toHaveLength(0);
    });
});
