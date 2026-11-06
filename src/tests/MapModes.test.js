// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MatToken } from '../ui/components/board/MatToken.jsx';
import { CalloutLayer } from '../ui/components/board/CalloutLayer.jsx';
import { MatTopBar } from '../ui/components/board/MatTopBar.jsx';
import {
    MapModeToggles, MapModeBanner, MODE_BANNER_TEXT
} from '../ui/components/board/MatModeControls.jsx';
import { tokenOutline } from '../ui/components/board/spriteOutline.js';
import { mapModeCursor, cursorPixels, mapModeIconSrc } from '../ui/components/board/mapModeCursor.js';
import { OUTLINE_COLOURS } from '../config/spriteFx.js';
import { matW } from '../config/matGeometry.js';
import { AlphaPointerSensor } from '../ui/dnd/DndKit.jsx';
import {
    MAP_MODE, getMapMode, setMapMode, isDemolishMode, markedCount, cancelAllMarks
} from '../ui/hooks/useMapMode.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The map tool mode, Demolish (concept_map_tools.md): a banner on the top bar with its batch
 * control, the mode's hover outline and cursor, protected Tokens dimmed with the engine's reason
 * on a click, Esc.
 */

const h = React.createElement;
const WORKABLE = 'fixture_producer';
const OTHER = 'fixture_station';

const mountMat = (props = {}) => render(
    h(DndContext, null, h(MatBoard, props), h(CalloutLayer))
);
/** The bar as the game draws it: banner in the middle, toggles on the right. */
const mountBar = () => render(h(MatTopBar, { middle: h(MapModeBanner), right: h(MapModeToggles) }));

const artOf = (container, id) => container.querySelector(`[data-token-id="${id}"][data-token-art]`);
const toggle = (c, mode) => c.querySelector(`[data-map-mode-toggle="${mode}"]`);
const banner = (c) => c.querySelector('[data-map-mode-banner]');
const cancelMarks = (c) => c.querySelector('[data-cancel-all-marks]');
const marked = (t) => Demolition.isMarked(BoardState.getTokenById(t.id));

/** The pointer-down activator every drag source goes through. */
const activates = (target = null) => AlphaPointerSensor.activators[0].handler({
    nativeEvent: { isPrimary: true, button: 0, target, clientX: 0, clientY: 0 }
});

/** A press on something inside the mat's box, and one outside it (the dock, the Bank). */
function pressTargets() {
    const mat = document.createElement('div');
    mat.setAttribute('data-board-origin', '');
    const onMat = document.createElement('div');
    mat.appendChild(onMat);
    const offMat = document.createElement('div');
    document.body.append(mat, offMat);
    return { onMat, offMat, cleanup: () => { mat.remove(); offMat.remove(); } };
}

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());

beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [];
    setMapMode(null);
});

afterEach(() => {
    cleanup();
    setMapMode(null);
});

