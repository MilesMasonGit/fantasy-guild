import { describe, it, expect } from 'vitest';
import { migrateState } from '../systems/core/SaveMigration.js';
import { followRenames, GROWN_SAPLINGS } from '../systems/core/followRenames.js';
import { createInitialState, GAME_VERSION } from '../state/StateSchema.js';
import { getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';

/**
 * The Saplings are gone from the content: Forests and the Orchard plant full Trees, and a Stump
 * grows straight back into its Tree. A save written while a Sapling stood loads it as its Tree,
 * whole: the Tree's starting charges and no growth left to run.
 */

const sapling = (id, typeId, clocks) => ({
    id, typeId, x: 400, y: 300, placedAt: 3, usesRemaining: null, cycleElapsedMs: 0, origin: 'spawned', clocks
});

/** A save with an Oak Sapling halfway grown on the mat and a Fir Sapling on another Region's mat. */
function oldSave() {
    const state = createInitialState();
    state.board.tokens = {
        tok_oak: sapling('tok_oak', 'token_oak_sapling', { growMs: 42000, spawnMs: 5 }),
        tok_tree: { id: 'tok_tree', typeId: 'token_oak_tree', x: 700, y: 300, placedAt: 1, usesRemaining: 2, cycleElapsedMs: 0 }
    };
    state.atlas.regions = {
        region_2: { board: { tokens: { tok_fir: sapling('tok_fir', 'token_fir_sapling', { growMs: 1 }) } } }
    };
    return state;
}

describe('a saved Sapling loads as its full Tree', () => {
    it('every retired Sapling is gone from the data, and the Tree it loads as ships', () => {
        for (const [from, tree] of Object.entries(GROWN_SAPLINGS)) {
            expect(getTokenType(from), from).toBeFalsy();
            expect(getTokenType(tree), tree).toBeTruthy();
        }
    });

    it('⭐ an Oak Sapling mid-growth loads as an Oak Tree with its starting charges and no growth clock; a Region\'s Fir Sapling too', () => {
        const s = migrateState(oldSave(), GAME_VERSION);
        const oak = s.board.tokens.tok_oak;
        expect(oak).toMatchObject({
            id: 'tok_oak', typeId: 'token_oak_tree', x: 400, y: 300, placedAt: 3, origin: 'spawned',
            usesRemaining: tokenStartingUses('token_oak_tree')
        });
        expect(oak.usesRemaining).toBeGreaterThan(0);
        expect(oak.clocks).toEqual({ spawnMs: 5 });
        const fir = s.atlas.regions.region_2.board.tokens.tok_fir;
        expect(fir).toMatchObject({ typeId: 'token_fir_tree', usesRemaining: tokenStartingUses('token_fir_tree') });
        expect(fir.clocks).toEqual({});
    });

    it('a Tree already standing keeps its own charges', () => {
        const s = migrateState(oldSave(), GAME_VERSION);
        expect(s.board.tokens.tok_tree).toMatchObject({ typeId: 'token_oak_tree', usesRemaining: 2 });
    });

    it('a rename the CMS recorded for a Sapling id wins over the Tree', () => {
        const state = oldSave();
        const s = followRenames(state, { table: { tokens: { token_oak_sapling: 'token_birch_tree' } } });
        expect(s.board.tokens.tok_oak).toMatchObject({ typeId: 'token_birch_tree', usesRemaining: null });
        expect(s.board.tokens.tok_oak.clocks).toEqual({ growMs: 42000, spawnMs: 5 });
    });
});
