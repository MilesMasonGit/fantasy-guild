import { describe, it, expect } from 'vitest';
import {
    LATTICE_SIZE, SUBTILE_PX, SUBTILES_PER_TILE, SUBTILES_PER_GAP,
    subtileArtPx, edgeAmplitude,
    ownerOf, variantAt, resolveLattice, edgeProfile
} from '../systems/board/TerrainLattice.js';
import { BOARD_SIZE, BOARD_PX, TILE_PX, TILE_GAP_PX } from '../config/boardGeometry.js';

/**
 * Terrain P2 — the subtile lattice.
 *
 * Two things are worth pinning here and they pull against each other. The
 * lattice must **line up exactly** with the board it draws on, which is
 * arithmetic and can be asserted precisely. And it must be **stable** — the
 * same board resolving the same way on every redraw and every reload — which is
 * the property that would rot silently if anyone reached for `Math.random`.
 *
 * What the edges actually look like is a judgement call and is not asserted;
 * the numbers that control it are tuning constants and are expected to move.
 */

/** A board where every tile carries the same terrain, painted in index order. */
const uniform = (terrainId) => {
    const terrain = {};
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        terrain[i] = { terrainId, paintedAt: i };
    }
    return terrain;
};

const tileOf = (index) => ({
    col: index % BOARD_SIZE,
    row: Math.floor(index / BOARD_SIZE)
});

/** The subtile coordinates of a tile's untouchable middle. */
const coreOf = (index) => {
    const { col, row } = tileOf(index);
    const stride = SUBTILES_PER_TILE + SUBTILES_PER_GAP;
    return { sx: col * stride + 1, sy: row * stride + 1 };
};

describe('The lattice lines up with the board exactly (D-T1)', () => {
    it('is 29 subtiles across — six tiles and five gaps', () => {
        expect(SUBTILES_PER_TILE).toBe(4);
        expect(SUBTILES_PER_GAP).toBe(1);
        expect(LATTICE_SIZE).toBe(29);
    });

    it('⭐ covers the board edge to edge with nothing left over', () => {
        // The whole reason the playmat moved to a 32px gap. If this fails the
        // terrain no longer aligns with the tiles and every boundary is wrong.
        expect(SUBTILE_PX).toBe(32);
        expect(LATTICE_SIZE * SUBTILE_PX).toBe(BOARD_PX);
    });

    it('a gap is exactly one subtile, and a tile exactly four', () => {
        expect(SUBTILES_PER_GAP * SUBTILE_PX).toBe(TILE_GAP_PX);
        expect(SUBTILES_PER_TILE * SUBTILE_PX).toBe(TILE_PX);
    });
});

describe('Ownership', () => {
    it('gives an unpainted board no terrain at all', () => {
        const grid = resolveLattice({}, 1);
        expect(grid).toHaveLength(LATTICE_SIZE * LATTICE_SIZE);
        expect(grid.every(cell => cell === null)).toBe(true);
    });

    it('⭐ never lets a tile keep terrain in its own core', () => {
        // The core is what makes a tile readable as that tile. If a neighbour
        // could take it, terrain would speckle into the middle of tiles and
        // read as noise rather than as bleed.
        const terrain = uniform('forest');
        terrain[14] = { terrainId: 'shore', paintedAt: 999 };  // newest, most aggressive
        for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
            const { sx, sy } = coreOf(i);
            expect(ownerOf(sx, sy, terrain, 7), `core of tile ${i}`).toBe(i);
        }
    });

    it('paints the gaps, so the board reads as one surface', () => {
        const terrain = uniform('forest');
        const grid = resolveLattice(terrain, 7);
        // Column 4 is the gap between tile columns 0 and 1. On a fully painted
        // board it must be terrain, not bare table.
        for (let sy = 0; sy < LATTICE_SIZE; sy++) {
            expect(grid[sy * LATTICE_SIZE + 4], `gap at row ${sy}`).toBe('forest');
        }
    });

    it('never reaches further than an adjacent tile', () => {
        // One painted tile in the middle of an empty board. Its terrain may
        // spill into the gap and a little way into its neighbours, but it must
        // not appear on the far side of them.
        const terrain = { 14: { terrainId: 'shore', paintedAt: 0 } };
        const grid = resolveLattice(terrain, 3);
        const stride = SUBTILES_PER_TILE + SUBTILES_PER_GAP;
        const { col, row } = tileOf(14);

        for (let sy = 0; sy < LATTICE_SIZE; sy++) {
            for (let sx = 0; sx < LATTICE_SIZE; sx++) {
                if (grid[sy * LATTICE_SIZE + sx] == null) continue;
                expect(Math.abs(Math.floor(sx / stride) - col)).toBeLessThanOrEqual(1);
                expect(Math.abs(Math.floor(sy / stride) - row)).toBeLessThanOrEqual(1);
            }
        }
    });

    it('leaves a lone tile’s own sixteen subtiles entirely to it', () => {
        const terrain = { 14: { terrainId: 'shore', paintedAt: 0 } };
        const stride = SUBTILES_PER_TILE + SUBTILES_PER_GAP;
        const { col, row } = tileOf(14);
        for (let dy = 0; dy < SUBTILES_PER_TILE; dy++) {
            for (let dx = 0; dx < SUBTILES_PER_TILE; dx++) {
                const sx = col * stride + dx;
                const sy = row * stride + dy;
                expect(ownerOf(sx, sy, terrain, 3)).toBe(14);
            }
        }
    });
});

