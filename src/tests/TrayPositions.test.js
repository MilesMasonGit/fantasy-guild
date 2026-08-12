import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';

/**
 * Tray positions — the free-surface Tray (D-223, D-226, D-227).
 *
 * These pin the three properties the design leans on, all of which are easy to
 * break without noticing:
 *
 * 1. **Position lives on the instance, not the slot index.** `takeFromTray()`
 *    splices, so anything keyed to an index would make the arrangement jump
 *    every time a Token was placed.
 * 2. **Positions are fractions**, so a Tray that changes height never leaves a
 *    Token off-surface.
 * 3. **Arrivals seek open space**, so a Tray only overlaps once it is genuinely
 *    crowded.
 */

const fresh = () => {
    GameState.initNew();
    GameState.state.board = { tiles: {}, tokenBank: {}, tray: [], heroTiles: {}, vacancies: {} };
};

const add = (typeId, uses = 100) =>
    BoardState.addToTray(BoardState.createTokenInstance(typeId, uses));

describe('Tray positions', () => {
    beforeEach(fresh);

    it('gives every arrival a position inside the surface', () => {
        add('token_forest');
        add('token_ore_vein');

        for (const entry of BoardState.getTray()) {
            expect(entry.x).toBeGreaterThanOrEqual(0);
            expect(entry.x).toBeLessThanOrEqual(1);
            expect(entry.y).toBeGreaterThanOrEqual(0);
            expect(entry.y).toBeLessThanOrEqual(1);
        }
    });

    it('honours an explicit position — a player drop lands where it was dropped', () => {
        BoardState.addToTray(
            BoardState.createTokenInstance('token_forest', 100),
            undefined,
            { x: 0.25, y: 0.75 }
        );

        const [entry] = BoardState.getTray();
        expect(entry.x).toBe(0.25);
        expect(entry.y).toBe(0.75);
    });

    it('clamps an out-of-range position rather than letting it off the surface', () => {
        BoardState.addToTray(
            BoardState.createTokenInstance('token_forest', 100),
            undefined,
            { x: -3, y: 42 }
        );

        const [entry] = BoardState.getTray();
        expect(entry.x).toBe(0);
        expect(entry.y).toBe(1);
    });

    /**
     * The one that matters most. Removing a Token splices the array, so if
     * position were derived from the slot index every later Token would move.
     */
    it('leaves the other Tokens exactly where they were when one is taken out', () => {
        add('token_forest');
        add('token_ore_vein');
        add('token_still');

        const before = BoardState.getTray().map(e => ({ typeId: e.typeId, x: e.x, y: e.y }));
        BoardState.takeFromTray(0);
        const after = BoardState.getTray();

        expect(after).toHaveLength(2);
        expect(after[0]).toMatchObject({ typeId: before[1].typeId, x: before[1].x, y: before[1].y });
        expect(after[1]).toMatchObject({ typeId: before[2].typeId, x: before[2].x, y: before[2].y });
    });

    it('repositions a Token in place, clamped', () => {
        add('token_forest');

        expect(BoardState.setTrayPosition(0, 0.4, 0.6)).toBe(true);
        expect(BoardState.getTray()[0]).toMatchObject({ x: 0.4, y: 0.6 });

        BoardState.setTrayPosition(0, 5, -5);
        expect(BoardState.getTray()[0]).toMatchObject({ x: 1, y: 0 });

        expect(BoardState.setTrayPosition(9, 0.5, 0.5)).toBe(false);
    });

    /**
     * The whole reason this needs no save-schema break: a Token saved before
     * positions existed is scattered on read rather than refused.
     */
    it('backfills a Token that loaded without a position', () => {
        GameState.state.board.tray = [
            { typeId: 'token_forest', usesRemaining: 500, cycleElapsedMs: 0 }
        ];

        const [entry] = BoardState.getTray();
        expect(entry.x).toBeGreaterThanOrEqual(0);
        expect(entry.x).toBeLessThanOrEqual(1);
        expect(entry.y).toBeGreaterThanOrEqual(0);
        expect(entry.y).toBeLessThanOrEqual(1);
        // and the Token itself is untouched
        expect(entry.usesRemaining).toBe(500);
    });

    it('does not move a Token that already has a position', () => {
        GameState.state.board.tray = [
            { typeId: 'token_forest', usesRemaining: 500, cycleElapsedMs: 0, x: 0.11, y: 0.22 }
        ];

        expect(BoardState.getTray()[0]).toMatchObject({ x: 0.11, y: 0.22 });
        // reading twice must be stable — backfill runs on every read
        expect(BoardState.getTray()[0]).toMatchObject({ x: 0.11, y: 0.22 });
    });

    it('still refuses to exceed capacity', () => {
        for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
            expect(add('token_forest')).toBe(true);
        }
        expect(add('token_forest')).toBe(false);
        expect(BoardState.getTray()).toHaveLength(BoardState.TRAY_CAPACITY);
    });
});

describe('Tray scatter seeks open space (D-227)', () => {
    beforeEach(fresh);

    /**
     * The behavioural claim, measured rather than asserted: space-seeking must
     * beat uniform random on how far apart a Tray full of arrivals ends up.
     * Uniform random is what "landed where it landed" naively means, and it
     * reads as broken because things bury each other beside empty space.
     */
    it('spreads arrivals further apart than uniform random does', () => {
        const nearestNeighbourMean = (points) => {
            let total = 0;
            for (const a of points) {
                let nearest = Infinity;
                for (const b of points) {
                    if (a === b) continue;
                    const gap = Math.hypot(a.x - b.x, a.y - b.y);
                    if (gap < nearest) nearest = gap;
                }
                total += nearest;
            }
            return total / points.length;
        };

        const N = 12;

        const seeking = [];
        for (let i = 0; i < N; i++) seeking.push(BoardState.scatterIntoTray(seeking));

        const uniform = [];
        for (let i = 0; i < N; i++) uniform.push({ x: Math.random(), y: Math.random() });

        expect(nearestNeighbourMean(seeking)).toBeGreaterThan(nearestNeighbourMean(uniform));
    });

    it('avoids the occupied half of the surface while it is free elsewhere', () => {
        // Crowd the top: every existing Token sits in the upper strip.
        const crowded = [];
        for (let i = 0; i < 8; i++) crowded.push({ x: i / 8, y: 0.05 });

        // Most of ten arrivals should choose the empty lower area.
        let below = 0;
        for (let i = 0; i < 10; i++) {
            if (BoardState.scatterIntoTray(crowded).y > 0.5) below++;
        }
        expect(below).toBeGreaterThanOrEqual(8);
    });

    it('ignores entries that have no position yet', () => {
        const at = BoardState.scatterIntoTray([{ typeId: 'token_forest' }, null, undefined]);
        expect(at.x).toBeGreaterThanOrEqual(0);
        expect(at.y).toBeLessThanOrEqual(1);
    });
});