describe('⭐ the toggle', () => {
    it('a press turns Demolish mode on and a second press ends it', () => {
        const { container } = mountBar();
        fireEvent.click(toggle(container, MAP_MODE.DEMOLISH));
        expect(isDemolishMode()).toBe(true);
        expect(toggle(container, MAP_MODE.DEMOLISH).getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(toggle(container, MAP_MODE.DEMOLISH));
        expect(getMapMode()).toBeNull();
        expect(toggle(container, MAP_MODE.DEMOLISH).getAttribute('aria-pressed')).toBe('false');
    });

    it('Demolish is the only toggle on the right; Disallow is gone', () => {
        const { container } = mountBar();
        const right = container.querySelector('[data-mat-top-bar-right]');
        expect([...right.querySelectorAll('[data-map-mode-toggle]')].map(b => b.textContent))
            .toEqual(['Demolish']);
        expect(Object.values(MAP_MODE)).toEqual(['demolish']);
        expect(container.textContent).not.toMatch(/disallow/i);
    });

    it('⭐ Demolish wears its cursor’s pixel X beside its word, not a text mark', () => {
        const { container } = mountBar();
        const button = toggle(container, MAP_MODE.DEMOLISH);
        const icon = button.querySelector('img[data-map-mode-icon="demolish"]');
        expect(icon).not.toBeNull();
        expect(icon.getAttribute('src')).toBe(mapModeIconSrc(MAP_MODE.DEMOLISH));
        expect(mapModeCursor(MAP_MODE.DEMOLISH)).toContain(mapModeIconSrc(MAP_MODE.DEMOLISH));
        expect(icon.getAttribute('width')).toBe('22');
        expect(icon.style.imageRendering).toBe('pixelated');
        expect(button.textContent).toBe('Demolish');
        expect(button.textContent).not.toContain('✕');
    });

    it('Esc ends the mode', () => {
        const { container } = mountBar();
        fireEvent.click(toggle(container, MAP_MODE.DEMOLISH));
        expect(getMapMode()).toBe(MAP_MODE.DEMOLISH);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(getMapMode()).toBeNull();
        expect(banner(container)).toBeNull();
    });

    it('leaving the playmat (the bar goes away) ends the mode', () => {
        const { container, unmount } = mountBar();
        fireEvent.click(toggle(container, MAP_MODE.DEMOLISH));
        unmount();
        expect(getMapMode()).toBeNull();
    });
});

describe('⭐ the banner', () => {
    it('says the owner’s exact words', () => {
        expect(MODE_BANNER_TEXT[MAP_MODE.DEMOLISH])
            .toBe('Demolish mode: click Tokens to mark them. A Construction hero takes them down. Nothing is refunded.');
    });

    it('shows in the bar’s centre only while the mode is on, in red', () => {
        const { container } = mountBar();
        const middle = container.querySelector('[data-mat-top-bar-middle]');
        expect(middle.textContent).toBe('');

        act(() => setMapMode(MAP_MODE.DEMOLISH));
        const text = () => middle.querySelector('[data-map-mode-banner-text]');
        expect(banner(container).getAttribute('data-map-mode-banner')).toBe('demolish');
        expect(text().textContent).toBe(MODE_BANNER_TEXT[MAP_MODE.DEMOLISH]);
        expect(text().style.color).toBe('var(--color-ui-red)');
        expect(cancelMarks(middle)).not.toBeNull();
        expect(middle.querySelector('[data-allow-all]')).toBeNull();

        act(() => setMapMode(null));
        expect(middle.textContent).toBe('');
    });

    it('⭐ Demolish warns once, on entering: after that, clicks mark and unmark without asking', () => {
        const a = placeAt(WORKABLE, 400, 200);
        const b = placeAt(WORKABLE, 560, 200);
        const alerts = vi.fn();
        const unsub = EventBus.subscribe(UI_EVENTS.UI_TOKEN_ALERT, alerts);
        const bar = mountBar();
        const { container } = mountMat();
        fireEvent.click(toggle(bar.container, MAP_MODE.DEMOLISH));
        expect(banner(bar.container).textContent).toContain('Nothing is refunded.');

        fireEvent.click(artOf(container, a.id));
        fireEvent.click(artOf(container, b.id));
        fireEvent.click(artOf(container, a.id));
        expect(marked(a)).toBe(false);
        expect(marked(b)).toBe(true);
        expect(alerts).not.toHaveBeenCalled();
        expect(NotificationSystem.warning).not.toHaveBeenCalled();
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        unsub();
    });
});

describe('⭐ the mode on the mat', () => {
    it('with no mode on, a click inspects and changes nothing; a shift-click does the same', () => {
        const oak = placeAt(WORKABLE, 400, 200);
        const other = placeAt(WORKABLE, 560, 200);
        const onInspectToken = vi.fn();
        const { container } = mountMat({ onInspectToken });
        fireEvent.click(artOf(container, oak.id));
        expect(onInspectToken).toHaveBeenCalledTimes(1);
        fireEvent.click(artOf(container, other.id), { shiftKey: true });
        expect(onInspectToken).toHaveBeenCalledTimes(2);
        expect([oak, other].map(marked)).toEqual([false, false]);
        expect([oak, other].some(t => 'disallowed' in BoardState.getTokenById(t.id))).toBe(false);
    });

    it('⭐ a click on a Token’s "choose a recipe" mark is the Token’s click', () => {
        const a = placeAt(OTHER, 400, 200);
        const b = placeAt(OTHER, 560, 200);
        const onOpenRecipes = vi.fn();
        const { container } = mountMat({ onOpenRecipes });
        const mark = (t) => container.querySelector(`[data-token-overlay="${t.id}"] [data-problem-mark]`);
        expect(mark(a)).not.toBeNull();
        act(() => setMapMode(MAP_MODE.DEMOLISH));

        fireEvent.click(mark(a), { shiftKey: true });
        expect([a, b].map(marked)).toEqual([true, false]);
        fireEvent.click(mark(b));
        expect([a, b].map(marked)).toEqual([true, true]);
        expect(onOpenRecipes).not.toHaveBeenCalled();
    });

    it('the mat carries the mode, a dashed edge in its colour and its cursor only while on', () => {
        placeAt(WORKABLE, 400, 200);
        const { container } = mountMat();
        const board = container.querySelector('[data-mat-board]');
        expect(board.getAttribute('data-map-mode')).toBeNull();
        expect(container.querySelector('[data-map-mode-edge]')).toBeNull();
        expect(board.style.getPropertyValue('--map-mode-cursor')).toBe('');

        act(() => setMapMode(MAP_MODE.DEMOLISH));
        expect(board.getAttribute('data-map-mode')).toBe('demolish');
        const edge = container.querySelector('[data-map-mode-edge]');
        expect(edge.style.border).toContain('dashed');
        expect(edge.style.border).toContain('var(--color-ui-red)');
        expect(board.style.getPropertyValue('--map-mode-cursor')).toBe(mapModeCursor(MAP_MODE.DEMOLISH));

        act(() => setMapMode(null));
        expect(container.querySelector('[data-map-mode-edge]')).toBeNull();
    });

    it('⭐ dragging on the mat cannot start in the mode; the dock and the Bank still drag', () => {
        const { onMat, offMat, cleanup } = pressTargets();
        expect(activates(onMat)).toBe(true);
        setMapMode(MAP_MODE.DEMOLISH);
        expect(activates(onMat)).toBe(false);
        expect(activates(offMat)).toBe(true);
        setMapMode(null);
        expect(activates(onMat)).toBe(true);
        cleanup();
    });
});

describe('⭐ Demolish mode on the mat', () => {
    it('a click marks a Token, a second click unmarks it', () => {
        const oak = placeAt(WORKABLE, 400, 200);
        const onInspectToken = vi.fn();
        const { container } = mountMat({ onInspectToken });
        act(() => setMapMode(MAP_MODE.DEMOLISH));
        fireEvent.click(artOf(container, oak.id));
        expect(marked(oak)).toBe(true);
        fireEvent.click(artOf(container, oak.id));
        expect(marked(oak)).toBe(false);
        expect(onInspectToken).not.toHaveBeenCalled();
    });

    it('⭐ a click on the Token’s demolition mark (a bubble over it) unmarks it', async () => {
        const oak = placeAt(WORKABLE, 400, 200);
        const onInspectToken = vi.fn();
        const { container } = mountMat({ onInspectToken });
        act(() => setMapMode(MAP_MODE.DEMOLISH));
        await act(async () => { fireEvent.click(artOf(container, oak.id)); });
        const badge = container.querySelector(`[data-token-overlay="${oak.id}"] [data-demolish-badge]`);
        expect(badge).not.toBeNull();
        fireEvent.click(badge);
        expect(marked(oak)).toBe(false);
        // With no mode on, a bubble's click does nothing new.
        act(() => setMapMode(null));
        fireEvent.click(container.querySelector(`[data-token-overlay="${oak.id}"]`));
        expect(marked(oak)).toBe(false);
        expect(onInspectToken).not.toHaveBeenCalled();
    });

    it('a shift-click in Demolish mode marks only the Token clicked', () => {
        const a = placeAt(WORKABLE, 400, 200);
        const b = placeAt(WORKABLE, 560, 200);
        const { container } = mountMat();
        act(() => setMapMode(MAP_MODE.DEMOLISH));
        fireEvent.click(artOf(container, a.id), { shiftKey: true });
        expect([a, b].map(marked)).toEqual([true, false]);
    });

    it('⭐ protected Tokens dim, and only in Demolish mode', () => {
        const oak = placeAt(WORKABLE, 400, 200);
        const camp = placeAt(WORKABLE, 560, 200);
        camp.fixture = BoardState.FIXTURE.CAMP;
        const hall = placeAt('token_guild_hall', 880, 560);
        const { container } = mountMat();
        const dim = (t) => artOf(container, t.id).getAttribute('data-token-protected') === 'true'
            && !!artOf(container, t.id).querySelector('.gi-token-protected');

        expect([oak, camp, hall].map(dim)).toEqual([false, false, false]);
        act(() => setMapMode(MAP_MODE.DEMOLISH));
        expect([oak, camp, hall].map(dim)).toEqual([false, true, true]);
        act(() => setMapMode(null));
        expect([oak, camp, hall].map(dim)).toEqual([false, false, false]);
    });

    it('⭐ a click on a camp Token shows the engine’s reason over it and marks nothing', () => {
        vi.useFakeTimers();
        try {
            const camp = placeAt(WORKABLE, 560, 200);
            camp.fixture = BoardState.FIXTURE.CAMP;
            const { container } = mountMat();
            act(() => setMapMode(MAP_MODE.DEMOLISH));
            act(() => { fireEvent.click(artOf(container, camp.id)); });
            expect(marked(camp)).toBe(false);
            const callout = container.querySelector('[data-callout]');
            expect(callout.textContent).toBe(Demolition.REFUSAL_TEXT[Demolition.REFUSAL.CAMP]);
            expect(callout.textContent).toBe('This came with the Starter Camp, so it cannot be demolished.');
        } finally {
            vi.useRealTimers();
        }
    });

    it('the Guild Hall and a map node say their own reasons', () => {
        vi.useFakeTimers();
        try {
            const node = placeAt(WORKABLE, 400, 200);
            node.fixture = BoardState.FIXTURE.MAP;
            const hall = placeAt('token_guild_hall', 880, 560);
            const { container } = mountMat();
            act(() => setMapMode(MAP_MODE.DEMOLISH));
            act(() => { fireEvent.click(artOf(container, node.id)); fireEvent.click(artOf(container, hall.id)); });
            const said = [...container.querySelectorAll('[data-callout]')].map(c => c.textContent);
            expect(said).toContain(Demolition.REFUSAL_TEXT[Demolition.REFUSAL.MAP_NODE]);
            expect(said).toContain(Demolition.REFUSAL_TEXT[Demolition.REFUSAL.GUILD_HALL]);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('⭐ the hover outline takes the mode’s colour', () => {
    it('white with no mode, red in Demolish, muted on a Token the mode cannot act on', () => {
        expect(tokenOutline({ hovered: true })).toBe('hover');
        expect(tokenOutline({ hovered: true, mode: 'demolish' })).toBe('danger');
        expect(tokenOutline({ hovered: true, mode: 'demolish', unavailable: true })).toBe('muted');
        // Not hovered, a Token keeps its usual outline in a mode.
        expect(tokenOutline({ working: true, mode: 'demolish' })).toBe('work');
        expect(tokenOutline({ selected: true, mode: 'demolish' })).toBe('hover');
    });

    it('the two new outline colours are UI_STYLE’s muted grey and red', () => {
        expect(OUTLINE_COLOURS.muted).toEqual([115, 115, 115]);
        expect(OUTLINE_COLOURS.danger).toEqual([255, 45, 85]);
    });

    it('a hovered Token on the mat draws the mode’s outline', () => {
        const oak = placeAt(WORKABLE, 400, 200);
        const camp = placeAt(WORKABLE, 560, 200);
        camp.fixture = BoardState.FIXTURE.CAMP;
        const token = (t, props) => render(h(DndContext, null, h(MatToken, { id: t.id, typeId: t.typeId, x: t.x, y: t.y, isHovered: true, ...props })));
        const outline = (r, t) => artOf(r.container, t.id).getAttribute('data-outline');
        expect(outline(token(oak, {}), oak)).toBe('hover');
        cleanup();
        expect(outline(token(oak, { mapMode: 'demolish' }), oak)).toBe('danger');
        cleanup();
        expect(outline(token(camp, { mapMode: 'demolish' }), camp)).toBe('muted');
    });

    it('the mode cursor is a pixel glyph with a black edge, its hot spot in its centre', () => {
        const px = cursorPixels(['.x.', 'xxx', '.x.']);
        expect(px.w).toBe(5);
        expect(px.fill).toHaveLength(5);
        expect(px.edge).toHaveLength(8);
        for (const mode of [MAP_MODE.DEMOLISH]) {
            expect(mapModeCursor(mode)).toMatch(/^url\("data:image\/svg\+xml,.+"\) 11 11, pointer$/);
        }
        expect(decodeURIComponent(mapModeCursor(MAP_MODE.DEMOLISH))).toContain("fill='#ff2d55'");
        expect(mapModeCursor('disallow')).toBeNull();
        expect(mapModeCursor(null)).toBeNull();
    });

    it('⭐ hovering in a mode outlines only the hovered Token, in the mode’s colour', () => {
        const ids = [400, 560, 720].map(x => placeAt(WORKABLE, x, 200).id);
        const { container } = mountMat();
        act(() => setMapMode(MAP_MODE.DEMOLISH));
        const board = container.querySelector('[data-mat-board]');
        const before = ids.map(id => artOf(container, id).getAttribute('data-outline'));
        expect(before).toEqual([null, null, null]);
        const t = BoardState.getTokenById(ids[0]);
        // jsdom has no layout: the mat is drawn at its natural size from the window's corner.
        board.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: 1, right: matW(), bottom: 1, x: 0, y: 0 });
        fireEvent.pointerMove(board, { clientX: t.x, clientY: t.y });
        const after = ids.map(id => artOf(container, id).getAttribute('data-outline'));
        expect(after).toEqual(['danger', null, null]);
    });
});

describe('⭐ the batch controls', () => {
    it('⭐ Cancel all marks unmarks every marked Token at once, and they stay on the mat', () => {
        const a = placeAt(WORKABLE, 400, 200);
        const b = placeAt(WORKABLE, 560, 200);
        const c = placeAt(OTHER, 720, 200);
        setMapMode(MAP_MODE.DEMOLISH);
        const { container } = mountBar();
        expect(cancelMarks(container).textContent).toBe('Cancel all marks');

        act(() => { Demolition.mark(a.id); Demolition.mark(c.id); });
        expect(cancelMarks(container).textContent).toBe('Cancel all marks (2)');
        expect(markedCount()).toBe(2);

        fireEvent.click(cancelMarks(container));
        expect([a, b, c].map(marked)).toEqual([false, false, false]);
        expect([a, b, c].every(t => BoardState.getTokenById(t.id))).toBe(true);
        expect(cancelMarks(container).textContent).toBe('Cancel all marks');
        expect(cancelAllMarks()).toBe(0);
    });
});
