// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DeckDndProvider, useEntityDrag } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND, DND_SURFACE, isRosterFlag, rosterFlagPayload } from '../ui/dnd/dragConstants.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { HeroManager } from '../systems/hero/HeroManager.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { HeroDrawer } from '../ui/components/dock/HeroDrawer.jsx';
import { DOCK_SLOT_PX, DOCK_NAME_TEXT_CLASS } from '../ui/components/dock/dockHeroView.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Dragging a hero off the mat, from the bar (on every screen) or their sheet, is the mat's own
 * flag drag: only the flag in the hand. Dropped on another hero in the bar it still
 * reorders them; a flag picked up on the mat does not.
 */

const h = React.createElement;
const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
const ptr = (x, y) => ({ pointerId: 1, clientX: x, clientY: y, isPrimary: true, button: 0 });
const hero = (id) => ({ id, name: id.toUpperCase(), classId: 'fighter', hp: { current: 10, max: 10 }, skills: {}, equipment: {} });

const place = (el, i) => { el.getBoundingClientRect = () => box(500 + i * 100, 900, 100, 60); };

function start(el, x, y) {
    act(() => {
        fireEvent.pointerDown(el, ptr(x, y));
        fireEvent.pointerMove(document, ptr(x + 30, y));
    });
    expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
}
const cancel = () => act(() => { fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' }); });

const heldPicture = () => [...document.querySelectorAll('[data-pickup-flight] img')]
    .filter(img => !img.closest('[data-flag-ghost]'));

function expectOnlyTheFlag(heroId) {
    expect(document.querySelector(`[data-flag-ghost="${heroId}"]`)).not.toBeNull();
    expect(document.querySelector(`[data-order-ghost="${heroId}"]`)).not.toBeNull();
    expect(heldPicture()).toEqual([]);
}

let flights;
let unsub;
beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = ['h1', 'h2', 'h3'].map(hero);
    flights = [];
    unsub = EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, (p) => flights.push(p));
});
afterEach(() => {
    unsub();
    cancel();
    cleanup();
    vi.restoreAllMocks();
});

const bar = () => {
    const view = render(h(DeckDndProvider, null, h(BottomHeroDock, { selectedHeroId: null })));
    const fig = (id) => view.container.querySelector(`[data-dock-hero="${id}"]`);
    ['h1', 'h2', 'h3'].forEach((id, i) => place(fig(id), i));
    return { ...view, fig };
};

describe('only the flag is carried', () => {
    it('from the bar, and the hero\'s own flag leaves the bar while it is in the hand', () => {
        const { fig, container } = bar();
        start(fig('h1'), 550, 930);
        expectOnlyTheFlag('h1');
        expect(flights).toEqual([]);
        expect(container.querySelector('[data-dock-flag="h1"]').className).toContain('invisible');
        expect(container.querySelector('[data-dock-flag="h2"]').className).not.toContain('invisible');
    });

    it('from the sheet\'s large figure, and the sheet\'s flag leaves it while it is in the hand', () => {
        const view = render(h(DeckDndProvider, null, h(HeroDrawer, { selectedHeroId: 'h3' })));
        const figure = view.container.querySelector('[data-hero-panel-figure]');
        figure.getBoundingClientRect = () => box(0, 0, 256, 256);
        start(figure, 128, 128);
        expectOnlyTheFlag('h3');
        expect(flights).toEqual([]);
        expect(view.container.querySelector('[data-hero-panel-flag]').className).toContain('invisible');
    });
});

describe('a reorder on the bar', () => {
    it('shows a gold line on the side the hero lands, and the drop moves them', () => {
        const reorder = vi.spyOn(HeroManager, 'reorderHero').mockImplementation(() => true);
        const { fig, container } = bar();
        start(fig('h1'), 550, 930);
        act(() => { fireEvent.pointerMove(document, ptr(750, 930)); });
        expect(container.querySelector('[data-dock-hero="h3"] [data-dock-reorder-cue="after"]')).not.toBeNull();
        expect(container.querySelector('[data-dock-hero="h2"] [data-dock-reorder-cue]')).toBeNull();
        act(() => { fireEvent.pointerUp(document, ptr(750, 930)); });
        expect(reorder).toHaveBeenCalledWith('h1', 2);
    });

    it('a flag picked up on the mat is not a reorder', () => {
        const reorder = vi.spyOn(HeroManager, 'reorderHero').mockImplementation(() => true);
        const MatFlag = () => {
            const drag = useEntityDrag({
                id: 'flag-h1',
                kind: DRAG_KIND.FLAG,
                payload: { heroId: 'h1', name: 'H1', from: { flag: true } },
                sourceSurface: DND_SURFACE.BOARD
            });
            return h('div', { 'data-testid': 'mat-flag', ref: drag.setNodeRef, ...drag.handleProps });
        };
        const view = render(h(DeckDndProvider, null, h(MatFlag), h(BottomHeroDock, { selectedHeroId: null })));
        const fig = (id) => view.container.querySelector(`[data-dock-hero="${id}"]`);
        ['h1', 'h2', 'h3'].forEach((id, i) => place(fig(id), i));
        const flag = view.getByTestId('mat-flag');
        flag.getBoundingClientRect = () => box(0, 0, 24, 24);
        start(flag, 12, 12);
        act(() => { fireEvent.pointerMove(document, ptr(750, 930)); });
        expect(view.container.querySelector('[data-dock-reorder-cue]')).toBeNull();
        act(() => { fireEvent.pointerUp(document, ptr(750, 930)); });
        expect(reorder).not.toHaveBeenCalled();
    });

    it('only a flag picked up off the mat counts as a roster drag', () => {
        expect(isRosterFlag(rosterFlagPayload('h1', 'A'))).toBe(true);
        expect(isRosterFlag(rosterFlagPayload('h1', 'A', { dock: true, inspection: true }))).toBe(true);
        expect(isRosterFlag({ kind: DRAG_KIND.FLAG, heroId: 'h1', from: { hero: true } })).toBe(false);
        expect(isRosterFlag({ kind: DRAG_KIND.ITEM, itemId: 'x', from: { dock: true } })).toBe(false);
    });
});

describe('the bar\'s look, one place to tune it', () => {
    it('spacing and name size come from their constants', () => {
        const { container } = bar();
        expect(container.querySelector('[data-dock-slot="h1"]').style.flex).toBe(`0 1 ${DOCK_SLOT_PX}px`);
        expect(container.querySelector('[data-dock-name="h1"]').className).toContain(DOCK_NAME_TEXT_CLASS);
    });
});
