// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';

// React's development build logs every component render to the browser's performance timeline
// with a list of the props that changed. It only does so where `console.timeStamp` exists, as in
// every browser; jsdom has none, so one is given before React loads.
vi.hoisted(() => {
    if (typeof console.timeStamp !== 'function') console.timeStamp = () => {};
});

const React = (await import('react')).default;
const { render, act, cleanup } = await import('@testing-library/react');
const { DndContext } = await import('@dnd-kit/core');
const { SettingsManager } = await import('../systems/core/SettingsManager.js');
const { EngineBootstrap } = await import('../systems/core/EngineBootstrap.js');
const { GameLoop } = await import('../systems/core/GameLoop.js');
const { EventBus } = await import('../systems/core/EventBus.js');
const { GameState } = await import('../state/GameState.js');
const { InventoryManager } = await import('../systems/inventory/InventoryManager.js');
const Atlas = await import('../systems/atlas/Atlas.js');
const { budget } = await import('../systems/atlas/Budget.js');
const { layout } = await import('../systems/atlas/Layout.js');
const { DEV_MAPS } = await import('../systems/atlas/devMaps.js');
const { matW, matH } = await import('../config/matGeometry.js');
const { resetMatTuning } = await import('../config/matTuning.js');
const { resetTuning } = await import('../config/playmatTuning.js');
const { EngineContext } = await import('../ui/context/EngineContext');
const { MatFitProvider } = await import('../ui/components/board/MatFitContext.jsx');
const { MatBoard } = await import('../ui/components/board/MatBoard.jsx');
const { primeGroundSheets, resetGroundSheets } = await import('../ui/components/board/groundSheets.js');
const { resetDrawSwitches } = await import('../ui/dev/perf/drawSwitches.js');
const fixtures = await import('../../bench/fixtures.mjs');
await import('./fixtures/testTokens.js');

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ A new picture of the ground (a travel, a resize, a Ground tuner slider) reaches the ambient
 * life without React's development build listing it. The picture holds the ground's plan, whose
 * arrays run to hundreds of thousands of entries; handed on as a prop, React's development build
 * listed every entry of them in its performance-timeline record of the render (old and new), and
 * the dev game froze for about 2.5 s on every new picture (owner, 2026-10-18: "quite a bit of lag").
 * The production build never lists props.
 */

const h = React.createElement;
const MAT = () => ({ w: matW(), h: matH() });

function flatSheet(path) {
    const out = new Uint8ClampedArray(64 * 64 * 4);
    const shade = path.length * 7 % 200 + 30;
    for (let i = 0; i < out.length; i += 4) {
        out[i] = shade; out[i + 1] = 255 - shade; out[i + 2] = 90; out[i + 3] = 255;
    }
    return out;
}

function fakeContext() {
    return {
        imageSmoothingEnabled: true,
        createImageData: (w, hgt) => ({ width: w, height: hgt, data: new Uint8ClampedArray(w * hgt * 4) }),
        putImageData() {},
        clearRect() {},
        fillRect() {}
    };
}

function settledRegion(names, seed) {
    const summary = budget(names.map(n => DEV_MAPS[n]), { cap: 128 });
    const result = layout(summary, { seed, mat: MAT(), crowding: { hitboxPct: 80, overlapPct: 40 }, artRadius: () => 64 });
    return Atlas.createRegion({ seed, ground: summary.ground, terrain: result.terrain }).region;
}

const mountMat = () => render(h(EngineContext.Provider, { value: { GameState, EventBus } },
    h(DndContext, null, h(MatFitProvider, { value: 1 }, h(MatBoard)))));

/**
 * The props React listed in each performance-timeline record it made, the longest per component.
 * Counted as each record is made: React reuses one options object for all of them.
 */
let measures;
let listed;
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
function recordMeasure(name, options) {
    const n = options?.detail?.devtools?.properties?.length ?? 0;
    const key = String(name).replace(ZERO_WIDTH_SPACE, '');
    listed[key] = Math.max(listed[key] ?? 0, n);
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    resetMatTuning();
    resetTuning();
    resetDrawSwitches();
    GameState.initNew();
    InventoryManager.init();
    fixtures.placeAt('fixture_producer', Math.round(matW() / 2), Math.round(matH() / 2));
    Atlas.createStarterRegion();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => fakeContext());
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    resetGroundSheets();
    primeGroundSheets(flatSheet);
    listed = {};
    measures = vi.spyOn(performance, 'measure').mockImplementation(recordMeasure);
});

afterEach(() => {
    cleanup();
    measures.mockRestore();
    HTMLCanvasElement.prototype.getContext.mockRestore?.();
    resetGroundSheets();
    resetDrawSwitches();
    resetTuning();
    GameLoop.stop();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ a new picture of the ground in the development build', () => {
    it('⭐ reaches the ambient life without React listing the ground\'s plan', async () => {
        const coast = settledRegion(['forest', 'coast'], 101);
        const { container } = mountMat();
        expect(container.querySelector('canvas[data-ambient="water"]')).toBeNull();
        listed = {};

        await act(async () => { expect(Atlas.travel(coast.id).success).toBe(true); });

        // The new picture arrived: the coast's sea shimmers.
        expect(container.querySelector('canvas[data-ambient="water"]')).not.toBeNull();
        expect(Object.keys(listed).length).toBeGreaterThan(0);
        for (const [component, n] of Object.entries(listed)) {
            expect(n, `${component} listed ${n} props`).toBeLessThan(50000);
        }
    });
});
