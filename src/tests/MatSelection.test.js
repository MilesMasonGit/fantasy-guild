// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import './fixtures/testTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { matW, matH } from '../config/matGeometry.js';
import { OUTLINE_COLOURS } from '../config/spriteFx.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { tokenOutline, heroOutline } from '../ui/components/board/spriteOutline.js';
import { setMapMode, MAP_MODE } from '../ui/hooks/useMapMode.js';
import { pushEscapeLayer } from '../ui/utils/escapeLayers.js';
import {
    getSelection, clearSelection, selectHero, pickToken, isSelectableToken, useSelectionClearing,
    selectedHeroId, selectedTokenId, SELECTION_KIND
} from '../ui/hooks/useMatSelection.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
// A hero's figure takes a click only on a drawn pixel; jsdom draws none.
vi.mock('../ui/utils/alphaHitTest.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, isElementOpaqueAtPoint: () => true };
});

/**
 * ⭐ **Selecting on the mat** (brief 610 S1, `concept_rts_controls.md`). One selection: a hero or
 * a movable Token, an enemy you could drag included (owner, 2026-11-11). A single click selects; a
 * double-click inspects and selects. A fixed Token is never selected: a single click only clears.
 * The selection is drawn in gold and clears on blank mat, Escape, leaving the mat, travel and a map
 * mode.
 */

registerTokenTypes({
    sel_enemy: {
        id: 'sel_enemy', name: 'Sel Goblin', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        sprite: 's_nature', uses: 1, enemy: { level: 1, style: 'melee' }
    }
});

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
function doubleClick(el, point) {
    click(el, point);
    click(el, point);
    fireEvent.doubleClick(el, point);
}
function fixtureAt(x, y) {
    const instance = BoardState.createTokenInstance('fixture_producer', 100, null, BoardState.ORIGIN.PLACED);
    instance.fixture = true;
    return BoardState.addToken(instance, x, y);
}
const enemyAt = (x, y) => BoardState.addToken(BoardState.createTokenInstance('sel_enemy', null, null, BoardState.ORIGIN.SPAWNED), x, y);
function heroOnMat(id = 'h1', point = { x: 600, y: 400 }) {
    GameState.state.heroes.push({ id, name: id, spriteId: 'recruit', status: 'idle', level: 5, skills: {}, hp: { current: 100, max: 100 } });
    Orders.orderAt(id, point);
}

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    InventoryManager.init();
    SpriteLayer.init();
    clearMat();
    setMapMode(null);
    clearSelection();
});
afterEach(async () => {
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 0, clientY: 0 });
    await new Promise(r => setTimeout(r, 30));
    document.body.classList.remove('gi-dnd-active');
    cleanup();
    setMapMode(null);
    clearSelection();
});

describe('⭐ what can be selected', () => {
    it('a movable Token, the Guild Hall and an enemy you could drag; never a fixed Token', () => {
        const bought = placeAt('fixture_producer', 300, 300);
        const hall = placeAt('token_guild_hall', 900, 600);
        const node = fixtureAt(600, 300);
        const goblin = enemyAt(300, 800);
        expect(isSelectableToken(bought)).toBe(true);
        expect(isSelectableToken(hall)).toBe(true);
        expect(isSelectableToken(node)).toBe(false);
        expect(isSelectableToken(goblin)).toBe(true);
    });

    it('one at a time: a new pick replaces the old, a hero or a Token alike', () => {
        const a = placeAt('fixture_producer', 300, 300);
        const b = placeAt('fixture_producer', 600, 300);
        pickToken(a.id);
        expect(getSelection()).toEqual({ kind: SELECTION_KIND.TOKEN, id: a.id });
        pickToken(b.id);
        expect(selectedTokenId()).toBe(b.id);
        selectHero('h1');
        expect(getSelection()).toEqual({ kind: SELECTION_KIND.HERO, id: 'h1' });
        expect(selectedTokenId()).toBeNull();
        pickToken(a.id);
        expect(selectedHeroId()).toBeNull();
    });

    it('a pick of an unmovable Token clears the selection; a pick of an enemy selects it', () => {
        const a = placeAt('fixture_producer', 300, 300);
        const goblin = enemyAt(600, 300);
        const node = fixtureAt(900, 300);
        pickToken(a.id);
        expect(pickToken(node.id)).toBe(false);
        expect(getSelection()).toBeNull();
        expect(pickToken(goblin.id)).toBe(true);
        expect(getSelection()).toEqual({ kind: SELECTION_KIND.TOKEN, id: goblin.id });
    });

    it('nothing is selected while a map mode is on', () => {
        const a = placeAt('fixture_producer', 300, 300);
        setMapMode(MAP_MODE.DEMOLISH);
        pickToken(a.id);
        selectHero('h1');
        expect(getSelection()).toBeNull();
    });
});

