import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
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
// The stat block builder, counted: the real one, wrapped.
vi.mock('../config/registries/enemyProfile.js', async (importOriginal) => {
    const real = await importOriginal();
    return { ...real, enemyProfileOf: vi.fn(real.enemyProfileOf) };
});

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
