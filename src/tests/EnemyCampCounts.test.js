import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getSpawnerKindCounts } from '../systems/core/DevTools.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Each enemy camp counts its own enemies (owner 2026-10-29): what it spawned (the Tokens tethered to
 * it) against its own allowance, never a cap shared across the mat with every camp of its kind.
 */

const INTERVAL = 3000;

registerTokenTypes({
    fixture_ec_den: {
        id: 'fixture_ec_den', name: 'Fixture Ec Den', tokenType: 'spawner',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'fixture_enemy', weight: 1 }], allowance: 2, intervalMs: INTERVAL, upkeep: [] }
    },
    /** A camp that spawns an enemy or a plain Token: both are what it spawned. */
    fixture_ec_mixed: {
        id: 'fixture_ec_mixed', name: 'Fixture Ec Mixed', tokenType: 'spawner',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_crime',
        spawner: {
            spawns: [{ typeId: 'fixture_enemy', weight: 1 }, { typeId: 'fixture_passive', weight: 1 }],
            allowance: 4, intervalMs: 1000, upkeep: []
        }
    },
    /** A plain spawner of the mixed camp's plain Token: its cap is its own allowance only. */
    fixture_ec_pile: {
        id: 'fixture_ec_pile', name: 'Fixture Ec Pile', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'fixture_passive', weight: 1 }], allowance: 1, intervalMs: 1000, upkeep: [] }
    }
});

const DEN = () => getTokenType('fixture_ec_den');

/** Many small engine ticks, through `BoardRunner`: the path the game takes. */
const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

const own = (camp) => BoardState.tokens().filter(t => t.tether === camp.id);

/** Two dens far apart, each filled to its allowance through the real spawn. */
function twoFullDens() {
    const a = placeAt('fixture_ec_den', 500, 500);
    const b = placeAt('fixture_ec_den', 1300, 500);
    for (let i = 0; i < 2; i++) {
        expect(SpawnerSystem.attemptSpawn(a, DEN())).toBe(a);
        expect(SpawnerSystem.attemptSpawn(b, DEN())).toBe(b);
    }
    expect(own(a)).toHaveLength(2);
    expect(own(b)).toHaveLength(2);
    return { a, b };
}

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    GameState.state.heroes = [];
    clearMat();
    SpawnerSystem.resetAlerts();
});

afterEach(() => {
    TriggerSystem.teardown();
    TileModifiers.teardown();
    resetMatTuning();
});

