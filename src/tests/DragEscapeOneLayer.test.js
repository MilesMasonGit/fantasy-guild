import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';

/**
 * ⭐ owner ruling (Z §11, Q16): "one Escape, one layer." During a drag,
 * Escape must only cancel the drag — not also close the hero sheet or end
 * disallow mode, even though both of those ALSO listen for Escape on
 * `document`.
 */

const STATUS = new Map();
vi.mock('../systems/board/Flags.js', () => ({
    statusOf: (heroId) => ({ state: STATUS.get(heroId) || 'docked', instanceId: null, typeId: null, limping: false }),
    flagReaches: () => false,
    allowAll: vi.fn(),
    setDisallowed: vi.fn()
}));
vi.mock('../ui/components/drawer/HeroInspectionSheet.jsx', () => ({
    HeroInspectionSheet: () => React.createElement('div', { 'data-testid': 'hero-sheet' })
}));

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { BottomHeroDock } from '../ui/components/dock/BottomHeroDock.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { toggleDisallowMode, setDisallowMode } from '../ui/hooks/useDisallowMode.js';
import { DisallowModeToggle } from '../ui/components/board/MatDisallowControls.jsx';

const h = React.createElement;

const hero = (id, name) => (
    { id, name, spriteId: 'hero_recruit_0', hp: { current: 100, max: 100 }, status: 'idle', equipment: {} }
);

const engine = {
    GameState,
    EventBus,
    BoardPlacement: { recallHeroById: vi.fn() },
    EquipmentManager: { equipItem: vi.fn() }
};

beforeEach(() => {
    STATUS.clear();
    GameState.initNew();
    GameState.state.heroes = [hero('h1', 'Aldric'), hero('h2', 'Brenna')];
    setLiveMatFit(1);
    setDisallowMode(false);
});
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    document.body.classList.remove('gi-dnd-active');
    setDisallowMode(false);
});

/** Picks up `[data-dock-hero="h2"]` and drags it past the activation threshold. */
function startRealDrag(container) {
    const el = container.querySelector('[data-dock-hero="h2"]');
    fireEvent.pointerDown(el, { pointerId: 1, clientX: 100, clientY: 100, isPrimary: true, button: 0 });
    // dnd-kit's sensor listens on the ORIGINAL target element (pointer
    // capture semantics), not window/document — see getEventListenerTarget
    // in @dnd-kit/core. Past the 8px activation distance.
    fireEvent.pointerMove(el, { pointerId: 1, clientX: 130, clientY: 100, isPrimary: true });
}

describe('Escape mid-drag only cancels the drag (CR3-409)', () => {
    it('does NOT close the hero sheet while a drag is live', () => {
        const onCloseHero = vi.fn();
        const { container } = render(
            h(EngineContext.Provider, { value: engine },
                h(DeckDndProvider, null,
                    h(BottomHeroDock, { selectedHeroId: 'h1', onCloseHero })))
        );

        act(() => startRealDrag(container));
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);

        act(() => fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' }));

        // The drag cancelled (dnd-kit's own handler, which fires after ours).
        expect(document.body.classList.contains('gi-dnd-active')).toBe(false);
        // But the sheet did NOT also close.
        expect(onCloseHero).not.toHaveBeenCalled();
    });

    it('closes the sheet on Escape when no drag is live (control)', () => {
        const onCloseHero = vi.fn();
        render(
            h(EngineContext.Provider, { value: engine },
                h(DeckDndProvider, null,
                    h(BottomHeroDock, { selectedHeroId: 'h1', onCloseHero })))
        );

        act(() => fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' }));
        expect(onCloseHero).toHaveBeenCalledTimes(1);
    });
});

describe('Escape mid-drag does not also end disallow mode (CR3-409)', () => {
    it('leaves disallow mode on while a drag is live, then a second Escape ends it', () => {
        const { container } = render(
            h(EngineContext.Provider, { value: engine },
                h(DeckDndProvider, null,
                    h(BottomHeroDock, { selectedHeroId: null }),
                    h(DisallowModeToggle)))
        );

        act(() => toggleDisallowMode());
        expect(container.querySelector('[data-disallow-toggle="on"]')).not.toBeNull();

        act(() => startRealDrag(container));
        expect(document.body.classList.contains('gi-dnd-active')).toBe(true);

        act(() => fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' }));

        expect(document.body.classList.contains('gi-dnd-active')).toBe(false);
        // Disallow mode is still on: the drag's Escape did not also turn it off.
        expect(container.querySelector('[data-disallow-toggle="on"]')).not.toBeNull();

        // A second Escape, with no drag live, does end it.
        act(() => fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' }));
        expect(container.querySelector('[data-disallow-toggle="off"]')).not.toBeNull();
    });
});
