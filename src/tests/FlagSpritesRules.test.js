// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { FLAG_COLOURS, FLAG_FILLS, flagColourOf, flagFill } from '../systems/board/FlagColours.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { FlagLayer } from '../ui/components/board/FlagLayer.jsx';
import { matAccepts } from '../ui/components/board/Board.jsx';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { FlagGhost } from '../ui/dnd/DragGhost.jsx';
import { HeroEditModal } from '../ui/modals/HeroEditModal.jsx';
import { markerBox, fanStep, MARKER_ART_PX, MARKER_FOOT, MARKER_FAN_ART_PX } from '../ui/components/board/flagGeometry.js';
import { drawnPoint } from './fixtures/drawnPoint.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Records every drag and drop hook the board mounts, so a test can read the
 * payload a hero starts and hand it to the mat's own drop function — the same
 * two calls the dnd provider makes (`accepts`, then the drop).
 */
const dnd = vi.hoisted(() => ({ drags: [], drops: [], pointerDowns: [] }));
vi.mock('../ui/dnd/DndKit.jsx', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useEntityDrag: (args) => {
            dnd.drags.push(args);
            const r = actual.useEntityDrag(args);
            const down = r.handleProps.onPointerDown;
            return { ...r, handleProps: { ...r.handleProps, onPointerDown: (e) => { dnd.pointerDowns.push(args.id); down?.(e); } } };
        },
        useEntityDrop: (args) => {
            dnd.drops.push(args);
            return actual.useEntityDrop(args);
        }
    };
});

/** Lets a test say which pixels of a sprite are opaque. */
const alpha = vi.hoisted(() => ({ opaque: true }));
vi.mock('../ui/utils/alphaHitTest.js', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, isElementOpaqueAtPoint: () => alpha.opaque };
});

/**
 * ⭐ Free Playmat slice 1.5b-ii — **dragging a hero moves the flag, the owner's
 * flag sprites and colours, the gear badge and the rules panel**.
 */

/**
 * ⭐ **Test layout only** (Free Playmat slice 1.6d-2). The game has no tiles;
 * a lattice of mat points 160 u apart, so spot 22 stays a side neighbour of 21
 * at the shipped 240 u reach while spot 13 stays well outside it (358 u).
 */
const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** Which spot the Token a hero works stands on, or null. */
function workTileOf(heroId) {
    const instance = BoardState.getTokenById(BoardState.workTokenOf(heroId));
    if (!instance) return null;
    const col = Math.round((instance.x - 400) / 160);
    const row = Math.round((instance.y - 200) / 160);
    return row * 6 + col;
}

const h = React.createElement;
const FOREST = 'fixture_producer';        // forestry

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(tile, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, C(tile));
    return instance;
}

const mount = (el) => render(h(DndContext, null, el));

function counting(event, fn) {
    let n = 0;
    const unsub = EventBus.subscribe(event, () => { n++; });
    try { fn(); } finally { unsub(); }
    return n;
}

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
afterEach(() => cleanup());

beforeEach(() => {
    vi.clearAllMocks();
    dnd.drags.length = 0;
    dnd.drops.length = 0;
    dnd.pointerDowns.length = 0;
    alpha.opaque = true;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [
        hero('h1', { forestry: 50, mining: 40 }),
        hero('h2', { forestry: 50 }),
        hero('h3', { forestry: 50 }),
        hero('h4', { forestry: 50 }),
        hero('fighter', { forestry: 20, melee: 10 })
    ];
});

// ---------------------------------------------------------------------------

