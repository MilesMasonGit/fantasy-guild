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
import { SPAWN_MS } from '../ui/components/board/spawnMotion.js';
import { BEATEN_TTL_MS } from '../ui/components/board/heroSpeech.js';
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

describe('the refund callout', () => {
    it('says what came back where the Foundation stood, in the plain look', () => {
        const { container } = render(h(CalloutLayer));
        act(() => {
            EventBus.publish(ENGINE_EVENTS.TOKEN_REFUNDED, {
                typeId: 'fixture_producer', instanceId: 'tok_gone', x: 400, y: 300, heroId: null,
                price: [{ itemId: 'item_oak_wood', quantity: 15 }, { itemId: 'item_stone', quantity: 2 }]
            });
        });
        const bubble = container.querySelector('[data-callout]');
        expect(bubble.textContent).toBe('Refunded 15 Oak Wood, 2 Stone');
        expect(bubble.parentElement.style.transform).toContain('translate(400px');
        expect(calloutText.refunded([])).toBe('Refunded');
    });
});

describe('the spawn callout', () => {
    it('says "! Spawned {name}" over the spawner as the new Token lands, and fades on its own', () => {
        const forest = placeAt('fixture_producer', 600, 500);
        const { container } = render(h(CalloutLayer));
        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_SPAWNED, { spawnerId: forest.id, instanceId: 'tok_new', typeId: 'x', name: 'Oak Tree' });
        });
        // Not over the hop out of the spawner (T-155): it waits for the landing.
        act(() => { vi.advanceTimersByTime(SPAWN_MS - 1); });
        expect(container.querySelector('[data-callout]')).toBeNull();
        act(() => { vi.advanceTimersByTime(1); });
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
        act(() => { vi.advanceTimersByTime(SPAWN_MS); });
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

describe('a Summoned worker spent: a popup where it stood', () => {
    it('"{name} is spent" over where it stood, gone by itself; one replaced on its Circle says nothing', () => {
        const { container } = render(h(CalloutLayer));
        act(() => {
            EventBus.publish(BOARD_EVENTS.SUMMON_CHANGED, { heroId: 's1', typeId: 'k5_slime', change: 'left', reason: 'replaced', name: 'Summoned Small Slime', x: 300, y: 400 });
        });
        expect(container.querySelector('[data-callout]')).toBeNull();
        act(() => {
            EventBus.publish(BOARD_EVENTS.SUMMON_CHANGED, { heroId: 's1', typeId: 'k5_slime', change: 'spent', charges: 0, name: 'Summoned Small Slime' });
        });
        expect(container.querySelector('[data-callout]')).toBeNull();
        act(() => {
            EventBus.publish(BOARD_EVENTS.SUMMON_CHANGED, { heroId: 's1', typeId: 'k5_slime', change: 'left', reason: 'spent', name: 'Summoned Small Slime', x: 300, y: 400 });
        });
        const bubble = container.querySelector('[data-callout]');
        expect(bubble.textContent).toBe('Summoned Small Slime is spent');
        expect(bubble.parentElement.style.transform).toContain('translate(300px');
        act(() => { vi.advanceTimersByTime(CALLOUT_MS + 50); });
        expect(container.querySelector('[data-callout]')).toBeNull();
    });
});

describe('a Token used up: a popup where it stood', () => {
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

    it('a Token used up is a popup where it stood, "{name} used up", and no hero says it', () => {
        const { container } = render(h('div', null, h(CalloutLayer), h(HeroBubbleLayer, { heroes })));
        later();
        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: 'o', x: 420, y: 300, typeId: 'fixture_producer', exhaustedBy: 'h2' });
        });
        const bubble = container.querySelector('[data-callout]');
        expect(bubble.textContent).toBe('Fixture Producer used up');
        expect(bubble.parentElement.style.transform).toContain('translate(420px');
        expect(stackOf(container, 'h2')).toEqual([]);
        expect(calloutText.usedUp('Oak Forest')).toBe('Oak Forest used up');
        act(() => { vi.advanceTimersByTime(CALLOUT_MS + 50); });
        expect(container.querySelector('[data-callout]')).toBeNull();
    });

    it('is said even when no hero used it up', () => {
        const { container } = render(h('div', null, h(CalloutLayer), h(HeroBubbleLayer, { heroes })));
        later();
        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: 'o', x: 420, y: 300, typeId: 'fixture_producer', exhaustedBy: null });
        });
        expect(container.querySelector('[data-callout]').textContent).toBe('Fixture Producer used up');
        expect(container.querySelector('[data-hero-bubble]')).toBeNull();
    });

    it('an enemy is not used up: the hero who beat it says "{name} Defeated", and it goes by itself', () => {
        const { container } = render(h('div', null, h(CalloutLayer), h(HeroBubbleLayer, { heroes })));
        later();
        act(() => {
            EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: 'e', x: 420, y: 300, typeId: 'fixture_enemy', exhaustedBy: 'h2' });
        });
        expect(container.querySelector('[data-callout]')).toBeNull();
        expect(stackOf(container, 'h2')).toEqual(['Fixture Enemy Defeated']);
        expect(stackOf(container, 'h1')).toEqual([]);
        act(() => { vi.advanceTimersByTime(BEATEN_TTL_MS + 600); });
        expect(stackOf(container, 'h2')).toEqual([]);
    });
});

describe('level-ups on the mat', () => {
    it('are no longer a LVL UP! speech line: the hero says nothing', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes }));
        later();
        act(() => { EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId: 'h1', skillId: 'mining', skillName: 'Mining', oldLevel: 24, newLevel: 25 }); });
        expect(stackOf(container, 'h1')).toEqual([]);
        expect(container.textContent).not.toMatch(/LVL UP/i);
        // The level-up floats instead (LevelUpFloat.test.js).
        expect(container.querySelector('[data-hero-bubble-stack="h1"] [data-level-float="mining"]')).not.toBeNull();
    });
});

describe('a hero left with no work in range', () => {
    it('says "Nothing to work here." once, over their head, and it goes by itself', () => {
        const { container, rerender } = render(h(HeroBubbleLayer, { heroes }));
        later();
        const idle = heroes.map(x => (x.heroId === 'h1' ? { ...x, state: 'idle' } : x));
        rerender(h(HeroBubbleLayer, { heroes: idle }));
        expect(stackOf(container, 'h1')).toEqual(['Nothing to work here.']);
        expect(stackOf(container, 'h2')).toEqual([]);
        act(() => { vi.advanceTimersByTime(5000 + 600); });
        expect(stackOf(container, 'h1')).toEqual([]);
    });
});
