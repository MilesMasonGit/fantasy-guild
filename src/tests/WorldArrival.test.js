import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { validateSaveData } from '../state/StateSchema.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as Occupation from '../systems/board/Occupation.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { addXP } from '../systems/hero/SkillSystem.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as World from '../systems/world/World.js';
import * as Arrival from '../systems/world/Arrival.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { isEnemyDef } from '../config/registries/enemyProfile.js';
import { COMBAT_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { matW, matH } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn(), recordKill: vi.fn(), recordEnemyKill: vi.fn() }
}));

/**
 * ⭐ A settled place arrives occupied: its enemies stand in a lair on the mat, one
 * use each and no camp; until every one is beaten the mat is held (heroes may fight and nothing
 * else) and drawn dark; a hero whose enemy falls takes on the next; the last one beaten clears it.
 */

const SEED = 4242;

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    BoardCombat.clearAll();
    EngineBootstrap.createDefaultGameData();
    World.createWorld({ seed: SEED });
}

/** A hero at every skill level `cell` asks for, and fit to fight: a combat skill at 40, food in hand. */
function heroFor(cell) {
    GameState.state.progress.rosterLimit = 4;
    const hero = HeroManager.addHero(generateHero());
    for (const { skill, level } of cell.requires.skills) addXP(hero.id, skill, xpForLevel(level) - (hero.skills[skill]?.xp || 0));
    return hero;
}

function fitToFight(hero) {
    GameState.heroes.find(h => h.id === hero.id).skills[COMBAT_SKILL_IDS[0]] = { xp: 0, level: 40 };
    InventoryManager.addItem('item_steak', 10);
    expect(EquipmentManager.equipItem(hero.id, 'item_steak').success).toBe(true);
}

function settleFirst() {
    const cell = World.currentWorld().cells.find(c => c.ring === 1);
    const hero = heroFor(cell);
    for (const { itemId, qty } of cell.requires.items) InventoryManager.addItem(itemId, qty);
    const result = World.settleCell(cell.id);
    expect(result.success, result.reason).toBe(true);
    return { cell, hero, result };
}

/** Take an enemy off as a kill does (`BoardCombat.resolveVictory` on its last use). */
function beat(enemy) {
    BoardState.removeToken(enemy.id);
    EventBus.publish(BOARD_EVENTS.TOKEN_DEPLETED, { instanceId: enemy.id, x: enemy.x, y: enemy.y, typeId: enemy.typeId, exhaustedBy: 'test' });
}

const arrivalCount = (cell) => cell.arrival.reduce((n, r) => n + r.count, 0);

beforeAll(() => {
    Flags.init();
    Arrival.init();
});
afterAll(() => {
    Flags.teardown();
    Arrival.teardown();
    resetMatTuning();
});
beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    newGame();
});
afterEach(() => vi.restoreAllMocks());

