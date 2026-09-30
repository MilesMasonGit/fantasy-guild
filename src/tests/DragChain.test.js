import { describe, it, expect, afterEach } from 'vitest';
import { smallestWithin, surfaceAtPoint } from '../ui/dnd/DndKit.jsx';
import { DND_SURFACE } from '../ui/dnd/dragConstants.js';

/**
 * ⭐ The drag chain's target choice, pinned before R7's fixes touch it
 * (CR3-413, test first for CR3-400/402/403).
 *
 * `smallestWithin` is the collision rule: of the drop targets under the
 * pointer, which one gets the drop. `surfaceAtPoint` says which big region the
 * pointer is over, for the ghost's bloom. Neither had a test.
 *
 * ⚠ Not here: "a drop over a drawer resolves to a miss" (CR3-402). That is red
 * today (a drop over a drawer lands on the mat under it) and lands with the
 * owner's Shop slide-back ruling.
 */

/** A dnd-kit droppable container with a rect, as `pointerWithin` reads it. */
function container(id, rect, surface = DND_SURFACE.BOARD, { disabled = false } = {}) {
    const r = { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height };
    return { id, disabled, rect: { current: r }, data: { current: { surface } }, _r: r };
}

function args(containers, pointer) {
    return {
        droppableContainers: containers,
        droppableRects: new Map(containers.map(c => [c.id, c._r])),
        pointerCoordinates: pointer,
        active: null,
        collisionRect: null
    };
}

const ids = (hits) => hits.map(h => h.id);

describe('smallestWithin — which target gets the drop (CR3-413)', () => {
    const mat = container('mat', { left: 0, top: 0, width: 1000, height: 700 }, DND_SURFACE.BOARD);
    const drawer = container('drawer', { left: 600, top: 0, width: 400, height: 700 }, DND_SURFACE.DRAWER);
    const slot = container('slot', { left: 650, top: 100, width: 60, height: 60 }, DND_SURFACE.DRAWER);
    const mini = container('mini', { left: 620, top: 300, width: 300, height: 300 }, DND_SURFACE.MINIBOARD);

    it('a drawer droppable beats the mat where they overlap, though it is not the smaller', () => {
        const bigDrawer = container('bigDrawer', { left: 0, top: 0, width: 2000, height: 2000 }, DND_SURFACE.DRAWER);
        expect(ids(smallestWithin(args([mat, bigDrawer], { x: 700, y: 400 })))[0]).toBe('bigDrawer');
    });

    it('inside one surface, the smaller target wins (a slot over its drawer)', () => {
        expect(ids(smallestWithin(args([mat, drawer, slot], { x: 670, y: 120 })))).toEqual(['slot', 'drawer', 'mat']);
    });

    it('a miniboard beats both drawer and mat', () => {
        expect(ids(smallestWithin(args([mat, drawer, mini], { x: 700, y: 400 })))[0]).toBe('mini');
    });

    it('a single hit is returned as it is', () => {
        expect(ids(smallestWithin(args([mat, drawer], { x: 100, y: 100 })))).toEqual(['mat']);
    });

    it('in a gap, the nearest target within 240 px is chosen (the proximity fallback)', () => {
        const a = container('a', { left: 0, top: 0, width: 100, height: 100 });
        const b = container('b', { left: 500, top: 0, width: 100, height: 100 });
        // 150 px right of a, 250 px left of b.
        expect(ids(smallestWithin(args([a, b], { x: 250, y: 50 })))).toEqual(['a']);
        // Exactly 240 px from the nearest edge still counts…
        expect(ids(smallestWithin(args([a], { x: 340, y: 50 })))).toEqual(['a']);
        // …241 px does not.
        expect(ids(smallestWithin(args([a], { x: 341, y: 50 })))).toEqual([]);
    });

    it('the fallback skips a disabled target, and answers nothing with no pointer', () => {
        const off = container('off', { left: 0, top: 0, width: 100, height: 100 }, DND_SURFACE.BOARD, { disabled: true });
        const on = container('on', { left: 0, top: 300, width: 100, height: 100 });
        expect(ids(smallestWithin(args([off, on], { x: 150, y: 150 })))).toEqual(['on']);
        expect(smallestWithin(args([on], null))).toEqual([]);
    });
});

describe('surfaceAtPoint — which region the pointer is over (CR3-413)', () => {
    const made = [];
    function region(kind, rect) {
        const el = document.createElement('div');
        el.setAttribute('data-dnd-region', kind);
        el.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height });
        document.body.appendChild(el);
        made.push(el);
        return el;
    }
    afterEach(() => { for (const el of made.splice(0)) el.remove(); });

    it('a drawer wins over the board where they overlap; the board elsewhere; nothing outside', () => {
        region(DND_SURFACE.BOARD, { left: 0, top: 0, width: 1000, height: 700 });
        region(DND_SURFACE.DRAWER, { left: 600, top: 0, width: 400, height: 700 });
        expect(surfaceAtPoint(700, 300)).toBe(DND_SURFACE.DRAWER);
        expect(surfaceAtPoint(100, 300)).toBe(DND_SURFACE.BOARD);
        expect(surfaceAtPoint(1500, 300)).toBeNull();
    });

    it('a miniboard wins over both', () => {
        region(DND_SURFACE.BOARD, { left: 0, top: 0, width: 1000, height: 700 });
        region(DND_SURFACE.DRAWER, { left: 600, top: 0, width: 400, height: 700 });
        region(DND_SURFACE.MINIBOARD, { left: 650, top: 100, width: 200, height: 200 });
        expect(surfaceAtPoint(700, 150)).toBe(DND_SURFACE.MINIBOARD);
    });
});
