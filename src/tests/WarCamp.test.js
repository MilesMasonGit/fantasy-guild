// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import * as Camps from '../systems/board/Camps.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as FightRoom from '../systems/board/FightRoom.js';
import * as Occupation from '../systems/board/Occupation.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { campOf, isWarCamp } from '../config/registries/tokenConstants.js';
import { COMBAT_SKILL_IDS } from '../config/registries/skillRegistry.js';
import { STANDARD_REACH_U } from '../config/registries/reachRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { flagStatusLine } from '../ui/components/board/flagText.js';
import { cardLifecycle } from '../ui/components/board/tokenCard.js';
import { marksFor } from '../ui/components/board/dragHints.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * The War Camp (brief 630 B2): a camp whose skill is a combat style. A hero sent to it fights every
 * enemy in its reach, one at a time, in the style of the weapon in their hands, as a camp works its
 * Tokens: the nearest free enemy from where they stand, kept until it falls, then the next; with
 * none left they wait at the camp like any idle camp hero, and take an enemy that later comes into
 * its reach. Enemies stand still (brief 500): the hero goes to them. A knocked-out hero stops as
 * any does. Checked against the other ways a fight is started: a hero sent straight at an enemy, a
 * hunter at an enemy camp, a crowded fight's step to open space, and a mat held by its arrival.
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const camp = (id, name, skill) => ({
    id, name, tokenType: 'camp', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
    requiresHero: false, config: null, camp: { skill }
});
const enemyConfig = { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] };
const enemy = (id, name, extra = {}) => ({
    id, name, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult',
    enemy: { level: 1, style: 'melee', budgetScale: 0.3 }, config: enemyConfig, ...extra
});

registerTokenTypes({
    wc_war: camp('wc_war', 'WC War Camp', 'melee'),
    /** Any combat style marks a War Camp: the style is only the mark. */
    wc_war_magic: camp('wc_war_magic', 'WC Magic War Camp', 'magic'),
    wc_logging: camp('wc_logging', 'WC Logging Camp', 'forestry'),
    wc_goblin: enemy('wc_goblin', 'WC Goblin'),
    /** Three lives: beaten three times before it leaves the mat. */
    wc_ogre: enemy('wc_ogre', 'WC Ogre', { uses: 3 }),
    /** An enemy whose work names a skill and a level (no enemy should): a hero sent straight at it is never asked for them. */
    wc_gated_goblin: enemy('wc_gated_goblin', 'WC Gated Goblin', { config: { ...enemyConfig, skill: 'melee', skillRequired: 50 } }),
    /** Far too strong for a level 1 hero. */
    wc_brute: enemy('wc_brute', 'WC Brute', { enemy: { level: 60, style: 'melee', budgetScale: 1 } }),
    wc_tree: {
        id: 'wc_tree', name: 'WC Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 3, sprite: 's_nature',
        requiresHero: true, config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] }
    },
    wc_den: {
        id: 'wc_den', name: 'WC Den', tokenType: 'spawner', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'wc_goblin', weight: 1 }], allowance: 1, intervalMs: 3000, upkeep: [] }
    }
});

/** The Hall stands well away, so nothing here is measured from it by accident. */
const HALL = { x: 1700, y: 900 };
const CAMP = { x: 600, y: 500 };
const SKILLS = { forestry: 10, melee: 25 };
const run = (ms, step = 100) => { for (let t = 0; t < ms; t += step) GameLoop.runHandlers(step); };
/** Tick until `done()` holds or `maxMs` of game time has passed; the time it took, or -1. */
function runUntil(done, maxMs = 120_000, step = 100) {
    for (let t = 0; t <= maxMs; t += step) {
        if (done()) return t;
        GameLoop.runHandlers(step);
    }
    return done() ? maxMs : -1;
}

function newBoard(heroes = 1, skills = SKILLS) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    BoardCombat.clearAll();
    fixtures.placeAt('bench_hall', HALL.x, HALL.y);
    const made = fixtures.makeHeroes(heroes, skills);
    TileModifiers.rebuildAll();
    return made;
}

