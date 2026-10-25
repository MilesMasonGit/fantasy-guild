// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import { MatHero, HERO_BAR_LINGER_MS } from '../ui/components/board/MatHero.jsx';
import { healthFraction, healthText, healthPercent, healthFillPx, enemyBarPlace, heroBarPlace, HP_BAR } from '../ui/components/board/healthBar.js';
import { setDrawn, resetDrawSwitches } from '../ui/dev/perf/drawSwitches.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { resetMatTuning } from '../config/matTuning.js';
import { restHover } from './fixtures/hoverRest.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Health bars show only when they say something (brief 120): over a hero who is hurt, fighting
 * or hovered; over an enemy in a fight (the only time it is hurt: a fight that ends heals it) or
 * hovered. Full health and nothing going on: no bar. The number and the percentage are written
 * above the bar, `17 · 57%` (owner, 2026-10-25, the combat screen's option B).
 */

registerTokenTypes({
    fixture_hb_bear: {
        id: 'fixture_hb_bear', name: 'Fixture Bear', tokenType: 'enemy',
        rarity: 'common', uses: 20, sprite: 's_occult',
        enemy: { level: 2, style: 'melee' },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0 }
    }
});

const h = React.createElement;
const tree = (el) => h(DndContext, null, el);
const mount = (el) => render(tree(el));
const bar = (c, who) => c.querySelector(`[data-health-bar="${who}"]`);
const progress = (p) => act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_e', ...p }); });
const fightProgress = (cur, max = 50) => progress({ percent: 0, combat: true, enemyHp: cur, enemyMaxHp: max });
const tip = () => document.body.querySelector('[data-bubble-tip]');

afterEach(() => { cleanup(); resetDrawSwitches(); });

describe('the rules, pure', () => {
    it('fraction is clamped, and a bar with no max is empty', () => {
        expect(healthFraction(25, 50)).toBe(0.5);
        expect(healthFraction(-5, 50)).toBe(0);
        expect(healthFraction(80, 50)).toBe(1);
        expect(healthFraction(1, 0)).toBe(0);
    });

    it('the number reads "health · percent", whole, never below 0, with separators; percent rounds halves up', () => {
        expect(healthText(34, 50)).toBe('34 · 68%');
        expect(healthText(-3, 50)).toBe('0 · 0%');
        expect(healthText(33.6, 50)).toBe('34 · 67%');
        expect(healthText(1500, 2000)).toBe('1,500 · 75%');
        expect(healthText(17, 30)).toBe('17 · 57%');
        expect(healthPercent(1, 8)).toBe(13);          // 12.5 rounds up
        expect(healthPercent(5, 0)).toBe(0);
    });

    it('the fill moves in whole art pixels (2 plate pixels)', () => {
        expect(healthFillPx(17, 30)).toBe(36);          // 57 % of 32 steps is 18.1: 18 steps
        expect(healthFillPx(1, 100) % HP_BAR.STEP).toBe(0);
        expect(healthFillPx(30, 30)).toBe(HP_BAR.W);
    });

    it('an enemy bar sits centred over the box, wholly above it, sized in plate pixels', () => {
        const p = enemyBarPlace(128);
        expect(p.left * 2 + p.width).toBe(128);
        expect(p.top + HP_BAR.H).toBeLessThan(0);
        const big = enemyBarPlace(142, 1.25);
        expect(big.width).toBe(HP_BAR.W * 1.25);
        expect(big.top).toBe(-(HP_BAR.H + HP_BAR.GAP) * 1.25);
        const hero = heroBarPlace(128, 1.25);
        expect(hero.width).toBe(HP_BAR.W * 1.25);
    });
});

describe('the enemy bar', () => {
    const fighting = { typeId: 'fixture_hb_bear', instanceId: 'tok_e', heroId: 'hero_1', alert: null, usesRemaining: null };
    const idle = { ...fighting, heroId: null };
    const props = (extra = {}) => ({ instanceId: 'tok_e', boxPx: 128, token: fighting, ...extra });

    it('shows when a fight starts, tracks the enemy HP, and no HP bubble exists', () => {
        const { container } = mount(h(TokenBubbles, props()));
        fightProgress(50);
        expect(bar(container, 'enemy').getAttribute('data-health-text')).toBe('50 · 100%');
        fightProgress(20);
        const b = bar(container, 'enemy');
        expect(b.getAttribute('data-health-text')).toBe('20 · 40%');
        expect(Number(b.getAttribute('data-health-fraction'))).toBeCloseTo(0.4, 2);
        expect(container.querySelector('[data-bubble="hp"]')).toBeNull();
        expect(container.querySelector('[data-ring="hp"]')).toBeNull();
    });

    it('leaves when the fight ends (the hero goes), though the enemy is not hovered', () => {
        const { container, rerender } = mount(h(TokenBubbles, props()));
        fightProgress(20);
        expect(bar(container, 'enemy')).not.toBeNull();
        rerender(tree(h(TokenBubbles, props({ token: idle }))));
        expect(bar(container, 'enemy')).toBeNull();
    });

    it('with no fight, hovering an enemy shows a full bar; leaving hides it', () => {
        const { container, rerender } = mount(h(TokenBubbles, props({ token: idle })));
        expect(bar(container, 'enemy')).toBeNull();
        rerender(tree(h(TokenBubbles, props({ token: idle, isHovered: true }))));
        const b = bar(container, 'enemy');
        expect(b).not.toBeNull();
        expect(Number(b.getAttribute('data-health-fraction'))).toBe(1);
        rerender(tree(h(TokenBubbles, props({ token: idle, isHovered: false }))));
        expect(bar(container, 'enemy')).toBeNull();
    });

    it('hovering a Token that is not an enemy shows no bar', () => {
        const { container } = mount(h(TokenBubbles, props({
            isHovered: true,
            token: { typeId: 'fixture_producer', instanceId: 'tok_e', heroId: null, alert: null }
        })));
        expect(bar(container, 'enemy')).toBeNull();
    });

    it('the number and percentage are written above the bar, with no tooltip', () => {
        const { container } = mount(h(TokenBubbles, props()));
        fightProgress(34);
        expect(bar(container, 'enemy').querySelector('[data-health-label]').textContent).toBe('34 · 68%');
        // Written above the bar, not on it: the label is not inside the bar's track.
        const track = bar(container, 'enemy').querySelector('[data-health-fill]').parentElement;
        expect(track.contains(bar(container, 'enemy').querySelector('[data-health-label]'))).toBe(false);
        fireEvent.pointerEnter(bar(container, 'enemy'));
        expect(tip()).toBeNull();
    });

    it('pressing the bar passes the press to the Token drag handle', () => {
        const onPointerDown = vi.fn();
        const { container } = mount(h(TokenBubbles, props({ dragProps: { onPointerDown } })));
        fightProgress(34);
        fireEvent.pointerDown(bar(container, 'enemy'));
        expect(onPointerDown).toHaveBeenCalled();
    });
});

