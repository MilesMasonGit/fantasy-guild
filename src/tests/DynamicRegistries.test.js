import { describe, it, expect } from 'vitest';
import { getItem } from '../config/registries/itemRegistry.js';
import { getEnemy } from '../config/registries/enemyRegistry.js';
import { getQuestDefinition } from '../config/registries/questRegistry.js';
import { getAreaSet } from '../config/registries/areaSetRegistry.js';

describe('Dynamic Registry Loading', () => {
    it('should successfully load item_water from data/items.json', () => {
        const item = getItem('item_water');
        expect(item).not.toBeNull();
        expect(item.name).toBe('Water');
        expect(item.maxStack).toBe(99);
    });

    it('should successfully load enemy_copper_miner from data/enemies.json', () => {
        const enemy = getEnemy('enemy_copper_miner');
        expect(enemy).not.toBeNull();
        expect(enemy.name).toBe('Copper Miner');
        expect(enemy.hp).toBe(30);
    });

    it('should successfully load quest_ore_gathering from data/quests.json', () => {
        const quest = getQuestDefinition('quest_ore_gathering');
        expect(quest).not.toBeNull();
        expect(quest.name).toBe('Ore Gathering');
        expect(quest.maxProgress).toBe(10);
    });

    it('should successfully load area_whispering_woods from data/cards/area/areas.json', () => {
        const area = getAreaSet('area_whispering_woods');
        expect(area).not.toBeNull();
        expect(area.name).toBe('Whispering Woods');
        expect(area.packBaseGoldCost).toBe(100);
    });
});
