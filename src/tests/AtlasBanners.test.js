// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { setStarterCampForTests, resetStarterCampForTests } from '../config/registries/starterCampRegistry.js';
import { normaliseStarterCamp } from '../config/starterCampShape.js';
import {
    areaBannerIds, isAreaBanner, areaBannerSrc, DEFAULT_BANNER_BY_BIOME, defaultBannerFor, FALLBACK_BANNER
} from '../config/areaBanners.js';
import { BIOME_GROUND } from '../systems/atlas/Budget.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as Cartography from '../systems/atlas/Cartography.js';
import { bannerForRegion, bannerForPlan, pickedBanner } from '../ui/components/atlas/regionBanner.js';
import { coverScale, BannerArt } from '../ui/components/base/BannerArt.jsx';
import { RegionList, regionOrder, mainNodes } from '../ui/components/atlas/RegionList.jsx';
import { ArrivalCard } from '../ui/components/atlas/ArrivalCard.jsx';
import { CartographyTable } from '../ui/components/atlas/CartographyTable.jsx';
import { MatRegionName } from '../ui/components/board/MatRegionName.jsx';
import { placeAt } from './fixtures/mat.js';
import './fixtures/testTokens.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ Area banners: each Region shows one, its Base Map's pick (the Starter Camp's own), else the one
 * for its main biome; the Region rows, the top bar's name, the arrival card and the Cartography
 * preview show it.
 */

const OAK = 'fixture_producer';
const FOREST = 'map_test_banner_forest';
const COAST = 'map_test_banner_coast';
const PLAIN = 'map_test_banner_plain';
const MOD = 'mod_test_banner_mod';
const base = (id, name, biome, banner) => ({
    id, name, type: 'map', stackable: true, ...(banner ? { banner } : {}),
    cartography: { biome, points: 8, nodes: [{ typeId: OAK, weight: 1 }], camps: [], treasures: [] }
});
registerItems({
    [FOREST]: base(FOREST, 'Banner Forest Map', 'forest', 'b_swamp'),
    [COAST]: base(COAST, 'Banner Coast Map', 'coast', 'b_fishing_village'),
    [PLAIN]: base(PLAIN, 'Plain Map', 'forest', null),
    [MOD]: { id: MOD, name: 'Banner Mod', type: 'modifier', stackable: true, banner: 'b_library', cartography: { effects: [{ kind: 'density', typeId: OAK, points: 2 }] } }
});

const q = (c, sel) => c.querySelector(sel);

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    placeAt('token_guild_hall', Math.round(matW() / 2), Math.round(matH() / 2));
    Atlas.createStarterRegion();
    Cartography.clearStock();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    resetStarterCampForTests();
    SaveManager.currentSlot = null;
    GameLoop.stop();
});

afterAll(() => vi.restoreAllMocks());

describe('the banners the game has', () => {
    it('are the pictures in backgrounds/area, each one on disk', () => {
        const ids = areaBannerIds();
        expect(ids.length).toBeGreaterThanOrEqual(18);
        const dir = path.resolve(__dirname, '../../public/assets/backgrounds/area');
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).map(f => f.replace(/\.png$/, ''));
        expect(ids).toEqual(expect.arrayContaining(files));
        for (const id of ids) expect(areaBannerSrc(id)).toBe(`/assets/backgrounds/area/${id}.png`);
        expect(isAreaBanner('t_campfire')).toBe(false);
        expect(areaBannerSrc('b_nowhere')).toBeNull();
    });

    it('every biome has its own default, and an unknown one falls back', () => {
        for (const biome of [...Object.keys(BIOME_GROUND), 'meadow']) {
            expect(DEFAULT_BANNER_BY_BIOME[biome], biome).toBeTruthy();
            expect(isAreaBanner(defaultBannerFor(biome)), biome).toBe(true);
        }
        expect(defaultBannerFor('forest')).toBe('b_lush_forest');
        expect(defaultBannerFor('coast')).toBe('b_beach');
        expect(defaultBannerFor('mountain')).toBe('b_mountains_snowy');
        expect(defaultBannerFor('lava_moon')).toBe(FALLBACK_BANNER);
        expect(isAreaBanner(FALLBACK_BANNER)).toBe(true);
    });

    it('cover the box at the smallest whole multiple of the art', () => {
        expect(coverScale(200, 32)).toBe(1);
        expect(coverScale(256, 256)).toBe(1);
        expect(coverScale(257, 10)).toBe(2);
        expect(coverScale(800, 128)).toBe(4);
        expect(coverScale(800, 128, 1024, 1024)).toBe(1);
        expect(coverScale(0, 0)).toBe(1);
    });

    it('draws the picture at that multiple', () => {
        const { container } = render(React.createElement('div', { style: { width: 600, height: 100 } }, React.createElement(BannerArt, { banner: 'b_beach' })));
        const img = q(container, 'img');
        expect(img.getAttribute('src')).toBe('/assets/backgrounds/area/b_beach.png');
        expect(Number(img.getAttribute('data-banner-scale'))).toBeGreaterThanOrEqual(1);
        expect(img.style.width).toBe(`${256 * Number(img.getAttribute('data-banner-scale'))}px`);
    });
});

