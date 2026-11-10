// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, act, cleanup } from '@testing-library/react';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { flavourName } from '../systems/atlas/regionNames.js';
import * as World from '../systems/world/World.js';
import { CELL_STATE } from '../systems/world/frontier.js';
import { STRICT_RINGS } from '../config/worldTablesShape.js';
import { resetMatTuning } from '../config/matTuning.js';
import { tileArt, ropeArt, symbolArt, expectedArt, DRAWN } from '../config/worldMapArt.js';
import { formatCompact } from '../utils/Formatters.js';
import { t } from '../i18n/index.js';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import { WorldScreen } from '../ui/components/atlas/WorldScreen.jsx';
import { WorldCamera } from '../ui/components/atlas/WorldCamera.jsx';
import { WorldDrawer } from '../ui/components/atlas/WorldDrawer.jsx';
import { shortWords } from '../ui/components/atlas/WorldPrice.jsx';
import { NOTIFICATION_COLUMN, columnWidthAt } from '../ui/components/board/boardConstants.js';
import * as MatCap from '../systems/board/MatCap.js';
import { formatPlaytime } from '../utils/Formatters.js';
import {
    shownRings, cellLook, CELL_LOOK, cellMiddle, cellCentre, mapSize, hexPoints, cellCentreArt, clampView, viewOn, mapBounds, PAN_KEEP_PX,
    HEX_R, TILE_W, TILE_H, ART_SCALE
} from '../ui/components/atlas/worldMapLayout.js';
import { paintWorld, paintRope, ringEdges, pictureFrame, tileStandIn, FOG_RGB } from '../ui/components/atlas/worldPicture.js';
import { meetFrontierPrices } from '../ui/dev/worldDev.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as QuestTokens from '../systems/quests/QuestTokens.js';
import { TUTORIAL_QUESTS } from '../systems/quests/tutorialQuests.js';
import { TUTORIAL_TEXT } from '../systems/quests/tutorialText.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The world map: the run's hex world as board tiles over a painted world, below the mat. The
 * strict rings show from the start and a wild ring once the guild can reach into it; each cell's
 * look says whether it is settled, can be settled now, is too dear, or is out of reach. The hover
 * names the place and its land and gives its price in the 9.9k shorthand; the World Map drawer holds
 * its ground dials and what it yields, its price and a large Settle, or, once settled, its picture
 * with its Tokens over the cap, the time spent there, a rename behind the quill and Travel.
 */

const q = (container, sel) => container.querySelector(sel);

function newGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    EngineBootstrap.createDefaultGameData();
    World.createWorld({ seed: 77 });
    GameState.state.progress.rosterLimit = 4;
}

