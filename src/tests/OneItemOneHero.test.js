// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS, UI_EVENTS } from '../systems/core/engineEvents.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as HeroTools from '../systems/equipment/HeroTools.js';
import { holdsCopy, markHeld, heldCount } from '../systems/equipment/heldCopies.js';
import * as HeroEffects from '../systems/hero/HeroEffects.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { applyDefeatPenalties } from '../systems/combat/DefeatPenalties.js';
import { grantStarterTools } from '../systems/equipment/StarterTools.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as Banners from '../systems/notifications/banners.js';
import { wireNotifications, unwireNotifications } from '../systems/notifications/routing.js';
import { registerItems, getAllItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { starterToolIds } from '../config/registries/toolKinds.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { equipOrAnnounce, unequipOrAnnounce } from '../ui/components/dock/dockEquip.js';
import { devFillBank } from '../ui/dev/qaTools.js';
import { getGrid } from '../config/registries/equipmentConstants.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ One item, one hero: equipping gear, a weapon or a tool moves that copy out of the Bank into the
 * hero's hands, and taking it off puts it back. Food, drink and potions stay shared from the Bank.
 * A copy that would go back to a full Bank stays with the hero. An old save where heroes share one
 * copy hands the Bank's copies out in roster order, empties the rest, and says so once.
 */

const hand = (id, name, extra = {}) => ({ id, name, type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', ...extra });
const ITEMS = {
    oo_pick: hand('oo_pick', 'Test Pickaxe', { tool: { kind: 'pickaxe', tier: 1 } }),
    oo_axe: hand('oo_axe', 'Test Woodaxe', { tool: { kind: 'woodaxe', tier: 1 } }),
    oo_great: hand('oo_great', 'Test Greatsword', { type: 'weapon', hands: 2 }),
    oo_hat_a: { id: 'oo_hat_a', name: 'Test Cap', type: 'armor', equipSlot: 'hat', stackable: true },
    oo_hat_b: { id: 'oo_hat_b', name: 'Test Helm', type: 'armor', equipSlot: 'hat', stackable: true },
    oo_plate: { id: 'oo_plate', name: 'Test Plate', type: 'armor', equipSlot: 'chest', stackable: true, effects: [{ effectId: 'oo_effect_plating', scale: 1 }] },
    oo_bread: { id: 'oo_bread', name: 'Test Bread', type: 'food', equipSlot: 'food', stackable: true },
    oo_ale: { id: 'oo_ale', name: 'Test Ale', type: 'drink', equipSlot: 'drink', stackable: true },
    oo_starter_pick: hand('oo_starter_pick', 'Test Starter Pickaxe', { tool: { kind: 'pickaxe', tier: 1, starter: true } })
};
ITEMS.oo_hat_req = { id: 'oo_hat_req', name: 'Test Crown', type: 'armor', equipSlot: 'trinket', stackable: true, requirements: [{ skill: 'melee', level: 99 }] };
for (let i = 0; i < 9; i++) ITEMS[`oo_scroll_${i}`] = { id: `oo_scroll_${i}`, name: `Test Scroll ${i}`, type: 'consumable', equipSlot: 'consumable', stackable: true };
const FILLERS = Array.from({ length: 12 }, (_, i) => `oo_fill_${i}`);
for (const id of FILLERS) ITEMS[id] = { id, name: `Filler ${id}`, type: 'material', stackable: true };

const NOW = 1_800_000_000_000;
const MAX_SLOTS = 8;

const bank = (id) => InventoryManager.getItemCount(id);
const give = (id, n = 1) => expect(InventoryManager.addItem(id, n)).toBe(n);
const grid = (hero) => [...hero.equipment];
const slotOf = (hero, id) => hero.equipment.indexOf(id);

function addHero(name, id = null) {
    const hero = generateHero({ name });
    if (id) hero.id = id;
    GameState.state.heroes.push(hero);
    return hero;
}

/** A hero with Melee written on their sheet, for the tests about weapons in the hands. */
function addFighter(name) {
    const hero = addHero(name);
    hero.skills.melee = { level: 1, xp: 0 };
    return hero;
}

function equipOk(heroId, itemId, slot = null, from = null) {
    const res = EquipmentManager.equipItem(heroId, itemId, slot, from);
    expect(res.success, res.error).toBe(true);
}

/** Fill every free Bank slot with one filler each. */
function fillBank() {
    for (const id of FILLERS) {
        if (InventoryManager.lacksSlotFor(id)) break;
        if (bank(id) === 0) give(id);
    }
    expect(Object.keys(GameState.state.inventory.items)).toHaveLength(MAX_SLOTS);
}

let overflows;
let offs = [];

beforeAll(() => {
    registerEffects({
        oo_effect_plating: {
            id: 'oo_effect_plating', name: 'Test Plating',
            statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.ARMOR, bucket: 'flat', value: 3 } }]
        }
    });
    registerItems(ITEMS);
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
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    localStorage.clear();
});

