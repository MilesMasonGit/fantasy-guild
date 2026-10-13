// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as Cartography from '../systems/atlas/Cartography.js';
import { TEXT } from '../systems/atlas/regionNames.js';
import { SCREEN_TEXT } from '../ui/components/atlas/atlasScreenText.js';
import { CartographyTable } from '../ui/components/atlas/CartographyTable.jsx';
import { AtlasScreen, ATLAS_TAB } from '../ui/components/atlas/AtlasScreen.jsx';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import './fixtures/testTokens.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ Map upcycling: N of one map trade for 1 of the map its `upcycle` names, instantly, from the
 * Cartography table. It takes exactly N and gives exactly 1, one step per click, and touches
 * nothing else in the Bank.
 */

const OAK = 'fixture_producer';
const LESSER = 'map_test_up_lesser';
const GREATER = 'map_test_up_greater';
const GRAND = 'map_test_up_grand';
const PLAIN = 'map_test_up_plain';
const TO_WOOD = 'map_test_up_to_wood';
const base = (extra = {}) => ({ biome: 'forest', points: 16, nodes: [{ typeId: OAK, weight: 1 }], camps: [], treasures: [], ...extra });
registerItems({
    [LESSER]: { id: LESSER, name: 'Lesser Map', type: 'map', stackable: true, cartography: base({ upcycle: { itemId: GREATER, ratio: 5 } }) },
    [GREATER]: { id: GREATER, name: 'Greater Map', type: 'map', stackable: true, cartography: base({ upcycle: { itemId: GRAND, ratio: 3 } }) },
    [GRAND]: { id: GRAND, name: 'Grand Map', type: 'map', stackable: true, cartography: base() },
    [PLAIN]: { id: PLAIN, name: 'Plain Map', type: 'map', stackable: true, cartography: base() },
    [TO_WOOD]: { id: TO_WOOD, name: 'Odd Map', type: 'map', stackable: true, cartography: base({ upcycle: { itemId: 'item_oak_wood', ratio: 2 } }) }
});

const bank = (id) => InventoryManager.getItemCount(id);
const bankSnapshot = () => Object.fromEntries(Object.entries(InventoryManager.getAllItems()).map(([id, e]) => [id, e.quantity]));
const q = (container, sel) => container.querySelector(sel);

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    Cartography.clearStock();
});

