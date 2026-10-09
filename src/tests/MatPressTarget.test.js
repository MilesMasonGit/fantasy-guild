// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { DndContext, useDndMonitor } from '@dnd-kit/core';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { MatHero } from '../ui/components/board/MatHero.jsx';
import { setAlphaMaskForTests, updateAlphaPointerEvents } from '../ui/utils/alphaHitTest.js';
import './fixtures/testTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { EngineContext } from '../ui/context/EngineContext';
import { matW, matH, artRadiusOf } from '../config/matGeometry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { setDisallowMode } from '../ui/hooks/useDisallowMode.js';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { HERO_HIT_PX } from '../ui/components/board/boardConstants.js';
import { FLAG_PX } from '../ui/components/board/flagGeometry.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { drawnPoint } from './fixtures/drawnPoint.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Grabbing follows each Token's own circle** (owner, 2026-10-08). At the owner's window the
 * art steps up to 2×, bigger than a Token's 128 u circle, and spills onto its neighbours. The art
 * still draws in full, but only the Token's circle takes the pointer, and where two circles
 * overlap a press goes to the Token the game says is under the pointer (`Flags.tokenAtPoint`,
 * nearest centre), as hovering does.
 */

registerTokenTypes({
    press_large: {
        id: 'press_large', name: 'Press Large', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 100, sprite: 'skill_nature',
        size: 2, requiresHero: false
    }
});

const h = React.createElement;
/** About the owner's 1920×1080: art drawn at 2× on screen, ~147 u on the mat. */
const OWNER_FIT = 0.87;

function mountAt(fit, props = {}) {
    const out = render(
        h(EngineContext.Provider, { value: { GameState, EventBus } },
            h(DndContext, null,
                h(MatFitProvider, { value: fit }, h(MatBoard, props))))
    );
    // jsdom lays nothing out: give the mat its natural box, so a client point IS a mat point.
    const mat = out.container.querySelector('[data-mat-board]');
    mat.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: matW(), height: matH(), right: matW(), bottom: matH() });
    return out;
}

const artOf = (container, id) => container.querySelector(`[data-token-art][data-token-id="${id}"]`);
const hitOf = (container, id) => container.querySelector(`[data-token-hit="${id}"]`);

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());
afterEach(() => cleanup());

beforeEach(() => {
    vi.clearAllMocks();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    clearMat();
});

describe('⭐ only a Token\'s own circle takes the pointer', () => {
    it.each([
        ['a 1×1 Token', 'fixture_producer'],
        ['a 2×2 Token', 'press_large']
    ])('%s: the art draws in full, the hit area is exactly its circle', (_, typeId) => {
        const tok = placeAt(typeId, 700, 500);
        const { container } = mountAt(OWNER_FIT);
        const art = artOf(container, tok.id);
        const hit = hitOf(container, tok.id);
        const r = artRadiusOf(typeId);
        const box = parseFloat(art.style.width);

        // The art is bigger than the circle here, and its box grows to hold it (not cropped)...
        expect(box).toBeGreaterThan(r * 2);
        // ...but none of the drawing takes the pointer.
        expect(art.style.pointerEvents).toBe('none');
        // Only the circle does: 2r across, round, centred on the Token's point.
        expect(hit.style.pointerEvents).toBe('auto');
        expect(hit.style.borderRadius).toBe('50%');
        expect(parseFloat(hit.style.width)).toBe(r * 2);
        expect(parseFloat(hit.style.height)).toBe(r * 2);
        expect(drawnPoint(art).x + parseFloat(hit.style.left) + r).toBeCloseTo(700, 6);
        expect(drawnPoint(art).y + parseFloat(hit.style.top) + r).toBeCloseTo(500, 6);
    });

    it('a press on the hit circle reaches the Token\'s own listeners (click inspects it)', () => {
        const tok = placeAt('fixture_producer', 700, 500);
        const onInspectToken = vi.fn();
        const { container } = mountAt(OWNER_FIT, { onInspectToken });
        fireEvent.click(hitOf(container, tok.id), { clientX: 700, clientY: 500 });
        expect(onInspectToken).toHaveBeenCalledWith('fixture_producer', expect.anything(), tok.id);
    });

    it('B\'s art spilling over A\'s circle cannot take the press: the point is A\'s, and only A\'s', () => {
        // 100 u apart: B's 147 u art reaches 73 u left of its centre, its circle only 64 u.
        const a = placeAt('fixture_producer', 600, 400);
        const b = placeAt('fixture_producer', 700, 400);
        const { container } = mountAt(OWNER_FIT);
        const point = { x: 630, y: 400 };
        const bArtLeft = drawnPoint(artOf(container, b.id)).x;
        expect(bArtLeft).toBeLessThan(point.x);                          // B's art is drawn there
        expect(Flags.pointOnToken(b, point)).toBe(false);               // outside B's circle
        expect(Flags.tokenAtPoint(point)?.id).toBe(a.id);               // the game says A
        // B's hit circle starts right of the point, so the browser can only land it on A.
        expect(bArtLeft + parseFloat(hitOf(container, b.id).style.left)).toBeGreaterThan(point.x);
    });
});

