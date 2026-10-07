// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { drawnPoint } from './fixtures/drawnPoint.js';

/**
 * The test helper the ~37 mat-position assertions read. It must give the same
 * answer whether an element is placed by `left`/`top` (today) or by a
 * `transform`, so that change leaves those assertions green.
 */
describe('drawnPoint reads where an element is drawn, however it is placed (CR3-556)', () => {
    const el = (style) => {
        const div = document.createElement('div');
        Object.assign(div.style, style);
        return div;
    };

    it('reads left/top', () => {
        expect(drawnPoint(el({ left: '536px', top: '336px' }))).toEqual({ x: 536, y: 336 });
    });

    it('reads a pixel translate the same as left/top', () => {
        expect(drawnPoint(el({ transform: 'translate(536px, 336px)' }))).toEqual({ x: 536, y: 336 });
        expect(drawnPoint(el({ transform: 'translate3d(536px, 336px, 0px)' }))).toEqual({ x: 536, y: 336 });
    });

    it('adds a translate on top of left/top, and ignores percent and scale', () => {
        expect(drawnPoint(el({ left: '10px', top: '20px', transform: 'translateY(5px) scale(2)' })))
            .toEqual({ x: 10, y: 25 });
        expect(drawnPoint(el({ left: '10px', top: '20px', transform: 'translate(-50%, -50%)' })))
            .toEqual({ x: 10, y: 20 });
    });

    it('is NaN for an element with no position at all, as parseFloat(style.left) was', () => {
        const p = drawnPoint(el({}));
        expect(Number.isNaN(p.x)).toBe(true);
        expect(Number.isNaN(p.y)).toBe(true);
    });
});
