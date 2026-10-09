// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';

vi.mock('../systems/board/Flags.js', () => ({
    statusOf: () => ({ state: 'docked', instanceId: null, typeId: null, limping: false })
}));
// The real sheet is heavy; its equipment grid is what registers the drop targets.
vi.mock('../ui/components/drawer/HeroInspectionSheet.jsx', async () => {
    const { DockEquipmentGrid } = await import('../ui/components/dock/DockEquipmentGrid.jsx');
    return {
        HeroInspectionSheet: ({ heroId }) => React.createElement(DockEquipmentGrid, { heroId })
    };
});

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { EngineContext } from '../ui/context/EngineContext';
import { BankHeroPanel } from '../ui/components/dock/BankHeroPanel.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';

const h = React.createElement;
const engine = { GameState, EventBus, BoardPlacement: {}, EquipmentManager: {} };

const view = (selectedHeroId) =>
    h(EngineContext.Provider, { value: engine },
        h(DeckDndProvider, null, h(BankHeroPanel, { selectedHeroId, showTabs: false, menuRight: false })));

const slotDrops = (container) =>
    container.querySelectorAll('[data-dnd-droppable-id^="dock-slot-drop-"]');

beforeEach(() => {
    vi.useFakeTimers();
    GameState.initNew();
    GameState.state.heroes = [{
        id: 'h1', name: 'Aldric', spriteId: 'hero_recruit_0',
        hp: { current: 100, max: 100 }, status: 'idle', equipment: {}
    }];
    setLiveMatFit(1);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('closed hero sheet drop targets', () => {
    it('registers equipment-slot drop targets while open and none once closed', () => {
        const r = render(view(null));
        expect(slotDrops(r.container).length).toBe(0);

        r.rerender(view('h1'));
        expect(slotDrops(r.container).length).toBeGreaterThan(0);

        r.rerender(view(null));
        act(() => { vi.advanceTimersByTime(1000); });
        expect(slotDrops(r.container).length).toBe(0);
    });

    it('keeps the sheet through the close animation and across a quick reopen', () => {
        const r = render(view('h1'));
        r.rerender(view(null));
        act(() => { vi.advanceTimersByTime(100); });
        expect(slotDrops(r.container).length).toBeGreaterThan(0);

        r.rerender(view('h1'));
        act(() => { vi.advanceTimersByTime(1000); });
        expect(slotDrops(r.container).length).toBeGreaterThan(0);
    });
});
