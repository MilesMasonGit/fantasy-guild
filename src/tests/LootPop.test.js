import { describe, it, expect } from 'vitest';

/**
 * ⭐ **The amount gained pops out of the notice** (owner): as loot lands on its item notice, the
 * amount ("+12", "+2.5k", as the notice writes its count) slides out of the notice's mat side,
 * flashes white, turns the gain green and fades. Its pictures are made once, hard-edged, with the
 * notice's black outline. (That it is drawn over every sparkle: `LootFlightToStub.test.js`.)
 */

import { POP_COLOUR, POP_MS, POP_TRAVEL_PX, POP_WHITE_MS, popAt, popPictures, popText } from '../ui/utils/lootPop.js';

describe('the pop says the amount as the notice does', () => {
    it.each([[1, '+1'], [40, '+40'], [999, '+999'], [2500, '+2.5k'], [12000, '+12k'], [3000000, '+3m']])('%i reads %s', (q, text) => {
        expect(popText(q)).toBe(text);
    });
});

describe('the pop in time', () => {
    it('slides out to its full travel, never back, and is gone at its end', () => {
        let last = -1;
        for (let ms = 0; ms < POP_MS; ms += 10) {
            const p = popAt(ms);
            expect(p.out).toBeGreaterThanOrEqual(last);
            last = p.out;
        }
        expect(popAt(0).out).toBe(0);
        expect(last).toBe(POP_TRAVEL_PX);
        expect(popAt(POP_MS)).toBeNull();
        expect(popAt(-1)).toBeNull();
    });

    it('white first, then its colour; fades in steps at the end', () => {
        expect(popAt(0).white).toBe(true);
        expect(popAt(POP_WHITE_MS - 1).white).toBe(true);
        expect(popAt(POP_WHITE_MS).white).toBe(false);
        expect(popAt(POP_MS / 2).alpha).toBe(1);
        const ends = [POP_MS - 150, POP_MS - 50].map(ms => popAt(ms).alpha);
        expect(ends[0]).toBeLessThan(1);
        expect(ends[1]).toBeLessThan(ends[0]);
    });
});

describe('the pop pictures', () => {
    /** A canvas stand-in whose text is a 10x8 block: each painted pixel recorded. */
    function maker(log) {
        return () => {
            const c = { width: 0, height: 0, painted: null };
            c.getContext = () => ({
                measureText: () => ({ width: 10 }),
                fillText() { log.texts++; },
                getImageData: (x, y, w, h) => {
                    const d = new Uint8ClampedArray(w * h * 4);
                    for (let yy = 4; yy < 12; yy++) for (let xx = 2; xx < 12; xx++) d[(yy * w + xx) * 4 + 3] = 200;
                    // A soft edge pixel the cut drops.
                    d[(3 * w + 2) * 4 + 3] = 60;
                    return { data: d };
                },
                createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), w, h }),
                putImageData: (img) => { c.painted = img; }
            });
            return c;
        };
    }
    const colourAt = (pic, x, y) => { const d = pic.painted.data, i = (y * pic.painted.w + x) * 4; return [...d.slice(i, i + 4)]; };

    it('one text drawing; white and coloured, hard-edged, with a black outline round the text', () => {
        const log = { texts: 0 };
        const p = popPictures('+12k', maker(log));
        expect(log.texts).toBe(1);
        const green = [1, 3, 5].map(i => parseInt(POP_COLOUR.slice(i, i + 2), 16));
        expect(colourAt(p.white, 5, 6)).toEqual([255, 255, 255, 255]);
        expect(colourAt(p.coloured, 5, 6)).toEqual([...green, 255]);
        // The pixel left of the text: outline. Its soft edge above: outline, not a faded text pixel.
        expect(colourAt(p.white, 1, 6)).toEqual([0, 0, 0, 255]);
        expect(colourAt(p.white, 2, 3)).toEqual([0, 0, 0, 255]);
        // Far from the text: nothing.
        expect(colourAt(p.white, 13, 18)[3]).toBe(0);
        for (const pic of [p.white, p.coloured]) for (let i = 3; i < pic.painted.data.length; i += 4) expect([0, 255]).toContain(pic.painted.data[i]);
    });

    it('a canvas that cannot draw gives no pop', () => {
        expect(popPictures('+1', () => ({ getContext: () => null }))).toBeNull();
    });
});
