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

const { OrderDragLine, snapTransform } = await import('../ui/components/board/OrderDragLine.jsx');

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

    it('the ghost moves by whole screen pixels from the pointer to the Token’s centre', () => {
        const rect = { left: 10, top: 20, width: matW() / 2 };
        expect(snapTransform({ x: 210, y: 170 }, rect, { x: 400, y: 300 })).toBe('');
        expect(snapTransform({ x: 200, y: 160 }, rect, { x: 400, y: 300 })).toBe('translate(10px, 10px)');
        expect(snapTransform(null, rect, { x: 400, y: 300 })).toBe('');
    });
});

describe('on the mat, while a hero is carried', () => {
    const matEl = document.createElement('div');
    matEl.getBoundingClientRect = () => ({ left: 0, top: 0, width: matW(), height: 600, right: matW(), bottom: 600 });
    const matRef = { current: matEl };
    const still = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });

    const mount = (kind = DRAG_KIND.FLAG) => {
        window.matchMedia = still;   // reduced motion: the dashes stand still, so a path can be predicted
        const ghost = document.createElement('div');
        ghost.setAttribute('data-order-ghost', 'h1');
        document.body.appendChild(ghost);
        const view = render(h(DeckDndContext.Provider, { value: { isDragging: true, activePayload: { kind, heroId: 'h1' } } },
            h('div', null, h(OrderDragLine, { matRef }))));
        return { ...view, ghost };
    };
    const moveTo = async (x, y) => act(async () => {
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }));
        await new Promise(r => setTimeout(r, 60));
    });
    const scale = boardScaleAt(1);
    const cell = (p) => ({ x: Math.floor(p.x / scale), y: Math.floor(p.y / scale) });
    const lineTo = (p) => dashedLinePath(cell({ x: 100, y: 100 }), cell(p), 0);
    const pathOf = (container) => container.querySelector('svg[data-order-line] path:last-child').getAttribute('d');

    afterEach(() => {
        document.querySelectorAll('[data-order-ghost]').forEach(n => n.remove());
        delete window.matchMedia;
    });

    it.each([DRAG_KIND.FLAG, DRAG_KIND.HERO])('over a Token they can work (%s), the flag and the line end snap to its centre; off it, back to the pointer', async (kind) => {
        const { container, ghost } = mount(kind);
        await moveTo(420, 310);
        expect(pathOf(container)).toBe(lineTo(TREE));
        expect(ghost.style.transform).toBe('translate(-20px, -10px)');
        expect(container.querySelector('[data-order-reason]')).toBeNull();
        await moveTo(600, 310);
        expect(pathOf(container)).toBe(lineTo({ x: 600, y: 310 }));
        expect(ghost.style.transform).toBe('');
    });

    it('over a Token they cannot work, no snap and a red bubble over it says why; leaving it takes the bubble away', async () => {
        const { container, ghost } = mount();
        await moveTo(790, 320);
        expect(ghost.style.transform).toBe('');
        expect(pathOf(container)).toBe(lineTo({ x: 790, y: 320 }));
        const bubble = container.querySelector(`[data-order-reason="${VEIN.id}"]`);
        expect(bubble?.textContent).toBe('Needs Pickaxe');
        expect(bubble.querySelector('[data-speech-tone]').getAttribute('data-speech-tone')).toBe('cant');
        await moveTo(600, 320);
        expect(container.querySelector('[data-order-reason]')).toBeNull();
    });

    it('the drag ending takes the bubble and the snap away, and nothing is left mounted', async () => {
        const { container, ghost, rerender } = mount();
        await moveTo(400, 300);
        expect(ghost.style.transform).toBe('');   // the pointer is on the centre already
        await moveTo(410, 300);
        expect(ghost.style.transform).toBe('translate(-10px, 0px)');
        rerender(h(DeckDndContext.Provider, { value: { isDragging: false, activePayload: null } }, h('div', null, h(OrderDragLine, { matRef }))));
        expect(ghost.style.transform).toBe('');
        expect(container.querySelector('svg')).toBeNull();
        expect(container.querySelector('[data-order-reason]')).toBeNull();
    });
});
