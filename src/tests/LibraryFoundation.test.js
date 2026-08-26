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

    // The two playset-validation tests that used to sit here were deleted with
    // CR2-043, and this is why: they asserted that `validateSaveData` refused
    // card-ownership counts outside 0-4. Playsets, binders, areas and cards are
    // all retired concepts — nothing can put a count in `collection.playsets`
    // any more — so the ~30 lines of validation they covered were deleted from
    // StateSchema. `SaveSchemaDeclared.test.js` asserts the retired structures
    // are no longer policed; the validator's live job (the required sections,
    // including `board` and `quests`) is covered there too.
});

// The `areaSetRegistry` block is removed: areas are deleted by the playmat
// rework and the archived `data/cards/area/` was deleted 2026-08-24, so set
// totals and deck lists have
// nothing left to describe. The StateSchema validation above is unaffected and
// is what this file is really for.
