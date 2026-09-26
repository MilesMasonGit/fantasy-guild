import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as Charges from '../systems/board/Charges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getSpawnerKindCounts } from '../systems/core/DevTools.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * Token Lifecycle slice 3.3 — **spawners** (roadmap §3.1, DP-4, DP-5, SP-5,
 * SP-6, SP-46/SP-68).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

// --- Fixtures (test instruments, not content) -------------------------------

const item = (id, name) => ({
    id, name, type: 'material', sprite: 'wood_oak', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({
    fixture_sp_seed: item('fixture_sp_seed', 'Fixture Seed'),
    fixture_sp_twine: item('fixture_sp_twine', 'Fixture Twine')
});

const SEED = 'fixture_sp_seed';
const TWINE = 'fixture_sp_twine';

registerTokenTypes({
    fixture_sp_sapling: {
        id: 'fixture_sp_sapling', name: 'Fixture Sp Sapling', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        grows: { into: 'fixture_sp_tree', afterMs: 30000 }
    },
    fixture_sp_tree: {
        id: 'fixture_sp_tree', name: 'Fixture Sp Tree', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: 3, sprite: 'skill_nature',
        config: {
            skill: 'logging', skillRequired: 1, cycleTimeMs: 12000, xp: 1,
            inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
        }
    },
    /** The Forest: 5 of the Sapling → Tree family, one attempt every 20 s, a seed each. */
    fixture_sp_forest: {
        id: 'fixture_sp_forest', name: 'Fixture Sp Forest', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: {
            spawns: [{ typeId: 'fixture_sp_sapling', weight: 1 }],
            allowance: 5, intervalMs: 20000,
            upkeep: [{ itemId: SEED, quantity: 1 }]
        }
    },
    /** Spawns Trees directly (same family) — for "families share a cap". */
    fixture_sp_grove: {
        id: 'fixture_sp_grove', name: 'Fixture Sp Grove', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: { spawns: [{ typeId: 'fixture_sp_tree', weight: 1 }], allowance: 2, intervalMs: 10000, upkeep: [] }
    },
    /** Two items per spawn — for all-or-nothing upkeep. */
    fixture_sp_orchard: {
        id: 'fixture_sp_orchard', name: 'Fixture Sp Orchard', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: {
            spawns: [{ typeId: 'fixture_sp_sapling', weight: 1 }], allowance: 3, intervalMs: 5000,
            upkeep: [{ itemId: SEED, quantity: 1 }, { itemId: TWINE, quantity: 2 }]
        }
    },
    /** A free spawner of a plain small Token. */
    fixture_sp_camp: {
        id: 'fixture_sp_camp', name: 'Fixture Sp Camp', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: { spawns: [{ typeId: 'fixture_passive', weight: 1 }], allowance: 4, intervalMs: 5000, upkeep: [] }
    }
});

// --- Helpers ----------------------------------------------------------------

/** Many small engine ticks, through `BoardRunner` — the path the game takes. */
const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

const FAMILY = new Set(['fixture_sp_sapling', 'fixture_sp_tree']);
const family = () => BoardState.tokens().filter(t => FAMILY.has(t.typeId));
const seeds = () => InventoryManager.getItemCount(SEED);
const give = (id, n) => InventoryManager.addItem(id, n);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    TriggerSystem.resetCascadeGuard();
    TriggerSystem.init();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
    clearMat();
});

afterEach(() => {
    TriggerSystem.teardown();
    TileModifiers.teardown();
    resetMatTuning();
});

// --- Cap (DP-4, SP-5) -------------------------------------------------------

