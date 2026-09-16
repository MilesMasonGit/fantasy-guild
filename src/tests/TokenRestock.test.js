import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardState from '../systems/board/BoardState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { GameState } from '../state/GameState.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn()
}));

const token = (typeId, uses = 100) => BoardState.createTokenInstance(typeId, uses);

describe('Token Restocking on Same-Type Drop', () => {
    beforeEach(() => {
        GameState.initNew();
        resetMatTuning();
    });

    afterEach(() => resetMatTuning());

    it('tops up a partial token and absorbs incoming token completely when no excess charges remain', () => {
        // fixture_producer has default uses = 100
        const onBoard = token('fixture_producer', 40);
        const incoming = token('fixture_producer', 50);

        Placement.placeToken(7, onBoard);
        expect(BoardState.getToken(7).usesRemaining).toBe(40);

        const restockEvents = [];
        EventBus.subscribe('token_restocked', e => restockEvents.push(e));

        const res = Placement.placeToken(7, incoming);
        expect(res.success).toBe(true);
        expect(res.restocked).toBe(true);
        expect(res.absorbed).toBe(true);
        expect(res.addedCharges).toBe(50);

        // On-board token now has 40 + 50 = 90 uses
        expect(BoardState.getToken(7).usesRemaining).toBe(90);
        // Event was emitted
        expect(restockEvents).toHaveLength(1);
        expect(restockEvents[0]).toMatchObject({
            instanceId: onBoard.id,
            typeId: 'fixture_producer',
            addedCharges: 50,
            currentCharges: 90
        });

        // No token was pushed or sent to Tray
        expect(BoardState.getToken(1)).toBeNull();
        expect(BoardState.getTray()).toHaveLength(0);
    });

    /**
     * ⭐ FP-87 (slice 1.6d-1): the leftover charges **stay on the mat**, nudged
     * beside the copy they just filled. They used to be pushed onto the next
     * tile along, which is the same idea without the tile.
     */
    it('fills the on-board Token to its cap and leaves the leftover beside it (FP-87)', () => {
        const onBoard = token('fixture_producer', 4980);
        const incoming = token('fixture_producer', 50);

        Placement.placeToken(7, onBoard);

        const res = Placement.placeToken(7, incoming);
        expect(res.success).toBe(true);
        expect(res.restocked).toBe(true);
        expect(res.nudgedLeftover).toBe(true);
        expect(res.addedCharges).toBe(20);

        expect(BoardState.getTokenById(onBoard.id).usesRemaining).toBe(5000);

        // The leftover is on the mat, right next to the copy — not in the Tray.
        const leftover = BoardState.getTokenById(incoming.id);
        expect(leftover.usesRemaining).toBe(30);
        const apart = Math.hypot(leftover.x - onBoard.x, leftover.y - onBoard.y);
        expect(apart).toBeGreaterThanOrEqual(61.2 - 1e-6);
        expect(apart).toBeLessThan(120);
        expect(BoardState.getTray()).toHaveLength(0);
    });

    it('sends the leftover to the Tray only when it has nowhere at all to stand', () => {
        const onBoard = token('fixture_producer', 4970);
        const incoming = token('fixture_producer', 60);

        Placement.placeToken(0, onBoard);
        // No room to nudge into anywhere: the Tray is the fallback, as before.
        setMatTuning('nudgeReach', 0);

        const collectedEvents = [];
        EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, e => collectedEvents.push(e));

        const res = Placement.placeToken(0, incoming);
        expect(res.success).toBe(true);
        expect(res.restocked).toBe(true);
        expect(res.trayLeftover).toBe(true);
        expect(res.addedCharges).toBe(30);

        expect(BoardState.getTokenById(onBoard.id).usesRemaining).toBe(5000);
        expect(BoardState.getTray().some(t => t.id === incoming.id && t.usesRemaining === 30)).toBe(true);
        expect(collectedEvents.some(e => e.kind === 'token' && e.destination === 'tray' && e.instanceId === incoming.id)).toBe(true);
    });

    /**
     * ⭐ With no charges to give, there is nothing to restock — and since slice
     * 1.6d-1 nothing is displaced either. The newcomer moves itself clear and
     * the Token already down does not budge.
     */
    it('nudges clear of a copy that is already full, moving nobody', () => {
        const onBoard = token('fixture_producer', 5000);
        const incoming = token('fixture_producer', 5000);

        Placement.placeToken(7, onBoard);
        const where = { x: onBoard.x, y: onBoard.y };

        const res = Placement.placeToken(7, incoming);
        expect(res.success).toBe(true);
        expect(res.restocked).toBeUndefined();
        expect({ x: BoardState.getTokenById(onBoard.id).x, y: BoardState.getTokenById(onBoard.id).y }).toEqual(where);
        expect(BoardState.getTokenById(incoming.id)).not.toBeNull();
    });

    it('nudges clear of an unlimited-use Token too (uses == null)', () => {
        const onBoard = token('fixture_buff_unique', null);
        const incoming = token('fixture_buff_unique', null);

        Placement.placeToken(7, onBoard);
        const where = { x: onBoard.x, y: onBoard.y };

        const res = Placement.placeToken(7, incoming);
        expect(res.success).toBe(true);
        expect({ x: BoardState.getTokenById(onBoard.id).x, y: BoardState.getTokenById(onBoard.id).y }).toEqual(where);
    });
});
