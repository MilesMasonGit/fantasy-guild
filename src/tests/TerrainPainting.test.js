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
 * ⚠️ **Mostly skipped since Free Playmat slice 1.6a (FP-10).** The paint hook
 * in `BoardState.setToken`, the old-save backfill and the tile-keyed terrain
 * fields (`board.terrain`, `nextPaintOrder`, `terrainSeed`) were removed: the
 * mat has no tiles to paint, and terrain is dormant. The skipped tests are kept
 * as the record of what painting did, for whoever revives terrain on a free
 * mat (it will need new storage and a new hook). The Vault stamp is still
 * carried when the switch is on, so that test still runs.
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

/** Removed with the paint hook in Free Playmat 1.6a — see FP-10. */
const PAINT_HOOK_REMOVED = '(paint hook removed in Free Playmat 1.6a, FP-10)';

describe('A Token paints the ground it lands on', () => {
    it.skip(`paints the tile it is placed on ${PAINT_HOOK_REMOVED}`, () => {
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));
        expect(BoardState.getTileTerrain(9)?.terrainId).toBe('hills');
    });

    it.skip(`paints every tile of a 2×2 footprint, all at the same moment ${PAINT_HOOK_REMOVED}`, () => {
        Placement.placeToken(7, token('fixture_terrain_keep', null, 'hamlet'));

        const footprint = [7, 8, 13, 14].map(t => BoardState.getTileTerrain(t));
        for (const record of footprint) expect(record?.terrainId).toBe('hamlet');
        const orders = new Set(footprint.map(r => r.paintedAt));
        expect(orders.size).toBe(1);
    });

    it.skip(`leaves an untouched tile unpainted rather than defaulting it ${PAINT_HOOK_REMOVED}`, () => {
        Placement.placeToken(9, token('fixture_terrain_mine'));
        expect(BoardState.getTileTerrain(0)).toBeNull();
    });

    it.skip(`falls back to the default for a Token nothing has authored ${PAINT_HOOK_REMOVED}`, () => {
        Placement.placeToken(9, token('fixture_terrain_mine'));
        expect(BoardState.getTileTerrain(9)?.terrainId).toBe(DEFAULT_TERRAIN);
    });
});

describe('⚠️ Terrain is never erased (D-T10)', () => {
    it.skip(`survives the Token being returned to the Tray ${PAINT_HOOK_REMOVED}`, () => {
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));
        Placement.returnTokenToTray(9);

        expect(BoardState.getToken(9)).toBeNull();
        expect(BoardState.getTileTerrain(9)?.terrainId).toBe('hills');
    });

    it.skip(`survives the Token being sent to the Vault ${PAINT_HOOK_REMOVED}`, () => {
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));
        Placement.returnTokenToVault(9);

        expect(BoardState.getToken(9)).toBeNull();
        expect(BoardState.getTileTerrain(9)?.terrainId).toBe('hills');
    });

    it.skip(`⭐ stays behind on the tile a Token moves AWAY from ${PAINT_HOOK_REMOVED}`, () => {
        Placement.placeToken(9, token('fixture_terrain_grove', 100, 'forest'));
        Placement.moveToken(9, 20);

        expect(BoardState.getTileTerrain(9)?.terrainId).toBe('forest');
        expect(BoardState.getTileTerrain(20)?.terrainId).toBe('forest');
    });

    it.skip(`survives the Token being cleared straight off the tile ${PAINT_HOOK_REMOVED}`, () => {
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));
        BoardState.setToken(9, null);
        expect(BoardState.getTileTerrain(9)?.terrainId).toBe('hills');
    });
});

describe('Painting over (D-T3 — most recent wins)', () => {
    it.skip(`replaces the terrain and takes a higher paint order ${PAINT_HOOK_REMOVED}`, () => {
        Placement.placeToken(9, token('fixture_terrain_grove', 100, 'forest'));
        const before = BoardState.getTileTerrain(9);

        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));
        const after = BoardState.getTileTerrain(9);

        expect(after.terrainId).toBe('hills');
        expect(after.paintedAt).toBeGreaterThan(before.paintedAt);
    });

    it.skip(`hands out paint orders that only ever increase ${PAINT_HOOK_REMOVED}`, () => {
        const seen = [];
        for (const tile of [0, 1, 2, 9, 20]) {
            Placement.placeToken(tile, token('fixture_terrain_mine', 100, 'hills'));
            seen.push(BoardState.getTileTerrain(tile).paintedAt);
        }
        expect(seen).toEqual([...seen].sort((a, b) => a - b));
        expect(new Set(seen).size).toBe(seen.length);
    });

    it.skip(`paints the tile a displaced Token is shoved onto ${PAINT_HOOK_REMOVED}`, () => {
        Placement.placeToken(9, token('fixture_terrain_grove', 100, 'forest'));
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));

        expect(BoardState.getTileTerrain(9).terrainId).toBe('hills');
        expect(BoardState.getTileTerrain(3).terrainId).toBe('forest'); // pushed here
    });
});

describe('The Map’s stamp travels with the Token (D-T6)', () => {
    it.skip(`a stamped Token paints its Map’s terrain, not the default ${PAINT_HOOK_REMOVED}`, () => {
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'shore'));
        expect(BoardState.getTileTerrain(9).terrainId).toBe('shore');
    });

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

describe('Saves', () => {
    it.skip('a fresh board declares terrain, a paint counter and a seed (fields left the schema in 1.6a, FP-10)', () => {
        const board = createEmptyBoard();
        expect(board.terrain).toEqual({});
        expect(board.nextPaintOrder).toBe(0);
        expect(board.terrainSeed).toBeNull();
    });

    it.skip('the seed is assigned once and then stays put (seed removed in 1.6a, FP-10)', () => {
        const first = BoardState.terrainSeed();
        expect(typeof first).toBe('number');
        expect(BoardState.terrainSeed()).toBe(first);
    });

    it.skip('⚠️ paints under the Tokens a pre-terrain save was already holding (backfill removed in 1.6a, FP-10)', () => {
        GameState.state.board = createEmptyBoard();
        expect(BoardState.getTileTerrain(9)?.terrainId).toBe(DEFAULT_TERRAIN);
    });

    it.skip(`does not re-run the backfill and renumber a board it has already read ${PAINT_HOOK_REMOVED}`, () => {
        Placement.placeToken(9, token('fixture_terrain_mine', 100, 'hills'));
        const first = BoardState.getTileTerrain(9).paintedAt;
        BoardState.terrainMap();
        expect(BoardState.getTileTerrain(9).paintedAt).toBe(first);
    });
});
