import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act, renderHook } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as FlagRules from '../systems/board/FlagRules.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { FLAG_COLOURS, flagColourOf } from '../systems/board/FlagColours.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { FlagLayer } from '../ui/components/board/FlagLayer.jsx';
import { matAccepts } from '../ui/components/board/Board.jsx';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { FlagGhost } from '../ui/dnd/DragGhost.jsx';
import { FlagRulesPanel } from '../ui/components/drawer/FlagRulesPanel.jsx';
import { HeroEditModal } from '../ui/modals/HeroEditModal.jsx';
import { useUIModals } from '../ui/hooks/useUIModals.js';
import { isRecallDrop, recallFromDrop } from '../ui/components/dock/dockRecall.js';
import { flagOrigin, POLE_BASE, FLAG_PX } from '../ui/components/board/flagGeometry.js';
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
 * at the shipped 164 u reach while spot 13 stays well outside it (358 u).
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
const FOREST = 'fixture_producer';        // logging

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

const engine = { GameState, EventBus, HeroManager: HeroManager.HeroManager };
const mount = (el) => render(h(EngineContext.Provider, { value: engine }, h(DndContext, null, el)));

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
        hero('h1', { logging: 50, mining: 40 }),
        hero('h2', { logging: 50 }),
        hero('h3', { logging: 50 }),
        hero('h4', { logging: 50 }),
        hero('fighter', { logging: 20, melee: 10 })
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

    it('a board hero dropped elsewhere moves the flag — one hero_deployed — and the hero goes to their job', () => {
        // 13 is out of spot 21's reach (358 u at the shipped 164 u); 22 is its
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
        // The flag stands exactly where it was let go.
        expect(BoardState.flagOf('h1')).toMatchObject(C(21));
        // Bare ground at 21: the hero appears at the nearest job in reach, the Forest on 22.
        expect(workTileOf('h1')).toBe(22);
    });

    it('a hero dragged from the Dock still plants their flag where dropped', () => {
        put(15, FOREST);
        const payload = { kind: DRAG_KIND.HERO, heroId: 'h1', from: { dock: true } };
        expect(matAccepts(payload)).toBe(true);
        expect(counting('hero_deployed', () => dropOnMat(payload, C(15)))).toBe(1);
        expect(workTileOf('h1')).toBe(15);
    });

    it('the payload a board hero starts recalls when dropped on the Dock or a hero tab', () => {
        put(15, FOREST);
        Placement.plantFlagAt('h1', C(15));
        mount(h(MatBoard));
        const heroDrag = dnd.drags.find(d => d.id === 'hero-h1');
        const payload = { kind: heroDrag.kind, ...heroDrag.payload };

        expect(isRecallDrop(payload)).toBe(true);
        recallFromDrop(Placement, payload);
        expect(BoardState.flagOf('h1')).toBeNull();
    });

    it('left-click on a board hero still opens the sheet, right-click still recalls', () => {
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
        expect(img.getAttribute('src')).toBe(`/assets/ui/flag/hero_flag_${colour}.png`);
        expect(img.style.width).toBe('128px');
        expect(img.style.height).toBe('128px');
        expect(img.style.imageRendering).toBe('pixelated');
        expect(flag.style.width).toBe('128px');
    });

    it('a hero with no colour draws the base flag', () => {
        const { container } = mount(h(FlagGhost, { payload: { heroId: 'h2' } }));
        expect(container.querySelector('img').getAttribute('src')).toBe('/assets/ui/flag/hero_flag_base.png');
    });

    it('the drag ghost is the hero’s flag sprite at 128 px', () => {
        Flags.plant('h1', C(20));
        const { container } = mount(h(FlagGhost, { payload: { heroId: 'h1' } }));
        const img = container.querySelector('img');
        expect(img.getAttribute('src')).toBe(`/assets/ui/flag/hero_flag_${flagColourOf('h1')}.png`);
        expect(img.style.width).toBe('128px');
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

        GameState.state.heroes = Array.from({ length: 9 }, (_, i) => hero(`r${i}`, { logging: 1 }));
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
        expect(swatches[0].querySelector('img').getAttribute('src')).toBe(`/assets/ui/flag/hero_flag_${FLAG_COLOURS[0]}.png`);

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

describe('the flag answers clicks on its round area (owner, 2026-09-21)', () => {
    /**
     * The flag used to answer only on its opaque pixels (alpha hit-testing).
     * The slice 1.9 work swapped that for a round hit area the size of the
     * drawn art, and the owner kept it: easier to grab a thin flag. ⚠️ Its old
     * cost — the circle catching clicks meant for a Token just behind it — is
     * gone since B5: over a Token's art circle every flag lets the pointer
     * through (`MatLayering.test.js`, `B5Flags.test.js`).
     */
    it('is round, the size of its art, and no longer opts into alpha hit-testing', () => {
        Flags.plant('h1', C(20));
        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(flag.getAttribute('data-alpha-test')).toBeNull();
        expect(flag.style.borderRadius).toBe('50%');
        expect(flag.style.width).toBe('128px');
        expect(flag.querySelector('img').getAttribute('src')).toContain('/assets/ui/flag/hero_flag_');
    });

    it('a click on the flag is kept, never passed to what is underneath', () => {
        Flags.plant('h1', C(20));
        const beneath = vi.fn();
        const { container } = render(
            h(EngineContext.Provider, { value: engine },
                h(DndContext, null, h('div', { onClick: beneath }, h(FlagLayer))))
        );
        fireEvent.click(container.querySelector('[data-flag="h1"]'));
        expect(beneath).not.toHaveBeenCalled();
    });
});

describe('FP-73 — the gear badge', () => {
    it('shows while the flag is hovered or its hero inspected, and not at rest', () => {
        Flags.plant('h1', C(20));
        const { container, rerender } = mount(h(FlagLayer));
        const gear = () => container.querySelector('[data-flag-gear="h1"]');
        expect(gear().className).toContain('pointer-events-none');

        rerender(h(EngineContext.Provider, { value: engine }, h(DndContext, null, h(FlagLayer, { inspectedHeroId: 'h1' }))));
        expect(gear().className).toContain('pointer-events-auto');
    });

    it('clicking it asks for that hero’s rules panel and never starts a drag', () => {
        Flags.plant('h1', C(20));
        Flags.plant('h2', C(8));
        const opened = [];
        const unsub = EventBus.subscribe('ui:open_flag_rules', (p) => opened.push(p.heroId));
        const { container } = mount(h(FlagLayer, { hoverHeroId: 'h2' }));
        const gear = container.querySelector('[data-flag-gear="h2"]');

        fireEvent.pointerDown(gear);
        fireEvent.click(gear);
        unsub();

        expect(opened).toEqual(['h2']);
        expect(dnd.pointerDowns).toEqual([]);
        expect(gear.closest('[data-flag]')).toBeNull();
    });

    it('the UI opens the rules panel for the hero whose gear was clicked, and another gear swaps hero', () => {
        const { result } = renderHook(() => useUIModals(engine));
        expect(result.current.flagRules.heroId).toBeNull();
        act(() => { EventBus.publish('ui:open_flag_rules', { heroId: 'h1' }); });
        expect(result.current.flagRules.heroId).toBe('h1');
        act(() => { EventBus.publish('ui:open_flag_rules', { heroId: 'fighter' }); });
        expect(result.current.flagRules.heroId).toBe('fighter');
        act(() => { result.current.flagRules.close(); });
        expect(result.current.flagRules.heroId).toBeNull();
    });
});

describe('the rules panel (FP-71, FP-79, FPP-17, FPP-21)', () => {
    const panel = (heroId, onClose = () => {}) => mount(h(FlagRulesPanel, { heroId, onClose }));
    const row = (container, ruleId) => container.querySelector(`[data-rule-row="${ruleId}"]`);

    it('lists one row per held work skill, and a Fight row only for a hero who can fight', () => {
        const a = panel('h1').container;
        expect(row(a, 'logging')).toBeTruthy();
        expect(row(a, 'mining')).toBeTruthy();
        expect(row(a, FlagRules.FIGHT)).toBeNull();
        cleanup();

        const b = panel('fighter').container;
        expect(row(b, FlagRules.FIGHT)).toBeTruthy();
        expect(row(b, 'melee')).toBeNull();                      // combat skills are one Fight row
        expect(row(b, FlagRules.FIGHT).textContent).toContain('Fight');
    });

    it('shows name, level and the default rule: allowed, priority 3', () => {
        const { container } = panel('h1');
        const logging = row(container, 'logging');
        expect(logging.textContent).toContain('Lv 50');
        expect(logging.querySelector('[data-rule-allowed]').checked).toBe(true);
        expect(logging.querySelector('[data-rule-priority="3"]').getAttribute('aria-pressed')).toBe('true');
        expect(logging.querySelectorAll('[data-rule-priority]')).toHaveLength(5);
    });

    it('the Allowed toggle and the priority chips set the hero’s rule', async () => {
        const { container } = panel('h1');
        await act(async () => { fireEvent.click(row(container, 'mining').querySelector('[data-rule-allowed]')); });
        expect(FlagRules.ruleOf('h1', 'mining')).toEqual({ allowed: false, priority: 3 });

        await act(async () => { fireEvent.click(row(container, 'logging').querySelector('[data-rule-priority="1"]')); });
        expect(FlagRules.ruleOf('h1', 'logging')).toEqual({ allowed: true, priority: 1 });
        expect(row(container, 'logging').querySelector('[data-rule-priority="1"]').getAttribute('aria-pressed')).toBe('true');

        await act(async () => { fireEvent.click(row(container, 'logging').querySelector('[data-rule-priority="5"]')); });
        expect(FlagRules.ruleOf('h1', 'logging').priority).toBe(5);
    });

    it('highlights the row of the job the hero is working now', () => {
        put(15, FOREST);
        Placement.plantFlagAt('h1', C(15));
        const { container } = panel('h1');
        expect(row(container, 'logging').getAttribute('data-rule-working')).toBe('true');
        expect(row(container, 'mining').getAttribute('data-rule-working')).toBeNull();
    });

    it('"Reset to defaults" puts every rule back', async () => {
        Flags.setRule('h1', 'logging', { priority: 1 });
        Flags.setRule('h1', 'mining', { allowed: false });
        const { container } = panel('h1');
        await act(async () => { fireEvent.click(container.querySelector('[data-flag-rules-reset]')); });
        expect(GameState.state.heroes.find(x => x.id === 'h1').flagRules).toEqual({});
        expect(FlagRules.ruleOf('h1', 'mining')).toEqual({ allowed: true, priority: 3 });
    });

    it('the header shows the status and every skip reason (FPP-21), including skills the hero lacks', () => {
        put(15, 'fixture_producer_alt');                   // mining — h2 has no mining
        Flags.plant('h2', C(15));
        const { container } = panel('h2');
        expect(container.querySelector('[data-flag-rules-name]').textContent).toBe('h2');
        expect(container.querySelector('[data-flag-rules-status]').textContent).toBe('Nothing to do');
        expect(container.querySelector('[data-flag-rules-skips]').textContent).toMatch(/skill/i);
    });

    it('a recalled hero’s panel stays editable and reads "In the Guild"', async () => {
        put(15, FOREST);
        Placement.plantFlagAt('h1', C(15));
        const { container } = panel('h1');
        await act(async () => { Placement.recallHeroById('h1'); });
        expect(container.querySelector('[data-flag-rules-status]').textContent).toBe('In the Guild');
        await act(async () => { fireEvent.click(row(container, 'logging').querySelector('[data-rule-priority="2"]')); });
        expect(FlagRules.ruleOf('h1', 'logging').priority).toBe(2);
    });

    it('a hero who no longer exists shows "Hero gone" and a Close', () => {
        const onClose = vi.fn();
        const { container } = panel('nobody', onClose);
        const gone = container.querySelector('[data-flag-rules-gone]');
        expect(gone.textContent).toContain('Hero gone');
        fireEvent.click([...gone.querySelectorAll('button')].find(b => b.textContent === 'Close'));
        expect(onClose).toHaveBeenCalled();
    });
});

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
        expect(FLAG_PX).toBe(128);
    });
});
