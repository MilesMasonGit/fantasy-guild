// @vitest-environment jsdom
// ⚠️ First: it must be in place before React loads.
import { renders } from './fixtures/renderCounter.js';
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { useDndContext } from '@dnd-kit/core';
import { DeckDndProvider, DropTarget, useEntityDrag, useActiveDrag } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { Board } from '../ui/components/board/Board.jsx';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
vi.mock('../ui/components/drawer/HeroInspectionSheet.jsx', () => ({
    HeroInspectionSheet: () => React.createElement('div', { 'data-testid': 'hero-sheet' })
}));
// Every drag hook dnd-kit is asked for, by the draggable's id.
const dragHooks = vi.hoisted(() => new Map());
vi.mock('@dnd-kit/core', async (orig) => {
    const real = await orig();
    return { ...real, useDraggable: (args) => { dragHooks.set(args.id, (dragHooks.get(args.id) || 0) + 1); return real.useDraggable(args); } };
});

/**
 * ⭐ **Every drag source shares one dnd-kit draggable.** dnd-kit re-renders every component
 * holding one of its drag hooks each time its own state changes: three times at a pickup (the
 * drag starts, the carried node is measured, the first target is found), twice at a drop, at
 * every change of target, and the one in the hand at every pointer move. A hero, a flag, a hero
 * in the bar, a Shop row, a Bank tile: each held a hook of its own. They now press one shared
 * draggable the provider holds (as the mat's Tokens already did), and hear only whether they
 * themselves are in the hand. What a drag carries, what it measures and how it lands are
 * unchanged.
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
const ptr = (x, y, extra = {}) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0, ...extra });
const wait = (ms) => act(async () => { await new Promise(r => setTimeout(r, ms)); });

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
    dragHooks.clear();
    setLiveMatFit(1);
});
afterEach(async () => {
    renders.stop();
    // dnd-kit drops its after-drag click guard 50 ms after a drag ends.
    await new Promise(r => setTimeout(r, 80));
    cleanup();
    document.body.classList.remove('gi-dnd-active');
});

const engine = { GameState, EventBus, BoardPlacement: { recallHeroById: vi.fn() }, EquipmentManager: { equipItem: vi.fn() } };
const hero = (id) => ({
    id, name: id, spriteId: 'hero_recruit_0', status: 'idle', level: 50, equipment: {},
    skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 }
});

function Item({ id = 'item-src', itemId = 'item_coal' }) {
    const d = useEntityDrag({ id, kind: DRAG_KIND.ITEM, payload: { itemId } });
    return h('div', { ref: d.setNodeRef, ...d.handleProps, 'data-testid': id });
}

/** The mat with one hero and its flag, three Tokens, the hero bar, and a target beside the mat. */
function scene() {
    GameState.state.heroes = [hero('h1')];
    // High on the mat, clear of the Tokens and of the paths below.
    Flags.plant('h1', { x: 250, y: 150 });
    const a = placeAt('fixture_producer', 600, 400);
    placeAt('fixture_producer', 1000, 500);
    placeAt('fixture_producer', 600, 900);
    const view = render(
        h(EngineContext.Provider, { value: engine },
            h(DeckDndProvider, null,
                h(Board, { onInspectToken: () => {}, onClearInspect: () => {} }),
                h(BottomHeroDock, { selectedHeroId: null }),
                h(Item),
                h(DropTarget, { id: 'beside', accepts: () => true, onDrop: () => false, 'data-testid': 'beside' })))
    );
    // jsdom lays nothing out: the mat stands at the viewport's corner at its natural size.
    view.container.querySelector('[data-board-origin]').getBoundingClientRect = () => box(0, 0, matW(), matH());
    view.container.querySelector('[data-mat-board]').getBoundingClientRect = () => box(0, 0, matW(), matH());
    view.getByTestId('beside').getBoundingClientRect = () => box(matW() + 100, 100, 200, 200);
    view.getByTestId('item-src').getBoundingClientRect = () => box(3000, 3000, 50, 50);
    return { a, ...view };
}
const hitOf = (container, id) => container.querySelector(`[data-token-hit="${id}"]`);

