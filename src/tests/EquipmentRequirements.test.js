import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import * as EquipmentValidator from '../systems/equipment/EquipmentValidator.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as ItemRegistry from '../config/registries/itemRegistry.js';
import { EQUIPMENT_CATEGORIES } from '../config/registries/equipmentConstants.js';

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
    // food/drink still carry an equipSlot but are no longer hero gear (CR-029).
    const CONSUMABLE_SLOTS = ['food', 'drink'];
    const equippables = Object.values(ItemRegistry.ITEMS)
        .filter(item => item?.equipSlot && !CONSUMABLE_SLOTS.includes(item.equipSlot));

    it('should give every slot category at least one item to put in it', () => {
        const covered = new Set(equippables.map(item => item.equipSlot));
        for (const category of Object.values(EQUIPMENT_CATEGORIES)) {
            expect(covered.has(category), `no item exists for the "${category}" slot`).toBe(true);
        }
    });

    it('should not leave any equippable item on a retired slot name', () => {
        const valid = Object.values(EQUIPMENT_CATEGORIES);
        const strays = equippables
            .filter(item => !valid.includes(item.equipSlot))
            .map(item => `${item.id} (${item.equipSlot})`);
        expect(strays).toEqual([]);
    });
});