describe('the hero bar', () => {
    beforeEach(() => {
        GameState.initNew();
        GameState.state.heroes = [{
            id: 'h1', name: 'h1', spriteId: 'recruit', status: 'idle', level: 5,
            skills: {}, hp: { current: 80, max: 100 }
        }];
    });
    const hero = (extra = {}) => h(MatHero, { heroId: 'h1', name: 'h1', sprite: 'recruit', left: 100, top: 100, z: 5, ...extra });

    it('shows while fighting, not otherwise', () => {
        const { container, rerender } = mount(hero());
        expect(bar(container, 'hero')).toBeNull();
        rerender(tree(hero({ fighting: true })));
        expect(bar(container, 'hero').getAttribute('data-health-text')).toBe('80 · 80%');
    });

    it('⭐ shows while hurt, or rested on; not at full health with nothing going on', () => {
        const { container, rerender } = mount(hero());
        expect(bar(container, 'hero')).toBeNull();
        rerender(tree(hero({ hurt: true })));
        expect(bar(container, 'hero').getAttribute('data-health-text')).toBe('80 · 80%');
        rerender(tree(hero({ hurt: false })));
        expect(bar(container, 'hero')).toBeNull();
        rerender(tree(hero({ rested: true })));
        expect(bar(container, 'hero')).not.toBeNull();
        rerender(tree(hero({ rested: false })));
        expect(bar(container, 'hero')).toBeNull();
    });

    it('lingers 3 s after the fight ends, then goes; a new fight cancels the countdown', () => {
        vi.useFakeTimers();
        try {
            const { container, rerender } = mount(hero({ fighting: true }));
            expect(bar(container, 'hero')).not.toBeNull();
            rerender(tree(hero({ fighting: false })));
            expect(bar(container, 'hero')).not.toBeNull();
            act(() => { vi.advanceTimersByTime(HERO_BAR_LINGER_MS - 100); });
            expect(bar(container, 'hero')).not.toBeNull();
            rerender(tree(hero({ fighting: true })));
            rerender(tree(hero({ fighting: false })));
            act(() => { vi.advanceTimersByTime(HERO_BAR_LINGER_MS - 100); });
            expect(bar(container, 'hero')).not.toBeNull();
            act(() => { vi.advanceTimersByTime(200); });
            expect(bar(container, 'hero')).toBeNull();
        } finally { vi.useRealTimers(); }
    });

    it('follows the hero HP as it drops, with the number on the bar', async () => {
        const { container } = mount(hero({ fighting: true }));
        await act(async () => {
            GameState.state.heroes[0].hp.current = 35;
            EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'test' });
        });
        expect(bar(container, 'hero').getAttribute('data-health-text')).toBe('35 · 35%');
        expect(bar(container, 'hero').querySelector('[data-health-label]').textContent).toBe('35 · 35%');
    });

    it('the bubbles draw switch turns it off', () => {
        setDrawn('bubbles', false);
        const { container } = mount(hero({ fighting: true }));
        expect(bar(container, 'hero')).toBeNull();
    });
});

describe('⭐ on the mat: the hero bar follows the hero’s health and the pointer', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    beforeEach(() => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        GameState.state.heroes = [{
            id: 'h1', name: 'h1', spriteId: 'recruit', status: 'idle', level: 5,
            skills: {}, hp: { current: 100, max: 100 }
        }];
    });

    it('none at full health; one once hurt; one while hovered at full health', async () => {
        Flags.plant('h1', { x: 600, y: 400 });
        const { container } = mount(h(MatBoard));
        const figure = container.querySelector('[data-board-hero="h1"]');
        expect(figure).not.toBeNull();
        expect(bar(container, 'hero')).toBeNull();

        await act(async () => {
            GameState.state.heroes[0].hp.current = 60;
            EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'test' });
        });
        expect(bar(container, 'hero').getAttribute('data-health-text')).toBe('60 · 60%');

        await act(async () => {
            GameState.state.heroes[0].hp.current = 100;
            EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, { source: 'test' });
        });
        expect(bar(container, 'hero')).toBeNull();

        vi.useFakeTimers();
        try {
            fireEvent.mouseEnter(figure);
            expect(bar(container, 'hero')).toBeNull();
            restHover();
            expect(bar(container, 'hero')).not.toBeNull();
            fireEvent.mouseLeave(figure);
            expect(bar(container, 'hero')).toBeNull();
        } finally { vi.useRealTimers(); }
    });
});
