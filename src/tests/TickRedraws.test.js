// @vitest-environment jsdom
// ⚠️ First: it must be in place before React loads.
import { renders } from './fixtures/renderCounter.js';
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React, { memo } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { Board } from '../ui/components/board/Board.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { DndContext } from '@dnd-kit/core';
import * as Charges from '../systems/board/Charges.js';
import { TokenBubbles } from '../ui/components/board/TokenBubbles.jsx';
import { chargesText } from '../ui/components/board/workPlate.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';
import { ALERT, BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { DEPLETED_TTL_MS } from '../ui/components/board/heroSpeech.js';
import { FLOAT_MS, clearAllFloats } from '../ui/components/board/levelUpFloats.js';
import { useGameState } from '../ui/hooks/useGameState.js';
import { useTokenState } from '../ui/components/board/tokenEvents.js';
import { shareEqual } from '../ui/hooks/structuralShare.js';
import { clearMat, placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **What a tick changes is drawn; what it did not change is not.** The engine ticks ten times
 * a second and the stores re-read their slices on its events. A selector rebuilds its flat
 * projection on every read, so a list of eight flags with one changed used to reach React as
 * eight new objects, and all eight flags drew again (`bench/tick-commits.mjs` on S2: a hero
 * changing work redrew every flag, five components each). The stores now hand React the last
 * value's own objects for every part that did not change (`shareEqual`).
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('shareEqual', () => {
    it('equal values give back the previous value itself', () => {
        const prev = [{ id: 'a', n: 1, hp: { cur: 3, max: 5 } }, { id: 'b', n: 2, hp: { cur: 1, max: 5 } }];
        const next = [{ id: 'a', n: 1, hp: { cur: 3, max: 5 } }, { id: 'b', n: 2, hp: { cur: 1, max: 5 } }];
        expect(shareEqual(prev, next)).toBe(prev);
        expect(shareEqual({ x: 1, list: [1, 2] }, { list: [1, 2], x: 1 })).toEqual({ x: 1, list: [1, 2] });
        expect(shareEqual(NaN, NaN)).toBeNaN();
        const m = new Map([['k', 1]]);
        expect(shareEqual(m, new Map([['k', 1]]))).toBe(m);
    });

    it('one changed element: a new list, the other elements are the previous objects', () => {
        const prev = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'c', n: 3 }];
        const next = [{ id: 'a', n: 1 }, { id: 'b', n: 9 }, { id: 'c', n: 3 }];
        const out = shareEqual(prev, next);
        expect(out).not.toBe(prev);
        expect(out).toEqual(next);
        expect(out[0]).toBe(prev[0]);
        expect(out[1]).not.toBe(prev[1]);
        expect(out[2]).toBe(prev[2]);
    });

    it('a shifted list of records: each record pairs with its own by id, wherever it moved', () => {
        const prev = [{ heroId: 'a', n: 1 }, { heroId: 'b', n: 2 }, { heroId: 'c', n: 3 }, { heroId: 'd', n: 4 }];
        // 'b' removed, 'a' moved to the end and changed, 'e' new.
        const next = [{ heroId: 'c', n: 3 }, { heroId: 'd', n: 4 }, { heroId: 'e', n: 5 }, { heroId: 'a', n: 9 }];
        const out = shareEqual(prev, next);
        expect(out).toEqual(next);
        expect(out[0]).toBe(prev[2]);
        expect(out[1]).toBe(prev[3]);
        expect(out[2]).toBe(next[2]);
        expect(out[3]).not.toBe(prev[0]);
        // The same records in another order are a different list.
        const swapped = shareEqual(prev, [prev[1], prev[0], prev[2], prev[3]].map(x => ({ ...x })));
        expect(swapped).not.toBe(prev);
        expect(swapped[0]).toBe(prev[1]);
        expect(swapped[1]).toBe(prev[0]);
    });

    it('a changed nested field: the object is new, its unchanged parts are the previous ones', () => {
        const prev = { name: 'A', hp: { cur: 3, max: 5 }, tags: ['x'] };
        const next = { name: 'A', hp: { cur: 2, max: 5 }, tags: ['x'] };
        const out = shareEqual(prev, next);
        expect(out).toEqual(next);
        expect(out).not.toBe(prev);
        expect(out.hp).not.toBe(prev.hp);
        expect(out.tags).toBe(prev.tags);
    });

    it('lists that grow or shrink, keys that come or go', () => {
        const prev = [{ id: 'a' }, { id: 'b' }];
        const grown = shareEqual(prev, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
        expect(grown).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
        expect(grown[0]).toBe(prev[0]);
        expect(grown[1]).toBe(prev[1]);
        const shrunk = shareEqual(prev, [{ id: 'a' }]);
        expect(shrunk).toEqual([{ id: 'a' }]);
        expect(shrunk[0]).toBe(prev[0]);
        expect(shareEqual({ a: 1, b: 2 }, { a: 1 })).toEqual({ a: 1 });
        expect(shareEqual({ a: 1 }, { a: 1, b: undefined })).toEqual({ a: 1, b: undefined });
        expect(shareEqual(null, { a: 1 })).toEqual({ a: 1 });
        expect(shareEqual([1], { 0: 1 })).toEqual({ 0: 1 });
    });
});

describe('⭐ the stores: one changed element redraws its own child only', () => {
    // Rows count their renders by id.
    const drawn = new Map();
    const Row = memo(function Row({ item }) {
        drawn.set(item.id, (drawn.get(item.id) || 0) + 1);
        return h('li', null, `${item.id}:${item.n}`);
    });

    let store;
    beforeEach(() => {
        drawn.clear();
        store = { list: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }, { id: 'c', n: 3 }] };
    });
    afterEach(() => cleanup());

    it('useGameState: a flat projection of a list, one element changed', async () => {
        function List() {
            // Rebuilt on every read, as the contract asks.
            const list = useGameState(() => store.list.map(x => ({ id: x.id, n: x.n })), ['tick_test_changed']);
            return h('ul', null, list.map(item => h(Row, { key: item.id, item })));
        }
        const view = render(h(List));
        expect(Object.fromEntries(drawn)).toEqual({ a: 1, b: 1, c: 1 });

        store.list[1].n = 7;
        EventBus.publish('tick_test_changed');
        await flush();
        expect(view.container.textContent).toBe('a:1b:7c:3');
        expect(Object.fromEntries(drawn)).toEqual({ a: 1, b: 2, c: 1 });

        // Nothing changed: nothing draws.
        EventBus.publish('tick_test_changed');
        await flush();
        expect(Object.fromEntries(drawn)).toEqual({ a: 1, b: 2, c: 1 });
    });

    it('useTokenState: an unchanged part of a Token\'s projection keeps its identity', async () => {
        const seen = [];
        function One() {
            const s = useTokenState('tok1', () => ({ n: store.list[0].n, rest: store.list.slice(1).map(x => ({ id: x.id, n: x.n })) }),
                () => ({ byId: ['tok_test_changed'] }));
            seen.push(s.rest);
            return h('ul', null, s.rest.map(item => h(Row, { key: item.id, item })));
        }
        render(h(One));
        store.list[0].n = 5;
        await act(async () => { EventBus.publish('tok_test_changed', { instanceId: 'tok1' }); await Promise.resolve(); });
        expect(seen.length).toBe(2);
        expect(seen[1]).toBe(seen[0]);
        expect(Object.fromEntries(drawn)).toEqual({ b: 1, c: 1 });
    });
});

