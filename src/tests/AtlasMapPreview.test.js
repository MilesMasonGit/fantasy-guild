// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { tokenSpritePath } from '../config/registries/tokenRegistry.js';
import { sheetPath, propSheetPath } from '../config/registries/terrainRegistry.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as Cartography from '../systems/atlas/Cartography.js';
import { DEV_MAPS } from '../systems/atlas/devMaps.js';
import { HALL_TYPE_ID } from '../systems/atlas/Layout.js';
import { shippedMat } from '../systems/atlas/layoutInputs.js';
import { regionGround } from '../systems/atlas/regionGround.js';
import * as TerrainSurface from '../systems/board/TerrainSurface.js';
import { buildScreenPass } from '../ui/components/board/groundScreen.js';
import { primeGroundSheets, resetGroundSheets, mutedSheet, drawnSheet } from '../ui/components/board/groundSheets.js';
import {
    previewFit, previewTokens, shrinkArt, paintTokens, previewPicture, primePreviewArt, resetPreviewArt,
    previewArtPaths, PREVIEW_ZOOM
} from '../ui/components/atlas/mapPreview.js';
import { PREVIEW_SETTLE_MS } from '../ui/components/atlas/MapPreview.jsx';
import { regionPlan } from '../ui/components/atlas/regionPreview.js';
import { mapSpritePath, mapHoverLines, DEV_MAP_SPRITES, FALLBACK_MAP_SPRITE } from '../ui/components/atlas/mapArt.js';
import { AtlasScreen, ATLAS_TAB } from '../ui/components/atlas/AtlasScreen.jsx';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { placeAt } from './fixtures/mat.js';
import './fixtures/testTokens.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ The Cartography preview is a tiny real map: the ground the mat will draw for the Region once it
 * is settled (the same pipeline, the same record), each Token its own sprite shrunk by a whole
 * number, the Hall in the middle; and it is drawn once per plan, never on a re-render, a tab
 * switch or the Bank changing, and never after the book is closed.
 */

const q = (container, sel) => container.querySelector(sel);
const SHIPPED = shippedMat();
const OAK = 'token_oak_tree';

/** A flat sheet per path (props every other pixel clear), so every ground pixel is opaque. */
function flatSheet(path) {
    const out = new Uint8ClampedArray(64 * 64 * 4);
    const shade = path.length * 7 % 200 + 30;
    for (let i = 0; i < out.length; i += 4) {
        out[i] = shade; out[i + 1] = 255 - shade; out[i + 2] = 90;
        out[i + 3] = path.includes('/props/') && (i / 4) % 2 ? 0 : 255;
    }
    return out;
}

/** Art of one colour, `w` × `h`. */
function solidArt(w, h, [r, g, b]) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; }
    return { width: w, height: h, data };
}

const pixelAt = (picture, x, y) => Array.from(picture.data.slice((y * picture.cols + x) * 4, (y * picture.cols + x) * 4 + 4));

/** The mat's own screen pass of a Region record, as `TerrainCanvas` makes it. */
function matPass(region, mat, fit) {
    return buildScreenPass(TerrainSurface.buildGroundPlan(regionGround(region, mat)), {
        mat, unit: fit.unit, pixel: fit.step,
        sheet: (id) => mutedSheet(sheetPath(id)),
        prop: (id, asDrawn) => (asDrawn ? drawnSheet(propSheetPath(id)) : mutedSheet(propSheetPath(id)))
    });
}

function newGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    placeAt(HALL_TYPE_ID, Math.round(matW() / 2), Math.round(matH() / 2));
    Atlas.createStarterRegion();
    Cartography.clearStock();
}

