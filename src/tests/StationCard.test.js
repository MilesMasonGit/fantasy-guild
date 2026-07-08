import { describe, it, expect } from 'vitest';
import { getCard } from '../config/registries/cardRegistry.js';
import { getAreaSet } from '../config/registries/areaSetRegistry.js';
import { evaluateStationRecipe } from '../systems/cards/assembler/ModularSyncer.js';

describe('Station Card Integration', () => {
    it('should successfully load station_wood_kiln in CardRegistry', () => {
        const card = getCard('station_wood_kiln');
        expect(card).not.toBeNull();
        expect(card.name).toBe('Wood Kiln');
        expect(card.cardType).toBe('station');
        expect(card.preset).toBe('RECIPE_SELECTOR');
        expect(card.hasCraftingQueue).toBe(true);
        expect(card.passiveBuff).toBeNull();
        expect(card.config.recipeGroup).toBe('subskill_mpqi3mkd');
        expect(card.config.skill).toBe('culinary');
        expect(card.config.skillCap).toBe(90);
    });

    it('should dynamically populate station cards into the area set cardPools', () => {
        const area = getAreaSet('area_guild_hall');
        expect(area).not.toBeNull();
        expect(area.cardPool).toBeDefined();

        // Wood Kiln, Smelting Furnace, Blacksmith Forge, Woodland Kitchen should all be in the cardPool of area_guild_hall
        const hasKiln = area.cardPool.some(c => c.cardId === 'station_wood_kiln');
        const hasFurnace = area.cardPool.some(c => c.cardId === 'station_smelting_furnace');
        const hasForge = area.cardPool.some(c => c.cardId === 'station_blacksmith_forge');
        const hasKitchen = area.cardPool.some(c => c.cardId === 'station_woodland_kitchen');

        expect(hasKiln).toBe(true);
        expect(hasFurnace).toBe(true);
        expect(hasForge).toBe(true);
        expect(hasKitchen).toBe(true);
    });

    it('should keep areaId-less stations (test cards) out of every card pool', () => {
        const area = getAreaSet('area_guild_hall');
        const hasTestTower = area.cardPool.some(c => c.cardId === 'station_test_water_tower');
        expect(hasTestTower).toBe(false);
        // ... but the template itself still loads (needed for the passive-buff plumbing)
        const card = getCard('station_test_water_tower');
        expect(card).not.toBeNull();
        expect(card.hasCraftingQueue).toBe(false);
        expect(card.passiveBuff).not.toBeNull();
        expect(card.passiveBuff.type).toBe('SPEED');
    });

    it('should dynamically match recipe when ingredients are dropped in slots', () => {
        const card = {
            id: 'test-station-inst',
            templateId: 'station_smelting_furnace',
            cardType: 'station',
            config: {
                recipeGroup: 'subskill_smelting',
                skill: 'industry',
                skillCap: 90
            },
            assignedItems: {
                0: 'item_copper_ore',
                1: 'item_copper_ore',
                2: 'item_charcoal'
            }
        };

        evaluateStationRecipe(card);

        expect(card.activeRecipe).not.toBeNull();
        expect(card.activeRecipeId).toBe('recipe_copper_ingot');
        expect(card.outputs).toBeDefined();
        expect(card.outputs[0].itemId).toBe('item_copper_ingot');
    });
});
