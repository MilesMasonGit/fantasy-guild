// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses, tokenSpritePath } from '../config/registries/tokenRegistry.js';
import { MAT_TUNABLES, resetMatTuning } from '../config/matTuning.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { FlagLayer } from '../ui/components/board/FlagLayer.jsx';
import { FlagGhost } from '../ui/dnd/DragGhost.jsx';
import { onFlagCloth } from '../ui/components/board/flagCloth.js';
import {
    MARKER_ART_PX, MARKER_CORNER, MARKER_FOOT, MARKER_PEEK_PX, markerBox, markerCornerOffset
} from '../ui/components/board/flagGeometry.js';
import { drawnPoint } from './fixtures/drawnPoint.js';
import { cornerInsetOfMask } from '../ui/components/board/markerCorner.js';
import { setAlphaMaskForTests } from '../ui/utils/alphaHitTest.js';
import { tokenSizeFor, TOKEN_SURFACE } from '../ui/components/base/TokenSprite.jsx';
import { dropOnMat } from '../ui/components/board/dropOnMat.js';
import { DRAG_KIND } from '../ui/dnd/dragConstants.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ The hero's job flag (the owner's pick, 2026-10-29): Lucide's FlagTriangleRight, 12 art
 * pixels, peeking out from behind the top-left corner of the job's Token, or standing on a spot.
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

/** A 64×64 alpha mask with the art pixels `drawn` set. */
function maskOf(drawn) {
    const data = new Uint8Array(64 * 64);
    for (const [x, y] of drawn) data[y * 64 + x] = 255;
    return { width: 64, height: 64, data };
}
const FULL = () => maskOf(Array.from({ length: 64 * 64 }, (_, i) => [i % 64, Math.floor(i / 64)]));

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

    it('is 12 art pixels, at the top-left corner of a pinned Token while its art is not known', () => {
        const centre = { x: 600, y: 500 };
        for (const r of [64, 32, 144]) {
            const box = markerBox(centre, r, 2);
            expect(box.size).toBe(MARKER_ART_PX * 2);
            const mid = { x: box.left + box.size / 2, y: box.top + box.size / 2 };
            expect((centre.x - mid.x) / r).toBeCloseTo(MARKER_CORNER);
            expect((centre.y - mid.y) / r).toBeCloseTo(MARKER_CORNER);
        }
    });

    it('a spot order’s flag stands its pole foot on the spot', () => {
        const box = markerBox(BARE, null, 2);
        expect(box.left + MARKER_FOOT.x * box.size).toBeCloseTo(BARE.x);
        expect(box.top + MARKER_FOOT.y * box.size).toBeCloseTo(BARE.y);
    });
});

describe('on a Token the flag sits where that Token’s own art begins', () => {
    it('reads the art’s top-left corner along its diagonal', () => {
        expect(cornerInsetOfMask(FULL())).toBe(0);
        // The first pixel a 45° line swept in from the corner meets: x + y = 30, so 15 on each axis.
        expect(cornerInsetOfMask(maskOf([[10, 20], [40, 40]]))).toBe(15);
        expect(cornerInsetOfMask(maskOf([]))).toBeNull();
    });

    it('stands two art pixels out past it: outside the corner of art that fills its square', () => {
        const art = 128;
        expect(markerCornerOffset(art, 0, 2)).toBe(art / 2 + MARKER_PEEK_PX * 2);
        expect(markerCornerOffset(art, 17 / 64, 2)).toBe(art / 2 - (34 - 4));
    });

    it('on the mat, once the sprite’s pixels are known', async () => {
        const t = put(TOKEN, 'fixture_producer');
        // This sprite fills its square: the flag's middle stands just outside its corner.
        setAlphaMaskForTests(tokenSpritePath(t.typeId), FULL());
        dropOnMat({ kind: DRAG_KIND.HERO, heroId: 'h1' }, TOKEN);
        const { container } = mount(h(FlagLayer));
        await act(async () => { await new Promise(r => setTimeout(r, 20)); });
        const el = container.querySelector('[data-flag="h1"]');
        const size = parseFloat(el.style.width);
        const artScale = size / MARKER_ART_PX;
        const half = tokenSizeFor(TOKEN_SURFACE.BOARD, t.typeId, artScale) / 2;
        expect(t.x - (drawnPoint(el).x + size / 2)).toBeCloseTo(half + MARKER_PEEK_PX * artScale);
        expect(t.y - (drawnPoint(el).y + size / 2)).toBeCloseTo(half + MARKER_PEEK_PX * artScale);
    });
});

describe('the mat', () => {
    it('draws the Lucide flag in the flag’s button', () => {
        put(TOKEN, 'fixture_producer');
        dropOnMat({ kind: DRAG_KIND.HERO, heroId: 'h1' }, TOKEN);
        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(flag.querySelector('[data-flag-mark] svg.lucide-flag-triangle-right')).toBeTruthy();
        expect(flag.querySelector('img')).toBeNull();
        expect(flag.style.width).toBe(flag.style.height);
    });

    /**
     * A worked Token is drawn in front of every flag anyway; the sort matters where the job's
     * Token rests (a camp, while its hands work round it) and for resting Tokens about level with
     * it. The flag sorts half a unit above its Token's line: behind a resting Token a quarter of
     * a unit above that line, as it is behind its own Token when that one rests.
     */
    it('sorts just behind its Token’s line', () => {
        const t = put(TOKEN, 'fixture_producer');
        const level = put({ x: TOKEN.x + 160, y: TOKEN.y - 0.25 }, 'fixture_producer');
        dropOnMat({ kind: DRAG_KIND.HERO, heroId: 'h1' }, TOKEN);
        expect(Flags.pinnedTokenOf('h1')?.id).toBe(t.id);
        const { container } = mount(h(MatBoard));
        const flag = container.querySelector('button[data-flag="h1"]');
        const z = (id) => Number(container.querySelector(`[data-token-art][data-token-id="${id}"]`).style.zIndex);
        expect(Number(flag.style.zIndex)).toBeLessThan(z(level.id));
        expect(Number(flag.style.zIndex)).toBeLessThan(z(t.id));
    });

    it('a spot order’s flag is drawn with its pole foot on the spot', () => {
        Flags.plant('h1', BARE);
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