describe('⭐ a Forest spawns its family up to its allowance', () => {
    it('one attempt per interval, a seed each, and at most 5 of the family', () => {
        give(SEED, 100);
        const forest = placeAt('fixture_sp_forest', 800, 500);

        run(19900);
        expect(family()).toHaveLength(0);
        expect(forest.clocks.spawnMs).toBe(19900);

        run(100);
        expect(family()).toHaveLength(1);
        expect(family()[0]).toMatchObject({ typeId: 'fixture_sp_sapling', origin: 'spawned' });
        expect(seeds()).toBe(99);

        run(10 * 60000);
        expect(family()).toHaveLength(5);
        expect(seeds()).toBe(95);
        // Saplings grew into Trees; both count toward the one cap.
        expect(family().every(t => t.typeId === 'fixture_sp_tree')).toBe(true);
        expect(SpawnerSystem.spawnerStatus(forest.id)).toMatchObject({
            state: 'at_cap', count: 5, cap: 5, familyLabel: 'Fixture Sp Sapling'
        });
        // At the cap, the clock waits full rather than running on.
        expect(forest.clocks.spawnMs).toBe(20000);
    });

    it('two Forests allow 10', () => {
        give(SEED, 100);
        placeAt('fixture_sp_forest', 500, 500);
        placeAt('fixture_sp_forest', 1100, 500);

        run(10 * 60000);
        expect(family()).toHaveLength(10);
        expect(seeds()).toBe(90);
        expect(getSpawnerKindCounts()).toEqual([{ kind: 'Fixture Sp Sapling', count: 10, cap: 10 }]);
    });

    it('spawners whose families overlap share one count and add their allowances', () => {
        give(SEED, 100);
        const forest = placeAt('fixture_sp_forest', 500, 500);
        const grove = placeAt('fixture_sp_grove', 1100, 500);   // spawns Trees: overlaps the Forest's family

        run(10 * 60000);
        // Both caps are 5 + 2. ⚠️ Each spawner counts ITS OWN family (§3.1):
        // the Grove counts Trees only, so it can top Trees up to 7 while a
        // Sapling is still growing — the combined family can end one or more
        // over 7. Here: whatever the split, each spawner stopped at its cap.
        const trees = BoardState.tokens().filter(t => t.typeId === 'fixture_sp_tree').length;
        expect(SpawnerSystem.spawnerStatus(forest.id)).toMatchObject({ state: 'at_cap', cap: 7 });
        expect(SpawnerSystem.spawnerStatus(grove.id)).toMatchObject({ state: 'at_cap', count: trees, cap: 7 });
        expect(family().length).toBeGreaterThanOrEqual(7);
        expect(trees).toBeGreaterThanOrEqual(7);
    });

    it('the family is the spawns plus everything they grow into', () => {
        expect(SpawnerSystem.familyOf('fixture_sp_forest')).toEqual(['fixture_sp_sapling', 'fixture_sp_tree']);
        expect(SpawnerSystem.familyOf('fixture_sp_grove')).toEqual(['fixture_sp_tree']);
        expect(SpawnerSystem.familyOf('fixture_producer')).toEqual([]);
    });

    it('logging a Tree out lets another spawn', () => {
        give(SEED, 100);
        placeAt('fixture_sp_forest', 800, 500);
        run(10 * 60000);
        expect(family()).toHaveLength(5);

        Charges.destroyToken(family()[0]);
        expect(family()).toHaveLength(4);

        // The clock was held full, so the next tick spawns.
        run(100);
        expect(family()).toHaveLength(5);
        expect(seeds()).toBe(94);
    });

    it('a Tree placed by hand counts toward the family too, whatever its origin', () => {
        give(SEED, 100);
        placeAt('fixture_sp_tree', 200, 200);
        placeAt('fixture_sp_tree', 200, 400);
        placeAt('fixture_sp_forest', 800, 500);
        run(10 * 60000);
        expect(family()).toHaveLength(5);
        expect(seeds()).toBe(97);
    });
});

// --- SP-6 -------------------------------------------------------------------

describe('⭐ removing a spawner lowers the cap and removes nothing (SP-6)', () => {
    it('the other Forest\'s Trees stay; the family is over its new cap and nothing spawns', () => {
        give(SEED, 100);
        const a = placeAt('fixture_sp_forest', 500, 500);
        const b = placeAt('fixture_sp_forest', 1100, 500);
        run(10 * 60000);
        expect(family()).toHaveLength(10);

        BoardState.removeToken(b.id);
        run(10 * 60000);

        expect(family()).toHaveLength(10);
        expect(seeds()).toBe(90);
        expect(SpawnerSystem.spawnerStatus(a.id)).toMatchObject({ state: 'at_cap', count: 10, cap: 5 });
        expect(getSpawnerKindCounts()).toEqual([{ kind: 'Fixture Sp Sapling', count: 10, cap: 5 }]);
    });

    it('with no spawner left there is no row at all', () => {
        const forest = placeAt('fixture_sp_forest', 500, 500);
        expect(getSpawnerKindCounts()).toHaveLength(1);
        BoardState.removeToken(forest.id);
        expect(getSpawnerKindCounts()).toEqual([]);
        expect(SpawnerSystem.spawnerStatus(forest.id)).toBeNull();
    });
});

