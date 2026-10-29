// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { matW } from '../config/matGeometry.js';
import { boardScaleAt } from '../ui/components/base/TokenSprite.jsx';
import { dashedLinePath } from '../ui/components/board/orderLine.js';
import { createOrderAim } from '../ui/components/board/orderAim.js';

/**
 * ⭐ While a hero is carried, over a Token they can work the flag and the order line's end snap to
 * its centre; over one they cannot, a red bubble over it says why, before the drop. What a drop
 * would do is worked out once per Token the pointer comes onto, never per frame.
 */

const TREE = { id: 't_tree', typeId: 'tree', x: 400, y: 300 };
const VEIN = { id: 't_vein', typeId: 'vein', x: 800, y: 300 };
const RADIUS = 40;
const tokens = [TREE, VEIN];
const hitOf = (point) => tokens.find(t => Math.hypot(point.x - t.x, point.y - t.y) <= RADIUS) || null;
const verdictOf = (heroId, instance) => (instance.id === TREE.id ? { snap: true, reason: null } : { snap: false, reason: 'Needs Pickaxe' });

vi.mock('../systems/board/HeroMotion.js', () => ({
    heroPointOf: (heroId) => (heroId === 'h1' ? { x: 100, y: 100 } : null)
}));
vi.mock('../ui/components/board/orderAim.js', async (importOriginal) => {
    const real = await importOriginal();
    return { ...real, createOrderAim: (heroId, opts) => real.createOrderAim(heroId, opts || { hit: hitOf, aimAt: verdictOf }) };
});

const { OrderDragLine, snapShift } = await import('../ui/components/board/OrderDragLine.jsx');

const h = React.createElement;
afterEach(() => cleanup());

describe('the aim: the Token under the pointer and what a drop there would do', () => {
    it('asks once per Token the pointer comes onto, and hands back the same answer while it stays', () => {
        const aimAt = vi.fn(verdictOf);
        const aim = createOrderAim('h1', { hit: hitOf, aimAt });
        const first = aim({ x: 400, y: 300 });
        expect(first).toMatchObject({ instance: TREE, snap: true, reason: null });
        for (let i = 0; i < 20; i++) expect(aim({ x: 400 + i, y: 300 - i })).toBe(first);
        expect(aimAt).toHaveBeenCalledTimes(1);
        expect(aim({ x: 600, y: 300 })).toMatchObject({ instance: null, snap: false, reason: null });
        expect(aim({ x: 800, y: 300 })).toMatchObject({ instance: VEIN, snap: false, reason: 'Needs Pickaxe' });
        expect(aim(null)).toMatchObject({ instance: null, snap: false });
        expect(aimAt).toHaveBeenCalledTimes(2);
    });

    it('a Token the hero cannot work never snaps, whatever else it says', () => {
        const aim = createOrderAim('h1', { hit: hitOf, aimAt: () => ({ snap: false, reason: null }) });
        expect(aim({ x: 400, y: 300 })).toMatchObject({ instance: TREE, snap: false, reason: null });
    });

    it('the ghost is moved from where it is drawn, not from the pointer', () => {
        // Drawn with its middle at (210, 170), already wearing a move of (5, -5): it came from (205, 175).
        const rect = { left: 200, top: 160, width: 20, height: 20 };
        expect(snapShift(rect, { x: 5, y: -5 }, { x: 400, y: 300 })).toEqual({ x: 195, y: 125 });
        expect(snapShift(rect, { x: 0, y: 0 }, { x: 210, y: 170 })).toEqual({ x: 0, y: 0 });
    });
});

