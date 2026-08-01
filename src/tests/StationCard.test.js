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
        // Canonical 15-skill parent. Was the legacy 'culinary' until the
        // subskill parents were corrected (2026-07-20) so station cards resolve
        // to the right skill CATEGORY — a furnace is Processing, not Gathering.
        expect(card.config.skill).toBe('cooking');
        expect(card.config.skillCap).toBe(90);
    });

    // D-64: stations no longer carry an areaId. They are guild-wide Outpost
    // cards gated by the guild tree, not regional drops — so they must NOT
    // appear in any area's card pool, or they'd be drawable into a deck.
    it('should keep every station card out of the area card pools', () => {
        const stationIds = [
            'station_wood_kiln', 'station_smelting_furnace',
            'station_blacksmith_forge', 'station_woodland_kitchen',
            'station_test_water_tower'
        ];
        for (const areaId of ['area_guild_hall', 'area_farmlands']) {
            const area = getAreaSet(areaId);
            if (!area?.cardPool) continue;
            const leaked = area.cardPool.filter(c => stationIds.includes(c.cardId));
            expect(leaked.map(c => c.cardId)).toEqual([]);
        }
    });

    it('should still load station templates for the Outpost banner', () => {
        // Out of the pools, but the templates themselves must load — the
        // Outpost installs them by id, and passive-buff plumbing reads them.
        for (const id of ['station_wood_kiln', 'station_blacksmith_forge']) {
            expect(getCard(id)).not.toBeNull();
        }
        const tower = getCard('station_test_water_tower');
        expect(tower).not.toBeNull();
        expect(tower.hasCraftingQueue).toBe(false);
        expect(tower.passiveBuff).not.toBeNull();
        expect(tower.passiveBuff.type).toBe('SPEED');
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
