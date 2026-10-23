// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { summariseMat, rowLabel } from '../systems/board/MatSummary.js';
import { MatTopBar, showsMatTopBar, MAT_TOP_BAR_PX } from '../ui/components/board/MatTopBar.jsx';
import { MatCapBadge, liveMatSummary } from '../ui/components/board/MatCapBadge.jsx';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as MatCap from '../systems/board/MatCap.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import fs from 'node:fs';
import path from 'node:path';
import { MatRegionName, liveRegionName } from '../ui/components/board/MatRegionName.jsx';
import { MatUpkeepBadge } from '../ui/components/board/MatUpkeepBadge.jsx';
import { MapModeToggles, MapModeBanner } from '../ui/components/board/MatModeControls.jsx';
import { MAP_MODE, setMapMode } from '../ui/hooks/useMapMode.js';
import { REGION_BANNER_PX, REGION_BANNER_SCALE } from '../ui/components/board/MatRegionName.jsx';
import { setLiveMatFit } from '../ui/components/board/MatFitContext.jsx';
import { matW } from '../config/matGeometry.js';
import { PixelFrame } from '../ui/components/base/PixelFrame.jsx';
import * as Atlas from '../systems/atlas/Atlas.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';

/**
 * Token Lifecycle feedback **B2.1** — the mat's top bar and the Token cap
 * badge.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const tokenDef = (id, name, extra = {}) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra
});
registerTokenTypes({
    fixture_mb_oak: tokenDef('fixture_mb_oak', 'Bar Oak Forest'),
    fixture_mb_bench: tokenDef('fixture_mb_bench', 'Bar Workbench'),
    fixture_mb_tree: tokenDef('fixture_mb_tree', 'Bar Tree'),
    fixture_mb_vein: tokenDef('fixture_mb_vein', 'Bar Vein'),
    fixture_mb_gear: tokenDef('fixture_mb_gear', 'Bar Gear Bench'),
    fixture_mb_forest: tokenDef('fixture_mb_forest', 'Bar Forest', { spawner: { spawns: [{ typeId: 'fixture_mb_tree', weight: 1 }], allowance: 2, intervalMs: 10000, upkeep: [] } }),
    fixture_mb_hall: tokenDef('fixture_mb_hall', 'Bar Hall', { isGuildHall: true })
});

// --- The pure summary --------------------------------------------------------

const t = (typeId, extra = {}) => ({ id: `${typeId}_${Math.random()}`, typeId, ...extra });
const readers = {
    nameOf: (id) => ({ oak: 'Oak Forest', bench: 'Workbench', tree: 'Oak Tree', vein: 'Iron Vein', hall: 'Guild Hall' }[id] || id),
    isExcluded: (i) => i.typeId === 'hall',
};

describe('summariseMat (Token Summary)', () => {
    const layouts = {
        oak: { section: 'forestry', anchor: 'Oak Forest', rank: 0 },
        tree: { section: 'forestry', anchor: 'Oak Forest', rank: 1 },
        bench: { section: 'crafting', anchor: 'Workbench', rank: 0 },
        vein: { section: 'general', anchor: 'Iron Vein', rank: 0 }
    };
    const withLayout = {
        ...readers,
        layoutOf: (id) => layouts[id],
        sectionName: (s) => ({ forestry: 'Forestry', crafting: 'Crafting', general: 'General' }[s]),
        statusOf: (i) => ({ status: i.status || 'idle', missing: !!i.missing })
    };

    it('one row per type with working, idle, blocked and disallowed counts', () => {
        const s = summariseMat([
            t('oak', { status: 'working' }), t('oak', { status: 'working' }), t('oak', { status: 'idle' }),
            t('oak', { status: 'blocked' }), t('oak', { status: 'off' }), t('bench')
        ], withLayout);
        const oak = s.sections.flatMap(x => x.rows).find(r => r.typeId === 'oak');
        expect(oak).toMatchObject({ count: 5, working: 2, idle: 1, blocked: 1, off: 1 });
        expect(rowLabel(oak)).toBe('Oak Forest ×5');
        expect(s.total).toBe(6);
    });

    it('placed and spawned Tokens of one type share a row; the Guild Hall is left out', () => {
        const s = summariseMat([t('hall'), t('tree'), t('tree', { origin: 'spawned' })], withLayout);
        expect(s.total).toBe(2);
        expect(s.sections.flatMap(x => x.rows).map(r => [r.typeId, r.count])).toEqual([['tree', 2]]);
    });

    it('⭐ rows missing items come first; the rest sit under sections (General last), a spawner right before what it spawns', () => {
        const s = summariseMat([
            t('vein'), t('tree'), t('oak'), t('bench'), t('bench', { status: 'blocked', missing: true })
        ], withLayout);
        expect(s.pinned.map(r => r.typeId)).toEqual(['bench']);
        expect(s.sections.map(x => x.name)).toEqual(['Forestry', 'General']);
        expect(s.sections[0].rows.map(r => r.typeId)).toEqual(['oak', 'tree']);
    });

    it('a block that is not a lack of items does not pin', () => {
        const s = summariseMat([t('oak', { status: 'blocked' })], withLayout);
        expect(s.pinned).toEqual([]);
        expect(s.sections[0].rows[0].blocked).toBe(1);
    });
});

// --- The bar and the badge ---------------------------------------------------

const badgeText = (c) => {
    const badge = c.querySelector('[data-mat-cap-badge]');
    return `${badge.querySelector('[data-item-bar-name]').textContent} ${badge.querySelector('[data-mat-cap-count]').textContent}`;
};

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.heroes = [];
    clearMat();
    setMatTuning('tokenCap', 12);
});

afterEach(() => {
    cleanup();
    resetMatTuning();
});

describe('MatTopBar (FB-28)', () => {
    it('is a slim strip with left, middle and right slots', () => {
        const { container } = render(React.createElement(MatTopBar, {
            left: React.createElement('span', { 'data-l': true }, 'L'),
            right: React.createElement('span', { 'data-r': true }, 'R')
        }));
        const bar = container.querySelector('[data-mat-top-bar]');
        expect(bar.style.height).toBe(`${MAT_TOP_BAR_PX}px`);
        expect(bar.querySelector('[data-mat-top-bar-left] [data-l]')).not.toBeNull();
        expect(bar.querySelector('[data-mat-top-bar-right] [data-r]')).not.toBeNull();
        expect(bar.querySelector('[data-mat-top-bar-middle]')).not.toBeNull();
    });

    it('is drawn on the playmat and not on the Guild Hall upgrade screen', () => {
        expect(showsMatTopBar(null)).toBe(true);
        expect(showsMatTopBar(undefined)).toBe(true);
        expect(showsMatTopBar('guild')).toBe(false);
    });
});

describe('⭐ Token Summary (MatCapBadge)', () => {
    const rows = () => [...document.body.querySelectorAll('[data-token-summary-row]')].map(r => r.getAttribute('data-token-summary-row'));
    const panel = () => document.body.querySelector('[data-token-summary]');
    const badgeOf = (c) => c.querySelector('[data-mat-cap-badge]');

    it('shows placed and spawned Tokens against the cap, the Guild Hall not counted', () => {
        placeAt('fixture_mb_hall', 800, 500);
        placeAt('fixture_mb_oak', 160, 160);
        placeAt(BoardState.createTokenInstance('fixture_mb_tree', null, null, BoardState.ORIGIN.SPAWNED), 320, 160);
        const { container } = render(React.createElement(MatCapBadge));
        expect(badgeText(container)).toBe('Tokens 2/12');
    });

    it('updates live when a Token is placed or removed', () => {
        const { container } = render(React.createElement(MatCapBadge));
        expect(badgeText(container)).toBe('Tokens 0/12');
        const oak = placeAt('fixture_mb_oak', 160, 160);
        act(() => { EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: oak.id, typeId: oak.typeId }); });
        expect(badgeText(container)).toBe('Tokens 1/12');
        BoardState.removeToken(oak.id);
        act(() => { EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: oak.id, x: 160, y: 160, typeId: null }); });
        expect(badgeText(container)).toBe('Tokens 0/12');
    });

    it('updates live when the Mat Tuner changes the cap', () => {
        const { container } = render(React.createElement(MatCapBadge));
        act(() => { setMatTuning('tokenCap', 20); });
        expect(badgeText(container)).toBe('Tokens 0/20');
    });

    it('hover shows a short tooltip and does not open the summary', () => {
        const { container } = render(React.createElement(MatCapBadge));
        fireEvent.mouseEnter(badgeOf(container));
        const tip = document.body.querySelector('[data-top-bar-tip]').textContent;
        expect(tip).toContain('Click for the list.');
        expect(tip).toContain('The Guild Hall and quests do not.');
        // Endgame sites count toward the cap like any placed Token.
        expect(tip).not.toMatch(/endgame/i);
        expect(panel()).toBeNull();
    });

    it('click opens the summary; a second click, Esc and a click elsewhere close it', () => {
        placeAt('fixture_mb_oak', 160, 160);
        const { container } = render(React.createElement(MatCapBadge));
        expect(panel()).toBeNull();
        fireEvent.click(badgeOf(container));
        expect(panel()).not.toBeNull();
        expect(panel().textContent).toContain('Tokens 1/12');
        fireEvent.click(badgeOf(container));
        expect(panel()).toBeNull();

        fireEvent.click(badgeOf(container));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(panel()).toBeNull();

        fireEvent.click(badgeOf(container));
        fireEvent.pointerDown(document.body);
        expect(panel()).toBeNull();

        fireEvent.click(badgeOf(container));
        fireEvent.pointerDown(panel());
        expect(panel()).not.toBeNull();
    });

    it('lists one row per type with status counts, missing items first, then sections', () => {
        placeAt('fixture_mb_hall', 800, 500);
        placeAt('fixture_mb_oak', 160, 160);
        placeAt(BoardState.createTokenInstance('fixture_mb_tree', null, null, BoardState.ORIGIN.SPAWNED), 320, 160);
        placeAt(BoardState.createTokenInstance('fixture_mb_tree', null, null, BoardState.ORIGIN.SPAWNED), 480, 160);
        const bench = placeAt('fixture_mb_bench', 640, 160);
        bench.alert = ALERT.INPUTS;
        const off = placeAt('fixture_mb_vein', 160, 480);
        off.disallowed = true;
        const gear = placeAt('fixture_mb_gear', 320, 480);
        gear.alert = ALERT.CHOOSE_RECIPE;

        const { container } = render(React.createElement(MatCapBadge));
        fireEvent.click(badgeOf(container));
        expect(rows()[0]).toBe('fixture_mb_bench');
        expect(rows().sort()).toEqual(['fixture_mb_bench', 'fixture_mb_gear', 'fixture_mb_oak', 'fixture_mb_tree', 'fixture_mb_vein']);
        const row = (id) => panel().querySelector(`[data-token-summary-row="${id}"]`);
        expect(row('fixture_mb_tree').textContent).toContain('Bar Tree ×2');
        expect(row('fixture_mb_bench').querySelector('[data-status-count="blocked"]').textContent).toBe('1 blocked');
        expect(row('fixture_mb_vein').querySelector('[data-status-count="off"]').textContent).toBe('1 disallowed');
        expect(row('fixture_mb_gear').querySelector('[data-status-count="idle"]')).not.toBeNull();
        expect(panel().querySelector('[data-token-summary-pinned]').textContent).toContain('Bar Workbench');
        expect(panel().textContent).toContain('Tokens 6/12');
        expect(row('fixture_mb_hall')).toBeNull();
    });

    it('a spawner waiting on a full mat reads as blocked, not pinned', () => {
        const sp = placeAt('fixture_mb_forest', 160, 160);
        const { container } = render(React.createElement(MatCapBadge));
        vi.spyOn(SpawnerSystem, 'spawnerAlertOf').mockImplementation((id) => (id === sp.id ? { alert: ALERT.SPAWN_MAT_FULL } : null));
        fireEvent.click(badgeOf(container));
        const row = panel().querySelector('[data-token-summary-row="fixture_mb_forest"]');
        expect(row.querySelector('[data-status-count="blocked"]')).not.toBeNull();
        expect(panel().querySelector('[data-token-summary-pinned]')).toBeNull();
        vi.restoreAllMocks();
    });

    it('hovering a row highlights that type on the mat and leaving clears it', () => {
        placeAt('fixture_mb_oak', 160, 160);
        const art = (typeId) => {
            const el = document.createElement('div');
            el.setAttribute('data-token-art', 'true');
            el.setAttribute('data-token-type', typeId);
            document.body.appendChild(el);
            return el;
        };
        const a = art('fixture_mb_oak');
        const b = art('fixture_mb_oak');
        const c = art('fixture_mb_tree');
        const { container } = render(React.createElement(MatCapBadge));
        fireEvent.click(badgeOf(container));
        const rowEl = panel().querySelector('[data-token-summary-row="fixture_mb_oak"]');
        fireEvent.mouseEnter(rowEl);
        expect([a, b, c].map(e => e.hasAttribute('data-summary-highlight'))).toEqual([true, true, false]);
        fireEvent.mouseLeave(rowEl);
        expect([a, b, c].some(e => e.hasAttribute('data-summary-highlight'))).toBe(false);
        fireEvent.mouseEnter(rowEl);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(a.hasAttribute('data-summary-highlight')).toBe(false);
        [a, b, c].forEach(e => e.remove());
    });

    it('the open summary redraws when a Tokens problem clears', () => {
        const bench = placeAt('fixture_mb_bench', 160, 160);
        bench.alert = ALERT.INPUTS;
        const { container } = render(React.createElement(MatCapBadge));
        fireEvent.click(badgeOf(container));
        expect(panel().querySelector('[data-token-summary-pinned]')).not.toBeNull();
        bench.alert = null;
        act(() => { EventBus.publish(BOARD_EVENTS.ALERT_CHANGED, { instanceId: bench.id, alert: null }); });
        expect(panel().querySelector('[data-token-summary-pinned]')).toBeNull();
    });

    it('the live summary agrees with MatCap on the count', () => {
        placeAt('fixture_mb_hall', 800, 500);
        placeAt('fixture_mb_oak', 160, 160);
        placeAt(BoardState.createTokenInstance('fixture_mb_tree', null, null, BoardState.ORIGIN.SPAWNED), 320, 160);
        const s = liveMatSummary();
        expect(s.total).toBe(MatCap.tokenCount());
    });
});

describe('⭐ the restyled bar (T-170)', () => {
    const regionBar = (c) => c.querySelector('[data-mat-region-name]');

    it('wears the studded pixel frame', () => {
        const { container } = render(React.createElement(MatTopBar));
        const bar = container.querySelector('[data-mat-top-bar]');
        expect(bar.getAttribute('data-pixel-frame')).toBe('studs');
        expect(bar.querySelector('.ui-frame-studs')).not.toBeNull();
        expect(bar.querySelector('[data-pixel-frame-shadow]').className).toContain('ui-frame-shadow-studs');
    });

    const mountWholeBar = () => render(React.createElement(MatTopBar, {
        left: React.createElement(MatRegionName, { readName: () => ({ name: 'Elderfield', practical: 'Starter Camp' }), readBanner: () => 'b_village' }),
        middle: React.createElement(MapModeBanner, {
            fallback: React.createElement(React.Fragment, null,
                React.createElement(MatCapBadge),
                React.createElement(MatUpkeepBadge, { readTotal: () => 0 }))
        }),
        right: React.createElement(MapModeToggles)
    }));

    it('⭐ left: the Region name on its banner; centre: Tokens and Upkeep, each an item bar; right: the toggles', () => {
        const { container } = mountWholeBar();
        const left = container.querySelector('[data-mat-top-bar-left]');
        expect([...left.children].map(e => e.getAttribute('data-mat-region-banner'))).toEqual(['b_village']);
        const middle = container.querySelector('[data-mat-top-bar-middle]');
        const bars = [...middle.children];
        expect(bars.map(e => e.getAttribute('data-mat-cap-badge') !== null ? 'tokens'
            : e.getAttribute('data-mat-upkeep-badge') !== null ? 'upkeep' : '?')).toEqual(['tokens', 'upkeep']);
        expect(bars.every(e => e.hasAttribute('data-item-bar'))).toBe(true);
        expect(container.querySelectorAll('[data-mat-top-bar-right] [data-map-mode-toggle]').length).toBe(2);
        // The side columns are equal, so the centre sits on the mat's centre line.
        expect(container.querySelector('.ui-frame-studs').className).toContain('grid-cols-[1fr_auto_1fr]');
    });

    it('⭐ while a mode is on its banner takes the centre in place of Tokens and Upkeep, and they come back after', () => {
        const { container } = mountWholeBar();
        const middle = container.querySelector('[data-mat-top-bar-middle]');
        act(() => setMapMode(MAP_MODE.DEMOLISH));
        expect(middle.querySelector('[data-map-mode-banner="demolish"] [data-cancel-all-marks]')).not.toBeNull();
        expect(middle.querySelector('[data-mat-cap-badge]')).toBeNull();
        act(() => setMapMode(null));
        expect(middle.querySelector('[data-map-mode-banner]')).toBeNull();
        expect(middle.querySelector('[data-mat-cap-badge]')).not.toBeNull();
    });

    it('⭐ the bar is exactly as wide as the mat on screen, following the fit and the Mat Tuner', () => {
        try {
            act(() => setLiveMatFit(0.5));
            const { container } = render(React.createElement(MatTopBar));
            const bar = container.querySelector('[data-mat-top-bar]');
            expect(bar.style.width).toBe(`${Math.round(matW() * 0.5)}px`);
            act(() => setLiveMatFit(0.86));
            expect(bar.style.width).toBe(`${Math.round(matW() * 0.86)}px`);
            act(() => { setMatTuning('matSteps', 12); });
            expect(matW()).toBe(1920);
            expect(bar.style.width).toBe(`${Math.round(1920 * 0.86)}px`);
            // Never wider than the column it sits in (before Board has reported a fit).
            expect(bar.style.maxWidth).toBe('100%');
        } finally {
            setLiveMatFit(1);
        }
    });

    it('⭐ the Region banner: the Atlas banner at 2x, at most one picture wide, fading out to the right; a big name; no badge, no icon', () => {
        const { container } = render(React.createElement(MatRegionName, {
            readName: () => ({ name: 'Elderfield', practical: 'Starter Camp' }), readBanner: () => 'b_village'
        }));
        const slice = container.querySelector('[data-mat-region-banner]');
        const art = slice.querySelector('[data-banner-art="b_village"]');
        expect(REGION_BANNER_SCALE).toBe(2);
        expect(art.style.width).toBe('100%');
        expect(art.style.maxWidth).toBe(`${REGION_BANNER_PX}px`);
        expect(slice.querySelector('img').getAttribute('data-banner-scale')).toBe('2');
        expect(slice.querySelector('[data-mat-region-name-text]').className).toContain('ui-text-bar-name');
        expect(art.style.maskImage || art.style.webkitMaskImage).toMatch(/linear-gradient\(to right/);
        expect(slice.querySelector('img').style.imageRendering).toBe('pixelated');
        expect(slice.querySelector('[data-item-bar]')).toBeNull();
        expect(slice.querySelectorAll('img').length).toBe(1);
    });

    it('the Region name reads the Region the guild is in, and follows a rename', () => {
        let name = { name: 'Elderfield', practical: 'Starter Camp' };
        const { container } = render(React.createElement(MatRegionName, { readName: () => name }));
        expect(regionBar(container).querySelector('[data-mat-region-name-text]').textContent).toBe('Elderfield');
        name = { name: 'Rockblight Valley', practical: 'Starter Camp' };
        act(() => { EventBus.publish(ENGINE_EVENTS.ATLAS_CHANGED, { reason: 'renamed' }); });
        expect(regionBar(container).querySelector('[data-mat-region-name-text]').textContent).toBe('Rockblight Valley');
    });

    it('the live reader names the Starter Camp by its flavour name', () => {
        Atlas.createStarterRegion();
        const region = Atlas.activeRegion();
        expect(region).not.toBeNull();
        expect(liveRegionName()).toEqual({ name: region.flavourName, practical: region.practicalName });
    });

    it('⭐ a click on the Region name opens the Atlas, and so does Enter', () => {
        const onOpenAtlas = vi.fn();
        const { container } = render(React.createElement(MatRegionName, { onOpenAtlas, readName: () => ({ name: 'Elderfield', practical: '' }) }));
        fireEvent.click(regionBar(container));
        fireEvent.keyDown(regionBar(container), { key: 'Enter' });
        expect(onOpenAtlas).toHaveBeenCalledTimes(2);
    });

    it('no Region yet, no name', () => {
        const { container } = render(React.createElement(MatRegionName, { readName: () => null }));
        expect(regionBar(container)).toBeNull();
    });

    it('⭐ the Token count turns red at the cap, and only there', () => {
        setMatTuning('tokenCap', 2);
        const { container } = render(React.createElement(MatCapBadge));
        const count = () => container.querySelector('[data-mat-cap-count]');
        const isRed = () => count().style.color === 'var(--color-ui-red)';
        expect(isRed()).toBe(false);
        const a = placeAt('fixture_mb_oak', 160, 160);
        act(() => { EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: a.id }); });
        expect(count().textContent).toBe('1/2');
        expect(isRed()).toBe(false);
        const b = placeAt('fixture_mb_bench', 320, 160);
        act(() => { EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId: b.id }); });
        expect(count().textContent).toBe('2/2');
        expect(isRed()).toBe(true);
        expect(container.querySelector('[data-mat-cap-badge]').getAttribute('data-at-cap')).toBe('true');
        // Only the count: the name stays its own colour.
        expect(container.querySelector('[data-mat-cap-badge] [data-item-bar-name]').style.color).toBe('');
        act(() => { setMatTuning('tokenCap', 3); });
        expect(isRed()).toBe(false);
    });
});

describe('PixelFrame', () => {
    it('puts props on the outer box and the frame class on the box that holds the children', () => {
        const { container } = render(React.createElement(PixelFrame, {
            kind: 'chamfer', 'data-x': 'y', className: 'w-10', frameClassName: 'p-2'
        }, React.createElement('span', { 'data-child': true })));
        const outer = container.firstChild;
        expect(outer.getAttribute('data-x')).toBe('y');
        expect(outer.className).toContain('w-10');
        const frame = container.querySelector('.ui-frame-chamfer');
        expect(frame.className).toContain('p-2');
        expect(frame.querySelector('[data-child]')).not.toBeNull();
        expect(outer.querySelector('[data-pixel-frame-shadow]').className).toContain('ui-frame-shadow-chamfer');
    });

    it('its pictures are in public/assets/ui', () => {
        for (const f of ['u_frame_studs', 'u_frame_studs_shadow', 'u_frame_chamfer', 'u_frame_chamfer_shadow']) {
            expect(fs.existsSync(path.join('public/assets/ui', `${f}.png`)), f).toBe(true);
        }
        const css = fs.readFileSync('src/tailwind.css', 'utf8');
        expect(css).toMatch(/\.ui-frame-studs\s*\{\s*border-image-source: url\('\/assets\/ui\/u_frame_studs\.png'\)/);
    });
});
