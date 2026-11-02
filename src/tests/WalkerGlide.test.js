// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { TICK_INTERVAL_MS } from '../config/loopConstants.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { walkerGlide } from '../ui/components/board/walkerGlide.js';
import { setDrawn } from '../ui/dev/perf/drawSwitches.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { drawnPoint } from './fixtures/drawnPoint.js';

const renders = { MatBoard: 0 };
vi.mock('../ui/dev/perf/PerfProfiler.jsx', async (orig) => ({
    ...(await orig()),
    usePerfRenderCount: (id) => { renders[id] = (renders[id] || 0) + 1; }
}));
vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **A walking enemy glides a whole screen pixel at a time.** Its boxes are painted on the main
 * thread (the crisp-pixel rule), so a smooth one-tick glide made Chrome redo its layer and paint
 * work on every frame of every step. Each step now jumps in whole screen pixels, one jump per pixel
 * of its longer axis, so the frames between jumps cost nothing. Pixel art painted there only
 * ever shows whole-pixel moves, so the walk looks the same.
 */

describe('walkerGlide: one jump per screen pixel of the longer axis', () => {
    const glide = (n) => `transform ${TICK_INTERVAL_MS}ms steps(${n}, start)`;

    it('counts screen pixels, not mat units', () => {
        expect(walkerGlide(5, 0, 1)).toBe(glide(5));
        expect(walkerGlide(5, 0, 0.5)).toBe(glide(3));      // 2.5 px: three jumps of under a pixel
        expect(walkerGlide(10, 0, 0.3)).toBe(glide(3));
        expect(walkerGlide(4, 0, 0.5 * 2)).toBe(glide(4));  // a fit of 0.5 at a device pixel ratio of 2
    });

    it('takes the longer axis, either way', () => {
        expect(walkerGlide(-3, 4, 1)).toBe(glide(4));
        expect(walkerGlide(3, -7.2, 1)).toBe(glide(8));
    });

    it('never jumps more than a pixel on either axis', () => {
        for (const [dx, dy, unit] of [[4.5, 0, 0.31], [3.2, 3.2, 0.62], [9, -1, 1.27], [0.4, 7.9, 2]]) {
            const n = Number(/steps\((\d+)/.exec(walkerGlide(dx, dy, unit))[1]);
            expect(Math.abs(dx) * unit / n).toBeLessThanOrEqual(1);
            expect(Math.abs(dy) * unit / n).toBeLessThanOrEqual(1);
        }
    });

    it('a step of a pixel or less, or none, simply lands', () => {
        expect(walkerGlide(0, 0, 1)).toBe('none');
        expect(walkerGlide(1, 1, 1)).toBe('none');
        expect(walkerGlide(4, 2, 0.25)).toBe('none');
        expect(walkerGlide(NaN, 2, 1)).toBe('none');
    });

    it('a whole number of pixels is not counted one over', () => {
        expect(walkerGlide(0.1 + 0.2, 0, 10)).toBe(glide(3));
    });
});

registerTokenTypes({
    fixture_wg_camp: {
        id: 'fixture_wg_camp', name: 'Fixture WG Camp', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'fixture_enemy', weight: 1 }], allowance: 4, intervalMs: 99999999, upkeep: [] }
    }
});

const h = React.createElement;

function seeded(seed = 11) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