describe('⚠️ The same board always resolves the same way (D-T11)', () => {
    it('is identical when resolved twice', () => {
        // This is the property that makes storing two numbers per tile enough
        // instead of the whole 841-cell grid. If it ever fails, the save model
        // is wrong, not just the picture.
        const terrain = uniform('forest');
        terrain[8] = { terrainId: 'shore', paintedAt: 100 };
        expect(resolveLattice(terrain, 4242)).toEqual(resolveLattice(terrain, 4242));
    });

    it('differs between seeds, so two players get different coastlines', () => {
        const terrain = uniform('forest');
        terrain[8] = { terrainId: 'shore', paintedAt: 100 };
        expect(resolveLattice(terrain, 1)).not.toEqual(resolveLattice(terrain, 2));
    });

    it('picks substrate variants stably, and always in range', () => {
        for (let sy = 0; sy < LATTICE_SIZE; sy++) {
            for (let sx = 0; sx < LATTICE_SIZE; sx++) {
                const v = variantAt(sx, sy, 6, 99);
                expect(v).toBeGreaterThanOrEqual(0);
                expect(v).toBeLessThan(6);
                expect(variantAt(sx, sy, 6, 99)).toBe(v);
            }
        }
    });

    it('uses more than one variant, rather than picking the same one forever', () => {
        const seen = new Set();
        for (let sy = 0; sy < LATTICE_SIZE; sy++) {
            for (let sx = 0; sx < LATTICE_SIZE; sx++) seen.add(variantAt(sx, sy, 6, 99));
        }
        expect(seen.size).toBe(6);
    });

    it('handles a substrate with a single variant without dividing by it', () => {
        expect(variantAt(3, 4, 1, 5)).toBe(0);
        expect(variantAt(3, 4, 0, 5)).toBe(0);
    });
});

describe('Recency decides a contested subtile (D-T3)', () => {
    it('⭐ gives the newer terrain most of the gap between two tiles', () => {
        // Not all of it — the jitter is what stops the boundary being a
        // straight line — but it must clearly win, or "most recently painted
        // wins" is not what the board shows.
        const terrain = {};
        for (let row = 0; row < BOARD_SIZE; row++) {
            terrain[row * BOARD_SIZE + 2] = { terrainId: 'forest', paintedAt: 1 };
            terrain[row * BOARD_SIZE + 3] = { terrainId: 'shore', paintedAt: 2 };
        }
        const grid = resolveLattice(terrain, 555);

        // Subtile column 14 is the gap between tile columns 2 and 3.
        let newer = 0;
        for (let sy = 0; sy < LATTICE_SIZE; sy++) {
            if (grid[sy * LATTICE_SIZE + 14] === 'shore') newer++;
        }
        expect(newer).toBeGreaterThan(LATTICE_SIZE / 2);
    });

    it('is not a straight line — the boundary moves along its length', () => {
        const terrain = {};
        for (let row = 0; row < BOARD_SIZE; row++) {
            terrain[row * BOARD_SIZE + 2] = { terrainId: 'forest', paintedAt: 1 };
            terrain[row * BOARD_SIZE + 3] = { terrainId: 'shore', paintedAt: 2 };
        }
        const grid = resolveLattice(terrain, 555);

        // Only tile columns 2 and 3 are painted, so the board outside them is
        // null. Count the forest in the painted band rather than scanning from
        // the board edge, which would stop on the first unpainted column.
        const widths = new Set();
        for (let sy = 0; sy < LATTICE_SIZE; sy++) {
            let forest = 0;
            for (let sx = 10; sx <= 19; sx++) {
                if (grid[sy * LATTICE_SIZE + sx] === 'forest') forest++;
            }
            widths.add(forest);
        }
        expect(widths.size).toBeGreaterThan(1);
    });
});