describe('⭐ the gold outline', () => {
    it('picked wins over hover, inspection, alert and work; a map mode hover wins over it', () => {
        expect(tokenOutline({ picked: true, hovered: true, selected: true, alert: true, working: true })).toBe('select');
        expect(tokenOutline({ picked: true, hovered: true, mode: 'demolish' })).toBe('danger');
        expect(heroOutline({ picked: true, hovered: true, working: true })).toBe('select');
        expect(heroOutline({ hovered: true })).toBe('hover');
    });

    it('is the UI gold, generated beside the other outline colours', () => {
        expect(OUTLINE_COLOURS.select).toEqual([251, 191, 36]);
    });
});

describe('⭐ single click selects, double-click inspects (a Token on the mat)', () => {
    it('a single click on a movable Token selects it, outlines it gold and opens no card', () => {
        const t = placeAt('fixture_producer', 600, 500);
        const onInspectToken = vi.fn();
        const { container } = mount({ onInspectToken });
        act(() => click(hitOf(container, t.id), at(t)));
        expect(selectedTokenId()).toBe(t.id);
        expect(onInspectToken).not.toHaveBeenCalled();
        expect(artOf(container, t.id).getAttribute('data-outline')).toBe('select');
    });

    it('a double-click opens the card and selects', () => {
        const t = placeAt('fixture_producer', 600, 500);
        const onInspectToken = vi.fn();
        const { container } = mount({ onInspectToken });
        act(() => doubleClick(hitOf(container, t.id), at(t)));
        expect(onInspectToken).toHaveBeenCalledTimes(1);
        expect(onInspectToken).toHaveBeenCalledWith('fixture_producer', expect.anything(), t.id);
        expect(selectedTokenId()).toBe(t.id);
    });

    it('an unmovable Token: a single click only clears; a double-click inspects and selects nothing', () => {
        const a = placeAt('fixture_producer', 300, 300);
        const node = fixtureAt(900, 500);
        const onInspectToken = vi.fn();
        const { container } = mount({ onInspectToken });
        act(() => click(hitOf(container, a.id), at(a)));
        expect(selectedTokenId()).toBe(a.id);
        act(() => click(hitOf(container, node.id), at(node)));
        expect(getSelection()).toBeNull();
        expect(onInspectToken).not.toHaveBeenCalled();
        expect(artOf(container, node.id).getAttribute('data-outline')).not.toBe('select');

        act(() => doubleClick(hitOf(container, node.id), at(node)));
        expect(onInspectToken).toHaveBeenCalledWith('fixture_producer', expect.anything(), node.id);
        expect(getSelection()).toBeNull();
    });

    it('an enemy you could drag: a single click selects it in gold; a double-click inspects and selects', () => {
        const goblin = enemyAt(900, 500);
        const onInspectToken = vi.fn();
        const { container } = mount({ onInspectToken });
        act(() => click(hitOf(container, goblin.id), at(goblin)));
        expect(selectedTokenId()).toBe(goblin.id);
        expect(onInspectToken).not.toHaveBeenCalled();
        expect(artOf(container, goblin.id).getAttribute('data-outline')).toBe('select');
        clearSelection();
        act(() => doubleClick(hitOf(container, goblin.id), at(goblin)));
        expect(onInspectToken).toHaveBeenCalledWith('sel_enemy', expect.anything(), goblin.id);
        expect(selectedTokenId()).toBe(goblin.id);
    });

    it('a single click of another Token closes the open card; one of its own Token keeps it', () => {
        const a = placeAt('fixture_producer', 300, 300);
        const b = placeAt('fixture_producer', 900, 300);
        const onClearInspect = vi.fn();
        const { container } = mount({ onClearInspect, inspectedTokenId: a.id });
        act(() => click(hitOf(container, a.id), at(a)));
        expect(onClearInspect).not.toHaveBeenCalled();
        act(() => click(hitOf(container, b.id), at(b)));
        expect(onClearInspect).toHaveBeenCalled();
        expect(selectedTokenId()).toBe(b.id);
    });

    it('a pick redraws no Token but the two whose outline changes', () => {
        const a = placeAt('fixture_producer', 300, 300);
        const b = placeAt('fixture_producer', 900, 300);
        const c = placeAt('fixture_producer', 600, 700);
        const { container } = mount();
        const before = artOf(container, c.id).innerHTML;
        act(() => click(hitOf(container, a.id), at(a)));
        act(() => click(hitOf(container, b.id), at(b)));
        expect(artOf(container, a.id).getAttribute('data-outline')).toBeNull();
        expect(artOf(container, b.id).getAttribute('data-outline')).toBe('select');
        expect(artOf(container, c.id).innerHTML).toBe(before);
    });

    it('in Demolish mode a click marks and never selects', () => {
        const a = placeAt('fixture_producer', 300, 300);
        setMapMode(MAP_MODE.DEMOLISH);
        const { container } = mount();
        act(() => click(hitOf(container, a.id), at(a)));
        expect(getSelection()).toBeNull();
    });
});

