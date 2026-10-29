// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { GAME_VERSION, createEmptyBoard } from '../state/StateSchema.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as Hostiles from '../systems/board/Hostiles.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Growth from '../systems/board/Growth.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { migrateState, migrateBoardToOrders, ORDERS_VERSION } from '../systems/core/SaveMigration.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Hero orders (brief 260 O1): a hero dragged onto a Token works only it; onto bare ground goes
 * there and idles; onto the Hall goes home; a Token they cannot work refuses and they stay. The job
 * stopping leaves them waiting by it, a regrowing tree is followed through its Stump and Sapling,
 * a Token gone for good leaves them needing a job. Heroes with no order wait by the Hall.
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const plain = (id, name, extra) => ({ id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra });
registerTokenTypes({
    ho_tree: plain('ho_tree', 'HO Oak', {
        uses: 2, requiresHero: true, staysPut: true, respawn: { mode: 'regrow', into: 'ho_stump' },
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [],
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }] }
    }),
    ho_stump: plain('ho_stump', 'HO Stump', { grows: { into: 'ho_sapling', afterMs: 5000 } }),
    ho_sapling: plain('ho_sapling', 'HO Sapling', { artSize: 'small', grows: { into: 'ho_tree', afterMs: 5000 } }),
    ho_vein: plain('ho_vein', 'HO Vein', {
        uses: 2, requiresHero: true, needsTool: { kind: 'pickaxe', minTier: 1 },
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [],
            outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }] }
    }),
    ho_bush: plain('ho_bush', 'HO Bush', {
        uses: 1, requiresHero: true,
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [],
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }] }
    }),
    ho_deep: plain('ho_deep', 'HO Deep Tree', {
        uses: 100, requiresHero: true,
        config: { skill: 'forestry', skillRequired: 60, cycleTimeMs: 3000, xp: 1, inputs: [],
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }] }
    })
});

const HALL = { x: 880, y: 560 };
const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) GameLoop.runHandlers(step); };

function newBoard({ hall = true, heroes = 1 } = {}) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    Growth.resetGrowthAlerts();
    if (hall) fixtures.placeAt('bench_hall', HALL.x, HALL.y);
    const made = fixtures.makeHeroes(heroes);
    TileModifiers.rebuildAll();
    return made;
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

describe('⭐ a drop on a Token: they work only it', () => {
    it('works the Token dropped on, never the nearer one of another skill beside it', () => {
        const [h] = newBoard();
        const far = fixtures.placeAt('fixture_producer', 400, 300);
        fixtures.placeAt('bench_mill', 560, 300);         // alchemy, nearer to nothing in particular
        InventoryManager.addItem('fixture_oak_wood', 50);
        const result = Orders.orderAt(h.id, { x: far.x, y: far.y });
        expect(result.success).toBe(true);
        expect(result.order).toBe('token');
        expect(Flags.pinnedIdOf(h.id)).toBe(far.id);
        run(30_000);
        expect(BoardState.workTokenOf(h.id)).toBe(far.id);
        expect(Flags.statusOf(h.id)).toMatchObject({ state: 'working', order: 'token', needsJob: false });
    });

    it('announces hero_deployed once per real order (the tutorial step), not for the same drop again', () => {
        const [h] = newBoard();
        const t = fixtures.placeAt('fixture_producer', 400, 300);
        const seen = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.HERO_DEPLOYED, (p) => seen.push(p));
        Orders.orderAt(h.id, { x: t.x, y: t.y });
        Orders.orderAt(h.id, { x: t.x + 5, y: t.y });   // the same Token again
        off();
        expect(seen).toEqual([{ heroId: h.id, instanceId: t.id, typeId: 'fixture_producer' }]);
    });

    it('a Token they cannot work refuses with the reason, and the hero keeps the order they had', () => {
        const [h] = newBoard();
        const tree = fixtures.placeAt('fixture_producer', 400, 300);
        const vein = fixtures.placeAt('ho_vein', 700, 300);
        const deep = fixtures.placeAt('ho_deep', 1000, 300);
        Orders.orderAt(h.id, { x: tree.x, y: tree.y });
        const noTool = Orders.orderAt(h.id, { x: vein.x, y: vein.y });
        expect(noTool).toMatchObject({ success: false, reason: 'Needs Pickaxe', instanceId: vein.id });
        const level = Orders.orderAt(h.id, { x: deep.x, y: deep.y });
        expect(level).toMatchObject({ success: false, reason: 'Needs Forestry 60/99', instanceId: deep.id });
        expect(Flags.pinnedIdOf(h.id)).toBe(tree.id);
        expect(Orders.canOrderOnto(h.id, vein)).toBe(false);
        expect(Orders.canOrderOnto(h.id, tree)).toBe(true);
    });

    it('something no hero works (a spawner) is refused, not a spot', () => {
        const [h] = newBoard();
        const forest = fixtures.placeAt('bench_forest', 400, 300);
        expect(Orders.orderAt(h.id, { x: forest.x, y: forest.y })).toMatchObject({ success: false, reason: 'Nothing to work here' });
        expect(BoardState.flagOf(h.id)).toBe(null);
    });
});

