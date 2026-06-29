import { describe, it, expect } from 'vitest';
import { validateSaveData, INITIAL_STATE, GAME_VERSION } from '../state/StateSchema.js';
import { getSetTotal, getAllAreaSetIds, getAreaSet } from '../config/registries/areaSetRegistry.js';

describe('Library Foundation - StateSchema', () => {
    it('should validate the initial state successfully', () => {
        const saveData = {
            version: GAME_VERSION,
            state: INITIAL_STATE
        };
        const result = validateSaveData(saveData);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should capture invalid playset counts', () => {
        const invalidState = structuredClone(INITIAL_STATE);
        invalidState.collection.playsets['logging'] = 5; // Invalid, max 4
        invalidState.collection.playsets['mining'] = -1; // Invalid, min 0
        invalidState.collection.playsets['well'] = '3';  // Invalid, must be number

        const saveData = {
            version: GAME_VERSION,
            state: invalidState
        };

        const result = validateSaveData(saveData);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('state.collection.playsets.logging must be a number between 0 and 4');
        expect(result.errors).toContain('state.collection.playsets.mining must be a number between 0 and 4');
        expect(result.errors).toContain('state.collection.playsets.well must be a number between 0 and 4');
    });

    it('should capture invalid playset type', () => {
        const invalidState = structuredClone(INITIAL_STATE);
        invalidState.collection.playsets = ['logging']; // Should be object

        const saveData = {
            version: GAME_VERSION,
            state: invalidState
        };

        const result = validateSaveData(saveData);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('state.collection.playsets must be an object');
    });
});

describe('Library Foundation - areaSetRegistry', () => {
    it('should calculate correct set totals dynamically', () => {
        const allIds = getAllAreaSetIds();
        expect(allIds.length).toBeGreaterThan(0);

        const ghTotal = getSetTotal('area_guild_hall');
        expect(ghTotal).toBeGreaterThan(0);
    });

    it('should return 0 for non-existent areas', () => {
        expect(getSetTotal('non_existent')).toBe(0);
    });

    it('should have deckList defined for all areas dynamically', () => {
        const allIds = getAllAreaSetIds();
        allIds.forEach(id => {
            const set = getAreaSet(id);
            expect(set.deckList).toBeDefined();
        });
    });
});
