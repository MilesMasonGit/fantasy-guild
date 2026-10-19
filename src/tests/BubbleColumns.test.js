// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { DEPLETED_TTL_MS } from '../ui/components/board/heroSpeech.js';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import { columnPlace, STACK_GAP_PX } from '../ui/components/board/speechColumns.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * Two sources over one Token: the hero working it says something (`HeroBubbleLayer`) while the
 * Token has a callout up (`CalloutLayer`). They stack in one column, the hero's stack nearest
 * the head and the callouts on top of it, with the gap bubbles of one source use; they never
 * draw over each other.
 */

const h = React.createElement;

// jsdom lays nothing out: give every hero stack a real size, as a browser would measure it.
const STACK_W = 120;
const STACK_H = 26;
const realW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const realH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get() { return this.hasAttribute?.('data-hero-bubble-stack') ? STACK_W : 0; } });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return this.hasAttribute?.('data-hero-bubble-stack') ? STACK_H : 0; } });
});
afterAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realW);
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', realH);
});

beforeEach(() => {
    vi.useFakeTimers();
    GameState.initNew();
    clearMat();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

/** The first `translate(xpx, ypx)` of an element's transform. */
const pointOf = (el) => {
    const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(el.style.transform);
    return { x: Number(m[1]), y: Number(m[2]) };
};
const heroStack = (c, heroId) => c.querySelector(`[data-hero-bubble-stack="${heroId}"]`);
const calloutGroup = (c) => c.querySelector('[data-callout]').parentElement;
const mat = (heroes) => h('div', null, h(CalloutLayer), h(HeroBubbleLayer, { heroes }));
const spawnFrom = (token) => act(() => {
    EventBus.publish(BOARD_EVENTS.TOKEN_SPAWNED, { spawnerId: token.id, instanceId: 'tok_new', typeId: 'x', name: 'Oak Tree' });
});
/**
 * The hero says something: they used a Token up (a moment, up for `DEPLETED_TTL_MS`). A
 * millisecond passes first, as in play: the layer redraws on the clock it is told.
 */
const speak = (heroId) => act(() => {
    vi.advanceTimersByTime(1);
    EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: 'tok_gone', typeId: 'fixture_producer', exhaustedBy: heroId });
});

describe('a hero and the Token they work, both speaking', () => {
    it('stack in one column: the callouts sit on top of the hero\'s stack, the standard gap apart', () => {
        const forest = placeAt('fixture_producer', 600, 500);
        // Where a hero stands to work it: beside it, the art radius and the stand gap away.
        const heroes = [{ heroId: 'h1', state: 'working', x: 504, y: 500, moving: false, tokenId: forest.id }];
        const { container } = render(mat(heroes));
        speak('h1');
        spawnFrom(forest);

        const hero = pointOf(heroStack(container, 'h1'));
        const heroBox = { left: hero.x - STACK_W / 2, right: hero.x + STACK_W / 2, top: hero.y - STACK_H, bottom: hero.y };
        const callout = pointOf(calloutGroup(container));
        // The callouts' bottom edge is `callout.y`; everything of theirs is above it.
        expect(callout.y).toBe(heroBox.top - STACK_GAP_PX);
        expect(callout.y).toBeLessThan(heroBox.top);
        // One column: centred on the hero's stack.
        expect(callout.x).toBe(hero.x);
    });

    it('a hero who starts speaking under a callout already up lifts it; once they stop, callouts sit over the Token again', () => {
        const forest = placeAt('fixture_producer', 600, 500);
        const heroes = [{ heroId: 'h1', state: 'working', x: 504, y: 500, moving: false, tokenId: forest.id }];
        const { container } = render(mat(heroes));
        spawnFrom(forest);
        const alone = pointOf(calloutGroup(container));
        expect(alone).toEqual({ x: 600, y: 500 - 64 - 6 });

        speak('h1');
        const hero = pointOf(heroStack(container, 'h1'));
        expect(pointOf(calloutGroup(container))).toEqual({ x: hero.x, y: hero.y - STACK_H - STACK_GAP_PX });

        // The moment lapses (the first callout with it); the next callout sits where it did alone.
        act(() => { vi.advanceTimersByTime(DEPLETED_TTL_MS + 600); });
        expect(heroStack(container, 'h1')).toBeNull();
        spawnFrom(forest);
        expect(pointOf(calloutGroup(container))).toEqual(alone);
    });
});

describe('everything else is where it was', () => {
    it('a callout over a Token with no speaking hero sits over the Token', () => {
        const forest = placeAt('fixture_producer', 600, 500);
        const other = placeAt('fixture_producer', 200, 500);
        // A hero speaking at ANOTHER Token, and one speaking with no Token at all.
        const heroes = [
            { heroId: 'h1', state: 'working', x: 296, y: 500, moving: false, tokenId: other.id },
            { heroId: 'h2', state: 'idle', x: 900, y: 500, moving: false, tokenId: null }
        ];
        const { container } = render(mat(heroes));
        speak('h1');
        speak('h2');
        spawnFrom(forest);
        expect(pointOf(calloutGroup(container))).toEqual({ x: 600, y: 500 - 64 - 6 });
    });

    it('a hero speaks where they did, callout or none', () => {
        const forest = placeAt('fixture_producer', 600, 500);
        const heroes = [{ heroId: 'h1', state: 'working', x: 504, y: 500, moving: false, tokenId: forest.id }];
        const { container } = render(mat(heroes));
        speak('h1');
        const before = heroStack(container, 'h1').style.transform;
        spawnFrom(forest);
        expect(heroStack(container, 'h1').style.transform).toBe(before);
    });

    it('callouts of one Token still share one group, the same gap apart, newest on top', () => {
        const forest = placeAt('fixture_producer', 600, 500);
        const heroes = [{ heroId: 'h1', state: 'working', x: 504, y: 500, moving: false, tokenId: forest.id }];
        const { container } = render(mat(heroes));
        speak('h1');
        spawnFrom(forest);
        act(() => { EventBus.publish(BOARD_EVENTS.EFFECT_FIRED, { instanceId: forest.id, title: 'Bountiful' }); });
        const callouts = [...container.querySelectorAll('[data-callout]')];
        expect(callouts).toHaveLength(2);
        expect(callouts[0].parentElement).toBe(callouts[1].parentElement);
        expect(callouts[0].parentElement.className).toMatch(/flex-col-reverse/);
        expect(callouts[0].parentElement.className).toMatch(/\bgap-1\b/);
        expect(heroStack(container, 'h1').className).toMatch(/\bgap-1\b/);
    });
});

describe('columnPlace', () => {
    it('with no hero column: the callouts keep their own place', () => {
        expect(columnPlace({ x: 600, top: 430 }, null)).toEqual({ x: 600, top: 430 });
    });
    it('on a hero column: centred on it, the standard gap above its top', () => {
        expect(columnPlace({ x: 600, top: 430 }, { x: 504, top: 400 })).toEqual({ x: 504, top: 400 - STACK_GAP_PX });
    });
    it('the gap is the one bubbles of one source use (Tailwind gap-1)', () => {
        expect(STACK_GAP_PX).toBe(4);
    });
});
