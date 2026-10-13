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
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { TokenHitArt, COMBAT_ATTACK_EVENT } from '../ui/components/board/TokenHitArt.jsx';
import {
    HIT_ANIMATIONS, HIT_PERIOD_MS, STRIKE_DELAY_MS, STRIKE_FRAME, heroFrameAt
} from '../ui/components/board/hitAnimations.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **A worked Token's hit loop is not a layer of its own** (brief 60, P2-5). The loop is an
 * endless transform animation; Chrome put each one on its own composited layer, and then every
 * Token, hero, flag and name badge drawn over it had to be a layer too (30 of the 128 board's
 * ~60). `will-change: contents` on the element that loops tells Chrome to run its animations
 * on the main thread instead, so nothing is promoted. Chrome's layers cannot be seen from
 * jsdom: these guard the property that keeps them away, and that the loop still runs where and
 * when it did.
 */

const h = React.createElement;
const tree = (el) => h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el));

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

describe('the work loop runs where Chrome keeps it off the compositor', () => {
    it('⭐ the element that loops carries will-change: contents', () => {
        render(tree(h(TokenHitArt, { instanceId: 't1', skill: 'forestry', heroId: 'hero_1', active: true, tokenX: 500 }, h('span'))));
        expect(loops(anim.calls)).toHaveLength(1);
        expect(willChangeOf(loops(anim.calls)[0].el)).toBe('contents');
    });

    it('every work animation on the list does', () => {
        for (const skill of ['forestry', 'mining', 'fishing', 'farming', 'smithing', 'crafting', 'cooking', 'construction']) {
            cleanup();
            anim.calls.length = 0;
            render(tree(h(TokenHitArt, { instanceId: skill, skill, heroId: 'hero_1', active: true }, h('span'))));
            expect(loops(anim.calls), skill).toHaveLength(1);
            expect(willChangeOf(loops(anim.calls)[0].el), skill).toBe('contents');
        }
    });

    it('the loop still starts every turn on the hero’s strike frame, and stops when the hero does', () => {
        const { rerender, container } = render(tree(h(TokenHitArt, { instanceId: 't1', skill: 'mining', heroId: 'hero_7', active: true }, h('span'))));
        const [loop] = loops(anim.calls);
        expect(loop.options).toEqual({ duration: HIT_PERIOD_MS, iterations: Infinity });
        expect(heroFrameAt(loop.startTime, 'hero_7')).toBe(STRIKE_FRAME);

        // Stuck (an alert): no loop, and nothing left on the element.
        rerender(tree(h(TokenHitArt, { instanceId: 't1', skill: 'mining', heroId: 'hero_7', active: false }, h('span'))));
        expect(loop.cancel).toHaveBeenCalled();
        const el = container.querySelector('[data-token-hit="jitter"]');
        expect(el.getAttribute('data-token-hit-live')).toBeNull();
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

    it('a Token a hero works loops from an element with will-change: contents, and nothing above it up to its box asks for a layer', () => {
        const forest = BoardState.createTokenInstance('fixture_producer', tokenStartingUses('fixture_producer'));
        Placement.placeTokenAt(forest, AT);
        Flags.plant('h1', AT);
        expect(BoardState.workerOf(forest.id)).toBe('h1');

        const { container } = render(tree(h(MatBoard, {})));
        const live = container.querySelector(`[data-token-art][data-token-id="${forest.id}"] [data-token-hit-live="true"]`);
        expect(live).not.toBeNull();
        expect(loops(anim.calls).map(c => c.el)).toContain(live);
        expect(willChangeOf(live)).toBe('contents');
        for (let el = live.parentElement; el && !el.matches('[data-token-art]'); el = el.parentElement) {
            expect(willChangeOf(el)).toBe('');
        }
        expect(willChangeOf(live.closest('[data-token-art]'))).toBe('');
    });
});