/** The screen and its drawer, as ReactRoot mounts them: the drawer beside, open while the map is. */
const screen = ({ onClose = vi.fn(), menuRight = false } = {}) => render(React.createElement(
    DeckDndContext.Provider, { value: { activePayload: null, isDragging: false } },
    React.createElement(WorldScreen, { onClose, menuRight }),
    React.createElement(WorldDrawer, { open: true, onClose, menuRight })
));
/** The drawer's width at this window's width, as the screen reserves it. */
const drawerPx = () => columnWidthAt(window.innerWidth, NOTIFICATION_COLUMN);
const cellOf = (id) => World.currentWorld().cells.find(c => c.id === id);
const pickCell = (container, id) => fireEvent.click(q(container, `[data-world-cell="${id}"]`));
const payFor = (id) => {
    const hero = HeroManager.getAllHeroes()[0] || HeroManager.addHero(generateHero());
    for (const { skill, level } of cellOf(id).requires.skills) addXP(hero.id, skill, xpForLevel(level));
    for (const { itemId, qty } of cellOf(id).requires.items) InventoryManager.addItem(itemId, qty);
};

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});
beforeEach(() => newGame());
afterEach(() => {
    cleanup();
    SaveManager.currentSlot = null;
    GameLoop.stop();
});
afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('the map\'s geometry and looks (pure)', () => {
    const states = (pairs) => new Map(pairs);

    it('shows the strict rings always, and a wild ring once any of its cells is settled or on the frontier', () => {
        const world = { rings: 6, cells: [{ id: 'a', ring: 0 }, { id: 'b', ring: 3 }, { id: 'c', ring: 4 }, { id: 'd', ring: 5 }] };
        expect(shownRings(world, states([['a', CELL_STATE.SETTLED], ['b', CELL_STATE.BEYOND], ['c', CELL_STATE.BEYOND]]))).toBe(STRICT_RINGS);
        expect(shownRings(world, states([['a', CELL_STATE.SETTLED], ['b', CELL_STATE.SETTLED], ['c', CELL_STATE.FRONTIER]]))).toBe(4);
        expect(shownRings(world, states([['d', CELL_STATE.SETTLED]]))).toBe(5);
        expect(shownRings({ rings: 3, cells: [{ id: 'x', ring: 3 }] }, states([['x', CELL_STATE.SETTLED]]))).toBe(3);
        expect(shownRings(null, new Map())).toBe(0);
    });

    it('a cell is lit when settled, ready when on the frontier and paid for in an open ring, else darkened; further out black and white', () => {
        const met = { met: true };
        const short = { met: false };
        expect(cellLook({ state: CELL_STATE.SETTLED, price: short })).toBe(CELL_LOOK.SETTLED);
        expect(cellLook({ state: CELL_STATE.FRONTIER, price: met })).toBe(CELL_LOOK.READY);
        expect(cellLook({ state: CELL_STATE.FRONTIER, price: short })).toBe(CELL_LOOK.DARK);
        // A ring the guild may not settle yet (the Hall's ring stars) darkens a cell it could pay for.
        expect(cellLook({ state: CELL_STATE.FRONTIER, price: met }, { ringOpen: () => false })).toBe(CELL_LOOK.DARK);
        expect(cellLook({ state: CELL_STATE.BEYOND, price: met })).toBe(CELL_LOOK.GREY);
    });

    it('puts flat-topped neighbours side by side on whole art pixels, drawn at 2x', () => {
        expect(cellCentreArt({ q: 0, r: 0 })).toEqual({ x: 0, y: 0 });
        expect(cellCentreArt({ q: 1, r: 0 })).toEqual({ x: 63, y: 36 });
        expect(cellCentreArt({ q: 0, r: 1 })).toEqual({ x: 0, y: 73 });
        expect(cellMiddle({ q: 1, r: 0 })).toEqual({ x: 63 * ART_SCALE, y: 36 * ART_SCALE });
        expect([TILE_W, TILE_H]).toEqual([84, 78]);
    });

    it('keeps the plan helpers the Ledger in the CMS draws its world with, at any radius', () => {
        expect(cellCentre({ q: 1, r: 0 }, 40)).toEqual({ x: 60, y: 35 });
        expect(cellCentre({ q: 0, r: 1 }, 40)).toEqual({ x: 0, y: 69 });
        expect(mapSize(3, 40)).toEqual({ width: 440, height: 485 });
        expect(hexPoints(10).split(' ')).toHaveLength(6);
    });

    it('keeps some of the map in sight however far it is dragged, and centres on a cell', () => {
        const bounds = mapBounds([{ q: 0, r: 0 }, { q: 3, r: 0 }, { q: -3, r: 0 }]);
        const sight = { w: 1000, h: 700 };
        const far = clampView({ x: 99999, y: -99999 }, sight, bounds);
        expect(far.x + bounds.minX).toBe(sight.w - PAN_KEEP_PX);
        expect(far.y + bounds.maxY).toBe(PAN_KEEP_PX);
        expect(viewOn({ q: 0, r: 0 }, sight)).toEqual({ x: 500, y: 350 });
    });
});