describe('⭐ on the mat: a change to one hero\'s flag redraws that flag alone', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    beforeEach(() => {
        vi.clearAllMocks();
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        clearMat();
        setLiveMatFit(1);
    });
    afterEach(async () => {
        renders.stop();
        await new Promise(r => setTimeout(r, 20));
        cleanup();
    });

    function scene() {
        const ids = ['h1', 'h2', 'h3', 'h4'];
        GameState.state.heroes = ids.map(id => ({
            id, name: `Hero ${id}`, spriteId: 'recruit', status: 'idle', level: 50,
            skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 }
        }));
        // Each on a row of its own: a flag moved sideways keeps its place in the stack.
        ids.forEach((id, i) => Flags.plant(id, { x: 300 + i * 400, y: 200 + i * 200 }));
        const view = render(
            h(DeckDndProvider, null,
                    h(Board, { onInspectToken: () => {}, onClearInspect: () => {} }))
        );
        view.container.querySelector('[data-board-origin]').getBoundingClientRect = () => box(0, 0, matW(), matH());
        view.container.querySelector('[data-mat-board]').getBoundingClientRect = () => box(0, 0, matW(), matH());
        return view;
    }

    it('a flag moved sideways: one FlagMark draws, not four', async () => {
        scene();
        await flush();
        expect(BoardState.heroesOnBoard().length).toBe(4);
        renders.start();
        act(() => { Flags.plant('h2', { x: 760, y: 400 }); });
        await flush();
        renders.stop();
        expect(BoardState.flagOf('h2')).toMatchObject({ x: 760, y: 400 });
        expect(renders.of('FlagMark'), JSON.stringify(renders.all())).toBe(1);
    });

    it('a renamed hero: their flag draws, the other three do not', async () => {
        scene();
        await flush();
        renders.start();
        await act(async () => {
            GameState.state.heroes[2].name = 'Renamed';
            EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED);
            await Promise.resolve();
        });
        await flush();
        renders.stop();
        expect(document.querySelector('[alt="Renamed’s flag"]')).not.toBeNull();
        expect(renders.of('FlagMark'), JSON.stringify(renders.all())).toBe(1);
    });
});