describe('⭐ each enemy camp counts only what it spawned', () => {
    it('two dens of one enemy: each against its own allowance, never a shared cap', () => {
        const { a, b } = twoFullDens();
        for (const t of own(b)) BoardState.removeToken(t.id);

        expect(SpawnerSystem.spawnerCounts(a.id)).toEqual({ count: 2, cap: 2 });
        expect(SpawnerSystem.spawnerCounts(b.id)).toEqual({ count: 0, cap: 2 });
        expect(SpawnerSystem.isFullEnemyCamp(a, DEN())).toBe(true);
        expect(SpawnerSystem.isFullEnemyCamp(b, DEN())).toBe(false);

        // The full den does not take the cleared one's room.
        expect(SpawnerSystem.attemptSpawn(a, DEN())).toBe(null);
        expect(SpawnerSystem.attemptSpawn(b, DEN())).toBe(b);
        expect(own(a)).toHaveLength(2);
        expect(own(b)).toHaveLength(1);
    });

    it('⭐ a cleared den refills its own enemies on its own clock while the other den stands full', () => {
        const { a, b } = twoFullDens();
        for (const t of own(b)) BoardState.removeToken(t.id);

        run(INTERVAL * 2 + 500);
        expect(own(a)).toHaveLength(2);
        expect(own(b)).toHaveLength(2);
        expect(SpawnerSystem.spawnerStatus(b.id)).toMatchObject({ state: 'at_cap', count: 2, cap: 2 });
    });

    it('an enemy placed by hand, or one whose den is gone, counts toward no den', () => {
        const { a, b } = twoFullDens();
        run(100);                                  // the board's one-off attach has run
        placeAt('fixture_enemy', 560, 560);        // by hand, beside den A
        BoardState.removeToken(b.id);              // B's two enemies stay, tethered to nothing live

        expect(SpawnerSystem.spawnerCounts(a.id)).toEqual({ count: 2, cap: 2 });
        for (const t of own(a)) BoardState.removeToken(t.id);
        expect(SpawnerSystem.spawnerCounts(a.id)).toEqual({ count: 0, cap: 2 });
        expect(SpawnerSystem.attemptSpawn(a, DEN())).toBe(a);
    });

    it('a den over its own allowance spawns nothing until it is under, removes nothing, and the other fills its own', () => {
        const a = placeAt('fixture_ec_den', 500, 500);
        const b = placeAt('fixture_ec_den', 1300, 500);
        for (let i = 0; i < 4; i++) {
            const e = placeAt('fixture_enemy', 420 + i * 60, 620);
            e.tether = a.id;
        }
        GameState.state.board.enemyTethers = 1;

        run(INTERVAL * 3 + 500);
        expect(own(a)).toHaveLength(4);
        expect(own(b)).toHaveLength(2);
        expect(SpawnerSystem.spawnerStatus(a.id)).toMatchObject({ state: 'at_cap', count: 4, cap: 2 });
    });

    it('a camp counts everything it spawned, an enemy or not, and stops at its allowance', () => {
        const camp = placeAt('fixture_ec_mixed', 800, 500);
        const def = getTokenType('fixture_ec_mixed');
        // The pick alternates enemy, plain Token, enemy, plain Token.
        let k = 0;
        const alternate = () => ((k++ % 2) ? 0.9 : 0.1);
        for (let i = 0; i < 4; i++) expect(SpawnerSystem.attemptSpawn(camp, def, alternate)).toBe(camp);
        expect(own(camp).map(t => t.typeId).sort()).toEqual(['fixture_enemy', 'fixture_enemy', 'fixture_passive', 'fixture_passive']);
        expect(SpawnerSystem.spawnerCounts(camp.id)).toEqual({ count: 4, cap: 4 });
        expect(SpawnerSystem.attemptSpawn(camp, def, alternate)).toBe(null);
        run(20_000);
        expect(own(camp)).toHaveLength(4);
    });

    it('an enemy camp adds nothing to another spawner’s family cap', () => {
        placeAt('fixture_ec_mixed', 500, 500);
        const pile = placeAt('fixture_ec_pile', 1300, 500);
        expect(SpawnerSystem.spawnerCounts(pile.id)).toEqual({ count: 0, cap: 1 });
    });

    it('the QA panel lists each enemy camp as a row of its own', () => {
        const { a, b } = twoFullDens();
        for (const t of own(b)) BoardState.removeToken(t.id);
        expect(getSpawnerKindCounts()).toEqual([
            { kind: 'Fixture Ec Den (its own)', count: 2, cap: 2 },
            { kind: 'Fixture Ec Den (its own)', count: 0, cap: 2 }
        ]);
        expect(a).toBeTruthy();
    });
});

describe('⭐ an older save: enemies without a tether', () => {
    it('are attached to the nearest den before any den counts, so a full den does not spawn on the first tick', () => {
        const a = placeAt('fixture_ec_den', 500, 500);
        const b = placeAt('fixture_ec_den', 1300, 500);
        placeAt('fixture_enemy', 1360, 560);
        placeAt('fixture_enemy', 1240, 440);
        // Saved with B's clock due: the first tick would spawn if B did not yet know its own.
        b.clocks = { spawnMs: INTERVAL };
        GameState.state.board.enemyTethers = 0;

        run(100);
        expect(own(b)).toHaveLength(2);
        expect(own(a)).toHaveLength(0);
        expect(BoardState.tokens().filter(t => t.typeId === 'fixture_enemy')).toHaveLength(2);
    });
});