describe('the world picture (pure)', () => {
    const world = () => World.currentWorld();

    it('paints every pixel, the fog past the rings shown, and is the size its frame says', () => {
        const frame = pictureFrame(3);
        const picture = paintWorld({ cells: world().cells, rings: 3 });
        expect([picture.width, picture.height]).toEqual([frame.width, frame.height]);
        const alpha = new Set();
        for (let i = 3; i < picture.data.length; i += 4) alpha.add(picture.data[i]);
        expect([...alpha]).toEqual([255]);
        // A corner is all fog (give or take its dither); the Hall's middle is painted land.
        const at = (x, y) => [...picture.data.slice((y * picture.width + x) * 4, (y * picture.width + x) * 4 + 3)];
        const [r, g, b] = at(0, 0);
        expect(r - FOG_RGB[0]).toBeGreaterThanOrEqual(0);
        expect(r - FOG_RGB[0]).toBeLessThanOrEqual(6);
        expect([g, b]).toEqual([FOG_RGB[1], FOG_RGB[2]]);
        expect(at(frame.originX, frame.originY)).not.toEqual([FOG_RGB[0], FOG_RGB[1], FOG_RGB[2]]);
    });

    it('is the same picture every time for the same world', () => {
        const a = paintWorld({ cells: world().cells, rings: 3 });
        const b = paintWorld({ cells: world().cells, rings: 3 });
        expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
    });

    it('draws the rope where rings meet, round the outside of the rings shown, never round the Hall', () => {
        const edges = ringEdges(world().cells, 3, cellCentreArt);
        // Each ring k meets ring k+1 along 6 (2k + 1) edges: 18 + 30 + 42 for three rings.
        expect(edges.edges).toHaveLength(18 + 30 + 42);
        for (const e of edges.edges) {
            expect(Math.hypot(e.mid.x, e.mid.y)).toBeGreaterThan(HEX_R * 1.4);
            expect(['flat', 'rise', 'fall']).toContain(e.kind);
        }
        const rope = paintRope(edges, pictureFrame(3));
        let drawn = 0;
        for (let i = 3; i < rope.data.length; i += 4) if (rope.data[i]) drawn++;
        expect(drawn).toBeGreaterThan(90 * 40);
        // The owner's pieces replace the stand-in's: none drawn when every kind is skipped.
        const none = paintRope(edges, pictureFrame(3), { skip: ['flat', 'rise', 'fall'], skipKnots: true });
        expect(none.data.some(v => v !== 0)).toBe(false);
    });

    it('a tile stand-in is the size of the owner\'s tile, a hex face with its side showing under it', () => {
        const tile = tileStandIn('highland');
        expect([tile.width, tile.height]).toEqual([84, 78]);
        const alphaAt = (x, y) => tile.data[(y * tile.width + x) * 4 + 3];
        expect(alphaAt(42, 36)).toBe(255);
        expect(alphaAt(42, 76)).toBe(255);
        expect(alphaAt(0, 0)).toBe(0);
        expect(alphaAt(83, 77)).toBe(0);
    });

    it('draws the code stand-ins until a picture is listed as drawn, then the owner\'s file', () => {
        expect(DRAWN).toEqual([]);
        expect(tileArt('highland')).toBeNull();
        expect(tileArt('highland', ['world_tile_highland'])).toBe('/assets/ui/world/world_tile_highland.png');
        expect(ropeArt('knot', ['world_rope_knot'])).toBe('/assets/ui/world/world_rope_knot.png');
        expect(symbolArt('wetland', ['world_symbol_wetland'])).toBe('/assets/ui/world/world_symbol_wetland.png');
        expect(expectedArt()).toHaveLength(6 + 4 + 5);
    });
});

