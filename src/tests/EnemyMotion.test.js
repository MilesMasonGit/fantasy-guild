import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning, MAT_TUNABLES } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';

// The step to open space a crowded fight asks for (`FightRoom`, tested for real in
// `FightStep.test.js`), set by hand here: `aside.plans` maps an enemy to the spot it steps to.
const aside = vi.hoisted(() => ({ plans: new Map() }));
vi.mock('../systems/board/FightRoom.js', async (orig) => ({
    ...(await orig()),
    pruneSteps: () => {},
    steppingIds: () => [...aside.plans.keys()],
    stepOf: (id) => aside.plans.get(id) || null,
    finishStep: (id) => {
        const plan = aside.plans.get(id);
        if (plan) plan.done = true;
    }
}));
vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Enemies stand still: where they spawn, are placed or are dropped, whatever their camp does. The
 * only walk left is the step to open space before a crowded fight (`FightRoom`).
 */

registerTokenTypes({
    fixture_em_camp: {
        id: 'fixture_em_camp', name: 'Fixture Em Camp', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'fixture_enemy', weight: 1 }], allowance: 4, intervalMs: 1000, upkeep: [] }
    },
    fixture_em_forest: {
        id: 'fixture_em_forest', name: 'Fixture Em Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'fixture_producer', weight: 1 }], allowance: 4, intervalMs: 1000, upkeep: [] }
    }
});

const SPEED = 100;

/** Seeded random, for the spawner's rolls. */
function seeded(seed = 7) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const tick = (ms, step = 100) => { for (let t = 0; t < ms; t += step) EnemyMotion.tick(step); };
const pointOf = (t) => ({ x: t.x, y: t.y });

/** A camp at `(x, y)` and one enemy it spawned at `(ex, ey)`. */
function campWithEnemy(x = 800, y = 500, ex = x + 120, ey = y) {
    const camp = placeAt('fixture_em_camp', x, y);
    const enemy = placeAt('fixture_enemy', ex, ey);
    enemy.tether = camp.id;
    return { camp, enemy };
}

beforeEach(() => {
    resetMatTuning();
    setMatTuning('enemyWalkSpeed', SPEED);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    aside.plans.clear();
});

afterEach(() => {
    aside.plans.clear();
    resetMatTuning();
});

describe('the Mat Tuner rows', () => {
    it('ships enemy walk speed a bit slower than heroes, and no enemy wander', () => {
        const speed = MAT_TUNABLES.find(t => t.key === 'enemyWalkSpeed');
        const heroes = MAT_TUNABLES.find(t => t.key === 'walkSpeed');
        expect(speed.def).toBeLessThan(heroes.def);
        expect(MAT_TUNABLES.find(t => t.key === 'enemyPotterRadius')).toBeUndefined();
    });
});

describe('the tether (saved on the enemy)', () => {
    it('a spawner records ITS instance on every enemy it spawns', () => {
        const campA = placeAt('fixture_em_camp', 400, 400);
        placeAt('fixture_em_camp', 1200, 400);
        const landed = SpawnerSystem.attemptSpawn(campA, getTokenType('fixture_em_camp'), seeded());
        expect(landed).toBe(campA);
        const enemy = BoardState.tokens().find(t => t.typeId === 'fixture_enemy');
        expect(enemy.tether).toBe(campA.id);
        expect(EnemyMotion.tetherOf(enemy.id)).toBe(campA.id);
        expect(EnemyMotion.spawnerOf(enemy.id)).toBe(campA);
    });

    it('a spawner of anything else records no tether', () => {
        const forest = placeAt('fixture_em_forest', 400, 400);
        SpawnerSystem.attemptSpawn(forest, getTokenType('fixture_em_forest'), seeded());
        const spawned = BoardState.tokens().find(t => t.typeId === 'fixture_producer');
        expect(spawned).toBeTruthy();
        expect('tether' in spawned).toBe(false);
    });

    it('an old save attaches each enemy to the nearest spawner of its family, once', () => {
        const near = placeAt('fixture_em_camp', 600, 500);
        placeAt('fixture_em_camp', 1400, 500);
        placeAt('fixture_em_forest', 800, 500);          // nearer, but not its family
        const enemy = placeAt('fixture_enemy', 850, 520);
        delete GameState.state.board.enemyTethers;

        expect(EnemyMotion.attachUntethered()).toBe(1);
        expect(enemy.tether).toBe(near.id);
        expect(GameState.state.board.enemyTethers).toBe(1);

        // Once per board: an enemy placed by hand later is never attached.
        const byHand = placeAt('fixture_enemy', 620, 700);
        expect(EnemyMotion.attachUntethered()).toBe(0);
        tick(1000);
        expect('tether' in byHand).toBe(false);
    });

    it('an enemy with no spawner of its family stays untethered and stands still', () => {
        const enemy = placeAt('fixture_enemy', 900, 500);
        delete GameState.state.board.enemyTethers;
        tick(20000);
        expect('tether' in enemy).toBe(false);
        expect(pointOf(enemy)).toEqual({ x: 900, y: 500 });
        expect(EnemyMotion.bodyOf(enemy.id)).toBeNull();
    });

    it('an enemy whose spawner has gone stands still where it is', () => {
        const { camp, enemy } = campWithEnemy();
        BoardState.removeToken(camp.id);
        tick(20000);
        expect(pointOf(enemy)).toEqual({ x: 920, y: 500 });
    });
});

