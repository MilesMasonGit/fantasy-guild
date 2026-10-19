// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { GameState } from '../state/GameState.js';
import { createEmptyBoard } from '../state/StateSchema.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { budget } from '../systems/atlas/Budget.js';
import { layout } from '../systems/atlas/Layout.js';
import { DEV_MAPS } from '../systems/atlas/devMaps.js';
import * as TerrainSurface from '../systems/board/TerrainSurface.js';
import { matW, matH } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { setTuning, resetTuning } from '../config/playmatTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { boardScaleAt } from '../ui/components/base/TokenSprite.jsx';
import * as GroundScreen from '../ui/components/board/groundScreen.js';
import { primeGroundSheets, resetGroundSheets, groundSheetPaths } from '../ui/components/board/groundSheets.js';
import { setDrawn, resetDrawSwitches } from '../ui/dev/perf/drawSwitches.js';
import { TerrainDevSection } from '../ui/dev/TerrainDevSection.jsx';
import * as fixtures from '../../bench/fixtures.mjs';
import './fixtures/testTokens.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ The ground on the mat (terrain roadmap T2): the active Region's ground drawn under every
 * Token, one CPU canvas built in two stages, never per frame. The plan is built when the Region
 * changes (travel, load) or a tuning slider moves; the screen pass when the fit changes, 250 ms
 * after it stops. Nothing in a tick.
 *
 * jsdom has no canvas: the 2D context is a stand-in that keeps what was put into it, and the
 * sheets are primed with flat colours (jsdom loads no images).
 */

const h = React.createElement;
const MAT = () => ({ w: matW(), h: matH() });

/** A flat sheet per path, so every ground pixel drawn is opaque. */
function flatSheet(path) {
    const out = new Uint8ClampedArray(64 * 64 * 4);
    const shade = path.length * 7 % 200 + 30;
    for (let i = 0; i < out.length; i += 4) {
        out[i] = shade; out[i + 1] = 255 - shade; out[i + 2] = 90;
        // Prop sheets: every other pixel clear.
        out[i + 3] = path.includes('/props/') && (i / 4) % 2 ? 0 : 255;
    }
    return out;
}

/** The 2D contexts handed out, by canvas, and every call for one. */
let contexts;
let contextCalls;
function fakeContext() {
    const ctx = {
        puts: [],
        imageSmoothingEnabled: true,
        createImageData: (w, hgt) => ({ width: w, height: hgt, data: new Uint8ClampedArray(w * hgt * 4) }),
        putImageData(image) { ctx.puts.push(image); },
        clearRect() {},
        fillRect() {}
    };
    return ctx;
}

const groundCanvas = (container) => container.querySelector('canvas[data-terrain-ground]');
const lastPicture = (canvas) => contexts.get(canvas)?.puts.at(-1) || null;

let plans;
let screens;

/** Commits of the mat's subtree, so a test can show the mat really redrew. */
let matCommits = 0;
const countCommit = () => { matCommits++; };

function mountMat(fit = 1) {
    const tree = (f) => h(EngineContext.Provider, { value: { GameState, EventBus } },
        h(DndContext, null, h(MatFitProvider, { value: f },
            h(React.Profiler, { id: 'mat', onRender: countCommit }, h(MatBoard)))));
    const out = render(tree(fit));
    return { ...out, setFit: (f) => out.rerender(tree(f)) };
}

/** A Region settled from the dev map recipes, its ground and cell map as `Atlas.settle` stores them. */
function settledRegion(names, seed) {
    const summary = budget(names.map(n => DEV_MAPS[n]), { cap: 128 });
    const result = layout(summary, {
        seed, mat: MAT(), crowding: { hitboxPct: 80, overlapPct: 40 }, artRadius: () => 64
    });
    return Atlas.createRegion({ seed, ground: summary.ground, terrain: result.terrain }).region;
}

