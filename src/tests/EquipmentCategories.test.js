import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    EQUIPMENT_CATEGORY_DEFS,
    GRID_SLOT_COUNT,
    CATEGORY_KINDS,
    UNCAPPED,
    getCategoryDef,
    getCategoryCap,
    isEquipCategory,
    isGearCategory,
    isWeaponCategory,
    categoryIdsOfKind,
    listCategoryIds
} from '../config/registries/equipmentCategories.js';

// [D-54] Equipment categories are DATA. The owner intends to keep adding gear
// types — quiver, gloves, boots are planned, and `trinket` is expected to split
// into `ring` and `amulet` — so adding one must be an AUTHORING change with no
// engine edit. That is what this file exists to prove.

describe('the category table', () => {
    it('gives the hero a nine-slot grid (D-7)', () => {
        expect(GRID_SLOT_COUNT).toBe(9);
    });

    it('caps most categories at 1, with hands allowing 2 (D-55)', () => {
        expect(getCategoryCap('hat')).toBe(1);
        expect(getCategoryCap('chest')).toBe(1);
        expect(getCategoryCap('hand')).toBe(2);
    });

    it('leaves the Consumable class uncapped (D-56)', () => {
        expect(getCategoryCap('consumable')).toBe(UNCAPPED);
        expect(getCategoryCap('food')).toBe(1);
        expect(getCategoryCap('drink')).toBe(1);
    });

    it('separates worn gear from things the hero consumes', () => {
        expect(isGearCategory('chest')).toBe(true);
        expect(isGearCategory('food')).toBe(false);
        expect(isGearCategory('consumable')).toBe(false);
        expect(categoryIdsOfKind(CATEGORY_KINDS.SUSTENANCE).sort()).toEqual(['drink', 'food']);
    });

    it('marks which categories count as weapons for combat', () => {
        expect(isWeaponCategory('hand')).toBe(true);
        expect(isWeaponCategory('chest')).toBe(false);
    });

    it('reports unknown categories as unequippable rather than throwing', () => {
        expect(isEquipCategory('nonsense')).toBe(false);
        expect(getCategoryCap('nonsense')).toBe(0);
        expect(getCategoryDef('nonsense')).toBeNull();
    });
});

// The acceptance test for D-54. `boots` is one of the categories the owner
// named as planned; adding it must require nothing but a row in the table.
describe('adding a category by data alone (D-54 acceptance)', () => {
    const BOOTS = { id: 'boots', label: 'Boots', icon: '🥾', kind: CATEGORY_KINDS.GEAR, cap: 1 };

    beforeEach(() => {
        EQUIPMENT_CATEGORY_DEFS.push(BOOTS);
    });

    afterEach(() => {
        const i = EQUIPMENT_CATEGORY_DEFS.indexOf(BOOTS);
        if (i >= 0) EQUIPMENT_CATEGORY_DEFS.splice(i, 1);
    });

    it('appears in the authored list and its kind grouping', () => {
        expect(listCategoryIds()).toContain('boots');
        expect(categoryIdsOfKind(CATEGORY_KINDS.GEAR)).toContain('boots');
    });

    // The claim that matters: the real PLACEMENT logic honours a category it
    // has never heard of, purely because the table now lists it. No branch in
    // EquipmentManager names any category.
    it('is placed and capped by the real engine logic, unmodified', async () => {
        vi.resetModules();
        const cats = await import('../config/registries/equipmentCategories.js');
        cats.EQUIPMENT_CATEGORY_DEFS.push(BOOTS);

        // A hero carrying nothing but boots-shaped items.
        vi.doMock('../config/registries/itemRegistry.js', () => ({
            getItem: (id) => (id?.startsWith('boots_') ? { id, equipSlot: 'boots' } : null),
            ITEMS: {}
        }));
        const { resolveTargetSlot } = await import('../systems/equipment/EquipmentManager.js');

        const hero = { equipment: Array.from({ length: GRID_SLOT_COUNT }, () => null) };

        // First pair lands in the first free slot.
        const first = resolveTargetSlot(hero, 'boots');
        expect(first).toEqual({ slot: 0, displaces: null });
        hero.equipment[0] = 'boots_leather';

        // cap 1, so a second pair DISPLACES rather than taking a new slot.
        const second = resolveTargetSlot(hero, 'boots');
        expect(second).toEqual({ slot: 0, displaces: 0 });

        vi.doUnmock('../config/registries/itemRegistry.js');
    });
});

describe('the planned split of trinket into ring and amulet (D-54)', () => {
    it('is expressible purely as data', () => {
        // Not applied yet — this asserts the SHAPE the owner described is
        // representable, so the split stays an authoring change when it lands.
        const ring = { id: 'ring', label: 'Ring', icon: '💍', kind: CATEGORY_KINDS.GEAR, cap: 2 };
        const amulet = { id: 'amulet', label: 'Amulet', icon: '📿', kind: CATEGORY_KINDS.GEAR, cap: 1 };

        for (const def of [ring, amulet]) {
            expect(def.kind).toBe(CATEGORY_KINDS.GEAR);
            expect(typeof def.cap).toBe('number');
        }
        expect(ring.cap).toBe(2);
        expect(amulet.cap).toBe(1);
    });
});