describe('⭐ where two circles overlap, the press goes where hovering would', () => {
    // 60 u apart, so the circles overlap across most of each.
    function pair(extra = {}) {
        const a = placeAt('fixture_producer', 600, 400);
        const b = placeAt('fixture_producer', 660, 400);
        const onInspectToken = vi.fn();
        const view = mountAt(OWNER_FIT, { onInspectToken, ...extra });
        return { a, b, onInspectToken, ...view };
    }

    it('a click that lands on A, nearer B\'s centre, inspects B', () => {
        const { a, b, onInspectToken, container } = pair();
        expect(Flags.tokenAtPoint({ x: 640, y: 400 })?.id).toBe(b.id);
        fireEvent.click(hitOf(container, a.id), { clientX: 640, clientY: 400 });
        expect(onInspectToken).toHaveBeenCalledTimes(1);
        expect(onInspectToken.mock.calls[0][2]).toBe(b.id);
    });

    it('a click that lands on B, nearer A\'s centre, inspects A', () => {
        const { a, b, onInspectToken, container } = pair();
        fireEvent.click(hitOf(container, b.id), { clientX: 615, clientY: 400 });
        expect(onInspectToken).toHaveBeenCalledTimes(1);
        expect(onInspectToken.mock.calls[0][2]).toBe(a.id);
    });

    it('a click where the Token it lands on IS the nearest stays put', () => {
        const { a, onInspectToken, container } = pair();
        fireEvent.click(hitOf(container, a.id), { clientX: 590, clientY: 400 });
        expect(onInspectToken).toHaveBeenCalledTimes(1);
        expect(onInspectToken.mock.calls[0][2]).toBe(a.id);
    });

    it('the press itself (what starts a drag) is sent to B, and never reaches A', async () => {
        const { a, b, container } = pair();
        const reachedA = vi.fn();
        const reachedB = vi.fn();
        hitOf(container, a.id).addEventListener('pointerdown', reachedA);
        hitOf(container, b.id).addEventListener('pointerdown', reachedB);
        fireEvent.pointerDown(hitOf(container, a.id), { clientX: 640, clientY: 400, button: 0, isPrimary: true });
        expect(reachedA).not.toHaveBeenCalled();
        expect(reachedB).toHaveBeenCalledTimes(1);
        expect(reachedB.mock.calls[0][0].clientX).toBe(640);
        // The drag this started ends, and dnd-kit drops its after-drag click guard 50 ms later.
        fireEvent.pointerUp(document, { clientX: 640, clientY: 400 });
        await new Promise(r => setTimeout(r, 80));
    });

    it('a right-click goes to B too, and the browser menu stays shut', () => {
        const { a, b, container } = pair();
        const reachedA = vi.fn();
        const reachedB = vi.fn();
        hitOf(container, a.id).addEventListener('contextmenu', reachedA);
        hitOf(container, b.id).addEventListener('contextmenu', reachedB);
        const notCancelled = fireEvent.contextMenu(hitOf(container, a.id), { clientX: 640, clientY: 400 });
        expect(reachedA).not.toHaveBeenCalled();
        expect(reachedB).toHaveBeenCalledTimes(1);
        expect(notCancelled).toBe(false);
    });

    it('in disallow mode the click flips the nearest Token, not the one drawn on top', () => {
        setDisallowMode(true);
        try {
            const { a, b, container } = pair();
            fireEvent.click(hitOf(container, a.id), { clientX: 640, clientY: 400 });
            expect(Flags.isDisallowed(BoardState.getTokenById(b.id))).toBe(true);
            expect(Flags.isDisallowed(BoardState.getTokenById(a.id))).toBe(false);
        } finally {
            setDisallowMode(false);
        }
    });
});