describe('which banner a Region shows', () => {
    it('its Base Map\'s pick; the main biome\'s map first; Modifiers never', () => {
        expect(pickedBanner([FOREST])).toBe('b_swamp');
        expect(pickedBanner([MOD, PLAIN])).toBeNull();
        expect(pickedBanner([FOREST, COAST], 'coast')).toBe('b_fishing_village');
        expect(pickedBanner([FOREST, COAST], 'mountain')).toBe('b_swamp');
        expect(pickedBanner([PLAIN, COAST], 'forest')).toBe('b_fishing_village');
    });

    it('without a pick, the default for its main biome', () => {
        const { region } = Atlas.createRegion({ ingredients: [PLAIN, MOD], ground: { main: 'forest' } });
        expect(bannerForRegion(region)).toBe('b_lush_forest');
        const { region: picked } = Atlas.createRegion({ ingredients: [FOREST], ground: { main: 'forest' } });
        expect(bannerForRegion({ id: picked.id })).toBe('b_swamp');
        const { region: bare } = Atlas.createRegion();
        expect(bannerForRegion(bare)).toBe(FALLBACK_BANNER);
    });

    it('the Starter Camp: its own pick from the CMS, else its biome (meadow)', () => {
        const starter = Atlas.activeRegion();
        expect(bannerForRegion(starter)).toBe('b_golden_plains');
        const camp = { tokens: [{ typeId: OAK, x: 10, y: 10 }], bank: {} };
        setStarterCampForTests({ ...camp, banner: 'b_village_occult' });
        expect(bannerForRegion(starter)).toBe('b_village_occult');
        setStarterCampForTests({ ...camp, banner: 'b_not_a_picture' });
        expect(bannerForRegion(starter)).toBe('b_golden_plains');
    });

    it('a layout about to be settled shows what its maps would', () => {
        InventoryManager.addItem(PLAIN, 1);
        expect(bannerForPlan(Atlas.preview([PLAIN], { seed: 2 }))).toBe('b_lush_forest');
        InventoryManager.addItem(FOREST, 1);
        expect(bannerForPlan(Atlas.preview([FOREST], { seed: 2 }))).toBe('b_swamp');
        expect(bannerForPlan(null)).toBeNull();
    });

    it('the Starter Camp file keeps its banner, and drops an empty one', () => {
        expect(normaliseStarterCamp({ tokens: [], bank: {}, banner: ' b_village ' }).banner).toBe('b_village');
        expect('banner' in normaliseStarterCamp({ tokens: [], bank: {}, banner: '' })).toBe(false);
        expect('banner' in normaliseStarterCamp({ tokens: [], bank: {} })).toBe(false);
    });
});

