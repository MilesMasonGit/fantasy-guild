import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import { ALERT } from '../systems/board/boardEvents.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { REACH, REACHES, getReach, reachOf } from '../config/registries/reachRegistry.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * Wandering enemies cost the tick less (T-200), with the game doing exactly what it did: each block
 * counts the work a saving removes, beside the outcome it must keep.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
// Who asks BoardState which Tokens are claimed, counted: the real functions, wrapped. Calls inside
// BoardState itself are not counted (they never pass through the module's exports).
vi.mock('../systems/board/BoardState.js', async (importOriginal) => {
    const real = await importOriginal();
    return {
        ...real,
        heroOfInstance: vi.fn(real.heroOfInstance),
        claimedInstanceIds: vi.fn(real.claimedInstanceIds),
        tokens: vi.fn(real.tokens)
    };
});
// The stat block builder, counted: the real one, wrapped.
vi.mock('../config/registries/enemyProfile.js', async (importOriginal) => {
    const real = await importOriginal();
    return { ...real, enemyProfileOf: vi.fn(real.enemyProfileOf) };
});

registerTokenTypes({
    fixture_wec_camp: {
        id: 'fixture_wec_camp', name: 'Fixture Wec Camp', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'fixture_enemy', weight: 1 }], allowance: 12, intervalMs: 1000, upkeep: [] }
    },
    /** A camp of two that wants a blackberry a spawn: short of one with an empty Bank. */
    fixture_wec_hungry_camp: {
        id: 'fixture_wec_hungry_camp', name: 'Fixture Wec Hungry Camp', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: {
            spawns: [{ typeId: 'fixture_enemy', weight: 1 }], allowance: 2, intervalMs: 1000,
            upkeep: [{ itemId: 'item_blackberry', quantity: 1 }]
        }
    }
});

/** A camp at `(x, y)` with `n` enemies of its own standing round it. */
function campWithEnemies(n, x = 800, y = 500) {
    const camp = placeAt('fixture_wec_camp', x, y);
    const enemies = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const enemy = placeAt('fixture_enemy', Math.round(x + 120 * Math.cos(a)), Math.round(y + 120 * Math.sin(a)));
        enemy.tether = camp.id;
        enemies.push(enemy);
    }
    return { camp, enemies };
}

/** Seeded random, so strolls are repeatable. */
function seeded(seed = 7) {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    return hero;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [makeHero('hero_1')];
    enemyProfileOf.mockClear();
    BoardState.heroOfInstance.mockClear();
    BoardState.claimedInstanceIds.mockClear();
    SpawnerSystem.resetAlerts();
    resetMatTuning();
    setMatTuning('enemyWalkSpeed', 100);
    setMatTuning('enemyPotterRadius', 128);
    EnemyMotion.setRandomForTests(seeded());
});

afterEach(() => {
    EnemyMotion.setRandomForTests();
    resetMatTuning();
});

describe('an enemy nobody fights builds no stat block', () => {
    it('ticking an unfought enemy never derives its profile', () => {
        const enemy = placeAt('fixture_enemy', 600, 400);
        for (let i = 0; i < 50; i++) BoardCombat.tickToken(enemy, 100, null);
        expect(BoardCombat.getFight(enemy.id)).toBeNull();
        expect(enemyProfileOf).not.toHaveBeenCalled();
    });

    it('a fight still ends the tick its hero is gone', () => {
        const enemy = placeAt('fixture_enemy', 600, 400);
        BoardCombat.tickToken(enemy, 100, 'hero_1');
        expect(BoardCombat.getFight(enemy.id)).not.toBeNull();
        BoardCombat.tickToken(enemy, 100, null);
        expect(BoardCombat.getFight(enemy.id)).toBeNull();
    });

    it('a fight still derives the profile every tick it runs', () => {
        const enemy = placeAt('fixture_enemy', 600, 400);
        for (let i = 0; i < 5; i++) BoardCombat.tickToken(enemy, 100, 'hero_1');
        expect(enemyProfileOf).toHaveBeenCalledTimes(5);
        expect(BoardState.getTokenById(enemy.id)).toBe(enemy);
    });
});