describe('⭐ a drop on bare ground: go there and idle', () => {
    it('a spot order works nothing, even with work beside it', () => {
        const [h] = newBoard();
        fixtures.placeAt('fixture_producer', 400, 300);
        const result = Orders.orderAt(h.id, { x: 400, y: 460 });
        expect(result).toMatchObject({ success: true, order: 'spot' });
        run(20_000);
        expect(BoardState.workTokenOf(h.id)).toBe(null);
        expect(Flags.statusOf(h.id)).toMatchObject({ state: 'idle', order: 'spot', needsJob: false });
        expect(Flags.waitingOf(h.id)).toBe(null);
        expect(BoardRunner.isHeroIdle(h.id)).toBe(true);
    });

    it('a drop on the Guild Hall sends them home: no order', () => {
        const [h] = newBoard();
        const t = fixtures.placeAt('fixture_producer', 400, 300);
        Orders.orderAt(h.id, { x: t.x, y: t.y });
        run(1000);
        expect(Orders.orderAt(h.id, HALL)).toMatchObject({ success: true, order: 'home' });
        expect(BoardState.flagOf(h.id)).toBe(null);
        expect(BoardState.workTokenOf(h.id)).toBe(null);
        expect(Flags.statusOf(h.id).state).toBe('docked');
    });
});

describe('⭐ when the job stops, the hero waits there', () => {
    it('a Token another hero works: the newcomer waits beside it, and takes it the moment it is free', () => {
        const [a, b] = newBoard({ heroes: 2 });
        const t = fixtures.placeAt('fixture_producer', 400, 300);
        Orders.orderAt(a.id, { x: t.x, y: t.y });
        Orders.orderAt(b.id, { x: t.x, y: t.y });
        run(1000);
        expect(BoardState.workTokenOf(a.id)).toBe(t.id);
        expect(Flags.waitingOf(b.id)).toEqual({ instanceId: t.id, kind: 'busy' });
        expect(BoardRunner.isHeroIdle(b.id)).toBe(false);
        Orders.sendHome(a.id);
        run(1500);
        expect(BoardState.workTokenOf(b.id)).toBe(t.id);
    });

    it('⭐ a felled tree: the order follows it through Stump and Sapling, and they fell it again', () => {
        const [h] = newBoard();
        const tree = fixtures.placeAt('ho_tree', 400, 300);
        Orders.orderAt(h.id, { x: tree.x, y: tree.y });
        run(6500);           // two cycles: felled
        const stump = BoardState.tokensAtPoint(400, 300)[0];
        expect(stump.typeId).toBe('ho_stump');
        expect(Flags.pinnedIdOf(h.id)).toBe(stump.id);
        expect(Flags.waitingOf(h.id)).toEqual({ instanceId: stump.id, kind: 'node' });
        expect(Flags.needsJob(h.id)).toBe(false);
        run(5500);
        const sapling = BoardState.tokensAtPoint(400, 300)[0];
        expect(sapling.typeId).toBe('ho_sapling');
        expect(Flags.pinnedIdOf(h.id)).toBe(sapling.id);
        run(5500);
        const again = BoardState.tokensAtPoint(400, 300)[0];
        expect(again.typeId).toBe('ho_tree');
        run(500);
        expect(BoardState.workTokenOf(h.id)).toBe(again.id);
    });

    it('⭐ a Token gone for good: a spot at its last place, needing a job, until a new order', () => {
        const [h] = newBoard();
        const bush = fixtures.placeAt('ho_bush', 400, 300);
        Orders.orderAt(h.id, { x: bush.x, y: bush.y });
        run(3000);
        expect(BoardState.getTokenById(bush.id)).toBe(null);
        run(200);
        expect(Flags.needsJob(h.id)).toBe(true);
        expect(BoardState.flagOf(h.id)).toMatchObject({ x: 400, y: 300, spot: true, needsJob: true });
        expect(Flags.statusOf(h.id)).toMatchObject({ state: 'idle', needsJob: true });
        expect(BoardRunner.isHeroIdle(h.id)).toBe(true);
        const t = fixtures.placeAt('fixture_producer', 700, 300);
        Orders.orderAt(h.id, { x: t.x, y: t.y });
        expect(Flags.needsJob(h.id)).toBe(false);
    });

    it('a station out of an input: the hero stays at it, waiting', () => {
        const [h] = newBoard();
        const mill = fixtures.placeAt('bench_mill', 400, 300);
        fixtures.placeAt('fixture_producer', 560, 300);
        Orders.orderAt(h.id, { x: mill.x, y: mill.y });
        run(5000);
        expect(Flags.pinnedIdOf(h.id)).toBe(mill.id);
        // Never wanders off to the producer beside it.
        expect(BoardState.claimOfHero(h.id)?.instanceId ?? mill.id).toBe(mill.id);
    });
});

