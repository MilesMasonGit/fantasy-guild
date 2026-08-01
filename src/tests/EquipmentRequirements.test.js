import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import * as EquipmentValidator from '../systems/equipment/EquipmentValidator.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as ItemRegistry from '../config/registries/itemRegistry.js';
import { EQUIPMENT_CATEGORIES, categoryIdsOfKind, CATEGORY_KINDS } from '../config/registries/equipmentConstants.js';

describe('Equipment Multivariable Skill Gating', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should allow equipping if hero meets all multivariable skill requirements', () => {
        const hero = generateHero();
        hero.skills.combat = { level: 15, xp: 0 };
        hero.skills.nature = { level: 10, xp: 0 };
        
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        
        const testItem = {
            id: 'test_gated_sword',
            name: 'Nature Infused Sword',
            equipSlot: 'weapon',
            requirements: [
                { skill: 'combat', level: 15 },
                { skill: 'nature', level: 10 }
            ]
        };
        
        vi.spyOn(ItemRegistry, 'getItem').mockReturnValue(testItem);

        const result = EquipmentValidator.canHeroEquip(hero.id, 'test_gated_sword');
        expect(result.canEquip).toBe(true);
    });

    it('should reject equipping if hero fails any of the skill requirements', () => {
        const hero = generateHero();
        hero.skills.combat = { level: 14, xp: 0 }; // too low
        hero.skills.nature = { level: 10, xp: 0 };
        
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        
        const testItem = {
            id: 'test_gated_sword',
            name: 'Nature Infused Sword',
            equipSlot: 'weapon',
            requirements: [
                { skill: 'combat', level: 15 },
                { skill: 'nature', level: 10 }
            ]
        };
        
        vi.spyOn(ItemRegistry, 'getItem').mockReturnValue(testItem);

        const result = EquipmentValidator.canHeroEquip(hero.id, 'test_gated_sword');
        expect(result.canEquip).toBe(false);
        expect(result.reason).toBe('Requires combat level 15');
    });

    it('should reject equipping if hero meets first requirement but fails the second one', () => {
        const hero = generateHero();
        hero.skills.combat = { level: 15, xp: 0 };
        hero.skills.nature = { level: 9, xp: 0 }; // too low
        
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        
        const testItem = {
            id: 'test_gated_sword',
            name: 'Nature Infused Sword',
            equipSlot: 'weapon',
            requirements: [
                { skill: 'combat', level: 15 },
                { skill: 'nature', level: 10 }
            ]
        };
        
        vi.spyOn(ItemRegistry, 'getItem').mockReturnValue(testItem);

        const result = EquipmentValidator.canHeroEquip(hero.id, 'test_gated_sword');
        expect(result.canEquip).toBe(false);
        expect(result.reason).toBe('Requires nature level 10');
    });
});

describe('Equipment content coverage (Hero Dock Phase 2)', () => {
    // Every equippable item in the game, read from the real registry.
    // Food and drink count again: they are hero equipment once more (D-4/D-7),
    // sharing the loadout grid with gear.
    const equippables = Object.values(ItemRegistry.ITEMS).filter(item => item?.equipSlot);

    it('should give every gear and sustenance category at least one item', () => {
        const covered = new Set(equippables.map(item => item.equipSlot));
        const needed = [
            ...categoryIdsOfKind(CATEGORY_KINDS.GEAR),
            ...categoryIdsOfKind(CATEGORY_KINDS.SUSTENANCE)
        ];
        for (const category of needed) {
            expect(covered.has(category), `no item exists for the "${category}" category`).toBe(true);
        }
    });

    // The `consumable` class (potions, scrolls, runes — D-56) has no items
    // yet; C-8 authors them. Asserted explicitly so the gap is visible and
    // this flips the moment they exist, rather than staying silently unchecked.
    it('documents that the consumable class is still unauthored (C-8)', () => {
        const covered = new Set(equippables.map(item => item.equipSlot));
        expect(covered.has('consumable')).toBe(false);
    });

    it('should not leave any equippable item on a retired slot name', () => {
        const valid = Object.values(EQUIPMENT_CATEGORIES);
        const strays = equippables
            .filter(item => !valid.includes(item.equipSlot))
            .map(item => `${item.id} (${item.equipSlot})`);
        expect(strays).toEqual([]);
    });
});
