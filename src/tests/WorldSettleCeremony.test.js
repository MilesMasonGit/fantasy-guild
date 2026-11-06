import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import { GameState } from '../state/GameState.js';
import { validateSaveData } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as Occupation from '../systems/board/Occupation.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as World from '../systems/world/World.js';
import * as Arrival from '../systems/world/Arrival.js';
import { fixtureCell } from '../ui/dev/worldDev.js';
import { worldTables } from '../config/registries/worldTablesRegistry.js';
import { MAX_ARRIVAL } from '../config/worldTablesShape.js';
import { COMBAT_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { matW, matH, artRadius, artRadiusOf } from '../config/matGeometry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn(), recordKill: vi.fn(), recordEnemyKill: vi.fn() }
}));

/**
 * ⭐ Settling a place (brief 380 M5; owner's order, 2026-11-05): the gold banner, the title, the
 * heroes walk in, and no fight starts by itself. Here the engine's half: where the arrival's
 * enemies stand (spread out across the mat, every one reachable), that they stand still until a
 * hero is sent, and the heroes' walk in from the mat's foot to their places by the Hall, on a
 * settle only.
 */

const HALL = 'token_guild_hall';
const hallOf = () => BoardState.tokens().find(t => t.typeId === HALL);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** How far out of the Hall's clearing a point is: 1 on its edge. */
const outOfClearing = (p, hall) => Math.hypot((p.x - hall.x) / Arrival.CLEARING.rx, (p.y - hall.y) / Arrival.CLEARING.ry);

function newGame(seed = 4242) {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    EngineBootstrap.createDefaultGameData();
    World.createWorld({ seed });
}

/** `n` heroes on the roster, the first with every skill level `cell` asks. */
function heroes(n, cell = null) {
    GameState.state.progress.rosterLimit = Math.max(4, n);
    const out = [];
    for (let i = 0; i < n; i++) out.push(HeroManager.addHero(generateHero()));
    for (const { skill, level } of cell?.requires?.skills || []) addXP(out[0].id, skill, xpForLevel(level) - (out[0].skills[skill]?.xp || 0));
    return out;
}

function settleRingOne(index = 0) {
    const cell = World.currentWorld().cells.filter(c => c.ring === 1)[index];
    const crew = heroes(3, cell);
    for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty);
    const result = World.settleCell(cell.id);
    expect(result.success, result.reason).toBe(true);
    return { cell, crew, result };
}

/** A fixture place of `kitId` with the largest arrival a place can have, settled for free. */
function settleFixture(kitId, seedSalt) {
    const cell = fixtureCell(kitId);
    cell.seed = (cell.seed ^ Math.imul(seedSalt + 1, 0x9e3779b1)) >>> 0;
    cell.arrival = [{ typeId: cell.arrival[0].typeId, count: MAX_ARRIVAL }];
    const written = World.writePlace(cell, { cellId: null });
    expect(written.success, written.reason).toBe(true);
    const arrived = World.arriveAt(written.region, written.mat);
    expect(arrived.travel.success).toBe(true);
    return { cell, region: written.region, arrival: arrived.arrival };
}

let clock = 0;
function run(ms) {
    for (let t = 0; t < ms; t += 100) {
        BoardRunner.tick(100);
        SpriteLayer.tick(100);
        clock += 100;
    }
}

beforeAll(() => {
    Flags.init();
    Arrival.init();
    BoardCombat.init();
});
afterAll(() => {
    Flags.teardown();
    Arrival.teardown();
    resetMatTuning();
});
beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    clock = 0;
    newGame();
});
afterEach(() => {
    BoardState.setInstantArrival(true);
    HeroMotion.setRandomForTests();
    vi.restoreAllMocks();
});