let contexts;
/** An image that never loads: the browser's `onerror`, a task later. */
class NoImage {
    set src(_) { setTimeout(() => this.onerror?.(), 0); }
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    newGame();
    resetGroundSheets();
    primeGroundSheets(flatSheet);
    resetPreviewArt();
    contexts = new Map();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function getContext() {
        if (!contexts.has(this)) {
            const ctx = {
                puts: [],
                createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
                putImageData(image) { ctx.puts.push(image); }
            };
            contexts.set(this, ctx);
        }
        return contexts.get(this);
    });
    vi.stubGlobal('Image', NoImage);
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    HTMLCanvasElement.prototype.getContext.mockRestore?.();
    resetGroundSheets();
    resetPreviewArt();
    resetMatTuning();
    SaveManager.currentSlot = null;
    GameLoop.stop();
    Cartography.clearStock();
});

afterAll(() => {
    vi.restoreAllMocks();
});

describe('the preview\'s size', () => {
    it('is the finest whole number of Token pixels a preview pixel that fits, drawn at the UI\'s 2×', () => {
        const fit = previewFit(SHIPPED, 480, 400);
        expect(fit).toEqual({ step: 4, unit: 8, cols: 240, rows: 130, zoom: PREVIEW_ZOOM, width: 480, height: 260 });
        expect(previewFit(SHIPPED, 479, 400).step).toBe(5);
        expect(previewFit(SHIPPED, 1000, 250).step).toBe(5);
        // Nothing fits: the coarsest.
        expect(previewFit(SHIPPED, 50, 50).step).toBe(8);
        for (const max of [200, 300, 500, 700]) {
            const f = previewFit(SHIPPED, max, max);
            expect(f.width).toBe(f.cols * 2);
            expect(f.unit).toBe(2 * f.step);
        }
    });
});

describe('the Tokens on it', () => {
    it('stand where the layout puts them, as big as the mat draws them, the Hall in the middle of the mat, back to front', () => {
        const layout = { nodes: [{ typeId: OAK, x: 800, y: 600 }, { typeId: OAK, x: 96, y: 96 }] };
        const tokens = previewTokens(layout, SHIPPED, 8);
        expect(tokens.map(t => t.typeId)).toEqual([OAK, HALL_TYPE_ID, OAK]);
        expect(tokens[0]).toMatchObject({ x: 12, y: 12, px: 16 });
        expect(tokens[1]).toMatchObject({ x: 120, y: 65 });
        expect(tokens[2]).toMatchObject({ x: 100, y: 75, px: 16 });
        // A grown mat lands the Hall at its own middle.
        expect(previewTokens(layout, { w: 3200, h: 2048 }, 16).find(t => t.typeId === HALL_TYPE_ID)).toMatchObject({ x: 100, y: 64 });
    });

    it('shrink by a whole number: a block\'s alpha-weighted average, opaque when half of it is', () => {
        // 4 × 2: a red and a blue pixel, then a block with one opaque pixel in four.
        const data = new Uint8ClampedArray(4 * 2 * 4);
        const set = (x, y, rgba) => data.set(rgba, (y * 4 + x) * 4);
        set(0, 0, [255, 0, 0, 255]); set(1, 0, [0, 0, 255, 255]);
        set(0, 1, [255, 0, 0, 255]); set(1, 1, [0, 0, 255, 255]);
        set(2, 0, [9, 9, 9, 255]);
        const out = shrinkArt({ width: 4, height: 2, data }, 2);
        expect([out.width, out.height]).toEqual([2, 1]);
        expect(Array.from(out.data.slice(0, 4))).toEqual([128, 0, 128, 255]);
        expect(out.data[7]).toBe(0);
        // A partial block counts its own area: 3 wide by 2 leaves a one-pixel column.
        const odd = shrinkArt(solidArt(3, 1, [10, 20, 30]), 2);
        expect([odd.width, odd.height]).toEqual([2, 1]);
        expect(Array.from(odd.data)).toEqual([10, 20, 30, 255, 10, 20, 30, 255]);
        expect(shrinkArt(solidArt(2, 2, [1, 2, 3]), 1).data).toEqual(solidArt(2, 2, [1, 2, 3]).data);
    });

    it('lie over the ground centred on their point, clear pixels left as they were, cut at the edge', () => {
        const data = new Uint8ClampedArray(6 * 4 * 4);
        const art = solidArt(2, 2, [200, 0, 0]);
        art.data[3] = 0;
        paintTokens(data, 6, 4, [{ x: 2, y: 2, art }, { x: 6, y: 0, art: solidArt(2, 2, [0, 200, 0]) }]);
        const at = (x, y) => Array.from(data.slice((y * 6 + x) * 4, (y * 6 + x) * 4 + 4));
        expect(at(1, 1)).toEqual([0, 0, 0, 0]);
        expect(at(2, 1)).toEqual([200, 0, 0, 255]);
        expect(at(1, 2)).toEqual([200, 0, 0, 255]);
        expect(at(5, 0)).toEqual([0, 200, 0, 255]);
        expect(at(4, 0)).toEqual([0, 0, 0, 0]);
    });
});

