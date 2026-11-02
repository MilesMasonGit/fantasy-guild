import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
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
        claimedInstanceIds: vi.fn(real.claimedInstanceIds)
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