/** Wait out the fit's settling time and any tuning coalescing. */
const settle = (ms = 300) => act(() => { vi.advanceTimersByTime(ms); });

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

    contexts = new Map();
    contextCalls = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(type, attrs) {
        contextCalls.push({ canvas: this, type, attrs });
        if (!contexts.has(this)) contexts.set(this, fakeContext());
        return contexts.get(this);
    });
    resetGroundSheets();
    primeGroundSheets(flatSheet);
    plans = vi.spyOn(TerrainSurface, 'buildGroundPlan');
    screens = vi.spyOn(GroundScreen, 'buildScreenPass');
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    plans.mockRestore();
    screens.mockRestore();
    HTMLCanvasElement.prototype.getContext.mockRestore?.();
    resetGroundSheets();
    resetDrawSwitches();
    resetTuning();
    SaveManager.currentSlot = null;
    GameLoop.stop();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ the ground is the active Region\'s', () => {
    it('the Starter Camp is meadow: no stored map, its own seed', () => {
        const { container } = mountMat();
        expect(groundCanvas(container)).not.toBeNull();
        expect(plans).toHaveBeenCalledTimes(1);
        const ground = plans.mock.calls[0][0];
        expect(ground.meadow).toBe(true);
        expect(ground.seed).toBe(Atlas.activeRegion().seed);
        expect(ground.looks.grass).toBe('meadow');
        expect(ground.mat).toEqual(MAT());
        expect(screens).toHaveBeenCalledTimes(1);
        expect(lastPicture(groundCanvas(container))).not.toBeNull();
    });

    it('⭐ a travel rebuilds once, from the new Region\'s ground; travelling back once more', async () => {
        const forestCoast = settledRegion(['forest', 'coast'], 101);
        const home = Atlas.activeRegionId();
        const { container } = mountMat();
        plans.mockClear();
        screens.mockClear();

        // The mat hears the travel's events once their task is done (`useGameState`).
        await act(async () => { expect(Atlas.travel(forestCoast.id).success).toBe(true); });
        expect(plans).toHaveBeenCalledTimes(1);
        expect(screens).toHaveBeenCalledTimes(1);
        const ground = plans.mock.calls[0][0];
        expect(ground.meadow).toBe(false);
        expect(ground.seed).toBe(101);
        expect(ground.looks).toMatchObject({ grass: 'forest', sand: 'coast', water: 'sea' });
        expect(groundCanvas(container)).not.toBeNull();

        await act(async () => { expect(Atlas.travel(home).success).toBe(true); });
        expect(plans).toHaveBeenCalledTimes(2);
        expect(screens).toHaveBeenCalledTimes(2);
        expect(plans.mock.calls[1][0].meadow).toBe(true);
    });

    it('lives on the Region: placing Tokens stores nothing about the ground on the board', () => {
        // Moved from the retired `TerrainOff.test.js`: since Free Playmat 1.6a the board has no
        // terrain storage or paint hook, and the ground is the Region's stored cell map.
        const at = { x: Math.round(matW() / 2) - 300, y: Math.round(matH() / 2) - 200 };
        const placed = fixtures.placeAt('fixture_producer_alt', at.x, at.y);
        expect(placed.typeId).toBe('fixture_producer_alt');
        for (const field of ['terrain', 'nextPaintOrder', 'terrainSeed']) {
            expect(field in GameState.state.board).toBe(false);
            expect(field in createEmptyBoard()).toBe(false);
        }
        for (const fn of ['getTileTerrain', 'terrainMap', 'terrainSeed', 'paintTile']) {
            expect(BoardState[fn]).toBeUndefined();
        }
    });

    it('a load of the same Region rebuilds nothing; a load of another rebuilds once', async () => {
        const forest = settledRegion(['forest'], 7);
        const { container } = mountMat();
        plans.mockClear();
        screens.mockClear();
        // A load hands the game fresh objects with the same contents.
        await act(async () => {
            GameState.state.atlas = JSON.parse(JSON.stringify(GameState.state.atlas));
            EventBus.publish('game_reset', { reason: 'load' });
        });
        expect(plans).not.toHaveBeenCalled();
        await act(async () => {
            GameState.state.atlas.activeRegionId = forest.id;
            EventBus.publish('game_reset', { reason: 'load' });
        });
        expect(plans).toHaveBeenCalledTimes(1);
        expect(plans.mock.calls[0][0].seed).toBe(7);
        expect(groundCanvas(container)).not.toBeNull();
    });
});