describe('equipping gear moves the copy out of the Bank; taking it off puts it back', () => {
    it('equip takes one copy out of the Bank and the hero holds it', () => {
        const aela = addHero('Aela');
        give('oo_pick', 2);
        equipOk(aela.id, 'oo_pick');
        expect(bank('oo_pick')).toBe(1);
        expect(grid(aela)).toContain('oo_pick');
    });

    it('unequip puts the copy back', () => {
        const aela = addHero('Aela');
        give('oo_pick', 2);
        equipOk(aela.id, 'oo_pick');
        expect(bank('oo_pick')).toBe(1);
        expect(EquipmentManager.unequipItem(aela.id, slotOf(aela, 'oo_pick')).success).toBe(true);
        expect(bank('oo_pick')).toBe(2);
        expect(grid(aela)).not.toContain('oo_pick');
    });

    it('the last copy leaves the Bank, and comes back when it is taken off', () => {
        const aela = addHero('Aela');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick');
        expect(bank('oo_pick')).toBe(0);
        expect(GameState.state.inventory.items.oo_pick).toBeUndefined();
        expect(EquipmentManager.unequipItem(aela.id, slotOf(aela, 'oo_pick')).success).toBe(true);
        expect(bank('oo_pick')).toBe(1);
    });

    it('moving a copy is neither a gain nor a spend: no item flow is announced', () => {
        const aela = addHero('Aela');
        give('oo_pick', 2);
        const flows = [];
        offs.push(EventBus.subscribe(ENGINE_EVENTS.INVENTORY_UPDATED, (p) => {
            if ((p?.added || 0) > 0 || (p?.removed || 0) > 0) flows.push(p);
        }));
        equipOk(aela.id, 'oo_pick');
        EquipmentManager.unequipItem(aela.id, slotOf(aela, 'oo_pick'));
        expect(flows).toEqual([]);
    });

    it('a swap puts the displaced copy back and takes the new one out', () => {
        const aela = addHero('Aela');
        give('oo_hat_a', 1);
        give('oo_hat_b', 1);
        equipOk(aela.id, 'oo_hat_a');
        equipOk(aela.id, 'oo_hat_b');
        expect(grid(aela)).toContain('oo_hat_b');
        expect(grid(aela)).not.toContain('oo_hat_a');
        expect(bank('oo_hat_a')).toBe(1);
        expect(bank('oo_hat_b')).toBe(0);
    });

    it('a two-handed weapon taken up puts both tools back in the Bank', () => {
        const aela = addFighter('Aela');
        give('oo_pick'); give('oo_axe'); give('oo_great');
        equipOk(aela.id, 'oo_pick');
        equipOk(aela.id, 'oo_axe');
        equipOk(aela.id, 'oo_great');
        expect(aela.equipment.filter(Boolean)).toEqual(['oo_great']);
        expect([bank('oo_pick'), bank('oo_axe'), bank('oo_great')]).toEqual([1, 1, 0]);
    });
});

describe('a hero cannot equip what the Bank no longer holds', () => {
    it('with every copy in use, the next hero is refused and nothing changes', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick');

        const res = EquipmentManager.equipItem(bram.id, 'oo_pick');
        expect(res.success).toBe(false);
        expect(res.error).toBe('Every Test Pickaxe you own is already in use');
        expect(grid(bram).filter(Boolean)).toEqual([]);
        expect(grid(aela)).toContain('oo_pick');
        expect(bank('oo_pick')).toBe(0);
    });

    it('two copies equip two heroes, and a third is refused', () => {
        const [a, b, c] = ['Aela', 'Bram', 'Cara'].map(n => addHero(n));
        give('oo_pick', 2);
        equipOk(a.id, 'oo_pick');
        equipOk(b.id, 'oo_pick');
        expect(EquipmentManager.equipItem(c.id, 'oo_pick').success).toBe(false);
    });

    it('an item nobody owns at all is out of stock', () => {
        const aela = addHero('Aela');
        expect(EquipmentManager.equipItem(aela.id, 'oo_pick')).toEqual({ success: false, error: 'Out of stock' });
    });

    it('a held copy cannot be spent: crafting and the Shop see only the Bank', () => {
        const aela = addHero('Aela');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick');
        expect(InputAllocator.availableOf('oo_pick')).toBe(0);
        expect(InputAllocator.consumeInputs([{ itemId: 'oo_pick', quantity: 1 }])).toBe(false);
        expect(grid(aela)).toContain('oo_pick');
    });
});

