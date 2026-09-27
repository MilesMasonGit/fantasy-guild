import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MatDisallowControls } from '../ui/components/board/MatDisallowControls.jsx';
import { AlphaPointerSensor } from '../ui/dnd/DndKit.jsx';
import {
    isDisallowMode, setDisallowMode, flipDisallowed, disallowedCount
} from '../ui/hooks/useDisallowMode.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Token Lifecycle feedback **B2.3** — disallow mode and *Allow all* (FB-32),
 * on FP-35's per-Token disallow.
 */

/** A Token no hero works: disallow mode leaves it alone. */
registerTokenTypes({
    dm_scenery: {
        id: 'dm_scenery', name: 'DM Scenery', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 100, sprite: 'skill_nature', requiresHero: false
    }
});

const h = React.createElement;
const WORKABLE = 'fixture_producer';

const mountMat = (props = {}) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } },
        h(DndContext, null, h(MatBoard, props)))
);
const mountBar = () => render(h(MatDisallowControls));

const artOf = (container, id) => container.querySelector(`[data-token-id="${id}"][data-token-art]`);
const toggle = (c) => c.querySelector('[data-disallow-toggle]');
const allowAll = (c) => c.querySelector('[data-allow-all]');

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
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [];
    setDisallowMode(false);
});

afterEach(() => {
    cleanup();
    setDisallowMode(false);
});

describe('⭐ disallow mode on the mat (B2.3, FB-32)', () => {
    it('a click flips a Token disallowed, a second click allows it again', () => {
        const oak = placeAt(WORKABLE, 400, 200);
        const onInspectToken = vi.fn();
        const { container } = mountMat({ onInspectToken });
        act(() => setDisallowMode(true));

        fireEvent.click(artOf(container, oak.id));
        expect(Flags.isDisallowed(BoardState.getTokenById(oak.id))).toBe(true);
        fireEvent.click(artOf(container, oak.id));
        expect(Flags.isDisallowed(BoardState.getTokenById(oak.id))).toBe(false);

        // ⚠️ The normal click — inspect — never fires in the mode.
        expect(onInspectToken).not.toHaveBeenCalled();
    });

    it('with the mode off, a click inspects and flips nothing', () => {
        const oak = placeAt(WORKABLE, 400, 200);
        const onInspectToken = vi.fn();
        const { container } = mountMat({ onInspectToken });
        fireEvent.click(artOf(container, oak.id));
        expect(onInspectToken).toHaveBeenCalledTimes(1);
        expect(Flags.isDisallowed(BoardState.getTokenById(oak.id))).toBe(false);
    });

    it('the mat carries data-disallow-mode, the red edge and the hint only while on', () => {
        placeAt(WORKABLE, 400, 200);
        const { container } = mountMat();
        const board = container.querySelector('[data-mat-board]');
        expect(board.getAttribute('data-disallow-mode')).toBeNull();
        expect(container.querySelector('[data-disallow-edge]')).toBeNull();

        act(() => setDisallowMode(true));
        expect(board.getAttribute('data-disallow-mode')).toBe('on');
        expect(container.querySelector('[data-disallow-edge]').style.border).toContain('dashed');
        expect(container.querySelector('[data-disallow-hint]').textContent)
            .toBe('Click a Token to allow / disallow · Esc to finish');
    });

    it('a Token no hero works does not flip', () => {
        const rock = placeAt('dm_scenery', 400, 200);
        expect(flipDisallowed(rock.id).success).toBe(false);
        expect(Flags.isDisallowed(BoardState.getTokenById(rock.id))).toBe(false);
    });

    it('⭐ dragging on the mat cannot start while the mode is on', () => {
        const { onMat, cleanup } = pressTargets();
        expect(activates(onMat)).toBe(true);
        setDisallowMode(true);
        expect(activates(onMat)).toBe(false);
        setDisallowMode(false);
        expect(activates(onMat)).toBe(true);
        cleanup();
    });

    it('⭐ the dock and the Bank still drag in the mode (owner: mat only)', () => {
        const { offMat, cleanup } = pressTargets();
        setDisallowMode(true);
        expect(activates(offMat)).toBe(true);
        setDisallowMode(false);
        cleanup();
    });
});

describe('⭐ the toggle button (B2.3)', () => {
    it('turns the mode on and shows it, and a second press turns it off', () => {
        const { container } = mountBar();
        expect(toggle(container).getAttribute('data-disallow-toggle')).toBe('off');
        fireEvent.click(toggle(container));
        expect(isDisallowMode()).toBe(true);
        expect(toggle(container).getAttribute('data-disallow-toggle')).toBe('on');
        expect(toggle(container).getAttribute('aria-pressed')).toBe('true');
        expect(toggle(container).className).toContain('bg-[#791F1F]');
        fireEvent.click(toggle(container));
        expect(isDisallowMode()).toBe(false);
    });

    it('Esc ends the mode', () => {
        const { container } = mountBar();
        fireEvent.click(toggle(container));
        expect(isDisallowMode()).toBe(true);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(isDisallowMode()).toBe(false);
        expect(toggle(container).getAttribute('data-disallow-toggle')).toBe('off');
    });

    it('leaving the playmat (the bar goes away) ends the mode', () => {
        const { container, unmount } = mountBar();
        fireEvent.click(toggle(container));
        expect(isDisallowMode()).toBe(true);
        unmount();
        expect(isDisallowMode()).toBe(false);
    });
});

describe('⭐ Allow all (B2.3)', () => {
    it('shows the live count and allows every disallowed Token at once', () => {
        const a = placeAt(WORKABLE, 400, 200);
        const b = placeAt(WORKABLE, 560, 200);
        const c = placeAt(WORKABLE, 720, 200);
        const { container } = mountBar();
        expect(allowAll(container).textContent).toBe('Allow all');

        act(() => { Flags.setDisallowed(a.id, true); Flags.setDisallowed(b.id, true); });
        expect(allowAll(container).textContent).toBe('Allow all (2)');
        act(() => { Flags.setDisallowed(c.id, true); });
        expect(allowAll(container).textContent).toBe('Allow all (3)');

        fireEvent.click(allowAll(container));
        expect(disallowedCount()).toBe(0);
        expect([a, b, c].some(t => Flags.isDisallowed(BoardState.getTokenById(t.id)))).toBe(false);
        expect(allowAll(container).textContent).toBe('Allow all');
    });

    it('with none disallowed it is harmless, and works with the mode off', () => {
        placeAt(WORKABLE, 400, 200);
        const { container } = mountBar();
        expect(isDisallowMode()).toBe(false);
        expect(allowAll(container).disabled).toBe(false);
        fireEvent.click(allowAll(container));
        expect(disallowedCount()).toBe(0);
    });

    it('Flags.allowAll returns how many it allowed', () => {
        const a = placeAt(WORKABLE, 400, 200);
        placeAt(WORKABLE, 560, 200);
        Flags.setDisallowed(a.id, true);
        expect(Flags.allowAll()).toBe(1);
        expect(Flags.allowAll()).toBe(0);
    });
});