describe('where the banner shows', () => {
    it('each Region row lies on its banner, with its main Tokens; the Starter Camp first, then by the day settled', () => {
        const { region: later } = Atlas.createRegion({ ingredients: [FOREST], ground: { main: 'forest' } });
        const { region: earlier } = Atlas.createRegion({ ingredients: [PLAIN], ground: { main: 'forest' } });
        Atlas.getRegion(later.id).settledAt = 5000;
        Atlas.getRegion(earlier.id).settledAt = 100;
        Atlas.getRegion(earlier.id).board.tokens = { a: { typeId: OAK }, b: { typeId: OAK }, c: { typeId: 'token_guild_hall' } };
        const starter = Atlas.activeRegionId();
        const { container } = render(React.createElement(RegionList, { version: 0, onTravel: vi.fn(), message: null, onMessage: vi.fn() }));
        const rows = [...container.querySelectorAll('[data-region-row]')];
        expect(rows.map(r => r.getAttribute('data-region-row'))).toEqual([starter, earlier.id, later.id]);
        expect(q(rows[0], '[data-banner-art]').getAttribute('data-banner-art')).toBe('b_golden_plains');
        expect(q(rows[1], '[data-banner-art]').getAttribute('data-banner-art')).toBe('b_lush_forest');
        expect(q(rows[2], '[data-banner-art]').getAttribute('data-banner-art')).toBe('b_swamp');
        expect(q(rows[1], `[data-region-node="${OAK}"]`).textContent).toContain('2');
        expect(q(rows[1], '[data-region-travel]')).toBeTruthy();
        expect(q(rows[0], '[data-region-here]')).toBeTruthy();
    });

    it('orders by kind, then day, then as written; and counts a board\'s Tokens but the Hall\'s', () => {
        const settled = { s: 0, a: 9, b: 9, c: 1 };
        const list = [{ id: 'a' }, { id: 's', kind: Atlas.REGION_KIND.STARTER }, { id: 'b' }, { id: 'c' }];
        expect(regionOrder(list, id => settled[id]).map(r => r.id)).toEqual(['s', 'c', 'a', 'b']);
        expect(mainNodes({ tokens: { 1: { typeId: 'x' }, 2: { typeId: 'y' }, 3: { typeId: 'y' }, 4: { typeId: 'token_guild_hall' } } }))
            .toEqual([{ typeId: 'y', count: 2 }, { typeId: 'x', count: 1 }]);
    });

    it('the arrival card shows the destination\'s banner and name on travel; a click skips it, else it goes by itself', () => {
        vi.useFakeTimers();
        const { region } = Atlas.createRegion({ ingredients: [FOREST], ground: { main: 'forest' } });
        const { container } = render(React.createElement(ArrivalCard, { durationMs: 1000 }));
        expect(q(container, '[data-arrival-card]')).toBeNull();
        act(() => { Atlas.travel(region.id); });
        const card = q(container, `[data-arrival-card="${region.id}"]`);
        expect(card).toBeTruthy();
        expect(q(card, '[data-arrival-name]').textContent).toBe(region.flavourName);
        expect(q(card, '[data-banner-art]').getAttribute('data-banner-art')).toBe('b_swamp');
        fireEvent.pointerDown(card);
        expect(q(container, '[data-arrival-card]')).toBeNull();
        act(() => { Atlas.travel(Atlas.list().find(r => r.kind === Atlas.REGION_KIND.STARTER).id); });
        expect(q(container, '[data-arrival-card]')).toBeTruthy();
        act(() => { vi.advanceTimersByTime(1001); });
        expect(q(container, '[data-arrival-card]')).toBeNull();
    });

    it('the arrival card waits while held (the camera gliding back to the mat), then stays its full time', () => {
        vi.useFakeTimers();
        const { region } = Atlas.createRegion({ ingredients: [FOREST], ground: { main: 'forest' } });
        const card = (held) => React.createElement(ArrivalCard, { durationMs: 1000, held });
        const { container, rerender } = render(card(true));
        act(() => { Atlas.travel(region.id); });
        expect(q(container, '[data-arrival-card]')).toBeNull();
        act(() => { vi.advanceTimersByTime(1500); });
        expect(q(container, '[data-arrival-card]')).toBeNull();
        rerender(card(false));
        expect(q(container, `[data-arrival-card="${region.id}"]`)).toBeTruthy();
        act(() => { vi.advanceTimersByTime(999); });
        expect(q(container, '[data-arrival-card]')).toBeTruthy();
        act(() => { vi.advanceTimersByTime(2); });
        expect(q(container, '[data-arrival-card]')).toBeNull();
    });

    it('a rename is not an arrival', () => {
        const { region } = Atlas.createRegion({ ingredients: [FOREST] });
        const { container } = render(React.createElement(ArrivalCard));
        act(() => { Atlas.rename(region.id, 'Somewhere Else'); });
        expect(q(container, '[data-arrival-card]')).toBeNull();
    });

    it('a slice of it lies behind the Region name on the top bar', () => {
        const { container } = render(React.createElement(MatRegionName, {
            readName: () => ({ name: 'Elderfield', practical: 'Starter Camp' }), readBanner: () => 'b_village'
        }));
        const slice = q(container, '[data-mat-region-banner]');
        expect(slice.getAttribute('data-mat-region-banner')).toBe('b_village');
        expect(q(slice, '[data-banner-art="b_village"]')).toBeTruthy();
        expect(q(slice, '[data-mat-region-name]').textContent).toContain('Elderfield');
    });

    it('it lies behind the Cartography layout preview, tinting through the map', () => {
        InventoryManager.addItem(FOREST, 1);
        const { container } = render(React.createElement(CartographyTable, { version: 0 }));
        expect(q(container, '[data-cartography-preview] [data-banner-art]')).toBeNull();
        fireEvent.click(q(container, `[data-map-item="${FOREST}"]`));
        expect(q(container, '[data-cartography-preview] [data-banner-art]').getAttribute('data-banner-art')).toBe('b_swamp');
        expect(Number(q(container, '[data-layout-preview] rect').getAttribute('fill-opacity'))).toBeLessThan(1);
    });
});