/**
 * ⭐ **A hero takes a press only on a pixel drawn at that moment.** A hero's figure box stands in
 * front of their own flag (and sometimes a neighbour's). Through a see-through pixel the press
 * goes to whatever is drawn beneath, decided at the press itself: the figure animates, so the
 * pixel under a still pointer is not the one the last pointer move saw.
 */
describe('⭐ a press through a hero\'s see-through pixel reaches what is beneath', () => {
    const P = { x: 560, y: 850 };
    const box = { left: P.x - 30, top: P.y - 60, right: P.x + 30, bottom: P.y + 60, width: 60, height: 120, x: P.x - 30, y: P.y - 60 };
    let realElementFromPoint;

    function heroAt(id, flagPoint) {
        GameState.state.heroes = [...(GameState.state.heroes || []), {
            id, name: id, spriteId: 'hero_knight', status: 'idle', level: 50,
            skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 }
        }];
        Flags.plant(id, flagPoint);
    }

    /** What started, by draggable id, in the real drag provider (8 px activation, alpha test). */
    function mountWithDrag() {
        const started = [];
        const Spy = () => { useDndMonitor({ onDragStart: (e) => started.push(e.active.id) }); return null; };
        const view = render(
            h(EngineContext.Provider, { value: { GameState, EventBus } },
                h(DeckDndProvider, null,
                    h(MatFitProvider, { value: OWNER_FIT }, h(MatBoard), h(Spy))))
        );
        const mat = view.container.querySelector('[data-mat-board]');
        mat.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: matW(), height: matH(), right: matW(), bottom: matH() });
        return { ...view, started };
    }

    /** A hero figure whose drawing is solid or see-through everywhere, boxed over `P`. */
    function figure(container, id, solid) {
        const el = container.querySelector(`[data-board-hero="${id}"]`);
        const img = el.querySelector('img');
        setAlphaMaskForTests(img.getAttribute('src'), { width: 8, height: 3, data: new Uint8Array(24).fill(solid ? 255 : 0) });
        el.getBoundingClientRect = () => box;
        img.getBoundingClientRect = () => box;
        return el;
    }

    /** The browser's own hit test at `P`: the first of `stack` (top first) that takes the pointer. */
    function stackAtP(...stack) {
        document.elementFromPoint = (x, y) => (x === P.x && y === P.y
            ? stack.find(el => el.style.pointerEvents !== 'none') ?? null
            : null);
    }

    function pressAndPull(el) {
        act(() => {
            fireEvent.pointerDown(el, { pointerId: 1, clientX: P.x, clientY: P.y, isPrimary: true, button: 0 });
            fireEvent.pointerMove(document, { pointerId: 1, clientX: P.x + 30, clientY: P.y, isPrimary: true });
        });
    }

    beforeEach(() => {
        realElementFromPoint = document.elementFromPoint;
        GameState.state.heroes = [];
    });
    afterEach(async () => {
        fireEvent.pointerUp(document, { pointerId: 1, clientX: P.x + 30, clientY: P.y });
        await new Promise(r => setTimeout(r, 80));
        if (realElementFromPoint) document.elementFromPoint = realElementFromPoint; else delete document.elementFromPoint;
        document.body.classList.remove('gi-dnd-active');
    });

    it('the hero\'s own flag, pressed through the hero\'s see-through pixel, is picked up', () => {
        heroAt('h1', { x: 500, y: 900 });
        const { container, started } = mountWithDrag();
        const hero = figure(container, 'h1', false);
        const flag = container.querySelector('button[data-flag="h1"]');
        stackAtP(hero, flag);
        // The last pointer move saw a solid pixel, so the press itself lands on the figure.
        hero.style.pointerEvents = '';
        pressAndPull(hero);
        expect(started).toEqual(['flag-h1']);
    });

    it('a neighbour\'s see-through pixel over a flag gives up the press to that flag', () => {
        heroAt('h1', { x: 500, y: 900 });
        heroAt('h2', { x: 420, y: 980 });
        const { container, started } = mountWithDrag();
        const h2 = figure(container, 'h2', false);
        const flag = container.querySelector('button[data-flag="h1"]');
        stackAtP(h2, flag);
        pressAndPull(h2);
        expect(started).toEqual(['flag-h1']);
    });

    it('a neighbour drawn solid at the press takes it, even when the last move found the pixel see-through', () => {
        heroAt('h1', { x: 500, y: 900 });
        heroAt('h2', { x: 420, y: 980 });
        const { container, started } = mountWithDrag();
        const flag = container.querySelector('button[data-flag="h1"]');
        // The last pointer move saw a see-through pixel and let the pointer through the figure...
        const h2 = figure(container, 'h2', false);
        stackAtP(h2, flag);
        updateAlphaPointerEvents(P.x, P.y);
        expect(h2.style.pointerEvents).toBe('none');
        // ...then the figure stepped to a frame drawn solid there, so the browser hands the press to the flag.
        figure(container, 'h2', true);
        pressAndPull(flag);
        expect(started).toEqual(['hero-h2']);
    });

    it('a hero drawn facing left says so, so its pixels are tested where they are drawn', () => {
        const draw = (facing) => render(
            h(DndContext, null,
                h(MatFitProvider, { value: OWNER_FIT },
                    h(MatHero, { heroId: 'h1', name: 'h1', sprite: 'hero_knight', left: 0, top: 0, facing })))
        ).container.querySelector('[data-board-hero="h1"]');
        expect(draw(1).hasAttribute('data-alpha-flip')).toBe(false);
        cleanup();
        expect(draw(-1).getAttribute('data-alpha-flip')).toBe('x');
    });
});