describe('⭐ one shared drag source', () => {
    it('no hero, flag, hero-bar figure or Bank item holds a dnd-kit drag hook of its own', () => {
        const { container } = scene();
        expect(container.querySelector('[data-board-hero="h1"]')).not.toBeNull();
        expect(container.querySelector('button[data-flag="h1"]')).not.toBeNull();
        expect(container.querySelector('[data-dock-hero="h1"]')).not.toBeNull();
        expect([...dragHooks.keys()].sort()).toEqual(['entity-drag', 'mat-token']);
    });

    it('a change of target mid-drag redraws nothing inside the mat: no hero, no flag, not the boxes around the mat\'s drawing', () => {
        const { a, container } = scene();
        act(() => {
            fireEvent.pointerDown(hitOf(container, a.id), ptr(600, 400));
            fireEvent.pointerMove(document, ptr(630, 400));
        });
        act(() => { fireEvent.pointerMove(document, ptr(700, 400)); });
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
        renders.start();
        // Off the mat and into the other target, then back onto the mat.
        act(() => { fireEvent.pointerMove(document, ptr(matW() + 200, 200)); });
        act(() => { fireEvent.pointerMove(document, ptr(700, 420)); });
        renders.stop();
        expect(renders.of('MatBoard')).toBe(0);
        expect(renders.of('MatHero')).toBe(0);
        expect(renders.of('Flag')).toBe(0);
        // The mat's drop target (`Board`) is redrawn by dnd-kit; what it holds is not.
        expect(renders.of('Board')).toBeGreaterThan(0);
        expect(renders.of('ErrorBoundary')).toBe(0);
        expect(renders.of('DevPerfProfiler')).toBe(0);
        act(() => { fireEvent.pointerUp(document, ptr(700, 420)); });
    });

    it('the thing in the hand is not redrawn by the pointer moving', () => {
        const { container } = scene();
        const flag = container.querySelector('button[data-flag="h1"]');
        act(() => {
            fireEvent.pointerDown(flag, ptr(250, 150));
            fireEvent.pointerMove(document, ptr(280, 150));
        });
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
        renders.start();
        for (let i = 1; i <= 5; i++) {
            act(() => { fireEvent.pointerMove(document, ptr(280 + i * 15, 160 + i * 10)); });
        }
        renders.stop();
        expect(renders.of('Flag')).toBe(0);
        expect(renders.of('MatHero')).toBe(0);
        act(() => { fireEvent.pointerUp(document, ptr(355, 210)); });
    });
});

describe('⭐ the ghost', () => {
    it('is not redrawn by the pointer moving', () => {
        const { a, container } = scene();
        renders.start();
        act(() => {
            fireEvent.pointerDown(hitOf(container, a.id), ptr(600, 400));
            fireEvent.pointerMove(document, ptr(630, 400));
        });
        act(() => { fireEvent.pointerMove(document, ptr(660, 400)); });
        // The ghost is drawn.
        expect(renders.of('TokenGhost')).toBeGreaterThan(0);
        renders.start();
        for (let i = 1; i <= 5; i++) {
            act(() => { fireEvent.pointerMove(document, ptr(660 + i * 12, 400 + i * 6)); });
        }
        renders.stop();
        expect(renders.of('DragGhost')).toBe(0);
        expect(renders.of('TokenGhost')).toBe(0);
        act(() => { fireEvent.pointerUp(document, ptr(720, 430)); });
    });
});