describe('handing a copy from one hero to another', () => {
    it('a copy dragged from one hero onto another moves, and the Bank is untouched', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick');
        const from = { heroId: aela.id, slot: slotOf(aela, 'oo_pick') };

        equipOk(bram.id, 'oo_pick', null, from);
        expect(grid(aela)).not.toContain('oo_pick');
        expect(grid(bram)).toContain('oo_pick');
        expect(bank('oo_pick')).toBe(0);
        // Bram's copy is his: taking it off puts it back.
        expect(EquipmentManager.unequipItem(bram.id, slotOf(bram, 'oo_pick')).success).toBe(true);
        expect(bank('oo_pick')).toBe(1);
    });

    it('the drop helper passes where the copy came from', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick');
        const payload = { kind: 'item', itemId: 'oo_pick', fromHeroId: aela.id, fromSlot: slotOf(aela, 'oo_pick') };
        expect(equipOrAnnounce(EquipmentManager, bram.id, 'oo_pick', null, payload)).toBe(true);
        expect(grid(bram)).toContain('oo_pick');
        expect(grid(aela)).not.toContain('oo_pick');
    });
});

const lift = (hero, id) => ({ kind: 'item', itemId: id, fromHeroId: hero.id, fromSlot: slotOf(hero, id) });

/** Every slot of a hero's loadout filled with something shared. */
function fillLoadout(hero, from = 0) {
    GameState.state.inventory.maxSlots = 30;
    for (let slot = from; slot < 9; slot++) {
        give(`oo_scroll_${slot}`);
        equipOk(hero.id, `oo_scroll_${slot}`, slot);
    }
}