describe('⭐ a charge spent: the Token and its plate redraw, its art does not, all in one commit', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    beforeEach(() => {
        vi.clearAllMocks();
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        clearMat();
        setLiveMatFit(1);
    });
    afterEach(async () => {
        renders.stop();
        await new Promise(r => setTimeout(r, 20));
        cleanup();
    });

    it('on the mat: one charge spent draws the Token and its plate\'s number, never its art, sprite or name, and no ring or floater', async () => {
        GameState.state.heroes = [{ id: 'h1', name: 'h1', status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }];
        const t = placeAt('fixture_producer', 600, 400);
        placeAt('fixture_producer', 1000, 400);
        Flags.plant('h1', { x: 620, y: 400 });
        expect(BoardState.workerOf(t.id)).toBe('h1');
        const view = render(
            h(DeckDndProvider, null,
                    h(Board, { onInspectToken: () => {}, onClearInspect: () => {} }))
        );
        view.container.querySelector('[data-board-origin]').getBoundingClientRect = () => box(0, 0, matW(), matH());
        await flush();
        renders.start();
        await act(async () => { Charges.applyDelta(t, -1); });
        await flush();
        renders.stop();
        // No ring comes up by itself (brief 120) and no -1 floats: the plate counts down.
        expect(view.container.querySelector(`[data-bubble="charges"][data-bubble-of="${t.id}"]`)).toBeNull();
        expect(view.container.querySelector('[data-charge-floater]')).toBeNull();
        expect(view.container.querySelector(`[data-work-plate="${t.id}"] [data-plate-cell="charges"]`).textContent).toBe(chargesText(t.usesRemaining));
        const all = JSON.stringify(renders.all());
        expect(renders.of('MatToken'), all).toBe(1);
        expect(renders.of('TokenBubbles'), all).toBe(1);
        expect(renders.of('WorkPlate'), all).toBe(1);
        expect(renders.of('TokenHitArt'), all).toBe(0);
        expect(renders.of('TokenSprite'), all).toBe(0);
        expect(renders.of('PixelArt'), all).toBe(0);
        expect(renders.of('TokenNameBadge'), all).toBe(0);
        // One commit: the plate's number came with the charge, not a commit later.
        expect(renders.commits().length, all).toBe(1);
    });

    it('a worked Token: a charge spent mounts nothing at rest in its own box', async () => {
        const tokenOf = (n) => ({ typeId: 'fixture_producer', instanceId: 'tok_tr', heroId: 'hero_1', alert: null, usesRemaining: n });
        const tree = (n) => h(DndContext, null, h(TokenBubbles, { instanceId: 'tok_tr', token: tokenOf(n) }));
        const view = render(tree(10));
        await flush();
        renders.start();
        await act(async () => { view.rerender(tree(9)); });
        renders.stop();
        expect(view.container.querySelector('[data-bubble="charges"]')).toBeNull();
        expect(view.container.querySelector('[data-charge-floater]')).toBeNull();
        const all = JSON.stringify(renders.all());
        expect(renders.commits().length, all).toBe(1);
        expect(renders.of('Bubble'), all).toBe(0);
        expect(renders.of('RingBadge'), all).toBe(0);
    });
});

