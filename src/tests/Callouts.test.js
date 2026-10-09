// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as Charges from '../systems/board/Charges.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import { CALLOUT_MS, calloutText, addCallout, MAX_PER_ANCHOR, MAX_TOTAL } from '../ui/components/board/callouts.js';
import { addMoment, levelUpFrom, momentText, DEPLETED_TTL_MS } from '../ui/components/board/heroSpeech.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * Callouts instead of alerts: the quick popups (spawn, effect, refused drop), and what a hero
 * says (depletion, level-ups).
 */

const h = React.createElement;

beforeEach(() => {
    vi.useFakeTimers();
    GameState.initNew();
    clearMat();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

const heroes = [
    { heroId: 'h1', state: 'working', x: 300, y: 500, moving: false, tokenId: null, alert: null },
    { heroId: 'h2', state: 'working', x: 700, y: 500, moving: false, tokenId: null, alert: null }
];
// The layer re-reads on a changed clock; frozen fake time would never change it.
const later = () => act(() => { vi.advanceTimersByTime(10); });
const stackOf = (container, heroId) =>
    [...container.querySelectorAll(`[data-hero-bubble-stack="${heroId}"] [data-hero-bubble]`)].map(n => n.textContent);

describe('the spawn callout', () => {
    it('says "! Spawned {name}" over the spawner, and fades on its own', () => {
        const forest = placeAt('fixture_producer', 600, 500);
        const { container } = render(h(CalloutLayer));
        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_SPAWNED, { spawnerId: forest.id, instanceId: 'tok_new', typeId: 'x', name: 'Oak Tree' });
        });
        const bubble = container.querySelector('[data-callout]');
        expect(bubble.textContent).toBe('! Spawned Oak Tree');
        expect(calloutText.spawned('Oak Tree')).toBe('! Spawned Oak Tree');
        act(() => { vi.advanceTimersByTime(CALLOUT_MS + 50); });
        expect(container.querySelector('[data-callout]')).toBeNull();
    });

    it('is drawn over the spawner, not over the new Token', () => {
        const forest = placeAt('fixture_producer', 600, 500);
        const { container } = render(h(CalloutLayer));
        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_SPAWNED, { spawnerId: forest.id, instanceId: 'tok_new', typeId: 'x', name: 'Oak Tree' });
        });
        const group = container.querySelector('[data-callout]').parentElement;
        expect(group.style.transform).toContain('translate(600px');
    });
});

describe('the refused-drop callout', () => {
    it('says the reason at the spot the drop was aimed at', () => {
        const { container } = render(h(CalloutLayer));
        act(() => {
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, {
                x: 410, y: 420, severity: 'disallow', type: 'drop_rejected', title: 'Drop Rejected: Oak', rulesText: 'No room here', message: 'x'
            });
        });
        expect(container.querySelector('[data-callout]').textContent).toBe('No room here');
    });

    it('nothing else the engine alerts about is drawn', () => {
        const { container } = render(h(CalloutLayer));
        act(() => {
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, { x: 1, y: 1, severity: 'red', type: 'token_exhausted', message: 'Token Exhausted: Oak' });
            EventBus.publish(BOARD_EVENTS.TILE_EVENT_ALERT, { instanceId: 'a', severity: 'green', type: 'token_restocked', title: 'Restocked from X' });
        });
        expect(container.querySelector('[data-callout]')).toBeNull();
    });
});

describe('callout stacking', () => {
    it('keeps at most a few per anchor and a bounded total', () => {
        let list = [];
        for (let i = 0; i < 10; i++) list = addCallout(list, { id: i, key: 't:a' });
        expect(list).toHaveLength(MAX_PER_ANCHOR);
        expect(list[list.length - 1].id).toBe(9);
        let many = [];
        for (let i = 0; i < 100; i++) many = addCallout(many, { id: i, key: `t:${i}` });
        expect(many).toHaveLength(MAX_TOTAL);
    });
});

