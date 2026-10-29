// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as Camps from '../systems/board/Camps.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as Growth from '../systems/board/Growth.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { deriveTokenType } from '../config/registries/tokenTypeDerivation.js';
import { TOKEN_TYPES, CAMP_REACH_DEFAULT } from '../config/registries/tokenConstants.js';
import { flagStatusLine, dockStatusLine } from '../ui/components/board/flagText.js';
import { idleMomentOf } from '../ui/components/board/heroSpeech.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Camps (brief 260 O2): a hero ordered onto a camp works, one at a time, the nearest free Token of
 * the camp's skill they can work within its reach; keeps it until it can no longer run (no
 * switching for something nearer); waits silently while what is left rests or grows; any number of
 * heroes per camp, one per Token. Stations are never a camp's work, but a Farmstead harvests the
 * ripe Fields in its reach. An enemy camp takes the same order: the hero hunts what it spawns and
 * waits for the next.
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const SEED = 'fixture_hc_seed';
const WHEAT_ITEM = 'fixture_hc_wheat';
const CROP = 'hc_recipe_wheat';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({ [SEED]: item(SEED, 'HC Wheat Seed'), [WHEAT_ITEM]: item(WHEAT_ITEM, 'HC Wheat') });
registerRecipePools({
    farming: [{
        id: CROP, name: 'HC Wheat', levelRequirement: 1, durationMs: 1000, xp: 1, stationKinds: ['field'],
        inputs: [{ itemId: SEED, quantity: 1 }],
        outputs: [{ itemId: WHEAT_ITEM, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 60_000, load: 2 }
    }]
});

const plain = (id, name, extra) => ({ id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra });
const work = (skill, ms = 1000, extra = {}) => ({
    skill, skillRequired: 1, cycleTimeMs: ms, xp: 1, inputs: [],
    outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }], ...extra
});
const camp = (id, name, skill, reach) => ({
    id, name, tokenType: 'camp', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
    requiresHero: false, config: null, camp: { skill, reach }
});
const enemyConfig = { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] };

registerTokenTypes({
    hc_logging: camp('hc_logging', 'HC Logging Camp', 'forestry', 300),
    hc_mining: camp('hc_mining', 'HC Mining Camp', 'mining', 300),
    hc_farmstead: camp('hc_farmstead', 'HC Farmstead', 'farming', 300),
    hc_tree: plain('hc_tree', 'HC Tree', { uses: 3, requiresHero: true, config: work('forestry') }),
    hc_berry: plain('hc_berry', 'HC Berry', {
        uses: 1, requiresHero: true, respawn: { mode: 'refill', afterMs: 5000 }, config: work('forestry')
    }),
    hc_vein: plain('hc_vein', 'HC Vein', {
        uses: 2, requiresHero: true, needsTool: { kind: 'pickaxe', minTier: 1 }, config: work('mining')
    }),
    /** A Forestry station (a sawmill): a camp never works a station. */
    hc_saw: plain('hc_saw', 'HC Saw', {
        tokenType: 'station', requiresHero: true, config: work('forestry', 1000, { outputs: [] }),
        statements: [{ id: 'stm_hc_saw', keyword: KEYWORD.STATION, payload: { skill: 'forestry' } }]
    }),
    /** A Field that starts ripe with two harvests. */
    hc_field: plain('hc_field', 'HC Field', {
        tokenType: 'station', requiresHero: true, field: { startsWith: CROP },
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_hc_field', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
    }),
    /** A Farming station that is not a Field (a Windmill): never a Farmstead's work. */
    hc_mill: plain('hc_mill', 'HC Mill', {
        tokenType: 'station', requiresHero: true, config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_hc_mill', keyword: KEYWORD.STATION, payload: { skill: 'farming' } }]
    }),
    hc_goblin: {
        id: 'hc_goblin', name: 'HC Goblin', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 's_occult', enemy: { level: 1, style: 'melee', budgetScale: 0.3 }, config: enemyConfig
    },
    hc_den: {
        id: 'hc_den', name: 'HC Den', tokenType: 'spawner', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'hc_goblin', weight: 1 }], allowance: 1, intervalMs: 3000, upkeep: [] }
    },
    hc_grove: {
        id: 'hc_grove', name: 'HC Grove', tokenType: 'spawner', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'hc_tree', weight: 1 }], allowance: 1, intervalMs: 3000, upkeep: [] }
    }
});

/** The Hall stands well away, so nothing here is measured from it by accident. */
const HALL = { x: 1700, y: 900 };
const SKILLS = { forestry: 10, mining: 10, farming: 10, melee: 25 };
const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) GameLoop.runHandlers(step); };

