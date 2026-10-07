import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
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
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';
import { useEntityDrag } from '../ui/dnd/DndKit.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ owner ruling (R7-Q2 = A): take mat Tokens out of the keyboard Tab order
 * and drop the "press space to drag" screen-reader text, since no keyboard
 * sensor is registered (`DeckDndProvider` wires only `AlphaPointerSensor`)
 * and that instruction describes a drag that cannot happen.
 */

const h = React.createElement;
const mount = (el) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DndContext, null, el))
);

describe('useEntityDrag keyboardAccessible option (CR3-411)', () => {
    function Probe({ out, keyboardAccessible }) {
        const drag = useEntityDrag({ id: 't1', kind: 'token', payload: {}, keyboardAccessible });
        out.handleProps = drag.handleProps;
        return null;
    }

    it('defaults to including dnd-kits tabIndex/role/aria attributes', () => {
        const out = {};
        mount(h(Probe, { out, keyboardAccessible: undefined }));
        expect(out.handleProps.tabIndex).toBe(0);
        expect(out.handleProps.role).toBeDefined();
        expect(out.handleProps['aria-roledescription']).toBe('draggable');
        expect(out.handleProps['aria-describedby']).toBeDefined();
    });

    it('keyboardAccessible: false drops all of them, keeping only the pointer listeners', () => {
        const out = {};
        mount(h(Probe, { out, keyboardAccessible: false }));
        expect(out.handleProps.tabIndex).toBeUndefined();
        expect(out.handleProps.role).toBeUndefined();
        expect(out.handleProps['aria-roledescription']).toBeUndefined();
        expect(out.handleProps['aria-describedby']).toBeUndefined();
        // The pointer handle itself is still live.
        expect(typeof out.handleProps.onPointerDown).toBe('function');
    });
});

describe('a mat Token is not a keyboard Tab stop (CR3-411)', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    afterEach(() => cleanup());

    beforeEach(() => {
        vi.clearAllMocks();
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        clearMat();
        GameState.state.heroes = [];
    });

    it('carries no tabIndex, role or aria-describedby', () => {
        const token = placeAt('fixture_producer', 600, 600);
        const { container } = mount(h(MatBoard));
        const el = container.querySelector(`[data-token-id="${token.id}"]`);
        expect(el).not.toBeNull();
        expect(el.hasAttribute('tabindex')).toBe(false);
        expect(el.hasAttribute('role')).toBe(false);
        expect(el.hasAttribute('aria-describedby')).toBe(false);
        expect(el.hasAttribute('aria-roledescription')).toBe(false);
    });
});
