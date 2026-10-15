import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    LOOKS, DEFAULT_LOOK, SHEETS, SHEET_PX, PROP_SHEETS, PROP_PX, PROP_SHEET_CELLS,
    sheetPath, propSheetPath, getLook, bandOf, fringeOf, wearOf, propsOf
} from '../config/registries/terrainRegistry.js';
import { TERRAIN } from '../systems/atlas/TerrainMap.js';
import { TUNABLES } from '../config/playmatTuning.js';

/**
 * The ground's vocabulary: five looks over the owner's eight ground sheets and seven prop sheets.
 * Every look names art that exists, at the size the drawing assumes.
 */

const projectRoot = resolve(__dirname, '../..');
const onDisk = (rel) => resolve(projectRoot, 'public', rel.replace(/^\//, ''));

/** A PNG's width and height, from its IHDR chunk: cheaper than decoding. */
function pngSize(abs) {
    const bytes = readFileSync(abs);
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe('The art the looks draw with', () => {
    it('has the eight ground sheets on disk, each a 64 × 64 fill', () => {
        expect(SHEETS).toHaveLength(8);
        expect(SHEET_PX).toBe(64);
        for (const id of SHEETS) {
            const abs = onDisk(sheetPath(id));
            expect(existsSync(abs), `missing ${sheetPath(id)}`).toBe(true);
            expect(pngSize(abs), id).toEqual([SHEET_PX, SHEET_PX]);
        }
    });

    it('has the seven prop sheets on disk, each 4 × 4 props of 16 pixels', () => {
        expect(PROP_SHEETS).toHaveLength(7);
        expect(PROP_PX * PROP_SHEET_CELLS).toBe(64);
        for (const id of PROP_SHEETS) {
            const abs = onDisk(propSheetPath(id));
            expect(existsSync(abs), `missing ${propSheetPath(id)}`).toBe(true);
            expect(pngSize(abs), id).toEqual([PROP_PX * PROP_SHEET_CELLS, PROP_PX * PROP_SHEET_CELLS]);
        }
    });

    it('has no edge or corner art: edges are computed (L-3 A)', () => {
        expect(existsSync(resolve(projectRoot, 'public/assets/playmat/terrain/masks'))).toBe(false);
    });
});

describe('The five looks', () => {
    it('are the meadow, the forest, the mountain, the coast and the sea', () => {
        expect(Object.keys(LOOKS).sort()).toEqual(['coast', 'forest', 'meadow', 'mountain', 'sea']);
        for (const [id, look] of Object.entries(LOOKS)) {
            expect(look.id, id).toBe(id);
            expect(Object.values(TERRAIN), id).toContain(look.terrain);
        }
    });

    it('⭐ draw the sheets the owner chose (TD-2 A)', () => {
        expect(LOOKS.meadow.sheets).toEqual(['grass']);
        expect(LOOKS.forest.sheets).toEqual(['grassb']);
        expect(LOOKS.mountain.sheets).toEqual(['stone']);
        expect(LOOKS.coast.sheets).toEqual(['sand']);
        expect(LOOKS.sea.sheets).toEqual(['water']);
        // `ter_waterb` waits (a lake, later): drawn, used by no look.
        const used = Object.values(LOOKS).flatMap(l => [...l.sheets, l.wear?.sheet].filter(Boolean));
        expect(used).not.toContain('waterb');
    });

    it('name only sheets that exist, for their ground and their wear', () => {
        for (const look of Object.values(LOOKS)) {
            for (const sheet of look.sheets) expect(SHEETS, look.id).toContain(sheet);
            if (look.wear) expect(SHEETS, look.id).toContain(look.wear.sheet);
        }
        expect(wearOf('meadow').sheet).toBe('dirt');
        expect(wearOf('forest').sheet).toBe('dirt');
        expect(wearOf('mountain').sheet).toBe('gravel');
    });

    it('scatter only from the prop sheets, with a positive weight each', () => {
        for (const id of Object.keys(LOOKS)) {
            const scatter = propsOf(id);
            if (!scatter) continue;
            expect(scatter.density, id).toBeGreaterThan(0);
            for (const p of scatter.props) {
                expect(PROP_SHEETS, id).toContain(p.sheet);
                expect(p.weight, id).toBeGreaterThan(0);
            }
        }
    });

    it('take their band and beach widths from a tuning slider, and name real terrains', () => {
        const keys = TUNABLES.map(t => t.key);
        for (const id of Object.keys(LOOKS)) {
            const band = bandOf(id);
            if (band) {
                expect(keys, id).toContain(band.widthTuning);
                for (const t of band.against || []) expect(Object.values(TERRAIN)).toContain(t);
            }
            const fringe = fringeOf(id);
            if (fringe) {
                expect(keys, id).toContain(fringe.widthTuning);
                expect(Object.values(TERRAIN)).toContain(fringe.terrain);
            }
        }
        expect(fringeOf('sea').terrain).toBe(TERRAIN.SAND);
        expect(bandOf('coast').against).toEqual([TERRAIN.WATER]);
    });

    it('give every terrain a default look, grass with no owning biome being meadow', () => {
        for (const t of Object.values(TERRAIN)) {
            expect(LOOKS[DEFAULT_LOOK[t]], t).toBeDefined();
            expect(LOOKS[DEFAULT_LOOK[t]].terrain, t).toBe(t);
        }
        expect(DEFAULT_LOOK.grass).toBe('meadow');
    });

    it('refuse an unknown look rather than throw', () => {
        expect(getLook('swamp')).toBeNull();
        expect(bandOf('swamp')).toBeNull();
        expect(wearOf('swamp')).toBeNull();
        expect(propsOf('swamp')).toBeNull();
        expect(fringeOf('swamp')).toBeNull();
    });

    it('cannot be changed at runtime', () => {
        expect(Object.isFrozen(LOOKS.forest)).toBe(true);
        expect(Object.isFrozen(LOOKS.forest.sheets)).toBe(true);
        expect(Object.isFrozen(LOOKS.forest.props[0])).toBe(true);
    });
});
