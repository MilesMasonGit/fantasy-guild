// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterAll, beforeAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
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
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ owner ruling (R7-Q3 = A, Z §11): no hover during a drag. The drag ghost
 * has `pointer-events: none`, so a hero or flag underneath it still fires
 * `onMouseEnter` as the cursor crosses it — which used to show that hero's
 * reach ring and force a full `MatBoard` commit, even though the carried
 * Token would not land there. Only the rings of flags the Token would
 * actually land in (`FlagLayer`'s own `useTokenDragLanding` check) should
 * show mid-drag.
 */

const h = React.createElement;
const mount = (el) => render(
    h(EngineContext.Provider, { value: { GameState, EventBus } }, h(DeckDndProvider, null, el))
);

/** Picks up a mat Token and drags it past the 8px activation threshold. */
function startRealTokenDrag(container, instanceId) {
    const el = container.querySelector(`[data-token-id="${instanceId}"]`);
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 600, clientY: 600, isPrimary: true, button: 0 });
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 630, clientY: 600, isPrimary: true });
}

describe('hovering a hero mid-drag does not show its reach ring (CR3-410)', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    afterEach(() => { cleanup(); document.body.classList.remove('gi-dnd-active'); });

    beforeEach(() => {
        vi.clearAllMocks();
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        clearMat();
        GameState.state.heroes = [{
            id: 'h1', name: 'h1', spriteId: 'recruit', status: 'idle', level: 50,
            skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 }
        }];
    });

    it('a hero hover ring shows normally, but not while a Token is being dragged', () => {
        const token = placeAt('fixture_producer', 900, 600);
        // Far from the dragged Token, so no "would land in this flag's reach" case.
        Flags.plant('h1', { x: 250, y: 200 });
        expect(Flags.statusOf('h1').state).toBe('idle');

        const { container } = mount(h(MatBoard));
        const root = container.querySelector('[data-mat-board]');
        root.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: matH(), right: matW(), bottom: matH(), x: 0, y: 0 });

        const heroEl = container.querySelector('[data-board-hero="h1"]');
        expect(heroEl).not.toBeNull();

        // Control: hovering the hero with NO drag live does highlight it.
        fireEvent.mouseEnter(heroEl);
        expect(heroEl.getAttribute('data-outline')).toBe('hover');
        fireEvent.mouseLeave(heroEl);
        expect(heroEl.getAttribute('data-outline')).not.toBe('hover');

        // Now drag the Token (far from the flag's reach) and hover the hero again.
        act(() => startRealTokenDrag(container, token.id));
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);

        fireEvent.mouseEnter(heroEl);
        expect(heroEl.getAttribute('data-outline')).not.toBe('hover');
        expect(container.querySelector(`[data-flag-ring="h1"]`)).toBeNull();
    });
});
