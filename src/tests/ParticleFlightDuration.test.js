// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';

/** An item flight takes longer the further it has to go, between a floor and a ceiling. */

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
import {
    ParticleOverlay, flightDurationMs, FLIGHT_MIN_MS, FLIGHT_MAX_MS
} from '../ui/components/base/ParticleOverlay.jsx';

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

/** One flight of `px` pixels across; how long it took to land, in ms. */
function flightTime(px) {
    landed = [];
    const at = clock;
    act(() => {
        EventBus.publish(BOARD_EVENTS.SPRITE_COLLECTED, {
            kind: 'item', refId: 'item_oak_log', quantity: 1,
            fromScreenX: 100, fromScreenY: 100, toScreenX: 100 + px, toScreenY: 100
        });
    });
    for (let n = 0; queue.length && n < 4000; n++) frame(4);
    expect(landed.length).toBe(1);
    return landed[0] - at;
}

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

describe('flightDurationMs', () => {
    it('grows with distance and stays between the floor and the ceiling', () => {
        expect(flightDurationMs(0)).toBe(FLIGHT_MIN_MS);
        expect(flightDurationMs(60)).toBeLessThan(flightDurationMs(400));
        expect(flightDurationMs(400)).toBeLessThan(flightDurationMs(900));
        expect(flightDurationMs(100000)).toBe(FLIGHT_MAX_MS);
        expect(flightDurationMs(NaN)).toBe(FLIGHT_MIN_MS);
    });
});

describe('item flight in the overlay', () => {
    it('a short hop lands well before a long flight', () => {
        render(React.createElement(ParticleOverlay, { disabled: false }));
        const short = flightTime(80);
        frame(1000);
        const long = flightTime(900);
        expect(short).toBeLessThan(long - 150);
        expect(short).toBeLessThanOrEqual(flightDurationMs(80) + 20);
        expect(long).toBeLessThanOrEqual(FLIGHT_MAX_MS + 20);
        expect(short).toBeGreaterThanOrEqual(FLIGHT_MIN_MS);
    });
});