afterEach(() => {
    cleanup();
    GameLoop.stop();
    Cartography.clearStock();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the trade', () => {
    it('takes exactly N of the map and gives exactly 1 of the map it names', () => {
        InventoryManager.addItem(LESSER, 12);
        const result = Atlas.upcycle(LESSER);
        expect(result.success).toBe(true);
        expect(result).toMatchObject({ taken: { itemId: LESSER, count: 5 }, given: { itemId: GREATER, count: 1 } });
        expect([bank(LESSER), bank(GREATER)]).toEqual([7, 1]);
    });

    it('trades the last N away, freeing their place in the Bank', () => {
        InventoryManager.addItem(LESSER, 5);
        expect(Atlas.upcycle(LESSER).success).toBe(true);
        expect(bank(LESSER)).toBe(0);
        expect(InventoryManager.getAllItems()[LESSER]).toBeUndefined();
        expect(bank(GREATER)).toBe(1);
    });

    it('is one step a click: it never chains on into the next map', () => {
        InventoryManager.addItem(LESSER, 15);
        InventoryManager.addItem(GREATER, 2);
        expect(Atlas.upcycle(LESSER).success).toBe(true);
        expect([bank(LESSER), bank(GREATER), bank(GRAND)]).toEqual([10, 3, 0]);
    });

    it('refuses short of N and takes nothing', () => {
        InventoryManager.addItem(LESSER, 4);
        const before = bankSnapshot();
        const result = Atlas.upcycle(LESSER);
        expect(result.success).toBe(false);
        expect(result.reason).toBe(TEXT.refuseUpcycleShort(5, 4));
        expect(bankSnapshot()).toEqual(before);
    });

    it('refuses a map with no upcycle, a map that trades into something that is not a map, and any other item', () => {
        InventoryManager.addItem(PLAIN, 50);
        InventoryManager.addItem(TO_WOOD, 50);
        InventoryManager.addItem('item_oak_wood', 50);
        const before = bankSnapshot();
        for (const id of [PLAIN, TO_WOOD, 'item_oak_wood', 'no_such_item']) {
            const result = Atlas.upcycle(id);
            expect(result.success).toBe(false);
            expect(result.reason).toBe(TEXT.REFUSE_NO_UPCYCLE);
        }
        expect(bankSnapshot()).toEqual(before);
    });

    it('leaves the rest of the Bank untouched', () => {
        InventoryManager.addItem('item_oak_wood', 40);
        InventoryManager.addItem(PLAIN, 3);
        InventoryManager.addItem(GREATER, 1);
        InventoryManager.addItem(LESSER, 6);
        const before = bankSnapshot();
        expect(Atlas.upcycle(LESSER).success).toBe(true);
        expect(bankSnapshot()).toEqual({ ...before, [LESSER]: 1, [GREATER]: 2 });
    });

    it('refuses when the Bank has no place for the new map, and takes nothing', () => {
        InventoryManager.addItem(LESSER, 7);
        GameState.inventory.maxSlots = Object.keys(InventoryManager.getAllItems()).length;
        const before = bankSnapshot();
        const result = Atlas.upcycle(LESSER);
        expect(result.success).toBe(false);
        expect(result.reason).toBe(TEXT.refuseUpcycleNoRoom('Greater Map'));
        expect(bankSnapshot()).toEqual(before);
        // Trading the last of them frees their place, so that trade goes through.
        InventoryManager.removeItem(LESSER, 2);
        expect(Atlas.upcycle(LESSER).success).toBe(true);
        expect([bank(LESSER), bank(GREATER)]).toEqual([0, 1]);
    });

    it('announces the Bank change the screen redraws on', () => {
        InventoryManager.addItem(LESSER, 5);
        const heard = [];
        const unsub = EventBus.subscribe(ENGINE_EVENTS.INVENTORY_UPDATED, (e) => heard.push(e?.itemId));
        Atlas.upcycle(LESSER);
        unsub();
        expect(heard).toEqual(expect.arrayContaining([LESSER, GREATER]));
    });

    it('offers what the table shows: the ratio, the target and why not', () => {
        expect(Atlas.upcycleOffer(PLAIN)).toBeNull();
        expect(Atlas.upcycleOffer(TO_WOOD)).toBeNull();
        InventoryManager.addItem(LESSER, 2);
        expect(Atlas.upcycleOffer(LESSER)).toEqual({
            from: LESSER, to: GREATER, toName: 'Greater Map', ratio: 5, held: 2, reason: TEXT.refuseUpcycleShort(5, 2)
        });
        InventoryManager.addItem(LESSER, 3);
        expect(Atlas.upcycleOffer(LESSER).reason).toBeNull();
    });
});

describe('the table\'s trade control', () => {
    it('shows the ratio and the target\'s name on a map that trades up, and on no other row', () => {
        InventoryManager.addItem(LESSER, 7);
        InventoryManager.addItem(PLAIN, 1);
        const { container } = render(React.createElement(CartographyTable, { version: 0 }));
        const trade = q(container, `[data-map-upcycle="${LESSER}"]`);
        expect(trade).toBeTruthy();
        expect(trade.textContent).toBe(SCREEN_TEXT.upcycle(5, 'Greater Map'));
        expect(trade.textContent).toBe('Trade 5 for 1 Greater Map');
        expect(trade.disabled).toBe(false);
        expect(q(container, `[data-map-upcycle="${PLAIN}"]`)).toBeNull();
    });

    it('is disabled when short, with the reason on hover', () => {
        InventoryManager.addItem(LESSER, 3);
        const { container } = render(React.createElement(CartographyTable, { version: 0 }));
        const trade = q(container, `[data-map-upcycle="${LESSER}"]`);
        expect(trade.disabled).toBe(true);
        expect(trade.getAttribute('title')).toBe(TEXT.refuseUpcycleShort(5, 3));
    });

    it('trades on a click and the open screen redraws the counts', () => {
        InventoryManager.addItem(LESSER, 6);
        const { container } = render(React.createElement(
            DeckDndContext.Provider, { value: { activePayload: null, isDragging: false } },
            React.createElement(AtlasScreen, { onClose: vi.fn(), initialTab: ATLAS_TAB.CARTOGRAPHY })
        ));
        act(() => { fireEvent.click(q(container, `[data-map-upcycle="${LESSER}"]`)); });
        expect([bank(LESSER), bank(GREATER)]).toEqual([1, 1]);
        expect(q(container, `[data-map-item="${LESSER}"]`).textContent).toContain('×1');
        expect(q(container, `[data-map-item="${GREATER}"]`).textContent).toContain('×1');
        expect(q(container, `[data-map-upcycle="${LESSER}"]`).disabled).toBe(true);
        // The Greater Map trades on into the Grand Map, at its own ratio.
        expect(q(container, `[data-map-upcycle="${GREATER}"]`).textContent).toBe('Trade 3 for 1 Grand Map');
    });
});