describe('⭐ an enemy stands still', () => {
    it('a camp\'s enemy stays on its spot for minutes, with no body and no walk', () => {
        const { enemy } = campWithEnemy();
        let walked = 0;
        const unsub = EventBus.subscribe(BOARD_EVENTS.ENEMIES_WALKED, () => walked++);
        try {
            tick(5 * 60 * 1000);
        } finally {
            unsub?.();
        }
        expect(pointOf(enemy)).toEqual({ x: 920, y: 500 });
        expect(EnemyMotion.bodyOf(enemy.id)).toBeNull();
        expect(EnemyMotion.isWalking(enemy.id)).toBe(false);
        expect(walked).toBe(0);
    });

    it('a new spawn stays where it appeared', () => {
        const camp = placeAt('fixture_em_camp', 800, 500);
        SpawnerSystem.attemptSpawn(camp, getTokenType('fixture_em_camp'), seeded());
        const enemy = BoardState.tokens().find(t => t.typeId === 'fixture_enemy');
        const spawnedAt = pointOf(enemy);
        tick(3 * 60 * 1000);
        expect(pointOf(enemy)).toEqual(spawnedAt);
    });

    it('a moved camp leaves its enemies where they stood', () => {
        const { camp, enemy } = campWithEnemy();
        tick(1000);
        BoardState.setTokenPoint(camp.id, 1300, 500);
        tick(60000);
        expect(pointOf(enemy)).toEqual({ x: 920, y: 500 });
        expect(enemy.tether).toBe(camp.id);
    });

    it('an enemy dropped far from its camp stays where it is dropped', () => {
        const { camp, enemy } = campWithEnemy();
        tick(500);
        Placement.moveTokenTo(enemy.id, { x: 200, y: 900 });
        const dropped = pointOf(enemy);
        expect(dist(dropped, camp)).toBeGreaterThan(400);
        tick(60000);
        expect(pointOf(enemy)).toEqual(dropped);
    });
});

