// @vitest-environment jsdom
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
import { resetMatTuning } from '../config/matTuning.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';
import { useEntityDrag, DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { sourceCode, SCAN_TIMEOUT } from './fixtures/sourceScan.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ owner rulings (R7-Q2 = A for mat Tokens; 2026-11-07, option b, for every drag source): no
 * drag source is a keyboard Tab stop or carries the "press space to drag" screen-reader text,
 * since no keyboard sensor is registered (`DeckDndProvider` wires only `AlphaPointerSensor`) and
 * that instruction describes a drag that cannot happen. Pointer drag is unchanged.
 */

const h = React.createElement;
const mount = (el) => render(
    h(DndContext, null, el)
);

describe('useEntityDrag keyboardAccessible option (CR3-411)', () => {
    function Probe({ out, keyboardAccessible }) {
        const drag = useEntityDrag({ id: 't1', kind: 'token', payload: {}, keyboardAccessible });
        out.handleProps = drag.handleProps;
        return null;
    }
    // A drag source presses the drag provider's shared draggable, so it is drawn inside one.
    const mountSource = (el) => render(h(DeckDndProvider, null, el));

    it('⭐ by default a source carries none of dnd-kit’s keyboard attributes, only the pointer listener', () => {
        const out = {};
        mountSource(h(Probe, { out, keyboardAccessible: undefined }));
        expect(out.handleProps.tabIndex).toBeUndefined();
        expect(out.handleProps.role).toBeUndefined();
        expect(out.handleProps['aria-roledescription']).toBeUndefined();
        expect(out.handleProps['aria-describedby']).toBeUndefined();
        expect(out.handleProps['aria-pressed']).toBeUndefined();
        // The pointer handle itself is still live.
        expect(typeof out.handleProps.onPointerDown).toBe('function');
    });

    it('keyboardAccessible: true spreads them (kept for a keyboard sensor, should one come)', () => {
        const out = {};
        mountSource(h(Probe, { out, keyboardAccessible: true }));
        expect(out.handleProps.tabIndex).toBe(0);
        expect(out.handleProps.role).toBe('button');
        expect(out.handleProps['aria-roledescription']).toBe('draggable');
        expect(typeof out.handleProps.onPointerDown).toBe('function');
    });

    it('⭐ a default source drawn as a plain element is no Tab stop', () => {
        function Source() {
            const drag = useEntityDrag({ id: 's1', kind: 'item', payload: { itemId: 'x' } });
            return h('div', { ref: drag.setNodeRef, 'data-probe': 's1', ...drag.handleProps });
        }
        const { container } = mountSource(h(Source));
        const el = container.querySelector('[data-probe="s1"]');
        expect(el.hasAttribute('tabindex')).toBe(false);
        expect(el.hasAttribute('role')).toBe(false);
        expect(el.hasAttribute('aria-describedby')).toBe(false);
    });

    it('⭐ no game code turns the keyboard attributes on while no keyboard sensor is registered', () => {
        const code = sourceCode();
        const sensor = code.some(({ code: c }) => /\bKeyboardSensor\b/.test(c));
        const opted = code.filter(({ code: c }) => /keyboardAccessible\s*:\s*(?!false\b)/.test(c)).map(f => f.file);
        expect(sensor ? [] : opted).toEqual([]);
    }, SCAN_TIMEOUT);
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
