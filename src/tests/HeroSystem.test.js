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

    it('should generate a hero with exactly 9 skills', () => {
        const hero = generateHero();
        const skillCount = Object.keys(hero.skills).length;
        expect(skillCount).toBe(9);
    });

    it('should apply trait modifiers to the hero aggregator', () => {
        const hero = generateHero({ traitId: 'nimble' }); // Nimble has a SPEED modifier for NAUTICAL
        const allModifiers = Array.from(hero.aggregator.modifiers.values()).flat();
        const speedMod = allModifiers.find(m => m.type === 'SPEED');
        expect(speedMod).toBeDefined();
        expect(speedMod.source).toContain('trait:nimble');
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

    it('should block XP for the deprecated defence skill', () => {
        const hero = generateHero();
        vi.spyOn(HeroManager, 'getHero').mockReturnValue(hero);

        const result = SkillSystem.addXP(hero.id, 'defence', 100);
        expect(result.success).toBe(false);
        expect(result.error).toBe('SKILL_DEPRECATED');
    });
});
