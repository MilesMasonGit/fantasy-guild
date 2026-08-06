import { describe, it, expect } from 'vitest';
import { neighboursOf, areAdjacent, dependentsOf } from '../systems/board/adjacency.js';
import {
    BOARD_SIZE, TILE_COUNT, GUILD_HALL_TILE, rowOf, colOf
} from '../ui/components/board/boardConstants.js';

/**
 * Adjacency — D-81's "one rule everywhere: the 8 surrounding tiles".
 *
 * Tested exhaustively rather than by sample, for two reasons:
 *
 *  1. **Everything spatial depends on it.** Context recipes (D-18), buff Tokens
 *     (D-119), the Guild Hall aura (D-121) and Manager reach (D-140) all call
 *     this one function. An off-by-one here is an off-by-one in every one of
 *     them, and it would present as a content bug rather than an engine bug.
 *  2. **It is cheap.** 49 tiles is small enough to check every neighbourhood
 *     against an independently-derived expectation.
 *
 * ⚠️ Tile 0 is a valid index and is falsy. Several tests below exist purely to
 * stop a truthiness check creeping in.
 */

/** Neighbours derived independently of the implementation, for cross-checking. */
function expectedNeighbours(index) {
    const r = Math.floor(index / BOARD_SIZE);
    const c = index % BOARD_SIZE;
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
            out.push(nr * BOARD_SIZE + nc);
        }
    }
    return out;
}

const CORNERS = [0, BOARD_SIZE - 1, TILE_COUNT - BOARD_SIZE, TILE_COUNT - 1];

describe('neighboursOf — exhaustive', () => {
    it('matches an independently-derived neighbourhood for all 49 tiles', () => {
        for (let i = 0; i < TILE_COUNT; i++) {
            expect([...neighboursOf(i)].sort((a, b) => a - b), `tile ${i}`)
                .toEqual(expectedNeighbours(i).sort((a, b) => a - b));
        }
    });

    it('gives every tile 3, 5 or 8 neighbours and nothing else', () => {
        const counts = new Set();
        for (let i = 0; i < TILE_COUNT; i++) counts.add(neighboursOf(i).length);
        expect([...counts].sort()).toEqual([3, 5, 8]);
    });

    it('never includes the tile itself — a Token does not modify what it IS', () => {
        for (let i = 0; i < TILE_COUNT; i++) {
            expect(neighboursOf(i), `tile ${i}`).not.toContain(i);
        }
    });

    it('never returns an out-of-range index', () => {
        for (let i = 0; i < TILE_COUNT; i++) {
            for (const n of neighboursOf(i)) {
                expect(n, `neighbour of ${i}`).toBeGreaterThanOrEqual(0);
                expect(n, `neighbour of ${i}`).toBeLessThan(TILE_COUNT);
            }
        }
    });

    it('never wraps around a row edge', () => {
        // The classic grid bug: tile 6 (end of row 0) must not neighbour tile 7
        // (start of row 1). Column distance is the tell.
        for (let i = 0; i < TILE_COUNT; i++) {
            for (const n of neighboursOf(i)) {
                expect(Math.abs(colOf(n) - colOf(i)), `${i} → ${n} wrapped`).toBeLessThanOrEqual(1);
                expect(Math.abs(rowOf(n) - rowOf(i)), `${i} → ${n} wrapped`).toBeLessThanOrEqual(1);
            }
        }
    });
});

describe('Edges and corners (D-61)', () => {
    it('all four corners have exactly 3 neighbours', () => {
        for (const c of CORNERS) {
            expect(neighboursOf(c).length, `corner ${c}`).toBe(3);
        }
    });

    it('tile 0 — the falsy corner — resolves normally', () => {
        // If anything guards adjacency with truthiness, this is where it breaks.
        expect(neighboursOf(0)).toEqual([1, 7, 8]);
        expect(neighboursOf(0).length).toBe(3);
    });

    it('the far corner resolves normally', () => {
        expect([...neighboursOf(48)].sort((a, b) => a - b)).toEqual([40, 41, 47]);
    });

    it('a non-corner edge tile has exactly 5 neighbours', () => {
        expect(neighboursOf(3).length).toBe(5);    // top edge
        expect(neighboursOf(21).length).toBe(5);   // left edge
        expect(neighboursOf(27).length).toBe(5);   // right edge
        expect(neighboursOf(45).length).toBe(5);   // bottom edge
    });

    it('an interior tile has exactly 8 neighbours', () => {
        expect(neighboursOf(8).length).toBe(8);
        expect(neighboursOf(24).length).toBe(8);
    });
});

describe('The Guild Hall neighbourhood (D-121)', () => {
    it('has 8 neighbours — the board’s most valuable real estate', () => {
        // Aura upgrades reach exactly these tiles, which is what makes the ring
        // around the centre worth competing for.
        expect(neighboursOf(GUILD_HALL_TILE).length).toBe(8);
    });

    it('is the true centre, equidistant from every edge', () => {
        expect(rowOf(GUILD_HALL_TILE)).toBe(Math.floor(BOARD_SIZE / 2));
        expect(colOf(GUILD_HALL_TILE)).toBe(Math.floor(BOARD_SIZE / 2));
    });

    it('names the 8 tiles an Aura upgrade would cover', () => {
        expect([...neighboursOf(GUILD_HALL_TILE)].sort((a, b) => a - b))
            .toEqual([16, 17, 18, 23, 25, 30, 31, 32]);
    });
});

describe('Symmetry and guards', () => {
    it('adjacency is symmetric everywhere', () => {
        for (let i = 0; i < TILE_COUNT; i++) {
            for (const n of neighboursOf(i)) {
                expect(neighboursOf(n), `${n} should see ${i}`).toContain(i);
            }
        }
    });

    it('areAdjacent agrees with neighboursOf', () => {
        for (let i = 0; i < TILE_COUNT; i++) {
            for (let j = 0; j < TILE_COUNT; j++) {
                expect(areAdjacent(i, j), `${i}/${j}`).toBe(neighboursOf(i).includes(j));
            }
        }
    });

    it('a tile is never adjacent to itself', () => {
        for (let i = 0; i < TILE_COUNT; i++) expect(areAdjacent(i, i)).toBe(false);
    });

    it('returns an empty list for out-of-range indices rather than throwing', () => {
        expect(neighboursOf(-1)).toEqual([]);
        expect(neighboursOf(TILE_COUNT)).toEqual([]);
        expect(neighboursOf(null)).toEqual([]);
        expect(neighboursOf(undefined)).toEqual([]);
        expect(neighboursOf(1.5)).toEqual([]);
        expect(areAdjacent(0, null)).toBe(false);
    });

    it('the returned list is frozen, so a caller cannot corrupt the table', () => {
        const list = neighboursOf(24);
        expect(Object.isFrozen(list)).toBe(true);
        expect(() => list.push(99)).toThrow();
        expect(neighboursOf(24).length).toBe(8);   // still intact for everyone else
    });

    it('dependentsOf is the same neighbourhood, named for wear (D-126/D-157)', () => {
        // One Tool Rack serving three Forges wears three times as fast, so the
        // "who wears me down" list has to be exactly "who am I next to".
        for (let i = 0; i < TILE_COUNT; i++) {
            expect(dependentsOf(i)).toEqual(neighboursOf(i));
        }
    });
});
