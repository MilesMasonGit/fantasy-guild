import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardState from '../systems/board/BoardState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { GameState } from '../state/GameState.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn()
}));

const token = (typeId, uses = 100) => BoardState.createTokenInstance(typeId, uses);

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * these name two spots on the mat to drop onto.
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** The Token standing exactly on spot `i`. */
const tokenAt = (i) => BoardState.tokensAtPoint(C(i).x, C(i).y)[0] ?? null;

/** Drop a Token on spot `i`, through the real placement rules. */
const put = (i, instance) => Placement.placeTokenAt(instance, C(i));

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

        put(7, onBoard);
        expect(tokenAt(7).usesRemaining).toBe(40);

        const restockEvents = [];
        EventBus.subscribe('token_restocked', e => restockEvents.push(e));

        const res = put(7, incoming);
        expect(res.success).toBe(true);
        expect(res.restocked).toBe(true);
        expect(res.absorbed).toBe(true);
        expect(res.addedCharges).toBe(50);

        // On-board token now has 40 + 50 = 90 uses
        expect(tokenAt(7).usesRemaining).toBe(90);
        // Event was emitted
        expect(restockEvents).toHaveLength(1);
        expect(restockEvents[0]).toMatchObject({
            instanceId: onBoard.id,
            typeId: 'fixture_producer',
            addedCharges: 50,
            currentCharges: 90
        });

        // Nothing was pushed aside or sent to the Tray: the incoming Token was
        // absorbed whole, so only the one copy stands on the mat.
        expect(BoardState.tokens()).toHaveLength(1);
    });

    /**
     * ⭐ FP-87 (slice 1.6d-1): the leftover charges **stay on the mat**, nudged
     * beside the copy they just filled. They used to be pushed onto the next
     * tile along, which is the same idea without the tile.
     */
    it('fills the on-board Token to its cap and leaves the leftover beside it (FP-87)', () => {
        const onBoard = token('fixture_producer', 4980);
        const incoming = token('fixture_producer', 50);

        put(7, onBoard);

        const res = put(7, incoming);
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
    });

    it('refuses the leftover when it has nowhere at all to stand, so it flies back (FP-46)', () => {
        const onBoard = token('fixture_producer', 4970);
        const incoming = token('fixture_producer', 60);

        put(0, onBoard);
        // No room to nudge into anywhere. The Tray used to be the fallback;
        // slice 1.9 retired it, so the leftover goes back to where it came from.
        setMatTuning('nudgeReach', 0);

        const res = put(0, incoming);
        expect(res.success).toBe(false);
        expect(res.restocked).toBe(true);
        expect(res.addedCharges).toBe(30);

        expect(BoardState.getTokenById(onBoard.id).usesRemaining).toBe(5000);
        expect(incoming.usesRemaining).toBe(30);
        expect(BoardState.getTokenById(incoming.id)).toBeNull();
    });

    /**
     * ⭐ With no charges to give, there is nothing to restock — and since slice
     * 1.6d-1 nothing is displaced either. The newcomer moves itself clear and
     * the Token already down does not budge.
     */
    it('nudges clear of a copy that is already full, moving nobody', () => {
        const onBoard = token('fixture_producer', 5000);
        const incoming = token('fixture_producer', 5000);

        put(7, onBoard);
        const where = { x: onBoard.x, y: onBoard.y };

        const res = put(7, incoming);
        expect(res.success).toBe(true);
        expect(res.restocked).toBeUndefined();
        expect({ x: BoardState.getTokenById(onBoard.id).x, y: BoardState.getTokenById(onBoard.id).y }).toEqual(where);
        expect(BoardState.getTokenById(incoming.id)).not.toBeNull();
    });

    it('nudges clear of an unlimited-use Token too (uses == null)', () => {
        const onBoard = token('fixture_buff_unique', null);
        const incoming = token('fixture_buff_unique', null);

        put(7, onBoard);
        const where = { x: onBoard.x, y: onBoard.y };

        const res = put(7, incoming);
        expect(res.success).toBe(true);
        expect({ x: BoardState.getTokenById(onBoard.id).x, y: BoardState.getTokenById(onBoard.id).y }).toEqual(where);
    });
});