describe('⭐ speech bubbles: the twice-a-second look draws only when what is said changes', () => {
    // A stuck hero used to be "busy" for as long as they stayed stuck, and their line was looked at
    // twice a second; heroes no longer speak a Token's problems at all (brief 120).
    let token;
    beforeEach(() => {
        resetMatTuning();
        GameState.initNew();
        clearMat();
        token = placeAt('fixture_producer', 600, 400);
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    });
    afterEach(() => {
        renders.stop();
        vi.useRealTimers();
        cleanup();
    });
    const stuck = (alert) => [{ heroId: 'hs', state: 'working', x: 500, y: 400, moving: false, tokenId: token.id, alert }];
    const said = (c) => [...c.querySelectorAll('[data-hero-bubble]')].map(el => el.textContent);
    const wait = (ms) => act(() => { vi.advanceTimersByTime(ms); });

    it('⭐ a hero stuck on a Token says nothing, however long it lasts, and nothing looks twice a second', () => {
        for (const alert of [ALERT.CHARGES, ALERT.INPUTS, ALERT.NO_ROOM, ALERT.ACCESS]) {
            const { container, unmount } = render(h(HeroBubbleLayer, { heroes: stuck(alert) }));
            expect(said(container), alert).toEqual([]);
            expect(vi.getTimerCount(), alert).toBe(0);
            renders.start();
            for (let i = 0; i < 10; i++) wait(500);
            renders.stop();
            expect(renders.of('HeroBubbleLayer'), alert).toBe(0);
            expect(said(container), alert).toEqual([]);
            unmount();
        }
    });

    it('a moment that lapses is taken down, at the next look', () => {
        const { container } = render(h(HeroBubbleLayer, { heroes: stuck(ALERT.CHARGES) }));
        wait(10);
        act(() => { EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: 'o', x: 1, y: 1, typeId: 'fixture_producer', exhaustedBy: 'hs' }); });
        expect(said(container)).toEqual(['Fixture Producer Depleted']);
        renders.start();
        wait(DEPLETED_TTL_MS + 500);
        renders.stop();
        expect(said(container)).toEqual([]);
        // The look that found it lapsed, and the layout pass after measuring the shorter stack.
        expect(renders.of('HeroBubbleLayer')).toBeGreaterThan(0);
        expect(renders.of('HeroBubbleLayer')).toBeLessThanOrEqual(2);
        // Nothing left to look at: the look stops.
        expect(vi.getTimerCount()).toBe(0);
    });

    it('a level-up float that runs out is taken down, at the next look; it does not redraw while it plays', () => {
        clearAllFloats();
        const { container } = render(h(HeroBubbleLayer, { heroes: stuck(ALERT.CHARGES) }));
        wait(10);
        act(() => { EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId: 'hs', skillId: 'logging', skillName: 'Forestry', newLevel: 5, oldLevel: 4 }); });
        expect(container.querySelector('[data-level-float]')).not.toBeNull();
        renders.start();
        wait(FLOAT_MS - 1000);
        renders.stop();
        expect(renders.of('HeroBubbleLayer')).toBe(0);
        renders.start();
        wait(1500);
        renders.stop();
        expect(container.querySelector('[data-level-float]')).toBeNull();
        expect(said(container)).toEqual([]);
        expect(renders.of('HeroBubbleLayer')).toBeGreaterThan(0);
        expect(renders.of('HeroBubbleLayer')).toBeLessThanOrEqual(2);
    });
});
