import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getItem } from '../config/registries/itemRegistry.js';

describe('Hero System Enhancements', () => {
    beforeEach(() => {
        // Clear state or mock as needed
        vi.clearAllMocks();
    });

    it('should generate a hero with all 15 skills at level 1', () => {
        const hero = generateHero();
        const skillCount = Object.keys(hero.skills).length;
        expect(skillCount).toBe(15);
        for (const skill of Object.values(hero.skills)) {
            expect(skill.level).toBe(1);
        }
    });

    it('should NOT apply class/trait modifiers (cosmetic only)', () => {
        const hero = generateHero({ traitId: 'nimble', classId: 'wizard' });
        const allModifiers = Array.from(hero.aggregator.modifiers.values()).flat();
        expect(allModifiers.length).toBe(0);
    });

    it('should add modifiers when equipping an item', () => {
        const hero = generateHero();
        // Mock HeroManager.getHero to return our test hero
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        EquipmentManager.equipItem(hero.id, 'iron_armor');
        
        const defenseBonus = hero.aggregator.query('DEFENSE');
        const itemTemplate = getItem('iron_armor');
        expect(defenseBonus).toBe(itemTemplate.defense);
    });

    it('should remove modifiers when unequipping an item', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);
        vi.spyOn(InventoryManager, 'hasItem').mockReturnValue(true);

        EquipmentManager.equipItem(hero.id, 'iron_armor');
        expect(hero.aggregator.query('DEFENSE')).toBeGreaterThan(0);

        EquipmentManager.unequipItem(hero.id, 'armor');
        expect(hero.aggregator.query('DEFENSE')).toBe(0);
    });

    it('should allow XP gain for the defense skill', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);

        const result = SkillSystem.addXP(hero.id, 'defense', 100);
        expect(result.success).toBe(true);
        expect(result.targetSkillId).toBe('defense');
    });

    it('should level all 15 skills independently', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);

        SkillSystem.addXP(hero.id, 'labor', 5000);
        expect(hero.skills.labor.level).toBeGreaterThan(1);
        // Other skills are untouched
        expect(hero.skills.forge.level).toBe(1);
        expect(hero.skills.melee.level).toBe(1);
    });

    it('should funnel sub-skill XP into the new parents', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);

        const result = SkillSystem.addXP(hero.id, 'mining', 100);
        expect(result.success).toBe(true);
        expect(result.targetSkillId).toBe('labor');

        const result2 = SkillSystem.addXP(hero.id, 'fishing', 100);
        expect(result2.targetSkillId).toBe('aquatic');
    });
});
