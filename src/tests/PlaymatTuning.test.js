import { describe, it, expect, afterEach } from 'vitest';
import {
    TUNABLES, tuning, setTuning, resetTuning, isTuned, tuningDefault
} from '../config/playmatTuning.js';
import {
    resolveLattice, edgeProfile, resolveArtPixels, LATTICE_SIZE
} from '../systems/board/TerrainLattice.js';
import { propsForBoard } from '../systems/board/TerrainProps.js';
import { buildPatchMasks } from '../systems/board/TerrainPatches.js';
import { buildBandMasks, bandAppearance } from '../systems/board/TerrainBands.js';

/**
 * The playmat tuning store — the developer panel's sliders.
 *
 * The failure worth guarding is a **dead slider**: a knob that moves, saves, and
 * changes nothing on the board. It looks like it works, so it is only found by
 * someone tuning for a while and wondering why nothing helps. The last test in
 * this file drives every tunable to both ends and insists the picture changes.
 */

afterEach(() => resetTuning());

describe('The table itself', () => {
    it('gives every tunable a default inside its own range', () => {
        for (const t of TUNABLES) {
            expect(t.def, t.key).toBeGreaterThanOrEqual(t.min);
            expect(t.def, t.key).toBeLessThanOrEqual(t.max);
            expect(t.max, t.key).toBeGreaterThan(t.min);
            expect(t.step, t.key).toBeGreaterThan(0);
        }
    });

    it('has unique keys, and a label and hint for each', () => {
        expect(new Set(TUNABLES.map(t => t.key)).size).toBe(TUNABLES.length);
        for (const t of TUNABLES) {
            expect(t.label, t.key).toBeTruthy();
            expect(t.hint, t.key).toBeTruthy();
            expect(t.group, t.key).toBeTruthy();
        }
    });

    it('starts at its defaults', () => {
        for (const t of TUNABLES) {
            expect(tuning(t.key), t.key).toBe(t.def);
            expect(tuningDefault(t.key), t.key).toBe(t.def);
        }
        expect(isTuned()).toBe(false);
    });
});

describe('Setting values', () => {
    it('clamps to the declared range rather than trusting the caller', () => {
        const t = TUNABLES[0];
        setTuning(t.key, t.max + 1000);
        expect(tuning(t.key)).toBe(t.max);
        setTuning(t.key, t.min - 1000);
        expect(tuning(t.key)).toBe(t.min);
    });

    it('refuses an unknown key or a value that is not a number', () => {
        expect(setTuning('nonsense', 1)).toBe(false);
        const t = TUNABLES[0];
        expect(setTuning(t.key, NaN)).toBe(false);
        expect(setTuning(t.key, undefined)).toBe(false);
        expect(tuning(t.key)).toBe(t.def);
    });

    it('reports whether anything actually changed', () => {
        const t = TUNABLES[0];
        expect(setTuning(t.key, t.def)).toBe(false);   // already there
        expect(setTuning(t.key, t.min)).toBe(true);
        expect(isTuned()).toBe(true);
    });

    it('resets everything back to how it ships', () => {
        for (const t of TUNABLES) setTuning(t.key, t.min);
        resetTuning();
        for (const t of TUNABLES) expect(tuning(t.key), t.key).toBe(t.def);
        expect(isTuned()).toBe(false);
    });
});

describe('⭐ No dead sliders', () => {
    /**
     * What each tunable is supposed to change, as something comparable.
     *
     * A knob missing from this table is a knob nobody has claimed an effect
     * for, and the test below fails on that too — so adding a slider without
     * wiring it up cannot pass quietly.
     */
    const seed = 4242;
    const board = {};
    for (let i = 0; i < 36; i++) {
        board[i] = { terrainId: i % 6 < 3 ? 'forest' : 'shore', paintedAt: i };
    }
    const lattice = () => JSON.stringify(resolveLattice(board, seed));
    const edges = () => JSON.stringify(
        Array.from({ length: LATTICE_SIZE - 1 }, (_, i) => edgeProfile(4, i, 'v', seed))
    );
    const props = () => JSON.stringify(
        propsForBoard(resolveLattice(board, seed), seed)
    );
    const patches = () => {
        const mask = buildPatchMasks(resolveArtPixels(resolveLattice(board, seed), seed), seed).masks.dirt;
        // Summarised rather than compared byte for byte: 53,824 bytes through
        // JSON.stringify per tunable per bound is slow enough to notice, and a
        // count plus a checksum separates any two masks that differ at all.
        let on = 0;
        let sum = 0;
        for (let i = 0; i < mask.length; i++) if (mask[i]) { on++; sum += i; }
        return `${on}:${sum}`;
    };

    const bandBoard = {};
    for (let i = 0; i < 36; i++) {
        bandBoard[i] = { terrainId: i % 6 < 3 ? 'ocean' : 'shore', paintedAt: i };
    }
    const bands = () => buildBandMasks(resolveLattice(bandBoard, seed), seed)
        .bands.map(b => {
            let on = 0;
            let sum = 0;
            for (let i = 0; i < b.mask.length; i++) if (b.mask[i]) { on++; sum += i; }
            return `${b.terrainId}:${on}:${sum}`;
        }).join('|');

    // ⚠️ Water beside FOREST, not beside shore. On the band fixture the sea's
    // neighbour is already sand, so there is nothing for a beach to be written
    // onto and the slider would look dead when it is not.
    const fringeBoard = {};
    for (let i = 0; i < 36; i++) {
        fringeBoard[i] = { terrainId: i % 6 < 3 ? 'ocean' : 'forest', paintedAt: i };
    }
    const fringe = () => {
        const { at, palette } = resolveArtPixels(resolveLattice(fringeBoard, seed), seed);
        const shore = palette.indexOf('shore');
        let n = 0;
        for (let i = 0; i < at.length; i++) if (at[i] === shore) n++;
        return String(n);
    };

    const OBSERVES = {
        edgeSwing: edges,
        edgeRoughness: edges,
        ownerJitter: lattice,
        ownerCoarseShare: lattice,
        propDensity: props,
        propScatter: props,
        patchCoverage: patches,
        patchScale: patches,
        bandWidth: bands,
        fringeWidth: fringe,
        // ⚠️ Strength changes the tint, not the mask, so it has to be observed
        // through the appearance rather than through the geometry.
        bandStrength: () => JSON.stringify(
            ['ocean', 'shore'].map(id => bandAppearance(id))
        )
    };

    it('every tunable in the table is claimed to change something', () => {
        for (const t of TUNABLES) {
            expect(OBSERVES[t.key], `${t.key} has no declared effect`).toBeDefined();
        }
    });

    it('⚠️ every tunable actually changes what it claims to', () => {
        // The whole point. A slider that saves and repaints but alters nothing
        // is indistinguishable from a working one until you have wasted an
        // afternoon on it.
        for (const t of TUNABLES) {
            const observe = OBSERVES[t.key];
            resetTuning();

            setTuning(t.key, t.min);
            const atMin = observe();
            setTuning(t.key, t.max);
            const atMax = observe();

            expect(atMin, `${t.key} does nothing between ${t.min} and ${t.max}`)
                .not.toBe(atMax);
        }
    });
});