describe('Edge frontiers (roadmap P3 — D-T13)', () => {
    it('gives one displacement per art pixel, all within the amplitude', () => {
        for (const axis of ['v', 'h']) {
            const profile = edgeProfile(3, 4, axis, 99);
            expect(profile).toHaveLength(subtileArtPx());
            for (const value of profile) {
                expect(Math.abs(value)).toBeLessThanOrEqual(edgeAmplitude());
            }
        }
    });

    it('⭐ has no step at a junction — the seam problem, closed', () => {
        // Concept §6's sawtooth. Two boundary segments meeting at a junction
        // must agree on the depth there, or the coastline visibly jumps. They
        // agree because the depth is a property of the *junction*: both read
        // the same hash of its coordinates rather than wandering off alone.
        //
        // This asserts exact equality rather than a tolerance, because that is
        // what the design claims. Verified across 94,080 junctions and 60 seeds
        // before being written down. A failure here means the frontier is no
        // longer continuous, not that a constant needs nudging.
        for (const seed of [0, 1, 7, 12345, 99999]) {
            for (let sy = 0; sy < LATTICE_SIZE - 1; sy++) {
                for (let sx = 0; sx < LATTICE_SIZE - 1; sx++) {
                    const down = edgeProfile(sx, sy, 'v', seed);
                    const nextDown = edgeProfile(sx, sy + 1, 'v', seed);
                    expect(down[subtileArtPx() - 1], `v junction ${sx},${sy}`)
                        .toBe(nextDown[0]);

                    const across = edgeProfile(sx, sy, 'h', seed);
                    const nextAcross = edgeProfile(sx + 1, sy, 'h', seed);
                    expect(across[subtileArtPx() - 1], `h junction ${sx},${sy}`)
                        .toBe(nextAcross[0]);
                }
            }
        }
    });

    it('⭐ uses the whole amplitude, so the coast really wanders', () => {
        // What "ragged" has to mean, stated in a way that survives the art set
        // being switched.
        //
        // ⚠️ This used to assert that each segment deviates from a straight
        // ramp between its endpoints. That holds at 16 art pixels and quietly
        // stops holding at 8, where the wobble is proportionally smaller and
        // rounds away — so the test failed the moment the art set changed, even
        // though the rendered coastline was fine. At the coarser resolution the
        // shape comes from the junction depths varying, not from within-segment
        // wander, and that is correct rather than a regression.
        const seen = new Set();
        for (let sy = 0; sy < LATTICE_SIZE - 1; sy++) {
            for (const v of edgeProfile(5, sy, 'v', 4242)) seen.add(v);
            for (const v of edgeProfile(sy, 5, 'h', 4242)) seen.add(v);
        }
        // Both extremes reached, and most of the range in between.
        expect(Math.min(...seen)).toBe(-edgeAmplitude());
        expect(Math.max(...seen)).toBe(edgeAmplitude());
        expect(seen.size).toBeGreaterThanOrEqual(edgeAmplitude() + 2);
    });

    it('does not give every boundary the same frontier', () => {
        const shapes = new Set();
        for (let sy = 0; sy < LATTICE_SIZE - 1; sy++) {
            shapes.add(edgeProfile(5, sy, 'v', 4242).join(','));
        }
        expect(shapes.size).toBeGreaterThan(LATTICE_SIZE / 2);
    });

    it('is stable, and differs between seeds', () => {
        expect(edgeProfile(3, 4, 'v', 77)).toEqual(edgeProfile(3, 4, 'v', 77));
        expect(edgeProfile(3, 4, 'v', 77)).not.toEqual(edgeProfile(3, 4, 'v', 78));
    });

    it('keeps the two axes independent', () => {
        // A vertical and a horizontal boundary anchored at the same subtile are
        // different edges and must not mirror each other.
        expect(edgeProfile(3, 4, 'v', 77)).not.toEqual(edgeProfile(3, 4, 'h', 77));
    });
});
