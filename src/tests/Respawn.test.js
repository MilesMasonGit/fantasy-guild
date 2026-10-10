import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { FIXTURE_TOKENS } from './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Charges from '../systems/board/Charges.js';
import * as Flags from '../systems/board/Flags.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { respawnOf as respawnBlockOf, RESPAWN_DEFAULTS, RESPAWN_MIN_MS } from '../config/registries/tokenConstants.js';
import { clearMat } from './fixtures/mat.js';

/**
 * Respawning fixtures: a Token type with a `respawn` block does not leave the mat when its charges
 * run out. A refill Token rests where it stands and refills after its time; a regrow Token becomes
 * its `into` Token, which grows back into it. A type without the block still leaves at 0.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const mining = {
    skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1,
    inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }]
};
const logging = {
    skill: 'forestry', skillRequired: 1, cycleTimeMs: 2000, xp: 1,
    inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
};

registerTokenTypes({
    respawn_vein: {
        id: 'respawn_vein', name: 'Respawn Vein', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: 3, sprite: 'skill_industry', config: mining,
        respawn: { mode: 'refill', afterMs: 12000 }
    },
    /** Needs an item the Bank never has, so a flag skips it for a fixable reason. */
    respawn_kiln: {
        id: 'respawn_kiln', name: 'Respawn Kiln', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: 3, sprite: 'skill_industry',
        config: { ...mining, inputs: [{ itemId: 'fixture_oak_wood', quantity: 1 }] },
        respawn: { mode: 'refill', afterMs: 12000 }
    },
    /** A worked vein that is also a yield buff, so a neighbour's cycle wears it. */
    respawn_buff_vein: {
        ...FIXTURE_TOKENS.fixture_buff_yield,
        id: 'respawn_buff_vein', name: 'Respawn Buff Vein', uses: 50, config: mining,
        respawn: { mode: 'refill', afterMs: 12000 }
    },
    /** The same vein with no block: the guard. */
    plain_vein: {
        id: 'plain_vein', name: 'Plain Vein', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: 3, sprite: 'skill_industry', config: mining
    },
    respawn_tree: {
        id: 'respawn_tree', name: 'Respawn Tree', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: 2, sprite: 'skill_nature', config: logging,
        respawn: { mode: 'regrow', into: 'respawn_sapling' }
    },
    respawn_sapling: {
        id: 'respawn_sapling', name: 'Respawn Sapling', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: null, sprite: 'skill_nature',
        grows: { into: 'respawn_tree', afterMs: 30000 }
    },
    /** Spawns Saplings: its family is {Sapling, Tree} through `grows` alone. */
    respawn_forest: {
        id: 'respawn_forest', name: 'Respawn Forest', tokenType: 'spawner', rarity: 'common',
        theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: { spawns: [{ typeId: 'respawn_sapling', weight: 1 }], allowance: 1, intervalMs: 5000, upkeep: [] }
    },
    /** Spawns grown trees that regrow from a stump: only `respawn.into` puts the stump in the family. */
    stump_tree: {
        id: 'stump_tree', name: 'Stump Tree', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: 2, sprite: 'skill_nature', config: logging,
        respawn: { mode: 'regrow', into: 'stump' }
    },
    stump: {
        id: 'stump', name: 'Stump', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: null, sprite: 'skill_nature',
        grows: { into: 'stump_tree', afterMs: 20000 }
    },
    stump_forest: {
        id: 'stump_forest', name: 'Stump Forest', tokenType: 'spawner', rarity: 'common',
        theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: { spawns: [{ typeId: 'stump_tree', weight: 1 }], allowance: 1, intervalMs: 5000, upkeep: [] }
    },
    /** A one-charge yield buff that rests and refills: worn by a neighbour's cycle or a kill. */
    respawn_rack: {
        ...FIXTURE_TOKENS.fixture_buff_yield,
        id: 'respawn_rack', name: 'Respawn Rack', uses: 1,
        respawn: { mode: 'refill', afterMs: 5000 }
    },
    /** Blocks the engine never lets respawn, whatever is authored. */
    respawn_enemy: {
        ...FIXTURE_TOKENS.fixture_enemy,
        id: 'respawn_enemy', name: 'Respawn Enemy',
        respawn: { mode: 'refill', afterMs: 5000 }
    }
});