describe('moving an item between a hero\'s own slots', () => {
    it('dragged to an empty slot it moves there, still theirs, and the Bank is untouched', () => {
        const aela = addHero('Aela');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick', 0);

        expect(equipOrAnnounce(EquipmentManager, aela.id, 'oo_pick', 4, lift(aela, 'oo_pick'))).toBe(true);
        expect(slotOf(aela, 'oo_pick')).toBe(4);
        expect(aela.equipment[0]).toBeNull();
        expect(bank('oo_pick')).toBe(0);
        // Still the hero's own copy: taking it off puts it back.
        expect(EquipmentManager.unequipItem(aela.id, 4).success).toBe(true);
        expect(bank('oo_pick')).toBe(1);
    });

    it('dragged onto a filled slot the two swap, each keeping what it is', () => {
        const aela = addHero('Aela');
        give('oo_pick', 1);
        give('oo_bread', 3);
        equipOk(aela.id, 'oo_pick', 0);
        equipOk(aela.id, 'oo_bread', 5);

        expect(equipOrAnnounce(EquipmentManager, aela.id, 'oo_pick', 5, lift(aela, 'oo_pick'))).toBe(true);
        expect(aela.equipment[5]).toBe('oo_pick');
        expect(aela.equipment[0]).toBe('oo_bread');
        expect(holdsCopy(aela, 5)).toBe(true);
        expect(holdsCopy(aela, 0)).toBe(false);
        expect(bank('oo_pick')).toBe(0);
        expect(bank('oo_bread')).toBe(3);
    });

    it('a two-handed weapon swaps inside a full loadout: no rule depends on the slot', () => {
        const aela = addFighter('Aela');
        give('oo_great', 1);
        equipOk(aela.id, 'oo_great', 0);
        fillLoadout(aela, 1);
        const before = grid(aela);

        expect(EquipmentManager.moveItem(aela.id, 'oo_great', 0, 8).success).toBe(true);
        expect(aela.equipment[8]).toBe('oo_great');
        expect(aela.equipment[0]).toBe(before[8]);
        expect(grid(aela).sort()).toEqual(before.sort());
    });

    it('moves gear the hero is below the level for: it was in their hands already', () => {
        const aela = addHero('Aela');
        aela.equipment[0] = 'oo_hat_req';
        markHeld(aela, 0, true);
        expect(EquipmentManager.moveItem(aela.id, 'oo_hat_req', 0, 1).success).toBe(true);
        expect(aela.equipment[1]).toBe('oo_hat_req');
    });

    it('recounts what the loadout lends and says so once, as a move and not a new equip', () => {
        const aela = addHero('Aela');
        give('oo_plate', 1);
        equipOk(aela.id, 'oo_plate', 0);
        const seen = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.HERO_EQUIPMENT_CHANGED, (e) => seen.push(e));
        const recount = vi.spyOn(HeroEffects, 'loadoutDefenceContributions');
        expect(EquipmentManager.moveItem(aela.id, 'oo_plate', 0, 3).success).toBe(true);
        off();
        expect(seen).toEqual([expect.objectContaining({ heroId: aela.id, slot: 3, itemId: 'oo_plate', action: 'move' })]);
        expect(recount).toHaveBeenCalled();
        recount.mockRestore();
    });

    it('refuses an empty slot, a slot that no longer holds the item, its own slot and a slot off the grid', () => {
        const aela = addHero('Aela');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick', 0);
        const was = grid(aela);
        expect(EquipmentManager.moveItem(aela.id, 'oo_pick', 2, 3).success).toBe(false);
        expect(EquipmentManager.moveItem(aela.id, 'oo_axe', 0, 3).success).toBe(false);
        expect(EquipmentManager.moveItem(aela.id, 'oo_pick', 0, 0).success).toBe(false);
        expect(EquipmentManager.moveItem(aela.id, 'oo_pick', 0, 9).success).toBe(false);
        expect(grid(aela)).toEqual(was);
    });

    it('a tool moved in its hero\'s loadout still answers the job', () => {
        const aela = addHero('Aela');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick', 0);
        expect(EquipmentManager.moveItem(aela.id, 'oo_pick', 0, 7).success).toBe(true);
        expect(HeroTools.holdsToolFor(aela.id, { kinds: ['pickaxe'] })).toBe(true);
    });
});