describe('FP-76 — the player never moves a hero: dragging one drags their flag', () => {
    it('a hero on a Token starts a FLAG drag, not a HERO drag', () => {
        put(15, FOREST);
        Orders.orderAt('h1', C(15));
        mount(h(MatBoard));

        const heroDrag = dnd.drags.find(d => d.id === 'hero-h1');
        expect(heroDrag.kind).toBe(DRAG_KIND.FLAG);
        expect(heroDrag.payload.heroId).toBe('h1');
    });

    it('an idle hero beside their flag starts a FLAG drag too', () => {
        Orders.orderAt('h1', C(20));
        expect(Flags.statusOf('h1').state).toBe('idle');
        // Drawn by MatBoard like every hero since Hero Movement M2.
        mount(h(MatBoard));
        expect(dnd.drags.find(d => d.id === 'hero-h1').kind).toBe(DRAG_KIND.FLAG);
    });

    it('a board hero dropped on bare ground: one hero_deployed, and they go there and idle (brief 260 O1)', () => {
        // 13 is out of spot 21's reach (358 u at the shipped 240 u); 22 is its
        // side neighbour, 160 u away.
        put(13, FOREST);
        put(22, FOREST);
        Orders.orderAt('h1', C(13));
        expect(workTileOf('h1')).toBe(13);

        mount(h(MatBoard));
        const heroDrag = dnd.drags.find(d => d.id === 'hero-h1');
        const payload = { kind: heroDrag.kind, ...heroDrag.payload };

        expect(matAccepts(payload)).toBe(true);
        const deployed = counting('hero_deployed', () => dropOnMat(payload, C(21)));

        expect(deployed).toBe(1);
        // The spot is exactly where they were let go, and they work nothing there, not even the
        // Forest beside it.
        expect(BoardState.flagOf('h1')).toMatchObject({ ...C(21), spot: true });
        expect(workTileOf('h1')).toBeNull();
    });

    it('a hero dragged from the roster onto a Token works it', () => {
        put(15, FOREST);
        const payload = { kind: DRAG_KIND.HERO, heroId: 'h1', from: { dock: true } };
        expect(matAccepts(payload)).toBe(true);
        expect(counting('hero_deployed', () => dropOnMat(payload, C(15)))).toBe(1);
        expect(workTileOf('h1')).toBe(15);
    });

    it('left-click on a board hero still opens the sheet, right-click sends them home', () => {
        put(15, FOREST);
        Orders.orderAt('h1', C(15));
        const inspected = [];
        const unsub = EventBus.subscribe('inspect_hero', (p) => inspected.push(p.heroId));
        const { container } = mount(h(MatBoard));
        const drawn = container.querySelector('[data-board-hero="h1"]');

        fireEvent.click(drawn);
        fireEvent.contextMenu(drawn);
        unsub();

        expect(inspected).toEqual(['h1']);
        expect(BoardState.flagOf('h1')).toBeNull();
    });
});

