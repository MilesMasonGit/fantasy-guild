import { describe, it, expect, afterEach, vi } from 'vitest';
import { surfaceAtPoint, snapshotDndRegions, surfaceWithinRegions } from '../ui/dnd/DndKit.jsx';
import { DND_SURFACE } from '../ui/dnd/dragConstants.js';

/**
 * ⭐ the provider used to call `surfaceAtPoint` (two whole-document
 * `querySelectorAll` calls plus a `getBoundingClientRect` per region) on
 * EVERY pointer move during a drag. The regions cannot move mid-drag (a
 * window resize cancels the drag), so the fix snapshots them once, at drag
 * start, and checks the cached array on every move instead.
 */

const made = [];
function region(kind, rect) {
    const el = document.createElement('div');
    el.setAttribute('data-dnd-region', kind);
    el.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height });
    document.body.appendChild(el);
    made.push(el);
    return el;
}
afterEach(() => { for (const el of made.splice(0)) el.remove(); vi.restoreAllMocks(); });

describe('surfaceWithinRegions matches surfaceAtPoint’s priority (CR3-403)', () => {
    it('a drawer wins over the board where they overlap; the board elsewhere; nothing outside', () => {
        region(DND_SURFACE.BOARD, { left: 0, top: 0, width: 1000, height: 700 });
        region(DND_SURFACE.DRAWER, { left: 600, top: 0, width: 400, height: 700 });
        const regions = snapshotDndRegions();

        expect(surfaceWithinRegions(700, 300, regions)).toBe(DND_SURFACE.DRAWER);
        expect(surfaceWithinRegions(100, 300, regions)).toBe(DND_SURFACE.BOARD);
        expect(surfaceWithinRegions(1500, 300, regions)).toBeNull();

        // Same points, same answers as the DOM-querying original.
        expect(surfaceAtPoint(700, 300)).toBe(DND_SURFACE.DRAWER);
        expect(surfaceAtPoint(100, 300)).toBe(DND_SURFACE.BOARD);
        expect(surfaceAtPoint(1500, 300)).toBeNull();
    });
});

describe('a snapshot costs no DOM query to check (CR3-403)', () => {
    it('checking a cached snapshot never calls querySelectorAll', () => {
        region(DND_SURFACE.DRAWER, { left: 600, top: 0, width: 400, height: 700 });
        const regions = snapshotDndRegions();

        const spy = vi.spyOn(document, 'querySelectorAll');
        for (let i = 0; i < 20; i++) surfaceWithinRegions(700, 300, regions);
        expect(spy).not.toHaveBeenCalled();
    });

    it('a snapshot is frozen at the moment it is taken: a region added afterwards is invisible to it', () => {
        region(DND_SURFACE.BOARD, { left: 0, top: 0, width: 1000, height: 700 });
        const regions = snapshotDndRegions();

        // A drawer opens after the snapshot (what "cannot change mid-drag" relies on).
        region(DND_SURFACE.DRAWER, { left: 600, top: 0, width: 400, height: 700 });

        expect(surfaceWithinRegions(700, 300, regions)).toBe(DND_SURFACE.BOARD);
        // A fresh snapshot (as drag-start would take for the NEXT drag) does see it.
        expect(surfaceWithinRegions(700, 300, snapshotDndRegions())).toBe(DND_SURFACE.DRAWER);
    });
});
