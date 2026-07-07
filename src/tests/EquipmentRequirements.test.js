import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import * as EquipmentValidator from '../systems/equipment/EquipmentValidator.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as ItemRegistry from '../config/registries/itemRegistry.js';

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
