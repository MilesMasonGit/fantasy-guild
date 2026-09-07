import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { createEmptyBoard } from '../state/StateSchema.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { DEFAULT_TERRAIN } from '../config/registries/terrainAssignments.js';

/**
 * Terrain P1 — what gets painted, and what refuses to be erased.
 *
 * The feature's whole premise is that the board remembers (D-T10): a Token
 * leaves its ground behind when it goes. Most of what is worth pinning here is
 * therefore *negative* — the paths that must NOT clear terrain — because those
 * are the ones a later refactor breaks without noticing.
 *
 * Nothing renders yet. These are assertions about state.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn()
}));

registerTokenTypes({
    fixture_terrain_mine: {
        id: 'fixture_terrain_mine', name: 'Fixture Mine', tokenType: 'resource',
        rarity: 'common', uses: 100, requiresHero: false, config: null
    },
    fixture_terrain_grove: {
        id: 'fixture_terrain_grove', name: 'Fixture Grove', tokenType: 'resource',
        rarity: 'common', uses: 100, requiresHero: false, config: null
    },
    fixture_terrain_keep: {
        id: 'fixture_terrain_keep', name: 'Fixture Keep', tokenType: 'buff',
        rarity: 'common', uses: null, requiresHero: false, size: 2, config: null
    }
});

const token = (typeId, uses = 100, terrain = null) =>
    BoardState.createTokenInstance(typeId, uses, terrain);

beforeEach(() => {
    GameState.initNew();
});

describe('A Token paints the ground it lands on', () => {
    it('paints the tile it is placed on', () => {
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));
        expect(BoardState.getTileTerrain(9)?.terrainId).toBe('hills');
    });

    it('paints every tile of a 2×2 footprint, all at the same moment', () => {
        Placement.placeToken(7, token('fixture_terrain_keep', null, 'hamlet'));

        const footprint = [7, 8, 13, 14].map(t => BoardState.getTileTerrain(t));
        for (const record of footprint) expect(record?.terrainId).toBe('hamlet');
        // One drop is one act: the four tiles must win and lose contested
        // subtiles together, so they share a paint order rather than being
        // numbered in reading order.
        const orders = new Set(footprint.map(r => r.paintedAt));
        expect(orders.size).toBe(1);
    });

    it('leaves an untouched tile unpainted rather than defaulting it', () => {
        Placement.placeToken(9, token('fixture_terrain_mine'));
        expect(BoardState.getTileTerrain(0)).toBeNull();
    });

    it('falls back to the default for a Token nothing has authored', () => {
        Placement.placeToken(9, token('fixture_terrain_mine'));
        expect(BoardState.getTileTerrain(9)?.terrainId).toBe(DEFAULT_TERRAIN);
    });
});

describe('⚠️ Terrain is never erased (D-T10)', () => {
    it('survives the Token being returned to the Tray', () => {
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));
        Placement.returnTokenToTray(9);

        expect(BoardState.getToken(9)).toBeNull();
        expect(BoardState.getTileTerrain(9)?.terrainId).toBe('hills');
    });

    it('survives the Token being sent to the Vault', () => {
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));
        Placement.returnTokenToVault(9);

        expect(BoardState.getToken(9)).toBeNull();
        expect(BoardState.getTileTerrain(9)?.terrainId).toBe('hills');
    });

    it('⭐ stays behind on the tile a Token moves AWAY from', () => {
        // The headline behaviour: drag a forest off a tile and the forest stays.
        Placement.placeToken(9, token('fixture_terrain_grove', 100, 'forest'));
        Placement.moveToken(9, 20);

        expect(BoardState.getTileTerrain(9)?.terrainId).toBe('forest');
        expect(BoardState.getTileTerrain(20)?.terrainId).toBe('forest');
    });

    it('survives the Token being cleared straight off the tile', () => {
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));
        BoardState.setToken(9, null);
        expect(BoardState.getTileTerrain(9)?.terrainId).toBe('hills');
    });
});

describe('Painting over (D-T3 — most recent wins)', () => {
    it('replaces the terrain and takes a higher paint order', () => {
        Placement.placeToken(9, token('fixture_terrain_grove', 100, 'forest'));
        const before = BoardState.getTileTerrain(9);

        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));
        const after = BoardState.getTileTerrain(9);

        expect(after.terrainId).toBe('hills');
        expect(after.paintedAt).toBeGreaterThan(before.paintedAt);
    });

    it('hands out paint orders that only ever increase', () => {
        const seen = [];
        for (const tile of [0, 1, 2, 9, 20]) {
            Placement.placeToken(tile, token('fixture_terrain_mine', 100, 'hills'));
            seen.push(BoardState.getTileTerrain(tile).paintedAt);
        }
        expect(seen).toEqual([...seen].sort((a, b) => a - b));
        expect(new Set(seen).size).toBe(seen.length);
    });

    it('paints the tile a displaced Token is shoved onto', () => {
        // A cascade moves a Token the player did not aim, and it paints where
        // it lands like any other arrival — that is why painting hangs off
        // setToken rather than off the placement call.
        Placement.placeToken(9, token('fixture_terrain_grove', 100, 'forest'));
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));

        expect(BoardState.getTileTerrain(9).terrainId).toBe('hills');
        expect(BoardState.getTileTerrain(3).terrainId).toBe('forest'); // pushed here
    });
});

describe('The Map’s stamp travels with the Token (D-T6)', () => {
    it('a stamped Token paints its Map’s terrain, not the default', () => {
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'shore'));
        expect(BoardState.getTileTerrain(9).terrainId).toBe('shore');
    });

    it('⭐ survives a round trip through the Vault', () => {
        // The Vault stores copies keyed by type and throws the rest of a Token
        // away, so this only works because the stamp is carried explicitly.
        const stamped = token('fixture_terrain_mine', 60, 'shore');
        expect(TokenBank.deposit(stamped)).toBe(true);

        const drawn = BoardState.takeFromTokenBank('fixture_terrain_mine');
        expect(drawn.terrain).toBe('shore');

        Placement.placeToken(20, drawn);
        expect(BoardState.getTileTerrain(20).terrainId).toBe('shore');
    });

    it('does not invent a stamp for a Token that never had one', () => {
        const plain = token('fixture_terrain_mine', 60);
        expect(plain.terrain).toBeUndefined();
        TokenBank.deposit(plain);
        expect(BoardState.takeFromTokenBank('fixture_terrain_mine').terrain).toBeUndefined();
    });
});

describe('Saves', () => {
    it('a fresh board declares terrain, a paint counter and a seed', () => {
        const board = createEmptyBoard();
        expect(board.terrain).toEqual({});
        expect(board.nextPaintOrder).toBe(0);
        expect(board.terrainSeed).toBeNull();
    });

    it('the seed is assigned once and then stays put', () => {
        const first = BoardState.terrainSeed();
        expect(typeof first).toBe('number');
        expect(BoardState.terrainSeed()).toBe(first);
    });

    it('⚠️ paints under the Tokens a pre-terrain save was already holding', () => {
        // Terrain shipped without a save migration because it is purely
        // additive. But an older save loaded with a board full of Tokens and no
        // terrain would show bare ground under all of them, so the first read
        // paints what is already there.
        GameState.state.board = createEmptyBoard();
        GameState.state.board.tiles = {
            9: { id: 'tok_old_1', typeId: 'fixture_terrain_mine', usesRemaining: 50, cycleElapsedMs: 0 },
            20: { id: 'tok_old_2', typeId: 'fixture_terrain_grove', usesRemaining: 50, cycleElapsedMs: 0 }
        };
        // ⚠️ Terrain is left present-but-empty on purpose. That is what the
        // save loader actually hands over — it merges the declared schema in,
        // so an old save never arrives with the key missing. A guard watching
        // for the key to be absent passed its test and did nothing in the game.

        expect(BoardState.getTileTerrain(9)?.terrainId).toBe(DEFAULT_TERRAIN);
        expect(BoardState.getTileTerrain(20)?.terrainId).toBe(DEFAULT_TERRAIN);
        expect(BoardState.getTileTerrain(0)).toBeNull();
    });

    it('does not re-run the backfill and renumber a board it has already read', () => {
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));
        const first = BoardState.getTileTerrain(9).paintedAt;
        BoardState.terrainMap();
        BoardState.getTileTerrain(9);
        expect(BoardState.getTileTerrain(9).paintedAt).toBe(first);
    });
});