describe('depletion is said by the hero who used the Token up', () => {
    it('the engine names that hero on TOKEN_DEPLETED', () => {
        const oak = placeAt('fixture_producer', 600, 500);
        oak.usesRemaining = 1;
        const seen = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, p => seen.push(p));
        Charges.applyDelta(oak, -1, { heroId: 'h2' });
        off();
        expect(seen).toHaveLength(1);
        expect(seen[0].exhaustedBy).toBe('h2');
    });

    it('a depletion with no hero behind it names nobody', () => {
        const oak = placeAt('fixture_producer', 600, 500);
        oak.usesRemaining = 1;
        const seen = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, p => seen.push(p));
        Charges.applyDelta(oak, -1);
        off();
        expect(seen[0].exhaustedBy).toBeNull();
    });

    it('only that hero says "{name} Depleted", and it goes by itself', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: 'o', x: 1, y: 1, typeId: 'fixture_producer', exhaustedBy: 'h2' });
        });
        expect(stackOf(container, 'h2')).toEqual(['Fixture Producer Depleted']);
        expect(stackOf(container, 'h1')).toEqual([]);
        expect(momentText.depleted('Oak Tree')).toBe('Oak Tree Depleted');
        act(() => { vi.advanceTimersByTime(DEPLETED_TTL_MS + 600); });
        expect(stackOf(container, 'h2')).toEqual([]);
    });

    it('nobody speaks when no hero used it up', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: 'o', x: 1, y: 1, typeId: 'fixture_producer', exhaustedBy: null });
        });
        expect(container.querySelector('[data-hero-bubble]')).toBeNull();
    });
});

describe('level-ups on the mat', () => {
    const level = (heroId, skillName, oldLevel, newLevel) => {
        later();
        act(() => { EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId, skillName, oldLevel, newLevel }); });
    };

    it('one level reads "LVL UP! 25 Mining!" with no count', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        level('h1', 'Mining', 24, 25);
        expect(stackOf(container, 'h1')).toEqual(['LVL UP! 25 Mining!']);
    });

    it('quick level-ups coalesce into one bubble with the total gained', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        for (let l = 21; l <= 25; l++) level('h1', 'Mining', l - 1, l);
        expect(stackOf(container, 'h1')).toEqual(['LVL UP! 25 Mining! (+5)']);
    });

    it('counts per hero and per skill', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        level('h1', 'Mining', 9, 10);
        level('h1', 'Forestry', 3, 4);
        level('h2', 'Mining', 19, 20);
        level('h1', 'Mining', 10, 11);
        expect(stackOf(container, 'h1')).toEqual(['LVL UP! 4 Forestry!', 'LVL UP! 11 Mining! (+2)']);
        expect(stackOf(container, 'h2')).toEqual(['LVL UP! 20 Mining!']);
    });

    it('starts the count again once the earlier bubble has gone', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        level('h1', 'Mining', 24, 25);
        act(() => { vi.advanceTimersByTime(6000); });
        level('h1', 'Mining', 25, 26);
        expect(stackOf(container, 'h1')).toEqual(['LVL UP! 26 Mining!']);
    });

    it('levelUpFrom reads the start of the live bubble, else the level it started at', () => {
        const list = addMoment([], { key: 'level:Mining', text: 'x', from: 20 }, 0);
        expect(levelUpFrom(list, 'level:Mining', 24, 100)).toBe(20);
        expect(levelUpFrom(list, 'level:Forestry', 4, 100)).toBe(4);
        expect(levelUpFrom(list, 'level:Mining', 24, 1e9)).toBe(24);
    });
});

describe('a hero left with no work in range', () => {
    it('says "No work in range." once, over their head, and it goes by itself', () => {
        const { container, rerender } = render(h(HeroBubbleLayer, { heroes }));
        later();
        const idle = heroes.map(x => (x.heroId === 'h1' ? { ...x, state: 'idle' } : x));
        rerender(h(HeroBubbleLayer, { heroes: idle }));
        expect(stackOf(container, 'h1')).toEqual(['No work in range.']);
        expect(stackOf(container, 'h2')).toEqual([]);
        act(() => { vi.advanceTimersByTime(5000 + 600); });
        expect(stackOf(container, 'h1')).toEqual([]);
    });
});