describe('handing an item to another hero: what a drop on them does', () => {
    it('lands in their first empty slot', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_pick', 1);
        give('oo_hat_a', 1);
        equipOk(aela.id, 'oo_pick');
        equipOk(bram.id, 'oo_hat_a', 0);
        expect(equipOrAnnounce(EquipmentManager, bram.id, 'oo_pick', null, lift(aela, 'oo_pick'))).toBe(true);
        expect(slotOf(bram, 'oo_pick')).toBe(1);
    });

    it('food moves too: it leaves the giver, and the Bank\'s stack stays', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_bread', 3);
        equipOk(aela.id, 'oo_bread');
        expect(equipOrAnnounce(EquipmentManager, bram.id, 'oo_bread', null, lift(aela, 'oo_bread'))).toBe(true);
        expect(grid(aela)).not.toContain('oo_bread');
        expect(grid(bram)).toContain('oo_bread');
        expect(bank('oo_bread')).toBe(3);
        expect(holdsCopy(bram, slotOf(bram, 'oo_bread'))).toBe(false);
    });

    it('food the Bank has run out of can still be handed over', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_bread', 1);
        equipOk(aela.id, 'oo_bread');
        InventoryManager.removeItem('oo_bread', 1);
        expect(equipOrAnnounce(EquipmentManager, bram.id, 'oo_bread', null, lift(aela, 'oo_bread'))).toBe(true);
        expect(grid(aela)).not.toContain('oo_bread');
        expect(grid(bram)).toContain('oo_bread');
    });

    it('food dropped from the Bank still goes to two heroes at once', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_bread', 3);
        equipOk(aela.id, 'oo_bread');
        equipOk(bram.id, 'oo_bread');
        expect(grid(aela)).toContain('oo_bread');
        expect(grid(bram)).toContain('oo_bread');
    });

    it('a full loadout refuses with the reason, and the item stays with the giver', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick');
        fillLoadout(bram);
        const before = grid(bram);
        const res = EquipmentManager.equipItem(bram.id, 'oo_pick', null, { heroId: aela.id, slot: slotOf(aela, 'oo_pick') });
        expect(res).toEqual({ success: false, error: 'No free slot in the loadout' });
        expect(grid(aela)).toContain('oo_pick');
        expect(grid(bram)).toEqual(before);
        expect(heldCount('oo_pick')).toBe(1);
    });

    it('a full loadout refuses even when it holds one of the same kind to trade', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_hat_a', 1);
        give('oo_hat_b', 1);
        equipOk(aela.id, 'oo_hat_a');
        equipOk(bram.id, 'oo_hat_b', 0);
        fillLoadout(bram, 1);
        const res = EquipmentManager.equipItem(bram.id, 'oo_hat_a', null, { heroId: aela.id, slot: slotOf(aela, 'oo_hat_a') });
        expect(res.success).toBe(false);
        expect(grid(aela)).toContain('oo_hat_a');
        expect(bram.equipment[0]).toBe('oo_hat_b');
    });

    it('a drop from the Bank onto a full hero still trades one of a kind, as it always did', () => {
        const bram = addHero('Bram');
        give('oo_hat_a', 1);
        give('oo_hat_b', 1);
        equipOk(bram.id, 'oo_hat_a', 0);
        fillLoadout(bram, 1);
        equipOk(bram.id, 'oo_hat_b');
        expect(bram.equipment[0]).toBe('oo_hat_b');
        expect(bank('oo_hat_a')).toBe(1);
    });

    it('a level the receiver lacks refuses with the reason, and the item stays', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        aela.equipment[0] = 'oo_hat_req';
        markHeld(aela, 0, true);
        const res = EquipmentManager.equipItem(bram.id, 'oo_hat_req', null, { heroId: aela.id, slot: 0 });
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Needs/);
        expect(aela.equipment[0]).toBe('oo_hat_req');
        expect(grid(bram)).not.toContain('oo_hat_req');
    });

    it('a receiver already carrying it refuses, and neither copy moves', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_pick', 2);
        equipOk(aela.id, 'oo_pick');
        equipOk(bram.id, 'oo_pick');
        const res = EquipmentManager.equipItem(bram.id, 'oo_pick', null, { heroId: aela.id, slot: slotOf(aela, 'oo_pick') });
        expect(res.success).toBe(false);
        expect(heldCount('oo_pick')).toBe(2);
    });

    it('what the receiver puts down goes to the Bank, and with no room there nothing moves', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_hat_a', 1);
        give('oo_hat_b', 1);
        equipOk(aela.id, 'oo_hat_a');
        equipOk(bram.id, 'oo_hat_b');
        fillBank();
        const res = EquipmentManager.equipItem(bram.id, 'oo_hat_a', null, { heroId: aela.id, slot: slotOf(aela, 'oo_hat_a') });
        expect(res.success).toBe(false);
        expect(grid(aela)).toContain('oo_hat_a');
        expect(grid(bram)).toContain('oo_hat_b');
    });

    it('a tool handed over mid-job leaves the giver without it and the receiver with it', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick');
        expect(equipOrAnnounce(EquipmentManager, bram.id, 'oo_pick', null, lift(aela, 'oo_pick'))).toBe(true);
        expect(HeroTools.holdsToolFor(aela.id, { kinds: ['pickaxe'] })).toBe(false);
        expect(HeroTools.holdsToolFor(bram.id, { kinds: ['pickaxe'] })).toBe(true);
    });
});

