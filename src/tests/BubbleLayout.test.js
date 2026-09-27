import { describe, it, expect } from 'vitest';
import { layoutStacks, bubbleAnchorY, BUBBLE_TAIL_PX } from '../ui/components/board/bubbleLayout.js';
import { tokenSizeFor, TOKEN_SURFACE, boardScaleAt } from '../ui/components/base/TokenSprite.jsx';

const MAT = { w: 1000, h: 600 };
const rect = (it, o) => ({ l: it.x - it.w / 2 + o.dx, r: it.x + it.w / 2 + o.dx, t: it.y - it.h + o.dy, b: it.y + o.dy });
const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

describe('Speech bubble layout', () => {
    it('leaves a lone stack exactly over its hero', () => {
        const out = layoutStacks([{ id: 'a', x: 500, y: 300, w: 100, h: 20 }], MAT);
        expect(out.get('a')).toEqual({ dx: 0, dy: 0 });
    });

    it('slides a stack sideways rather than sit on another', () => {
        const items = [
            { id: 'a', x: 500, y: 300, w: 100, h: 20 },
            { id: 'b', x: 520, y: 300, w: 100, h: 20 }
        ];
        const out = layoutStacks(items, MAT);
        expect(out.get('a')).toEqual({ dx: 0, dy: 0 });      // the earlier one keeps its place
        expect(out.get('b').dx).not.toBe(0);
        expect(overlap(rect(items[0], out.get('a')), rect(items[1], out.get('b')))).toBe(false);
    });

    it('keeps every stack inside the mat', () => {
        const items = [
            { id: 'left', x: 10, y: 300, w: 100, h: 20 },
            { id: 'right', x: 995, y: 300, w: 100, h: 20 },
            { id: 'top', x: 500, y: 5, w: 100, h: 20 }
        ];
        const out = layoutStacks(items, MAT);
        for (const it of items) {
            const r = rect(it, out.get(it.id));
            expect(r.l).toBeGreaterThanOrEqual(0);
            expect(r.r).toBeLessThanOrEqual(MAT.w);
            expect(r.t).toBeGreaterThanOrEqual(0);
        }
    });

    it('lifts a stack above the others when there is no room beside', () => {
        // A mat only just wide enough for one: nothing fits beside.
        const narrow = { w: 100, h: 600 };
        const items = [
            { id: 'a', x: 50, y: 300, w: 100, h: 20 },
            { id: 'b', x: 50, y: 300, w: 100, h: 20 }
        ];
        const out = layoutStacks(items, narrow);
        expect(out.get('b').dy).toBeLessThan(0);
        expect(overlap(rect(items[0], out.get('a')), rect(items[1], out.get('b')))).toBe(false);
    });

    it('leaves eight heroes on one spot with no two bubbles overlapping', () => {
        const items = Array.from({ length: 8 }, (_, i) => ({ id: `h${i}`, x: 500, y: 300, w: 140, h: 44 }));
        const out = layoutStacks(items, MAT);
        const rects = items.map(it => rect(it, out.get(it.id)));
        for (let i = 0; i < rects.length; i += 1) {
            for (let j = i + 1; j < rects.length; j += 1) expect(overlap(rects[i], rects[j])).toBe(false);
            expect(rects[i].l).toBeGreaterThanOrEqual(0);
            expect(rects[i].r).toBeLessThanOrEqual(MAT.w);
            expect(rects[i].t).toBeGreaterThanOrEqual(0);
        }
    });

    it('gives the same answer for the same input', () => {
        const items = [
            { id: 'a', x: 500, y: 300, w: 100, h: 20 },
            { id: 'b', x: 510, y: 300, w: 100, h: 20 }
        ];
        expect(layoutStacks(items, MAT)).toEqual(layoutStacks(items, MAT));
    });

    it('puts the tail just above the head at every mat scale (FB-20)', () => {
        for (const fit of [0.21, 0.35, 0.5, 0.75, 1, 1.5, 2]) {
            const artPx = tokenSizeFor(TOKEN_SURFACE.BOARD, 1, boardScaleAt(fit));
            const heroY = 400;
            const artTop = heroY - artPx / 2;          // the head reaches the top row of the art
            const anchor = bubbleAnchorY(heroY, artPx);
            const tailTip = anchor + BUBBLE_TAIL_PX;
            expect(tailTip).toBeLessThanOrEqual(artTop);     // never over the head
            expect(artTop - tailTip).toBeLessThanOrEqual(4); // but only just above it
        }
    });
});