describe('the step to open space for a crowded fight', () => {
    it('walks there at Enemy walk speed, then stays, after the step is let go too', () => {
        const { enemy } = campWithEnemy();
        aside.plans.set(enemy.id, { heroId: 'h1', x: 1020, y: 500, side: -1, done: false });
        tick(500);
        expect(enemy.x).toBe(970);                          // 0.5 s at 100 u/s
        expect(EnemyMotion.isWalking(enemy.id)).toBe(true);
        expect(EnemyMotion.walkFacingOf(enemy.id)).toBe(1);
        tick(1000);
        expect(pointOf(enemy)).toEqual({ x: 1020, y: 500 });
        expect(aside.plans.get(enemy.id).done).toBe(true);
        expect(EnemyMotion.isWalking(enemy.id)).toBe(false);

        aside.plans.delete(enemy.id);                       // the fight starts, or is let go
        tick(30000);
        expect(pointOf(enemy)).toEqual({ x: 1020, y: 500 });
        expect(EnemyMotion.bodyOf(enemy.id)).toBeNull();
    });

    it('an enemy with no camp steps the same way', () => {
        const enemy = placeAt('fixture_enemy', 600, 400);
        aside.plans.set(enemy.id, { heroId: 'h1', x: 600, y: 300, side: -1, done: false });
        tick(2000);
        expect(pointOf(enemy)).toEqual({ x: 600, y: 300 });
    });

    it('one huge tick walks at most MAX_STEP_MS worth: no teleport', () => {
        const { enemy } = campWithEnemy();
        aside.plans.set(enemy.id, { heroId: 'h1', x: 1500, y: 500, side: -1, done: false });
        const before = pointOf(enemy);
        EnemyMotion.tick(10 * 60 * 1000);
        expect(dist(enemy, before)).toBeLessThanOrEqual(SPEED * EnemyMotion.MAX_STEP_MS / 1000 + 1);
    });

    it('a walking tick publishes one ENEMIES_WALKED and never TILE_CHANGED or ADJACENCY_DIRTY', () => {
        const { enemy } = campWithEnemy();
        const e2 = placeAt('fixture_enemy', 420, 300);
        aside.plans.set(enemy.id, { heroId: 'h1', x: 920, y: 900, side: -1, done: false });
        aside.plans.set(e2.id, { heroId: 'h2', x: 420, y: 700, side: -1, done: false });

        const counts = {};
        const unsubs = [BOARD_EVENTS.ENEMIES_WALKED, BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.ADJACENCY_DIRTY,
            BOARD_EVENTS.HERO_MOVED, 'state_changed']
            .map(e => EventBus.subscribe(e, () => { counts[e] = (counts[e] || 0) + 1; }));
        try {
            tick(2000);                                     // 20 ticks, both walking all the way
        } finally {
            unsubs.forEach(u => u?.());
        }
        expect(counts[BOARD_EVENTS.ENEMIES_WALKED]).toBe(20);
        expect(counts[BOARD_EVENTS.TILE_CHANGED] || 0).toBe(0);
        expect(counts[BOARD_EVENTS.ADJACENCY_DIRTY] || 0).toBe(0);
        expect(counts[BOARD_EVENTS.HERO_MOVED] || 0).toBe(0);
        expect(counts.state_changed || 0).toBe(0);
    });

    it('rebuilds the neighbourhood once when a step ends, naming both ends', () => {
        const { enemy } = campWithEnemy();
        const start = pointOf(enemy);
        aside.plans.set(enemy.id, { heroId: 'h1', x: 1100, y: 500, side: -1, done: false });
        const dirty = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.ADJACENCY_DIRTY, (p) => dirty.push(p.points));
        try {
            tick(5000);
        } finally {
            unsub?.();
        }
        expect(dirty).toHaveLength(1);
        expect(dirty[0][0]).toEqual(start);
        expect(dirty[0][1]).toEqual({ x: 1100, y: 500 });
    });

    it('a step let go halfway stands where it got to, and rebuilds the neighbourhood there', () => {
        const { enemy } = campWithEnemy();
        aside.plans.set(enemy.id, { heroId: 'h1', x: 1200, y: 500, side: -1, done: false });
        tick(1000);
        const dirty = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.ADJACENCY_DIRTY, (p) => dirty.push(p.points));
        aside.plans.delete(enemy.id);
        try {
            tick(5000);
        } finally {
            unsub?.();
        }
        expect(pointOf(enemy)).toEqual({ x: 1020, y: 500 });
        expect(dirty).toEqual([[{ x: 920, y: 500 }, { x: 1020, y: 500 }]]);
    });

    it('runs on the board tick (BoardRunner.tick)', () => {
        const { enemy } = campWithEnemy();
        aside.plans.set(enemy.id, { heroId: 'h1', x: 1100, y: 500, side: -1, done: false });
        for (let i = 0; i < 20; i++) BoardRunner.tick(100);
        expect(enemy.x).toBeGreaterThan(920);
    });
});

describe('save and load', () => {
    it('keeps the tether and the point, and stands on after the load', async () => {
        const { camp, enemy } = campWithEnemy();
        BoardState.setTokenPoint(camp.id, 1300, 500);
        tick(1500);

        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        await GameState.initFromSave(migrateState(saved.state, saved.version));
        EventBus.publish('game_loaded', { slot: 0 });

        const loaded = BoardState.getTokenById(enemy.id);
        expect(loaded.tether).toBe(camp.id);
        expect(pointOf(loaded)).toEqual({ x: 920, y: 500 });
        expect(GameState.state.board.enemyTethers).toBe(1);

        tick(15000);
        expect(pointOf(loaded)).toEqual({ x: 920, y: 500 });
    });
});