describe('FP-77 / FP-82 — flag sprites and lasting colours', () => {
    it('a hero holding a colour draws the job flag, at 24 px at the natural fit', () => {
        Orders.orderAt('h1', C(20));
        const colour = flagColourOf('h1');
        expect(FLAG_COLOURS).toContain(colour);

        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        const mark = flag.querySelector('[data-flag-mark]');
        expect(mark.querySelector('svg.lucide-flag-triangle-right')).toBeTruthy();
        expect(mark.style.width).toBe(`${MARKER_ART_PX * 2}px`);
        expect(flag.style.width).toBe(`${MARKER_ART_PX * 2}px`);
        expect(flag.querySelector('img')).toBeNull();
    });

    it('each hero’s flag on the mat is filled with their own colour, over the one dark edge', async () => {
        Orders.orderAt('h1', C(20));
        Orders.orderAt('h2', C(8));
        expect(flagColourOf('h1')).not.toBe(flagColourOf('h2'));
        const { container } = mount(h(FlagLayer));
        for (const id of ['h1', 'h2']) {
            const mark = container.querySelector(`[data-flag="${id}"] [data-flag-mark]`);
            expect(mark.getAttribute('data-flag-colour')).toBe(flagColourOf(id));
            const svgs = mark.querySelectorAll('svg');
            expect(svgs[svgs.length - 1].getAttribute('fill')).toBe(flagFill(flagColourOf(id)));
            expect(svgs[svgs.length - 2].getAttribute('fill')).toBe('#17110c');
        }
        await act(async () => { HeroManager.updateHeroProfile('h1', { flagColour: 'yelpur' }); });
        const svgs = container.querySelectorAll('[data-flag="h1"] [data-flag-mark] svg');
        expect(svgs[svgs.length - 1].getAttribute('fill')).toBe(FLAG_FILLS.yelpur);
    });

    it('the eight fills are eight different colours, none the pale base flag', () => {
        const fills = FLAG_COLOURS.map(flagFill);
        expect(new Set(fills).size).toBe(8);
        expect(fills).not.toContain(flagFill(null));
        expect(flagFill('chartreuse')).toBe(flagFill(null));
    });

    it('in the hand the flag is its hero’s colour; a hero with no colour carries the pale flag', () => {
        Orders.orderAt('h1', C(20));
        const held = mount(h(FlagGhost, { payload: { heroId: 'h1' } })).container;
        expect(held.querySelector('[data-flag-mark]').getAttribute('data-flag-colour')).toBe(flagColourOf('h1'));
        const svgs = held.querySelectorAll('[data-flag-mark] svg');
        expect(svgs[svgs.length - 1].getAttribute('fill')).toBe(flagFill(flagColourOf('h1')));

        const { container } = mount(h(FlagGhost, { payload: { heroId: 'h2' } }));
        expect(container.querySelector('[data-flag-mark] svg.lucide-flag-triangle-right')).toBeTruthy();
        expect(container.querySelector('[data-flag-mark]').hasAttribute('data-flag-colour')).toBe(false);
    });

    it('a hero is given a colour when they join the roster, the first one free', () => {
        GameState.state.heroes[0].flagColour = FLAG_COLOURS[0];
        GameState.state.progress.rosterLimit = 8;
        const joined = HeroManager.addHero(hero('h9', { forestry: 1 }));
        expect(joined).toBeTruthy();
        expect(flagColourOf('h9')).toBe(FLAG_COLOURS[1]);
    });

    it('an older save gives every hero without a colour one, in roster order, on load', async () => {
        GameState.state.heroes[1].flagColour = FLAG_COLOURS[0];
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        await GameState.initFromSave(migrateState(saved.state, saved.version));
        expect(flagColourOf('h2')).toBe(FLAG_COLOURS[0]);
        expect(flagColourOf('h1')).toBe(FLAG_COLOURS[1]);
        expect(GameState.state.heroes.every(x => FLAG_COLOURS.includes(x.flagColour))).toBe(true);
    });

    it('the drag ghost is the flag at the mat’s size', () => {
        Orders.orderAt('h1', C(20));
        const { container } = mount(h(FlagGhost, { payload: { heroId: 'h1' } }));
        expect(container.querySelector('[data-flag-mark]').style.width).toBe(container.querySelector('[data-flag-ghost]').style.width);
        expect(parseFloat(container.querySelector('[data-flag-ghost]').style.width) % MARKER_ART_PX).toBe(0);
    });

    it('is given at the first plant — the first colour nobody else holds — and kept on re-plants', () => {
        expect(flagColourOf('h1')).toBeNull();
        Orders.orderAt('h1', C(20));
        Orders.orderAt('h2', C(8));
        expect(flagColourOf('h1')).toBe(FLAG_COLOURS[0]);
        expect(flagColourOf('h2')).toBe(FLAG_COLOURS[1]);

        Flags.furl('h1');
        Orders.orderAt('h1', C(14));
        expect(flagColourOf('h1')).toBe(FLAG_COLOURS[0]);
    });

    it('skips a colour another hero already holds, and the ninth hero onward reuses in order', () => {
        GameState.state.heroes[1].flagColour = FLAG_COLOURS[0];
        Orders.orderAt('h1', C(20));
        expect(flagColourOf('h1')).toBe(FLAG_COLOURS[1]);

        GameState.state.heroes = Array.from({ length: 9 }, (_, i) => hero(`r${i}`, { forestry: 1 }));
        GameState.state.heroes.slice(0, 8).forEach((x, i) => { x.flagColour = FLAG_COLOURS[i]; });
        Orders.orderAt('r8', C(20));
        expect(flagColourOf('r8')).toBe(FLAG_COLOURS[0]);
    });

    it('is not tied to roster position: reordering the Dock repaints nothing', () => {
        Orders.orderAt('h1', C(20));
        Orders.orderAt('h2', C(8));
        const before = [flagColourOf('h1'), flagColourOf('h2')];
        HeroManager.reorderHero('h2', 0);
        expect(GameState.state.heroes[0].id).toBe('h2');
        expect([flagColourOf('h1'), flagColourOf('h2')]).toEqual(before);
    });

    it('survives a save and reload', async () => {
        Orders.orderAt('h1', C(20));
        HeroManager.updateHeroProfile('h1', { flagColour: 'orange' });
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        await GameState.initFromSave(migrateState(saved.state, saved.version));
        expect(flagColourOf('h1')).toBe('orange');
    });

    it('the Edit Hero modal offers the job flag in each of the eight colours; a pick changes the flag at once, Save keeps it', async () => {
        Orders.orderAt('h1', C(20));
        expect(flagColourOf('h1')).not.toBe('purplite');
        const board = mount(h(FlagLayer)).container;
        mount(h(HeroEditModal, { heroId: 'h1', isOpen: true, onClose: () => {} }));

        const swatches = document.querySelectorAll('[data-flag-swatch]');
        expect([...swatches].map(s => s.getAttribute('data-flag-swatch'))).toEqual([...FLAG_COLOURS]);
        [...swatches].forEach((s, i) => {
            expect(s.querySelector('img')).toBeNull();
            expect(s.querySelector('[data-flag-mark] svg.lucide-flag-triangle-right')).toBeTruthy();
            expect(s.querySelector('[data-flag-mark]').getAttribute('data-flag-colour')).toBe(FLAG_COLOURS[i]);
        });

        await act(async () => { fireEvent.click(document.querySelector('[data-flag-swatch="purplite"]')); });
        // Before Save: the hero's flag on the mat is already purple.
        expect(flagColourOf('h1')).toBe('purplite');
        expect(board.querySelector('[data-flag="h1"] [data-flag-mark]').getAttribute('data-flag-colour')).toBe('purplite');
        expect(document.querySelector('[data-flag-swatch="purplite"]').getAttribute('aria-pressed')).toBe('true');

        const save = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save');
        expect(save.disabled).toBe(false);
        await act(async () => { fireEvent.click(save); });
        expect(flagColourOf('h1')).toBe('purplite');
    });

    it('Cancel in Edit Hero puts back the colour the hero had when it opened', async () => {
        Orders.orderAt('h1', C(20));
        const was = flagColourOf('h1');
        const onClose = vi.fn();
        mount(h(HeroEditModal, { heroId: 'h1', isOpen: true, onClose }));
        await act(async () => { fireEvent.click(document.querySelector('[data-flag-swatch="orange"]')); });
        await act(async () => { fireEvent.click(document.querySelector('[data-flag-swatch="yelpur"]')); });
        expect(flagColourOf('h1')).toBe('yelpur');

        const cancel = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel');
        await act(async () => { fireEvent.click(cancel); });
        expect(flagColourOf('h1')).toBe(was);
        expect(onClose).toHaveBeenCalled();
    });

    it('updateHeroProfile refuses a colour that is not one of the eight', () => {
        Orders.orderAt('h1', C(20));
        const colour = flagColourOf('h1');
        HeroManager.updateHeroProfile('h1', { flagColour: 'chartreuse' });
        expect(flagColourOf('h1')).toBe(colour);
    });
});