const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    hero.skills.melee = { level: 50, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    return hero;
}

function place(tile, typeId, heroId = null, uses = undefined) {
    const instance = BoardState.createTokenInstance(typeId, uses === undefined ? tokenStartingUses(typeId) : uses);
    Placement.placeTokenAt(instance, C(tile));
    TileModifiers.rebuildAround([instance]);
    if (heroId) Placement.plantFlagAt(heroId, C(tile));
    return instance;
}

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

/** Tick until `done()` holds, at most `ms`; whether it did. */
function runUntil(done, ms = 60000) {
    for (let t = 0; t < ms; t += 100) {
        if (done()) return true;
        BoardRunner.tick(100);
    }
    return done();
}

const at = (point) => BoardState.tokensAtPoint(point.x, point.y)[0] ?? null;
const claimOf = (heroId) => BoardState.claimOfHero(heroId)?.instanceId ?? null;

const held = new Set();
const pickUp = (t) => { held.add(t.id); TimedChanges.setInHand(t.id, true); };
const putDown = (t) => { held.delete(t.id); TimedChanges.setInHand(t.id, false); };

let events;
const offs = [];

beforeAll(() => Flags.init());
afterAll(() => Flags.teardown());

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
    GameState.state.inventory.maxSlots = 50;
    events = { depleted: [], resting: [], respawned: [], alerts: [], alertChanged: [] };
    offs.push(EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, p => events.depleted.push(p)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.TOKEN_RESTING, p => events.resting.push(p)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.TOKEN_RESPAWNED, p => events.respawned.push(p)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.TILE_EVENT_ALERT, p => events.alerts.push(p)));
    offs.push(EventBus.subscribe(BOARD_EVENTS.ALERT_CHANGED, p => events.alertChanged.push(p)));
});

afterEach(() => {
    while (offs.length) offs.pop()();
    for (const id of [...held]) TimedChanges.setInHand(id, false);
    held.clear();
});

describe('the respawn block, read through one function', () => {
    it('refill: its time, defaulted when absent and never below the floor', () => {
        expect(respawnBlockOf({ respawn: { mode: 'refill', afterMs: 12000 } })).toEqual({ mode: 'refill', afterMs: 12000, into: null });
        expect(respawnBlockOf({ respawn: { mode: 'refill' } })).toEqual({ mode: 'refill', afterMs: RESPAWN_DEFAULTS.afterMs, into: null });
        expect(respawnBlockOf({ respawn: { mode: 'refill', afterMs: 'soon' } }).afterMs).toBe(RESPAWN_DEFAULTS.afterMs);
        expect(respawnBlockOf({ respawn: { mode: 'refill', afterMs: 200 } }).afterMs).toBe(RESPAWN_MIN_MS);
    });

    it('regrow: names its `into`; without one there is nothing to regrow from', () => {
        expect(respawnBlockOf({ respawn: { mode: 'regrow', into: 'respawn_sapling' } })).toEqual({ mode: 'regrow', afterMs: null, into: 'respawn_sapling' });
        expect(respawnBlockOf({ respawn: { mode: 'regrow', into: '' } })).toBeNull();
        expect(respawnBlockOf({ respawn: { mode: 'regrow' } })).toBeNull();
    });

    it('no block, or a mode the game does not know, is no respawn', () => {
        expect(respawnBlockOf({})).toBeNull();
        expect(respawnBlockOf(null)).toBeNull();
        expect(respawnBlockOf({ respawn: { mode: 'trickle', afterMs: 12000 } })).toBeNull();
    });

    it('the engine never respawns an enemy, a spawner or a Foundation, whatever is authored', () => {
        const block = { mode: 'refill', afterMs: 12000 };
        expect(Respawn.respawnOf({ respawn: block })).not.toBeNull();
        expect(Respawn.respawnOf({ respawn: block, enemy: { level: 2 } })).toBeNull();
        expect(Respawn.respawnOf({ respawn: block, spawner: { spawns: [] } })).toBeNull();
        expect(Respawn.respawnOf({ respawn: block, foundation: { kind: 'wood', skill: 'construction' } })).toBeNull();
    });
});