/**
 * ⭐ **A flag among Tokens can always be picked up by its cloth.** Over a Token's round body a
 * flag lets the pointer through to the Token, except on the flag's cloth where the flag is drawn
 * in front of that Token. Its pole, its grass and its empty corners still give way.
 */
describe('⭐ a flag\'s cloth drawn in front of a Token takes the pointer there', () => {
    // At the owner's fit the flag is drawn 147 u across, its pole base on its point.
    const FLAG_PX_HERE = 147;
    const boxOf = (point) => {
        const s = FLAG_PX_HERE / 128;
        const left = point.x - 40 * s, top = point.y - 116 * s;
        return { left, top, right: left + FLAG_PX_HERE, bottom: top + FLAG_PX_HERE, width: FLAG_PX_HERE, height: FLAG_PX_HERE, x: left, y: top };
    };
    const ON_CLOTH = { x: 620, y: 620 };
    let realElementFromPoint;

    function scene(flagPoint) {
        const tok = placeAt('fixture_producer', 600, 600);
        // A hero who cannot work it, so the Token stays at rest (a worked Token is drawn in front of every flag).
        GameState.state.heroes = [{ id: 'h1', name: 'h1', spriteId: 'hero_knight', status: 'idle', level: 50, skills: { mining: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }];
        Flags.plant('h1', flagPoint);
        return tok;
    }
    function boxFlag(container, flagPoint) {
        const flag = container.querySelector('button[data-flag="h1"]');
        flag.getBoundingClientRect = () => boxOf(flagPoint);
        return flag;
    }
    function mountWithDrag() {
        const started = [];
        const Spy = () => { useDndMonitor({ onDragStart: (e) => started.push(e.active.id) }); return null; };
        const view = render(
            h(EngineContext.Provider, { value: { GameState, EventBus } },
                h(DeckDndProvider, null,
                    h(MatFitProvider, { value: OWNER_FIT }, h(MatBoard), h(Spy))))
        );
        const mat = view.container.querySelector('[data-mat-board]');
        mat.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: matW(), height: matH(), right: matW(), bottom: matH() });
        return { ...view, started };
    }
    const outlined = (container, id) => container.querySelector(`[data-token-art][data-token-id="${id}"]`).getAttribute('data-outline');

    beforeEach(() => { realElementFromPoint = document.elementFromPoint; });
    afterEach(async () => {
        fireEvent.pointerUp(document, { pointerId: 1, clientX: 700, clientY: 620 });
        await new Promise(r => setTimeout(r, 80));
        if (realElementFromPoint) document.elementFromPoint = realElementFromPoint; else delete document.elementFromPoint;
        document.body.classList.remove('gi-dnd-active');
    });

    it('hovering the cloth over the Token keeps the pointer on the flag, and the Token is not hovered', () => {
        const flagPoint = { x: 600, y: 690 };
        const tok = scene(flagPoint);
        const { container } = mountWithDrag();
        const flag = boxFlag(container, flagPoint);
        expect(Number(flag.style.zIndex)).toBeGreaterThan(Number(artOf(container, tok.id).style.zIndex));
        expect(Flags.tokenAtPoint(ON_CLOTH)?.id).toBe(tok.id);              // inside the Token's circle
        fireEvent.pointerMove(hitOf(container, tok.id), { clientX: ON_CLOTH.x, clientY: ON_CLOTH.y });
        expect(flag.className).toContain('pointer-events-auto');
        expect(outlined(container, tok.id)).not.toBe('hover');
        // Off the cloth, still on the Token: the flag gives way again.
        fireEvent.pointerMove(hitOf(container, tok.id), { clientX: 600, clientY: 660 });
        expect(flag.className).toContain('pointer-events-none');
        expect(outlined(container, tok.id)).toBe('hover');
    });

    it('a press on the cloth with no pointer move before it picks up the flag, not the Token', () => {
        const flagPoint = { x: 600, y: 690 };
        const tok = scene(flagPoint);
        const other = placeAt('fixture_producer', 1000, 600);
        const { container, started } = mountWithDrag();
        boxFlag(container, flagPoint);
        // The give-way is stale: the last move was on another Token, so every flag lets the
        // pointer through, and the press comes with no move of its own.
        fireEvent.pointerMove(hitOf(container, other.id), { clientX: 1000, clientY: 600 });
        expect(container.querySelector('button[data-flag="h1"]').className).toContain('pointer-events-none');
        act(() => {
            fireEvent.pointerDown(hitOf(container, tok.id), { pointerId: 1, clientX: ON_CLOTH.x, clientY: ON_CLOTH.y, isPrimary: true, button: 0 });
            fireEvent.pointerMove(document, { pointerId: 1, clientX: ON_CLOTH.x + 30, clientY: ON_CLOTH.y, isPrimary: true });
        });
        expect(started).toEqual(['flag-h1']);
    });

    it('a flag planted on the Token\'s centre: its pole and grass there leave the Token its press', () => {
        const flagPoint = { x: 600, y: 600 };
        const tok = scene(flagPoint);
        const { container, started } = mountWithDrag();
        boxFlag(container, flagPoint);
        act(() => {
            fireEvent.pointerDown(hitOf(container, tok.id), { pointerId: 1, clientX: 600, clientY: 600, isPrimary: true, button: 0 });
            fireEvent.pointerMove(document, { pointerId: 1, clientX: 630, clientY: 600, isPrimary: true });
        });
        expect(started).toEqual([`token-${tok.id}`]);
    });

    it('a flag drawn behind the Token (standing higher on the mat) leaves it the press, cloth or not', () => {
        const flagPoint = { x: 600, y: 599 };
        const tok = scene(flagPoint);
        const { container, started } = mountWithDrag();
        const flag = boxFlag(container, flagPoint);
        expect(Number(flag.style.zIndex)).toBeLessThan(Number(artOf(container, tok.id).style.zIndex));
        // On this flag's cloth, and inside the Token's circle.
        const p = { x: 605, y: 545 };
        expect(Flags.tokenAtPoint(p)?.id).toBe(tok.id);
        act(() => {
            fireEvent.pointerDown(hitOf(container, tok.id), { pointerId: 1, clientX: p.x, clientY: p.y, isPrimary: true, button: 0 });
            fireEvent.pointerMove(document, { pointerId: 1, clientX: p.x + 30, clientY: p.y, isPrimary: true });
        });
        expect(started).toEqual([`token-${tok.id}`]);
    });
});

describe('⭐ a hero\'s art takes no pointer outside the hero\'s box', () => {
    it('the figure draws wider than its 64 × 128 box, and only the box catches presses', () => {
        GameState.state.heroes = [{ id: 'h1', name: 'h1', spriteId: 'hero_knight', status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }];
        Flags.plant('h1', { x: 500, y: 900 });
        const { container } = mountAt(OWNER_FIT);
        const hero = container.querySelector('[data-board-hero="h1"]');
        expect(hero).not.toBeNull();
        expect(parseFloat(hero.style.width)).toBe(HERO_HIT_PX);
        expect(parseFloat(hero.style.height)).toBe(FLAG_PX);
        const drawing = hero.firstElementChild;
        expect(drawing.style.pointerEvents).toBe('none');
        expect(BoardState.heroBodyOf('h1')).toBeTruthy();
    });
});