describe('⭐ the arrival stands spread out across the mat', () => {
    it('⭐ the aims: one to each share of the circle round the Hall, out of its clearing, short of the margin, apart, for any seed and count', () => {
        const w = matW();
        const h = matH();
        const centre = { x: w / 2, y: h / 2 };
        let closest = Infinity;
        for (let seed = 0; seed < 2000; seed++) {
            for (let n = 1; n <= MAX_ARRIVAL; n++) {
                const spots = Arrival.spreadOf(seed * 7919 + n, n, { w, h, centre });
                expect(spots).toHaveLength(n);
                for (const p of spots) {
                    expect(p.x).toBeGreaterThanOrEqual(Arrival.SPREAD_MARGIN - 1);
                    expect(p.x).toBeLessThanOrEqual(w - Arrival.SPREAD_MARGIN + 1);
                    expect(p.y).toBeGreaterThanOrEqual(Arrival.SPREAD_MARGIN - 1);
                    expect(p.y).toBeLessThanOrEqual(h - Arrival.SPREAD_MARGIN + 1);
                    expect(outOfClearing(p, centre)).toBeGreaterThan(1);
                }
                // One to a share: sorted round the Hall, no two closer than half a share.
                const angles = spots.map(p => Math.atan2(p.y - centre.y, p.x - centre.x)).sort((a, b) => a - b);
                for (let i = 1; i < angles.length; i++) expect(angles[i] - angles[i - 1]).toBeGreaterThan(Math.PI / n - 1e-6);
                for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) closest = Math.min(closest, dist(spots[i], spots[j]));
            }
        }
        // Never two in one place: further apart than two enemies' art across.
        expect(closest).toBeGreaterThan(2 * artRadiusOf('token_goblin'));
    });

    it('the same place always stands them the same way, and no random number is drawn', () => {
        const spy = vi.spyOn(Math, 'random');
        expect(Arrival.spreadOf(77, 5)).toEqual(Arrival.spreadOf(77, 5));
        expect(Arrival.spreadOf(77, 5)).not.toEqual(Arrival.spreadOf(78, 5));
        expect(spy).not.toHaveBeenCalled();
    });

    it('⭐ on a settled place: each alone, round the Hall rather than in one lair, out of the Hall\'s clearing', () => {
        const { cell, result } = settleRingOne();
        const enemies = result.arrival.ids.map(id => BoardState.getTokenById(id));
        expect(enemies.length).toBe(cell.arrival.reduce((n, r) => n + r.count, 0));
        const hall = hallOf();
        for (const e of enemies) expect(outOfClearing(e, hall)).toBeGreaterThan(0.95);
        for (let i = 0; i < enemies.length; i++) {
            for (let j = i + 1; j < enemies.length; j++) expect(dist(enemies[i], enemies[j])).toBeGreaterThan(2 * artRadiusOf(enemies[i].typeId));
        }
        // On more than one side of the Hall.
        expect(new Set(enemies.map(e => Math.sign(e.x - hall.x))).size).toBe(2);
    });
});