describe('⭐ on the mat: a walking enemy’s boxes glide in whole screen pixels', () => {
    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    afterEach(() => { cleanup(); EnemyMotion.setRandomForTests(); setDrawn('walkDraw', true); });

    beforeEach(() => {
        vi.clearAllMocks();
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        clearMat();
        GameState.state.heroes = [];
        setMatTuning('enemyWalkSpeed', 100);
        setMatTuning('enemyPotterRadius', 160);
        EnemyMotion.setRandomForTests(seeded());
    });

    /** Walks the enemy 300 ticks, calling `check` after each step it takes while still walking. */
    async function walk(fit, check) {
        const camp = placeAt('fixture_wg_camp', 800, 500);
        const enemy = placeAt('fixture_enemy', 920, 500);
        enemy.tether = camp.id;
        const { container } = render(h(DndContext, null, h(MatFitProvider, { value: fit }, h(MatBoard))));
        const art = () => container.querySelector(`[data-token-id="${enemy.id}"][data-token-art]`);
        const overlay = () => container.querySelector(`[data-token-overlay="${enemy.id}"]`);
        let steps = 0;
        for (let i = 0; i < 300; i++) {
            const p0 = { x: enemy.x, y: enemy.y };
            const walking0 = EnemyMotion.walkFacingOf(enemy.id) != null;
            const r0 = renders.MatBoard;
            await act(async () => { EnemyMotion.tick(100); });
            const moved = enemy.x !== p0.x || enemy.y !== p0.y;
            if (!moved || EnemyMotion.walkFacingOf(enemy.id) == null) continue;
            steps++;
            check([art(), overlay()], enemy.x - p0.x, enemy.y - p0.y, enemy, walking0 && renders.MatBoard > r0);
        }
        return steps;
    }

    it('every step, both boxes: stepped by the screen pixels it covers, never a smooth glide', async () => {
        const seen = new Set();
        const steps = await walk(1, (boxes, dx, dy) => {
            for (const el of boxes) {
                expect(el.style.transition).toBe(walkerGlide(dx, dy, 1));
                expect(el.style.transition).not.toMatch(/linear/);
                seen.add(el.style.transition);
            }
        });
        expect(steps).toBeGreaterThan(50);
        // Strolls at half of 100 u/s: 5 u a tick, so five jumps of a pixel at a fit of 1.
        expect([...seen].some(t => /steps\(5, start\)/.test(t))).toBe(true);
    });

    it('at the mat’s fit: a smaller mat takes fewer jumps', async () => {
        const fit = 0.3;
        const seen = new Set();
        const steps = await walk(fit, (boxes, dx, dy) => {
            for (const el of boxes) {
                expect(el.style.transition).toBe(walkerGlide(dx, dy, fit));
                seen.add(el.style.transition);
            }
        });
        expect(steps).toBeGreaterThan(50);
        // 5 u at 0.3 is 1.5 screen pixels: two jumps.
        expect(seen.has(`transform ${TICK_INTERVAL_MS}ms steps(2, start)`)).toBe(true);
    });

    it('the boxes still stand where the engine says', async () => {
        await walk(1, (boxes, dx, dy, enemy) => {
            const half = parseFloat(boxes[0].style.width) / 2;
            for (const el of boxes) expect(drawnPoint(el)).toEqual({ x: enemy.x - half, y: enemy.y - half });
        });
    });

    it('with the walk drawing switched off, a step simply lands', async () => {
        setDrawn('walkDraw', false);
        const steps = await walk(1, (boxes) => {
            for (const el of boxes) expect(el.style.transition).toBe('none');
        });
        expect(steps).toBeGreaterThan(50);
    });

    it('a mat re-render mid-walk keeps the step’s glide', async () => {
        // MatBoard re-renders for a walker when it crosses another Token; React must not put
        // back a glide of its own over the one the step set.
        placeAt('fixture_producer', 800, 540);
        let renderedSteps = 0;
        await walk(1, (boxes, dx, dy, enemy, rendered) => {
            if (!rendered) return;
            renderedSteps++;
            for (const el of boxes) expect(el.style.transition).toBe(walkerGlide(dx, dy, 1));
        });
        expect(BoardState.tokens().length).toBe(3);
        expect(renderedSteps).toBeGreaterThan(2);
    });

    it('a step writes only what changed: a steady stroll keeps its glide without writing it again', async () => {
        // Each write is a CSS parse and a restyle inside the engine tick (T-200).
        const transitionSet = vi.spyOn(CSSStyleDeclaration.prototype, 'transition', 'set');
        const transformSet = vi.spyOn(CSSStyleDeclaration.prototype, 'transform', 'set');
        let artStyle = null;
        let walkingSteps = 0;
        await walk(1, (boxes, dx, dy) => {
            artStyle = boxes[0].style;
            walkingSteps++;
            // What the boxes carry is unchanged: this step's glide, at the engine's point.
            for (const el of boxes) expect(el.style.transition).toBe(walkerGlide(dx, dy, 1));
        });
        const onArt = (spy) => spy.mock.contexts.filter(c => c === artStyle).length;
        expect(walkingSteps).toBeGreaterThan(50);
        expect(onArt(transformSet)).toBeGreaterThanOrEqual(walkingSteps);
        // Every step used to write it; now only a step whose glide differs from the last one does.
        expect(onArt(transitionSet)).toBeLessThan(walkingSteps * 0.75);
        transitionSet.mockRestore();
        transformSet.mockRestore();
    });
});