describe('a full Bank: the copy stays with the hero, nothing is lost or over the limit', () => {
    it('unequip is refused with a short message, and the hero keeps it', () => {
        const aela = addHero('Aela');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick');
        fillBank();

        const res = EquipmentManager.unequipItem(aela.id, slotOf(aela, 'oo_pick'));
        expect(res.success).toBe(false);
        expect(res.error).toBe('The Bank is full: Aela keeps the Test Pickaxe');
        expect(grid(aela)).toContain('oo_pick');
        expect(Object.keys(GameState.state.inventory.items)).toHaveLength(MAX_SLOTS);
        expect(overflows).toEqual([]);
        expect(SpriteLayer.countOnBoard('oo_pick')).toBe(0);
    });

    it('a swap whose displaced copy has no room is refused, and nothing moves', () => {
        const aela = addHero('Aela');
        give('oo_hat_a', 1);
        equipOk(aela.id, 'oo_hat_a');
        give('oo_hat_b', 2);
        fillBank();

        const res = EquipmentManager.equipItem(aela.id, 'oo_hat_b');
        expect(res.success).toBe(false);
        expect(res.error).toBe('The Bank is full: Aela keeps the Test Cap');
        expect(grid(aela)).toContain('oo_hat_a');
        expect(grid(aela)).not.toContain('oo_hat_b');
        expect(bank('oo_hat_b')).toBe(2);
        expect(overflows).toEqual([]);
    });

    it('taking the last copy out frees its slot, so the displaced one fits', () => {
        const aela = addHero('Aela');
        give('oo_hat_a', 1);
        equipOk(aela.id, 'oo_hat_a');
        give('oo_hat_b', 1);
        fillBank();

        equipOk(aela.id, 'oo_hat_b');
        expect(bank('oo_hat_a')).toBe(1);
        expect(bank('oo_hat_b')).toBe(0);
        expect(Object.keys(GameState.state.inventory.items)).toHaveLength(MAX_SLOTS);
    });

    it('a two-hander that would send back two tools to one free slot is refused', () => {
        const aela = addFighter('Aela');
        give('oo_pick'); give('oo_axe');
        equipOk(aela.id, 'oo_pick');
        equipOk(aela.id, 'oo_axe');
        give('oo_great', 1);
        fillBank();

        const res = EquipmentManager.equipItem(aela.id, 'oo_great');
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/Bank is full/);
        expect(aela.equipment.filter(Boolean).sort()).toEqual(['oo_axe', 'oo_pick']);
        expect(bank('oo_great')).toBe(1);
    });

    it('the unequip helper says the refusal where it happened and reports a miss', () => {
        const aela = addHero('Aela');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick');
        fillBank();
        const said = [];
        offs.push(EventBus.subscribe(UI_EVENTS.UI_SCREEN_CALLOUT, (p) => said.push(p.text)));

        expect(unequipOrAnnounce(EquipmentManager, aela.id, slotOf(aela, 'oo_pick'))).toBe(false);
        expect(said).toEqual(['The Bank is full: Aela keeps the Test Pickaxe']);
    });
});

describe('food, drink and potions stay shared from the Bank', () => {
    it('two heroes carry one stack, and the Bank keeps every unit', () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        give('oo_bread', 5);
        equipOk(aela.id, 'oo_bread');
        equipOk(bram.id, 'oo_bread');
        expect(bank('oo_bread')).toBe(5);
        EquipmentManager.unequipItem(aela.id, slotOf(aela, 'oo_bread'));
        expect(bank('oo_bread')).toBe(5);
    });

    it('food comes off even when the Bank is full: nothing has to go back', () => {
        const aela = addHero('Aela');
        give('oo_bread', 1);
        equipOk(aela.id, 'oo_bread');
        fillBank();
        expect(EquipmentManager.unequipItem(aela.id, slotOf(aela, 'oo_bread')).success).toBe(true);
    });
});

describe('a held copy works with none in the Bank', () => {
    it('a held tool answers the Token\'s need though the Bank has none', () => {
        const aela = addHero('Aela');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick');
        expect(bank('oo_pick')).toBe(0);
        expect(HeroTools.holdsToolFor(aela.id, { kind: 'pickaxe', minTier: 1 })).toBe(true);
    });

    it('held gear\'s rules count though the Bank has none', () => {
        const aela = addHero('Aela');
        give('oo_plate', 1);
        equipOk(aela.id, 'oo_plate');
        expect(bank('oo_plate')).toBe(0);
        expect(HeroEffects.loadoutCombatContributions(aela)).toEqual([{ type: EFFECT_TYPES.ARMOR, value: 3 }]);
    });

    it('a defeat that breaks a held piece destroys the hero\'s copy, not the Bank\'s spare', () => {
        const aela = addHero('Aela');
        give('oo_pick', 2);
        equipOk(aela.id, 'oo_pick');
        const spares = bank('oo_pick');
        vi.spyOn(Math, 'random').mockReturnValue(0);
        try {
            expect(applyDefeatPenalties(aela.id)).toEqual(['Test Pickaxe']);
        } finally {
            Math.random.mockRestore();
        }
        expect(grid(aela)).not.toContain('oo_pick');
        expect(bank('oo_pick')).toBe(spares);
        expect(spares).toBe(1);
    });

    it('an older save\'s link that breaks costs the Bank one, as it always did', () => {
        const aela = addHero('Aela');
        give('oo_pick', 2);
        aela.equipment[0] = 'oo_pick';
        expect(EquipmentManager.destroyEquipped(aela.id, 0).success).toBe(true);
        expect(aela.equipment[0]).toBeNull();
        expect(bank('oo_pick')).toBe(1);
    });

    it('the starter tools are not given twice when a hero holds one', () => {
        const shipped = Object.fromEntries(starterToolIds(getAllItems()).filter(id => id !== 'oo_starter_pick').map(id => [id, getAllItems()[id]]));
        for (const id of Object.keys(shipped)) delete getAllItems()[id];
        try {
            const aela = addHero('Aela');
            give('oo_starter_pick', 1);
            equipOk(aela.id, 'oo_starter_pick');
            delete GameState.state.progress.starterTools;
            grantStarterTools();
            expect(bank('oo_starter_pick')).toBe(0);
        } finally {
            registerItems(shipped);
        }
    });
});

