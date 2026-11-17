// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { holdsCopy, markHeld } from '../systems/equipment/heldCopies.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as Banners from '../systems/notifications/banners.js';
import { wireNotifications, unwireNotifications } from '../systems/notifications/routing.js';
import { registerItems, getItem } from '../config/registries/itemRegistry.js';
import { unequipOrAnnounce } from '../ui/components/dock/dockEquip.js';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { DockEquipmentGrid } from '../ui/components/dock/DockEquipmentGrid.jsx';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ A gear slot holding an item deleted in the CMS. The load keeps it (a half-finished rename must
 * stay recoverable), the slot shows the missing id instead of looking empty, and the player can
 * clear it: unequip, or an equip that displaces it, throws the copy away rather than refusing with
 * "Bank full". A held copy of an item that still exists but is no longer gear goes back to the Bank.
 */

const GONE = 'mg_deleted_shield';
const ITEMS = {
    mg_cap: { id: 'mg_cap', name: 'Test Cap', type: 'armor', equipSlot: 'hat', stackable: true },
    mg_bread: { id: 'mg_bread', name: 'Test Bread', type: 'food', equipSlot: 'food', stackable: true }
};
const FILLERS = Array.from({ length: 10 }, (_, i) => `mg_fill_${i}`);
for (const id of FILLERS) ITEMS[id] = { id, name: `Filler ${id}`, type: 'material', stackable: true };
const MAX_SLOTS = 6;

const bank = (id) => InventoryManager.getItemCount(id);
const bankKinds = () => Object.keys(GameState.state.inventory.items).sort();

function addHero(name) {
    const hero = generateHero({ name });
    GameState.state.heroes.push(hero);
    return hero;
}

/** A hero holding their own copy of an item the CMS has since deleted, as a load leaves it. */
function holdGone(hero, slot = 0) {
    hero.equipment[slot] = GONE;
    markHeld(hero, slot, true);
}

function fillBank() {
    for (const id of FILLERS) {
        if (InventoryManager.lacksSlotFor(id)) break;
        if (bank(id) === 0) InventoryManager.addItem(id, 1);
    }
    expect(bankKinds()).toHaveLength(MAX_SLOTS);
}

let overflows;
let offs = [];

beforeAll(() => {
    registerItems(ITEMS);
    expect(getItem(GONE)).toBeFalsy();
});

beforeEach(() => {
    localStorage.clear();
    Banners.reset();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.inventory.maxSlots = MAX_SLOTS;
    GameState.state.heroes = [];
    overflows = [];
    offs = [EventBus.subscribe(ENGINE_EVENTS.INVENTORY_OVERFLOW, (p) => overflows.push(p))];
});

afterEach(() => {
    offs.forEach(off => off());
    cleanup();
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    localStorage.clear();
});

describe('unequip clears a slot whose item is gone, and the copy goes nowhere', () => {
    it('with room in the Bank: the slot empties, the Bank gains nothing', () => {
        const aela = addHero('Aela');
        holdGone(aela);
        const before = bankKinds();

        const res = EquipmentManager.unequipItem(aela.id, 0);
        expect(res.success, res.error).toBe(true);
        expect(aela.equipment[0]).toBeNull();
        expect(holdsCopy(aela, 0)).toBe(false);
        expect(bankKinds()).toEqual(before);
        expect(overflows).toEqual([]);
        expect(SpriteLayer.countOnBoard(GONE)).toBe(0);
    });

    it('with a full Bank too: no "Bank full" refusal', () => {
        const aela = addHero('Aela');
        holdGone(aela);
        fillBank();
        const said = [];
        offs.push(EventBus.subscribe(UI_EVENTS.UI_SCREEN_CALLOUT, (p) => said.push(p.text)));

        expect(unequipOrAnnounce(EquipmentManager, aela.id, 0)).toBe(true);
        expect(said).toEqual([]);
        expect(aela.equipment[0]).toBeNull();
        expect(bankKinds()).toHaveLength(MAX_SLOTS);
    });

    it('a slot that never held a copy of its own empties the same way', () => {
        const aela = addHero('Aela');
        aela.equipment[3] = GONE;
        expect(EquipmentManager.unequipItem(aela.id, 3).success).toBe(true);
        expect(aela.equipment[3]).toBeNull();
    });
});

describe('an equip dropped on the slot displaces the missing item without asking the Bank', () => {
    it('the new copy lands, the missing one is thrown away', () => {
        const aela = addHero('Aela');
        holdGone(aela, 2);
        InventoryManager.addItem('mg_cap', 1);

        const res = EquipmentManager.equipItem(aela.id, 'mg_cap', 2);
        expect(res.success, res.error).toBe(true);
        expect(aela.equipment[2]).toBe('mg_cap');
        expect(holdsCopy(aela, 2)).toBe(true);
        expect(aela.equipment).not.toContain(GONE);
        expect(bank('mg_cap')).toBe(0);
        expect(bankKinds()).not.toContain(GONE);
    });

    it('with a full Bank the swap still goes through', () => {
        const aela = addHero('Aela');
        holdGone(aela, 2);
        InventoryManager.addItem('mg_cap', 2);
        fillBank();

        const res = EquipmentManager.equipItem(aela.id, 'mg_cap', 2);
        expect(res.success, res.error).toBe(true);
        expect(aela.equipment[2]).toBe('mg_cap');
        expect(bank('mg_cap')).toBe(1);
        expect(overflows).toEqual([]);
    });
});

describe('the load removes nothing; an item still in the game but no longer gear goes back', () => {
    async function saveAndLoad() {
        SaveManager.currentSlot = 0;
        expect(SaveManager.save(false)).toBe(true);
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        return GameState.state;
    }

    beforeEach(() => wireNotifications());
    afterEach(() => unwireNotifications());

    it('a missing id survives a save and load with its mark, and no "gear lost" notice', async () => {
        const aela = addHero('Aela');
        holdGone(aela, 4);

        const loaded = await saveAndLoad();
        const la = loaded.heroes[0];
        expect(la.equipment[4]).toBe(GONE);
        expect(holdsCopy(la, 4)).toBe(true);
        expect(Banners.getAll()).toEqual([]);
    });

    it('a held copy of an item that is no longer gear goes back to the Bank', () => {
        const aela = addHero('Aela');
        aela.equipment[1] = 'mg_bread';
        markHeld(aela, 1, true);

        EquipmentManager.reconcileHeldCopies([aela]);
        expect(aela.equipment[1]).toBe('mg_bread');
        expect(holdsCopy(aela, 1)).toBe(false);
        expect(bank('mg_bread')).toBe(1);
    });
});

describe('the slot shows the missing item by its id, not "+"', () => {
    it('names the id, says it is gone, and right-click clears it', async () => {
        const aela = addHero('Aela');
        holdGone(aela, 0);
        const view = render(React.createElement(DeckDndProvider, null, React.createElement(DockEquipmentGrid, { heroId: aela.id })));

        const cell = view.container.querySelector('[data-equip-slot="0"]');
        const mark = cell.querySelector('[data-equip-missing]');
        expect(mark).not.toBeNull();
        expect(mark.textContent).toContain(GONE);
        expect(cell.getAttribute('title')).toMatch(/gone from the game/i);
        expect(cell.textContent).not.toContain('+');

        act(() => { fireEvent.contextMenu(cell); });
        expect(aela.equipment[0]).toBeNull();
        await waitFor(() => expect(view.container.querySelector('[data-equip-missing]')).toBeNull());
    });
});
