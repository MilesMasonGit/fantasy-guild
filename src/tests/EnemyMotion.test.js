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
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning, MAT_TUNABLES } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * B7.1 — **enemies move, tethered to their spawner** (owner's "B7 range"). A
 * small camp's art radius is 64 u, so with the default wander of 128 u an
 * enemy potters between 64 u and 192 u from the camp's centre.
 */

registerTokenTypes({
    fixture_em_camp: {
        id: 'fixture_em_camp', name: 'Fixture Em Camp', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: { spawns: [{ typeId: 'fixture_enemy', weight: 1 }], allowance: 4, intervalMs: 1000, upkeep: [] }
    },
    fixture_em_forest: {
        id: 'fixture_em_forest', name: 'Fixture Em Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: { spawns: [{ typeId: 'fixture_producer', weight: 1 }], allowance: 4, intervalMs: 1000, upkeep: [] }
    }
});

const SPEED = 100;
const R = 128;
const INNER = 64;

/** Seeded random, so strolls are repeatable. */
function seeded(seed = 7) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const tick = (ms, step = 100) => { for (let t = 0; t < ms; t += step) EnemyMotion.tick(step); };

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
    setMatTuning('enemyPotterRadius', R);
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    EnemyMotion.setRandomForTests(seeded());
});

afterEach(() => {
    EnemyMotion.setRandomForTests();
    resetMatTuning();
});

describe('the Mat Tuner rows', () => {
    it('ships enemy walk speed a bit slower than heroes, and wander of about one Token width', () => {
        const speed = MAT_TUNABLES.find(t => t.key === 'enemyWalkSpeed');
        const wander = MAT_TUNABLES.find(t => t.key === 'enemyPotterRadius');
        const heroes = MAT_TUNABLES.find(t => t.key === 'walkSpeed');
        expect(speed.def).toBeLessThan(heroes.def);
        expect(wander.def).toBe(128);
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
        expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 900, y: 500 });
        expect(EnemyMotion.bodyOf(enemy.id)).toBeNull();
    });

    it('an enemy whose spawner has gone stands still where it is', () => {
        const { camp, enemy } = campWithEnemy();
        BoardState.removeToken(camp.id);
        tick(20000);
        expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 920, y: 500 });
    });
});

describe('pottering (HM-1, for enemies)', () => {
    it('strolls about but stays within the ring round its spawner, over many ticks', () => {
        const { camp, enemy } = campWithEnemy();
        const seen = new Set();
        let farthest = 0;
        for (let i = 0; i < 1200; i++) {        // two minutes
            EnemyMotion.tick(100);
            farthest = Math.max(farthest, dist(enemy, camp));
            seen.add(`${enemy.x},${enemy.y}`);
        }
        expect(seen.size).toBeGreaterThan(20);                    // it really moved
        expect(farthest).toBeLessThanOrEqual(INNER + R + 1);       // rounding
    });

    it('keeps whole-number centres on the Token (nearby.js relies on exact ties)', () => {
        const { enemy } = campWithEnemy();
        tick(15000);
        expect(Number.isInteger(enemy.x)).toBe(true);
        expect(Number.isInteger(enemy.y)).toBe(true);
    });

    it('with wander 0 it never strolls', () => {
        setMatTuning('enemyPotterRadius', 0);
        const { enemy } = campWithEnemy(800, 500, 850, 500);        // 50 u out: inside the edge
        tick(30000);
        expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 850, y: 500 });
    });
});

describe('following and walking back (TL-16)', () => {
    it('walks over to a moved spawner rather than jumping', () => {
        const { camp, enemy } = campWithEnemy();
        tick(100);
        const before = { x: enemy.x, y: enemy.y };
        BoardState.setTokenPoint(camp.id, 1300, 500);
        tick(100);
        // One tick at full speed (it is outside the ring now): ≤ 10 u.
        expect(dist(enemy, before)).toBeLessThanOrEqual(SPEED * 0.1 + 1);
        expect(EnemyMotion.isWalking(enemy.id)).toBe(true);
        tick(12000);
        expect(dist(enemy, camp)).toBeLessThanOrEqual(INNER + R + 1);
    });

    it('walks back after the player drops it far away', () => {
        const { camp, enemy } = campWithEnemy();
        tick(500);
        Placement.moveTokenTo(enemy.id, { x: 200, y: 900 });
        const dropped = { x: enemy.x, y: enemy.y };
        expect(dist(dropped, camp)).toBeGreaterThan(INNER + R);

        tick(1000);
        expect(dist(enemy, camp)).toBeLessThan(dist(dropped, camp));
        expect(dist(enemy, dropped)).toBeCloseTo(SPEED, -1);        // 1 s at full speed
        tick(15000);
        expect(dist(enemy, camp)).toBeLessThanOrEqual(INNER + R + 1);
    });

    it('a drop inside the ring is kept: it stays there, then potters on', () => {
        const { camp, enemy } = campWithEnemy();
        Placement.moveTokenTo(enemy.id, { x: camp.x, y: camp.y + 170 });
        const dropped = { x: enemy.x, y: enemy.y };
        expect(dist(dropped, camp)).toBeLessThanOrEqual(INNER + R);
        EnemyMotion.tick(100);
        expect({ x: enemy.x, y: enemy.y }).toEqual(dropped);
    });

    it('does not move while it is in the player’s hand', () => {
        const { camp, enemy } = campWithEnemy();
        BoardState.setTokenPoint(camp.id, 1300, 500);
        TimedChanges.setInHand(enemy.id, true);
        try {
            tick(3000);
            expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 920, y: 500 });
        } finally {
            TimedChanges.setInHand(enemy.id, false);
        }
    });
});

