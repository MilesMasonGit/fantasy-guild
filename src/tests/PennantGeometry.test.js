// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import path from 'path';
import sharp from 'sharp';
import {
    FLAG_PX, PENNANT_ART_PX, POLE_BASE, FLAG_CLOTH, flagOrigin, pinnedFlagPoint, PIN_INSET
} from '../ui/components/board/flagGeometry.js';
import { PENNANT_SRC } from '../ui/components/board/FlagMark.jsx';

/**
 * ⭐ The flag's numbers are measured on the pennant's own pixels: if the art is redrawn with its
 * pole or cloth somewhere else, this says so before the mat plants flags in the wrong place.
 */

let art;
const opaque = (x, y) => art.data[(y * art.w + x) * 4 + 3] > 0;

beforeAll(async () => {
    const file = path.join(process.cwd(), 'public', PENNANT_SRC);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    art = { data, w: info.width, h: info.height };
});

describe('⭐ the pennant’s geometry matches its art', () => {
    it('is 32 px art drawn at 2× (64 px)', () => {
        expect([art.w, art.h]).toEqual([PENNANT_ART_PX, PENNANT_ART_PX]);
        expect(FLAG_PX).toBe(2 * PENNANT_ART_PX);
    });

    it('the pole foot is the lowest drawn pixel, and POLE_BASE is its centre at 2×', () => {
        const scale = FLAG_PX / PENNANT_ART_PX;
        const foot = { x: Math.floor(POLE_BASE.x / scale), y: Math.floor(POLE_BASE.y / scale) };
        expect(foot).toEqual({ x: 4, y: 31 });
        expect(opaque(foot.x, foot.y)).toBe(true);
        // Nothing else on the bottom row: the pole ends in this one pixel.
        for (let x = 0; x < art.w; x++) if (x !== foot.x) expect(opaque(x, foot.y)).toBe(false);
        expect(POLE_BASE).toEqual({ x: (foot.x + 0.5) * scale, y: (foot.y + 0.5) * scale });
    });

    it('the cloth box holds every drawn pixel right of the pole, and touches its edges', () => {
        const box = {
            left: FLAG_CLOTH.left * art.w, top: FLAG_CLOTH.top * art.h,
            right: FLAG_CLOTH.right * art.w, bottom: FLAG_CLOTH.bottom * art.h
        };
        expect(box).toEqual({ left: 5, top: 3, right: 32, bottom: 28 });
        const inBox = (x, y) => x >= box.left && x < box.right && y >= box.top && y < box.bottom;
        let rows = { top: false, bottom: false }, rightCol = false;
        for (let y = 0; y < art.h; y++) {
            for (let x = 0; x < art.w; x++) {
                if (!opaque(x, y)) continue;
                // Outside the box only the pole, down the left edge.
                if (!inBox(x, y)) expect(x, `(${x}, ${y})`).toBeLessThanOrEqual(5);
                if (inBox(x, y) && y === box.top) rows.top = true;
                if (inBox(x, y) && y === box.bottom - 1) rows.bottom = true;
                if (inBox(x, y) && x === box.right - 1) rightCol = true;
            }
        }
        expect([rows.top, rows.bottom, rightCol]).toEqual([true, true, true]);
    });

    it('the flag’s box stands its pole foot on the flag’s point', () => {
        const { left, top } = flagOrigin({ x: 300, y: 500 });
        expect([left + POLE_BASE.x, top + POLE_BASE.y]).toEqual([300, 500]);
    });

    it('a pinned flag’s pole stands inside the top of its Token, standard or small', () => {
        for (const r of [64, 32]) {
            const p = pinnedFlagPoint({ x: 400, y: 400 }, r);
            expect(p).toEqual({ x: 400, y: 400 - (r - PIN_INSET) });
        }
    });
});