describe('⭐ never per frame', () => {
    it('⭐ 100 engine ticks rebuild nothing', async () => {
        const centre = { x: Math.round(matW() / 2), y: Math.round(matH() / 2) };
        const producer = fixtures.placeAt('fixture_producer_alt', centre.x + 320, centre.y);
        fixtures.placeAt('bench_forest', centre.x - 480, centre.y);
        fixtures.prefillSpawners();
        const heroes = fixtures.makeHeroes(2);
        fixtures.plant(heroes[0].id, { x: producer.x, y: producer.y }, { pin: true });
        TileModifiers.rebuildAll();
        mountMat();
        plans.mockClear();
        screens.mockClear();
        matCommits = 0;

        // Each tick's events reach the mat after the tick's task (`useGameState`), so each is
        // awaited: a rebuild they caused would be counted. Every tenth tick a Token arrives, as
        // spawns do at the cap, so the mat itself redraws while the ground must not.
        for (let i = 0; i < 100; i++) {
            await act(async () => {
                GameLoop.runHandlers(100);
                if (i % 10 === 9) {
                    const t = fixtures.placeAt('fixture_producer', 200 + i * 12, 200);
                    EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: t.id, typeId: t.typeId });
                }
            });
        }
        expect(GameState.state.time.gameTimeMs).toBeGreaterThan(0);
        expect(matCommits).toBeGreaterThanOrEqual(10);
        expect(plans).not.toHaveBeenCalled();
        expect(screens).not.toHaveBeenCalled();
    });

    it('⭐ a fit change runs one screen pass and no plan rebuild, once the fit has held still', () => {
        vi.useFakeTimers();
        const { container, setFit } = mountMat(1);
        plans.mockClear();
        screens.mockClear();

        // A window being dragged: the fit moves several times inside the settling time.
        setFit(0.9);
        act(() => { vi.advanceTimersByTime(100); });
        setFit(0.8);
        act(() => { vi.advanceTimersByTime(100); });
        setFit(0.74);
        act(() => { vi.advanceTimersByTime(100); });
        expect(screens).not.toHaveBeenCalled();
        settle(250);
        expect(screens).toHaveBeenCalledTimes(1);
        expect(plans).not.toHaveBeenCalled();
        const grid = GroundScreen.screenGrid(MAT(), GroundScreen.groundPixel() * boardScaleAt(0.74));
        expect(groundCanvas(container).width).toBe(grid.cols);
        expect(groundCanvas(container).height).toBe(grid.rows);
    });

    it('a tuning slider rebuilds the plan and the picture once for a burst of moves', () => {
        vi.useFakeTimers();
        mountMat();
        plans.mockClear();
        screens.mockClear();
        act(() => {
            setTuning('beachWidth', 20);
            setTuning('beachWidth', 22);
            setTuning('wearClump', 30);
        });
        settle(200);
        expect(plans).toHaveBeenCalledTimes(1);
        expect(screens).toHaveBeenCalledTimes(1);
    });

    it('draws nothing until the sheets have loaded, then once', () => {
        resetGroundSheets();
        const { container } = mountMat();
        expect(groundCanvas(container)).not.toBeNull();
        expect(plans).not.toHaveBeenCalled();
        expect(screens).not.toHaveBeenCalled();
        act(() => primeGroundSheets(flatSheet));
        expect(plans).toHaveBeenCalledTimes(1);
        expect(screens).toHaveBeenCalledTimes(1);
    });

    it('mutes each sheet once: not again for a travel or a fit change, again when a Colour slider moves', async () => {
        vi.useFakeTimers();
        const mutes = vi.spyOn(TerrainSurface, 'muteTexels');
        try {
            const forest = settledRegion(['forest', 'mountain'], 33);
            const { setFit } = mountMat();
            const first = mutes.mock.calls.length;
            expect(first).toBeGreaterThan(0);
            expect(first).toBeLessThanOrEqual(groundSheetPaths().length);
            await act(async () => { Atlas.travel(forest.id); });
            setFit(0.74);
            settle(300);
            const afterTravel = mutes.mock.calls.length;
            // The mountain's sheets are new to this picture; nothing already muted is muted again.
            expect(afterTravel).toBeLessThanOrEqual(groundSheetPaths().length);
            act(() => { setTuning('muteBrightness', 0.9); });
            settle(200);
            expect(mutes.mock.calls.length).toBeGreaterThan(afterTravel);
        } finally {
            mutes.mockRestore();
        }
    });
});