describe('several heroes on one Token: their flags fan out', () => {
    it('fanStep: the first keeps the corner, then one towards the top, one towards the left, two towards the top', () => {
        expect([0, 1, 2, 3, 4].map(fanStep)).toEqual([0, 1, -1, 2, -2]);
    });

    it('markerBox: a fanned flag keeps the corner’s distance from the Token’s centre, one step apart', () => {
        const c = { x: 500, y: 400 };
        const box = (fan) => markerBox(c, 32, 2, 40, fan);
        const mid = (b) => ({ x: b.left + b.size / 2, y: b.top + b.size / 2 });
        expect(box(0)).toEqual(markerBox(c, 32, 2, 40));
        const r = 40 * Math.SQRT2;
        for (const fan of [1, -1, 2]) {
            const m = mid(box(fan));
            expect(Math.hypot(m.x - c.x, m.y - c.y)).toBeCloseTo(r, 6);
        }
        // Towards the top is up and right of the corner; towards the left, down and left.
        expect(mid(box(1)).x).toBeGreaterThan(mid(box(0)).x);
        expect(mid(box(1)).y).toBeLessThan(mid(box(0)).y);
        expect(mid(box(-1)).x).toBeLessThan(mid(box(0)).x);
        expect(mid(box(-1)).y).toBeGreaterThan(mid(box(0)).y);
        const a = mid(box(0)), b = mid(box(1));
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(2 * r * Math.sin(MARKER_FAN_ART_PX * 2 / r / 2), 6);
    });

    it('three heroes on one Token: three flags at three places, in roster order; one hero alone keeps the corner', () => {
        const t = put(20, FOREST);
        Orders.orderAt('h1', { x: t.x, y: t.y });
        const lone = mount(h(FlagLayer)).container;
        const alone = lone.querySelector('[data-flag="h1"]');
        const corner = { left: alone.style.left, top: alone.style.top };
        cleanup();
        Orders.orderAt('h2', { x: t.x, y: t.y });
        Orders.orderAt('h3', { x: t.x, y: t.y });
        const { container } = mount(h(FlagLayer));
        const flags = ['h1', 'h2', 'h3'].map(id => container.querySelector(`[data-flag="${id}"]`));
        expect(flags.map(f => f.getAttribute('data-flag-pinned'))).toEqual([t.id, t.id, t.id]);
        // The first in roster order keeps the lone hero's corner.
        expect({ left: flags[0].style.left, top: flags[0].style.top }).toEqual(corner);
        const places = new Set(flags.map(f => `${f.style.left},${f.style.top}`));
        expect(places.size).toBe(3);
        // Each in their own colour.
        expect(new Set(flags.map(f => f.querySelector('[data-flag-mark]').getAttribute('data-flag-colour'))).size).toBe(3);
    });
});

