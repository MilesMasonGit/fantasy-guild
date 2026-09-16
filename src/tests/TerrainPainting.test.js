import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';

/**
 * Terrain P1 — the Map's stamp, and what survives of painting.
 *
 * The feature's premise was that the board remembers (D-T10): a Token left its
 * ground behind when it went.
 *
 * ## ⚠️ What went, and why (Free Playmat slices 1.6a and 1.6d-2)
 * Slice 1.6a removed the paint hook in `BoardState.setToken`, the old-save
 * backfill, and the tile-keyed terrain fields (`board.terrain`,
 * `nextPaintOrder`, `terrainSeed`): the mat has no tiles to paint, and terrain
 * is dormant (FP-10). The tests describing all of that were left behind as
 * `it.skip`, as a record of what painting did.
 *
 * Slice 1.6d-2 deleted that record. It was written entirely in the deleted
 * grid's terms — painting a tile, painting the four tiles of a 2×2 footprint,
 * terrain staying on the tile a Token moved away from, a tile a displaced Token
 * was shoved onto — and by then it also called placement functions that no
 * longer exist (`placeToken`, `moveToken`, `returnTokenToTray`, `setToken`), so
 * it could not have been run even by un-skipping it. Whoever revives terrain on
 * a free mat needs new storage and a new hook, not this.
 *
 * ⭐ **What is still true and still runs** is the Map's stamp: it rides on the
 * Token instance and survives the Vault, which is a property of the Token, not
 * of any ground.
 */

// ⚠️ Terrain is dormant in the game (FP-10, `TERRAIN_ENABLED = false`). These
// tests pin how the stamp behaves when it is switched back on, so they force the
// switch on here rather than skipping — the code is dormant, not dead.
// `TerrainOff.test.js` pins the switched-off behaviour.
vi.mock('../config/registries/terrainRegistry.js', async (importOriginal) => ({
    ...(await importOriginal()),
    TERRAIN_ENABLED: true
}));

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn()
}));

registerTokenTypes({
    fixture_terrain_mine: {
        id: 'fixture_terrain_mine', name: 'Fixture Mine', tokenType: 'resource',
        rarity: 'common', uses: 100, requiresHero: false, config: null
    }
});

const token = (typeId, uses = 100, terrain = null) =>
    BoardState.createTokenInstance(typeId, uses, terrain);

beforeEach(() => {
    GameState.initNew();
});

describe('The Map’s stamp travels with the Token (D-T6)', () => {
    it('⭐ survives a round trip through the Vault', () => {
        // The Vault stores copies keyed by type and throws the rest of a Token
        // away, so this only works because the stamp is carried explicitly.
        // (Its last step — painting where it lands — went with the paint hook
        // in Free Playmat 1.6a; the carried stamp is still pinned here.)
        const stamped = token('fixture_terrain_mine', 60, 'shore');
        expect(TokenBank.deposit(stamped)).toBe(true);

        const drawn = BoardState.takeFromTokenBank('fixture_terrain_mine');
        expect(drawn.terrain).toBe('shore');
    });

    it('does not invent a stamp for a Token that never had one', () => {
        const plain = token('fixture_terrain_mine', 60);
        expect(plain.terrain).toBeUndefined();
        TokenBank.deposit(plain);
        expect(BoardState.takeFromTokenBank('fixture_terrain_mine').terrain).toBeUndefined();
    });
});
