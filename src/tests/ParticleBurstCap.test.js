// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';

/**
 * ⭐ **A big collection flies at most 12 sparkles, 60 ms apart** (owner
 * R6-Q4 = A).
 */

vi.mock('../systems/core/SettingsManager.js', () => ({
    SettingsManager: { get: () => true }
}));
vi.mock('../config/registries/itemRegistry.js', () => ({
    getItem: (id) => ({ id, icon: '*', color: '#4ade80' })
}));
vi.mock('../utils/AssetManager.js', () => ({ resolveSpritePath: () => '' }));
vi.mock('../state/GameState.js', () => ({ GameState: { heroes: [] } }));

import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ParticleOverlay } from '../ui/components/base/ParticleOverlay.jsx';

let queue;
let clock;
let landed;
let unsubLanded;
const fakeCtx = new Proxy({}, {
    get: (target, key) => (key in target ? target[key] : () => ({ addColorStop() {} })),
    set: (target, key, value) => { target[key] = value; return true; }
});

function frame(ms = 16) {
    clock += ms;
    const due = queue;
    queue = [];
    for (const cb of due) cb(clock);
}
function runUntilAsleep(limit = 4000) {
    let n = 0;
    while (queue.length && n < limit) { frame(); n++; }
}

const collected = (i = 0) => EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
    kind: 'item', refId: 'item_oak_log', quantity: 1,
    fromScreenX: 100 + i, fromScreenY: 100, toScreenX: 400, toScreenY: 300
});

beforeEach(() => {
    queue = [];
    clock = 0;
    landed = [];
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.stubGlobal('requestAnimationFrame', (cb) => { queue.push(cb); return queue.length; });
    vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);
    unsubLanded = EventBus.subscribe('particle_landed', () => landed.push(clock));
});

afterEach(() => {
    unsubLanded?.();
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('⭐ the burst cap (CR3-352)', () => {
    it('forty collections in one go: twelve sparkles fly, staggered 60 ms apart', () => {
        render(React.createElement(ParticleOverlay, { disabled: false }));
        act(() => { for (let i = 0; i < 40; i++) collected(i); });
        runUntilAsleep();
        expect(landed.length).toBe(12);
        // Each starts 60 ms after the one before and flies 650–800 ms, so the
        // twelfth lands well after the first: 11 × 60 = 660 ms of stagger.
        expect(landed[landed.length - 1] - landed[0]).toBeGreaterThan(660 - 150);
    });

    it('the first sparkle after a quiet spell flies at once', () => {
        render(React.createElement(ParticleOverlay, { disabled: false }));
        act(() => { for (let i = 0; i < 20; i++) collected(i); });
        runUntilAsleep();
        frame(1000);                       // quiet
        landed = [];
        const at = clock;
        act(() => { collected(); });
        runUntilAsleep();
        expect(landed.length).toBe(1);
        expect(landed[0] - at).toBeLessThanOrEqual(800 + 16);
    });

    it('a handful well under the cap all fly', () => {
        render(React.createElement(ParticleOverlay, { disabled: false }));
        act(() => { for (let i = 0; i < 5; i++) collected(i); });
        runUntilAsleep();
        expect(landed.length).toBe(5);
    });
});
