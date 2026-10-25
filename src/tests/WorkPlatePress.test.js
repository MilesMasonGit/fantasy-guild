// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { useDndMonitor } from '@dnd-kit/core';
import { DeckDndProvider, dragSourceId } from '../ui/dnd/DndKit.jsx';
import './fixtures/testTokens.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { matW, matH } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MAT_TOKEN_DRAG_ID } from '../ui/components/board/MatToken.jsx';
import { MatFitProvider } from '../ui/components/board/MatFitContext.jsx';
import { platePlace, PLATE } from '../ui/components/board/workPlate.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **A work plate never takes a Token from under the pointer.** The plate stands below its hero's
 * feet, over the mat's other layers, so on a crowded mat it lies across the top of the Token in the
 * row below. A point on a Token's circle is that Token's (the mat's rule, `Flags.tokenAtPoint`),
 * plate or no plate: hovering there lights that Token and a press there picks it up (the drag
 * bench found 2 to 3 presses in 100 picking up the plate's Token instead). Off every Token's circle
 * the plate keeps the pointer, and a press on it picks up its own Token.
 */

registerTokenTypes({
    plate_press_rock: {
        id: 'plate_press_rock', name: 'Plate Press Rock', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 100, sprite: 's_industry'
    }
});

const h = React.createElement;
/** About the owner's 1920 × 1080: art drawn at 2× on screen. */
const FIT = 0.87;
const A = { x: 600, y: 400 };

/** What a drag picked up: a mat Token (one shared source) by its own id. */
const startedName = (active) => (active.id === MAT_TOKEN_DRAG_ID ? `token-${active.data.current.from.instanceId}` : dragSourceId(active));

function mount() {
    const started = [];
    const Spy = () => { useDndMonitor({ onDragStart: (e) => started.push(startedName(e.active)) }); return null; };
    const view = render(h(DeckDndProvider, null, h(MatFitProvider, { value: FIT }, h(MatBoard), h(Spy))));
    // jsdom lays nothing out: the mat's natural box, so a client point IS a mat point.
    const mat = view.container.querySelector('[data-mat-board]');
    mat.getBoundingClientRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: matW(), height: matH(), right: matW(), bottom: matH() });
    return { ...view, mat, started };
}

/** A point on the plate under Token A's feet: its slot's centre line, `down` mat units below its top. */
function platePoint(down) {
    const place = platePlace({ x: A.x, y: A.y, typeId: 'fixture_producer', side: 1, fit: FIT });
    return { x: place.left + place.width / 2, y: place.top + down * place.unit };
}

function press(el, at) {
    act(() => {
        fireEvent.pointerDown(el, { pointerId: 1, clientX: at.x, clientY: at.y, isPrimary: true, button: 0 });
        fireEvent.pointerMove(document, { pointerId: 1, clientX: at.x + 30, clientY: at.y, isPrimary: true });
    });
}

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    clearMat();
    GameState.state.heroes = [{
        id: 'h1', name: 'h1', status: 'idle', level: 50,
        skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 }
    }];
});
afterEach(async () => {
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 0, clientY: 0 });
    await new Promise(r => setTimeout(r, 80));
    document.body.classList.remove('gi-dnd-active');
    cleanup();
});

/** Token A worked by h1 (its plate below their feet), and Token B whose circle reaches up under the plate. */
function scene({ withB = true } = {}) {
    const a = placeAt('fixture_producer', A.x, A.y);
    Flags.plant('h1', A, { pin: true });
    expect(BoardState.workerOf(a.id)).toBe('h1');
    const at = platePoint(PLATE.H / 2);
    const b = withB ? placeAt('plate_press_rock', at.x, at.y + 50) : null;
    if (b) expect(Flags.tokenAtPoint(at)?.id).toBe(b.id);
    else expect(Flags.tokenAtPoint(at)).toBeNull();
    const view = mount();
    const plate = view.container.querySelector(`[data-work-plate="${a.id}"]`);
    expect(plate).not.toBeNull();
    return { a, b, at, plate, ...view };
}

describe('⭐ a work plate never takes a Token from under the pointer', () => {
    it('a press on the plate over another Token’s circle picks up that Token, not the plate’s', () => {
        const { b, at, plate, started } = scene();
        press(plate, at);
        expect(started).toEqual([`token-${b.id}`]);
    });

    it('a press on the plate off every Token’s circle picks up the plate’s own Token', () => {
        const { a, at, plate, started } = scene({ withB: false });
        press(plate, at);
        expect(started).toEqual([`token-${a.id}`]);
    });

    it('hovering the plate over another Token’s circle lights that Token, and the plates let the pointer through', () => {
        const { a, b, at, plate, container } = scene();
        fireEvent.pointerMove(plate, { clientX: at.x, clientY: at.y });
        const art = (id) => container.querySelector(`[data-token-art][data-token-id="${id}"]`);
        expect(art(b.id).getAttribute('data-outline')).toBe('hover');
        expect(art(a.id).getAttribute('data-outline')).not.toBe('hover');
        expect(container.querySelector('[data-work-plates]').style.getPropertyValue('--plate-pointer')).toBe('none');
        expect(plate.style.pointerEvents).toBe('var(--plate-pointer, auto)');
    });

    it('hovering the plate off every Token’s circle lights the plate’s own Token', () => {
        const { a, at, plate, container } = scene({ withB: false });
        fireEvent.pointerMove(plate, { clientX: at.x, clientY: at.y });
        expect(container.querySelector(`[data-token-art][data-token-id="${a.id}"]`).getAttribute('data-outline')).toBe('hover');
        expect(container.querySelector('[data-work-plates]').style.getPropertyValue('--plate-pointer')).toBe('auto');
    });
});
