// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { EngineContext } from '../ui/context/EngineContext';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import { MatHero, HERO_BAR_LINGER_MS } from '../ui/components/board/MatHero.jsx';
import { healthFraction, healthText, enemyBarPlace, HEALTH_BAR_H_U } from '../ui/components/board/healthBar.js';
import { setDrawn, resetDrawSwitches } from '../ui/dev/perf/drawSwitches.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Health bars: one over a fighting hero, one over the enemy, the enemy's also while it is
 * hovered. The exact number shows on hover of the bar. The old enemy-HP bubble is gone.
 */

registerTokenTypes({
    fixture_hb_bear: {
        id: 'fixture_hb_bear', name: 'Fixture Bear', tokenType: 'enemy',
        rarity: 'common', uses: 20, sprite: 'skill_occult',
        enemy: { level: 2, style: 'melee' },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0 }
    }
});

const h = React.createElement;
const tree = (el) => h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el));
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

    it('the number reads cur/max, whole, never below 0, with separators', () => {
        expect(healthText(34, 50)).toBe('34/50');
        expect(healthText(-3, 50)).toBe('0/50');
        expect(healthText(33.6, 50)).toBe('34/50');
        expect(healthText(1500, 2000)).toBe('1,500/2,000');
    });

    it('an enemy bar sits centred over the box, wholly above it', () => {
        const p = enemyBarPlace(128);
        expect(p.left * 2 + p.width).toBe(128);
        expect(p.top + HEALTH_BAR_H_U).toBeLessThan(0);
    });
});

describe('the enemy bar', () => {
    const fighting = { typeId: 'fixture_hb_bear', instanceId: 'tok_e', heroId: 'hero_1', alert: null, usesRemaining: null };
    const idle = { ...fighting, heroId: null };
    const props = (extra = {}) => ({ instanceId: 'tok_e', boxPx: 128, token: fighting, ...extra });

    it('shows when a fight starts, tracks the enemy HP, and no HP bubble exists', () => {
        const { container } = mount(h(TokenBubbles, props()));
        fightProgress(50);
        expect(bar(container, 'enemy').getAttribute('data-health-text')).toBe('50/50');
        fightProgress(20);
        const b = bar(container, 'enemy');
        expect(b.getAttribute('data-health-text')).toBe('20/50');
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

    it('the exact number is drawn on the bar itself, with no tooltip', () => {
        const { container } = mount(h(TokenBubbles, props()));
        fightProgress(34);
        expect(bar(container, 'enemy').querySelector('[data-health-label]').textContent).toBe('34/50');
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
        expect(bar(container, 'hero').getAttribute('data-health-text')).toBe('80/100');
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
        expect(bar(container, 'hero').getAttribute('data-health-text')).toBe('35/100');
        expect(bar(container, 'hero').querySelector('[data-health-label]').textContent).toBe('35/100');
    });

    it('the bubbles draw switch turns it off', () => {
        setDrawn('bubbles', false);
        const { container } = mount(hero({ fighting: true }));
        expect(bar(container, 'hero')).toBeNull();
    });
});