// --- Upkeep (DP-5) ----------------------------------------------------------

describe('⭐ upkeep is paid per spawn, all or nothing (DP-5)', () => {
    it('with no seeds it waits and reports needs_item; a seed lets it spawn next tick', () => {
        const forest = placeAt('fixture_sp_forest', 800, 500);

        run(60000);
        expect(family()).toHaveLength(0);
        expect(forest.clocks.spawnMs).toBe(20000);   // held full
        expect(SpawnerSystem.spawnerStatus(forest.id)).toMatchObject({
            state: 'needs_item', needs: [SEED], count: 0, cap: 5
        });

        give(SEED, 1);
        run(100);
        expect(family()).toHaveLength(1);
        expect(seeds()).toBe(0);
        expect(SpawnerSystem.spawnerStatus(forest.id)).toMatchObject({ state: 'needs_item' });
    });

    it('takes nothing when the Bank holds only part of the upkeep', () => {
        give(SEED, 5);
        give(TWINE, 1);   // needs 2
        const orchard = placeAt('fixture_sp_orchard', 800, 500);

        run(30000);
        expect(family()).toHaveLength(0);
        expect(seeds()).toBe(5);
        expect(InventoryManager.getItemCount(TWINE)).toBe(1);
        expect(SpawnerSystem.spawnerStatus(orchard.id)).toMatchObject({ state: 'needs_item', needs: [TWINE] });

        give(TWINE, 3);
        run(100);
        expect(family()).toHaveLength(1);
        expect(seeds()).toBe(4);
        expect(InventoryManager.getItemCount(TWINE)).toBe(2);
    });

    it('a free spawner reports spawning with the time to its next attempt', () => {
        const camp = placeAt('fixture_sp_camp', 800, 500);
        run(3000);
        expect(SpawnerSystem.spawnerStatus(camp.id)).toEqual({
            state: 'spawning', nextInMs: 2000, count: 0, cap: 4, familyLabel: getTokenType('fixture_passive').name
        });
    });
});

// --- Landing (SP-46, SP-68, FP-46) -------------------------------------------

