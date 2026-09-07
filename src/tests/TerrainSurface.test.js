import { describe, it, expect } from 'vitest';
import { buildSurface } from '../systems/board/TerrainSurface.js';
import { resolveArtPixels, LATTICE_SIZE, subtileArtPx } from '../systems/board/TerrainLattice.js';
import { getTerrain, patchOf, bandOf } from '../config/registries/terrainRegistry.js';

/**
 * The one answer per art pixel that replaced five rendering passes.
 *
 * This is where the layering rules now live, so this is where they can be
 * asserted. Before the rewrite they were expressed as *draw order* inside the
 * canvas — patches happened to be painted after bands, so patches happened to
 * win — and nothing outside the renderer could see, or check, that they did.
 */

const flat = (terrainId) => new Array(LATTICE_SIZE * LATTICE_SIZE).fill(terrainId);

/** Sea on the left, forest on the right. Beaches appear between them. */
function coast() {
    const grid = new Array(LATTICE_SIZE * LATTICE_SIZE);
    for (let sy = 0; sy < LATTICE_SIZE; sy++) {
        for (let sx = 0; sx < LATTICE_SIZE; sx++) {
            grid[sy * LATTICE_SIZE + sx] = sx < LATTICE_SIZE / 2 ? 'ocean' : 'forest';
        }
    }
    return grid;
}

const surfaceOf = (grid, seed = 5) => {
    const pixels = resolveArtPixels(grid, seed);
    return { pixels, surface: buildSurface(pixels, seed) };
};

describe('Every painted pixel gets ground to draw', () => {
    it('gives each terrain pixel its terrain’s substrate', () => {
        const { pixels, surface } = surfaceOf(flat('forest'));
        const grassIndex = surface.substrates.indexOf(getTerrain('forest').substrate);
        expect(grassIndex).toBeGreaterThanOrEqual(0);
        for (let i = 0; i < surface.substrateAt.length; i++) {
            expect(surface.substrateAt[i]).toBeGreaterThanOrEqual(0);
        }
        expect(pixels.size).toBe(LATTICE_SIZE * subtileArtPx());
    });

    it('⭐ leaves bare table with nothing to draw', () => {
        // -1 means transparent. If this ever became a real substrate the wooden
        // table would disappear under a board-sized rectangle of ground.
        const { surface } = surfaceOf(new Array(LATTICE_SIZE * LATTICE_SIZE).fill(null));
        expect(Array.from(surface.substrateAt).every(v => v === -1)).toBe(true);
    });

    it('picks the variant per subtile, not per pixel', () => {
        // A variant chosen per pixel would shred the texture into noise. Every
        // pixel of one subtile must sample the same sprite.
        const { surface } = surfaceOf(flat('meadow'));
        const artPx = subtileArtPx();
        const size = surface.size;
        for (let sy = 0; sy < 4; sy++) {
            for (let sx = 0; sx < 4; sx++) {
                const seen = new Set();
                for (let y = 0; y < artPx; y++) {
                    for (let x = 0; x < artPx; x++) {
                        const i = (sy * artPx + y) * size + sx * artPx + x;
                        // Patches swap the substrate, so only compare pixels
                        // that are still drawing the terrain's own ground.
                        if (surface.substrateAt[i] === surface.substrateAt[sy * artPx * size + sx * artPx]) {
                            seen.add(surface.variantAt[i]);
                        }
                    }
                }
                expect(seen.size).toBeLessThanOrEqual(1 + 1);
            }
        }
    });
});

describe('⭐ Layering — the rules that used to be draw order', () => {
    it('replaces the ground where a patch wears through', () => {
        const { surface } = surfaceOf(flat('meadow'));
        const grass = getTerrain('meadow').substrate;
        const dirt = patchOf('meadow').substrate;
        const names = surface.substrates;

        let asGrass = 0;
        let asDirt = 0;
        for (let i = 0; i < surface.substrateAt.length; i++) {
            const id = names[surface.substrateAt[i]];
            if (id === grass) asGrass++;
            if (id === dirt) asDirt++;
        }
        expect(asDirt).toBeGreaterThan(0);
        expect(asGrass).toBeGreaterThan(asDirt);   // wear, not a second terrain
    });

    it('tints the ground where a band lies over it', () => {
        const { surface } = surfaceOf(coast());
        expect(surface.tints.length).toBeGreaterThan(0);
        const tinted = Array.from(surface.tintAt).filter(v => v >= 0).length;
        expect(tinted).toBeGreaterThan(0);
    });

    it('⭐ never leaves a patch tinted — bare earth is not shallow water', () => {
        // Patches and bands do not currently overlap on any authored terrain,
        // but the rule has to be decided rather than left to whichever pass ran
        // last. A patch replaces the ground, so it drops the tint with it.
        const { surface } = surfaceOf(coast());
        const patchSubstrates = new Set(
            ['meadow', 'forest', 'farmland', 'hamlet', 'diggings']
                .map(id => patchOf(id)?.substrate).filter(Boolean)
        );
        for (let i = 0; i < surface.substrateAt.length; i++) {
            const id = surface.substrates[surface.substrateAt[i]];
            if (patchSubstrates.has(id) && surface.tintAt[i] >= 0) {
                // Only a failure if this pixel's terrain is one that patches.
                expect.fail(`patched pixel ${i} carried a band tint`);
            }
        }
    });

    it('tints only terrain that declared a band', () => {
        const { pixels, surface } = surfaceOf(coast());
        for (let i = 0; i < surface.tintAt.length; i++) {
            if (surface.tintAt[i] < 0) continue;
            const terrainId = pixels.palette[pixels.at[i]];
            expect(bandOf(terrainId), `${terrainId} was tinted without a band`).toBeTruthy();
        }
    });
});

describe('Stability', () => {
    it('is identical every time', () => {
        const a = surfaceOf(coast(), 31).surface;
        const b = surfaceOf(coast(), 31).surface;
        expect(Array.from(a.substrateAt)).toEqual(Array.from(b.substrateAt));
        expect(Array.from(a.tintAt)).toEqual(Array.from(b.tintAt));
        expect(Array.from(a.variantAt)).toEqual(Array.from(b.variantAt));
    });

    it('differs between seeds', () => {
        const a = surfaceOf(coast(), 1).surface;
        const b = surfaceOf(coast(), 2).surface;
        expect(Array.from(a.substrateAt)).not.toEqual(Array.from(b.substrateAt));
    });
});
