import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as InputAllocator from '../systems/board/InputAllocator.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import * as Flags from '../systems/board/Flags.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { tileCentre } from '../config/boardGeometry.js';
import { idAt } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ One "can this run?" for choosing and for running (Free Playmat 1.4b).
 *
 * A flag chooses with `WorkCheck.whyCannotRun`; the runner raises its red mark
 * from the same module. Each case stages a hero already working the Token and
 * checks the runner's mark and the chooser's reason agree — and are the reason
 * the case is about.
 */

const TILE = 14;

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(tile, typeId, uses = undefined) {
    const instance = BoardState.createTokenInstance(typeId, uses === undefined ? tokenStartingUses(typeId) : uses);
    Placement.placeToken(tile, instance);
    return BoardState.getToken(tile);
}

/** A hero already working the Token on TILE, set up directly. */
function staff(instance) {
    const skill = getTokenType(instance.typeId).config.skill;
    Flags.plant('h1', tileCentre(TILE), { skill });
    BoardState.setClaim('h1', { instanceId: instance.id, tile: TILE, typeId: instance.typeId });
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    InputAllocator.resetStarvationStats();
    GameState.state.inventory.maxSlots = 50;
    GameState.state.heroes = [hero('h1', { logging: 50, mining: 50, alchemy: 50, smithing: 50 })];
});

const CASES = [
    { name: 'missing inputs', expected: ALERT.INPUTS, build: () => put(TILE, 'fixture_consumer') },
    { name: 'no recipe context', expected: ALERT.NO_RECIPE, build: () => { InventoryManager.addItem('item_coal', 5); return put(TILE, 'fixture_station'); } },
    {
        name: 'too few charges', expected: ALERT.CHARGES, build: () => {
            InventoryManager.addItem('item_coal', 5);
            put(TILE + 1, 'fixture_charged_context');
            return put(TILE, 'fixture_charge_station', 2);
        }
    },
    {
        name: 'skill too low', expected: ALERT.ACCESS, build: () => {
            GameState.state.heroes = [hero('h1', { mining: 5 })];
            return put(TILE, 'fixture_gated');
        }
    },
    { name: 'runnable', expected: null, build: () => put(TILE, 'fixture_producer') }
];

describe('the runner and the chooser give the same answer', () => {
    for (const c of CASES) {
        it(c.name, () => {
            const instance = c.build();
            staff(instance);
            const chooser = WorkCheck.whyCannotRun(idAt(TILE), instance, 'h1', getTokenType(instance.typeId).config);

            BoardRunner.tick(100);

            expect(chooser).toBe(c.expected);
            expect(instance.alert ?? null).toBe(c.expected);
        });
    }
});

describe('the check is pure', () => {
    it('publishes nothing and notes no starvation when a flag merely considers a Token', () => {
        const instance = put(TILE, 'fixture_consumer');
        const events = [];
        const offs = [BOARD_EVENTS.TILE_EVENT_ALERT, BOARD_EVENTS.ALERT_CHANGED]
            .map(e => EventBus.subscribe(e, (p) => events.push(p)));
        try {
            expect(WorkCheck.whyCannotRun(idAt(TILE), instance, 'h1', getTokenType(instance.typeId).config)).toBe(ALERT.INPUTS);
        } finally { offs.forEach(o => o?.()); }

        expect(events).toEqual([]);
        expect(InputAllocator.getStarvationStats().fixture_consumer ?? 0).toBe(0);
    });
});