describe('⭐ every enemy can be reached', () => {
    /** Every enemy of the live mat's arrival: placed, its art whole on the mat, out of the Hall's clearing. */
    function expectStandsWell(arrival, where) {
        expect(arrival.unplaced, where).toEqual([]);
        const hall = hallOf();
        for (const id of arrival.ids) {
            const enemy = BoardState.getTokenById(id);
            const r = artRadiusOf(enemy.typeId);
            expect(enemy.x - r, `${where} ${id}`).toBeGreaterThanOrEqual(0);
            expect(enemy.y - r, `${where} ${id}`).toBeGreaterThanOrEqual(0);
            expect(enemy.x + r, `${where} ${id}`).toBeLessThanOrEqual(matW());
            expect(enemy.y + r, `${where} ${id}`).toBeLessThanOrEqual(matH());
            expect(outOfClearing(enemy, hall), `${where} ${id}`).toBeGreaterThan(0.9);
            expect(Occupation.isArrivalId(id)).toBe(true);
        }
    }

    /**
     * Send `runner` at each enemy in turn, walking: each order is taken, and the hero walks there
     * and starts that fight. Then home again, healed. Returns the longest walk in game ms.
     */
    function reachEach(runner, arrival, where) {
        let slowest = 0;
        const hero = GameState.heroes.find(h => h.id === runner.id);
        // Strong enough that no first blow out there knocks them down between two orders.
        hero.skills[COMBAT_SKILL_IDS[0]] = { xp: 0, level: 99 };
        for (const id of arrival.ids) {
            hero.hp.max = Math.max(hero.hp.max, 100_000);
            hero.hp.current = hero.hp.max;
            const enemy = BoardState.getTokenById(id);
            expect(Flags.orderRefusal(runner.id, enemy), `${where} ${id}`).toBeNull();
            expect(Flags.orderToken(runner.id, enemy).success).toBe(true);
            const start = clock;
            while (BoardCombat.fightOfHero(runner.id)?.instanceId !== id && clock - start < 40_000) run(100);
            expect(BoardCombat.fightOfHero(runner.id)?.instanceId, `${where}: the hero reaches ${id}`).toBe(id);
            slowest = Math.max(slowest, clock - start);
            Flags.sendHome(runner.id);
            run(100);
            expect(hero.status, `${where}: knocked down at ${id}`).not.toBe('wounded');
        }
        return slowest;
    }

    const travelHome = () => expect(Atlas.travel(Atlas.list().find(r => r.kind === Atlas.REGION_KIND.STARTER).id).success).toBe(true);

    /**
     * Over many places (every kit, the largest arrival there is, a new seed each): every enemy is
     * put on the mat, its art whole on it, out of the Hall's clearing, and a hero sent at it walks
     * there and starts the fight.
     */
    it('⭐ over 60 written places of every kit, every enemy stands on the mat and a hero sent at it reaches it', () => {
        BoardState.setInstantArrival(false);
        setMatTuning('potterRadius', 0);
        const kits = worldTables().kits.map(k => k.id);
        const [runner] = heroes(1);
        let enemiesSeen = 0;
        let slowest = 0;
        for (let i = 0; i < 60; i++) {
            const { arrival } = settleFixture(kits[i % kits.length], i);
            expect(arrival.ids).toHaveLength(MAX_ARRIVAL);
            expectStandsWell(arrival, `place ${i}`);
            slowest = Math.max(slowest, reachEach(runner, arrival, `place ${i}`));
            enemiesSeen += arrival.ids.length;
            travelHome();
        }
        expect(enemiesSeen).toBe(60 * MAX_ARRIVAL);
        // Real walks: the longest a fair way across the mat, never longer than across the whole of it.
        expect(slowest).toBeGreaterThan(3000);
        expect(slowest).toBeLessThan(Math.hypot(matW(), matH()) / HeroMotion.walkSpeed() * 1000 + 1000);
    }, 240_000);

    it('⭐ over 40 worlds: every ring-1 place settled, and a ring-2, a ring-3 and every odd-layout wild place written and arrived at; every enemy placed, on the mat and out of the clearing, and those further out each reached', () => {
        const counts = { ring1: 0, ring2: 0, ring3: 0, wild: 0, enemies: 0, reached: 0 };
        for (let seed = 1; seed <= 40; seed++) {
            BoardState.setInstantArrival(true);
            newGame(seed * 101);
            const world = World.currentWorld();
            const crew = heroes(1);
            for (const cell of world.cells.filter(c => c.ring === 1)) {
                for (const { skill, level } of cell.requires.skills) addXP(crew[0].id, skill, Math.max(0, xpForLevel(level) - (GameState.heroes[0].skills[skill]?.xp || 0)));
                for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty);
                const result = World.settleCell(cell.id);
                expect(result.success, `${seed} ${cell.id}: ${result.reason}`).toBe(true);
                expect(result.arrival.ids.length).toBe(cell.arrival.reduce((n, r) => n + r.count, 0));
                expectStandsWell(result.arrival, `world ${seed} ${cell.id}`);
                counts.ring1++;
                counts.enemies += result.arrival.ids.length;
            }
            // Further out, past what this guild could pay for: written and arrived at directly.
            const further = [
                world.cells.find(c => c.ring === 2),
                world.cells.find(c => c.ring === 3),
                ...world.cells.filter(c => c.wild && c.extreme?.kind === 'layout')
            ].filter(Boolean);
            BoardState.setInstantArrival(false);
            for (const cell of further) {
                const written = World.writePlace(cell, { cellId: cell.id });
                expect(written.success, `${seed} ${cell.id}`).toBe(true);
                const { travel, arrival } = World.arriveAt(written.region, written.mat);
                expect(travel.success).toBe(true);
                expect(arrival.ids.length).toBe(cell.arrival.reduce((n, r) => n + r.count, 0));
                const where = `world ${seed} ${cell.id} (${cell.wild ? cell.extreme.layout : `ring ${cell.ring}`})`;
                expectStandsWell(arrival, where);
                reachEach(crew[0], arrival, where);
                counts[cell.wild ? 'wild' : `ring${cell.ring}`]++;
                counts.enemies += arrival.ids.length;
                counts.reached += arrival.ids.length;
                travelHome();
            }
        }
        expect(counts.ring1).toBe(40 * 6);
        expect(counts.ring2).toBe(40);
        expect(counts.ring3).toBe(40);
        expect(counts.wild).toBeGreaterThan(0);
        if (process.env.FG_M5_OUT) fs.writeFileSync(process.env.FG_M5_OUT, JSON.stringify(counts));
    }, 600_000);
});