describe('⭐ the picture is the mat\'s own', () => {
    const recipes = [DEV_MAPS.forest, DEV_MAPS.coast];

    function settled(seed) {
        Cartography.grant(recipes, 1);
        const plan = Atlas.preview(recipes, { seed });
        const result = Atlas.settle({ ingredients: plan.recipes, seed: plan.seed });
        expect(result.success).toBe(true);
        return { plan, region: Atlas.getRegion(result.region.id) };
    }

    it('its ground is what the mat draws for the settled Region at the same pixel, byte for byte', () => {
        const { plan, region } = settled(4242);
        const mat = { w: matW(), h: matH() };
        const fit = previewFit(mat, 440, 400);
        const picture = previewPicture(plan, fit, mat);
        const mine = matPass(region, mat, fit);
        expect([picture.cols, picture.rows]).toEqual([mine.cols, mine.rows]);
        expect(picture.tokens).toBe(0);
        expect(Buffer.from(picture.data).equals(Buffer.from(mine.data))).toBe(true);
        // Another seed is another picture.
        const other = previewPicture(Atlas.reroll(plan), fit, mat);
        expect(Buffer.from(other.data).equals(Buffer.from(picture.data))).toBe(false);
    });

    it('on a mat the Mat Tuner grew, the ground the mat draws there', () => {
        setMatTuning('matSteps', 14);
        const { plan, region } = settled(77);
        const mat = { w: matW(), h: matH() };
        expect(mat.w).toBeGreaterThan(SHIPPED.w);
        const fit = previewFit(mat, 440, 400);
        const picture = previewPicture(plan, fit, mat);
        expect(Buffer.from(picture.data).equals(Buffer.from(matPass(region, mat, fit).data))).toBe(true);
    });

    it('each Token is its own sprite, shrunk to the size the mat draws it', () => {
        const plan = Atlas.preview(recipes, { seed: 9 });
        const mat = { w: matW(), h: matH() };
        const fit = previewFit(mat, 480, 400);
        const hall = tokenSpritePath(HALL_TYPE_ID);
        primePreviewArt(hall, solidArt(64, 64, [250, 0, 250]));
        const picture = previewPicture(plan, fit, mat);
        expect(picture.tokens).toBe(1);
        // The Hall: 128 mat units across, 16 preview pixels at 8 a pixel, centred on the middle.
        const cx = Math.round(Math.round(mat.w / 2) / fit.unit);
        const cy = Math.round(Math.round(mat.h / 2) / fit.unit);
        expect(pixelAt(picture, cx, cy)).toEqual([250, 0, 250, 255]);
        expect(pixelAt(picture, cx - 8, cy)).toEqual([250, 0, 250, 255]);
        expect(pixelAt(picture, cx + 8, cy)).not.toEqual([250, 0, 250, 255]);
        expect(previewArtPaths(plan)).toContain(hall);
    });

    it('a settled Region on the Regions page is the picture its plan was: its stored ground, and the Hall where it stands', () => {
        const { plan, region } = settled(4242);
        const mat = { w: matW(), h: matH() };
        const fit = previewFit(mat, 440, 400);
        primePreviewArt(tokenSpritePath(HALL_TYPE_ID), solidArt(64, 64, [250, 0, 250]));
        const drawn = previewPicture(regionPlan(region), fit, mat);
        expect(Buffer.from(drawn.data).equals(Buffer.from(previewPicture(plan, fit, mat).data))).toBe(true);

        // The Region the guild is in: the Hall where it stands now, not the middle.
        expect(Atlas.travel(region.id).success).toBe(true);
        const hall = Object.values(GameState.state.board.tokens).find(t => t.typeId === HALL_TYPE_ID);
        hall.x += 40 * fit.unit;
        const here = previewPicture(regionPlan(Atlas.activeRegion()), fit, mat);
        expect(pixelAt(here, Math.round(hall.x / fit.unit), Math.round(hall.y / fit.unit))).toEqual([250, 0, 250, 255]);
        expect(pixelAt(here, Math.round(Math.round(mat.w / 2) / fit.unit) - 20, Math.round(Math.round(mat.h / 2) / fit.unit))).not.toEqual([250, 0, 250, 255]);
    });

    it('on a grown mat the Hall stands in the middle of that mat, where a travel lands it', () => {
        setMatTuning('matSteps', 14);
        const plan = Atlas.preview(recipes, { seed: 9 });
        const mat = { w: matW(), h: matH() };
        const fit = previewFit(mat, 440, 400);
        primePreviewArt(tokenSpritePath(HALL_TYPE_ID), solidArt(64, 64, [250, 0, 250]));
        const picture = previewPicture(plan, fit, mat);
        const at = (spot) => pixelAt(picture, Math.round(Math.round(spot.w / 2) / fit.unit), Math.round(Math.round(spot.h / 2) / fit.unit));
        expect(at(mat)).toEqual([250, 0, 250, 255]);
        expect(at(plan.layout.mat)).not.toEqual([250, 0, 250, 255]);
    });
});

