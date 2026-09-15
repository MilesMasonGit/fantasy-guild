import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { TILE_COUNT, isTileIndex, tileFootprint } from '../config/boardGeometry.js';

/**
 * ⚠️ STOPGAP test — deleted with `gridShim.js` in Free Playmat slice 1.6d.
 *
 * Slice 1.6a stores Tokens by id at a point. The shim answers the old tile API
 * over those points, and has to answer it **exactly** as the old tile storage
 * did, or every reader not yet moved (1.6b) silently changes behaviour.
 *
 * `reference` below is the old tile-map logic, copied from `BoardState` as it
 * was on `main` at `fde5389`, run over a plain `{ [anchor]: instance }` map
 * that each test keeps in step with the real board.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

registerTokenTypes({
    fixture_shim_big: {
        id: 'fixture_shim_big', name: 'Fixture Shim Big', tokenType: 'resource',
        rarity: 'common', size: 2, uses: 50, requiresHero: false,
        config: { cycleTimeMs: 12000, inputs: [], outputs: [] }
    }
});

/** The pre-1.6a tile storage's answers, over a plain anchor map. */
function reference(tiles) {
    const getToken = (i) => (isTileIndex(i) ? tiles[i] || null : null);
    const getOccupyingToken = (i) => {
        if (!isTileIndex(i)) return null;
        const direct = getToken(i);
        if (direct) {
            const size = getTokenType(direct.typeId)?.size || 1;
            return { anchorIndex: i, instance: direct, isAnchor: true, footprint: tileFootprint(i, size) };
        }
        for (const key in tiles) {
            const inst = tiles[key];
            const size = getTokenType(inst.typeId)?.size || 1;
            if (size <= 1) continue;
            const footprint = tileFootprint(Number(key), size);
            if (footprint.includes(i)) return { anchorIndex: Number(key), instance: inst, isAnchor: false, footprint };
        }
        return null;
    };
    const occupiedTiles = () => Object.keys(tiles).map(Number).sort((a, b) => a - b).map(i => [i, tiles[i]]);
    const emptyTiles = () => {
        const out = [];
        for (let i = 0; i < TILE_COUNT; i++) if (!getOccupyingToken(i)) out.push(i);
        return out;
    };
    return { getToken, getOccupyingToken, occupiedTiles, emptyTiles };
}

const ids = (pairs) => pairs.map(([i, inst]) => [i, inst.id]);
const occShape = (occ) => occ && { anchorIndex: occ.anchorIndex, id: occ.instance.id, isAnchor: occ.isAnchor, footprint: occ.footprint };

/** Compare every tile answer the shim gives with the old storage's. */
function expectSameAsOldStorage(tiles) {
    const old = reference(tiles);
    for (let i = -1; i <= TILE_COUNT; i++) {
        expect(BoardState.getToken(i)?.id ?? null, `getToken(${i})`).toBe(old.getToken(i)?.id ?? null);
        expect(occShape(BoardState.getOccupyingToken(i)), `getOccupyingToken(${i})`).toEqual(occShape(old.getOccupyingToken(i)));
        expect(BoardState.hasToken(i), `hasToken(${i})`).toBe(old.getOccupyingToken(i) !== null);
    }
    expect(ids(BoardState.occupiedTiles())).toEqual(ids(old.occupiedTiles()));
    expect(BoardState.emptyTiles()).toEqual(old.emptyTiles());
}

const inst = (typeId) => BoardState.createTokenInstance(typeId, 10);

beforeEach(() => {
    GameState.initNew();
});

describe('⚠️ STOPGAP gridShim answers the tile API as the old tile storage did', () => {
    it('a mixed board of 1×1 and 2×2 Tokens, tile 0 included', () => {
        const tiles = {};
        const put = (i, instance) => { BoardState.setToken(i, instance); tiles[i] = instance; };
        put(0, inst('fixture_producer'));
        put(5, inst('fixture_manager'));
        put(8, inst('fixture_shim_big'));     // covers 8, 9, 14, 15
        put(27, inst('fixture_shim_big'));    // covers 27, 28, 33, 34
        put(35, inst('fixture_producer'));
        put(12, inst('fixture_buff_yield'));

        expectSameAsOldStorage(tiles);
    });

    it('stays the same through moves, clears and an overwrite', () => {
        const tiles = {};
        const put = (i, instance) => { BoardState.setToken(i, instance); if (instance) tiles[i] = instance; else delete tiles[i]; };
        const a = inst('fixture_producer');
        const big = inst('fixture_shim_big');
        put(0, a);
        put(20, big);
        put(3, inst('fixture_manager'));

        put(0, null);                         // lift a
        put(1, a);                            // and put it down beside
        put(20, null);
        put(21, big);                         // shove the 2×2 one tile right
        put(3, inst('fixture_producer'));     // last write wins on a tile

        expectSameAsOldStorage(tiles);
        expect(Object.keys(GameState.state.board.tokens)).toHaveLength(3);
    });

    it('a Token handed to the Tray is still on its tile until the tile is cleared', () => {
        // Placement asks who worked a tile between `addToTray` and clearing it.
        const a = inst('fixture_producer');
        BoardState.setToken(9, a);
        BoardState.addToTray(a);
        expect(BoardState.getToken(9)?.id).toBe(a.id);
        BoardState.setToken(9, null);
        expect(BoardState.getToken(9)).toBeNull();
        expect(BoardState.getTokenById(a.id)).toBeNull();
    });

    it('vacancies answer by tile, one per tile, at the owed Token’s point', () => {
        BoardState.setVacancy(3, 'fixture_producer');
        BoardState.setVacancy(8, 'fixture_shim_big');
        BoardState.setVacancy(3, 'fixture_manager');   // replaces, as the tile map did

        expect(BoardState.getVacancy(3)?.typeId).toBe('fixture_manager');
        expect(BoardState.getVacancy(8)?.typeId).toBe('fixture_shim_big');
        expect(BoardState.vacancies().map(([i, v]) => [i, v.typeId]))
            .toEqual([[3, 'fixture_manager'], [8, 'fixture_shim_big']]);
        expect(Object.keys(GameState.state.board.vacancies)).toHaveLength(2);

        BoardState.setToken(8, inst('fixture_producer'));   // anything arriving clears it
        expect(BoardState.getVacancy(8)).toBeNull();
    });
});
