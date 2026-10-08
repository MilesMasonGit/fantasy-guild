// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { RingBadge, RING_CIRCUMFERENCE, glideOffset } from '../ui/components/board/RingBadge.jsx';
import { GLIDING_RINGS, spawnerRing } from '../ui/components/board/ringRow.js';

/**
 * ⭐ Count rings glide. A Token's charges, a spawner's count and a quest's progress
 * used to jump when their number changed; now the arc slides to the new
 * value over ~0.8 s with a slow ease-out.
 */

const h = React.createElement;
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const arcOf = (container) => container.querySelector('[data-ring-arc]');

describe('which rings glide', () => {
    it('every count: charges, the spawner count and quest progress — nothing else', () => {
        expect([...GLIDING_RINGS].sort()).toEqual(['charges', 'quest', 'spawner']);
    });

    it('a charges ring draws its arc as a full dash pushed back by the empty part', () => {
        const { container } = render(h(RingBadge, { kind: 'charges', fraction: 0.25, text: '5' }));
        const arc = arcOf(container);
        expect(container.firstChild.getAttribute('data-ring-glide')).toBe('true');
        expect(arc.getAttribute('class')).toBe('gi-ring-glide');
        const C = RING_CIRCUMFERENCE.toFixed(3);
        expect(arc.getAttribute('stroke-dasharray')).toBe(`${C} ${C}`);
        expect(Number(arc.style.strokeDashoffset)).toBeCloseTo(0.75 * RING_CIRCUMFERENCE, 2);
        expect(glideOffset(1)).toBe('0.000');
        expect(Number(glideOffset(0))).toBeCloseTo(RING_CIRCUMFERENCE, 2);
    });

    it('the cycle, HP and timer rings keep their plain arc', () => {
        for (const kind of ['hp', 'turn', 'grow']) {
            const { container } = render(h(RingBadge, { kind, fraction: 0.5, text: '1' }));
            expect(arcOf(container).getAttribute('class')).toBeNull();
            expect(arcOf(container).style.strokeDashoffset).toBe('');
            expect(container.firstChild.getAttribute('data-ring-glide')).toBeNull();
            cleanup();
        }
        // The cycle ring is painted imperatively (no fraction): never glides.
        const { container } = render(h(RingBadge, { kind: 'cycle' }));
        expect(arcOf(container).getAttribute('class')).toBeNull();
    });
});

describe('a change glides the SAME arc to the new value', () => {
    it('charges 10 → 9: same element, new offset; the number changes at once', () => {
        const props = { kind: 'charges', text: '10', fraction: 1 };
        const { container, rerender } = render(h(RingBadge, props));
        const arc = arcOf(container);
        expect(Number(arc.style.strokeDashoffset)).toBe(0);
        rerender(h(RingBadge, { ...props, text: '9', fraction: 0.9 }));
        expect(arcOf(container)).toBe(arc);                 // not remounted: the transition can run
        expect(Number(arc.style.strokeDashoffset)).toBeCloseTo(0.1 * RING_CIRCUMFERENCE, 2);
        expect(container.firstChild.getAttribute('data-ring-text')).toBe('9');
    });

    it('a spawner 3/5 → 4/5 glides the same way', () => {
        const a = spawnerRing({ count: 3, cap: 5 });
        const { container, rerender } = render(h(RingBadge, a));
        const arc = arcOf(container);
        rerender(h(RingBadge, spawnerRing({ count: 4, cap: 5 })));
        expect(arcOf(container)).toBe(arc);
        expect(Number(arc.style.strokeDashoffset)).toBeCloseTo(0.2 * RING_CIRCUMFERENCE, 2);
    });

    it('no JavaScript animation: changing a value schedules no frame callback or timer', () => {
        const raf = vi.spyOn(window, 'requestAnimationFrame');
        const timeout = vi.spyOn(window, 'setTimeout');
        const { rerender } = render(h(RingBadge, { kind: 'charges', text: '10', fraction: 1 }));
        rerender(h(RingBadge, { kind: 'charges', text: '9', fraction: 0.9 }));
        expect(raf).not.toHaveBeenCalled();
        expect(timeout).not.toHaveBeenCalled();
    });
});

describe('the transition itself (tailwind.css)', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '../tailwind.css'), 'utf8');

    it('~0.8 s, a slow ease-out, on stroke-dashoffset only', () => {
        const rule = css.slice(css.indexOf('.gi-ring-glide {'), css.indexOf('}', css.indexOf('.gi-ring-glide {')));
        expect(rule).toMatch(/transition:\s*stroke-dashoffset 800ms cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
    });

    it('reduced motion: the ring jumps, as before', () => {
        expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.gi-ring-glide \{ transition: none; \}/);
    });
});