describe('⭐ spawns push spawned Tokens but never placed ones (SP-46, SP-68)', () => {
    /** A ring of 8 Tokens 100 u around the spawner, so no spot is free within nudge reach 0. */
    function ringAround(spawner, make) {
        const ring = [];
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            ring.push(make('fixture_kitchen', Math.round(spawner.x + Math.cos(a) * 100), Math.round(spawner.y + Math.sin(a) * 100)));
        }
        return ring;
    }
    const spawned = (typeId, x, y) => placeAt(BoardState.createTokenInstance(typeId, 100, null, 'spawned'), x, y);

    it('a crowded spawn pushes a ring of spawned Tokens and lands beside the spawner', () => {
        setMatTuning('nudgeReach', 0);
        const camp = placeAt('fixture_sp_camp', 800, 500);
        const ring = ringAround(camp, spawned);
        const before = ring.map(t => ({ x: t.x, y: t.y }));

        run(5000);

        const [newcomer] = BoardState.tokens().filter(t => t.typeId === 'fixture_passive');
        expect(newcomer).toBeTruthy();
        const d = Math.hypot(newcomer.x - 800, newcomer.y - 500);
        expect(d).toBeLessThanOrEqual(MatPlacement.minGap('fixture_passive', 'fixture_sp_camp') + 2);
        expect(ring.map(t => ({ x: t.x, y: t.y }))).not.toEqual(before);
        expect({ x: camp.x, y: camp.y }).toEqual({ x: 800, y: 500 });
    });

    it('a ring of placed Tokens is never pushed', () => {
        setMatTuning('nudgeReach', 0);
        const camp = placeAt('fixture_sp_camp', 800, 500);
        const ring = ringAround(camp, placeAt);
        const before = ring.map(t => ({ x: t.x, y: t.y }));

        run(5000);

        expect(BoardState.tokens().some(t => t.typeId === 'fixture_passive')).toBe(true);   // free space further out
        expect(ring.map(t => ({ x: t.x, y: t.y }))).toEqual(before);
    });

    it('with nowhere to land it waits, reports no_room, and pays nothing (FP-46)', () => {
        setMatTuning('matSteps', 6);
        give(SEED, 10);
        const forest = placeAt('fixture_sp_forest', 200, 200);
        const gap = Math.ceil(MatPlacement.minGap('fixture_kitchen', 'fixture_kitchen'));
        const blockers = [];
        for (let x = 64; x <= matW() - 64; x += gap) {
            for (let y = 64; y <= matH() - 64; y += gap) {
                if (Math.hypot(x - 200, y - 200) < gap) continue;
                blockers.push(placeAt('fixture_kitchen', x, y));
            }
        }

        TimedChanges.tick(25000);
        expect(family()).toHaveLength(0);
        expect(seeds()).toBe(10);
        expect(forest.clocks.spawnMs).toBe(20000);
        expect(SpawnerSystem.spawnerStatus(forest.id)).toMatchObject({ state: 'no_room', count: 0, cap: 5 });

        for (const b of blockers) {
            if (Math.hypot(b.x - 200, b.y - 200) < 400) BoardState.removeToken(b.id);
        }
        TimedChanges.tick(100);
        expect(family()).toHaveLength(1);
        expect(seeds()).toBe(9);
        expect(SpawnerSystem.spawnerStatus(forest.id).state).toBe('spawning');
    });
});

// --- Saved, and delta --------------------------------------------------------

describe('⭐ the spawn clock is saved and runs on delta', () => {
    it('a half-full clock survives a save and load', () => {
        give(SEED, 10);
        const forest = placeAt('fixture_sp_forest', 800, 500);
        run(15000);

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);
        InventoryManager.init();

        expect(BoardState.getTokenById(forest.id).clocks.spawnMs).toBe(15000);
        run(4900);
        expect(family()).toHaveLength(0);
        run(100);
        expect(family()).toHaveLength(1);
    });

    /** Everything a spawner decides that does not depend on where Tokens land. */
    function snapshot() {
        const byType = {};
        for (const t of BoardState.tokens()) byType[t.typeId] = (byType[t.typeId] || 0) + 1;
        const clocks = BoardState.tokens()
            .filter(t => FAMILY.has(t.typeId))
            .map(t => t.clocks?.growMs ?? null)
            .sort((a, b) => (a ?? -1) - (b ?? -1));
        const spawners = BoardState.tokens().filter(t => t.typeId === 'fixture_sp_forest')
            .map(t => t.clocks?.spawnMs);
        return { byType, clocks, spawners, seeds: seeds() };
    }

    function layout() {
        clearMat();
        InventoryManager.init();
        give(SEED, 7);
        placeAt('fixture_sp_forest', 500, 500);
        placeAt('fixture_sp_forest', 1100, 500);
    }

    for (const minutes of [1.5, 4, 10]) {
        it(`${minutes} min in 100 ms ticks and in a few uneven big ones end the same`, () => {
            const total = minutes * 60000;

            layout();
            for (let t = 0; t < total; t += 100) TimedChanges.tick(100);
            const bySmall = snapshot();

            layout();
            const bigs = [total * 0.13, total * 0.4, total * 0.07, total * 0.4].map(Math.round);
            bigs[3] = total - bigs[0] - bigs[1] - bigs[2];
            for (const d of bigs) TimedChanges.tick(d);
            const byBig = snapshot();

            expect(byBig).toEqual(bySmall);
        });
    }

    it('something did happen: 7 seeds made 7 spawns, which grew into Trees', () => {
        layout();
        TimedChanges.tick(10 * 60000);
        const snap = snapshot();
        expect(snap.seeds).toBe(0);
        expect(snap.byType.fixture_sp_tree).toBe(7);
    });
});
