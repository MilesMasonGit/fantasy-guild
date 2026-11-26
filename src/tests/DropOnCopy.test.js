import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardState from '../systems/board/BoardState.js';
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

/** Drop a Token on spot `i`, through the real placement rules. */
const put = (i, instance) => Placement.placeTokenAt(instance, C(i));

describe('a Token dropped on a copy of itself lands beside it: Tokens never merge', () => {
    beforeEach(() => {
        GameState.initNew();
        resetMatTuning();
    });

    afterEach(() => resetMatTuning());

    it('⭐ a partly used copy: the newcomer lands beside it, each keeping its own charges', () => {
        const onBoard = token('fixture_producer', 40);
        const incoming = token('fixture_producer', 50);
        put(7, onBoard);

        const res = put(7, incoming);

        expect(res).toMatchObject({ success: true, nudged: true });
        expect(BoardState.tokens()).toHaveLength(2);
        expect(BoardState.getTokenById(onBoard.id)).toMatchObject({ ...C(7), usesRemaining: 40 });
        const beside = BoardState.getTokenById(incoming.id);
        expect(beside.usesRemaining).toBe(50);
        // Beside: edges touching (128 u), give or take the nudge search's ring step.
        expect(Math.hypot(beside.x - onBoard.x, beside.y - onBoard.y)).toBeLessThan(136);
    });

    it('with no room beside it the drop flies back whole, and the copy keeps what it had', () => {
        const onBoard = token('fixture_producer', 4970);
        const incoming = token('fixture_producer', 60);
        put(0, onBoard);
        setMatTuning('nudgeReach', 0);

        const res = put(0, incoming);

        expect(res).toMatchObject({ success: false, full: true });
        expect(BoardState.getTokenById(onBoard.id).usesRemaining).toBe(4970);
        expect(incoming.usesRemaining).toBe(60);
        expect(BoardState.getTokenById(incoming.id)).toBeNull();
    });

    /** Nothing is displaced: the newcomer moves itself clear and the Token already down does not budge. */
    it('nudges clear of a copy that is already full, moving nobody', () => {
        const onBoard = token('fixture_producer', 5000);
        const incoming = token('fixture_producer', 5000);

        put(7, onBoard);
        const where = { x: onBoard.x, y: onBoard.y };

        const res = put(7, incoming);
        expect(res.success).toBe(true);
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
