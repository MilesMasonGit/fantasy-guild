import { describe, it, expect } from 'vitest';
import { DIRECTIONS, cellId, distance, ringOf, neighbours, ringCells, cellsWithin, sideOf, SIDES } from '../systems/world/hex.js';

/**
 * The world map's grid: rings of 6 n cells around the Hall's cell, each ring walked side by side so
 * a side across rings 1 to 3 is a wedge of 1 + 2 + 3 cells.
 */
describe('World hex grid', () => {
    it('each direction is the sum of the two beside it, so walking a side runs from one corner to the next', () => {
        for (let k = 0; k < SIDES; k++) {
            const before = DIRECTIONS[(k + SIDES - 1) % SIDES];
            const after = DIRECTIONS[(k + 1) % SIDES];
            expect({ q: before.q + after.q, r: before.r + after.r }).toEqual({ q: DIRECTIONS[k].q, r: DIRECTIONS[k].r });
        }
    });

    it('ring n holds 6 n distinct cells, all n steps out, n to a side', () => {
        expect(ringCells(0)).toEqual([{ q: 0, r: 0, ring: 0, side: null, step: 0, index: 0 }]);
        for (let n = 1; n <= 8; n++) {
            const ring = ringCells(n);
            expect(ring).toHaveLength(6 * n);
            expect(new Set(ring.map(c => cellId(c.q, c.r))).size).toBe(6 * n);
            for (const c of ring) expect(ringOf(c)).toBe(n);
            for (let side = 0; side < SIDES; side++) expect(ring.filter(c => c.side === side)).toHaveLength(n);
            ring.forEach((c, i) => expect(c.index).toBe(i));
        }
    });

    it('a ring walks cell to neighbouring cell, and closes on itself', () => {
        for (let n = 1; n <= 6; n++) {
            const ring = ringCells(n);
            for (let i = 0; i < ring.length; i++) expect(distance(ring[i], ring[(i + 1) % ring.length])).toBe(1);
        }
    });

    it('a side across rings 1 to 3 is the 6-cell wedge the owner asked for: equal, joined, rising outward', () => {
        const within = cellsWithin(3).filter(c => c.ring > 0);
        for (let side = 0; side < SIDES; side++) {
            const wedge = within.filter(c => c.side === side);
            expect(wedge.map(c => c.ring)).toEqual([1, 2, 2, 3, 3, 3]);
            // Joined: every cell past ring 1 touches a wedge cell one ring in.
            for (const c of wedge.filter(w => w.ring > 1)) {
                expect(wedge.some(o => o.ring === c.ring - 1 && distance(o, c) === 1)).toBe(true);
            }
        }
    });

    it('sideOf reads a cell\'s side from its coordinates alone, past the generated rings too', () => {
        for (const c of cellsWithin(9)) expect(sideOf(c)).toBe(c.side);
    });

    it('six neighbours, each one step away', () => {
        const around = neighbours({ q: 2, r: -1 });
        expect(around).toHaveLength(6);
        for (const n of around) expect(distance(n, { q: 2, r: -1 })).toBe(1);
    });
});
