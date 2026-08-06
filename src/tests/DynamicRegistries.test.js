import { describe, it, expect } from 'vitest';
import { getItem } from '../config/registries/itemRegistry.js';
import { getEnemy } from '../config/registries/enemyRegistry.js';
import { getQuestDefinition } from '../config/registries/questRegistry.js';

describe('Dynamic Registry Loading', () => {
    it('should successfully load item_water from data/items.json', () => {
        const item = getItem('item_water');
        expect(item).not.toBeNull();
        expect(item.name).toBe('Water');
        // No blanket per-item cap any more (C-15): ordinary items carry no
        // maxStack and inherit DEFAULT_MAX_STACK. A 99-item ceiling made the
        // authored economy impossible — a task of any real yield just failed
        // on capacity. Genuinely non-stackable gear still declares its own.
        expect(item.maxStack).toBeUndefined();
        expect(getItem('item_copper_sword').maxStack).toBe(1);
    });

    it('should successfully load enemy_copper_miner from data/enemies.json', () => {
        const enemy = getEnemy('enemy_copper_miner');
        expect(enemy).not.toBeNull();
        expect(enemy.name).toBe('Copper Miner');
        // Combat stats are derived from the band level (32·G(level)), not authored
        expect(enemy.level).toBe(1);
        expect(enemy.hp).toBe(32);
    });

    it('should successfully load quest_woodward_supplies from data/quests.json', () => {
        // Was quest_ore_gathering, one of six quests belonging to the deleted
        // area `area_mpftfwt8` — removed in C-16 along with its ghost area.
        const quest = getQuestDefinition('quest_woodward_supplies');
        expect(quest).not.toBeNull();
        expect(quest.name).toBe('Supplies for the Road');
        expect(quest.maxProgress).toBe(15);
    });

    // The area-loading case is gone: `data/cards/` is archived by the playmat
    // rework (Phase 1 §H) and areas are deleted content. Items, enemies and
    // quest definitions above still load from their own files and still matter.
});