describe('⭐ one ground pixel is a whole number of Token pixels', () => {
    it('⭐ the canvas holds one pixel per groundPixel() × boardScaleAt(fit) mat units, for every fit from 0.5 to 1.6', () => {
        expect(GroundScreen.groundPixel()).toBe(2);
        vi.useFakeTimers();
        const { container, setFit } = mountMat(0.5);
        for (let i = 0; i <= 110; i++) {
            const fit = Math.round((0.5 + i * 0.01) * 100) / 100;
            setFit(fit);
            settle(260);
            const canvas = groundCanvas(container);
            const unit = 2 * boardScaleAt(fit);
            const grid = GroundScreen.screenGrid(MAT(), unit);
            expect(canvas.width, `fit ${fit}`).toBe(grid.cols);
            expect(canvas.height, `fit ${fit}`).toBe(grid.rows);
            expect(Math.abs(parseFloat(canvas.style.width) / canvas.width - unit), `fit ${fit}`).toBeLessThan(1e-9);
            expect(Math.abs(parseFloat(canvas.style.height) / canvas.height - unit), `fit ${fit}`).toBeLessThan(1e-9);
            expect(canvas.style.imageRendering).toBe('pixelated');
        }
        expect(plans).toHaveBeenCalledTimes(1);
    // 111 screen passes, each drawing the generated grass's details: about 3 s alone, more beside
    // the rest of the suite.
    }, 20000);

    it('⭐ pixels outside the mat\'s rounded corners are clear in the picture put on the canvas', () => {
        vi.useFakeTimers();
        const { container, setFit } = mountMat(1);
        for (const fit of [1, 0.74]) {
            setFit(fit);
            settle(300);
            const picture = lastPicture(groundCanvas(container));
            const alpha = (x, y) => picture.data[(y * picture.width + x) * 4 + 3];
            expect(alpha(0, 0), `fit ${fit}`).toBe(0);
            expect(alpha(picture.width - 1, 0), `fit ${fit}`).toBe(0);
            expect(alpha(0, picture.height - 1), `fit ${fit}`).toBe(0);
            expect(alpha(picture.width - 1, picture.height - 1), `fit ${fit}`).toBe(0);
            expect(alpha(picture.width >> 1, picture.height >> 1), `fit ${fit}`).toBe(255);
            expect(alpha(0, picture.height >> 1), `fit ${fit}`).toBe(255);
        }
    });

    it('⭐ follows the Ground pixel size slider: one Token pixel a ground pixel at 1, three at 3', () => {
        vi.useFakeTimers();
        const { container } = mountMat(1);
        for (const pixel of [1, 3, 2]) {
            act(() => { setTuning('groundPixel', pixel); });
            settle(200);
            const grid = GroundScreen.screenGrid(MAT(), pixel * boardScaleAt(1));
            expect(groundCanvas(container).width, `pixel ${pixel}`).toBe(grid.cols);
            expect(parseFloat(groundCanvas(container).style.width) / grid.cols).toBeCloseTo(pixel * boardScaleAt(1), 9);
            expect(screens.mock.lastCall[1].pixel, `pixel ${pixel}`).toBe(pixel);
        }
    });
});

describe('⭐ the terrain draw switch', () => {
    it('⭐ off, the ground is not mounted and the surface keeps its own edge; on, the picture takes it over', () => {
        setDrawn('terrain', false);
        const { container } = mountMat();
        const surface = () => container.querySelector('[data-mat-surface]');
        expect(groundCanvas(container)).toBeNull();
        expect(plans).not.toHaveBeenCalled();
        expect(surface().style.boxShadow).toMatch(/inset/);
        expect(surface().style.border).toMatch(/rgba\(255, 255, 255, 0\.08\)/);

        act(() => setDrawn('terrain', true));
        expect(groundCanvas(container)).not.toBeNull();
        expect(plans).toHaveBeenCalledTimes(1);
        expect(surface().style.boxShadow).not.toMatch(/inset/);
        expect(surface().style.borderRadius).toBe(`${GroundScreen.MAT_EDGE.radius}px`);

        act(() => setDrawn('terrain', false));
        expect(groundCanvas(container)).toBeNull();
        expect(surface().style.boxShadow).toMatch(/inset/);
    });

    it('sits over the surface and under every Token, and takes no pointer', () => {
        const { container } = mountMat();
        const canvas = groundCanvas(container);
        const surfaceZ = Number(container.querySelector('[data-mat-surface]').style.zIndex);
        const tokenZ = Math.min(...[...container.querySelectorAll('[data-token-art]')].map(el => Number(el.style.zIndex)));
        expect(Number(canvas.style.zIndex)).toBeGreaterThan(surfaceZ);
        expect(Number(canvas.style.zIndex)).toBeLessThan(tokenZ);
        expect(canvas.className).toMatch(/pointer-events-none/);
        expect(canvas.getAttribute('aria-hidden')).toBe('true');
    });
});

describe('the Terrain dev section beside the mat', () => {
    it('a button travels, the ground rebuilds once, and the section shows the build without React complaining', async () => {
        const errors = vi.spyOn(console, 'error');
        const { container } = render(h(EngineContext.Provider, { value: { GameState, EventBus } },
            h(DndContext, null, h(MatFitProvider, { value: 1 }, h(TerrainDevSection), h(MatBoard)))));
        plans.mockClear();
        await act(async () => {
            container.querySelector('[data-terrain-view="forest_coast"]').click();
        });
        expect(plans).toHaveBeenCalledTimes(1);
        expect(plans.mock.calls[0][0].looks.grass).toBe('forest');
        expect(container.querySelector('[data-terrain-where]').textContent).toMatch(/Forest \+ Coast/);
        expect(container.querySelector('[data-terrain-builds]').textContent).toMatch(/plan \d+\.\d ms, picture \d+\.\d ms/);
        const complaints = errors.mock.calls.filter(args => /Cannot update a component/.test(String(args[0])));
        expect(complaints).toEqual([]);
        errors.mockRestore();
    });
});
