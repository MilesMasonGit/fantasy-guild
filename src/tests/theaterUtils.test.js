import { describe, it, expect, vi } from 'vitest';
import { resolvePotentialOutputs } from '../ui/utils/theaterUtils.js';
import { getEnemy } from '../config/registries/enemyRegistry.js';
import { getDropTable } from '../config/registries/dropTableRegistry.js';
import { getAreaSet } from '../config/registries/areaSetRegistry.js';
import { getRecipesBySubskill } from '../config/registries/recipeRegistry.js';
import { getCard } from '../config/registries/cardRegistry.js';

// Mock the registries
vi.mock('../config/registries/enemyRegistry.js', () => ({
    getEnemy: vi.fn(id => {
        if (id === 'enemy_wolf') {
            return {
                id: 'enemy_wolf',
                dropTableId: 'wolf_drops',
                drops: [{ itemId: 'raw_meat', chance: 50 }]
            };
        }
        return null;
    })
}));

vi.mock('../config/registries/dropTableRegistry.js', () => ({
    getDropTable: vi.fn(id => {
        if (id === 'wolf_drops') {
            return { id: 'wolf_drops', drops: [] };
        }
        return null;
    })
}));

vi.mock('../config/registries/areaSetRegistry.js', () => ({
    getAreaSet: vi.fn(id => {
        if (id === 'area_forest') {
            return {
                id: 'area_forest',
                invasionSpawnPool: ['enemy_wolf']
            };
        }
        return null;
    })
}));

vi.mock('../config/registries/recipeRegistry.js', () => ({
    getRecipesBySubskill: vi.fn(id => {
        if (id === 'recipe_group_smelting') {
            return [
                {
                    id: 'recipe_coal',
                    outputs: [{ itemId: 'item_charcoal' }]
                }
            ];
        }
        return [];
    })
}));

vi.mock('../config/registries/cardRegistry.js', () => ({
    getCard: vi.fn(id => {
        if (id === 'combat_wolf_forest_template') {
            return {
                id: 'combat_wolf_forest_template',
                cardType: 'combat',
                enemyId: 'enemy_wolf'
            };
        }
        return null;
    })
}));

describe('theaterUtils - resolvePotentialOutputs', () => {
    it('should resolve simple combat outputs', () => {
        const card = {
            cardType: 'combat',
            enemyId: 'enemy_wolf'
        };
        const outputs = resolvePotentialOutputs(card, null);
        expect(outputs).toContainEqual({ type: 'enemy', id: 'enemy_wolf' });
        expect(outputs).toContainEqual({ type: 'loot_table', id: 'wolf_drops' });
        expect(outputs).toContainEqual({ type: 'item', id: 'raw_meat' });
    });

    it('should auto-resolve template from templateId when template is null', () => {
        const card = {
            templateId: 'combat_wolf_forest_template'
        };
        const outputs = resolvePotentialOutputs(card, null);
        expect(outputs).toContainEqual({ type: 'enemy', id: 'enemy_wolf' });
    });

    it('should resolve invasion outputs from spawn pool', () => {
        const card = {
            cardType: 'invasion',
            areaSet: 'area_forest'
        };
        const outputs = resolvePotentialOutputs(card, null);
        expect(outputs).toContainEqual({ type: 'enemy', id: 'enemy_wolf' });
        expect(outputs).toContainEqual({ type: 'loot_table', id: 'wolf_drops' });
        expect(outputs).toContainEqual({ type: 'item', id: 'raw_meat' });
    });

    it('should resolve station outputs from recipes', () => {
        const card = {
            cardType: 'station',
            config: { recipeGroup: 'recipe_group_smelting' }
        };
        const outputs = resolvePotentialOutputs(card, null);
        expect(outputs).toContainEqual({ type: 'item', id: 'item_charcoal' });
    });

    it('should resolve task outputs from drops and loot traits', () => {
        const card = {
            cardType: 'task',
            drops: [
                { type: 'combat_trigger', enemyId: 'enemy_wolf' },
                { itemId: 'blueberry' }
            ],
            traits: [
                {
                    type: 'loot',
                    items: [
                        { itemId: 'wolf_drops' } // resolves as loot table
                    ]
                }
            ]
        };
        const outputs = resolvePotentialOutputs(card, null);
        expect(outputs).toContainEqual({ type: 'enemy', id: 'enemy_wolf' });
        expect(outputs).toContainEqual({ type: 'item', id: 'blueberry' });
        expect(outputs).toContainEqual({ type: 'loot_table', id: 'wolf_drops' });
    });
});