function newBoard(heroes = 1) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    Growth.resetGrowthAlerts();
    BoardCombat.clearAll();
    fixtures.placeAt('bench_hall', HALL.x, HALL.y);
    const made = fixtures.makeHeroes(heroes, SKILLS);
    TileModifiers.rebuildAll();
    return made;
}

/** Each cycle completed, as `[heroId, instanceId]`, in order. */
function watchCycles() {
    const seen = [];
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => seen.push([p.heroId, p.instanceId]));
    return { seen, stop: () => { off(); return seen; } };
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterEach(() => {
    BoardState.setInstantArrival(true);
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a camp is a Token type', () => {
    it('reads its block (skill and reach, a missing reach at the default) and files as a camp', () => {
        expect(Camps.campOf(getTokenType('hc_logging'))).toEqual({ skill: 'forestry', reach: 300 });
        expect(Camps.campOf({ camp: { skill: 'mining' } })).toEqual({ skill: 'mining', reach: CAMP_REACH_DEFAULT });
        expect(Camps.campOf({ camp: { skill: '' } })).toBe(null);
        expect(Camps.campOf(getTokenType('hc_tree'))).toBe(null);
        expect(deriveTokenType(getTokenType('hc_logging')).type).toBe('camp');
        expect(TOKEN_TYPES).toContain('camp');
    });

    it('an enemy camp is any spawner of enemies; a spawner of trees is not one', () => {
        newBoard();
        const den = fixtures.placeAt('hc_den', 400, 300);
        const grove = fixtures.placeAt('hc_grove', 800, 300);
        expect(Camps.isEnemyCamp(den)).toBe(true);
        expect(Camps.isEnemyCamp(grove)).toBe(false);
        expect(Camps.isCampLike(grove)).toBe(false);
    });

    it('a camp marked for demolition hands out nothing (it is only that job)', () => {
        newBoard();
        const c = fixtures.placeAt('hc_logging', 400, 300);
        const tree = fixtures.placeAt('hc_tree', 500, 300);
        expect(Camps.campWork(c).map(t => t.id)).toEqual([tree.id]);
        expect(Demolition.mark(c).success).toBe(true);
        expect(Camps.campWork(c)).toEqual([]);
        expect(Camps.isCampLike(BoardState.getTokenById(c.id))).toBe(false);
    });

    it('its ring: a camp shows its reach, an enemy camp the ground its enemies roam', () => {
        newBoard();
        const c = fixtures.placeAt('hc_logging', 400, 300);
        const den = fixtures.placeAt('hc_den', 900, 300);
        expect(Camps.reachRingOf(c)).toEqual({ x: 400, y: 300, r: 300 });
        expect(Camps.reachRingOf(den)).toMatchObject({ x: 900, y: 300 });
        expect(Camps.reachRingOf(den).r).toBeGreaterThan(0);
        expect(Camps.reachRingOf(fixtures.placeAt('hc_tree', 1200, 300))).toBe(null);
    });
});

describe('⭐ heroes sent to a camp work its Tokens, one hero per Token', () => {
    it('two heroes on one camp take two different Tokens in its reach; the camp itself and a Token beyond its reach are never worked', () => {
        const [a, b] = newBoard(2);
        const c = fixtures.placeAt('hc_logging', 600, 500);
        const near = fixtures.placeAt('hc_tree', 700, 500);
        const next = fixtures.placeAt('hc_tree', 600, 700);
        const beyond = fixtures.placeAt('hc_tree', 1000, 500);    // 400 u from the camp, its reach 300
        expect(Orders.orderAt(a.id, { x: c.x, y: c.y })).toMatchObject({ success: true, order: 'token', instanceId: c.id });
        expect(Orders.orderAt(b.id, { x: c.x, y: c.y })).toMatchObject({ success: true, order: 'token', instanceId: c.id });
        run(500);
        const worked = [BoardState.workTokenOf(a.id), BoardState.workTokenOf(b.id)];
        expect(new Set(worked)).toEqual(new Set([near.id, next.id]));
        expect(BoardState.heroOfInstance(beyond.id)).toBe(null);
        expect(BoardState.heroOfInstance(c.id)).toBe(null);
        // Their order still names the camp: the pennant and the job light stay on it.
        expect(Flags.pinnedIdOf(a.id)).toBe(c.id);
        expect(Orders.jobTokenOf(b.id)?.id).toBe(c.id);
        expect(Flags.statusOf(a.id)).toMatchObject({ state: 'working', order: 'token', campId: c.id });
    });

    it('⭐ sticky: a Token is worked through every cycle, even when a nearer one appears; used up, the next nearest', () => {
        const [h] = newBoard();
        const c = fixtures.placeAt('hc_logging', 600, 500);
        const first = fixtures.placeAt('hc_tree', 750, 500);
        Orders.orderAt(h.id, { x: c.x, y: c.y });
        run(200);
        expect(BoardState.workTokenOf(h.id)).toBe(first.id);
        // A nearer tree comes up beside the camp mid-work: they finish the one they are on.
        const later = fixtures.placeAt('hc_tree', 600, 640);
        const w = watchCycles();
        run(2000);
        expect(w.seen.filter(([, id]) => id === later.id)).toEqual([]);
        expect(BoardState.workTokenOf(h.id)).toBe(first.id);
        run(1500);
        // Three cycles: the first tree is gone, and they moved to the other.
        expect(BoardState.getTokenById(first.id)).toBe(null);
        expect(BoardState.workTokenOf(h.id)).toBe(later.id);
        w.stop();
        expect(w.seen.filter(([, id]) => id === first.id).length).toBe(3);
    });

    it('a Token moved out of the camp’s reach is let go and the next one in reach is taken', () => {
        const [h] = newBoard();
        const c = fixtures.placeAt('hc_logging', 600, 500);
        const a = fixtures.placeAt('hc_tree', 700, 500);
        const b = fixtures.placeAt('hc_tree', 600, 700);
        Orders.orderAt(h.id, { x: c.x, y: c.y });
        run(200);
        const held = BoardState.workTokenOf(h.id);
        const other = held === a.id ? b : a;
        BoardState.setTokenPoint(held, 1300, 500);
        run(300);
        expect(BoardState.workTokenOf(h.id)).toBe(other.id);
    });

    it('stations are never a camp’s work, even the nearest', () => {
        const [h] = newBoard();
        const c = fixtures.placeAt('hc_logging', 600, 500);
        const saw = fixtures.placeAt('hc_saw', 700, 500);
        const tree = fixtures.placeAt('hc_tree', 600, 750);
        Orders.orderAt(h.id, { x: c.x, y: c.y });
        run(300);
        expect(BoardState.workTokenOf(h.id)).toBe(tree.id);
        expect(Camps.isCampWork(c, saw)).toBe(false);
    });
});