describe('a tick of pottering reads what every step shares once', () => {
    it('asks for the claimed Tokens once a tick, never once an enemy', () => {
        campWithEnemies(10);
        for (let i = 0; i < 20; i++) EnemyMotion.tick(100);
        expect(BoardState.claimedInstanceIds).toHaveBeenCalledTimes(20);
        expect(BoardState.heroOfInstance).not.toHaveBeenCalled();
    });

    it('a claimed enemy still holds still, and walks on once let go', () => {
        const { camp, enemies } = campWithEnemies(1);
        const [enemy] = enemies;
        EnemyMotion.tick(100);
        BoardState.setTokenPoint(camp.id, 1300, 500);
        BoardState.setClaim('hero_1', { instanceId: enemy.id, typeId: enemy.typeId, x: enemy.x, y: enemy.y });
        const held = { x: enemy.x, y: enemy.y };
        for (let i = 0; i < 10; i++) EnemyMotion.tick(100);
        expect({ x: enemy.x, y: enemy.y }).toEqual(held);
        expect(EnemyMotion.isWalking(enemy.id)).toBe(false);
        BoardState.setClaim('hero_1', null);
        for (let i = 0; i < 10; i++) EnemyMotion.tick(100);
        expect(enemy.x).toBeGreaterThan(held.x);
    });

    it('an enemy taken off the mat loses its body the next tick', () => {
        const { enemies } = campWithEnemies(3);
        EnemyMotion.tick(100);
        expect(EnemyMotion.bodyOf(enemies[1].id)).not.toBeNull();
        BoardState.removeToken(enemies[1].id);
        EnemyMotion.tick(100);
        expect(EnemyMotion.bodyOf(enemies[1].id)).toBeNull();
        expect(EnemyMotion.bodyOf(enemies[0].id)).not.toBeNull();
    });
});

describe('a step carries its pinned flag and its claim, nothing else', () => {
    it('moves the flag pinned to the Token and the claim on it; other flags stay', () => {
        const a = placeAt('fixture_producer', 400, 300);
        const b = placeAt('fixture_producer', 800, 300);
        BoardState.setFlag('hero_1', { x: 400, y: 300, plantedAt: 0, pinnedTo: a.id });
        BoardState.setFlag('hero_2', { x: 800, y: 300, plantedAt: 1, pinnedTo: b.id });
        BoardState.setFlag('hero_3', { x: 600, y: 600, plantedAt: 2 });
        BoardState.setClaim('hero_1', { instanceId: a.id, typeId: a.typeId, x: 400, y: 300 });
        BoardState.setClaim('hero_2', { instanceId: b.id, typeId: b.typeId, x: 800, y: 300 });

        expect(BoardState.setTokenPoint(a.id, 450, 320)).toBe(true);

        expect(BoardState.flagOf('hero_1')).toMatchObject({ x: 450, y: 320, pinnedTo: a.id });
        expect(BoardState.claimOfHero('hero_1')).toMatchObject({ x: 450, y: 320 });
        expect(BoardState.flagOf('hero_2')).toMatchObject({ x: 800, y: 300 });
        expect(BoardState.claimOfHero('hero_2')).toMatchObject({ x: 800, y: 300 });
        expect(BoardState.flagOf('hero_3')).toMatchObject({ x: 600, y: 600 });
    });
});

