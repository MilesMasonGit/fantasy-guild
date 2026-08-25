import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { TILE_STEP_PX, BOARD_SIZE } from '../config/boardGeometry.js';
import { placeTokenFromDrag } from '../ui/components/board/placeTokenFromDrag.js';
import { occupiedTileMap } from '../ui/components/board/TrayMiniBoard.jsx';

/**
 * The playmat and the Tray's mini-board are two windows onto one board, and they
 * used to answer the same two questions differently (CR2-160):
 *
 *  1. **Where can a Token be dragged from?** The board knew six origins; the
 *     mini-board knew four, so a Map lifted off the playmat and a bare
 *     `typeId` both fell through every branch and did nothing.
 *  2. **Which tiles are full?** The mini-board read `state.board.tiles` keys,
 *     which are **anchors only**, so the three cells under a 2×2 Token's body
 *     rendered as free.
 *
 * These tests pin the shared helper both surfaces now call, and the footprint
 * answer the mini-board now asks the engine for.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

beforeEach(() => {
    GameState.initNew();
    SpriteLayer.init();
    GameState.state.board.tiles = {};
    GameState.state.board.maps = [];
    GameState.state.board.tray = [];
    GameState.state.board.tokenBank = {};
    GameState.state.quests.completedTutorials = ['tutorial_5'];
    registerTokenTypes({
        fixture_map: {
            id: 'fixture_map', name: 'Fixture Map', tokenType: 'map',
            mapId: 'fixture_map_content'
        },
        fixture_big: {
            id: 'fixture_big', name: 'Fixture Big', tokenType: 'resource',
            size: 2, uses: 50, requiresHero: false,
            config: { cycleTimeMs: 12000, inputs: [], outputs: [] }
        }
    });
});

const instance = (typeId, uses = null) => BoardState.createTokenInstance(typeId, uses);

// ---------------------------------------------------------------------------
// The occupancy lie
// ---------------------------------------------------------------------------

describe('occupiedTileMap — the mini-board must not call a covered tile empty', () => {
    it('reports all four cells of a 2×2 Token, not just its anchor', () => {
        // Anchor at row 1, col 1 → tiles 8, 9, 15, 16 on a 7×7 board.
        const anchor = BOARD_SIZE + 1;
        BoardState.setToken(anchor, instance('fixture_big', 50));

        // This is the shape the old code read from, and it is the whole problem:
        // state stores the Token ONCE, at its anchor.
        expect(Object.keys(GameState.state.board.tiles)).toEqual([String(anchor)]);

        const occupied = occupiedTileMap();
        expect(occupied[anchor]).toBe(true);
        expect(occupied[anchor + 1]).toBe(true);
        expect(occupied[anchor + BOARD_SIZE]).toBe(true);
        expect(occupied[anchor + BOARD_SIZE + 1]).toBe(true);
    });

    it('still reports a plain 1×1 Token, and nothing around it', () => {
        BoardState.setToken(3, instance('fixture_producer', 100));
        const occupied = occupiedTileMap();
        expect(occupied[3]).toBe(true);
        expect(occupied[4]).toBeUndefined();
        expect(occupied[2]).toBeUndefined();
    });

    it('reports nothing on an empty board', () => {
        expect(occupiedTileMap()).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// The six drop routes — all of them, from either surface
// ---------------------------------------------------------------------------

describe('placeTokenFromDrag — every origin the board accepts', () => {
    it('route 1: a Map already on the playmat is repositioned, not lost', () => {
        const map = BoardState.addBoardMap('fixture_map', 0, 0, 1);

        // Tile 9 is row 1, col 2.
        placeTokenFromDrag(9, { typeId: 'fixture_map', from: { boardMapId: map.id } });

        const maps = GameState.state.board.maps;
        expect(maps).toHaveLength(1);
        expect(maps[0].id).toBe(map.id);
        expect(maps[0].x).toBe(2 * TILE_STEP_PX);
        expect(maps[0].y).toBe(1 * TILE_STEP_PX);
    });

    it('route 2: a Token already on a tile moves to the new tile', () => {
        BoardState.setToken(0, instance('fixture_producer', 100));
        placeTokenFromDrag(5, { typeId: 'fixture_producer', from: { tile: 0 } });

        expect(BoardState.getToken(0)).toBeNull();
        expect(BoardState.getToken(5)?.typeId).toBe('fixture_producer');
    });

    it('route 3: a loose loot Token on the floor is picked up onto the tile', () => {
        const sprite = SpriteLayer.addSprite('token', 'fixture_producer', 1, null, 100);
        placeTokenFromDrag(6, { typeId: 'fixture_producer', from: { spriteId: sprite.id } });

        expect(BoardState.getToken(6)?.typeId).toBe('fixture_producer');
        expect(SpriteLayer.getSprites().find(s => s.id === sprite.id)).toBeUndefined();
    });

    it('route 4: a Token on the Tray leaves the Tray for the tile', () => {
        BoardState.addToTray(instance('fixture_producer', 100));
        placeTokenFromDrag(7, { typeId: 'fixture_producer', from: { traySlot: 0 } });

        expect(BoardState.getToken(7)?.typeId).toBe('fixture_producer');
        expect(BoardState.getTray()).toHaveLength(0);
    });

    it('route 5: a Vault row is withdrawn onto the tile', () => {
        TokenBank.deposit(instance('fixture_producer', 100));
        placeTokenFromDrag(8, { typeId: 'fixture_producer', from: { vaultTypeId: 'fixture_producer' } });

        expect(BoardState.getToken(8)?.typeId).toBe('fixture_producer');
        expect(GameState.state.board.tokenBank.fixture_producer || []).toHaveLength(0);
    });

    it('route 6: a bare typeId with no origin creates a Token on the tile', () => {
        placeTokenFromDrag(10, { typeId: 'fixture_producer', usesRemaining: 42 });

        expect(BoardState.getToken(10)?.typeId).toBe('fixture_producer');
        expect(BoardState.getToken(10)?.usesRemaining).toBe(42);
    });

    it('a Map dragged off the Tray lands loose on the playmat, not on a tile', () => {
        BoardState.addToTray(instance('fixture_map', 1));
        placeTokenFromDrag(0, { typeId: 'fixture_map', from: { traySlot: 0 } });

        expect(BoardState.getToken(0)).toBeNull();
        expect(GameState.state.board.maps).toHaveLength(1);
        expect(GameState.state.board.maps[0].typeId).toBe('fixture_map');
    });

    it('does nothing at all when handed no payload', () => {
        expect(() => placeTokenFromDrag(0, null)).not.toThrow();
        expect(GameState.state.board.tiles).toEqual({});
    });
});

// ---------------------------------------------------------------------------
// 2×2 anchoring with no playmat pixels to measure against
// ---------------------------------------------------------------------------

describe('placeTokenFromDrag — a 2×2 Token dropped without a pointer', () => {
    it('clamps to an anchor whose footprint still fits on the board', () => {
        // Tile 48 is the bottom-right corner; a 2×2 anchored there would hang
        // off two edges. The last anchor that fits is row 5, col 5 → tile 40.
        placeTokenFromDrag(48, { typeId: 'fixture_big', usesRemaining: 50 });

        const expectedAnchor = 5 * BOARD_SIZE + 5;
        expect(BoardState.getToken(expectedAnchor)?.typeId).toBe('fixture_big');

        // And the mini-board now sees the whole block, corner included.
        const occupied = occupiedTileMap();
        expect(occupied[expectedAnchor]).toBe(true);
        expect(occupied[48]).toBe(true);
    });
});