describe('⭐ the arrival on a settled place', () => {
    it('⭐ its enemies stand on the mat, together, one use each and tied to no camp', () => {
        const { cell, result } = settleFirst();
        const ids = result.arrival.ids;
        expect(ids).toHaveLength(arrivalCount(cell));
        expect(ids.length).toBeGreaterThanOrEqual(3);
        expect(result.arrival.unplaced).toEqual([]);
        const enemies = ids.map(id => BoardState.getTokenById(id));
        for (const e of enemies) {
            expect(isEnemyDef(getTokenType(e.typeId)), e.typeId).toBe(true);
            expect(e.usesRemaining).toBe(1);
            expect(e.tether).toBeNull();
            expect(e.arrival).toBe(true);
        }
        const kinds = {};
        for (const e of enemies) kinds[e.typeId] = (kinds[e.typeId] || 0) + 1;
        expect(kinds).toEqual(Object.fromEntries(cell.arrival.map(r => [r.typeId, r.count])));
        // In one lair, out from the Hall.
        const lair = Arrival.lairOf(result.region.seed);
        for (const e of enemies) expect(Math.hypot(e.x - lair.x, e.y - lair.y)).toBeLessThan(400);
        expect(Math.hypot(lair.x - matW() / 2, lair.y - matH() / 2)).toBeGreaterThan(250);
        expect(GameState.state.board.arrival).toEqual({ ids, cleared: false });
    });

    it('⭐ holds the mat: a hero may be sent at an enemy and at nothing else, and says why', () => {
        const { hero } = settleFirst();
        expect(Occupation.isOccupied()).toBe(true);
        const node = BoardState.tokens().find(t => BoardState.isFixture(t));
        const enemy = Occupation.standingEnemies()[0];
        expect(Flags.orderRefusal(hero.id, node)).toEqual({ reason: Flags.SKIP.OCCUPIED });
        expect(Orders.refusalText(hero.id, node, Flags.SKIP.OCCUPIED)).toBe('Beat the enemies here first');
        expect(Flags.orderRefusal(hero.id, enemy)).toBeNull();
        const hall = BoardState.tokens().find(t => t.typeId === 'token_guild_hall');
        expect(Occupation.holds(hall)).toBe(false);
        expect(Occupation.isHeldType(node.typeId)).toBe(true);
        expect(Occupation.isHeldType(enemy.typeId)).toBe(false);
        expect(Occupation.isHeldType('token_guild_hall')).toBe(false);
    });

    it('⭐ the last enemy beaten clears it: announced, said to the player, and the mat is the guild\'s', () => {
        const { hero } = settleFirst();
        const reasons = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.ATLAS_CHANGED, (d) => reasons.push(d.reason));
        const standing = Occupation.standingEnemies();
        try {
            for (const e of standing.slice(0, -1)) beat(e);
            expect(Occupation.isOccupied()).toBe(true);
            expect(reasons).toEqual([]);
            beat(standing[standing.length - 1]);
        } finally {
            off();
        }
        expect(reasons).toEqual(['cleared']);
        expect(GameState.state.board.arrival.cleared).toBe(true);
        expect(NotificationSystem.notify).toHaveBeenCalledWith(expect.stringMatching(/enemies are beaten/), 'success');
        const node = BoardState.tokens().find(t => BoardState.isFixture(t));
        expect(Flags.orderRefusal(hero.id, node)?.reason).not.toBe(Flags.SKIP.OCCUPIED);
    });

    it('a mat with no arrival, or one already cleared, holds nothing', () => {
        expect(Occupation.isOccupied()).toBe(false);
        expect(Occupation.holds(BoardState.tokens()[0])).toBe(false);
        expect(Arrival.checkCleared()).toBe(false);
        expect(Arrival.occupy([], { seed: 1 })).toEqual({ ids: [], unplaced: [] });
        expect(GameState.state.board.arrival).toBeUndefined();
    });

    it('stays held across a travel away and back, and a save and a load', async () => {
        const { result } = settleFirst();
        const home = Atlas.list().find(r => r.kind === Atlas.REGION_KIND.STARTER).id;
        expect(Atlas.travel(home).success).toBe(true);
        expect(Occupation.isOccupied()).toBe(false);
        expect(Atlas.travel(result.region.id).success).toBe(true);
        expect(Occupation.isOccupied()).toBe(true);
        expect(Occupation.standingEnemies()).toHaveLength(result.arrival.ids.length);

        const data = JSON.parse(GameState.serializeJson());
        const state = migrateState(data.state, data.version);
        expect(validateSaveData({ version: data.version, state }).errors).toEqual([]);
        await GameState.initFromSave(state);
        expect(GameState.state.board.arrival).toEqual({ ids: result.arrival.ids, cleared: false });
        expect(Occupation.isOccupied()).toBe(true);
        expect(Occupation.standingEnemies()).toHaveLength(result.arrival.ids.length);
    });

    it('a load that finds every enemy gone clears the mat quietly', () => {
        settleFirst();
        for (const e of Occupation.standingEnemies()) BoardState.removeToken(e.id);
        expect(Occupation.isOccupied()).toBe(true);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, {});
        expect(Occupation.isOccupied()).toBe(false);
        expect(NotificationSystem.notify).not.toHaveBeenCalled();
    });
});

describe('⭐ heroes sent at the arrival keep fighting', () => {
    it('⭐ a hero whose enemy falls takes on the nearest one still standing', () => {
        const { hero } = settleFirst();
        const [first, ...rest] = Occupation.standingEnemies();
        expect(Flags.orderToken(hero.id, first).success).toBe(true);
        beat(first);
        Flags.assign(100);
        const nearest = [...rest].sort((a, b) => Math.hypot(a.x - first.x, a.y - first.y) - Math.hypot(b.x - first.x, b.y - first.y))[0];
        expect(BoardState.flagOf(hero.id).pinnedTo).toBe(nearest.id);
        expect(Flags.needsJob(hero.id)).toBe(false);
    });

    it('once the last falls the hero waits where it stood, needing a job, as after any enemy', () => {
        const { hero } = settleFirst();
        const standing = Occupation.standingEnemies();
        for (const e of standing.slice(0, -1)) beat(e);
        const last = standing[standing.length - 1];
        expect(Flags.orderToken(hero.id, last).success).toBe(true);
        beat(last);
        Flags.assign(100);
        expect(BoardState.flagOf(hero.id).pinnedTo).toBeUndefined();
        expect(Flags.needsJob(hero.id)).toBe(true);
    });

    it('an enemy that is no arrival\'s ends its order as before', () => {
        const { hero } = settleFirst();
        const stray = BoardState.createTokenInstance('token_goblin', 1, null, BoardState.ORIGIN.SPAWNED);
        stray.tether = null;
        BoardState.addToken(stray, 300, 300);
        expect(Flags.orderToken(hero.id, stray).success).toBe(true);
        beat(stray);
        Flags.assign(100);
        expect(Flags.needsJob(hero.id)).toBe(true);
    });

    it('⭐ through real fights: one hero sent at one enemy beats the whole lair and the mat clears', () => {
        const { hero } = settleFirst();
        fitToFight(hero);
        const pins = [];
        const first = Occupation.standingEnemies()[0];
        expect(Flags.orderToken(hero.id, first).success).toBe(true);
        for (let t = 0; t < 20 * 60_000 && Occupation.isOccupied(); t += 100) {
            BoardRunner.tick(100);
            SpriteLayer.tick(100);
            const pin = BoardState.flagOf(hero.id)?.pinnedTo;
            if (pin && pins[pins.length - 1] !== pin) pins.push(pin);
        }
        expect(Occupation.isOccupied()).toBe(false);
        expect(Occupation.standingEnemies()).toEqual([]);
        expect(pins).toEqual(GameState.state.board.arrival.ids.filter(id => pins.includes(id)));
        expect(pins.length).toBe(GameState.state.board.arrival.ids.length);
    }, 120_000);
});
