// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { MatFitProvider, setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { matW, matH } from '../config/matGeometry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { setMapMode, MAP_MODE } from '../ui/hooks/useMapMode.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
// A hero's figure takes a press only on a drawn pixel; jsdom draws none.
vi.mock('../ui/utils/alphaHitTest.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, isElementOpaqueAtPoint: () => true };
});

/**
 * ⭐ **Drag only; right-click inspects** (playmat declutter §4, §7). A plain click on the mat does
 * nothing; a right-click on a Token opens its card, on a hero their Hero drawer, and is never an
 * order. On the hero bar a click or a right-click opens the drawer. Dragging is the one way to
 * order, and a hero dropped on bare ground goes exactly where they were dropped.
 */

const h = React.createElement;

function mount(props = {}) {
    const view = render(h(DeckDndProvider, null, h(MatFitProvider, { value: 1 }, h(MatBoard, props))));
    const mat = view.container.querySelector('[data-mat-board]');
    mat.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: matW(), height: matH(), right: matW(), bottom: matH() });
    return { ...view, mat };
}
const hitOf = (c, id) => c.querySelector(`[data-token-hit="${id}"]`);
const artOf = (c, id) => c.querySelector(`[data-token-art][data-token-id="${id}"]`);
const at = (t) => ({ clientX: t.x, clientY: t.y });
function click(el, point) {
    fireEvent.pointerDown(el, { pointerId: 1, isPrimary: true, button: 0, ...point });
    fireEvent.click(el, point);
}
function fixtureAt(x, y) {
    const instance = BoardState.createTokenInstance('fixture_producer', 100, null, BoardState.ORIGIN.PLACED);
    instance.fixture = true;
    return BoardState.addToken(instance, x, y);
}
function heroOnMat(id = 'h1', point = { x: 600, y: 400 }) {
    GameState.state.heroes.push({ id, name: id, spriteId: 'recruit', status: 'idle', level: 5, skills: {}, hp: { current: 100, max: 100 } });
    Orders.orderAt(id, point);
}
function heroesInspected() {
    const opened = [];
    const off = EventBus.subscribe(UI_EVENTS.INSPECT_HERO, (p) => opened.push(p.heroId));
    return { opened, off };
}
const heroPayload = (heroId) => ({ kind: DRAG_KIND.FLAG, heroId });

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    InventoryManager.init();
    SpriteLayer.init();
    clearMat();
    setMapMode(null);
});
afterEach(async () => {
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 0, clientY: 0 });
    await new Promise(r => setTimeout(r, 30));
    document.body.classList.remove('gi-dnd-active');
    cleanup();
    setMapMode(null);
});

describe('⭐ right-click on a Token opens its card', () => {
    it('a movable Token, a fixed one: the card opens on that Token, and the browser menu is held back', () => {
        const t = placeAt('fixture_producer', 300, 500);
        const node = fixtureAt(900, 500);
        const onInspectToken = vi.fn();
        const { container } = mount({ onInspectToken });
        let shown;
        act(() => { shown = fireEvent.contextMenu(hitOf(container, t.id), at(t)); });
        expect(shown).toBe(false);
        expect(onInspectToken).toHaveBeenLastCalledWith('fixture_producer', expect.anything(), t.id);
        act(() => { fireEvent.contextMenu(hitOf(container, node.id), at(node)); });
        expect(onInspectToken).toHaveBeenLastCalledWith('fixture_producer', expect.anything(), node.id);
        expect(onInspectToken).toHaveBeenCalledTimes(2);
    });

    it('a right-click on a Token a hero works gives no order: the hero keeps working it', () => {
        const t = placeAt('fixture_producer', 600, 500);
        heroOnMat('h1', { x: 600, y: 500 });
        const flagBefore = { ...BoardState.flagOf('h1') };
        const onInspectToken = vi.fn();
        const { container } = mount({ onInspectToken });
        act(() => { fireEvent.contextMenu(hitOf(container, t.id), at(t)); });
        expect(onInspectToken).toHaveBeenCalledWith('fixture_producer', expect.anything(), t.id);
        expect(BoardState.flagOf('h1')).toEqual(flagBefore);
        expect(Flags.pinnedIdOf('h1')).toBe(t.id);
    });

    it('in Demolish a right-click opens nothing', () => {
        const t = placeAt('fixture_producer', 600, 500);
        setMapMode(MAP_MODE.DEMOLISH);
        const onInspectToken = vi.fn();
        const { container } = mount({ onInspectToken });
        act(() => { fireEvent.contextMenu(hitOf(container, t.id), at(t)); });
        expect(onInspectToken).not.toHaveBeenCalled();
    });
});

