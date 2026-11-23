// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
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
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { MAT_TUNABLES, resetMatTuning } from '../config/matTuning.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { FlagLayer } from '../ui/components/board/FlagLayer.jsx';
import { FlagGhost } from '../ui/dnd/DragGhost.jsx';
import { onFlagCloth } from '../ui/components/board/flagCloth.js';
import { MARKER_ART_PX, MARKER_FOOT, markerBox } from '../ui/components/board/flagGeometry.js';
import { drawnPoint } from './fixtures/drawnPoint.js';
import { setRosterHover } from '../ui/components/board/orderLit.js';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { rosterFlagPayload } from '../ui/dnd/dragConstants.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The hero's job flag (the owner's pick, 2026-10-29): Lucide's FlagTriangleRight, 12 art
 * pixels, in the middle of the job's Token while shown, or standing on a spot.
 */

const h = React.createElement;
const TOKEN = { x: 600, y: 500 };
const BARE = { x: 1300, y: 800 };

function put(point, typeId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}
const mount = (el) => render(h(DndContext, null, el));

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
afterEach(() => cleanup());
beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [
        { id: 'h1', name: 'Aela', status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } }
    ];
});

describe('one look', () => {
    it('has no Mat Tuner row to switch it', () => {
        expect(MAT_TUNABLES.find(t => t.key === 'jobMarker')).toBeUndefined();
    });

    it('is 12 art pixels, centred on a pinned Token', () => {
        const centre = { x: 600, y: 500 };
        const box = markerBox(centre, true, 2);
        expect(box.size).toBe(MARKER_ART_PX * 2);
        expect({ x: box.left + box.size / 2, y: box.top + box.size / 2 }).toEqual(centre);
    });

    it('a spot order’s flag stands its pole foot on the spot', () => {
        const box = markerBox(BARE, null, 2);
        expect(box.left + MARKER_FOOT.x * box.size).toBeCloseTo(BARE.x);
        expect(box.top + MARKER_FOOT.y * box.size).toBeCloseTo(BARE.y);
    });
});

describe('on a Token the flag stands in its middle', () => {
    it('on the mat, while its hero is hovered', () => {
        const t = put(TOKEN, 'fixture_producer');
        dropOnMat(rosterFlagPayload('h1'), TOKEN);
        const { container } = mount(h(FlagLayer, { hoverHeroId: 'h1' }));
        const el = container.querySelector('[data-flag="h1"]');
        const size = parseFloat(el.style.width);
        const artScale = size / MARKER_ART_PX;
        expect(Math.abs(t.x - (drawnPoint(el).x + size / 2))).toBeLessThanOrEqual(artScale / 2);
        expect(Math.abs(t.y - (drawnPoint(el).y + size / 2))).toBeLessThanOrEqual(artScale / 2);
    });
});

describe('the mat', () => {
    it('draws the Lucide flag in the flag’s button', () => {
        put(TOKEN, 'fixture_producer');
        dropOnMat(rosterFlagPayload('h1'), TOKEN);
        const { container } = mount(h(FlagLayer, { hoverHeroId: 'h1' }));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(flag.querySelector('[data-flag-mark] svg.lucide-flag-triangle-right')).toBeTruthy();
        expect(flag.querySelector('img')).toBeNull();
        expect(flag.style.width).toBe(flag.style.height);
    });

    /**
     * ⭐ A Token order's flag stands in the Token's middle, so it is drawn one above its own Token,
     * whichever band that Token is in (a worked Token is drawn in front of every Token at rest):
     * the Token's art never hides it.
     */
    it('is drawn one above its own Token, under the Token in front of it', () => {
        const t = put(TOKEN, 'fixture_producer');
        const front = put({ x: TOKEN.x + 40, y: TOKEN.y + 60 }, 'fixture_producer');
        dropOnMat(rosterFlagPayload('h1'), TOKEN);
        expect(Flags.pinnedTokenOf('h1')?.id).toBe(t.id);
        setRosterHover('h1');
        try {
            const { container } = mount(h(MatBoard));
            const flag = container.querySelector('button[data-flag="h1"]');
            const z = (id) => Number(container.querySelector(`[data-token-art][data-token-id="${id}"]`).style.zIndex);
            expect(Number(flag.style.zIndex)).toBe(z(t.id) + 1);
            if (z(front.id) > z(t.id)) expect(Number(flag.style.zIndex)).toBeLessThan(z(front.id));
        } finally {
            act(() => setRosterHover(null));
        }
    });

    it('a spot order’s flag is drawn with its pole foot on the spot', () => {
        Orders.orderAt('h1', BARE);
        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        const box = markerBox(BARE, null, parseFloat(flag.style.width) / MARKER_ART_PX);
        expect(drawnPoint(flag).x).toBeCloseTo(box.left);
        expect(drawnPoint(flag).y).toBeCloseTo(box.top);
    });

    it('the flag’s cloth, for the press rule over Tokens, is its drawn flag', () => {
        const el = document.createElement('button');
        el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 24, height: 24 });
        expect(onFlagCloth(el, 12, 12)).toBe(true);
        expect(onFlagCloth(el, 1, 1)).toBe(false);
        expect(onFlagCloth(el, 23, 23)).toBe(false);
    });
});

describe('the flag in the hand', () => {
    /**
     * ⭐ The ghost's box is centred on the pointer and the drop lands on the pointer, so the
     * carried flag's pole foot is drawn at the box's middle: where the flag will stand.
     */
    it('is the mat’s flag, its pole foot at the middle of its box', () => {
        const { container } = render(h(FlagGhost, { payload: { heroId: 'h1' } }));
        const box = container.querySelector('[data-flag-ghost="h1"]');
        const size = parseFloat(box.style.width);
        expect(size % MARKER_ART_PX).toBe(0);
        const mark = box.querySelector('[data-flag-mark]');
        expect(mark.querySelector('svg.lucide-flag-triangle-right')).toBeTruthy();
        expect(parseFloat(mark.style.left) + MARKER_FOOT.x * size).toBeCloseTo(size / 2);
        expect(parseFloat(mark.style.top) + MARKER_FOOT.y * size).toBeCloseTo(size / 2);
    });
});
