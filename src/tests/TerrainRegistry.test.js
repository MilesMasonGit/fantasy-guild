import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    SUBSTRATES, TERRAIN_TYPES, substrateSprite, getTerrain, isTerrainId, substrateOf,
    DEFAULT_ART_SET, ART_PX_FOR_SET, artSet, setArtSet, substrateArtPx, substrateVariants
} from '../config/registries/terrainRegistry.js';
import { subtileArtPx } from '../systems/board/TerrainLattice.js';

/**
 * Terrain vocabulary: every terrain type names real art.
 *
 * Terrain is switched off (`TERRAIN_ENABLED = false`) since the free playmat.
 */

const projectRoot = resolve(__dirname, '../..');

describe('Terrain types name real art', () => {
    it('every terrain sits on a substrate that exists', () => {
        for (const [id, terrain] of Object.entries(TERRAIN_TYPES)) {
            expect(terrain.id, `${id} must carry its own id`).toBe(id);
            expect(SUBSTRATES[terrain.substrate], `${id} substrate`).toBeDefined();
        }
    });

    it('every substrate has its ground sheet on disk', () => {
        // ⚠️ The ground art is one sheet per substrate now, not one file per
        // variant, so `substrateSprite`'s per-variant paths have no file behind
        // them while terrain is dormant. This checks the art that does exist.
        for (const substrate of Object.values(SUBSTRATES)) {
            const abs = resolve(projectRoot, 'public/assets/playmat/terrain', `ter_${substrate.id}.png`);
            expect(existsSync(abs), `missing ter_${substrate.id}.png`).toBe(true);
        }
    });

    it('does not claim a variant that was never drawn', () => {
        // The counts are hand-written, so the cheap mistake is claiming one
        // variant too many and rendering a broken image on some subtiles.
        for (const substrate of Object.values(SUBSTRATES)) {
            for (const set of Object.keys(ART_PX_FOR_SET)) {
                const rel = substrateSprite(substrate.id, substrate.variants[set], set);
                const abs = resolve(projectRoot, 'public', rel.replace(/^\//, ''));
                expect(existsSync(abs), `${substrate.id}/${set} claims too few`).toBe(false);
            }
        }
    });

    it('⚠️ cuts coastlines at the same resolution the ground is drawn at', () => {
        // The one way to switch art sets and get something that looks broken
        // rather than different: an edge stepped at 16 through ground drawn at
        // 8 is finer than anything around it, and reads as a rendering fault.
        // Checked in BOTH sets, because the QA toggle can leave either live.
        const original = artSet();
        try {
            for (const set of Object.keys(ART_PX_FOR_SET)) {
                setArtSet(set);
                expect(subtileArtPx(), set).toBe(substrateArtPx());
                expect(substrateArtPx(), set).toBe(ART_PX_FOR_SET[set]);
            }
        } finally {
            setArtSet(original);
        }
    });

    it('⭐ actually changes what is drawn when the set is switched', () => {
        // The bug this guards is silent: if anything captures the art set at
        // import time — a constant, a cache key — the toggle appears to work
        // and the board keeps drawing the old sprites.
        const original = artSet();
        try {
            setArtSet('a');
            const fine = substrateSprite('grass', 0);
            const fineSize = substrateArtPx();
            setArtSet('b');
            expect(substrateSprite('grass', 0)).not.toBe(fine);
            expect(substrateArtPx()).not.toBe(fineSize);
            expect(subtileArtPx()).toBe(substrateArtPx());
        } finally {
            setArtSet(original);
        }
    });

    it('refuses a set that does not exist, and leaves the live one alone', () => {
        const original = artSet();
        expect(setArtSet('nonsense')).toBe(false);
        expect(artSet()).toBe(original);
        expect(setArtSet(original)).toBe(false);   // already live, nothing to do
    });

    it('ships a default that names a real set', () => {
        expect(ART_PX_FOR_SET[DEFAULT_ART_SET]).toBeDefined();
    });

    // ⚠️ Skipped: it reads the per-variant files, which the art no longer has
    // (see above). Revive it against the sheets when terrain is rewritten.
    it.skip('every sprite in the selected set really is the size that set claims', () => {
        // A PNG's width lives at byte 16 of the IHDR chunk. Cheaper than
        // decoding, and this only has to catch a sprite drawn at the wrong size.
        for (const substrate of Object.values(SUBSTRATES)) {
            for (let v = 0; v < substrateVariants(substrate.id); v++) {
                const rel = substrateSprite(substrate.id, v);
                const abs = resolve(projectRoot, 'public', rel.replace(/^\//, ''));
                const width = readFileSync(abs).readUInt32BE(16);
                expect(width, `${rel} is ${width}px`).toBe(substrateArtPx());
            }
        }
    });

    it('⚠️ has no edge or corner art, which is why slice one cannot blend', () => {
        // If this ever fails, someone has drawn the stencil library and the
        // blending work in roadmap P3 is unblocked. Delete this test then.
        const masks = resolve(projectRoot, 'public/assets/playmat/terrain/masks');
        expect(existsSync(masks)).toBe(false);
    });

    it('resolves terrain and substrate lookups, and refuses unknown ids', () => {
        expect(getTerrain('forest').substrate).toBe('grass');
        expect(substrateOf('shore').id).toBe('sand');
        expect(isTerrainId('forest')).toBe(true);
        expect(isTerrainId('swamp')).toBe(false);
        expect(getTerrain('swamp')).toBeNull();
        expect(substrateOf('swamp')).toBeNull();
    });

    it('two terrain types may share one substrate (D-T8)', () => {
        // The whole point of the flattened model: "desert" and "desert village"
        // are different terrains on the same sand. If this stops being true the
        // registry has drifted back towards the concept doc's overlay split.
        const bySubstrate = {};
        for (const t of Object.values(TERRAIN_TYPES)) {
            (bySubstrate[t.substrate] ||= []).push(t.id);
        }
        const shared = Object.values(bySubstrate).filter(ids => ids.length > 1);
        expect(shared.length).toBeGreaterThan(0);
    });
});