describe('⭐ the world map screen', () => {
    it('⭐ draws the strict rings as tiles, the Hall settled with the guild\'s flag, ring 1 on the frontier, the rest black and white', () => {
        const { container } = screen();
        expect(container.querySelectorAll('[data-world-cell]')).toHaveLength(1 + 6 + 12 + 18);
        expect(container.querySelectorAll('[data-world-tile]')).toHaveLength(37);
        const lookOf = (id) => q(container, `[data-world-cell="${id}"]`).getAttribute('data-world-look');
        for (const cell of World.currentWorld().cells.filter(c => c.ring <= STRICT_RINGS)) {
            const want = cell.ring === 0 ? CELL_LOOK.SETTLED : cell.ring === 1 ? CELL_LOOK.DARK : CELL_LOOK.GREY;
            expect(lookOf(cell.id), cell.id).toBe(want);
        }
        expect(q(container, `[data-world-tile="${World.currentWorld().cells.find(c => c.ring === 3).id}"]`).style.filter).toContain('grayscale');
        expect(q(container, '[data-world-here] [data-flag-mark]').style.width).toBe('48px');
        // The Hall's place is shown first, settled, with no Settle.
        expect(q(container, '[data-world-detail="0,0"]')).toBeTruthy();
        expect(q(container, '[data-world-settle]')).toBeNull();
    });

    it('no wild ring shows until the guild can reach into it', () => {
        const world = World.currentWorld();
        const { container } = screen();
        expect(q(container, '[data-world-map]').getAttribute('data-world-rings')).toBe(String(STRICT_RINGS));
        expect(container.querySelector(`[data-world-cell="${world.cells.find(c => c.ring === STRICT_RINGS + 1).id}"]`)).toBeNull();
        cleanup();
        // A ring-3 place settled puts ring 4 cells on the frontier: ring 4 shows.
        const edge = world.cells.find(c => c.ring === STRICT_RINGS);
        Atlas.createRegion({ ingredients: [`world_cell_${edge.id}`], cellId: edge.id });
        const { container: after } = screen();
        expect(q(after, '[data-world-map]').getAttribute('data-world-rings')).toBe(String(STRICT_RINGS + 1));
        expect(after.querySelectorAll('[data-world-cell]').length).toBe(1 + 6 + 12 + 18 + 24);
    });

    it('each tile shows its first outputs as item sprites and the Token its place holds most of', () => {
        const { container } = screen();
        const cell = cellOf('1,0');
        const plate = q(container, '[data-world-contents="1,0"] [data-world-plate]');
        const icons = [...plate.querySelectorAll('img')];
        expect(icons.length).toBeGreaterThan(0);
        expect(icons.length).toBeLessThanOrEqual(Math.min(3, World.outputsOf(cell).length));
        expect(q(container, '[data-world-contents="0,0"] img')).toBeTruthy();
    });

    it('⭐ the hover names the place and its land, and gives the price as have/need in the shorthand, red when short', () => {
        const cell = cellOf('1,0');
        const [first] = cell.requires.items;
        InventoryManager.addItem(first.itemId, 12345);
        const { container } = screen();
        fireEvent.pointerEnter(q(container, '[data-world-cell="1,0"]'), { clientX: 400, clientY: 300 });
        const box = document.querySelector('[data-tooltip]');
        expect(box.textContent).toContain(flavourName(cell.seed >>> 0));
        const tip = box.querySelector('[data-world-tip="1,0"]');
        expect(q(tip, '[data-world-tip-terrain]').textContent).toBe(World.cellName(cell));
        // No ring, and what it yields is the panel's, not the tip's.
        expect(tip.textContent).not.toMatch(/Ring/);
        expect(tip.querySelectorAll('[data-world-price-item] img').length).toBe(cell.requires.items.length);
        const row = q(tip, `[data-world-price-item="${first.itemId}"]`);
        const have = InventoryManager.getItemCount(first.itemId);
        expect(row.textContent).toBe(`${formatCompact(have)}/${formatCompact(first.qty)}`);
        expect(row.textContent).toMatch(/k\//);
        const skill = cell.requires.skills[0];
        const skillRow = q(tip, `[data-world-price-skill="${skill.skill}"]`);
        // The new game's first hero, at level 1 in everything.
        expect(skillRow.textContent).toBe(`1/${skill.level}`);
        expect(q(skillRow, 'span:last-child').className).toContain('color-ui-red');
    });

    it('the pointer over a cell shows it in full colour with a white outline', () => {
        const { container } = screen();
        const far = World.currentWorld().cells.find(c => c.ring === 3).id;
        expect(q(container, `[data-world-tile="${far}"]`).style.filter).not.toBe('none');
        fireEvent.pointerEnter(q(container, `[data-world-cell="${far}"]`), { clientX: 10, clientY: 10 });
        expect(q(container, `[data-world-tile="${far}"]`).style.filter).toBe('none');
        expect(q(container, `[data-world-contents="${far}"]`).style.filter).toBe('none');
        expect(q(container, `[data-world-outline="${far}"]`)).toBeTruthy();
        fireEvent.pointerLeave(q(container, `[data-world-cell="${far}"]`));
        expect(q(container, `[data-world-outline="${far}"]`)).toBeNull();
    });

    it('runs under the whole screen, centred in the room the nav, the hero bar and the drawer leave', () => {
        // A 1366 x 768 screen, the nav 152 px on the left, the hero bar 100 px at the foot.
        const SCREEN = { left: 0, top: 0, right: 1366, bottom: 768, width: 1366, height: 768 };
        const ROOM = { left: 152, top: 0, right: 1366, bottom: 668, width: 1214, height: 668 };
        const anchor = document.body.appendChild(document.createElement('div'));
        const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
            if (this === anchor) return SCREEN;
            if (this.hasAttribute('data-world-camera-room')) return ROOM;
            return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
        });
        const inMap = (el) => !!el.closest?.('[data-world-backdrop]');
        const cw = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () { return inMap(this) ? SCREEN.width : 0; });
        const ch = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function () { return inMap(this) ? SCREEN.height : 0; });
        try {
            const { container } = render(React.createElement(
                DeckDndContext.Provider, { value: { activePayload: null, isDragging: false } },
                React.createElement(WorldCamera, {
                    open: true,
                    tableAnchor: { current: anchor },
                    world: React.createElement(WorldScreen, { onClose: vi.fn() })
                }, React.createElement('div'))
            ));
            // Laid in the screen's box, not the column's room: nothing at the column's edge clips it.
            const map = q(anchor, '[data-world-map]');
            expect(map).toBeTruthy();
            expect(container.querySelector('[data-world-map]')).toBeNull();
            expect(map.className).toContain('inset-0');
            // The Hall's place in the middle of the room left clear between the nav, the hero bar and
            // the drawer, flush to the screen's right edge.
            const sight = { w: ROOM.width - drawerPx(), h: ROOM.height };
            const at = viewOn(World.currentWorld().cells.find(c => c.ring === 0), sight);
            expect(map.getAttribute('data-world-view')).toBe(`${at.x},${at.y}`);
            const drawn = map.firstElementChild.style.transform;
            expect(drawn).toBe(`translate3d(${at.x + ROOM.left}px, ${at.y + ROOM.top}px, 0)`);
            // The place's panel is the drawer now, not a box over the map.
            expect(q(anchor, '[data-world-panel]')).toBeNull();
        } finally {
            rect.mockRestore();
            cw.mockRestore();
            ch.mockRestore();
            cleanup();
            anchor.remove();
        }
    });

    it('with the nav on the right, the drawer stands at the left edge and the map centres right of it', () => {
        const SCREEN = { left: 0, top: 0, right: 1366, bottom: 768, width: 1366, height: 768 };
        const ROOM = { left: 0, top: 0, right: 1214, bottom: 668, width: 1214, height: 668 };
        const anchor = document.body.appendChild(document.createElement('div'));
        const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
            if (this === anchor) return SCREEN;
            if (this.hasAttribute('data-world-camera-room')) return ROOM;
            return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
        });
        const inMap = (el) => !!el.closest?.('[data-world-backdrop]');
        const cw = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () { return inMap(this) ? SCREEN.width : 0; });
        const ch = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function () { return inMap(this) ? SCREEN.height : 0; });
        try {
            const { container } = render(React.createElement(
                DeckDndContext.Provider, { value: { activePayload: null, isDragging: false } },
                React.createElement(WorldCamera, {
                    open: true,
                    tableAnchor: { current: anchor },
                    world: React.createElement(WorldScreen, { onClose: vi.fn(), menuRight: true })
                }, React.createElement('div')),
                React.createElement(WorldDrawer, { open: true, menuRight: true, onClose: vi.fn() })
            ));
            const map = q(anchor, '[data-world-map]');
            const sight = { w: SCREEN.width - drawerPx() - (SCREEN.right - ROOM.right), h: ROOM.height };
            const at = viewOn(World.currentWorld().cells.find(c => c.ring === 0), sight);
            expect(map.getAttribute('data-world-view')).toBe(`${at.x},${at.y}`);
            expect(map.firstElementChild.style.transform).toBe(`translate3d(${at.x + drawerPx()}px, ${at.y}px, 0)`);
            expect(q(container, '[data-world-panel]').getAttribute('data-side-drawer')).toBe('left');
        } finally {
            cw.mockRestore();
            ch.mockRestore();
            rect.mockRestore();
            cleanup();
            anchor.remove();
        }
    });

    it('a drag moves the map and the click that ends it chooses nothing', () => {
        const { container } = screen();
        const map = q(container, '[data-world-map]');
        const before = map.getAttribute('data-world-view');
        const cell = q(container, '[data-world-cell="1,0"]');
        fireEvent.pointerDown(cell, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
        fireEvent.pointerMove(window, { pointerId: 1, clientX: 60, clientY: 80 });
        fireEvent.pointerUp(window, { pointerId: 1, clientX: 60, clientY: 80 });
        fireEvent.click(cell);
        expect(map.getAttribute('data-world-view')).not.toBe(before);
        expect(q(container, '[data-world-detail="0,0"]')).toBeTruthy();
        fireEvent.click(cell);
        expect(q(container, '[data-world-detail="1,0"]')).toBeTruthy();
    });

    it('Settle greys out and says what is short until the guild can pay; then the cell pulses gold, settles, and the map closes', async () => {
        const onClose = vi.fn();
        const { container } = screen({ onClose });
        pickCell(container, '1,0');
        const settle = () => q(container, '[data-world-settle="1,0"]');
        expect(settle().disabled).toBe(true);
        const price = World.priceOf(cellOf('1,0'));
        expect(q(container, '[data-world-message]').textContent).toBe(shortWords(price));
        expect(q(container, '[data-world-pulse="1,0"]')).toBeNull();

        act(() => payFor('1,0'));
        expect(settle().disabled).toBe(false);
        expect(q(container, '[data-world-message]')).toBeNull();
        expect(q(container, '[data-world-cell="1,0"]').getAttribute('data-world-ready')).toBe('true');
        const pulse = q(container, '[data-world-pulse="1,0"]');
        expect(pulse.getAttribute('stroke-width')).toBe('4');
        expect(q(pulse, 'animate').getAttribute('values')).toBe('#fbbf24;#fde68a');
        await act(async () => { fireEvent.click(settle()); });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(World.activeCellId()).toBe('1,0');
        // The place keeps the name the map showed.
        expect(Atlas.activeRegion().flavourName).toBe(flavourName(cellOf('1,0').seed >>> 0));
    });

    it('a cell beyond the frontier offers nothing to press, only why', () => {
        const { container } = screen();
        const beyond = World.currentWorld().cells.find(c => c.ring === 2);
        pickCell(container, beyond.id);
        expect(q(container, `[data-world-detail="${beyond.id}"]`)).toBeTruthy();
        expect(q(container, '[data-world-settle]')).toBeNull();
        expect(q(container, '[data-world-travel]')).toBeNull();
        expect(q(container, '[data-world-detail-state]').textContent).toBe(t('worldMap.beyond'));
    });

    it('the panel holds what a place yields and its price; the tip holds neither list', () => {
        const { container } = screen();
        pickCell(container, '1,0');
        const yields = q(container, '[data-world-yields]');
        expect(yields.querySelectorAll('[data-entity-ribbon], img').length).toBeGreaterThan(0);
        expect(q(container, '[data-world-price]')).toBeTruthy();
        expect(q(container, '[data-world-terrain]').textContent).toBe(World.cellName(cellOf('1,0')));
    });

    it('a settled place elsewhere shows its picture and facts and offers Travel, which closes the map; the flag marks where the guild is, with no words', async () => {
        payFor('0,1');
        expect(World.settleCell('0,1').success).toBe(true);
        const onClose = vi.fn();
        const { container } = screen({ onClose });
        expect(q(container, '[data-world-detail="0,1"]')).toBeTruthy();
        expect(q(container, '[data-world-detail-here] [data-flag-mark]').style.width).toBe('48px');
        expect(q(container, '[data-world-panel]').textContent).not.toContain(t('worldMap.here'));
        expect(q(container, '[data-world-travel]')).toBeNull();
        pickCell(container, '0,0');
        expect(q(container, '[data-world-facts]')).toBeTruthy();
        expect(q(container, '[data-world-preview]')).toBeTruthy();
        expect(q(container, '[data-world-preview] [data-world-count]')).toBeTruthy();
        expect(q(container, '[data-world-ground]')).toBeTruthy();
        expect(q(container, '[data-world-playtime]')).toBeTruthy();
        await act(async () => { fireEvent.click(q(container, '[data-world-travel="0,0"]')); });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(World.activeCellId()).toBe('0,0');
    });

    it('a settled place is renamed on its panel: Enter keeps the name, Escape drops it', () => {
        payFor('0,1');
        World.settleCell('0,1');
        const { container } = screen();
        fireEvent.click(q(container, '[data-world-rename="0,1"]'));
        const input = q(container, '[data-world-rename-input="0,1"]');
        fireEvent.change(input, { target: { value: 'Fresh Name' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(Atlas.activeRegion().flavourName).toBe('Fresh Name');
        expect(q(container, '[data-world-name]').textContent).toBe('Fresh Name');
        fireEvent.click(q(container, '[data-world-rename="0,1"]'));
        fireEvent.change(q(container, '[data-world-rename-input="0,1"]'), { target: { value: 'Never Kept' } });
        fireEvent.keyDown(q(container, '[data-world-rename-input="0,1"]'), { key: 'Escape' });
        expect(Atlas.activeRegion().flavourName).toBe('Fresh Name');
        // A place not yet settled has no rename.
        pickCell(container, '1,0');
        expect(q(container, '[data-world-rename]')).toBeNull();
    });

    it('Escape and the panel\'s close X close it', () => {
        const onClose = vi.fn();
        const { container } = screen({ onClose });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
        fireEvent.click(q(container, '[data-world-close]'));
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('has no book and no tabs', () => {
        const { container } = screen();
        expect(q(container, '[data-tome-pages]')).toBeNull();
        expect(q(container, '[role="tab"]')).toBeNull();
    });

    it('a save from before the world shows one line and no map', () => {
        GameState.state.world = null;
        const { container } = screen();
        expect(q(container, '[data-world-none]').textContent).toBe(t('worldMap.noWorld'));
        expect(q(container, '[data-world-map]')).toBeNull();
    });
});

describe('⭐ the World Map drawer (brief 570 D4)', () => {
    const dialsOf = (container) => Object.fromEntries([...container.querySelectorAll('[data-world-dial]')]
        .map(d => [d.getAttribute('data-world-dial'), Number(d.getAttribute('data-world-dial-percent'))]));

    it('⭐ the place the guild is on: its preview with Tokens over the cap in the corner, the three dials, its time there; no fact rows or Token list', () => {
        const home = Atlas.activeRegionId();
        GameState.state.atlas.regions[home].playtimeMs = (60 + 24) * 60_000;
        const { container } = screen();
        const drawer = q(container, '[data-world-panel]');
        expect(drawer.getAttribute('data-side-drawer')).toBe('right');
        expect(q(drawer, '[data-world-detail="0,0"]')).toBeTruthy();
        expect(q(drawer, '[data-world-preview] [data-world-count]').textContent).toBe(`${MatCap.tokenCount()}/${MatCap.matCap()}`);
        expect(Object.keys(dialsOf(drawer))).toEqual(['water', 'grass', 'stone']);
        expect(dialsOf(drawer)).toEqual(World.placeGround('0,0'));
        expect(q(drawer, '[data-world-playtime]').textContent).toBe('1h 24m');
        expect(q(drawer, '[data-world-fact]')).toBeNull();
        expect(q(drawer, '[data-world-holds]')).toBeNull();
        expect(q(drawer, '[data-world-token]')).toBeNull();
        // The rename is the quill, a bare icon button.
        const quill = q(drawer, '[data-world-rename="0,0"]');
        expect(quill.textContent).toBe('');
        expect(quill.getAttribute('aria-label')).toBe('Rename');
    });

    it('a place not yet settled shows its dials, what it yields and its price; no picture, count or time', () => {
        const { container } = screen();
        pickCell(container, '1,0');
        const drawer = q(container, '[data-world-panel]');
        expect(dialsOf(drawer)).toEqual(World.placeGround('1,0'));
        const { water, grass, stone } = dialsOf(drawer);
        expect(water + grass + stone).toBe(100);
        expect(q(drawer, '[data-world-yields]')).toBeTruthy();
        expect(q(drawer, '[data-world-price]')).toBeTruthy();
        expect(q(drawer, '[data-world-preview]')).toBeNull();
        expect(q(drawer, '[data-world-count]')).toBeNull();
        expect(q(drawer, '[data-world-playtime]')).toBeNull();
        expect(q(drawer, '[data-world-rename]')).toBeNull();
    });

    it('a settled place the guild has left counts its own Tokens over the guild\'s cap, and keeps its time', () => {
        const home = Atlas.activeRegionId();
        payFor('0,1');
        expect(World.settleCell('0,1').success).toBe(true);
        GameState.state.atlas.regions[home].playtimeMs = 5 * 60_000;
        const { container } = screen();
        pickCell(container, '0,0');
        const { count, cap } = Atlas.capStatusOf(home);
        expect(count).toBeGreaterThan(0);
        expect(q(container, '[data-world-count]').textContent).toBe(`${count}/${cap}`);
        expect(q(container, '[data-world-playtime]').textContent).toBe(formatPlaytime(5 * 60_000));
        // The place the guild moved to counts as the cap does.
        pickCell(container, '0,1');
        expect(q(container, '[data-world-count]').textContent).toBe(`${MatCap.tokenCount()}/${MatCap.matCap()}`);
    });

    it('stands on the left with the nav on the right; stays shut while the map is closed or shows no world', () => {
        const left = screen({ menuRight: true });
        expect(q(left.container, '[data-world-panel]').getAttribute('data-side-drawer')).toBe('left');
        cleanup();
        const shut = render(React.createElement(WorldDrawer, { open: false, onClose: vi.fn() }));
        expect(q(shut.container, '[data-world-panel]')).toBeNull();
        cleanup();
        GameState.state.world = null;
        const none = screen();
        expect(q(none.container, '[data-world-panel]')).toBeNull();
        expect(q(none.container, '[data-world-none]')).toBeTruthy();
    });
});

describe('the QA panel\'s frontier prices', () => {
    it('tops up what the frontier asks and raises the first hero, so every ring 1 cell can be paid', () => {
        // A game with no hero (a dev roster) is refused: the price asks for skill levels.
        GameState.state.heroes = [];
        expect(meetFrontierPrices()).toMatchObject({ success: false });
        HeroManager.addHero(generateHero());
        const result = meetFrontierPrices();
        expect(result).toMatchObject({ success: true, cells: 6 });
        for (const cell of World.currentWorld().cells.filter(c => c.ring === 1)) expect(World.priceOf(cell).met, cell.id).toBe(true);
    });
});

describe('the cartographer on the world map', () => {
    it('while the tutorial\'s last step asks for a first place, its words head the panel; then they go', () => {
        const { container: before } = screen();
        expect(q(before, '[data-world-note]')).toBeNull();
        cleanup();

        const quests = GameState.state.quests;
        for (const step of TUTORIAL_QUESTS.slice(0, -1)) quests.completedTutorials.push(step.id);
        for (const token of QuestTokens.tutorialTokens()) BoardState.removeToken(token.id);
        expect(QuestTokens.ensureTutorial()).toBe(true);
        const { container } = screen();
        const note = q(container, '[data-world-panel] [data-world-note]');
        expect(note.textContent).toContain(TUTORIAL_TEXT.steps.cart_first_place.title);
        expect(note.textContent).toContain(TUTORIAL_TEXT.speaker);
        cleanup();

        QuestTokens.tutorialTokens()[0].quest.done = true;
        expect(q(screen().container, '[data-world-note]')).toBeNull();
    });
});

describe('a place\'s name', () => {
    it('is the name its seed gives before it is settled, and its Region takes the same name', () => {
        const cell = cellOf('1,0');
        expect(World.placeName(cell)).toBe(flavourName(cell.seed >>> 0));
        expect(World.placeName(cellOf('0,0'))).toBe(World.cellName(cellOf('0,0')));
        const written = World.writePlace({ ...cell }, { cellId: cell.id });
        expect(written.success).toBe(true);
        expect(written.region.flavourName).toBe(World.placeName(cell));
    });
});
