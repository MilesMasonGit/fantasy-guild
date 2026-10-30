import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as Flags from '../systems/board/Flags.js';
import * as Hostiles from '../systems/board/Hostiles.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes, getTokenType, getAllTokenTypes } from '../config/registries/tokenRegistry.js';
import { isHostileEnemy, isBossEnemy } from '../config/registries/enemyProfile.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));
vi.mock('../systems/combat/DefeatPenalties.js', () => ({
    applyDefeatPenalties: vi.fn(() => [])
}));

/**
 * B7.2 — **hostile enemies attack; attacked heroes fight back** (owner's "B7
 * range" and "B7 ambushed"). Since hero orders (brief 260 O1) the camp watches
 * the Token a hero is ordered onto (its Camp watch, no longer a flag radius),
 * and a hero fights only when sent or attacked.
 */

const DAY = 24 * 60 * 60 * 1000;

registerTokenTypes({
    fixture_hostile_camp: {
        id: 'fixture_hostile_camp', name: 'Fixture Hostile Camp', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        spawner: { spawns: [{ typeId: 'fixture_goblin', weight: 1 }], allowance: 4, intervalMs: DAY, upkeep: [] }
    },
    /** Hostile, one kill and gone — the Goblin's shape. */
    fixture_goblin: {
        id: 'fixture_goblin', name: 'Fixture Goblin', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult',
        enemy: { level: 1, style: 'melee', budgetScale: 0.3, hostile: true },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    /** The same creature, peaceful (no `hostile`). */
    fixture_peaceful: {
        id: 'fixture_peaceful', name: 'Fixture Peaceful', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult',
        enemy: { level: 1, style: 'melee', budgetScale: 0.3 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }
});

const CAMP = { x: 800, y: 500 };
const NEAR = { x: 800, y: 750 };
const FAR = { x: 1600, y: 500 };

/** A hero who holds a combat skill (and, at level 50, forestry for the Producer). */
function fighter(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.name = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    hero.skills.melee = { level: 50, xp: 0 };
    Object.values(hero.skills).forEach(s => { s.level = 50; });
    return hero;
}

/** A logger with no combat skill on their sheet, so they fight at level 1. */
function recruit(id) {
    return { id, name: id, status: 'idle', level: 50, skills: { forestry: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } };
}

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

/** A camp and one enemy of `typeId` it spawned, standing beside it. */
function campWith(typeId = 'fixture_goblin') {
    const camp = placeAt('fixture_hostile_camp', CAMP.x, CAMP.y);
    const enemy = placeAt(typeId, CAMP.x + 100, CAMP.y);
    enemy.tether = camp.id;
    return { camp, enemy };
}

/** `heroId` ordered onto a Producer at `point`, logging it. */
function logging(heroId, point) {
    const producer = placeAt('fixture_producer', point.x, point.y);
    expect(Flags.orderToken(heroId, producer).success).toBe(true);
    expect(BoardState.workTokenOf(heroId)).toBe(producer.id);
    return producer;
}

/** Tick until `enemy` has left the mat (killed out). */
function untilGone(enemy) {
    for (let i = 0; i < 600 && BoardState.getTokenById(enemy.id); i++) run(100);
    expect(BoardState.getTokenById(enemy.id)).toBeNull();
}

beforeAll(() => {
    Flags.init();
    BoardCombat.init();
});
afterAll(() => { Flags.teardown(); resetMatTuning(); });

beforeEach(() => {
    vi.clearAllMocks();
    resetMatTuning();
    setMatTuning('watchRadius', 300);
    setMatTuning('potterRadius', 0);
    setMatTuning('enemyPotterRadius', 0);
    GameState.initNew();
    GameState.state.progress.rosterLimit = 20;
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearMat();
    GameState.state.heroes = [fighter('h1'), fighter('h2')];
    GameState.state.inventory.maxSlots = 50;
});
afterEach(() => EnemyMotion.setRandomForTests());

// ---------------------------------------------------------------------------

describe('the field (enemy.hostile)', () => {
    it('is false by default: missing, false, or anything but a literal true', () => {
        expect(isHostileEnemy(getTokenType('fixture_peaceful'))).toBe(false);
        expect(isHostileEnemy({ enemy: { level: 1, hostile: false } })).toBe(false);
        expect(isHostileEnemy({ enemy: { level: 1, hostile: 'yes' } })).toBe(false);
        expect(isHostileEnemy({ enemy: { level: 1, hostile: true } })).toBe(true);
        expect(isHostileEnemy(getTokenType('fixture_goblin'))).toBe(true);
    });

    it('is never true for something that is not an enemy', () => {
        expect(isHostileEnemy({ hostile: true })).toBe(false);
        expect(isHostileEnemy({ enemy: { hostile: true } })).toBe(false);   // no level: not an enemy
        expect(isHostileEnemy(null)).toBe(false);
    });

    it('B7.3: the Goblin ships hostile; the Goblin Chief (a boss) and every boss never are; Cow and Thorn Elemental stay peaceful', () => {
        const goblin = getTokenType('token_goblin');
        expect(goblin).toBeTruthy();
        expect(isHostileEnemy(goblin)).toBe(true);
        const chief = getTokenType('token_goblin_chief');
        expect(chief).toBeTruthy();
        expect(isBossEnemy(chief)).toBe(true);
        expect(isHostileEnemy(chief)).toBe(false);
        const bosses = Object.values(getAllTokenTypes()).filter((def) => isBossEnemy(def));
        expect(bosses.length).toBeGreaterThan(0);
        for (const def of bosses) expect(isHostileEnemy(def), def.id).toBe(false);
        for (const id of ['token_cow', 'token_thorn_elemental']) {
            const def = getTokenType(id);
            if (def) expect(isHostileEnemy(def)).toBe(false);
        }
    });
});

describe('⭐ a hostile enemy attacks a hero ordered inside its camp\'s watch (TL-16)', () => {
    it('attacks a hero entering the watch: they drop their work and fight it', () => {
        const { enemy } = campWith();
        const far = logging('h1', FAR);
        run(1000);
        expect(Flags.ambusherOf('h1')).toBeNull();
        expect(BoardState.workTokenOf('h1')).toBe(far.id);

        // The hero is ordered into the watch: they settle on the Producer there…
        const near = logging('h1', NEAR);
        near.cycleElapsedMs = 4000;
        // …and on its next look the goblin attacks.
        expect(Hostiles.scan()).toEqual([{ enemyId: enemy.id, heroId: 'h1' }]);
        expect(Flags.ambusherOf('h1')).toBe(enemy.id);
        expect(BoardState.claimOfHero('h1')?.instanceId).toBe(enemy.id);
        // The fight starts through BoardCombat's normal route on the next tick.
        BoardRunner.tick(1);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(enemy.id);
        // The work they dropped lost its progress, as any hero leaving does.
        expect(near.cycleElapsedMs || 0).toBe(0);
    });

    it('does not attack a hero outside the radius', () => {
        campWith();
        const far = logging('h1', FAR);
        run(3000);
        expect(Flags.ambusherOf('h1')).toBeNull();
        expect(BoardState.workTokenOf('h1')).toBe(far.id);
        expect(BoardCombat.fightOfHero('h1')).toBeNull();
    });

    it('an untethered hostile enemy watches the radius around itself', () => {
        const enemy = placeAt('fixture_goblin', CAMP.x, CAMP.y);
        expect(EnemyMotion.spawnerOf(enemy.id)).toBeNull();
        expect(Hostiles.watchCentreOf(enemy)).toEqual({ x: enemy.x, y: enemy.y });
        logging('h1', NEAR);
        run(300);
        expect(Flags.ambusherOf('h1')).toBe(enemy.id);
    });

    it('watches around its SPAWNER, not itself: a hero near the goblin but far from the camp is left alone', () => {
        const { camp, enemy } = campWith();
        // Carry the goblin far from its camp and hold it there for the look.
        BoardState.setTokenPoint(enemy.id, 1500, 500);
        expect(Hostiles.watchCentreOf(enemy)).toEqual({ x: camp.x, y: camp.y });
        logging('h1', { x: 1600, y: 700 });
        expect(Hostiles.scan()).toEqual([]);
    });

    it('picks the nearest hero to the enemy, and one enemy takes one hero', () => {
        const { enemy } = campWith();
        logging('h1', NEAR);
        logging('h2', { x: CAMP.x + 100, y: CAMP.y + 180 });   // nearer the goblin, still inside
        const started = Hostiles.scan();
        expect(started).toEqual([{ enemyId: enemy.id, heroId: 'h2' }]);
        expect(Flags.ambusherOf('h1')).toBeNull();
    });

    it('two hostile enemies never gang up on one hero', () => {
        const { camp, enemy } = campWith();
        const second = placeAt('fixture_goblin', CAMP.x - 100, CAMP.y);
        second.tether = camp.id;
        logging('h1', NEAR);
        const started = Hostiles.scan();
        expect(started).toHaveLength(1);
        expect([enemy.id, second.id]).toContain(started[0].enemyId);
        expect(Hostiles.scan()).toEqual([]);   // the hero is taken; the other goblin waits
    });

    it('looks on its own clock, advanced by the tick’s delta', () => {
        campWith();
        logging('h1', NEAR);
        Hostiles.tick(1);   // the first look on a board is due at once
        expect(Flags.ambusherOf('h1')).not.toBeNull();
    });
});

describe('everyone fights: a gatherer is attacked and defends themselves', () => {
    it('a hero logging inside the radius is attacked and fights back', () => {
        GameState.state.heroes = [recruit('r1')];
        const { enemy } = campWith();
        logging('r1', NEAR);
        expect(Hostiles.scan()).toEqual([{ enemyId: enemy.id, heroId: 'r1' }]);
        expect(Flags.ambusherOf('r1')).toBe(enemy.id);
        BoardRunner.tick(1);
        expect(BoardCombat.fightOfHero('r1')?.instanceId).toBe(enemy.id);
    });
});

describe('with walking (no instant arrival)', () => {
    afterEach(() => BoardState.setInstantArrival(true));

    it('the attacked hero walks up to the enemy, which holds still, and the fight starts on arrival', () => {
        const { enemy } = campWith();
        logging('h1', NEAR);
        BoardState.setInstantArrival(false);
        expect(Hostiles.scan()).toHaveLength(1);
        const at = { x: enemy.x, y: enemy.y };
        BoardRunner.tick(100);
        expect(BoardCombat.fightOfHero('h1')).toBeNull();          // still walking
        expect(EnemyMotion.isHeld(enemy.id)).toBe(true);
        for (let i = 0; i < 100 && !BoardCombat.fightOfHero('h1') && BoardState.getTokenById(enemy.id); i++) BoardRunner.tick(100);
        expect(BoardCombat.fightOfHero('h1')?.instanceId ?? (BoardState.getTokenById(enemy.id) ? null : enemy.id)).toBe(enemy.id);
        expect({ x: enemy.x, y: enemy.y }).toEqual(at);
    });
});

describe('peaceful enemies keep today’s behaviour (FB-23)', () => {
    it('a peaceful enemy never attacks: the hero keeps working', () => {
        const { enemy } = campWith('fixture_peaceful');
        const near = logging('h1', NEAR);
        run(3000);
        expect(Flags.ambusherOf('h1')).toBeNull();
        expect(BoardState.workTokenOf('h1')).toBe(near.id);
        expect(BoardCombat.getFight(enemy.id)).toBeNull();
    });

    it('a hero ordered onto a peaceful enemy fights it (no ambush)', () => {
        const { enemy } = campWith('fixture_peaceful');
        Flags.orderToken('h1', enemy);
        run(200);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(enemy.id);
        expect(Flags.ambusherOf('h1')).toBeNull();
    });
});

describe('who is never attacked', () => {
    it('a wounded hero', () => {
        campWith();
        logging('h1', NEAR);
        GameState.state.heroes[0].status = 'wounded';
        expect(Hostiles.scan()).toEqual([]);
    });

    it('a hero sent to a spot on open ground inside the watch (owner, 2026-10-28)', () => {
        campWith();
        expect(Flags.orderSpot('h1', NEAR).success).toBe(true);
        expect(Hostiles.scan()).toEqual([]);
        run(1000);
        expect(Flags.ambusherOf('h1')).toBeNull();
    });

    it('a hero at home (no order), or one walking home', () => {
        campWith();
        logging('h1', NEAR);
        Flags.furl('h1');
        expect(Hostiles.scan()).toEqual([]);
        expect(BoardState.claimOfHero('h1')).toBeNull();
    });

    it('a disallowed hostile enemy attacks nobody (FP-35)', () => {
        const { enemy } = campWith();
        Flags.setDisallowed(enemy.id, true);
        logging('h1', NEAR);
        run(1000);
        expect(Flags.ambusherOf('h1')).toBeNull();
    });
});

describe('an enemy already fighting does not start a second fight', () => {
    it('while h1 fights the goblin, h2 inside the watch is left alone', () => {
        const { enemy } = campWith();
        Flags.orderToken('h1', enemy);   // sent at it
        run(200);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(enemy.id);

        const near = logging('h2', NEAR);
        run(300);
        expect(Flags.ambusherOf('h2')).toBeNull();
        expect(BoardState.workTokenOf('h2')).toBe(near.id);
        expect(BoardCombat.getFight(enemy.id)?.assignedHeroId).toBe('h1');
    });

    it('a hero already on an enemy is not taken by another', () => {
        const { camp, enemy } = campWith();
        const peaceful = placeAt('fixture_peaceful', CAMP.x, CAMP.y + 200);
        Flags.orderToken('h1', peaceful);
        run(200);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(peaceful.id);
        expect(Hostiles.scan()).toEqual([]);
        expect(BoardCombat.getFight(enemy.id)).toBeNull();
        expect(camp.id).toBeTruthy();
    });
});

describe('⭐ fight-back, then back to work (TL-24)', () => {
    it('after the kill the hero returns to the Token they were ordered onto', () => {
        const { enemy } = campWith();
        const near = logging('h1', NEAR);
        run(300);
        expect(Flags.ambusherOf('h1')).toBe(enemy.id);

        untilGone(enemy);
        run(300);
        expect(Flags.ambusherOf('h1')).toBeNull();
        expect(BoardState.workTokenOf('h1')).toBe(near.id);
    });

    it('a hero ordered onto a Token fights back, then resumes their order', () => {
        const { enemy } = campWith();
        const pinned = logging('h1', NEAR);
        expect(Flags.pinnedIdOf('h1')).toBe(pinned.id);
        run(300);
        expect(Flags.ambusherOf('h1')).toBe(enemy.id);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(enemy.id);
        // Still pinned while fighting back.
        expect(Flags.pinnedIdOf('h1')).toBe(pinned.id);

        untilGone(enemy);
        run(300);
        expect(Flags.pinnedIdOf('h1')).toBe(pinned.id);
        expect(BoardState.workTokenOf('h1')).toBe(pinned.id);
    });

    it('a new order (the player pulling them away) ends the fight-back at once', () => {
        const { enemy } = campWith();
        logging('h1', NEAR);
        run(300);
        expect(Flags.ambusherOf('h1')).toBe(enemy.id);
        Flags.orderSpot('h1', FAR);
        expect(Flags.ambusherOf('h1')).toBeNull();
        expect(BoardCombat.getFight(enemy.id)).toBeNull();
    });
});
