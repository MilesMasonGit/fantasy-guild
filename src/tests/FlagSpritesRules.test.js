// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { FLAG_COLOURS, flagColourOf } from '../systems/board/FlagColours.js';
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
import { flagOrigin, POLE_BASE, FLAG_PX } from '../ui/components/board/flagGeometry.js';
import { PENNANT_SRC } from '../ui/components/board/FlagMark.jsx';
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
        Placement.plantFlagAt('h1', C(15));
        mount(h(MatBoard));

        const heroDrag = dnd.drags.find(d => d.id === 'hero-h1');
        expect(heroDrag.kind).toBe(DRAG_KIND.FLAG);
        expect(heroDrag.payload.heroId).toBe('h1');
    });

    it('an idle hero beside their flag starts a FLAG drag too', () => {
        Flags.plant('h1', C(20));
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
        Placement.plantFlagAt('h1', C(13));
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
        Placement.plantFlagAt('h1', C(15));
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
    it('the flag is drawn with the sprite of the hero’s colour, at 128 px', () => {
        Flags.plant('h1', C(20));
        const colour = flagColourOf('h1');
        expect(FLAG_COLOURS).toContain(colour);

        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        const img = flag.querySelector('img');
        expect(img.getAttribute('src')).toBe(PENNANT_SRC);
        expect(img.style.width).toBe('64px');
        expect(img.style.height).toBe('64px');
        expect(img.style.imageRendering).toBe('pixelated');
        expect(flag.style.width).toBe('64px');
    });

    it('every hero draws the same pennant, whatever colour they hold', () => {
        Flags.plant('h1', C(20));
        Flags.plant('h2', C(8));
        expect(flagColourOf('h1')).not.toBe(flagColourOf('h2'));
        const { container } = mount(h(FlagLayer));
        for (const id of ['h1', 'h2']) {
            expect(container.querySelector(`[data-flag="${id}"] img`).getAttribute('src')).toBe(PENNANT_SRC);
        }
    });

    it('a hero with no colour draws the pennant too', () => {
        const { container } = mount(h(FlagGhost, { payload: { heroId: 'h2' } }));
        expect(container.querySelector('img').getAttribute('src')).toBe(PENNANT_SRC);
    });

    it('the drag ghost is the pennant at 64 px', () => {
        Flags.plant('h1', C(20));
        const { container } = mount(h(FlagGhost, { payload: { heroId: 'h1' } }));
        const img = container.querySelector('img');
        expect(img.getAttribute('src')).toBe(PENNANT_SRC);
        expect(img.style.width).toBe('64px');
    });

    it('is given at the first plant — the first colour nobody else holds — and kept on re-plants', () => {
        expect(flagColourOf('h1')).toBeNull();
        Flags.plant('h1', C(20));
        Flags.plant('h2', C(8));
        expect(flagColourOf('h1')).toBe(FLAG_COLOURS[0]);
        expect(flagColourOf('h2')).toBe(FLAG_COLOURS[1]);

        Flags.furl('h1');
        Flags.plant('h1', C(14));
        expect(flagColourOf('h1')).toBe(FLAG_COLOURS[0]);
    });

    it('skips a colour another hero already holds, and the ninth hero onward reuses in order', () => {
        GameState.state.heroes[1].flagColour = FLAG_COLOURS[0];
        Flags.plant('h1', C(20));
        expect(flagColourOf('h1')).toBe(FLAG_COLOURS[1]);

        GameState.state.heroes = Array.from({ length: 9 }, (_, i) => hero(`r${i}`, { forestry: 1 }));
        GameState.state.heroes.slice(0, 8).forEach((x, i) => { x.flagColour = FLAG_COLOURS[i]; });
        Flags.plant('r8', C(20));
        expect(flagColourOf('r8')).toBe(FLAG_COLOURS[0]);
    });

    it('is not tied to roster position: reordering the Dock repaints nothing', () => {
        Flags.plant('h1', C(20));
        Flags.plant('h2', C(8));
        const before = [flagColourOf('h1'), flagColourOf('h2')];
        HeroManager.reorderHero('h2', 0);
        expect(GameState.state.heroes[0].id).toBe('h2');
        expect([flagColourOf('h1'), flagColourOf('h2')]).toEqual(before);
    });

    it('survives a save and reload', async () => {
        Flags.plant('h1', C(20));
        HeroManager.updateHeroProfile('h1', { flagColour: 'orange' });
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        await GameState.initFromSave(migrateState(saved.state, saved.version));
        expect(flagColourOf('h1')).toBe('orange');
    });

    it('the Edit Hero modal offers the eight flag sprites and saves the chosen colour', async () => {
        Flags.plant('h1', C(20));
        expect(flagColourOf('h1')).not.toBe('purplite');
        mount(h(HeroEditModal, { heroId: 'h1', isOpen: true, onClose: () => {}, onChangeJob: () => {} }));

        const swatches = document.querySelectorAll('[data-flag-swatch]');
        expect([...swatches].map(s => s.getAttribute('data-flag-swatch'))).toEqual([...FLAG_COLOURS]);
        expect(swatches[0].querySelector('img').getAttribute('src')).toBe(`/assets/ui/u_flag_${FLAG_COLOURS[0]}.png`);

        await act(async () => { fireEvent.click(document.querySelector('[data-flag-swatch="purplite"]')); });
        const save = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save');
        await act(async () => { fireEvent.click(save); });

        expect(flagColourOf('h1')).toBe('purplite');
    });

    it('updateHeroProfile refuses a colour that is not one of the eight', () => {
        Flags.plant('h1', C(20));
        const colour = flagColourOf('h1');
        HeroManager.updateHeroProfile('h1', { flagColour: 'chartreuse' });
        expect(flagColourOf('h1')).toBe(colour);
    });
});