describe('FP-83 — a flag stands exactly where it was dropped', () => {
    it('markerBox puts the pole foot on the flag’s own point', () => {
        for (const point of [{ x: 0, y: 0 }, { x: 733, y: 412 }, C(14), C(35)]) {
            const { left, top, size } = markerBox(point, null, 2);
            expect(left + MARKER_FOOT.x * size).toBeCloseTo(point.x);
            expect(top + MARKER_FOOT.y * size).toBeCloseTo(point.y);
        }
    });

    it('the drawn flag sits where markerBox says', () => {
        Orders.orderAt('h1', C(14));
        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        const { left, top } = markerBox(C(14), null, parseFloat(flag.style.width) / MARKER_ART_PX);
        expect(drawnPoint(flag).x).toBeCloseTo(left);
        expect(drawnPoint(flag).y).toBeCloseTo(top);
    });

    it('a flag planted off the old grid stands there too — no snapping', () => {
        const odd = { x: 137, y: 909 };
        Orders.orderAt('h1', odd);
        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        const size = parseFloat(flag.style.width);
        expect(drawnPoint(flag).x + MARKER_FOOT.x * size).toBeCloseTo(odd.x);
        expect(drawnPoint(flag).y + MARKER_FOOT.y * size).toBeCloseTo(odd.y);
    });
});

describe('the flag answers clicks on its drawn square', () => {
    /**
     * The flag answers on the square it is drawn in, not on its opaque pixels (no alpha
     * hit-testing). Over a Token's art circle every flag lets the
     * pointer through except on its cloth (`MatLayering.test.js`, `MatPressTarget.test.js`).
     */
    it('is the flag’s own square, and does not opt into alpha hit-testing', () => {
        Orders.orderAt('h1', C(20));
        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(flag.getAttribute('data-alpha-test')).toBeNull();
        expect(flag.style.borderRadius).toBe('');
        expect(flag.style.width).toBe(`${MARKER_ART_PX * 2}px`);
        expect(flag.style.height).toBe(flag.style.width);
        expect(flag.querySelector('[data-flag-mark]').style.width).toBe(flag.style.width);
    });

    it('a click on the flag is kept, never passed to what is underneath', () => {
        Orders.orderAt('h1', C(20));
        const beneath = vi.fn();
        const { container } = render(
            h(DndContext, null, h('div', { onClick: beneath }, h(FlagLayer)))
        );
        fireEvent.click(container.querySelector('[data-flag="h1"]'));
        expect(beneath).not.toHaveBeenCalled();
    });
});

/**
 * The rules grid replaced the per-hero rules panel. The panel's status line and skip reasons
 * live on the flag's hover tooltip; its working-row tint, Reset and "Hero gone" have no place in
 * a grid of the roster's heroes.
 */

describe('several flags on one point (FP-83)', () => {
    it('⭐ all five are drawn, in the same place, with no "+N" chip', () => {
        const ids = ['h1', 'h2', 'h3', 'h4', 'fighter'];
        for (const id of ids) Orders.orderAt(id, C(20));
        const { container } = mount(h(FlagLayer));

        const drawn = ids.map(id => container.querySelector(`[data-flag="${id}"]`));
        expect(drawn.every(Boolean)).toBe(true);

        // ⛔ The grid's fan-out and its three-flag cap are gone: flags overlap.
        drawn.forEach(el => {
            expect(drawnPoint(el).x).toBe(drawnPoint(drawn[0]).x);
            expect(drawnPoint(el).y).toBe(drawnPoint(drawn[0]).y);
        });

        // Planting order decides who is in front; nobody is hidden.
        expect(Number(drawn[4].style.zIndex)).toBeGreaterThan(Number(drawn[0].style.zIndex));
        expect(container.querySelector('[data-flag-more]')).toBeNull();
    });
});