/** An enemy put on the mat by hand: tied to no camp (an enemy camp's own come from `attemptSpawn`). */
function placeEnemy(typeId, x, y) {
    const t = fixtures.placeAt(typeId, x, y);
    BoardState.setTether(t, null);
    return t;
}

/** Every fight engaged, as `[heroId, instanceId]`, and every kill, in order. */
function watchFights() {
    const engaged = [];
    const kills = [];
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, (p) => engaged.push([p.heroId, p.instanceId])),
        EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, (p) => { if (p.outcome === 'victory') kills.push([p.heroId, p.instanceId]); })
    ];
    return { engaged, kills, stop: () => offs.forEach(off => off()) };
}

/** Each enemy a hero claimed, in order, sampled every tick while `ms` runs (or until `done`). */
function claimsOver(heroId, ms, done = () => false) {
    const seq = [];
    for (let t = 0; t < ms && !done(); t += 100) {
        GameLoop.runHandlers(100);
        const id = BoardState.claimOfHero(heroId)?.instanceId ?? null;
        if (id && seq[seq.length - 1] !== id) seq.push(id);
    }
    return seq;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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

describe('⭐ the mark: a camp whose skill is a combat style', () => {
    it('any of the four styles marks a War Camp; a camp of any other skill is not one; the block stays `{ skill }`', () => {
        expect(COMBAT_SKILL_IDS.length).toBe(4);
        for (const style of COMBAT_SKILL_IDS) expect(isWarCamp({ camp: { skill: style } }), style).toBe(true);
        expect(isWarCamp(getTokenType('wc_war'))).toBe(true);
        expect(isWarCamp(getTokenType('wc_war_magic'))).toBe(true);
        expect(isWarCamp(getTokenType('wc_logging'))).toBe(false);
        expect(isWarCamp(getTokenType('wc_goblin'))).toBe(false);
        expect(isWarCamp({ camp: { skill: '' } })).toBe(false);
        expect(isWarCamp(null)).toBe(false);
        expect(campOf(getTokenType('wc_war'))).toEqual({ skill: 'melee' });
    });

    it('its work is enemies, never a Token of its style; a work camp never hands out an enemy', () => {
        const war = Camps.campOf(getTokenType('wc_war'));
        const logging = Camps.campOf(getTokenType('wc_logging'));
        expect(Camps.worksType(war, getTokenType('wc_goblin'))).toBe(true);
        expect(Camps.worksType(war, getTokenType('wc_tree'))).toBe(false);
        expect(Camps.worksType(war, getTokenType('wc_den'))).toBe(false);
        expect(Camps.worksType(war, getTokenType('wc_logging'))).toBe(false);
        expect(Camps.worksType(logging, getTokenType('wc_goblin'))).toBe(false);
        expect(Camps.worksType(logging, getTokenType('wc_tree'))).toBe(true);
    });

    it('on the mat: a work camp with the standard reach ring; marked for demolition it hands out nothing', () => {
        newBoard();
        const c = fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        const g = placeEnemy('wc_goblin', CAMP.x + 150, CAMP.y);
        expect(Camps.isWarCamp(c)).toBe(true);
        expect(Camps.isEnemyCamp(c)).toBe(false);
        expect(Camps.isCampLike(c)).toBe(true);
        expect(Camps.reachRingOf(c)).toEqual({ ...CAMP, r: STANDARD_REACH_U });
        expect(Camps.campWork(c).map(t => t.id)).toEqual([g.id]);
        expect(Demolition.mark(c).success).toBe(true);
        expect(Camps.campWork(c)).toEqual([]);
        expect(Camps.isWarCamp(BoardState.getTokenById(c.id))).toBe(false);
    });
});

describe('⭐ a War Camp hero fights every enemy in its reach, one at a time', () => {
    it('takes each enemy in reach in turn, the nearest from where they stand, each kept until it falls; never one outside the reach, never a tree', () => {
        const [h] = newBoard();
        const c = fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        const near = placeEnemy('wc_goblin', CAMP.x + 120, CAMP.y);
        const mid = placeEnemy('wc_goblin', CAMP.x, CAMP.y + 200);
        const edge = placeEnemy('wc_goblin', CAMP.x - STANDARD_REACH_U, CAMP.y);
        const beyond = placeEnemy('wc_goblin', CAMP.x + STANDARD_REACH_U + 1, CAMP.y);
        const tree = fixtures.placeAt('wc_tree', CAMP.x + 60, CAMP.y - 120);
        const inReach = [near, mid, edge].map(t => t.id);
        expect(Camps.campWork(c).map(t => t.id).sort()).toEqual([...inReach].sort());

        expect(Orders.aimAt(h.id, c)).toEqual({ snap: true, reason: null });
        expect(Orders.orderAt(h.id, CAMP)).toMatchObject({ success: true, order: 'token', instanceId: c.id });
        const w = watchFights();
        const seq = claimsOver(h.id, 180_000, () => inReach.every(id => !BoardState.getTokenById(id)));
        w.stop();

        // Every enemy in reach, each once, one after another: the claim moved on only once the
        // last one had fallen.
        expect([...seq].sort()).toEqual([...inReach].sort());
        expect(w.kills.map(([, id]) => id)).toEqual(seq);
        expect(w.kills.every(([heroId]) => heroId === h.id)).toBe(true);
        expect(w.engaged.map(([, id]) => id)).toEqual(seq);
        // Nearest from where they stood: the first from the camp's spot, each next from the last.
        expect(seq[0]).toBe(near.id);
        // After `near` (720,500): mid (600,700) is 233 away, edge (360,500) 360 away.
        expect(seq[1]).toBe(mid.id);
        expect(seq[2]).toBe(edge.id);

        // The goblin a unit beyond the reach and the tree in it were never touched.
        expect(BoardState.getTokenById(beyond.id)).toBeTruthy();
        expect(BoardCombat.getFight(beyond.id)).toBe(null);
        expect(BoardState.getTokenById(tree.id).usesRemaining).toBe(3);
        expect(Flags.pinnedIdOf(h.id)).toBe(c.id);
    });

    it('⭐ with none left they wait at the camp like an idle camp hero, and say there is nothing to fight', () => {
        const [h] = newBoard();
        const c = fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        const g = placeEnemy('wc_goblin', CAMP.x + 120, CAMP.y);
        Orders.orderAt(h.id, CAMP);
        expect(runUntil(() => !BoardState.getTokenById(g.id))).toBeGreaterThan(0);
        run(3000);
        expect(BoardState.claimOfHero(h.id)).toBe(null);
        expect(Flags.waitingOf(h.id)).toBe(null);
        expect(Flags.statusOf(h.id)).toMatchObject({ state: 'idle', order: 'token', campId: c.id, needsJob: false });
        expect(BoardRunner.isHeroIdle(h.id)).toBe(true);
        expect(flagStatusLine(h.id)).toBe('Nothing to fight near WC War Camp');
        // Their order still names the camp.
        expect(Flags.pinnedIdOf(h.id)).toBe(c.id);
    });

    it('takes whoever could be sent straight at its enemies: never the camp’s style, never a level an enemy names by a content slip', () => {
        const [h] = newBoard(1, { melee: 1, magic: 1 });
        const c = fixtures.placeAt('wc_war_magic', CAMP.x, CAMP.y);
        const odd = placeEnemy('wc_gated_goblin', CAMP.x + 120, CAMP.y);
        expect(Flags.orderRefusal(h.id, odd)).toBe(null);
        expect(Flags.orderRefusal(h.id, c)).toBe(null);
        expect(Orders.orderAt(h.id, CAMP)).toMatchObject({ success: true, instanceId: c.id });
        expect(BoardState.claimOfHero(h.id)?.instanceId).toBe(odd.id);
    });

    it('an empty War Camp takes the order; the hero waits there', () => {
        const [h] = newBoard();
        const c = fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        expect(Orders.canOrderOnto(h.id, c)).toBe(true);
        expect(Orders.orderAt(h.id, CAMP)).toMatchObject({ success: true, instanceId: c.id });
        run(1000);
        expect(Flags.statusOf(h.id)).toMatchObject({ state: 'idle', campId: c.id });
    });

    it('⭐ takes an enemy that later comes into its reach, placed or spawned, as a camp takes a Token that comes into its reach; not one placed outside it', () => {
        const [h] = newBoard();
        const c = fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        Orders.orderAt(h.id, CAMP);
        run(1500);
        expect(BoardState.claimOfHero(h.id)).toBe(null);

        const outside = placeEnemy('wc_goblin', CAMP.x, CAMP.y + STANDARD_REACH_U + 40);
        run(1500);
        expect(BoardState.claimOfHero(h.id)).toBe(null);

        const later = placeEnemy('wc_goblin', CAMP.x - 150, CAMP.y);
        run(1500);
        expect(BoardState.claimOfHero(h.id)?.instanceId).toBe(later.id);
        expect(runUntil(() => !BoardState.getTokenById(later.id))).toBeGreaterThan(0);

        // An enemy camp in the War Camp's reach: its spawn lands in reach and is taken too.
        const den = fixtures.placeAt('wc_den', CAMP.x + 100, CAMP.y - 100);
        SpawnerSystem.attemptSpawn(den, getTokenType('wc_den'));
        const spawned = BoardState.tokens().find(t => t.tether === den.id);
        expect(spawned).toBeTruthy();
        expect(Camps.isCampWork(c, spawned)).toBe(true);
        run(1500);
        expect(BoardState.claimOfHero(h.id)?.instanceId).toBe(spawned.id);
        expect(BoardState.getTokenById(outside.id)).toBeTruthy();
        expect(BoardCombat.getFight(outside.id)).toBe(null);
    });

    it('an enemy with lives is fought until it leaves the mat, as a camp works a Token until it can no longer run', () => {
        const [h] = newBoard();
        fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        const ogre = placeEnemy('wc_ogre', CAMP.x + 120, CAMP.y);
        const g = placeEnemy('wc_goblin', CAMP.x, CAMP.y + 200);
        Orders.orderAt(h.id, CAMP);
        const w = watchFights();
        const seq = claimsOver(h.id, 300_000, () => !BoardState.getTokenById(ogre.id) && !BoardState.getTokenById(g.id));
        w.stop();
        // The ogre's three lives back to back, then the goblin.
        expect(w.kills.map(([, id]) => id)).toEqual([ogre.id, ogre.id, ogre.id, g.id]);
        expect(seq).toEqual([ogre.id, g.id]);
    });

    it('⭐ a knocked-out hero stops as any does: flag down, home to heal, the rest of the reach left alone', () => {
        const [h] = newBoard(1, { melee: 1 });
        const hero = GameState.state.heroes.find(x => x.id === h.id);
        hero.hp.current = 1;
        fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        const brute = placeEnemy('wc_brute', CAMP.x + 100, CAMP.y);
        const g = placeEnemy('wc_goblin', CAMP.x, CAMP.y + 200);
        const defeats = [];
        const off = EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, (p) => defeats.push(p.heroId));
        Orders.orderAt(h.id, CAMP);
        expect(BoardState.claimOfHero(h.id)?.instanceId).toBe(brute.id);
        expect(runUntil(() => defeats.length > 0, 60_000)).toBeGreaterThanOrEqual(0);
        off();
        expect(defeats).toEqual([h.id]);
        expect(hero.status).toBe('wounded');
        expect(BoardState.flagOf(h.id)).toBe(null);
        expect(BoardState.claimOfHero(h.id)).toBe(null);
        run(5000);
        // Nothing else was taken on: the goblin and the brute stand, unfought.
        expect(BoardState.getTokenById(g.id)).toBeTruthy();
        expect(BoardState.getTokenById(brute.id)).toBeTruthy();
        expect(BoardCombat.getFight(g.id)).toBe(null);
        expect(BoardCombat.fightOfHero(h.id)).toBe(null);
    });
});