describe('⭐ no fight starts by itself', () => {
    it('⭐ five minutes after settling with no order given: no fight, every enemy where it stood, every hero idle at the Hall', () => {
        BoardState.setInstantArrival(false);
        const { result, crew } = settleRingOne();
        const stood = new Map(result.arrival.ids.map(id => [id, { ...BoardState.getTokenById(id) }]));
        run(5 * 60_000);
        for (const [id, at] of stood) {
            const enemy = BoardState.getTokenById(id);
            expect(enemy, id).toBeTruthy();
            expect({ x: enemy.x, y: enemy.y }).toEqual({ x: at.x, y: at.y });
            expect(BoardCombat.getFight(id)).toBeFalsy();
        }
        for (const hero of crew) {
            expect(BoardCombat.fightOfHero(hero.id)).toBeFalsy();
            expect(BoardState.flagOf(hero.id)).toBeNull();
            expect(HeroMotion.isHome(hero.id)).toBe(true);
        }
        expect(Occupation.isOccupied()).toBe(true);
    }, 60_000);
});

describe('⭐ the heroes walk in', () => {
    it('⭐ off the mat at first, then one after another from its foot below the Hall, each to their place by it', () => {
        BoardState.setInstantArrival(false);
        setMatTuning('potterRadius', 0);
        const { result, crew } = settleRingOne();
        expect(result.walkIn).toEqual(crew.map(h => h.id));
        for (const hero of crew) {
            expect(HeroMotion.bodyView(hero.id)).toBeNull();
            expect(HeroMotion.isWaitingToWalkIn(hero.id)).toBe(true);
        }
        // The foot: straight below the Hall, a hero's whole art on the mat.
        const foot = HeroMotion.walkInPoint();
        expect(foot).toEqual({ x: hallOf().x, y: matH() - artRadius(1) });

        run(HeroMotion.WALK_IN.firstMs - 100);
        expect(HeroMotion.bodyView(crew[0].id)).toBeNull();
        run(100);
        // The first steps on at the foot, heading home; the second is still to come.
        expect(HeroMotion.bodyView(crew[0].id)).toMatchObject({ homeward: true });
        expect(dist(HeroMotion.bodyView(crew[0].id), foot)).toBeLessThanOrEqual(HeroMotion.walkSpeed() * 0.1 + 1e-6);
        expect(HeroMotion.bodyView(crew[1].id)).toBeNull();
        run(HeroMotion.WALK_IN.gapMs);
        expect(HeroMotion.bodyView(crew[1].id)).toMatchObject({ homeward: true });

        run(10_000);
        for (const hero of crew) {
            expect(HeroMotion.isHome(hero.id)).toBe(true);
            expect(HeroMotion.isWaitingToWalkIn(hero.id)).toBe(false);
            // At their place, or pottering a step from it.
            expect(dist(HeroMotion.bodyView(hero.id), HeroMotion.homeSpot(hero.id))).toBeLessThanOrEqual(HeroMotion.HOME_POTTER + 1e-6);
            expect(Flags.statusOf(hero.id).order).toBeNull();
        }
    });

    it('a hero sent at an enemy before their turn sets off from the Hall, and never walks in afterwards', () => {
        BoardState.setInstantArrival(false);
        const { result, crew } = settleRingOne();
        const last = crew[crew.length - 1];
        const enemy = BoardState.getTokenById(result.arrival.ids[0]);
        expect(Flags.orderToken(last.id, enemy).success).toBe(true);
        expect(HeroMotion.isWaitingToWalkIn(last.id)).toBe(false);
        const hall = hallOf();
        expect(HeroMotion.bodyView(last.id)).toMatchObject({ x: hall.x, y: hall.y });
        run(20_000);
        expect(BoardCombat.fightOfHero(last.id)?.instanceId ?? BoardState.flagOf(last.id)?.pinnedTo).toBeTruthy();
        expect(HeroMotion.bodyView(last.id)?.homeward).toBeFalsy();
    });

    it('⭐ travel to a place settled before: no walk in, the heroes stand at home at once', () => {
        BoardState.setInstantArrival(false);
        const { result, crew } = settleRingOne();
        run(10_000);
        const home = Atlas.list().find(r => r.kind === Atlas.REGION_KIND.STARTER).id;
        expect(Atlas.travel(home).success).toBe(true);
        run(100);
        for (const hero of crew) expect(HeroMotion.isHome(hero.id)).toBe(true);
        expect(Atlas.travel(result.region.id).success).toBe(true);
        for (const hero of crew) expect(HeroMotion.isWaitingToWalkIn(hero.id)).toBe(false);
        run(100);
        for (const hero of crew) {
            expect(HeroMotion.isHome(hero.id)).toBe(true);
            const at = HeroMotion.bodyView(hero.id);
            expect({ x: at.x, y: at.y }).toEqual(HeroMotion.homeSpot(hero.id));
        }
    });

    it('a load while they walk in stands them at home', async () => {
        BoardState.setInstantArrival(false);
        const { crew } = settleRingOne();
        run(HeroMotion.WALK_IN.firstMs + 100);
        const data = JSON.parse(GameState.serializeJson());
        const state = migrateState(data.state, data.version);
        expect(validateSaveData({ version: data.version, state }).errors).toEqual([]);
        await GameState.initFromSave(state);
        for (const hero of crew) expect(HeroMotion.isWaitingToWalkIn(hero.id)).toBe(false);
        run(100);
        for (const hero of crew) expect(HeroMotion.isHome(hero.id)).toBe(true);
    });

    it('⭐ orders on arriving: the heroes bring none; each order stays in the place it was given, and is there again on going back', () => {
        const cell = World.currentWorld().cells.filter(c => c.ring === 1)[0];
        const crew = heroes(2, cell);
        const spot = { x: 300, y: 300 };
        expect(Flags.orderSpot(crew[1].id, spot).success).toBe(true);
        for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty);
        const result = World.settleCell(cell.id);
        expect(result.success).toBe(true);
        for (const hero of crew) expect(BoardState.flagOf(hero.id)).toBeNull();
        const home = Atlas.list().find(r => r.kind === Atlas.REGION_KIND.STARTER).id;
        expect(Atlas.travel(home).success).toBe(true);
        expect(BoardState.flagOf(crew[1].id)).toMatchObject({ ...spot, spot: true });
        expect(BoardState.flagOf(crew[0].id)).toBeNull();
    });

    it('nothing walks in with instant arrival (the tests\' switch) or with no Hall on the mat', () => {
        const { result } = settleRingOne();
        expect(result.walkIn).toEqual([]);
        BoardState.setInstantArrival(false);
        BoardState.removeToken(hallOf().id);
        expect(HeroMotion.walkIn()).toEqual([]);
        expect(HeroMotion.walkInPoint()).toBeNull();
    });
});
