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
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { MAT_TUNABLES, matTuning, matTuningDefault, resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { artRadiusOf } from '../config/matGeometry.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MatTunerDevSection } from '../ui/dev/MatTunerDevSection.jsx';
import { FlagLayer } from '../ui/components/board/FlagLayer.jsx';
import { PENNANT_SRC } from '../ui/components/board/FlagMark.jsx';
import { GLYPHS, glyphRing } from '../ui/components/base/PixelGlyph.jsx';
import { onFlagCloth } from '../ui/components/board/flagCloth.js';
import {
    JOB_MARKER_LOOKS, MARKER_ART_PX, MARKER_FOOT, jobMarkerLook, markerBox, pinnedFlagPoint,
    PENNANT_ART_PX, FLAG_PX, POLE_BASE
} from '../ui/components/board/flagGeometry.js';
import { drawnPoint } from './fixtures/drawnPoint.js';
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
 * ⭐ The job marker's three looks, switched by the Mat Tuner's Job marker row while the owner
 * compares them: the pennant on top of the Token, or a small flag (Lucide or pixel glyph) peeking
 * out from behind the Token's top-left corner.
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

describe('the Mat Tuner row', () => {
    it('is three choices, Lucide while the owner compares, and stored like every other row', () => {
        const row = MAT_TUNABLES.find(t => t.key === 'jobMarker');
        expect(row.choices).toEqual(['Pennant', 'Lucide', 'Pixel']);
        expect(JOB_MARKER_LOOKS).toEqual(['pennant', 'lucide', 'pixel']);
        expect(matTuningDefault('jobMarker')).toBe(1);
        expect(jobMarkerLook(matTuning('jobMarker'))).toBe('lucide');
        setMatTuning('jobMarker', 2);
        expect(JSON.parse(localStorage.getItem('fantasy_guild_mat_tuning')).jobMarker).toBe(2);
        setMatTuning('jobMarker', 9);
        expect(matTuning('jobMarker')).toBe(2);
        expect(jobMarkerLook(7)).toBe('pennant');
    });

    it('shows as three buttons in the dev panel, and a press picks that look', () => {
        const { container } = render(h(MatTunerDevSection));
        const pixel = container.querySelector('[data-testid="mat-tuner-jobMarker-2"]');
        expect(container.querySelector('[data-testid="mat-tuner-jobMarker-1"]').getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(pixel);
        expect(matTuning('jobMarker')).toBe(2);
        expect(pixel.getAttribute('aria-pressed')).toBe('true');
    });
});

describe('where each look is drawn', () => {
    const centre = { x: 600, y: 500 };

    it('the pennant is where it always was: pole foot at the top of the Token, or on the spot', () => {
        const box = markerBox('pennant', centre, 64, 2);
        const at = pinnedFlagPoint(centre, 64);
        expect(box.size).toBe(PENNANT_ART_PX * 2);
        expect(box.left + POLE_BASE.x * box.size / FLAG_PX).toBeCloseTo(at.x);
        expect(box.top + POLE_BASE.y * box.size / FLAG_PX).toBeCloseTo(at.y);
    });

    it.each(['lucide', 'pixel'])('the small %s marker is 12 art pixels, at the top-left corner of a pinned Token', (look) => {
        for (const r of [64, 32, 144]) {
            const box = markerBox(look, centre, r, 2);
            expect(box.size).toBe(MARKER_ART_PX * 2);
            const mid = { x: box.left + box.size / 2, y: box.top + box.size / 2 };
            expect(centre.x - mid.x).toBeCloseTo(centre.y - mid.y);
            // Inside the art's square (it is half hidden behind the Token), outside its circle.
            expect(centre.x - mid.x).toBeLessThan(r);
            expect(Math.hypot(centre.x - mid.x, centre.y - mid.y)).toBeGreaterThan(r);
        }
    });

    it.each(['lucide', 'pixel'])('a spot order’s small %s marker stands its pole foot on the spot', (look) => {
        const box = markerBox(look, BARE, null, 2);
        expect(box.left + MARKER_FOOT[look].x * box.size).toBeCloseTo(BARE.x);
        expect(box.top + MARKER_FOOT[look].y * box.size).toBeCloseTo(BARE.y);
    });

    it('the pixel glyph’s foot share is its pole’s bottom cell', () => {
        const rows = GLYPHS.flag;
        const pad = 2;
        const cx = MARKER_FOOT.pixel.x * MARKER_ART_PX - 0.5 - pad;
        const cy = MARKER_FOOT.pixel.y * MARKER_ART_PX - 0.5 - pad;
        expect(rows[cy][cx]).toBe('#');
        expect(rows.length - 1).toBe(cy);
    });

    it('the glyph’s outline ring is one cell round the lit cells, and never on one', () => {
        const ring = glyphRing(GLYPHS.flag, 1, 2);
        expect(ring.length).toBeGreaterThan(0);
        for (const [x, y] of ring) expect(GLYPHS.flag[y - 2]?.[x - 2]).not.toBe('#');
        const halo = glyphRing(GLYPHS.flag, 2, 2);
        for (const p of halo) expect(ring.some(q => q[0] === p[0] && q[1] === p[1])).toBe(false);
        for (const [x, y] of halo) expect(x >= 0 && y >= 0 && x < 12 && y < 12).toBe(true);
    });
});

describe('the mat', () => {
    it('switches look live when the tuner row moves', () => {
        put(TOKEN, 'fixture_producer');
        Flags.plant('h1', TOKEN);
        const { container } = mount(h(FlagLayer));
        const flag = () => container.querySelector('[data-flag="h1"]');
        expect(flag().getAttribute('data-flag-look')).toBe('lucide');
        expect(flag().querySelector('[data-marker-look="lucide"] svg')).toBeTruthy();
        act(() => { setMatTuning('jobMarker', 2); });
        expect(flag().getAttribute('data-flag-look')).toBe('pixel');
        expect(flag().querySelector('svg[data-glyph="flag"]')).toBeTruthy();
        act(() => { setMatTuning('jobMarker', 0); });
        expect(flag().querySelector('img').getAttribute('src')).toBe(PENNANT_SRC);
    });

    it.each([[0, 'pennant'], [1, 'lucide'], [2, 'pixel']])('look %i (%s) sorts just behind its Token, so the Token is drawn over it', (index) => {
        setMatTuning('jobMarker', index);
        const t = put(TOKEN, 'fixture_producer');
        dropOnMat({ kind: DRAG_KIND.HERO, heroId: 'h1' }, TOKEN);
        expect(Flags.pinnedTokenOf('h1')?.id).toBe(t.id);
        const { container } = mount(h(MatBoard));
        const flag = container.querySelector('button[data-flag="h1"]');
        const art = container.querySelector(`[data-token-art][data-token-id="${t.id}"]`);
        expect(Number(flag.style.zIndex)).toBeLessThan(Number(art.style.zIndex));
    });

    it('a spot order’s small marker is drawn with its pole foot on the spot', () => {
        Flags.plant('h1', BARE);
        const { container } = mount(h(FlagLayer));
        const flag = container.querySelector('[data-flag="h1"]');
        expect(flag.getAttribute('data-flag-look')).toBe('lucide');
        const box = markerBox('lucide', BARE, null, parseFloat(flag.style.width) / MARKER_ART_PX);
        expect(drawnPoint(flag).x).toBeCloseTo(box.left);
        expect(drawnPoint(flag).y).toBeCloseTo(box.top);
    });

    it('a small marker’s cloth, for the press rule over Tokens, is its drawn flag', () => {
        const el = document.createElement('button');
        el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 24, height: 24 });
        el.setAttribute('data-flag-look', 'pixel');
        expect(onFlagCloth(el, 12, 12)).toBe(true);
        expect(onFlagCloth(el, 1, 1)).toBe(false);
        el.setAttribute('data-flag-look', 'pennant');
        // The pennant's cloth starts 5/32 in: its pole beside it is not cloth.
        expect(onFlagCloth(el, 2, 12)).toBe(false);
        expect(onFlagCloth(el, 12, 12)).toBe(true);
    });
});