describe('saves', () => {
    /** Write the live game to slot 0 and load it back the way the slot screen does. */
    async function saveAndLoad() {
        SaveManager.currentSlot = 0;
        expect(SaveManager.save(false)).toBe(true);
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        return GameState.state;
    }

    /** An old save: heroes linked to Bank stock, no copy of their own (written straight into slots). */
    function shareOldStyle(hero, slot, itemId) {
        hero.equipment[slot] = itemId;
        delete hero.heldCopies;
    }

    beforeEach(() => {
        vi.spyOn(Date, 'now').mockReturnValue(NOW);
        wireNotifications();
    });
    afterEach(() => {
        unwireNotifications();
        vi.mocked(Date.now).mockRestore();
    });

    it('a save from after the change round-trips its held copies untouched, with no notice', async () => {
        const aela = addHero('Aela');
        give('oo_pick', 2);
        give('oo_bread', 4);
        equipOk(aela.id, 'oo_pick');
        equipOk(aela.id, 'oo_bread');
        const before = { equipment: grid(aela), bank: { ...GameState.state.inventory.items } };

        const loaded = await saveAndLoad();
        const la = loaded.heroes[0];
        expect(la.equipment).toEqual(before.equipment);
        expect(loaded.inventory.items).toEqual(before.bank);
        expect(Banners.getAll()).toEqual([]);

        // Still Aela's own copy after the load.
        expect(EquipmentManager.unequipItem(la.id, la.equipment.indexOf('oo_pick')).success).toBe(true);
        expect(bank('oo_pick')).toBe(2);
    });

    it('an old save gives the Bank\'s copies to heroes in roster order, empties the rest, and says so once', async () => {
        // Roster order is Cara, Aela, Bram, Dain: neither alphabetical nor by id.
        const cara = addHero('Cara', 'h_3');
        const aela = addHero('Aela', 'h_1');
        const bram = addHero('Bram', 'h_2');
        const dain = addHero('Dain', 'h_4');
        for (const h of [cara, aela, bram]) shareOldStyle(h, 0, 'oo_pick');
        shareOldStyle(dain, 1, 'oo_axe');
        shareOldStyle(dain, 2, 'oo_bread');
        give('oo_pick', 2);
        give('oo_bread', 3);

        const loaded = await saveAndLoad();
        const byName = Object.fromEntries(loaded.heroes.map(h => [h.name, h]));
        expect(byName.Cara.equipment[0]).toBe('oo_pick');
        expect(byName.Aela.equipment[0]).toBe('oo_pick');
        expect(byName.Bram.equipment[0]).toBeNull();
        expect(byName.Dain.equipment[1]).toBeNull();
        // Food stays shared: Dain keeps it, the Bank keeps every unit.
        expect(byName.Dain.equipment[2]).toBe('oo_bread');
        expect(bank('oo_bread')).toBe(3);
        expect(bank('oo_pick')).toBe(0);

        const banners = Banners.getAll();
        expect(banners).toHaveLength(1);
        expect(banners[0].line).toContain('Bram lost Test Pickaxe');
        expect(banners[0].line).toContain('Dain lost Test Woodaxe');
        expect(banners[0].line).not.toMatch(/Cara|Aela/);

        // Cara's and Aela's copies are their own now.
        expect(EquipmentManager.unequipItem(byName.Cara.id, 0).success).toBe(true);
        expect(bank('oo_pick')).toBe(1);
    });

    it('a migrated save loads the same way twice, and the second load says nothing', async () => {
        const aela = addHero('Aela');
        const bram = addHero('Bram');
        shareOldStyle(aela, 0, 'oo_pick');
        shareOldStyle(bram, 0, 'oo_pick');
        give('oo_pick', 1);

        await saveAndLoad();
        expect(Banners.getAll()).toHaveLength(1);
        const after = { heroes: GameState.state.heroes.map(h => [...h.equipment]), bank: { ...GameState.state.inventory.items } };

        Banners.reset();
        const again = await saveAndLoad();
        expect(again.heroes.map(h => [...h.equipment])).toEqual(after.heroes);
        expect(again.inventory.items).toEqual(after.bank);
        expect(Banners.getAll()).toEqual([]);
    });

    it('an old save whose Bank still writes a bare number per item settles the same way', async () => {
        const aela = addHero('Aela');
        shareOldStyle(aela, 0, 'oo_pick');
        SaveManager.currentSlot = 0;
        const data = JSON.parse(GameState.serializeJson());
        data.state.inventory.items = { oo_pick: 2 };
        localStorage.setItem(SaveManager.getSlotKey(0), JSON.stringify(data));

        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        expect(GameState.state.heroes[0].equipment[0]).toBe('oo_pick');
        expect(bank('oo_pick')).toBe(1);
    });

    it('an old save the Bank fully covers moves the copies and needs no notice', async () => {
        const aela = addHero('Aela');
        shareOldStyle(aela, 0, 'oo_pick');
        give('oo_pick', 3);

        const loaded = await saveAndLoad();
        expect(loaded.heroes[0].equipment[0]).toBe('oo_pick');
        expect(bank('oo_pick')).toBe(2);
        expect(Banners.getAll()).toEqual([]);
    });
});