describe('a refill Token rests where it stands and refills', () => {
    it('at 0 it stays on the mat, cannot be worked, and refills to full after its time', () => {
        const vein = place(10, 'respawn_vein', 'hero_1');
        expect(runUntil(() => vein.usesRemaining === 0, 30000)).toBe(true);

        expect(BoardState.getTokenById(vein.id)).toBe(vein);
        expect(Respawn.isResting(vein)).toBe(true);
        expect(WorkCheck.fixableReason(vein.id, vein).reason).toBe(ALERT.RESTING);

        run(11900);
        expect(vein.usesRemaining).toBe(0);
        expect(Respawn.nextRespawn(vein)).toMatchObject({ mode: 'refill', inMs: 100, totalMs: 12000 });

        BoardRunner.tick(100);
        expect(vein.usesRemaining).toBe(3);
        expect(Respawn.isResting(vein)).toBe(false);
        expect(vein.clocks?.respawnMs).toBeUndefined();
        expect(events.respawned).toEqual([expect.objectContaining({ instanceId: vein.id, typeId: 'respawn_vein', mode: 'refill' })]);
    });

    it('is never depleted: no TOKEN_DEPLETED, no red alert, no alert on the Token, one resting event', () => {
        const vein = place(10, 'respawn_vein', 'hero_1');
        expect(runUntil(() => vein.usesRemaining === 0, 30000)).toBe(true);
        run(5000);

        expect(events.depleted).toEqual([]);
        expect(events.alerts.filter(a => a.instanceId === vein.id && a.severity === 'red')).toEqual([]);
        expect(events.alertChanged.filter(a => a.instanceId === vein.id && a.alert)).toEqual([]);
        expect(vein.alert ?? null).toBeNull();
        expect(events.resting).toEqual([expect.objectContaining({ instanceId: vein.id, typeId: 'respawn_vein', mode: 'refill', heroId: 'hero_1' })]);
    });

    it('its hero lets go at once and picks the next thing; the resting skip is not one the player fixes', () => {
        const vein = place(10, 'respawn_vein', 'hero_1');
        expect(runUntil(() => BoardState.workerOf(vein.id) === 'hero_1', 20000)).toBe(true);
        // Placed once the hero is at the vein, so the vein is the work they hold when it rests.
        const other = place(11, 'fixture_producer_alt');
        expect(runUntil(() => vein.usesRemaining === 0, 30000)).toBe(true);
        expect(claimOf('hero_1')).toBe(vein.id);

        BoardRunner.tick(100);
        expect(claimOf('hero_1')).toBe(other.id);
        expect(Flags.skipsOf(vein.id)).toContainEqual({ heroId: 'hero_1', reason: ALERT.RESTING });
        expect(Flags.hasFixableSkip(vein)).toBe(false);
        expect(WorkCheck.FIXABLE.has(ALERT.RESTING)).toBe(false);

        run(3000);
        expect(vein.alert ?? null).toBeNull();
    });

    it('a pinned hero waits by it and takes it back the moment it refills', () => {
        const vein = place(10, 'respawn_vein');
        Placement.plantFlagAt('hero_1', C(10), { pin: true });
        expect(BoardState.flagOf('hero_1').pinnedTo).toBe(vein.id);
        expect(runUntil(() => vein.usesRemaining === 0, 30000)).toBe(true);

        BoardRunner.tick(100);
        expect(claimOf('hero_1')).toBeNull();
        expect(BoardState.flagOf('hero_1').pinnedTo).toBe(vein.id);

        expect(runUntil(() => vein.usesRemaining === 3, 13000)).toBe(true);
        expect(claimOf('hero_1')).toBe(vein.id);
    });

    it('a charge given back mid-rest ends the rest; the next rest starts its clock afresh', () => {
        const vein = place(10, 'respawn_vein');
        Charges.applyDelta(vein, -3);
        run(5000);
        expect(vein.clocks.respawnMs).toBe(5000);

        Charges.applyDelta(vein, 1);
        expect(Respawn.isResting(vein)).toBe(false);
        run(20000);
        expect(vein.usesRemaining).toBe(1);

        Charges.applyDelta(vein, -1);
        expect(Respawn.nextRespawn(vein).inMs).toBe(12000);
    });

    it('a Token a flag skipped for a fixable reason loses that badge when it starts resting', () => {
        const kiln = place(10, 'respawn_kiln');
        Placement.plantFlagAt('hero_1', C(10));
        expect(runUntil(() => kiln.alert === ALERT.INPUTS, 5000)).toBe(true);
        // Deplete it just after the flag looked, so its stale fixable skip is still on record.
        const r = BoardState.flagRuntime();
        expect(runUntil(() => (r.nextTryAt.get('hero_1') ?? 0) - r.clock >= 500, 5000)).toBe(true);

        Charges.applyDelta(kiln, -3);
        run(3000);
        expect(kiln.alert ?? null).toBeNull();
        expect(events.alertChanged.filter(a => a.instanceId === kiln.id).map(a => a.alert)).toEqual([ALERT.INPUTS, null]);
    });

    it('a Token that starts resting part-way through a tick, its hero still on it, starts no cycle and raises no mark', () => {
        GameState.state.heroes.push(makeHero('hero_2'));
        // Placed first, so its cycle completes before the vein's turn in the same tick.
        const forest = place(10, 'fixture_producer', 'hero_2');
        const vein = place(11, 'respawn_buff_vein', 'hero_1');
        expect(runUntil(() => BoardState.workerOf(forest.id) === 'hero_2' && BoardState.workerOf(vein.id) === 'hero_1', 20000)).toBe(true);

        // The forest's next cycle finishes this tick and wears the vein's last charge.
        vein.usesRemaining = 1;
        forest.cycleElapsedMs = 1e9;
        const elapsed = vein.cycleElapsedMs || 0;
        const starts = [];
        offs.push(EventBus.subscribe(BOARD_EVENTS.CYCLE_START, p => starts.push(p.instanceId)));
        BoardRunner.tick(100);

        expect(Respawn.isResting(vein)).toBe(true);
        expect(BoardState.workerOf(vein.id)).toBe('hero_1');
        expect(vein.cycleElapsedMs || 0).toBe(elapsed);
        expect(starts).not.toContain(vein.id);
        expect(vein.alert ?? null).toBeNull();
    });

    it('a half-rested vein is saved with its clock and refills on time after a load', () => {
        const vein = place(10, 'respawn_vein', null, 0);
        vein.clocks = { respawnMs: 5000 };

        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);
        const loaded = BoardState.getTokenById(vein.id);
        expect(Respawn.isResting(loaded)).toBe(true);
        expect(loaded.clocks.respawnMs).toBe(5000);

        run(6900);
        expect(loaded.usesRemaining).toBe(0);
        run(100);
        expect(loaded.usesRemaining).toBe(3);
    });
});

