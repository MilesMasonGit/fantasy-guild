import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * The publish stays for its UI subscribers.
 */

const WORKED_BUFF = 'fixture_cr250_worked_buff';

registerTokenTypes({
    [WORKED_BUFF]: {
        id: WORKED_BUFF, name: 'CR3-250 Worked Buff', tokenType: 'buff', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 'skill_occult',
        statements: [{
            id: 'stm_cr250_worked_buff', keyword: 'provides',
            to: { mode: 'all', filters: [{ kind: 'worked' }] },
            payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.05 }
        }]
    }
});

function hero(id, skills = { forestry: 50 }) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 50, skills: out, hp: { current: 100, max: 100 } };
}

function put(point, typeId = 'fixture_producer') {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
const yieldOf = (instance) => TileModifiers.resolveAxis(instance.id, EFFECT_TYPES.YIELD, 100);

/** How many Token aggregators a call rebuilt (each rebuild clears one first). */
function rebuildsDuring(fn) {
    const spy = vi.spyOn(ModifierAggregator.prototype, 'clearAll');
    try {
        fn();
        return spy.mock.calls.length;
    } finally {
        spy.mockRestore();
    }
}

beforeAll(() => {
    Flags.init();
    TileModifiers.init();
});
afterAll(() => {
    Flags.teardown();
    TileModifiers.teardown();
    resetMatTuning();
});

beforeEach(() => {
    resetMatTuning();
    setMatTuning('flagRadius', 400);
    setMatTuning('potterRadius', 0);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    for (const t of BoardState.tokens()) BoardState.removeToken(t.id);
    GameState.state.heroes = [hero('h1')];
    GameState.state.inventory.maxSlots = 50;
});

afterEach(() => {
    BoardState.setInstantArrival(true);
    HeroMotion.setRandomForTests();
});

describe('⭐ CR3-250: a HERO_MOVED rebuilds only when the Token a hero works changed', () => {
    it('a hero ARRIVING on a pinned flag switches on a `being worked` buff, though their point did not change', () => {
        BoardState.setInstantArrival(false);
        setMatTuning('walkSpeed', 120);
        // A Guild Hall far off, so the hero walks out of it to the Token (M3).
        BoardState.addToken(BoardState.createTokenInstance('token_guild_hall', null), 300, 500);
        const work = put({ x: 900, y: 500 });
        put({ x: 1060, y: 500 }, WORKED_BUFF);
        TileModifiers.rebuildAll();

        expect(Flags.plant('h1', { x: 900, y: 500 }, { pin: true }).success).toBe(true);
        // Pinned: the flag stands on the Token's centre, the hero is walking.
        expect(BoardState.displayPointOf('h1')).toEqual({ x: 900, y: 500 });
        expect(BoardState.workerOf(work.id)).toBeNull();
        expect(yieldOf(work)).toBeCloseTo(100);

        run(10000);
        expect(BoardState.workerOf(work.id)).toBe('h1');
        expect(BoardState.displayPointOf('h1'), 'same point as before arriving').toEqual({ x: 900, y: 500 });
        expect(yieldOf(work), 'the arrival did not switch the buff on').toBeCloseTo(105);
    });

    it('the Token they worked leaving the mat (a kill, a last charge) rebuilds nothing for the hero', () => {
        const work = put({ x: 900, y: 500 });
        put({ x: 1060, y: 500 });
        put({ x: 740, y: 500 }, WORKED_BUFF);
        TileModifiers.rebuildAll();
        expect(Flags.plant('h1', { x: 900, y: 500 }).success).toBe(true);
        expect(BoardState.workerOf(work.id)).toBe('h1');
        expect(yieldOf(work)).toBeCloseTo(105);

        // The remover rebuilds around the spot itself (ADJACENCY_DIRTY); the
        // hero now works nothing, so no Token's worker changed.
        BoardState.removeToken(work.id);
        expect(BoardState.workTokenOf('h1')).toBeNull();
        expect(rebuildsDuring(() => EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId: 'h1' }))).toBe(0);
    });

    it('a hero who starts or stops working a Token on the mat still rebuilds', () => {
        const work = put({ x: 900, y: 500 });
        put({ x: 740, y: 500 }, WORKED_BUFF);
        TileModifiers.rebuildAll();

        expect(rebuildsDuring(() => Flags.plant('h1', { x: 900, y: 500 }))).toBeGreaterThan(0);
        expect(yieldOf(work)).toBeCloseTo(105);

        expect(rebuildsDuring(() => Flags.furl('h1'))).toBeGreaterThan(0);
        expect(BoardState.workerOf(work.id)).toBeNull();
        expect(yieldOf(work)).toBeCloseTo(100);
    });

    it('clearAll (before a rehydrate) forgets what each hero worked, so the next event rebuilds', () => {
        put({ x: 900, y: 500 });
        put({ x: 740, y: 500 }, WORKED_BUFF);
        expect(Flags.plant('h1', { x: 900, y: 500 }).success).toBe(true);
        expect(rebuildsDuring(() => EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId: 'h1' }))).toBe(0);

        TileModifiers.clearAll();
        expect(rebuildsDuring(() => EventBus.publish(BOARD_EVENTS.HERO_MOVED, { heroId: 'h1' }))).toBeGreaterThan(0);
    });
});
