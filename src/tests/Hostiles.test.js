import { describe, it, expect, beforeEach, beforeAll, afterAll, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as Flags from '../systems/board/Flags.js';
import * as FlagRules from '../systems/board/FlagRules.js';
import * as Hostiles from '../systems/board/Hostiles.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { isHostileEnemy } from '../config/registries/enemyProfile.js';
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
 * B7.2 — **hostile enemies attack; attacked heroes fight back** (TL-16, TL-24,
 * FB-23; owner's "B7 range" and "B7 ambushed").
 *
 * Geometry: flag radius 300 u. The camp stands at (800, 500) and never spawns
 * (its clock is a day long); its goblin is tethered to it. A hero working the
 * Producer at (800, 750) stands about 260 u from the camp — inside. One at
 * (1600, 500) is 800 u away — outside. Heroes and enemies do not stroll.
 */

const DAY = 24 * 60 * 60 * 1000;

registerTokenTypes({
    fixture_hostile_camp: {
        id: 'fixture_hostile_camp', name: 'Fixture Hostile Camp', tokenType: 'resource',
        rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature',
        spawner: { spawns: [{ typeId: 'fixture_goblin', weight: 1 }], allowance: 4, intervalMs: DAY, upkeep: [] }
    },
    /** Hostile, one kill and gone — the Goblin's shape. */
    fixture_goblin: {
        id: 'fixture_goblin', name: 'Fixture Goblin', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 'skill_occult',
        enemy: { level: 1, style: 'melee', budgetScale: 0.3, hostile: true },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    /** The same creature, peaceful (no `hostile`). */
    fixture_peaceful: {
        id: 'fixture_peaceful', name: 'Fixture Peaceful', tokenType: 'enemy',
        rarity: 'common', theme: 'fixture', uses: 1, sprite: 'skill_occult',
        enemy: { level: 1, style: 'melee', budgetScale: 0.3 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }
});

const CAMP = { x: 800, y: 500 };
const NEAR = { x: 800, y: 750 };
const FAR = { x: 1600, y: 500 };

/** A hero who holds a combat skill (and, at level 50, logging for the Producer). */
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

/** A Recruit who logs: no combat skill. */
function recruit(id) {
    return { id, name: id, status: 'idle', level: 50, skills: { logging: { level: 50, xp: 0 } }, hp: { current: 100, max: 100 } };
}

const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) BoardRunner.tick(step); };

/** A camp and one enemy of `typeId` it spawned, standing beside it. */
function campWith(typeId = 'fixture_goblin') {
    const camp = placeAt('fixture_hostile_camp', CAMP.x, CAMP.y);
    const enemy = placeAt(typeId, CAMP.x + 100, CAMP.y);
    enemy.tether = camp.id;
    return { camp, enemy };
}

/** `heroId` logging a Producer at `point`, with Fight switched off unless `fight`. */
function logging(heroId, point, { fight = false, pin = false } = {}) {
    const producer = placeAt('fixture_producer', point.x, point.y);
    if (!fight) Flags.setRule(heroId, FlagRules.FIGHT, { allowed: false });
    Flags.plant(heroId, point, { pin });
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
    setMatTuning('flagRadius', 300);
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

    it('no shipped enemy is hostile yet — content is B7.3, through the CMS', () => {
        for (const id of ['token_goblin', 'token_goblin_chief', 'token_cow', 'token_thorn_elemental']) {
            const def = getTokenType(id);
            if (def) expect(isHostileEnemy(def)).toBe(false);
        }
    });
});

describe('⭐ a hostile enemy attacks a hero inside the flag radius of its spawner (TL-16)', () => {
    it('attacks a hero entering the radius: they drop their work and fight it, Fight rule off or not', () => {
        const { enemy } = campWith();
        const far = logging('h1', FAR);
        run(1000);
        expect(Flags.ambusherOf('h1')).toBeNull();
        expect(BoardState.workTokenOf('h1')).toBe(far.id);

        // The hero's flag moves into range: they settle on the Producer there…
        const near = logging('h1', NEAR);
        near.cycleElapsedMs = 4000;
        // …and on its next look the goblin attacks, whatever the Fight rule says (TL-24).
        expect(Hostiles.scan()).toEqual([{ enemyId: enemy.id, heroId: 'h1' }]);
        expect(FlagRules.ruleOf('h1', FlagRules.FIGHT).allowed).toBe(false);
        expect(Flags.ambusherOf('h1')).toBe(enemy.id);
        expect(BoardState.claimOfHero('h1')?.instanceId).toBe(enemy.id);
        // The fight starts through BoardCombat's normal route on the next tick.
        BoardRunner.tick(1);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(enemy.id);
        // The work they dropped lost its progress, as any hero leaving does (FP-68).
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

    it('a hero with Fight allowed still seeks a peaceful enemy on their own (no ambush)', () => {
        const { enemy } = campWith('fixture_peaceful');
        Flags.plant('h1', { x: CAMP.x + 100, y: CAMP.y + 100 });
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

    it('a docked hero (no flag), or one walking home', () => {
        campWith();
        logging('h1', NEAR);
        Flags.furl('h1');
        expect(Hostiles.scan()).toEqual([]);
        expect(BoardState.claimOfHero('h1')).toBeNull();
    });

    it('a hero who cannot fight (a Recruit would stand frozen: no fight can start)', () => {
        GameState.state.heroes = [recruit('r1')];
        campWith();
        const near = placeAt('fixture_producer', NEAR.x, NEAR.y);
        Flags.plant('r1', NEAR);
        expect(BoardState.workTokenOf('r1')).toBe(near.id);
        run(1000);
        expect(Flags.ambusherOf('r1')).toBeNull();
        expect(BoardState.workTokenOf('r1')).toBe(near.id);
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
    it('while h1 fights the goblin, h2 inside the radius is left alone', () => {
        const { enemy } = campWith();
        Flags.plant('h1', { x: CAMP.x + 100, y: CAMP.y - 100 });   // seeks it, Fight allowed
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
        Flags.plant('h1', { x: peaceful.x, y: peaceful.y + 50 });
        run(200);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(peaceful.id);
        expect(Hostiles.scan()).toEqual([]);
        expect(BoardCombat.getFight(enemy.id)).toBeNull();
        expect(camp.id).toBeTruthy();
    });
});

describe('⭐ fight-back, then back to work (TL-24)', () => {
    it('after the kill the hero returns to their previous work and flag choice', () => {
        const { enemy } = campWith();
        const near = logging('h1', NEAR);
        run(300);
        expect(Flags.ambusherOf('h1')).toBe(enemy.id);

        untilGone(enemy);
        run(300);
        expect(Flags.ambusherOf('h1')).toBeNull();
        expect(BoardState.workTokenOf('h1')).toBe(near.id);
        // Their rules are untouched: Fight is still off.
        expect(FlagRules.ruleOf('h1', FlagRules.FIGHT).allowed).toBe(false);
    });

    it('switching Fight off mid-ambush does not stop the fight-back', () => {
        const { enemy } = campWith();
        logging('h1', NEAR, { fight: true });
        run(300);
        expect(Flags.ambusherOf('h1')).toBe(enemy.id);
        Flags.setRule('h1', FlagRules.FIGHT, { allowed: false });
        run(100);
        expect(BoardCombat.fightOfHero('h1')?.instanceId).toBe(enemy.id);
    });

    it('a pinned hero fights back, then resumes their pin', () => {
        const { enemy } = campWith();
        const pinned = logging('h1', NEAR, { pin: true });
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

    it('a re-plant (the player pulling them away) ends the fight-back at once', () => {
        const { enemy } = campWith();
        logging('h1', NEAR);
        run(300);
        expect(Flags.ambusherOf('h1')).toBe(enemy.id);
        Flags.plant('h1', FAR);
        expect(Flags.ambusherOf('h1')).toBeNull();
        expect(BoardCombat.getFight(enemy.id)).toBeNull();
    });
});