describe('⭐ a fight once taken is finished, wherever the enemy steps', () => {
    it('an enemy carried out of the reach mid-fight is fought to the end; only the next choice reads the reach again', () => {
        const [h] = newBoard();
        fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        const g = placeEnemy('wc_goblin', CAMP.x + 200, CAMP.y);
        const other = placeEnemy('wc_goblin', CAMP.x - 200, CAMP.y);
        Orders.orderAt(h.id, CAMP);
        expect(runUntil(() => !!BoardCombat.fightOfHero(h.id), 10_000)).toBeGreaterThanOrEqual(0);
        expect(BoardCombat.fightOfHero(h.id).instanceId).toBe(g.id);
        // A step to open space, or the player's move: out of the reach with the fight under way.
        BoardState.setTokenPoint(g.id, CAMP.x + STANDARD_REACH_U + 100, CAMP.y);
        run(300);
        expect(BoardState.claimOfHero(h.id)?.instanceId).toBe(g.id);
        expect(BoardCombat.fightOfHero(h.id)?.instanceId).toBe(g.id);
        const w = watchFights();
        expect(runUntil(() => !BoardState.getTokenById(g.id))).toBeGreaterThan(0);
        w.stop();
        expect(w.kills).toEqual([[h.id, g.id]]);
        // Then the next, from the reach as it stands.
        run(300);
        expect(BoardState.claimOfHero(h.id)?.instanceId).toBe(other.id);
    });

    it('⭐ through a real crowded fight: the step carries the enemy past the reach, and the hero still beats it', () => {
        const [h, busy] = newBoard(2);
        BoardState.setInstantArrival(false);
        FightRoom.resetStats();
        const c = fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        // An enemy near the reach's edge, beside another hero's fight it would cover.
        const g = placeEnemy('wc_goblin', CAMP.x + 225, CAMP.y);
        const theirs = placeEnemy('wc_goblin', CAMP.x + 225, CAMP.y - 70);
        expect(Flags.orderToken(busy.id, theirs).success).toBe(true);
        expect(runUntil(() => !!BoardCombat.fightOfHero(busy.id), 30_000)).toBeGreaterThanOrEqual(0);

        Orders.orderAt(h.id, CAMP);
        expect(BoardState.claimOfHero(h.id)?.instanceId).toBe(g.id);
        let farthest = 0;
        let lost = false;
        const w = watchFights();
        for (let t = 0; t < 120_000 && BoardState.getTokenById(g.id); t += 100) {
            GameLoop.runHandlers(100);
            const now = BoardState.getTokenById(g.id);
            if (now) farthest = Math.max(farthest, dist(now, c));
            if (now && BoardState.claimOfHero(h.id)?.instanceId !== g.id) lost = true;
        }
        w.stop();
        // The scene did what it is for: the fight stepped, and past the reach.
        expect(FightRoom.stats().stepped).toBeGreaterThanOrEqual(1);
        expect(farthest).toBeGreaterThan(STANDARD_REACH_U);
        expect(lost).toBe(false);
        expect(w.kills.filter(([heroId]) => heroId === h.id).map(([, id]) => id)).toEqual([g.id]);
    }, 60_000);
});