describe('⭐ single click selects, double-click inspects (a hero on the mat)', () => {
    it('a single click selects the hero (gold) and opens nothing; a double-click opens the drawer', () => {
        heroOnMat('h1');
        const opened = [];
        const off = EventBus.subscribe(UI_EVENTS.INSPECT_HERO, (p) => opened.push(p.heroId));
        const { container } = mount();
        const figure = container.querySelector('[data-board-hero="h1"]');
        act(() => { fireEvent.click(figure); });
        expect(selectedHeroId()).toBe('h1');
        expect(opened).toEqual([]);
        expect(figure.getAttribute('data-outline')).toBe('select');
        act(() => { fireEvent.doubleClick(figure); });
        expect(opened).toEqual(['h1']);
        expect(selectedHeroId()).toBe('h1');
        off();
    });
});

describe('⭐ a click again on what is selected clears it (owner, 2026-11-12)', () => {
    /** A browser's double-click: two clicks counting up (`detail`), then the dblclick. */
    function realDoubleClick(el, point = {}) {
        fireEvent.pointerDown(el, { pointerId: 1, isPrimary: true, button: 0, ...point });
        fireEvent.click(el, { ...point, detail: 1 });
        fireEvent.pointerDown(el, { pointerId: 1, isPrimary: true, button: 0, ...point });
        fireEvent.click(el, { ...point, detail: 2 });
        fireEvent.doubleClick(el, { ...point, detail: 2 });
    }
    const singleClick = (el, point = {}) => {
        fireEvent.pointerDown(el, { pointerId: 1, isPrimary: true, button: 0, ...point });
        fireEvent.click(el, { ...point, detail: 1 });
    };

    it.each([
        ['a movable Token', () => placeAt('fixture_producer', 600, 500)],
        ['an enemy', () => enemyAt(900, 500)]
    ])('%s: a second single click clears it and its gold outline', (_label, make) => {
        const t = make();
        const { container } = mount();
        act(() => singleClick(hitOf(container, t.id), at(t)));
        expect(selectedTokenId()).toBe(t.id);
        act(() => singleClick(hitOf(container, t.id), at(t)));
        expect(getSelection()).toBeNull();
        expect(artOf(container, t.id).getAttribute('data-outline')).not.toBe('select');
        act(() => singleClick(hitOf(container, t.id), at(t)));
        expect(selectedTokenId()).toBe(t.id);
    });

    it('a hero on the mat: a second single click clears them', () => {
        heroOnMat('h1');
        const { container } = mount();
        const figure = container.querySelector('[data-board-hero="h1"]');
        act(() => { fireEvent.click(figure, { detail: 1 }); });
        expect(selectedHeroId()).toBe('h1');
        act(() => { fireEvent.click(figure, { detail: 1 }); });
        expect(getSelection()).toBeNull();
        expect(figure.getAttribute('data-outline')).not.toBe('select');
    });

    it.each([
        ['not yet selected', false],
        ['already selected', true]
    ])('a double-click on a Token %s ends with it selected and its card open', (_label, before) => {
        const t = placeAt('fixture_producer', 600, 500);
        const onInspectToken = vi.fn();
        const { container } = mount({ onInspectToken });
        if (before) act(() => singleClick(hitOf(container, t.id), at(t)));
        act(() => realDoubleClick(hitOf(container, t.id), at(t)));
        expect(selectedTokenId()).toBe(t.id);
        expect(onInspectToken).toHaveBeenCalledTimes(1);
        expect(artOf(container, t.id).getAttribute('data-outline')).toBe('select');
    });

    it.each([
        ['not yet selected', false],
        ['already selected', true]
    ])('a double-click on a hero %s ends with them selected and their drawer asked for', (_label, before) => {
        heroOnMat('h1');
        const opened = [];
        const off = EventBus.subscribe(UI_EVENTS.INSPECT_HERO, (p) => opened.push(p.heroId));
        const { container } = mount();
        const figure = container.querySelector('[data-board-hero="h1"]');
        if (before) act(() => { fireEvent.click(figure, { detail: 1 }); });
        act(() => realDoubleClick(figure));
        expect(selectedHeroId()).toBe('h1');
        expect(opened).toEqual(['h1']);
        off();
    });

    it('a drag of the selected hero does not clear them: the drop’s own click is no click again', async () => {
        heroOnMat('h1');
        const { container } = mount();
        const figure = container.querySelector('[data-board-hero="h1"]');
        act(() => { fireEvent.click(figure, { detail: 1 }); });
        expect(selectedHeroId()).toBe('h1');
        const ptr = (x, y) => ({ pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y });
        act(() => {
            fireEvent.pointerDown(figure, ptr(600, 400));
            fireEvent.pointerMove(document, ptr(630, 400));
        });
        await act(async () => { fireEvent.pointerMove(document, ptr(900, 700)); await new Promise(r => setTimeout(r, 30)); });
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);
        await act(async () => {
            fireEvent.pointerUp(document, ptr(900, 700));
            fireEvent.click(figure, { ...ptr(900, 700), detail: 1 });
            await new Promise(r => setTimeout(r, 30));
        });
        expect(selectedHeroId()).toBe('h1');
    });
});