describe('a regrow Token becomes its `into`, which grows back into it', () => {
    it('at 0 it becomes the Sapling where it stood, which grows back into a full Tree', () => {
        const tree = place(10, 'respawn_tree', 'hero_1');
        const spot = { x: tree.x, y: tree.y };
        expect(runUntil(() => tree.usesRemaining === 0, 30000)).toBe(true);
        expect(BoardState.getTokenById(tree.id)).toBe(tree);

        BoardRunner.tick(100);
        expect(BoardState.getTokenById(tree.id)).toBeNull();
        const sapling = at(spot);
        expect(sapling.typeId).toBe('respawn_sapling');
        expect(sapling.origin ?? 'placed').toBe(tree.origin ?? 'placed');
        expect(events.respawned).toEqual([expect.objectContaining({
            instanceId: sapling.id, fromInstanceId: tree.id, typeId: 'respawn_sapling', mode: 'regrow'
        })]);

        expect(runUntil(() => at(spot)?.typeId === 'respawn_tree', 31000)).toBe(true);
        expect(at(spot).usesRemaining).toBe(2);
        expect(events.depleted).toEqual([]);
        expect(events.alerts.filter(a => a.severity === 'red')).toEqual([]);
    });

    it('a map node keeps its fixture mark and biome through the regrow and back', () => {
        const tree = place(10, 'respawn_tree');
        Object.assign(tree, { fixture: true, biome: 'forest' });
        const spot = { x: tree.x, y: tree.y };
        Charges.applyDelta(tree, -2);
        BoardRunner.tick(100);
        expect(at(spot)).toMatchObject({ typeId: 'respawn_sapling', fixture: true, biome: 'forest' });
        expect(BoardState.isFixture(at(spot))).toBe(true);
        expect(runUntil(() => at(spot)?.typeId === 'respawn_tree', 31000)).toBe(true);
        expect(at(spot)).toMatchObject({ fixture: true, biome: 'forest', usesRemaining: 2 });
    });

    it('a tree spawned by a Forest regrows in place and keeps counting toward its family cap', () => {
        const forest = place(0, 'respawn_forest');
        expect(runUntil(() => BoardState.tokens().some(t => t.typeId === 'respawn_tree'), 40000)).toBe(true);
        const tree = BoardState.tokens().find(t => t.typeId === 'respawn_tree');
        const spot = { x: tree.x, y: tree.y };
        expect(tree.origin).toBe('spawned');
        expect(SpawnerSystem.spawnerCounts(forest.id)).toEqual({ count: 1, cap: 1 });

        Placement.plantFlagAt('hero_1', spot);
        expect(runUntil(() => !BoardState.getTokenById(tree.id), 30000)).toBe(true);
        const sapling = at(spot);
        expect(sapling.typeId).toBe('respawn_sapling');
        expect(sapling.origin).toBe('spawned');

        // The family is still full: the Forest spawns nothing while the tree grows back.
        run(25000);
        expect(SpawnerSystem.spawnerCounts(forest.id)).toEqual({ count: 1, cap: 1 });
        expect(BoardState.tokens().filter(t => t.typeId === 'respawn_sapling' || t.typeId === 'respawn_tree')).toHaveLength(1);
    });

    it('a Forest that spawns grown trees counts the Token they regrow from as family too', () => {
        expect(SpawnerSystem.familyOf('stump_forest')).toEqual(['stump_tree', 'stump']);

        const forest = place(0, 'stump_forest');
        expect(runUntil(() => BoardState.tokens().some(t => t.typeId === 'stump_tree'), 10000)).toBe(true);
        const tree = BoardState.tokens().find(t => t.typeId === 'stump_tree');
        Placement.plantFlagAt('hero_1', { x: tree.x, y: tree.y });
        expect(runUntil(() => BoardState.tokens().some(t => t.typeId === 'stump'), 30000)).toBe(true);

        run(15000);
        expect(SpawnerSystem.spawnerCounts(forest.id)).toEqual({ count: 1, cap: 1 });
        expect(BoardState.tokens().filter(t => t.typeId === 'stump_tree' || t.typeId === 'stump')).toHaveLength(1);
    });
});