/**
 * A save written as one from before one item, one hero: every hero (villagers aside) carries
 * `toolId` as a link to the Bank rather than a copy of their own, and the Bank holds one.
 * @returns {number} the heroes carrying the shared tool
 */
function shareOneToolOldStyle(data, toolId) {
    const heroes = (data?.state?.heroes || []).filter(h => h && !h.isVillager);
    let sharing = 0;
    for (const hero of heroes) {
        const grid = getGrid(hero);
        let slot = grid.indexOf(toolId);
        if (slot === -1) slot = grid.findIndex(id => !id);
        if (slot === -1) continue;
        hero.equipment[slot] = toolId;
        if (Array.isArray(hero.heldCopies)) hero.heldCopies[slot] = false;
        sharing++;
    }
    data.state.inventory.items[toolId] = { quantity: 1, dur: null };
    return sharing;
}

describe('the QA panel\'s Fill the Bank, and a save from before one item, one hero', () => {
    beforeEach(() => wireNotifications());
    afterEach(() => unwireNotifications());

    it('Fill the Bank takes every free slot, so a held copy meets a full Bank', () => {
        const aela = addHero('Aela');
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick');
        const { filled, free } = devFillBank();
        expect(filled).toBeGreaterThan(0);
        expect(free).toBe(0);
        expect(InventoryManager.lacksSlotFor('oo_pick')).toBe(true);
        expect(InventoryManager.getItemCount('oo_axe')).toBe(0);
        expect(EquipmentManager.unequipItem(aela.id, slotOf(aela, 'oo_pick')).success).toBe(false);
    });

    it('the shared-tool save loads as an older save: the first hero keeps it, the rest lose it, one notice', async () => {
        const [aela] = ['Aela', 'Bram', 'Cara'].map(n => addHero(n));
        give('oo_pick', 1);
        equipOk(aela.id, 'oo_pick');
        const data = JSON.parse(GameState.serializeJson());
        expect(shareOneToolOldStyle(data, 'oo_pick')).toBe(3);
        localStorage.setItem(SaveManager.getSlotKey(0), JSON.stringify(data));

        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        const [la, lb, lc] = GameState.state.heroes;
        expect([la.name, lb.name, lc.name]).toEqual(['Aela', 'Bram', 'Cara']);
        expect(la.equipment).toContain('oo_pick');
        expect(lb.equipment).not.toContain('oo_pick');
        expect(lc.equipment).not.toContain('oo_pick');
        expect(bank('oo_pick')).toBe(0);
        const banners = Banners.getAll();
        expect(banners).toHaveLength(1);
        expect(banners[0].line).toContain('Bram lost Test Pickaxe, Cara lost Test Pickaxe');
    });
});