describe('⭐ no clash with the other ways a fight starts', () => {
    it('two heroes on one War Camp fight two different enemies; every fight is one-on-one', () => {
        const [a, b] = newBoard(2);
        fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        const ids = [
            placeEnemy('wc_goblin', CAMP.x + 120, CAMP.y),
            placeEnemy('wc_goblin', CAMP.x, CAMP.y + 160),
            placeEnemy('wc_goblin', CAMP.x - 140, CAMP.y - 60)
        ].map(t => t.id);
        Orders.orderAt(a.id, CAMP);
        Orders.orderAt(b.id, CAMP);
        const w = watchFights();
        let shared = false;
        for (let t = 0; t < 180_000 && ids.some(id => BoardState.getTokenById(id)); t += 100) {
            GameLoop.runHandlers(100);
            const ca = BoardState.claimOfHero(a.id)?.instanceId;
            if (ca && ca === BoardState.claimOfHero(b.id)?.instanceId) shared = true;
        }
        w.stop();
        expect(shared).toBe(false);
        expect(w.kills.map(([, id]) => id).sort()).toEqual([...ids].sort());
        // Each enemy engaged by one hero only.
        const by = new Map();
        for (const [heroId, id] of w.engaged) (by.get(id) || by.set(id, new Set()).get(id)).add(heroId);
        for (const heroes of by.values()) expect(heroes.size).toBe(1);
        expect(new Set(w.kills.map(([heroId]) => heroId))).toEqual(new Set([a.id, b.id]));
    });

    it('⭐ a hero sent straight at an enemy in the reach keeps it: the War Camp hero takes another and never joins that fight', () => {
        const [direct, camper] = newBoard(2);
        fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        const target = placeEnemy('wc_goblin', CAMP.x + 100, CAMP.y);
        const other = placeEnemy('wc_goblin', CAMP.x - 180, CAMP.y);
        expect(Flags.orderToken(direct.id, target).success).toBe(true);
        Orders.orderAt(camper.id, CAMP);
        expect(BoardState.claimOfHero(direct.id)?.instanceId).toBe(target.id);
        // The nearer enemy is held: the camper passes over it (claimed) and takes the other.
        expect(BoardState.claimOfHero(camper.id)?.instanceId).toBe(other.id);
        expect(Flags.skipsOfHero(camper.id)).toEqual([{ instanceId: target.id, reason: Flags.SKIP.CLAIMED, typeId: 'wc_goblin' }]);
        const w = watchFights();
        runUntil(() => !BoardState.getTokenById(target.id) && !BoardState.getTokenById(other.id), 120_000);
        w.stop();
        expect(w.kills).toEqual(expect.arrayContaining([[direct.id, target.id], [camper.id, other.id]]));
        expect(w.kills).toHaveLength(2);
    });

    it('⭐ the other way round: a hero sent at the enemy a War Camp hero holds waits beside it and never joins the fight', () => {
        const [camper, late] = newBoard(2);
        fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        const target = placeEnemy('wc_ogre', CAMP.x + 100, CAMP.y);
        Orders.orderAt(camper.id, CAMP);
        expect(runUntil(() => !!BoardCombat.fightOfHero(camper.id), 10_000)).toBeGreaterThanOrEqual(0);
        expect(Flags.orderToken(late.id, target).success).toBe(true);
        run(500);
        expect(BoardState.claimOfHero(late.id)).toBe(null);
        expect(Flags.waitingOf(late.id)).toMatchObject({ instanceId: target.id, kind: 'fight' });
        expect(BoardCombat.getFight(target.id).assignedHeroId).toBe(camper.id);
        const w = watchFights();
        runUntil(() => !BoardState.getTokenById(target.id), 300_000);
        w.stop();
        // The War Camp hero beat all three of its lives; the late hero is left needing a job.
        expect(w.kills.every(([heroId]) => heroId === camper.id)).toBe(true);
        run(200);
        expect(Flags.needsJob(late.id)).toBe(true);
    });

    it('⭐ an enemy camp’s goblin in a War Camp’s reach: the hunter and the War Camp hero never fight it together', () => {
        const [hunter, camper] = newBoard(2);
        fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        const den = fixtures.placeAt('wc_den', CAMP.x + 160, CAMP.y);
        SpawnerSystem.attemptSpawn(den, getTokenType('wc_den'));
        const goblin = BoardState.tokens().find(t => t.tether === den.id);
        expect(goblin && Camps.isCampWork(BoardState.getTokenById(den.id), goblin)).toBe(true);
        // Both orders hand out the same goblin; whoever was sent first takes it.
        Orders.orderAt(hunter.id, { x: den.x, y: den.y });
        Orders.orderAt(camper.id, CAMP);
        const w = watchFights();
        let together = false;
        for (let t = 0; t < 60_000; t += 100) {
            GameLoop.runHandlers(100);
            const a = BoardState.claimOfHero(hunter.id)?.instanceId;
            if (a && a === BoardState.claimOfHero(camper.id)?.instanceId) together = true;
        }
        w.stop();
        expect(together).toBe(false);
        const by = new Map();
        for (const [heroId, id] of w.engaged) (by.get(id) || by.set(id, new Set()).get(id)).add(heroId);
        for (const heroes of by.values()) expect(heroes.size).toBe(1);
        expect(w.kills.length).toBeGreaterThan(1);
    });

    it('⭐ a mat held by its arrival: the War Camp waits like every camp (the order is refused) until the arrival is beaten', () => {
        const [h, fighter] = newBoard(2);
        const c = fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        const arrival = placeEnemy('wc_goblin', CAMP.x + 120, CAMP.y);
        arrival.arrival = true;
        GameState.state.board.arrival = { ids: [arrival.id], cleared: false };
        expect(Occupation.isOccupied()).toBe(true);

        expect(Flags.orderRefusal(h.id, c)).toEqual({ reason: Flags.SKIP.OCCUPIED });
        expect(Orders.orderAt(h.id, CAMP)).toMatchObject({ success: false, reason: 'Beat the enemies here first', instanceId: c.id });
        expect(BoardState.flagOf(h.id)).toBe(null);

        // A hero may still be sent at the arrival enemy standing in its reach, and beats it.
        expect(Flags.orderToken(fighter.id, arrival).success).toBe(true);
        expect(runUntil(() => !BoardState.getTokenById(arrival.id))).toBeGreaterThan(0);
        expect(Occupation.isOccupied()).toBe(false);
        expect(GameState.state.board.arrival.cleared).toBe(true);

        // Cleared: the War Camp takes the order, and its hero fights what comes into its reach.
        expect(Orders.orderAt(h.id, CAMP)).toMatchObject({ success: true, instanceId: c.id });
        const g = placeEnemy('wc_goblin', CAMP.x - 120, CAMP.y);
        run(1500);
        expect(BoardState.claimOfHero(h.id)?.instanceId).toBe(g.id);
    });
});