describe('⭐ waiting at a camp', () => {
    it('waits silently while what is left rests, is not idle, and works it the moment it is back', () => {
        const [h] = newBoard();
        const c = fixtures.placeAt('hc_logging', 600, 500);
        const berry = fixtures.placeAt('hc_berry', 700, 500);
        Orders.orderAt(h.id, { x: c.x, y: c.y });
        run(1300);
        // One cycle: it rests.
        expect(BoardState.workTokenOf(h.id)).toBe(null);
        expect(Flags.waitingOf(h.id)).toMatchObject({ instanceId: berry.id, kind: 'node' });
        expect(BoardRunner.isHeroIdle(h.id)).toBe(false);
        expect(flagStatusLine(h.id)).toBe('Waiting for HC Berry');
        expect(idleMomentOf(Flags.waitingOf(h.id), 'HC Berry', { order: 'token' })).toBe(null);
        run(5000);
        expect(BoardState.workTokenOf(h.id)).toBe(berry.id);
    });

    it('a camp whose Tokens are all taken leaves the newcomer idle: nothing to work near it', () => {
        const [a, b] = newBoard(2);
        const c = fixtures.placeAt('hc_logging', 600, 500);
        const tree = fixtures.placeAt('hc_tree', 700, 500);
        Orders.orderAt(a.id, { x: c.x, y: c.y });
        run(200);
        Orders.orderAt(b.id, { x: c.x, y: c.y });
        run(200);
        expect(BoardState.workTokenOf(a.id)).toBe(tree.id);
        expect(BoardState.workTokenOf(b.id)).toBe(null);
        expect(Flags.waitingOf(b.id)).toBe(null);
        expect(BoardRunner.isHeroIdle(b.id)).toBe(true);
        expect(flagStatusLine(b.id)).toBe('Nothing to work near HC Logging Camp');
        expect(dockStatusLine({ state: 'idle', order: 'token', campId: c.id })).toBe('Nothing to work near HC Logging Camp');
    });
});

describe('⭐ a Farmstead harvests the ripe Fields in its reach', () => {
    it('two ripe Fields in turn, each over its load; a Farming station that is not a Field is left alone', () => {
        const [h] = newBoard();
        const c = fixtures.placeAt('hc_farmstead', 600, 500);
        const f1 = fixtures.placeAt('hc_field', 720, 500);
        const f2 = fixtures.placeAt('hc_field', 600, 720);
        const mill = fixtures.placeAt('hc_mill', 480, 500);
        const w = watchCycles();
        expect(Orders.orderAt(h.id, { x: c.x, y: c.y }).success).toBe(true);
        run(6000);
        const cycles = w.stop().map(([, id]) => id);
        // Two harvests each, one Field after the other.
        expect(cycles.length).toBe(4);
        expect(cycles[0]).toBe(cycles[1]);
        expect(cycles[2]).toBe(cycles[3]);
        expect(new Set(cycles)).toEqual(new Set([f1.id, f2.id]));
        expect(cycles).not.toContain(mill.id);
        expect(InventoryManager.getItemCount(WHEAT_ITEM) + 0).toBeGreaterThanOrEqual(0);
    });
});