describe('FP-83 — a flag stands exactly where it was dropped', () => {
    it('flagOrigin puts the pole base on the flag’s own point', () => {
        for (const point of [{ x: 0, y: 0 }, { x: 733, y: 412 }, C(14), C(35)]) {
            const { left, top } = flagOrigin(point);
            expect(left + POLE_BASE.x).toBe(point.x);
            expect(top + POLE_BASE.y).toBe(point.y);
        }
    });

    it('the drawn flag sits where flagOrigin says', () => {
        Flags.plant('h1', C(14));
        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        const { left, top } = flagOrigin(C(14));
        expect(drawnPoint(flag).x).toBe(left);
        expect(drawnPoint(flag).y).toBe(top);
    });

    it('a flag planted off the old grid stands there too — no snapping', () => {
        const odd = { x: 137, y: 909 };
        Flags.plant('h1', odd);
        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(drawnPoint(flag).x + POLE_BASE.x).toBe(odd.x);
        expect(drawnPoint(flag).y + POLE_BASE.y).toBe(odd.y);
    });
});

describe('the flag answers clicks on the pennant’s drawn square', () => {
    /**
     * The flag answers on the square the pennant is drawn in, which the pennant fills, not on
     * its opaque pixels (no alpha hit-testing). Over a Token's art circle every flag lets the
     * pointer through except on its cloth (`MatLayering.test.js`, `MatPressTarget.test.js`).
     */
    it('is the pennant’s own square, and does not opt into alpha hit-testing', () => {
        Flags.plant('h1', C(20));
        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(flag.getAttribute('data-alpha-test')).toBeNull();
        expect(flag.style.borderRadius).toBe('');
        expect(flag.style.width).toBe('64px');
        expect(flag.style.height).toBe('64px');
        const img = flag.querySelector('img');
        expect(img.getAttribute('src')).toBe(PENNANT_SRC);
        expect(img.style.width).toBe(flag.style.width);
    });

    it('a click on the flag is kept, never passed to what is underneath', () => {
        Flags.plant('h1', C(20));
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
        for (const id of ids) Flags.plant(id, C(20));
        const { container } = mount(h(FlagLayer));

        const drawn = ids.map(id => container.querySelector(`[data-flag="${id}"]`));
        expect(drawn.every(Boolean)).toBe(true);

        // ⛔ The grid's fan-out and its three-flag cap are gone: flags overlap.
        const { left, top } = flagOrigin(C(20));
        drawn.forEach(el => {
            expect(drawnPoint(el).x).toBe(left);
            expect(drawnPoint(el).y).toBe(top);
        });

        // Planting order decides who is in front; nobody is hidden.
        expect(Number(drawn[4].style.zIndex)).toBeGreaterThan(Number(drawn[0].style.zIndex));
        expect(container.querySelector('[data-flag-more]')).toBeNull();
        expect(FLAG_PX).toBe(64);
    });
});