describe('⭐ the preview is drawn once per plan', () => {
    let plans;
    beforeEach(() => {
        plans = vi.spyOn(TerrainSurface, 'buildGroundPlan');
        vi.useFakeTimers();
        Cartography.grant([DEV_MAPS.forest, DEV_MAPS.coast], 2);
    });
    afterEach(() => plans.mockRestore());

    /** Wait out the settle, and the art loads that follow it. */
    const settle = async (ms = PREVIEW_SETTLE_MS) => {
        await act(async () => {
            vi.advanceTimersByTime(ms);
            await vi.runAllTimersAsync();
        });
    };

    it('after a slot or a reroll, and at no other time; nothing once the book is closed', async () => {
        const view = render(React.createElement(
            DeckDndContext.Provider, { value: { activePayload: null, isDragging: false } },
            React.createElement(AtlasScreen, { onClose: vi.fn(), initialTab: ATLAS_TAB.CARTOGRAPHY })
        ));
        const { container } = view;
        const canvas = () => q(container, '[data-cartography] canvas[data-map-preview]');
        const puts = () => contexts.get(canvas())?.puts.length || 0;

        // Opened on Cartography: the Regions page draws nothing until it is first seen.
        expect(q(container, '[data-region-preview] canvas')).toBeNull();
        fireEvent.click(q(container, '[data-map-item="dev_map_forest"]'));
        expect(plans).toHaveBeenCalledTimes(0);
        await settle();
        expect(plans).toHaveBeenCalledTimes(1);
        expect(puts()).toBe(1);
        expect(canvas().getAttribute('data-preview-drawn')).toBe(canvas().getAttribute('data-preview-seed'));

        // A quick run of clicks: one picture.
        fireEvent.click(q(container, '[data-map-item="dev_map_coast"]'));
        await act(async () => { vi.advanceTimersByTime(PREVIEW_SETTLE_MS / 2); });
        fireEvent.click(q(container, '[data-map-item="dev_map_forest"]'));
        await settle();
        expect(plans).toHaveBeenCalledTimes(2);

        // The Bank changing, a tab switch and back: no picture of the plan. The Regions page
        // draws its own picture once, the first time it is seen, and not again.
        act(() => { InventoryManager.addItem('item_oak_wood', 3); });
        fireEvent.click(q(container, `[data-atlas-tab="${ATLAS_TAB.REGIONS}"]`));
        fireEvent.click(q(container, `[data-atlas-tab="${ATLAS_TAB.CARTOGRAPHY}"]`));
        await settle(1000);
        expect(plans).toHaveBeenCalledTimes(3);
        expect(puts()).toBe(2);
        fireEvent.click(q(container, `[data-atlas-tab="${ATLAS_TAB.REGIONS}"]`));
        fireEvent.click(q(container, `[data-atlas-tab="${ATLAS_TAB.CARTOGRAPHY}"]`));
        await settle(1000);
        expect(plans).toHaveBeenCalledTimes(3);

        fireEvent.click(q(container, '[data-cartography-reroll]'));
        await settle();
        expect(plans).toHaveBeenCalledTimes(4);
        expect(puts()).toBe(3);

        // Closed before the settle: nothing more is built.
        fireEvent.click(q(container, '[data-cartography-slot="0"]'));
        view.unmount();
        await settle(1000);
        expect(plans).toHaveBeenCalledTimes(4);
    });

    it('the Regions page draws its Region once per Region chosen: not on a rename, the Bank or the live board changing', async () => {
        const one = Atlas.devSettle(['forest'], 5).region;
        const two = Atlas.devSettle(['coast'], 6).region;
        const view = render(React.createElement(
            DeckDndContext.Provider, { value: { activePayload: null, isDragging: false } },
            React.createElement(AtlasScreen, { onClose: vi.fn(), initialTab: ATLAS_TAB.REGIONS })
        ));
        const { container } = view;
        const canvas = () => q(container, '[data-region-preview] canvas[data-map-preview]');
        await settle();
        expect(plans).toHaveBeenCalledTimes(1);
        expect(canvas().getAttribute('data-preview-seed')).toBe(String(Atlas.activeRegion().seed));

        fireEvent.click(q(container, `[data-region-select="${one.id}"]`));
        await settle();
        expect(plans).toHaveBeenCalledTimes(2);
        expect(canvas().getAttribute('data-preview-drawn')).toBe('5');

        act(() => { Atlas.rename(one.id, 'Elsewhere'); });
        act(() => { InventoryManager.addItem('item_oak_wood', 3); });
        act(() => { placeAt(OAK, 200, 200); });
        await settle(1000);
        expect(plans).toHaveBeenCalledTimes(2);

        fireEvent.click(q(container, `[data-region-select="${two.id}"]`));
        await settle();
        expect(plans).toHaveBeenCalledTimes(3);
        expect(canvas().getAttribute('data-preview-drawn')).toBe('6');
        view.unmount();
    });
});