describe('on the mat, while a hero is carried', () => {
    const matEl = document.createElement('div');
    matEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: 600, right: matW(), bottom: 600 });
    const matRef = { current: matEl };
    const still = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
    const translateOf = (el) => {
        const m = /translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\)/.exec(el.style.transform || '');
        return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
    };

    /**
     * The drag library's overlay round the ghost, as the browser has it: it carries the ghost's
     * middle to the pointer by its own style, but only when the library re-renders (`follow`), a
     * task after the pointer moved; `lag: false` follows at once. The ghost's box is where the
     * overlay is plus the ghost's own move.
     */
    const mount = (kind = DRAG_KIND.FLAG, { lag = false } = {}) => {
        window.matchMedia = still;   // reduced motion: the dashes stand still, so a path can be predicted
        const overlay = document.createElement('div');
        const ghost = document.createElement('div');
        ghost.setAttribute('data-order-ghost', 'h1');
        overlay.appendChild(ghost);
        document.body.appendChild(overlay);
        let at = { x: 0, y: 0 };
        const follow = (p) => { at = { ...p }; overlay.style.transform = `translate(${p.x - 10}px, ${p.y - 10}px)`; };
        ghost.getBoundingClientRect = () => {
            const t = translateOf(ghost);
            return { left: at.x - 10 + t.x, top: at.y - 10 + t.y, width: 20, height: 20 };
        };
        const onMove = (e) => { if (!lag) follow({ x: e.clientX, y: e.clientY }); };
        window.addEventListener('pointermove', onMove);
        const view = render(h(DeckDndContext.Provider, { value: { isDragging: true, activePayload: { kind, heroId: 'h1' } } },
            h('div', null, h(OrderDragLine, { matRef }))));
        const middle = () => { const r = ghost.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
        return { ...view, ghost, follow, middle, off: () => window.removeEventListener('pointermove', onMove) };
    };
    let mounted = null;
    const mountOnce = (...a) => (mounted = mount(...a));
    const frame = () => new Promise(r => setTimeout(r, 40));
    const moveTo = async (x, y) => act(async () => {
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }));
        await frame();
    });
    const scale = boardScaleAt(1);
    const cell = (p) => ({ x: Math.floor(p.x / scale), y: Math.floor(p.y / scale) });
    const lineTo = (p) => dashedLinePath(cell({ x: 100, y: 100 }), cell(p), 0);
    const pathOf = (container) => container.querySelector('svg[data-order-line] path:last-child').getAttribute('d');
    const close = (a, b) => Math.abs(a.x - b.x) < 0.02 && Math.abs(a.y - b.y) < 0.02;

    afterEach(() => {
        mounted?.off();
        mounted = null;
        document.querySelectorAll('[data-order-ghost]').forEach(n => n.parentElement.remove());
        delete window.matchMedia;
    });

    it.each([DRAG_KIND.FLAG, DRAG_KIND.HERO])('over a Token they can work (%s), the flag and the line end snap to its centre; off it, back to the pointer', async (kind) => {
        const { container, ghost, middle } = mountOnce(kind);
        await moveTo(420, 310);
        expect(pathOf(container)).toBe(lineTo(TREE));
        expect(close(middle(), TREE)).toBe(true);
        expect(container.querySelector('[data-order-reason]')).toBeNull();
        await moveTo(600, 310);
        expect(pathOf(container)).toBe(lineTo({ x: 600, y: 310 }));
        expect(ghost.style.transform).toBe('');
        expect(middle()).toEqual({ x: 600, y: 310 });
    });

    it('⭐ a snapped flag stands still while the pointer moves about inside the Token, even with the overlay a render behind the pointer', async () => {
        const { container, middle, follow } = mountOnce(DRAG_KIND.FLAG, { lag: true });
        follow({ x: 430, y: 300 });
        await moveTo(430, 300);
        const seen = [];
        const lines = new Set();
        for (let i = 0; i < 24; i++) {
            const p = { x: 400 + 25 * Math.cos(i), y: 300 + 25 * Math.sin(i * 1.7) };
            // The pointer has moved; the overlay has not caught up yet: this frame is painted.
            await moveTo(p.x, p.y);
            seen.push(middle());
            lines.add(pathOf(container));
            // The library re-renders, moving its overlay to the pointer: painted again.
            await act(async () => { follow(p); await new Promise(r => setTimeout(r, 0)); });
            seen.push(middle());
        }
        for (const m of seen) expect(m.x).toBeCloseTo(TREE.x, 2), expect(m.y).toBeCloseTo(TREE.y, 2);
        expect([...lines]).toEqual([lineTo(TREE)]);
    });

    it('over a Token they cannot work, no snap and a red bubble over it says why; leaving it takes the bubble away', async () => {
        const { container, ghost, middle } = mountOnce();
        await moveTo(790, 320);
        expect(ghost.style.transform).toBe('');
        expect(middle()).toEqual({ x: 790, y: 320 });
        expect(pathOf(container)).toBe(lineTo({ x: 790, y: 320 }));
        const bubble = container.querySelector(`[data-order-reason="${VEIN.id}"]`);
        expect(bubble?.textContent).toBe('Needs Pickaxe');
        expect(bubble.querySelector('[data-speech-tone]').getAttribute('data-speech-tone')).toBe('cant');
        await moveTo(600, 320);
        expect(container.querySelector('[data-order-reason]')).toBeNull();
    });

    it('the drag ending takes the bubble and the snap away, and nothing is left mounted', async () => {
        const { container, ghost, middle, rerender } = mountOnce();
        await moveTo(410, 300);
        expect(close(middle(), TREE)).toBe(true);
        expect(ghost.style.transform).not.toBe('');
        rerender(h(DeckDndContext.Provider, { value: { isDragging: false, activePayload: null } }, h('div', null, h(OrderDragLine, { matRef }))));
        expect(ghost.style.transform).toBe('');
        expect(container.querySelector('svg')).toBeNull();
        expect(container.querySelector('[data-order-reason]')).toBeNull();
    });
});
