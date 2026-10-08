// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
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

describe('⭐ a hero\'s art takes no pointer outside the hero\'s box', () => {
    it('the figure draws wider than its 64 × 128 box, and only the box catches presses', () => {
        GameState.state.heroes = [{ id: 'h1', name: 'h1', spriteId: 'hero_knight', status: 'idle', level: 50, skills: { logging: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }];
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
