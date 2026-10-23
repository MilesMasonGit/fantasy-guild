// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import * as MatResize from '../systems/board/MatResize.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { matW, matH } from '../config/matGeometry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { placeAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * A save or a Region's frozen board keeps the points it was left with. When the game's mat is
 * shorter than the one they were laid on, loading or travelling there pulls everything back inside
 * (`MatResize.fitToMat`), before anything else hears of the board, the offline catch-up included.
 *
 * The shorter mat is set here through the Mat Tuner with nothing subscribed to it (no
 * `MatResize.init`), which is what a game update that ships a smaller mat looks like to a save.
 */

registerTokenTypes({
    edge_small: {
        id: 'edge_small', name: 'Edge Small', tokenType: 'resource',
        size: 1, uses: 100, requiresHero: false,
        config: { cycleTimeMs: 5000, inputs: [], outputs: [] }
    }
});

/** A mat 1920 × 1040 u: 12 steps at 13/24, shorter than the 1126 u these boards are laid on. */
function shortenMat() {
    setMatTuning('matSteps', 12);
    setMatTuning('matAspect', 13 / 24);
    expect([matW(), matH()]).toEqual([1920, 1040]);
}

const insideAll = () => BoardState.tokens().every(t => MatPlacement.insideMat(t.typeId, t));

beforeEach(() => {
    localStorage.clear();
    MatResize.teardown();
    resetMatTuning();
    setMatTuning('matSteps', 11);
    setMatTuning('matAspect', 0.64);
});

afterEach(() => {
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    resetMatTuning();
    localStorage.clear();
});

describe('⭐ a save laid on a taller mat loads with every Token on the mat', () => {
    it('a Token below the new edge is pulled inside, a flag clamped, before GAME_LOADED', async () => {
        SaveManager.newGame(0);
        const low = placeAt('edge_small', 700, 1050);
        const high = placeAt('edge_small', 700, 300);
        GameState.state.heroes = [{ id: 'h1', name: 'A' }];
        BoardState.setFlag('h1', { x: 900, y: 1100, plantedAt: 1 });
        expect(insideAll()).toBe(true);
        SaveManager.save(false);

        shortenMat();
        let insideWhenAnnounced = null;
        const off = EventBus.subscribe(ENGINE_EVENTS.GAME_LOADED, () => { insideWhenAnnounced = insideAll(); });
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        off();

        expect(insideWhenAnnounced).toBe(true);
        expect(insideAll()).toBe(true);
        expect(BoardState.getTokenById(low.id).y).toBeLessThanOrEqual(1040 - 64);
        expect({ x: BoardState.getTokenById(high.id).x, y: BoardState.getTokenById(high.id).y }).toEqual({ x: 700, y: 300 });
        expect(BoardState.flagOf('h1')).toMatchObject({ x: 900, y: 1040 });
    });

    it('a save that already fits loads exactly as it was', async () => {
        SaveManager.newGame(0);
        const a = placeAt('edge_small', 700, 900);
        SaveManager.save(false);

        shortenMat();
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);
        expect({ x: BoardState.getTokenById(a.id).x, y: BoardState.getTokenById(a.id).y }).toEqual({ x: 700, y: 900 });
    });
});

describe('⭐ travelling to a Region left on a taller mat lands every Token on the mat', () => {
    it('its frozen board is pulled inside before BOARD_SWAPPED', () => {
        GameState.initNew();
        Atlas.ensureState();
        const home = Atlas.activeRegion();
        const other = Atlas.devCreateEmptyRegion();
        expect(Atlas.travel(other.id).success).toBe(true);
        const low = placeAt('edge_small', 700, 1050);
        expect(Atlas.travel(home.id).success).toBe(true);

        shortenMat();
        let insideWhenSwapped = null;
        const off = EventBus.subscribe(ENGINE_EVENTS.BOARD_SWAPPED, () => { insideWhenSwapped = insideAll(); });
        expect(Atlas.travel(other.id).success).toBe(true);
        off();

        expect(insideWhenSwapped).toBe(true);
        expect(BoardState.getTokenById(low.id).y).toBeLessThanOrEqual(1040 - 64);
    });
});
