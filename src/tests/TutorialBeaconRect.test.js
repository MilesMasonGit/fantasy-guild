import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { Profiler } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { TutorialBeacon } from '../ui/components/base/TutorialAideOverlay.jsx';

/**
 * ⭐ **A tutorial beacon re-renders only when its target moves**.
 */

const h = React.createElement;
let queue;
let commits;

function frame() {
    const due = queue;
    queue = [];
    for (const cb of due) cb(performance.now());
}

let target;
let rect;

beforeEach(() => {
    queue = [];
    commits = 0;
    vi.stubGlobal('requestAnimationFrame', (cb) => { queue.push(cb); return queue.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    rect = { left: 100, top: 200, width: 80, height: 40 };
    target = document.createElement('div');
    target.setAttribute('data-beacon-target', 'true');
    target.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top });
    document.body.appendChild(target);
});

afterEach(() => {
    cleanup();
    target.remove();
    vi.unstubAllGlobals();
});

const mountBeacon = () => render(h(Profiler, { id: 'beacon', onRender: () => { commits++; } },
    h(TutorialBeacon, { target: '[data-beacon-target]', keyId: 'b' })));

describe('⭐ the beacon tracks its target without re-rendering every frame', () => {
    it('a still target: frames go by, no re-render', () => {
        mountBeacon();
        act(() => { frame(); });
        const settled = commits;
        for (let i = 0; i < 20; i++) act(() => { frame(); });
        expect(commits - settled).toBe(0);
    });

    it('a moving target: it follows, one re-render per move', () => {
        const { container } = mountBeacon();
        act(() => { frame(); });
        const settled = commits;
        rect = { ...rect, left: 160 };
        for (let i = 0; i < 3; i++) act(() => { frame(); });
        // The move, plus at most React's one confirming pass before it bails out.
        expect(commits - settled).toBeGreaterThanOrEqual(1);
        expect(commits - settled).toBeLessThanOrEqual(2);
        const moved = commits;
        for (let i = 0; i < 10; i++) act(() => { frame(); });
        expect(commits - moved).toBe(0);
        // Centred on the moved target: 160 + 40, radius max(40, 40 + 18) = 58.
        const beacon = container.querySelector('div[style*="position: fixed"]') || document.querySelector('div[style*="position: fixed"]');
        expect(beacon.style.left).toBe(`${200 - 58}px`);
    });
});
