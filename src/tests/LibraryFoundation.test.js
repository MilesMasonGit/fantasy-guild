import { describe, it, expect } from 'vitest';
import { validateSaveData, INITIAL_STATE, GAME_VERSION } from '../state/StateSchema.js';

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

// The `areaSetRegistry` block is removed: areas are deleted by the playmat
// rework and `data/cards/area/` is archived, so set totals and deck lists have
// nothing left to describe. The StateSchema validation above is unaffected and
// is what this file is really for.