describe('the maps\' pictures', () => {
    it('a map item shows its CMS sprite; a dev map its placeholder; anything else the plain scroll', () => {
        expect(mapSpritePath(DEV_MAPS.forest)).toBe('/assets/tokens/map/t_map_forest.png');
        expect(mapSpritePath(DEV_MAPS.goblinCamp)).toBe(`/assets/tokens/map/${DEV_MAP_SPRITES.byId.dev_mod_goblin_camp}.png`);
        expect(mapSpritePath({ id: 'nothing_known' })).toBe(`/assets/tokens/map/${FALLBACK_MAP_SPRITE}.png`);
        for (const recipe of Object.values(DEV_MAPS)) expect(mapSpritePath(recipe)).toMatch(/^\/assets\/tokens\/map\/t_map_\w+\.png$/);
    });

    it('a map\'s hover says its kind and what it adds', () => {
        const lines = mapHoverLines(DEV_MAPS.forest, 128);
        expect(lines[0]).toBe('Base Map');
        expect(lines[1]).toMatch(/^\d+ Tokens/);
        expect(lines.some(l => l.includes('Oak Tree'))).toBe(true);
        expect(mapHoverLines(DEV_MAPS.goblinCamp, 128)).toEqual(['Map Modifier', 'Changes what the Base Maps beside it write', '+1 × Goblin Camp (enemy camp)']);
    });
});