describe('a drag through the shared source behaves as before', () => {
    function InHand({ out }) {
        out.payload = useActiveDrag().activePayload;
        return null;
    }

    it('a press on a source inside another source picks up the inner one', () => {
        function Outer() {
            const d = useEntityDrag({ id: 'outer', kind: DRAG_KIND.ITEM, payload: { itemId: 'outer' } });
            return h('div', { ref: d.setNodeRef, ...d.handleProps, 'data-testid': 'outer' }, h(Item, { id: 'inner', itemId: 'inner' }));
        }
        const out = {};
        const view = render(h(DeckDndProvider, null, h(Outer), h(InHand, { out })));
        act(() => {
            fireEvent.pointerDown(view.getByTestId('inner'), ptr(10, 10));
            fireEvent.pointerMove(document, ptr(40, 10));
        });
        expect(out.payload).toMatchObject({ kind: DRAG_KIND.ITEM, itemId: 'inner' });
        act(() => { fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' }); });
        act(() => {
            fireEvent.pointerDown(view.getByTestId('outer'), ptr(10, 10));
            fireEvent.pointerMove(document, ptr(40, 10));
        });
        expect(out.payload).toMatchObject({ kind: DRAG_KIND.ITEM, itemId: 'outer' });
        act(() => { fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' }); });
    });

    it('a press on another source while one is in the hand changes nothing about the drag', () => {
        let live = null;
        function Spy() {
            const { active } = useDndContext();
            live = active ? active.data.current.itemId : null;
            return null;
        }
        const out = {};
        const view = render(h(DeckDndProvider, null, h(Item, { id: 'one', itemId: 'one' }), h(Item, { id: 'two', itemId: 'two' }), h(InHand, { out }), h(Spy)));
        act(() => {
            fireEvent.pointerDown(view.getByTestId('one'), ptr(10, 10));
            fireEvent.pointerMove(document, ptr(40, 10));
        });
        expect(live).toBe('one');
        // A second finger, then the same pointer again: dnd-kit refuses both, and so does the shared source.
        act(() => { fireEvent.pointerDown(view.getByTestId('two'), ptr(10, 10, { pointerId: 2, isPrimary: false })); });
        act(() => { fireEvent.pointerMove(document, ptr(50, 10)); });
        expect(live).toBe('one');
        act(() => { fireEvent.pointerDown(view.getByTestId('two'), ptr(10, 10)); });
        act(() => { fireEvent.pointerMove(document, ptr(60, 10)); });
        expect(live).toBe('one');
        expect(out.payload).toMatchObject({ itemId: 'one' });
        expect(view.getByTestId('one').getAttribute('aria-pressed')).toBe('true');
        act(() => { fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' }); });
    });

    it('carries the payload the source was last drawn with, and dnd-kit measures the source\'s own element', () => {
        let measured = null;
        function Spy() {
            const { activeNode } = useDndContext();
            if (activeNode) measured = activeNode;
            return null;
        }
        function Source({ itemId }) {
            const d = useEntityDrag({ id: 'src', kind: DRAG_KIND.ITEM, payload: { itemId } });
            return h('div', { ref: d.setNodeRef, ...d.handleProps, 'data-testid': 'src' });
        }
        const out = {};
        const tree = (itemId) => h(DeckDndProvider, null, h(Source, { itemId }), h(InHand, { out }), h(Spy));
        const view = render(tree('first'));
        act(() => { fireEvent.pointerDown(view.getByTestId('src'), ptr(10, 10)); });
        // Redrawn between the press and the move that starts the drag.
        view.rerender(tree('second'));
        act(() => { fireEvent.pointerMove(document, ptr(40, 10)); });
        expect(out.payload).toMatchObject({ itemId: 'second' });
        expect(measured).toBe(view.getByTestId('src'));
        act(() => { fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' }); });
    });

    it('keeps dnd-kit\'s attributes on a source, pressed only while it is in the hand', () => {
        function Source({ id, disabled = false }) {
            const d = useEntityDrag({ id, kind: DRAG_KIND.ITEM, payload: { itemId: id }, disabled });
            return h('div', { ref: d.setNodeRef, ...d.handleProps, 'data-testid': id });
        }
        const out = {};
        const view = render(h(DeckDndProvider, null, h(Source, { id: 'one' }), h(Source, { id: 'two' }), h(Source, { id: 'off', disabled: true }), h(InHand, { out })));
        const one = view.getByTestId('one');
        expect(one.getAttribute('role')).toBe('button');
        expect(one.getAttribute('tabindex')).toBe('0');
        expect(one.getAttribute('aria-roledescription')).toBe('draggable');
        expect(one.getAttribute('aria-disabled')).toBe('false');
        expect(one.hasAttribute('aria-pressed')).toBe(false);
        // dnd-kit's own hidden instructions.
        const describedBy = one.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();
        expect(document.getElementById(describedBy)).not.toBeNull();
        expect(view.getByTestId('off').getAttribute('aria-disabled')).toBe('true');

        act(() => {
            fireEvent.pointerDown(one, ptr(10, 10));
            fireEvent.pointerMove(document, ptr(40, 10));
        });
        expect(one.getAttribute('aria-pressed')).toBe('true');
        expect(view.getByTestId('two').hasAttribute('aria-pressed')).toBe(false);
        act(() => { fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' }); });
        expect(one.hasAttribute('aria-pressed')).toBe(false);

        // A disabled source does not start a drag.
        act(() => {
            fireEvent.pointerDown(view.getByTestId('off'), ptr(10, 10));
            fireEvent.pointerMove(document, ptr(40, 10));
        });
        expect(out.payload).toBeNull();
        expect(document.body.classList.contains('gi-dnd-active')).toBe(false);
    });

    it('a hero carried out of the bar is drawn held while it is in the hand, and only it', () => {
        GameState.state.heroes = ['h1', 'h2', 'h3'].map(hero);
        const view = render(h(EngineContext.Provider, { value: engine }, h(DeckDndProvider, null, h(BottomHeroDock, { selectedHeroId: null }))));
        const fig = (id) => view.container.querySelector(`[data-dock-hero="${id}"]`);
        ['h1', 'h2', 'h3'].forEach((id, i) => { fig(id).getBoundingClientRect = () => box(500 + i * 100, 900, 100, 100); });
        act(() => {
            fireEvent.pointerDown(fig('h1'), ptr(550, 950));
            fireEvent.pointerMove(document, ptr(550, 900));
        });
        expect(fig('h1').className).toContain('opacity-30');
        expect(fig('h2').className).not.toContain('opacity-30');
        act(() => { fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' }); });
        expect(fig('h1').className).not.toContain('opacity-30');
    });
});

describe('⭐ the hero bar after a drop', () => {
    function bar() {
        GameState.state.heroes = ['h1', 'h2', 'h3', 'h4'].map(hero);
        const view = render(
            h(EngineContext.Provider, { value: engine },
                h(DeckDndProvider, null, h(Item), h(BottomHeroDock, { selectedHeroId: null })))
        );
        const fig = (id) => view.container.querySelector(`[data-dock-hero="${id}"]`);
        view.getByTestId('item-src').getBoundingClientRect = () => box(0, 0, 50, 50);
        view.container.querySelector('[data-bottom-hero-dock]').getBoundingClientRect = () => box(0, 900, 1600, 100);
        ['h1', 'h2', 'h3', 'h4'].forEach((id, i) => { fig(id).getBoundingClientRect = () => box(500 + i * 100, 900, 100, 100); });
        return { ...view, fig };
    }
    /** Pick up the item and put it down far from every target. */
    async function dragAway(getByTestId) {
        act(() => {
            fireEvent.pointerDown(getByTestId('item-src'), ptr(25, 25));
            fireEvent.pointerMove(document, ptr(60, 25));
        });
        act(() => { fireEvent.pointerMove(document, ptr(2000, 300)); });
        await act(async () => { fireEvent.pointerUp(document, ptr(2000, 300)); });
    }

    it('a drag ending redraws no figure but in the drag\'s own commits', async () => {
        const { getByTestId } = bar();
        renders.start();
        await dragAway(getByTestId);
        await wait(400);
        renders.stop();
        const own = (c) => c.has('DeckDndProvider') || c.has('DndContext');
        const late = renders.commits().filter(c => c.has('DockHeroFigure') && !own(c));
        expect(late).toHaveLength(0);
    });

    it('a figure hovered as a drop lands stays down for 320 ms, then lifts', async () => {
        const { getByTestId, fig } = bar();
        fireEvent.mouseEnter(fig('h2'));
        expect(fig('h2').getAttribute('data-dock-hover')).toBe('true');
        await dragAway(getByTestId);
        expect(fig('h2').getAttribute('data-dock-hover')).toBe('false');
        await wait(150);
        expect(fig('h2').getAttribute('data-dock-hover')).toBe('false');
        await wait(300);
        expect(fig('h2').getAttribute('data-dock-hover')).toBe('true');
    });

    it('the hero column beside the Bank: a drag ending redraws no tab but in the drag\'s own commits, and a tab hovered in the 320 ms shows its tip only after them', async () => {
        GameState.state.heroes = ['h1', 'h2', 'h3'].map(hero);
        const view = render(
            h(EngineContext.Provider, { value: engine },
                h(DeckDndProvider, null, h(Item), h(BankHeroPanel, { selectedHeroId: 'h1', showTabs: true, menuRight: false })))
        );
        view.getByTestId('item-src').getBoundingClientRect = () => box(0, 0, 50, 50);
        const tabs = view.container.querySelectorAll('[data-hero-tab-face]');
        expect(tabs.length).toBe(3);
        renders.start();
        await dragAway(view.getByTestId);
        await wait(400);
        renders.stop();
        const own = (c) => c.has('DeckDndProvider') || c.has('DndContext');
        expect(renders.commits().filter(c => c.has('HeroDockTab') && !own(c))).toHaveLength(0);
        await dragAway(view.getByTestId);
        await wait(100);
        fireEvent.mouseEnter(tabs[1]);
        expect(document.querySelector('[data-top-bar-tip]')).toBeNull();
        await wait(350);
        expect(document.querySelector('[data-top-bar-tip]')).not.toBeNull();
    });

    it('a figure first hovered just after a drop lifts only when the 320 ms are up', async () => {
        const { getByTestId, fig } = bar();
        await dragAway(getByTestId);
        await wait(100);
        fireEvent.mouseEnter(fig('h3'));
        expect(fig('h3').getAttribute('data-dock-hover')).toBe('false');
        await wait(350);
        expect(fig('h3').getAttribute('data-dock-hover')).toBe('true');
        expect(fig('h1').getAttribute('data-dock-hover')).toBe('false');
    });
});
