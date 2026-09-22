import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ **Enemies wander** (Enemy Wandering slice EW-A,
 * `docs/enemy_wandering_roadmap_v1.md`). Combat itself is untouched in this
 * slice — these tests are only about where an enemy's body ends up.
 */

const RADIUS = 200;
const SPEED = 60;

function put(point, typeId = 'fixture_enemy') {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, point);
    return instance;
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };

beforeAll(() => Flags.init());
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    resetMatTuning();
    setMatTuning('enemyTravelRadius', RADIUS);
    setMatTuning('enemyWanderSpeed', SPEED);
    setMatTuning('potterRadius', 0);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    for (const t of BoardState.tokens()) BoardState.removeToken(t.id);
    GameState.state.heroes = [];
});

afterEach(() => {
    EnemyMotion.setRandomForTests();
});

describe('⭐ an enemy wanders within its travel area (EW-4)', () => {
    it('never strays further than the travel radius from its own spot', () => {
        const spot = { x: 500, y: 500 };
        const enemy = put(spot);
        // Always picks the farthest possible point, in a different direction
        // each pause, to stress the boundary as hard as possible.
        let n = 0;
        EnemyMotion.setRandomForTests(() => (n++ % 2 === 0 ? 0.999 : (n % 8) / 8));

        for (let i = 0; i < 50; i++) {
            run(4000);
            const body = BoardState.enemyBodyOf(enemy.id);
            const dist = Math.hypot(body.x - spot.x, body.y - spot.y);
            expect(dist).toBeLessThanOrEqual(RADIUS + 0.5);
        }
    });

    it('actually moves over time, not just sits still', () => {
        const spot = { x: 500, y: 500 };
        const enemy = put(spot);
        EnemyMotion.setRandomForTests(() => 0.5);

        // Worst-case pause is 6000ms (PAUSE_MS.max); run well past it.
        run(9000);
        const body = BoardState.enemyBodyOf(enemy.id);
        expect(Math.hypot(body.x - spot.x, body.y - spot.y)).toBeGreaterThan(0);
    });

    it('stands still when the travel radius is 0', () => {
        setMatTuning('enemyTravelRadius', 0);
        const spot = { x: 500, y: 500 };
        const enemy = put(spot);
        EnemyMotion.setRandomForTests(() => 0.5);

        run(10000);
        const body = BoardState.enemyBodyOf(enemy.id);
        expect(body.x).toBe(spot.x);
        expect(body.y).toBe(spot.y);
    });

    it('does not publish ENEMIES_WALKED when nothing moved', () => {
        setMatTuning('enemyTravelRadius', 0);
        put({ x: 500, y: 500 });
        const spy = vi.fn();
        const unsub = EventBus.subscribe(BOARD_EVENTS.ENEMIES_WALKED, spy);
        run(1000);
        unsub();
        expect(spy).not.toHaveBeenCalled();
    });
});

describe('⭐ a fought enemy holds still (EWP-4)', () => {
    it('freezes the moment a hero claims it, and tracks the Token exactly', () => {
        const spot = { x: 500, y: 500 };
        const enemy = put(spot);
        EnemyMotion.setRandomForTests(() => 0.5);
        run(9000);
        const before = { ...BoardState.enemyBodyOf(enemy.id) };
        expect(before.x !== spot.x || before.y !== spot.y).toBe(true);

        BoardState.setClaim('h1', { instanceId: enemy.id, typeId: enemy.typeId, x: spot.x, y: spot.y });
        run(3000);

        const body = BoardState.enemyBodyOf(enemy.id);
        expect(body.x).toBe(spot.x);
        expect(body.y).toBe(spot.y);
    });

    it('resumes wandering once the claim is released', () => {
        const spot = { x: 500, y: 500 };
        const enemy = put(spot);
        BoardState.setClaim('h1', { instanceId: enemy.id, typeId: enemy.typeId, x: spot.x, y: spot.y });
        run(1000);

        BoardState.setClaim('h1', null);
        EnemyMotion.setRandomForTests(() => 0.5);
        run(9000);

        const body = BoardState.enemyBodyOf(enemy.id);
        expect(Math.hypot(body.x - spot.x, body.y - spot.y)).toBeGreaterThan(0);
    });
});

describe('⭐ the travel area follows the Token, not the other way round (EWP-1, EWP-5)', () => {
    it('recentres at once when the Token is moved externally', () => {
        const spot = { x: 500, y: 500 };
        const enemy = put(spot);
        EnemyMotion.setRandomForTests(() => 0.5);
        run(3000);

        const newSpot = { x: 900, y: 300 };
        Placement.moveTokenTo(enemy.id, newSpot);
        run(100);

        const body = BoardState.enemyBodyOf(enemy.id);
        expect(body.x).toBe(newSpot.x);
        expect(body.y).toBe(newSpot.y);
    });
});

describe('⭐ housekeeping', () => {
    it('drops the body of an enemy that left the mat', () => {
        const enemy = put({ x: 500, y: 500 });
        run(100);
        expect(BoardState.enemyBodyOf(enemy.id)).not.toBeNull();

        BoardState.removeToken(enemy.id);
        run(100);
        expect(BoardState.enemyBodyOf(enemy.id)).toBeNull();
    });

    it('leaves a non-enemy Token alone', () => {
        const instance = BoardState.createTokenInstance('fixture_producer', tokenStartingUses('fixture_producer'));
        Placement.placeTokenAt(instance, { x: 400, y: 400 });
        run(1000);
        expect(BoardState.enemyBodyOf(instance.id)).toBeNull();
    });
});
