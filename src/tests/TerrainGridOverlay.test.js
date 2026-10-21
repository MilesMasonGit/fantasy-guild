// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as GroundRules from '../systems/board/GroundRules.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { matW, matH, artRadiusOf } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { TERRAIN, TERRAIN_CELL, terrainGrid, encodeTerrain } from '../systems/atlas/TerrainMap.js';
import { createRegionRecord } from '../state/StateSchema.js';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { TerrainGridOverlay, GRID_LIT, GRID_DIM } from '../ui/components/board/TerrainGridOverlay.jsx';
import { MAT_Z } from '../ui/components/board/matLayers.js';
import { clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **The grid while placing** (terrain roadmap T4, TD-5 A): with a Token in the hand, the cells
 * it may stand on light up and the rest dim, drawn once at pickup under the Tokens and gone at the
 * drop; only when that Token cannot stand everywhere here (it has a "Stands on", or the Region has
 * water). The cells are placement's own (`GroundRules`), never a second reading of the ground.
 *
 * The test Region, on the shipped 55 × 36 cell mat: water in cols 0–9, sand 10–24 (col 10 the
 * shore), grass 25–39, rock 40–54.
 */

const base = { tokenType: 'resource', size: 1, uses: 100, requiresHero: false, config: { cycleTimeMs: 5000, inputs: [], outputs: [] } };
registerTokenTypes({
    tg_plain: { ...base, id: 'tg_plain', name: 'TG Plain' },
    tg_water: { ...base, id: 'tg_water', name: 'TG Boat', standsOn: ['water'] },
    tg_shore: { ...base, id: 'tg_shore', name: 'TG Dock', standsOn: ['shore'] },
    tg_rock: { ...base, id: 'tg_rock', name: 'TG Mineshaft', standsOn: ['rock'] }
});

const GRID = terrainGrid({ w: 1760, h: 1126 });
const terrainOfCol = (col) => (col <= 9 ? TERRAIN.WATER : col <= 24 ? TERRAIN.SAND : col <= 39 ? TERRAIN.GRASS : TERRAIN.ROCK);
const MAP = encodeTerrain(GRID, Array.from({ length: GRID.cols * GRID.rows }, (_, i) => terrainOfCol(i % GRID.cols)));

function standOn(map) {
    const region = createRegionRecord('region_7');
    region.kind = 'settled';
    region.terrain = map;
    GameState.state.atlas = { activeRegionId: region.id, nextRegionNumber: 8, regions: { [region.id]: region }, seed: null };
}

const h = React.createElement;
const MAT = { w: 1760, h: 1126 };
const held = (typeId) => ({ isDragging: true, activePayload: { kind: DRAG_KIND.TOKEN, typeId, from: { instanceId: 'tok_held' } } });
const idle = { isDragging: false, activePayload: null };

/** What each canvas was drawn with. */
let drawn;
beforeEach(() => {
    drawn = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext(type, attrs) {
        const canvas = this;
        return {
            createImageData: (w, hgt) => ({ width: w, height: hgt, data: new Uint8ClampedArray(w * hgt * 4) }),
            putImageData: (image) => drawn.push({ canvas, type, attrs, image }),
            clearRect: () => {}
        };
    });
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    clearMat();
    standOn(MAP);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); resetMatTuning(); });

function overlay(drag) {
    return render(h(DeckDndContext.Provider, { value: drag }, h(TerrainGridOverlay, { mat: MAT })));
}
const gridCanvas = (container) => container.querySelector('canvas[data-terrain-grid]');
const pixelIsLit = (data, i) => data[i * 4] === GRID_LIT[0] && data[i * 4 + 3] > 0 && data[i * 4 + 1] === GRID_LIT[1];
const pixelIsDim = (data, i) => data[i * 4] === GRID_DIM[0] && data[i * 4 + 1] === GRID_DIM[1];

