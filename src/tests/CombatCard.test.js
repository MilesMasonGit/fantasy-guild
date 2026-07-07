import { describe, it, expect, beforeEach } from 'vitest';
import { CardFactory } from '../systems/cards/logic/CardFactory.js';
import { GameState } from '../state/GameState.js';

describe('Combat Card Factory and State Initialization', () => {
    beforeEach(() => {
        GameState.initNew();
    });

    it('should correctly initialize combat state when enemyId is inside config', () => {
        const mockTemplate = {
            id: 'task_test_combat',
            name: 'Test Combat Card',
            cardType: 'combat',
            preset: 'BASIC_COMBAT',
            config: {
                skill: 'combat',
                enemyId: 'enemy_copper_miner' // enemy exists in exported registries
            }
        };

        const card = CardFactory.createInstance(mockTemplate);

        expect(card).not.toBeNull();
        expect(card.enemyId).toBe('enemy_copper_miner');
        expect(card.combat).toBeDefined();
        expect(card.combat.enemyHp).toBeDefined();
        expect(card.combat.enemyHp.max).toBeGreaterThan(0);
        expect(card.combat.enemyHp.current).toBe(card.combat.enemyHp.max);
        
        // Traits checking
        const combatTrait = card.traits.find(t => t.type === 'combat');
        expect(combatTrait).toBeDefined();
        expect(combatTrait.enemyId).toBe('enemy_copper_miner');
    });
});
