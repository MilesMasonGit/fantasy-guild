import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';

/**
 * CR3-010 — the loot particle canvas sleeps when it has nothing to draw.
 *
 * It used to ask for an animation frame every frame for the whole session,
 * clearing an empty full-screen canvas sixty times a second. Now the loop
 * stops after the frame that draws nothing, and a collected sprite wakes it.
 *
 * `requestAnimationFrame` is replaced by a queue this test flushes by hand, so
 * "a frame was requested" is simply "the queue is not empty".
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
const fakeCtx = new Proxy({}, {
    get: (target, key) => (key in target ? target[key] : () => ({ addColorStop() {} })),
    set: (target, key, value) => { target[key] = value; return true; }
});

/** Runs every frame requested so far, advancing the clock by `ms`. */
function frame(ms = 16) {
    clock += ms;
    const due = queue;
    queue = [];
    for (const cb of due) cb(clock);
}

/** Runs frames until the loop stops asking for them (or gives up). */
function runUntilAsleep(limit = 2000) {
    let n = 0;
    while (queue.length && n < limit) { frame(); n++; }
    return n;
}

const collected = () => EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
    kind: 'item', refId: 'item_oak_log', quantity: 1,
    fromScreenX: 100, fromScreenY: 100, toScreenX: 400, toScreenY: 300
});

describe('ParticleOverlay sleeps when empty (CR3-010)', () => {
    beforeEach(() => {
        queue = [];
        clock = 0;
        vi.spyOn(performance, 'now').mockImplementation(() => clock);
        vi.stubGlobal('requestAnimationFrame', (cb) => { queue.push(cb); return queue.length; });
        vi.stubGlobal('cancelAnimationFrame', () => { queue = []; });
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx);
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('asks for no frame while nothing has been collected', () => {
        render(React.createElement(ParticleOverlay, { disabled: false }));
        expect(queue.length).toBe(0);
    });

    it('a collected sprite wakes it; it goes back to sleep after the frame that draws nothing', () => {
        render(React.createElement(ParticleOverlay, { disabled: false }));
        act(() => { collected(); });
        expect(queue.length).toBe(1);

        const frames = runUntilAsleep();
        // It ran the flight (~0.65–0.8 s) and the sparkles' fade, then stopped.
        expect(frames).toBeGreaterThan(30);
        expect(frames).toBeLessThan(2000);
        expect(queue.length).toBe(0);

        // Asleep for good: time passing requests nothing.
        frame(1000);
        expect(queue.length).toBe(0);

        // And the next collection wakes it again.
        act(() => { collected(); });
        expect(queue.length).toBe(1);
    });

    it('two collections in one frame ask for one frame, not two', () => {
        render(React.createElement(ParticleOverlay, { disabled: false }));
        act(() => { collected(); collected(); });
        expect(queue.length).toBe(1);
    });

    it('a disabled overlay is never woken', () => {
        render(React.createElement(ParticleOverlay, { disabled: true }));
        act(() => { collected(); });
        expect(queue.length).toBe(0);
    });
});