describe('one big tick equals many small ones', () => {
    const snapshot = (t) => ({ typeId: t.typeId, x: t.x, y: t.y, usesRemaining: t.usesRemaining, clocks: t.clocks ?? null });

    function restingVein() {
        clearMat();
        const vein = place(10, 'respawn_vein');
        Charges.applyDelta(vein, -3);
        expect(Respawn.isResting(vein)).toBe(true);
        return vein;
    }

    it('a refill: part-way and past its time, one tick ends where a hundred do', () => {
        let vein = restingVein();
        TimedChanges.tick(5000);
        const bigHalf = snapshot(vein);
        vein = restingVein();
        for (let i = 0; i < 50; i++) TimedChanges.tick(100);
        expect(snapshot(vein)).toEqual(bigHalf);
        expect(bigHalf.clocks).toEqual({ respawnMs: 5000 });

        vein = restingVein();
        TimedChanges.tick(15000);
        const bigPast = snapshot(vein);
        vein = restingVein();
        for (let i = 0; i < 150; i++) TimedChanges.tick(100);
        expect(snapshot(vein)).toEqual(bigPast);
        expect(bigPast.usesRemaining).toBe(3);
    });

    it('a regrow: one 40 s tick turns the Tree into a Sapling and grows it back, as 400 small ones do', () => {
        const tree = (() => { clearMat(); const t = place(10, 'respawn_tree'); Charges.applyDelta(t, -2); return t; });
        tree();
        TimedChanges.tick(40000);
        const big = snapshot(BoardState.tokens()[0]);
        tree();
        for (let i = 0; i < 400; i++) TimedChanges.tick(100);
        expect(snapshot(BoardState.tokens()[0])).toEqual(big);
        expect(big).toMatchObject({ typeId: 'respawn_tree', usesRemaining: 2 });
    });
});

