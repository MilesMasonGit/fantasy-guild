import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { propsForBoard, propSizePx, PROP_ART_PX } from '../systems/board/TerrainProps.js';
import {
    LATTICE_SIZE, SUBTILE_PX, subtileArtPx, resolveArtPixels
} from '../systems/board/TerrainLattice.js';
import { TERRAIN_TYPES, propSprite, propsOf } from '../config/registries/terrainRegistry.js';

/**
 * Terrain P4 — scenery.
 *
 * The placement is data, so it can be asserted on. That is the direct lesson of
 * P3, where the geometry lived inside the renderer, was wrong, and no test could
 * see it. Nothing here draws anything.
 */

const projectRoot = resolve(__dirname, '../..');

/** A lattice with one terrain everywhere. */
const flat = (terrainId) => new Array(LATTICE_SIZE * LATTICE_SIZE).fill(terrainId);

describe('Scenery only grows where it was authored', () => {
    it('scatters trees on the grass terrains', () => {
        expect(propsForBoard(flat('forest'), 5).length).toBeGreaterThan(0);
        expect(propsForBoard(flat('meadow'), 5).length).toBeGreaterThan(0);
    });

    it('leaves every other terrain bare', () => {
        // Not an oversight — there is no rock or reed art, and half-authored
        // scenery looks worse than none.
        for (const id of Object.keys(TERRAIN_TYPES)) {
            if (propsOf(id)) continue;
            expect(propsForBoard(flat(id), 5), id).toEqual([]);
        }
    });

    it('puts nothing on unpainted ground', () => {
        expect(propsForBoard(new Array(LATTICE_SIZE * LATTICE_SIZE).fill(null), 5)).toEqual([]);
    });

    it('is denser on forest than on open meadow', () => {
        expect(propsForBoard(flat('forest'), 5).length)
            .toBeGreaterThan(propsForBoard(flat('meadow'), 5).length * 2);
    });

    it('names only props that exist as art', () => {
        for (const prop of propsForBoard(flat('forest'), 5)) {
            const rel = propSprite(prop.propId);
            const abs = resolve(projectRoot, 'public', rel.replace(/^\//, ''));
            expect(existsSync(abs), `missing ${rel}`).toBe(true);
        }
    });

    it('uses every species it was given, not just the first', () => {
        const seen = new Set(propsForBoard(flat('forest'), 5).map(p => p.propId));
        expect(seen.size).toBe(propsOf('forest').props.length);
    });
});

describe('⭐ Trees are scattered, not planted on a grid', () => {
    it('does not put every prop at the same place in its subtile', () => {
        // The whole point of the scatter. If the offsets collapse to one value
        // every tree lines up on the lattice and the board looks tiled.
        const offsets = new Set(
            propsForBoard(flat('forest'), 5).map(p => `${p.x % SUBTILE_PX},${p.y % SUBTILE_PX}`)
        );
        expect(offsets.size).toBeGreaterThan(20);
    });

    it('does not plant them all at the subtile centre', () => {
        // Dead centre is what it would do with the jitter dropped. Asserted
        // across the whole board rather than per prop: one tree CAN land on the
        // centre by chance, and a test that forbade that would fail at random.
        const props = propsForBoard(flat('forest'), 5);
        const centred = props.filter(p =>
            p.anchorX % SUBTILE_PX === SUBTILE_PX / 2 &&
            p.anchorY % SUBTILE_PX === SUBTILE_PX / 2
        );
        expect(centred.length).toBeLessThan(props.length * 0.05);
    });

    it('⭐ keeps every trunk on the subtile that grew it', () => {
        // The anchor is the base of the trunk, and it is what decides which
        // terrain the tree belongs to. If it drifted outside its own subtile a
        // fir could end up standing in the sea — and because the canopy is
        // taller than a subtile anyway, nothing about the picture would look
        // obviously wrong.
        //
        // Compared against the subtile the prop was actually generated from,
        // not one recomputed from the anchor, which would make this vacuous.
        for (const p of propsForBoard(flat('forest'), 5)) {
            expect(p.anchorX, `prop at ${p.sx},${p.sy}`)
                .toBeGreaterThanOrEqual(p.sx * SUBTILE_PX);
            expect(p.anchorX).toBeLessThan((p.sx + 1) * SUBTILE_PX);
            expect(p.anchorY).toBeGreaterThanOrEqual(p.sy * SUBTILE_PX);
            expect(p.anchorY).toBeLessThan((p.sy + 1) * SUBTILE_PX);
        }
    });
});

describe('⭐ Depth — what stands lower is drawn on top', () => {
    it('returns the list already in back-to-front order', () => {
        // The renderer does nothing but paint this in order, so the sort IS the
        // depth rule. If it stops holding, trees behind will cover trees in
        // front and there is nothing downstream to catch it.
        const props = propsForBoard(flat('forest'), 5);
        for (let i = 1; i < props.length; i++) {
            expect(props[i - 1].anchorY).toBeLessThanOrEqual(props[i].anchorY);
        }
    });

    // ⚠️ Not tested: that it sorts by the tree's BASE rather than by the top of
    // its sprite. Every prop is currently the same size, so the two orders are
    // identical and no assertion can tell them apart. The distinction starts to
    // matter the moment props of different heights exist — a tall tree standing
    // in front of a short one must still be drawn in front — so it is written
    // down here rather than silently relied upon.

    it('is a total order — no two props tie', () => {
        const props = propsForBoard(flat('forest'), 5);
        const keys = props.map(p => `${p.anchorY}:${p.x}`);
        expect(new Set(keys).size).toBe(keys.length);
    });
});

describe('Stability and scale', () => {
    it('is identical every time, so the wood does not move as you play', () => {
        expect(propsForBoard(flat('forest'), 4242)).toEqual(propsForBoard(flat('forest'), 4242));
    });

    it('differs between seeds', () => {
        expect(propsForBoard(flat('forest'), 1)).not.toEqual(propsForBoard(flat('forest'), 2));
    });

    it('draws props at the same pixel zoom as the ground', () => {
        // A prop at a different zoom has finer pixels than the ground it stands
        // on and reads as pasted on — the same error as cutting a coastline
        // finer than the ground it runs through.
        expect(propSizePx()).toBe(PROP_ART_PX * (SUBTILE_PX / subtileArtPx()));
    });
});

describe('⭐ A tree will not grow on a beach (concept §8A)', () => {
    /** Forest everywhere, with a strip of sea down one side. */
    function woodByTheSea() {
        const grid = new Array(LATTICE_SIZE * LATTICE_SIZE).fill('forest');
        for (let sy = 0; sy < LATTICE_SIZE; sy++) {
            for (let sx = 0; sx < 4; sx++) grid[sy * LATTICE_SIZE + sx] = 'ocean';
        }
        return grid;
    }

    it('drops props whose trunk stands on fringed ground', () => {
        // The beach is written onto the forest's outer pixels, so a subtile can
        // still be forest while the ground a tree would stand in is sand. The
        // subtile grid cannot see that; the art-pixel map can.
        const grid = woodByTheSea();
        const unchecked = propsForBoard(grid, 11);
        const checked = propsForBoard(grid, 11, resolveArtPixels(grid, 11));
        expect(checked.length).toBeLessThan(unchecked.length);
    });

    it('⭐ leaves every surviving trunk standing on its own terrain', () => {
        const grid = woodByTheSea();
        const pixels = resolveArtPixels(grid, 11);
        const scale = SUBTILE_PX / subtileArtPx();
        for (const p of propsForBoard(grid, 11, pixels)) {
            const ax = Math.min(pixels.size - 1, Math.floor(p.anchorX / scale));
            const ay = Math.min(pixels.size - 1, Math.floor(p.anchorY / scale));
            expect(pixels.palette[pixels.at[ay * pixels.size + ax]]).toBe('forest');
        }
    });

    it('changes nothing when no map is supplied', () => {
        const grid = woodByTheSea();
        expect(propsForBoard(grid, 11)).toEqual(propsForBoard(grid, 11, null));
    });
});