describe('the spawner alerts count what every camp spawned in one pass', () => {
    /** Camp `i` of five, in a row, with `own` of its spawned enemies and `stray` other Tokens tethered to it. */
    function hungryCamp(i, own, stray = 0) {
        const camp = placeAt('fixture_wec_hungry_camp', 300 + i * 300, 400);
        for (let k = 0; k < own; k++) placeAt('fixture_enemy', camp.x - 60 + k * 120, 600).tether = camp.id;
        for (let k = 0; k < stray; k++) placeAt('fixture_producer', camp.x, 800 + k * 160).tether = camp.id;
        return camp;
    }

    it('a camp at its cap raises nothing; one short of it says it needs its upkeep', () => {
        const full = hungryCamp(0, 2);
        const short = hungryCamp(1, 1, 2);   // two Tokens of another family tied to it do not count
        const empty = hungryCamp(2, 0);
        SpawnerSystem.syncAlerts();
        expect(SpawnerSystem.spawnerAlertOf(full.id)).toBeNull();
        expect(SpawnerSystem.spawnerAlertOf(short.id)).toEqual({ alert: ALERT.SPAWN_NEEDS_ITEM, needs: ['item_blackberry'] });
        expect(SpawnerSystem.spawnerAlertOf(empty.id)).toEqual({ alert: ALERT.SPAWN_NEEDS_ITEM, needs: ['item_blackberry'] });
        // The same counts the badge reads one camp at a time.
        expect(SpawnerSystem.spawnerCounts(full.id)).toEqual({ count: 2, cap: 2 });
        expect(SpawnerSystem.spawnerCounts(short.id)).toEqual({ count: 1, cap: 2 });
        expect(SpawnerSystem.spawnerCounts(empty.id)).toEqual({ count: 0, cap: 2 });
    });

    it('one pass over the mat for the camps, however many there are', () => {
        for (let i = 0; i < 5; i++) hungryCamp(i, i % 3);
        SpawnerSystem.syncAlerts();                       // the census settles
        BoardState.tokens.mockClear();
        SpawnerSystem.syncAlerts();
        expect(BoardState.tokens.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('asking whether a camp is full walks nothing until the mat changes, then one walk', () => {
        const camps = [];
        for (let i = 0; i < 5; i++) camps.push(hungryCamp(i, 2));
        const def = getTokenType('fixture_wec_hungry_camp');
        const askAll = () => {
            for (let tick = 0; tick < 50; tick++) {
                for (const camp of camps) SpawnerSystem.isFullEnemyCamp(camp, def);
            }
        };
        askAll();                                         // the census settles
        BoardState.tokens.mockClear();
        askAll();
        expect(BoardState.tokens).not.toHaveBeenCalled();
        for (const camp of camps) expect(SpawnerSystem.isFullEnemyCamp(camp, def)).toBe(true);

        const beaten = BoardState.tokens().find(t => t.tether === camps[0].id);
        BoardState.removeToken(beaten.id);
        BoardState.tokens.mockClear();
        askAll();
        expect(BoardState.tokens).toHaveBeenCalledTimes(1);
        expect(SpawnerSystem.isFullEnemyCamp(camps[0], def)).toBe(false);
        expect(SpawnerSystem.isFullEnemyCamp(camps[1], def)).toBe(true);
    });
});

describe('a rule’s reach is looked up by id, with the same answers', () => {
    it('every declared reach is its own row; anything else is none', () => {
        for (const row of REACHES) expect(getReach(row.id)).toBe(row);
        for (const junk of [undefined, null, '', 'adjacent', 'the_whole_kingdom', 0, '__proto__', 'toString']) {
            expect(getReach(junk)).toBeNull();
        }
    });

    it('reachOf keeps the old ids and falls back to nearby', () => {
        expect(reachOf({ reach: 'adjacent' })).toBe(REACH.NEARBY);
        expect(reachOf({ reach: 'self_and_adjacent' })).toBe(REACH.SELF_AND_NEARBY);
        expect(reachOf({ reach: REACH.BOARD })).toBe(REACH.BOARD);
        expect(reachOf({ reach: 'toString' })).toBe(REACH.NEARBY);
        expect(reachOf(undefined)).toBe(REACH.NEARBY);
    });
});