describe('⭐ defeat: heal, then wait at the Hall, the order cleared', () => {
    it('a defeated hero loses their order, limps home, takes no order while healing', () => {
        const [h] = newBoard();
        const t = fixtures.placeAt('fixture_producer', 400, 300);
        Orders.orderAt(h.id, { x: t.x, y: t.y });
        run(500);
        EventBus.publish(BOARD_EVENTS.HERO_DEFEATED, { heroId: h.id, heroName: h.name, lost: [] });
        HeroManager.setHeroStatus(h.id, 'wounded');
        expect(BoardState.flagOf(h.id)).toBe(null);
        const refused = Orders.orderAt(h.id, { x: t.x, y: t.y });
        expect(refused.success).toBe(false);
        expect(refused.reason).toMatch(/is healing: \d+:\d\d/);
    });
});

describe('⭐ hostile enemies ambush a hero working near their camp', () => {
    it('the camp watch, measured to the ordered Token: the hero fights back, then goes back to their job', () => {
        const [h] = newBoard();
        const camp = fixtures.placeAt('bench_camp', 400, 300);
        const tree = fixtures.placeAt('fixture_producer', 560, 300);
        fixtures.prefillSpawners();
        Orders.orderAt(h.id, { x: tree.x, y: tree.y });
        const goblins = BoardState.tokens().filter(t => t.typeId === 'bench_goblin');
        expect(goblins.length).toBeGreaterThan(0);
        expect(Hostiles.watchRadius()).toBe(240);
        run(400);
        const ambusher = Flags.ambusherOf(h.id);
        expect(goblins.map(g => g.id)).toContain(ambusher);
        expect(Flags.pinnedIdOf(h.id)).toBe(tree.id);
        run(60_000);
        // Each goblin fought, then back at the tree.
        expect(Flags.pinnedIdOf(h.id)).toBe(tree.id);
        void camp;
    });

    it('a hero at home by the Hall is never attacked', () => {
        const [h] = newBoard();
        fixtures.placeAt('bench_camp', HALL.x - 300, HALL.y);
        fixtures.prefillSpawners();
        run(2000);
        expect(Flags.ambusherOf(h.id)).toBe(null);
        expect(BoardCombat.fightOfHero(h.id)).toBe(null);
    });
});

