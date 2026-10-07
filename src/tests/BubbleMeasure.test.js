import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { EventBus } from '../systems/core/EventBus.js';
import { HeroBubbleLayer } from '../ui/components/board/HeroBubbleLayer.jsx';

/**
 * ⭐ **Speech bubbles are measured when what they say changes, not every
 * render** (R6 rule 9).
 */

const h = React.createElement;
let reads;

beforeEach(() => {
    reads = 0;
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function () {
        if (this.hasAttribute?.('data-hero-bubble-stack')) reads++;
        return 120;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => 22);
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

const heroAt = (x) => [{ heroId: 'hm', state: 'idle', x, y: 500, moving: true, tokenId: null, alert: null }];

describe('⭐ bubble stacks are measured on what they say', () => {
    it('a walking hero with a bubble: steps cause no measuring', () => {
        const { rerender } = render(h(HeroBubbleLayer, { heroes: heroAt(400) }));
        act(() => { EventBus.publish('hero_leveled', { heroId: 'hm', skillName: 'Logging', newLevel: 5 }); });
        expect(reads).toBeGreaterThan(0);          // measured when it appeared
        const settled = reads;
        for (let x = 404; x < 440; x += 4) rerender(h(HeroBubbleLayer, { heroes: heroAt(x) }));
        expect(reads - settled).toBe(0);
    });

    it('a new line is measured', () => {
        const { rerender } = render(h(HeroBubbleLayer, { heroes: heroAt(400) }));
        act(() => { EventBus.publish('hero_leveled', { heroId: 'hm', skillName: 'Logging', newLevel: 5 }); });
        rerender(h(HeroBubbleLayer, { heroes: heroAt(404) }));
        const settled = reads;
        act(() => { EventBus.publish('hero_leveled', { heroId: 'hm', skillName: 'Mining', newLevel: 9 }); });
        expect(reads - settled).toBeGreaterThan(0);
    });
});