describe('⭐ refusals', () => {
    it('a camp whose Tokens they can work none of says why (the nearest one’s need); an empty camp takes the order', () => {
        const [h] = newBoard();
        const c = fixtures.placeAt('hc_mining', 600, 500);
        fixtures.placeAt('hc_vein', 700, 500);
        fixtures.placeAt('hc_vein', 600, 700);
        const empty = fixtures.placeAt('hc_mining', 1200, 300);
        expect(Orders.canOrderOnto(h.id, c)).toBe(false);
        expect(Orders.orderAt(h.id, { x: c.x, y: c.y })).toMatchObject({ success: false, reason: 'Needs Pickaxe', instanceId: c.id });
        expect(BoardState.flagOf(h.id)).toBe(null);
        expect(Orders.canOrderOnto(h.id, empty)).toBe(true);
        expect(Orders.orderAt(h.id, { x: empty.x, y: empty.y })).toMatchObject({ success: true, instanceId: empty.id });
    });

    it('a spawner of no enemy is still refused: nothing to work there', () => {
        const [h] = newBoard();
        const grove = fixtures.placeAt('hc_grove', 600, 500);
        expect(Orders.orderAt(h.id, { x: grove.x, y: grove.y })).toMatchObject({ success: false, reason: 'Nothing to work here' });
    });
});

describe('⭐ an enemy camp: the hero hunts what it spawns', () => {
    it('fights what the camp spawned, waits silently for the next spawn, then fights that one; another camp’s enemy is not hunted', () => {
        const [h] = newBoard();
        const den = fixtures.placeAt('hc_den', 600, 500);
        const other = fixtures.placeAt('hc_den', 1300, 300);
        SpawnerSystem.attemptSpawn(den, getTokenType('hc_den'));
        SpawnerSystem.attemptSpawn(other, getTokenType('hc_den'));
        const mine = BoardState.tokens().find(t => t.tether === den.id);
        const theirs = BoardState.tokens().find(t => t.tether === other.id);
        expect(mine && theirs).toBeTruthy();
        expect(Orders.canOrderOnto(h.id, den)).toBe(true);
        expect(Orders.orderAt(h.id, { x: den.x, y: den.y })).toMatchObject({ success: true, instanceId: den.id });
        run(200);
        expect(BoardState.claimOfHero(h.id)?.instanceId).toBe(mine.id);

        // The kill: the goblin was its camp's only one, so they wait for the next.
        let waited = null;
        for (let t = 0; t < 30_000 && BoardState.getTokenById(mine.id); t += 100) GameLoop.runHandlers(100);
        expect(BoardState.getTokenById(mine.id)).toBe(null);
        run(100);
        if (!BoardState.claimOfHero(h.id)) {
            waited = Flags.waitingOf(h.id);
            expect(waited).toMatchObject({ instanceId: den.id, kind: 'spawn', typeId: 'hc_goblin' });
            expect(BoardRunner.isHeroIdle(h.id)).toBe(false);
            expect(flagStatusLine(h.id)).toBe('Waiting for HC Goblin');
            expect(idleMomentOf(waited, 'HC Den', { order: 'token' })).toBe(null);
        }
        // The camp's clock starts once it has room: one whole interval later, the next.
        run(3500);
        const next = BoardState.claimOfHero(h.id)?.instanceId;
        expect(next).toBeTruthy();
        expect(BoardState.getTokenById(next).tether).toBe(den.id);
        expect(BoardState.claimOfHero(h.id)?.instanceId).not.toBe(theirs.id);
        expect(waited).not.toBe(null);
    });
});

describe('⭐ a camp hero comes back from a save working the same Token', () => {
    it('saved mid-work, loaded: the same Token, the order still on the camp', async () => {
        const [h] = newBoard();
        const c = fixtures.placeAt('hc_logging', 600, 500);
        fixtures.placeAt('hc_tree', 700, 500);
        fixtures.placeAt('hc_tree', 600, 700);
        Orders.orderAt(h.id, { x: c.x, y: c.y });
        run(300);
        const held = BoardState.workTokenOf(h.id);
        expect(held).toBeTruthy();
        SaveManager.currentSlot = 1;
        expect(SaveManager.save(false)).toBeTruthy();
        expect(await SaveManager.loadSlot(1, { catchUp: false })).toBe(true);
        run(200);
        expect(Flags.pinnedIdOf(h.id)).toBe(c.id);
        expect(BoardState.workTokenOf(h.id)).toBe(held);
    });
});