describe('⭐ what the player reads', () => {
    it('the Token card says what a War Camp does, not "Melee Tokens"', () => {
        const lines = cardLifecycle({ id: 'x', typeId: 'wc_war' }, getTokenType('wc_war'), {});
        const line = lines.find(l => l.icon === 'reach');
        expect(line).toMatchObject({ label: 'War Camp', text: `Enemies · ${STANDARD_REACH_U} u` });
        expect(line.tip).toBe(`A War Camp: heroes sent here fight every enemy within ${STANDARD_REACH_U} u, one at a time, each in their own style`);
        expect(line.tip).not.toMatch(/Melee/);
        const logging = cardLifecycle({ id: 'y', typeId: 'wc_logging' }, getTokenType('wc_logging'), {}).find(l => l.icon === 'reach');
        expect(logging).toMatchObject({ label: 'Camp', text: `Forestry · ${STANDARD_REACH_U} u` });
    });

    it('carried over a War Camp, each hero shows the weapons in their hands, as over an enemy', () => {
        const [h] = newBoard();
        InventoryManager.addItem('item_copper_sword', 1);
        expect(EquipmentManager.equipItem(h.id, 'item_copper_sword')).toBeTruthy();
        const c = fixtures.placeAt('wc_war', CAMP.x, CAMP.y);
        const g = placeEnemy('wc_goblin', CAMP.x + 120, CAMP.y);
        expect(marksFor(h.id, g)).toEqual({ kind: 'hands', items: ['item_copper_sword'] });
        expect(marksFor(h.id, c)).toEqual(marksFor(h.id, g));
        const logging = fixtures.placeAt('wc_logging', CAMP.x + 600, CAMP.y);
        expect(marksFor(h.id, logging)).toBe(null);
    });

    it('a hero idle at a work camp still says there is nothing to work', () => {
        const [h] = newBoard();
        const c = fixtures.placeAt('wc_logging', CAMP.x, CAMP.y);
        Orders.orderAt(h.id, CAMP);
        run(500);
        expect(Flags.statusOf(h.id)).toMatchObject({ state: 'idle', campId: c.id });
        expect(flagStatusLine(h.id)).toBe('Nothing to work near WC Logging Camp');
        expect(HeroMotion.idleSpot(BoardState.flagOf(h.id))).toBeTruthy();
    });
});