describe('a type without the block still leaves the mat at 0', () => {
    it('removed, depleted, with the red alert, as before', () => {
        const vein = place(10, 'plain_vein', 'hero_1');
        expect(runUntil(() => !BoardState.getTokenById(vein.id), 30000)).toBe(true);
        expect(events.depleted.map(d => d.instanceId)).toEqual([vein.id]);
        expect(events.alerts).toContainEqual(expect.objectContaining({ instanceId: vein.id, severity: 'red', type: 'token_exhausted' }));
        expect(events.resting).toEqual([]);
    });

    it('an enemy with an authored block is still removed at 0 (its spawner replaces it)', () => {
        const enemy = place(10, 'respawn_enemy', 'hero_1', 1);
        expect(runUntil(() => !BoardState.getTokenById(enemy.id), 60000)).toBe(true);
        expect(events.depleted.map(d => d.instanceId)).toContain(enemy.id);
    });
});

describe('in the player\'s hand it rests and never leaves', () => {
    it('a refill Token emptied in the hand stays, rests and refills', () => {
        const vein = place(10, 'respawn_vein');
        pickUp(vein);
        Charges.applyDelta(vein, -3);
        expect(BoardState.getTokenById(vein.id)).toBe(vein);
        expect(Respawn.isResting(vein)).toBe(true);

        run(12000);
        expect(BoardState.getTokenById(vein.id)).toBe(vein);
        expect(vein.usesRemaining).toBe(3);
        putDown(vein);
        expect(BoardState.getTokenById(vein.id)).toBe(vein);
        expect(events.depleted).toEqual([]);
    });

    it('a regrow Token emptied in the hand waits for the drop, then becomes its Sapling there', () => {
        const tree = place(10, 'respawn_tree');
        pickUp(tree);
        Charges.applyDelta(tree, -2);
        run(5000);
        expect(BoardState.getTokenById(tree.id)).toBe(tree);
        expect(Respawn.isResting(tree)).toBe(true);

        putDown(tree);
        expect(BoardState.getTokenById(tree.id)).toBe(tree);
        BoardRunner.tick(100);
        expect(BoardState.getTokenById(tree.id)).toBeNull();
        expect(at(C(10)).typeId).toBe('respawn_sapling');
        expect(events.depleted).toEqual([]);
    });
});

describe('a support Token worn out by service rests too', () => {
    it('worn to 0 by a neighbour\'s cycle, it stays and refills', () => {
        place(10, 'fixture_producer', 'hero_1');
        const rack = place(11, 'respawn_rack');
        expect(runUntil(() => rack.usesRemaining === 0, 30000)).toBe(true);
        expect(BoardState.getTokenById(rack.id)).toBe(rack);
        expect(events.depleted).toEqual([]);
        expect(runUntil(() => rack.usesRemaining === 1, 6000)).toBe(true);
    });

    it('worn to 0 by a kill, it stays', () => {
        place(10, 'fixture_enemy', 'hero_1');
        const rack = place(11, 'respawn_rack');
        expect(runUntil(() => rack.usesRemaining === 0, 60000)).toBe(true);
        expect(BoardState.getTokenById(rack.id)).toBe(rack);
        expect(events.depleted.map(d => d.instanceId)).not.toContain(rack.id);
    });
});