describe('⭐ the grid shows only while a Token is in the hand, and only per TD-5', () => {
    it('nothing in the hand: no grid', () => {
        const { container } = overlay(idle);
        expect(gridCanvas(container)).toBeNull();
    });

    it('a hero or a flag in the hand: no grid', () => {
        const { container } = overlay({ isDragging: true, activePayload: { kind: DRAG_KIND.FLAG, heroId: 'h1' } });
        expect(gridCanvas(container)).toBeNull();
    });

    it('a Token that needs a ground: the grid, drawn once', () => {
        const { container } = overlay(held('tg_water'));
        const canvas = gridCanvas(container);
        expect(canvas).not.toBeNull();
        expect(drawn.filter(d => d.canvas === canvas).length).toBe(1);
    });

    it('a plain Token where the Region has water: the grid (it may not stand on the sea)', () => {
        const { container } = overlay(held('tg_plain'));
        expect(gridCanvas(container)).not.toBeNull();
    });

    it('a plain Token on the meadow: no grid (it may stand everywhere)', () => {
        standOn(null);
        const { container } = overlay(held('tg_plain'));
        expect(gridCanvas(container)).toBeNull();
        expect(drawn.length).toBe(0);
    });

    it('a Token that needs rock, on the meadow: the grid, every cell dim, covering the whole mat', () => {
        standOn(null);
        const { container } = overlay(held('tg_rock'));
        const canvas = gridCanvas(container);
        expect(canvas).not.toBeNull();
        expect(parseFloat(canvas.style.width)).toBe(MAT.w);
        expect(parseFloat(canvas.style.height)).toBe(MAT.h);
        const { data } = drawn[0].image;
        for (let i = 0; i < data.length / 4; i++) expect(pixelIsDim(data, i)).toBe(true);
    });

    it('the drop clears it', () => {
        const view = overlay(held('tg_rock'));
        expect(gridCanvas(view.container)).not.toBeNull();
        view.rerender(h(DeckDndContext.Provider, { value: idle }, h(TerrainGridOverlay, { mat: MAT })));
        expect(gridCanvas(view.container)).toBeNull();
    });
});

describe('⭐ the lit cells are exactly the ones placement allows', () => {
    /** Every cell centre a Token fits at, away from the mat's edge. */
    function* fittingCells() {
        const r = artRadiusOf('tg_plain');
        for (let row = 0; row < GRID.rows; row++) {
            for (let col = 0; col < GRID.cols; col++) {
                const x = (col + 0.5) * TERRAIN_CELL;
                const y = (row + 0.5) * TERRAIN_CELL;
                if (x < r || y < r || x > matW() - r || y > matH() - r) continue;
                yield { index: row * GRID.cols + col, x, y };
            }
        }
    }

    for (const typeId of ['tg_water', 'tg_shore', 'tg_rock', 'tg_plain']) {
        it(`${typeId}: one pixel per cell, lit where a drop lands as aimed and dim where it does not`, () => {
            const { container } = overlay(held(typeId));
            const canvas = gridCanvas(container);
            expect(canvas.width).toBe(GRID.cols);
            expect(canvas.height).toBe(GRID.rows);
            const { data } = drawn.find(d => d.canvas === canvas).image;
            let lit = 0;
            let dim = 0;
            for (const cell of fittingCells()) {
                // Placement itself, on an empty mat: a spot exactly where it was aimed.
                const spot = MatPlacement.findSpot(typeId, { x: cell.x, y: cell.y });
                const allowed = !!spot && spot.nudge === 0;
                expect(pixelIsLit(data, cell.index), `cell ${cell.index}`).toBe(allowed);
                expect(pixelIsDim(data, cell.index), `cell ${cell.index}`).toBe(!allowed);
                if (allowed) lit++; else dim++;
            }
            expect(lit).toBeGreaterThan(0);
            expect(dim).toBeGreaterThan(0);
        });
    }

    it('reads placement\'s own cells (GroundRules), never a second reading of the ground', () => {
        const spy = vi.spyOn(GroundRules, 'rulesFor');
        overlay(held('tg_shore'));
        expect(spy).toHaveBeenCalledWith('tg_shore');
    });
});

describe('MatBoard mounts the grid beside the rings', () => {
    const engine = (drag, el) => h(DndContext, null, h(DeckDndContext.Provider, { value: drag }, el));

    it('a Token in the hand that needs water: the grid is on the mat, under every Token', () => {
        const { container } = render(engine(held('tg_water'), h(MatBoard)));
        const canvas = container.querySelector('[data-mat-board] canvas[data-terrain-grid]');
        expect(canvas).not.toBeNull();
        const layer = canvas.closest('[data-terrain-grid-clip]');
        expect(layer.parentElement.matches('[data-mat-board]')).toBe(true);
        expect(Number(layer.style.zIndex)).toBeGreaterThan(MAT_Z.GROUND);
        expect(Number(layer.style.zIndex)).toBeLessThan(MAT_Z.TOKEN_BASE);
    });

    it('nothing in the hand: no grid on the mat', () => {
        const { container } = render(engine(idle, h(MatBoard)));
        expect(container.querySelector('[data-mat-board] canvas[data-terrain-grid]')).toBeNull();
    });
});
