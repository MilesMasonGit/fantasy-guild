// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { TokenHitArt, COMBAT_ATTACK_EVENT } from '../ui/components/board/TokenHitArt.jsx';
import { HIT_ANIMATIONS, STRIKE_DELAY_MS } from '../ui/components/board/hitAnimations.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **A worked Token's hit loop is not a layer of its own** (brief 60, P2-5), **and no animation at
 * all** (T-198). As an endless transform animation Chrome put each one on its own composited layer,
 * and then every Token, hero, flag and name badge drawn over it had to be a layer too (30 of the 128
 * board's ~60). Kept on the main thread by `will-change: contents`, it then made a style pass in
 * every frame, through the long still part of its loop too. Now its poses are written on the sprite
 * clock (`fx/clockPoses.js`), which cannot be promoted. `will-change: contents` stays on the wrapper
 * for the one-off effects played on it. Chrome's layers cannot be seen from jsdom: these guard what
 * keeps them away, and that the loop still runs where and when it did.
 */

const h = React.createElement;
const tree = (el) => h(DndContext, null, el);

function stubAnimate() {
    const calls = [];
    const proto = window.HTMLElement.prototype;
    const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
    const original = proto.animate;
    proto.animate = function animate(keyframes, options) {
        const a = { keyframes, options, startTime: null, cancel: vi.fn(), el: this };
        calls.push(a);
        return a;
    };
    return { calls, restore() { if (had) proto.animate = original; else delete proto.animate; } };
}

const loops = (calls) => calls.filter(c => c.options.iterations === Infinity);
const willChangeOf = (el) => el.style.willChange || '';

let anim;
beforeEach(() => { anim = stubAnimate(); });
afterEach(() => { cleanup(); anim.restore(); vi.restoreAllMocks(); });

describe('the work loop stays off the compositor', () => {
    it('⭐ it is not an animation: nothing for Chrome to promote, or to run every frame', () => {
        const { container } = render(tree(h(TokenHitArt, { instanceId: 't1', skill: 'forestry', heroId: 'hero_1', active: true, tokenX: 500 }, h('span'))));
        expect(anim.calls).toHaveLength(0);
        const el = container.querySelector('[data-token-hit-live="true"]');
        expect(el.style.transform).toMatch(/^translate\(/);
        expect(willChangeOf(el)).toBe('contents');
    });

    it('no work animation on the list is one', () => {
        for (const skill of ['forestry', 'mining', 'fishing', 'farming', 'smithing', 'crafting', 'cooking', 'construction']) {
            cleanup();
            anim.calls.length = 0;
            const { container } = render(tree(h(TokenHitArt, { instanceId: skill, skill, heroId: 'hero_1', active: true }, h('span'))));
            expect(anim.calls, skill).toHaveLength(0);
            const el = container.querySelector('[data-token-hit-live="true"]');
            expect(el, skill).not.toBeNull();
            expect(willChangeOf(el), skill).toBe('contents');
        }
    });

    it('it stops when the hero does: nothing left on the element', () => {
        const { rerender, container } = render(tree(h(TokenHitArt, { instanceId: 't1', skill: 'mining', heroId: 'hero_7', active: true }, h('span'))));
        const el = container.querySelector('[data-token-hit="jitter"]');
        expect(el.style.transform).not.toBe('');

        // Stuck (an alert): no loop, and nothing left on the element.
        rerender(tree(h(TokenHitArt, { instanceId: 't1', skill: 'mining', heroId: 'hero_7', active: false }, h('span'))));
        expect(el.getAttribute('data-token-hit-live')).toBeNull();
        expect(el.style.transform).toBe('');
        expect(willChangeOf(el)).toBe('');
    });

    it('a Token nobody works, or whose skill plays nothing, loops nothing and carries nothing', () => {
        const { container } = render(tree(h(React.Fragment, null,
            h(TokenHitArt, { instanceId: 'a', skill: 'forestry', heroId: null, active: false }, h('span')),
            h(TokenHitArt, { instanceId: 'b', skill: 'commerce', heroId: 'hero_1', active: true }, h('span'))
        )));
        expect(anim.calls).toHaveLength(0);
        for (const el of container.querySelectorAll('div')) expect(willChangeOf(el)).toBe('');
    });
});

describe('combat keeps its knockback as it was', () => {
    it('one knockback per landed hit, on the strike frame, from an element with no will-change', () => {
        vi.spyOn(BoardState, 'heroBodyOf').mockReturnValue({ x: 700, side: 1 });
        const { container } = render(tree(h(TokenHitArt, { instanceId: 'enemy_1', skill: 'combat', heroId: 'hero_1', active: true, tokenX: 600 }, h('span'))));
        expect(anim.calls).toHaveLength(0);
        act(() => EventBus.publish(COMBAT_ATTACK_EVENT, { instanceId: 'enemy_1', heroId: 'hero_1', hit: true }));
        expect(anim.calls).toHaveLength(1);
        expect(anim.calls[0].options).toEqual({ duration: HIT_ANIMATIONS.knockback.ms, delay: STRIKE_DELAY_MS });
        expect(willChangeOf(container.querySelector('[data-token-hit="knockback"]'))).toBe('');
    });
});

describe('⭐ on the mat', () => {
    const AT = { x: 400, y: 300 };
    beforeAll(() => Flags.init());
    afterAll(() => Flags.teardown());
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        GameState.state.heroes = [
            { id: 'h1', name: 'h1', status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }
        ];
    });

    it('a Token a hero works loops on the clock, its wrapper with will-change: contents, and nothing above it up to its box asks for a layer', () => {
        const forest = BoardState.createTokenInstance('fixture_producer', tokenStartingUses('fixture_producer'));
        Placement.placeTokenAt(forest, AT);
        Orders.orderAt('h1', AT);
        expect(BoardState.workerOf(forest.id)).toBe('h1');

        const { container } = render(tree(h(MatBoard, {})));
        const live = container.querySelector(`[data-token-art][data-token-id="${forest.id}"] [data-token-hit-live="true"]`);
        expect(live).not.toBeNull();
        expect(loops(anim.calls)).toHaveLength(0);
        expect(live.style.transform).toMatch(/^translate\(/);
        expect(willChangeOf(live)).toBe('contents');
        for (let el = live.parentElement; el && !el.matches('[data-token-art]'); el = el.parentElement) {
            expect(willChangeOf(el)).toBe('');
        }
        expect(willChangeOf(live.closest('[data-token-art]'))).toBe('');
    });
});