describe('not while fighting', () => {
    function fighter(id) {
        const hero = generateHero({ name: id });
        hero.id = id;
        hero.status = 'idle';
        hero.hp = { current: 100, max: 100 };
        hero.skills.melee = { level: 50, xp: 0 };
        return hero;
    }

    it('holds still in a fight, and moves again when it ends', () => {
        GameState.state.heroes = [fighter('h1')];
        const { camp, enemy } = campWithEnemy();
        BoardCombat.tickToken(enemy, 100, 'h1');
        expect(BoardCombat.getFight(enemy.id)).toBeTruthy();

        BoardState.setTokenPoint(camp.id, 1300, 500);           // its spawner walks off
        tick(5000);
        expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 920, y: 500 });
        expect(EnemyMotion.isWalking(enemy.id)).toBe(false);

        BoardCombat.endFight(enemy.id);
        tick(1000);
        expect(enemy.x).toBeGreaterThan(920);
    });

    it('holds still while a hero has claimed it and is walking up', () => {
        const { camp, enemy } = campWithEnemy();
        BoardState.setClaim('h1', { instanceId: enemy.id, typeId: enemy.typeId, x: enemy.x, y: enemy.y });
        BoardState.setTokenPoint(camp.id, 1300, 500);
        tick(3000);
        expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 920, y: 500 });
        BoardState.setClaim('h1', null);
    });
});

describe('engine rules', () => {
    it('one huge tick walks at most MAX_STEP_MS worth — no teleport', () => {
        const { camp, enemy } = campWithEnemy();
        EnemyMotion.tick(100);
        BoardState.setTokenPoint(camp.id, 1500, 500);
        const before = { x: enemy.x, y: enemy.y };
        EnemyMotion.tick(10 * 60 * 1000);                    // ten minutes in one tick
        expect(dist(enemy, before)).toBeLessThanOrEqual(SPEED * EnemyMotion.MAX_STEP_MS / 1000 + 1);
        expect(dist(enemy, camp)).toBeGreaterThan(INNER + R);
    });

    it('a walking tick publishes one ENEMIES_WALKED and never TILE_CHANGED or ADJACENCY_DIRTY', () => {
        const { camp } = campWithEnemy();
        const c2 = placeAt('fixture_em_camp', 300, 300);
        const e2 = placeAt('fixture_enemy', 420, 300);
        e2.tether = c2.id;
        EnemyMotion.tick(100);
        BoardState.setTokenPoint(camp.id, 1500, 500);
        BoardState.setTokenPoint(c2.id, 300, 1000);

        const counts = {};
        const unsubs = [BOARD_EVENTS.ENEMIES_WALKED, BOARD_EVENTS.TILE_CHANGED, BOARD_EVENTS.ADJACENCY_DIRTY,
            BOARD_EVENTS.HERO_MOVED, 'state_changed']
            .map(e => EventBus.subscribe(e, () => { counts[e] = (counts[e] || 0) + 1; }));
        try {
            // Two enemies walking for 2 s, both far from home: 20 ticks.
            tick(2000);
        } finally {
            unsubs.forEach(u => u?.());
        }
        expect(counts[BOARD_EVENTS.ENEMIES_WALKED]).toBe(20);
        expect(counts[BOARD_EVENTS.TILE_CHANGED] || 0).toBe(0);
        expect(counts[BOARD_EVENTS.ADJACENCY_DIRTY] || 0).toBe(0);
        expect(counts[BOARD_EVENTS.HERO_MOVED] || 0).toBe(0);
        expect(counts.state_changed || 0).toBe(0);
    });

    it('rebuilds the neighbourhood once when a walk ends, naming both ends', () => {
        const { camp, enemy } = campWithEnemy();
        EnemyMotion.tick(100);
        BoardState.setTokenPoint(camp.id, 1100, 500);
        const start = { x: enemy.x, y: enemy.y };
        const dirty = [];
        const unsub = EventBus.subscribe(BOARD_EVENTS.ADJACENCY_DIRTY, (p) => dirty.push(p.points));
        try {
            while (!dirty.length) EnemyMotion.tick(100);
        } finally {
            unsub?.();
        }
        expect(dirty).toHaveLength(1);
        expect(dirty[0][0]).toEqual(start);
        expect(dirty[0][1]).toEqual({ x: enemy.x, y: enemy.y });
    });

    it('runs on the board tick (BoardRunner.tick)', () => {
        const { camp, enemy } = campWithEnemy();
        BoardState.setTokenPoint(camp.id, 1300, 500);
        for (let i = 0; i < 20; i++) BoardRunner.tick(100);
        expect(enemy.x).toBeGreaterThan(920);
    });
});

describe('save and load', () => {
    it('keeps the tether and the point, and walks on after the load', async () => {
        const { camp, enemy } = campWithEnemy();
        BoardState.setTokenPoint(camp.id, 1300, 500);
        tick(1500);
        const at = { x: enemy.x, y: enemy.y };

        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        await GameState.initFromSave(migrateState(saved.state, saved.version));
        EventBus.publish('game_loaded', { slot: 0 });

        const loaded = BoardState.getTokenById(enemy.id);
        expect(loaded.tether).toBe(camp.id);
        expect({ x: loaded.x, y: loaded.y }).toEqual(at);
        expect(GameState.state.board.enemyTethers).toBe(1);

        tick(15000);
        expect(dist(loaded, BoardState.getTokenById(camp.id))).toBeLessThanOrEqual(INNER + R + 1);
    });
});
