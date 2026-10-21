// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { DockEquipmentGrid } from '../ui/components/dock/DockEquipmentGrid.jsx';
import { SLOT_ORDER } from '../config/registries/equipmentConstants.js';

const h = React.createElement;
const FLASH_MS = 800;

beforeEach(() => {
    vi.useFakeTimers();
    GameState.initNew();
    GameState.state.heroes = [{
        id: 'h1', name: 'Aldric', spriteId: 'hn_recruit_por',
        hp: { current: 100, max: 100 }, status: 'idle', equipment: {}
    }];
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

/**
 * The equip flash ends on an 800 ms timer. EventBus ignores whatever a handler returns, so
 * a cleanup returned from the handler never ran: the grid has to clear the timer itself.
 */
describe('the equip flash timer', () => {
    it('is cleared when the grid unmounts', () => {
        const setSpy = vi.spyOn(globalThis, 'setTimeout');
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        const r = render(h(DeckDndProvider, null, h(DockEquipmentGrid, { heroId: 'h1' })));

        act(() => {
            EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { action: 'equip', heroId: 'h1', slot: SLOT_ORDER[0] });
        });
        const flash = setSpy.mock.calls.findIndex(([, ms]) => ms === FLASH_MS);
        expect(flash).toBeGreaterThanOrEqual(0);
        const timer = setSpy.mock.results[flash].value;

        r.unmount();
        expect(clearSpy.mock.calls.some(([id]) => id === timer)).toBe(true);
    });
});