describe('⭐ a plain click on the mat does nothing', () => {
    it('a click or a double-click on a Token opens no card and draws no outline', () => {
        const t = placeAt('fixture_producer', 600, 500);
        const onInspectToken = vi.fn();
        const { container } = mount({ onInspectToken });
        act(() => {
            click(hitOf(container, t.id), at(t));
            fireEvent.doubleClick(hitOf(container, t.id), at(t));
        });
        expect(onInspectToken).not.toHaveBeenCalled();
        expect(artOf(container, t.id).getAttribute('data-outline')).toBeNull();
    });

    it('a click or a double-click on a hero opens no drawer and draws no outline', () => {
        heroOnMat('h1');
        const { opened, off } = heroesInspected();
        const { container } = mount();
        const figure = container.querySelector('[data-board-hero="h1"]');
        act(() => {
            fireEvent.click(figure);
            fireEvent.doubleClick(figure);
        });
        expect(opened).toEqual([]);
        expect(figure.getAttribute('data-outline')).toBeNull();
        off();
    });
});

describe('⭐ right-click on a hero opens their Hero drawer', () => {
    it('on the mat: the drawer is asked for, no order is given and the browser menu is held back', () => {
        const t = placeAt('fixture_producer', 600, 500);
        heroOnMat('h1', { x: 600, y: 500 });
        const flagBefore = { ...BoardState.flagOf('h1') };
        const { opened, off } = heroesInspected();
        const { container } = mount();
        const figure = container.querySelector('[data-board-hero="h1"]');
        let shown;
        act(() => { shown = fireEvent.contextMenu(figure); });
        expect(shown).toBe(false);
        expect(opened).toEqual(['h1']);
        expect(BoardState.flagOf('h1')).toEqual(flagBefore);
        expect(Flags.pinnedIdOf('h1')).toBe(t.id);
        off();
    });
});

describe('⭐ the hero bar: a click or a right-click opens the drawer', () => {
    const barHero = (id, name) => ({ id, name, spriteId: 'hn_recruit_por', hp: { current: 100, max: 100 }, status: 'idle', equipment: {} });
    const card = (view, id) => view.container.querySelector(`[data-dock-hero="${id}"]`);
    beforeEach(() => {
        GameState.state.heroes = [barHero('h1', 'Aldric'), barHero('h2', 'Brenna')];
        setLiveMatFit(1);
    });

    it('a click opens that hero\'s drawer; a right-click too; a double-click asks nothing more', () => {
        const onOpenHero = vi.fn();
        const view = render(h(DeckDndProvider, null, h(BottomHeroDock, { selectedHeroId: null, onOpenHero })));
        fireEvent.click(card(view, 'h1'));
        expect(onOpenHero).toHaveBeenLastCalledWith('h1');
        let shown;
        act(() => { shown = fireEvent.contextMenu(card(view, 'h2')); });
        expect(shown).toBe(false);
        expect(onOpenHero).toHaveBeenLastCalledWith('h2');
        expect(onOpenHero).toHaveBeenCalledTimes(2);
        fireEvent.doubleClick(card(view, 'h1'));
        expect(onOpenHero).toHaveBeenCalledTimes(2);
    });
});

describe('⭐ dragging still orders', () => {
    it('a hero dropped on a Token they can work is ordered onto it', () => {
        const t = placeAt('fixture_producer', 600, 500);
        heroOnMat('h1', { x: 200, y: 200 });
        const result = dropOnMat(heroPayload('h1'), { x: 600, y: 500 });
        expect(result).toMatchObject({ success: true, order: 'token', instanceId: t.id });
        expect(Flags.pinnedIdOf('h1')).toBe(t.id);
    });

    it('a hero dropped on bare ground among Tokens goes exactly there: no room test, no nudge, no fly-back', () => {
        const a = placeAt('fixture_producer', 500, 500);
        const b = placeAt('fixture_producer', 640, 500);
        heroOnMat('h1', { x: 200, y: 200 });
        // Between the two Tokens' circles, closer to each than a Token may stand.
        const spot = { x: 570, y: 600 };
        expect(Flags.tokenAtPoint(spot)).toBeNull();
        const result = dropOnMat(heroPayload('h1'), spot);
        expect(result).toMatchObject({ success: true, order: 'spot' });
        expect(result.flyBack).toBeUndefined();
        expect(BoardState.flagOf('h1')).toMatchObject({ x: spot.x, y: spot.y, spot: true });
        expect(BoardState.getTokenById(a.id)).toMatchObject({ x: 500, y: 500 });
        expect(BoardState.getTokenById(b.id)).toMatchObject({ x: 640, y: 500 });
    });

    it('a hero let go off the mat is a plain miss, and keeps their order', () => {
        const t = placeAt('fixture_producer', 600, 500);
        heroOnMat('h1', { x: 600, y: 500 });
        const result = dropOnMat(heroPayload('h1'), { x: -40, y: 300 });
        expect(result).toMatchObject({ success: false, offMat: true, flyBack: true });
        expect(Flags.pinnedIdOf('h1')).toBe(t.id);
    });
});
