import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardState from '../systems/board/BoardState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { GameState } from '../state/GameState.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn()
}));

const token = (typeId, uses = 100) => BoardState.createTokenInstance(typeId, uses);

describe('Token Restocking on Same-Type Drop', () => {
    beforeEach(() => {
        GameState.initNew();
    });

    it('tops up a partial token and absorbs incoming token completely when no excess charges remain', () => {
        // fixture_producer has default uses = 100
        const onBoard = token('fixture_producer', 40);
        const incoming = token('fixture_producer', 50);

        Placement.placeToken(8, onBoard);
        expect(BoardState.getToken(8).usesRemaining).toBe(40);

        const restockEvents = [];
        EventBus.subscribe('token_restocked', e => restockEvents.push(e));

        const res = Placement.placeToken(8, incoming);
        expect(res.success).toBe(true);
        expect(res.restocked).toBe(true);
        expect(res.absorbed).toBe(true);
        expect(res.addedCharges).toBe(50);

        // On-board token now has 40 + 50 = 90 uses
        expect(BoardState.getToken(8).usesRemaining).toBe(90);
        // Event was emitted
        expect(restockEvents).toHaveLength(1);
        expect(restockEvents[0]).toMatchObject({
            tile: 8,
            typeId: 'fixture_producer',
            addedCharges: 50,
            currentCharges: 90
        });

        // No token was pushed or sent to Tray
        expect(BoardState.getToken(1)).toBeNull();
        expect(BoardState.getTray()).toHaveLength(0);
    });

    it('fills on-board token to max cap (5000) and pushes leftover token to adjacent cell', () => {
        // fixture_producer has default uses = 5000
        // on-board has 4980 uses, incoming has 50 uses (total 5030 -> 5000 on-board, 30 leftover)
        const onBoard = token('fixture_producer', 4980);
        const incoming = token('fixture_producer', 50);

        Placement.placeToken(8, onBoard);

        const pushedEvents = [];
        EventBus.subscribe(BOARD_EVENTS.TILE_PUSHED, e => pushedEvents.push(e));

        const res = Placement.placeToken(8, incoming);
        expect(res.success).toBe(true);
        expect(res.restocked).toBe(true);
        expect(res.pushedLeftover).toBe(true);
        expect(res.addedCharges).toBe(20);

        // On-board token capped at 5000
        expect(BoardState.getToken(8).usesRemaining).toBe(5000);

        // Leftover token pushed to primary adjacent cell (tile 1) with 30 charges
        expect(BoardState.getToken(1)?.id).toBe(incoming.id);
        expect(BoardState.getToken(1)?.usesRemaining).toBe(30);

        // Slide animation event emitted
        expect(pushedEvents.some(e => e.fromTile === 8 && e.toTile === 1)).toBe(true);
    });

    it('fills on-board token and sends leftover token to Tray when all adjacent cells are blocked', () => {
        // Tile 0 (corner): block tiles 1 and 7
        Placement.placeToken(1, token('fixture_blocker'));
        Placement.placeToken(7, token('fixture_blocker'));

        const onBoard = token('fixture_producer', 4970);
        const incoming = token('fixture_producer', 60);

        Placement.placeToken(0, onBoard);

        const collectedEvents = [];
        EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, e => collectedEvents.push(e));

        const res = Placement.placeToken(0, incoming);
        expect(res.success).toBe(true);
        expect(res.restocked).toBe(true);
        expect(res.trayLeftover).toBe(true);
        expect(res.addedCharges).toBe(30);

        // On-board token capped at 5000
        expect(BoardState.getToken(0).usesRemaining).toBe(5000);

        // Leftover token is in Tray with 30 charges
        const tray = BoardState.getTray();
        expect(tray.some(t => t.id === incoming.id && t.usesRemaining === 30)).toBe(true);

        // Particle fly event published for Tray
        expect(collectedEvents.some(e => e.kind === 'token' && e.destination === 'tray' && e.instanceId === incoming.id)).toBe(true);
    });

    it('performs standard displacement when the on-board token is already at max charges', () => {
        const onBoard = token('fixture_producer', 5000);
        const incoming = token('fixture_producer', 5000);

        Placement.placeToken(8, onBoard);

        const res = Placement.placeToken(8, incoming);
        expect(res.success).toBe(true);
        // Regular displacement pushed onBoard to tile 1, placed incoming on tile 8
        expect(BoardState.getToken(8).id).toBe(incoming.id);
        expect(BoardState.getToken(1).id).toBe(onBoard.id);
    });

    it('performs standard displacement when tokens have unlimited uses (uses == null)', () => {
        const onBoard = token('fixture_buff_unique', null);
        const incoming = token('fixture_buff_unique', null);

        Placement.placeToken(8, onBoard);

        const res = Placement.placeToken(8, incoming);
        expect(res.success).toBe(true);
        // Displaced to tile 1
        expect(BoardState.getToken(8).id).toBe(incoming.id);
        expect(BoardState.getToken(1).id).toBe(onBoard.id);
    });
});