describe('⭐ what clears the selection', () => {
    it('a click on blank mat; not a click that ends a drag', () => {
        const t = placeAt('fixture_producer', 600, 500);
        const { container, mat } = mount();
        const ground = mat.querySelector('[data-mat-surface]');
        act(() => click(hitOf(container, t.id), at(t)));
        // A press that moved (a drag's end) is not a click on blank mat.
        act(() => {
            fireEvent.pointerDown(ground, { clientX: 100, clientY: 100 });
            fireEvent.click(ground, { clientX: 300, clientY: 100 });
        });
        expect(selectedTokenId()).toBe(t.id);
        act(() => click(ground, { clientX: 100, clientY: 100 }));
        expect(getSelection()).toBeNull();
    });

    function Clearing({ leftMat }) {
        useSelectionClearing(leftMat);
        return null;
    }

    it('leaving the mat (the World Map, the Guild Hall)', () => {
        selectHero('h1');
        const view = render(h(Clearing, { leftMat: false }));
        expect(selectedHeroId()).toBe('h1');
        view.rerender(h(Clearing, { leftMat: true }));
        expect(getSelection()).toBeNull();
    });

    it('a map mode coming on', () => {
        render(h(Clearing, { leftMat: false }));
        act(() => selectHero('h1'));
        act(() => setMapMode(MAP_MODE.DEMOLISH));
        expect(getSelection()).toBeNull();
    });

    it('travel to another Region and a load; not an Atlas change that stays in the Region', () => {
        GameState.state.atlas = { activeRegionId: 'r1', regions: { r1: { id: 'r1' }, r2: { id: 'r2' } } };
        render(h(Clearing, { leftMat: false }));
        act(() => selectHero('h1'));
        act(() => { EventBus.publish(ENGINE_EVENTS.ATLAS_CHANGED, {}); });
        expect(selectedHeroId()).toBe('h1');
        GameState.state.atlas.activeRegionId = 'r2';
        act(() => { EventBus.publish(ENGINE_EVENTS.ATLAS_CHANGED, {}); });
        expect(getSelection()).toBeNull();
        act(() => selectHero('h1'));
        act(() => { EventBus.publish(ENGINE_EVENTS.GAME_RESET, {}); });
        expect(getSelection()).toBeNull();
    });

    it('its Token gone from the mat, or its hero gone from the roster', () => {
        const t = placeAt('fixture_producer', 600, 500);
        GameState.state.heroes = [{ id: 'h1', name: 'h1', hp: { current: 1, max: 1 } }];
        render(h(Clearing, { leftMat: false }));
        act(() => { pickToken(t.id); });
        BoardState.removeToken(t.id);
        act(() => { EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: t.id }); });
        expect(getSelection()).toBeNull();
        act(() => selectHero('h1'));
        GameState.state.heroes = [];
        act(() => { EventBus.publish(ENGINE_EVENTS.HEROES_UPDATED, {}); });
        expect(getSelection()).toBeNull();
    });

    it('Escape, but only once every open layer above it has closed', () => {
        render(h(Clearing, { leftMat: false }));
        act(() => selectHero('h1'));
        // A panel opened after the selection is above it, and so is one opened before it.
        const closed = [];
        const offPanel = pushEscapeLayer(() => { closed.push('panel'); offPanel(); });
        act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
        expect(closed).toEqual(['panel']);
        expect(selectedHeroId()).toBe('h1');
        act(() => { fireEvent.keyDown(window, { key: 'Escape' }); });
        expect(getSelection()).toBeNull();
    });

    it('the Bank and the Shop opening keep it (they are no full-screen view)', () => {
        // ReactRoot hands `leftMat` only for the World Map and the Guild Hall.
        const code = fs.readFileSync(path.resolve(__dirname, '../ui/ReactRoot.jsx'), 'utf8');
        expect(code).toContain('useSelectionClearing(isAtlasOpen || isGuildView);');
    });
});
