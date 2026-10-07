// @vitest-environment jsdom
import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as MatCap from '../systems/board/MatCap.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { EngineContext } from '../ui/context/EngineContext';
import { TokenInspection } from '../ui/components/drawer/TokenInspection.jsx';
import { clearMat } from './fixtures/mat.js';
import { centreOf } from '../systems/board/nearby.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Token Lifecycle slice 5.2 — **Remove** ( no refunds spawned Tokens stay a
 * hero working it moves on).
 *
 * The fixture "Forest" is a placed `fixture_producer` with spawned producers
 * around it, which is what a real Forest leaves behind.
 */

const FOREST = { x: 400, y: 300 };
const EAST = { x: 560, y: 300 };
const WEST = { x: 240, y: 300 };
const HALL = { x: 900, y: 700 };

const h = React.createElement;

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(point, typeId, origin = BoardState.ORIGIN.PLACED) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, origin);
    return BoardState.addToken(instance, point.x, point.y);
}

const mount = (el) => render(h(EngineContext.Provider, { value: { GameState, EventBus } }, el));
const removeBox = (container) => container.querySelector('[data-remove-token]');

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });
afterEach(() => cleanup());

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('flagRadius', 400);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [hero('h1', { logging: 50 })];
});

/** A placed Forest with two spawned Tokens beside it, and the Guild Hall. */
function forestScene() {
    const hall = put(HALL, 'token_guild_hall');
    const forest = put(FOREST, 'fixture_producer');
    const east = put(EAST, 'fixture_producer', BoardState.ORIGIN.SPAWNED);
    const west = put(WEST, 'fixture_producer', BoardState.ORIGIN.SPAWNED);
    return { hall, forest, east, west };
}

describe('removePlacedToken (slice 5.2)', () => {
    it('deletes the Forest and leaves the spawned Tokens around it (SP-6)', () => {
        const { forest, east, west } = forestScene();
        expect(Placement.removePlacedToken(forest.id).success).toBe(true);
        expect(BoardState.getTokenById(forest.id)).toBeNull();
        expect(BoardState.getTokenById(east.id)).toBe(east);
        expect(BoardState.getTokenById(west.id)).toBe(west);
        expect(east.x).toBe(EAST.x);
        expect(west.x).toBe(WEST.x);
    });

    it('drops the placed count by one; the Guild Hall and spawned Tokens are not counted', () => {
        const { forest } = forestScene();
        expect(MatCap.placedCount()).toBe(1);
        Placement.removePlacedToken(forest.id);
        expect(MatCap.placedCount()).toBe(0);
    });

    it('returns nothing: the Bank is unchanged (TL-1)', () => {
        // (It also checked the Token Vault, which went in Token Lifecycle 9.3.)
        const { forest } = forestScene();
        const bank = JSON.stringify(GameState.state.inventory);
        Placement.removePlacedToken(forest.id);
        expect(JSON.stringify(GameState.state.inventory)).toBe(bank);
    });

    it('a hero working it moves on to other work (SP-52)', () => {
        const { forest, east, west } = forestScene();
        // Hold the spawned Tokens back so the hero starts on the Forest, then
        // let them be worked again.
        Flags.setDisallowed(east.id, true);
        Flags.setDisallowed(west.id, true);
        Flags.plant('h1', centreOf(forest));
        expect(BoardState.workTokenOf('h1')).toBe(forest.id);
        Flags.setDisallowed(east.id, false);
        Flags.setDisallowed(west.id, false);

        const res = Placement.removePlacedToken(forest.id);
        expect(res.idledHeroId).toBe('h1');
        Flags.assign(0);
        // One of the spawned Tokens it left behind, whichever the flag picks.
        expect([east.id, west.id]).toContain(BoardState.workTokenOf('h1'));
    });

    it('publishes TILE_CHANGED and state_changed, and no depletion', () => {
        const { forest } = forestScene();
        const seen = [];
        const offs = [BOARD_EVENTS.TILE_CHANGED, 'state_changed', BOARD_EVENTS.TOKEN_DEPLETED]
            .map((e) => EventBus.subscribe(e, (payload) => seen.push([e, payload])));
        Placement.removePlacedToken(forest.id);
        offs.forEach((off) => off?.());

        const tile = seen.find(([e]) => e === BOARD_EVENTS.TILE_CHANGED);
        expect(tile?.[1]).toMatchObject({ instanceId: forest.id, x: FOREST.x, y: FOREST.y, typeId: null });
        expect(seen.some(([e]) => e === 'state_changed')).toBe(true);
        expect(seen.some(([e]) => e === BOARD_EVENTS.TOKEN_DEPLETED)).toBe(false);
    });

    it('refuses the Guild Hall and a spawned Token', () => {
        const { hall, east } = forestScene();
        expect(Placement.removePlacedToken(hall.id)).toMatchObject({ success: false });
        expect(Placement.removePlacedToken(east.id)).toMatchObject({ success: false, reason: 'Spawned Tokens are worked out, not removed.' });
        expect(BoardState.getTokenById(hall.id)).toBe(hall);
        expect(BoardState.getTokenById(east.id)).toBe(east);
    });
});

describe('the Token panel offers no Remove (B3.2, TL-13)', () => {
    it('has no inline Remove: a Token leaves the mat through the discard bin', () => {
        const { hall, forest, east } = forestScene();
        for (const [typeId, instanceId] of [['fixture_producer', forest.id], ['fixture_producer', east.id], ['token_guild_hall', hall.id]]) {
            const { container } = mount(h(TokenInspection, { typeId, instanceId }));
            expect(removeBox(container)).toBeNull();
            expect([...container.querySelectorAll('button')].some(b => /remove/i.test(b.textContent))).toBe(false);
            cleanup();
        }
    });
});