describe('⭐ heroes with no order wait by the Hall (walking on)', () => {
    beforeEach(() => BoardState.setInstantArrival(false));

    it('stands at their place in the row in front of the Hall, sets off from there, and walks back', () => {
        const [h] = newBoard();
        run(100);
        const spot = HeroMotion.homeSpot(h.id);
        expect(HeroMotion.isHome(h.id)).toBe(true);
        expect(HeroMotion.heroPointOf(h.id)).toEqual(spot);
        const t = fixtures.placeAt('fixture_producer', 400, 300);
        Orders.orderAt(h.id, { x: t.x, y: t.y });
        expect(HeroMotion.isHome(h.id)).toBe(false);
        run(30_000);
        expect(BoardState.workTokenOf(h.id)).toBe(t.id);
        Orders.sendHome(h.id);
        expect(HeroMotion.isReturning(h.id)).toBe(true);
        run(30_000);
        expect(HeroMotion.isHome(h.id)).toBe(true);
        expect(HeroMotion.isReturning(h.id)).toBe(false);
    });

    it('pottering at home draws nothing from the game’s random stream', () => {
        newBoard({ heroes: 3 });
        const spy = vi.spyOn(Math, 'random');
        HeroMotion.tick(0);
        for (let i = 0; i < 200; i++) HeroMotion.tick(100);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('a spot order: the hero ends standing by the spot, idle', () => {
        const [h] = newBoard();
        Orders.orderAt(h.id, { x: 400, y: 600 });
        expect(Flags.statusOf(h.id).state).toBe('walking');
        run(30_000);
        expect(Flags.statusOf(h.id).state).toBe('idle');
        const at = HeroMotion.heroPointOf(h.id);
        expect(Math.hypot(at.x - (400 + HeroMotion.IDLE_SPOT.dx), at.y - (600 + HeroMotion.IDLE_SPOT.dy))).toBeLessThanOrEqual(HeroMotion.potterRadius() + 1);
    });
});

describe('⭐ old saves: flags and rules become orders', () => {
    it('a pinned flag stays an order on its Token; an area flag becomes a spot where it stood; rules dropped', () => {
        const legacyBoard = {
            ...createEmptyBoard(),
            tokens: { tok_a: { id: 'tok_a', typeId: 'fixture_producer', x: 400, y: 300, placedAt: 1 } },
            flags: {
                hero_p: { x: 400, y: 300, plantedAt: 1, pinnedTo: 'tok_a' },
                hero_a: { x: 900, y: 700, plantedAt: 2 }
            },
            workClaims: { hero_a: { instanceId: 'tok_a', side: 1 } }
        };
        delete legacyBoard.orders;
        const legacy = {
            board: legacyBoard,
            heroes: [{ id: 'hero_p', flagRules: { forestry: { allowed: false, priority: 1 } } }, { id: 'hero_a' }],
            atlas: { activeRegionId: 'region_1', nextRegionNumber: 3, regions: { region_2: { id: 'region_2', board: { tokens: {}, flags: { hero_p: { x: 10, y: 20, plantedAt: 0 } } } } } }
        };
        const out = migrateState(legacy, GAME_VERSION);
        expect(out.board.orders).toBe(ORDERS_VERSION);
        expect(out.board.flags.hero_p).toEqual({ x: 400, y: 300, plantedAt: 1, pinnedTo: 'tok_a' });
        expect(out.board.flags.hero_a).toEqual({ x: 900, y: 700, plantedAt: 2, spot: true });
        expect(out.board.workClaims.hero_a).toBeUndefined();
        expect('flagRules' in out.heroes[0]).toBe(false);
        expect(out.atlas.regions.region_2.board.flags.hero_p).toEqual({ x: 10, y: 20, plantedAt: 0, spot: true });
        expect(out.atlas.regions.region_2.board.orders).toBe(ORDERS_VERSION);
    });

    it('a board made for orders is left as it is, and a new board is made for orders', () => {
        const board = createEmptyBoard();
        expect(board.orders).toBe(ORDERS_VERSION);
        expect(migrateBoardToOrders(board)).toBe(board);
    });

    it('⭐ loaded through the save: the pinned hero works their Token, the area hero idles where it stood', async () => {
        const [p, a] = newBoard({ heroes: 2 });
        const t = fixtures.placeAt('fixture_producer', 400, 300);
        // An old save: a pinned flag, an area flag beside a Token, no `orders`, rules on a hero.
        GameState.state.board.flags[p.id] = { x: t.x, y: t.y, plantedAt: 0, pinnedTo: t.id };
        GameState.state.board.flags[a.id] = { x: 700, y: 300, plantedAt: 1 };
        fixtures.placeAt('fixture_producer', 700, 300);
        delete GameState.state.board.orders;
        GameState.state.heroes[0].flagRules = { combat: { allowed: false, priority: 3 } };
        SaveManager.currentSlot = 1;
        expect(SaveManager.save(false)).toBeTruthy();
        expect(await SaveManager.loadSlot(1, { catchUp: false })).toBe(true);
        run(2000);
        expect(BoardState.workTokenOf(p.id)).toBe(t.id);
        expect(BoardState.flagOf(a.id)).toMatchObject({ x: 700, y: 300, spot: true });
        expect(BoardState.workTokenOf(a.id)).toBe(null);
        expect(GameState.state.heroes.some(h => 'flagRules' in h)).toBe(false);
    });
});

describe('⭐ Atlas: returning to a Region, heroes resume their orders there', () => {
    it('an order left in the Starter Camp is worked again on the way back', () => {
        const [h] = newBoard();
        const t = fixtures.placeAt('fixture_producer', 400, 300);
        Orders.orderAt(h.id, { x: t.x, y: t.y });
        run(500);
        Atlas.ensureState();
        const home = GameState.state.atlas.activeRegionId;
        const other = Atlas.devCreateEmptyRegion();
        expect(Atlas.travel(other.id ?? other).success).toBe(true);
        expect(BoardState.flagOf(h.id)).toBe(null);
        expect(Atlas.travel(home).success).toBe(true);
        run(1000);
        expect(Flags.pinnedIdOf(h.id)).toBe(t.id);
        expect(BoardState.workTokenOf(h.id)).toBe(t.id);
    });
});

void ALERT;
