// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, cleanup, act } from '@testing-library/react';

import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { DockEquipmentGrid, EQUIP_SHINE_MS } from '../ui/components/dock/DockEquipmentGrid.jsx';
import { SLOT_ORDER } from '../config/registries/equipmentConstants.js';

const h = React.createElement;
const CSS = readFileSync(path.resolve(__dirname, '..', 'tailwind.css'), 'utf8');

beforeEach(() => {
    vi.useFakeTimers();
    GameState.initNew();
    GameState.state.heroes = [{
        id: 'h1', name: 'Aldric', spriteId: 'hn_recruit_por',
        hp: { current: 100, max: 100 }, status: 'idle', equipment: {}
    }];
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

const equip = (slot = SLOT_ORDER[0]) => act(() => {
    EventBus.publish(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, { action: 'equip', heroId: 'h1', slot });
});
const mount = () => render(h(DeckDndProvider, null, h(DockEquipmentGrid, { heroId: 'h1' })));

/**
 * An item landing in a loadout slot plays the button shine over that slot once: no bounce, no
 * scaling, no glow. The shine layer ends on a timer, which the grid clears itself (EventBus
 * ignores whatever a handler returns).
 */
describe('the equip shine', () => {
    it('plays the pixel shine on the slot an item lands in, and nothing else', () => {
        const r = mount();
        expect(r.container.querySelector('[data-equip-shine]')).toBeNull();
        equip(SLOT_ORDER[1]);
        const shines = r.container.querySelectorAll('[data-equip-shine]');
        expect(shines).toHaveLength(1);
        expect(shines[0].className).toContain('ui-shine');
        expect(shines[0].className).toContain('ui-shine-once');
        expect(r.container.innerHTML).not.toMatch(/equipped-bob|ring-gi-gold|shadow-\[0_0_16px/);
        act(() => { vi.advanceTimersByTime(EQUIP_SHINE_MS); });
        expect(r.container.querySelector('[data-equip-shine]')).toBeNull();
    });

    it('plays again for a second item in the same slot', () => {
        const r = mount();
        equip();
        const first = r.container.querySelector('[data-equip-shine]');
        equip();
        const second = r.container.querySelector('[data-equip-shine]');
        expect(second).not.toBeNull();
        expect(second).not.toBe(first);
    });

    it('is the button shine, stepped, and still under reduced motion', () => {
        expect(CSS).toMatch(/\.ui-shine-once::before\s*\{\s*animation: ui-shine-sweep 280ms steps\(7, end\) 1 both;/);
        expect(CSS).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.ui-shine-once::before \{ animation: none; \}/);
        expect(CSS).not.toMatch(/gi-item-equipped-bob/);
    });

    it('clears its timer when the grid unmounts', () => {
        const setSpy = vi.spyOn(globalThis, 'setTimeout');
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        const r = mount();
        equip();
        const call = setSpy.mock.calls.findIndex(([, ms]) => ms === EQUIP_SHINE_MS);
        expect(call).toBeGreaterThanOrEqual(0);
        const timer = setSpy.mock.results[call].value;

        r.unmount();
        expect(clearSpy.mock.calls.some(([id]) => id === timer)).toBe(true);
    });
});
