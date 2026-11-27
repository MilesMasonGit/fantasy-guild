// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as FightRoom from '../systems/board/FightRoom.js';
import * as FixedTokens from '../systems/board/FixedTokens.js';
import * as Hand from '../systems/board/Hand.js';
import * as Orders from '../systems/board/Orders.js';
import * as MatPlacement from '../systems/board/MatPlacement.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { envelopeScenario } from '../../bench/scenarios/envelope.mjs';

/**
 * ⭐ **A fight's step to open space keeps the Token spacing.** The enemy is a Token, so the spot it
 * steps to is one it may stand on (a full spacing from every other Token); and while it steps it
 * holds its ground and that spot: nothing pushes it, and nothing lands within its spacing of where
 * it is going. With no such spot within reach the fight starts where it stands.
 *
 * Heroes walk here (instant arrival off), as in play: with instant arrival no fight ever steps.
 */

const HOUR_MS = 60 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerTokenTypes({
    /** Never falls: a fight with it lasts the whole test. */
    fss_brute: {
        id: 'fss_brute', name: 'FSS Brute', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 's_crime', requiresHero: true,
        enemy: { level: 1, style: 'melee', hp: 100000, hit: 1 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    fss_goblin: {
        id: 'fss_goblin', name: 'FSS Goblin', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 's_crime', requiresHero: true,
        enemy: { level: 1, style: 'melee', hp: 6, xp: 3 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    /** Keeps six goblins, a new one each second while short. */
    fss_camp: {
        id: 'fss_camp', name: 'FSS Camp', tokenType: 'spawner', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_nature', requiresHero: false, config: null,
        spawner: { spawns: [{ typeId: 'fss_goblin', weight: 1 }], allowance: 6, intervalMs: 1000, upkeep: [] }
    }
});

/** A seeded `Math.random` (mulberry32), as the bench's prelude has. */
const stream = { state: 1 };
function seeded() {
    stream.state = (stream.state + 0x6D2B79F5) | 0;
    let t = stream.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const realRandom = Math.random;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** A Token on the mat at `(x, y)` with no rules, `spawned` (a spawn may push it) unless said. */
function put(typeId, x, y, origin = BoardState.ORIGIN.SPAWNED) {
    return BoardState.addToken(BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, origin), x, y);
}

/** A hero standing still at `(x, y)`, working nothing: a fight beside them is crowded. */
function standing(heroId, x, y) {
    BoardState.setHeroBody(heroId, { x, y, targetId: null, side: -1, atWork: null, moving: false, facing: 1 });
}

/** The Tokens other than `instance` that `point` is closer to than their spacing from it. */
function tooClose(instance, point) {
    return BoardState.tokens()
        .filter(t => t.id !== instance.id && dist(t, point) < MatPlacement.minGap(t.typeId, instance.typeId) - 1e-6)
        .map(t => `${t.typeId} ${dist(t, point).toFixed(1)} u`);
}

/** Every pair of Tokens closer than their spacing, an enemy walking its step left out. */
function crowdedPairs() {
    const all = BoardState.tokens().filter(t => !EnemyMotion.isWalking(t.id));
    const pairs = [];
    for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
            const d = dist(all[i], all[j]);
            if (d < MatPlacement.minGap(all[i].typeId, all[j].typeId) - 1e-6) pairs.push(`${all[i].typeId}~${all[j].typeId} ${d.toFixed(1)} u`);
        }
    }
    return pairs;
}

function freshGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    BoardCombat.clearAll();
    FightRoom.resetStats();
    BoardState.setInstantArrival(false);
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

beforeEach(freshGame);

afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
    Math.random = realRandom;
    HeroMotion.setRandomForTests();
    BoardState.setInstantArrival(true);
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ a fight steps only to a spot its enemy may stand on', () => {
    it('a Token beside the nearest clear spot: the step goes on to one a full spacing from every Token', () => {
        const enemy = put('fss_brute', 800, 500);
        standing('h4', 904, 450);
        // Alone, the fight steps 32 u left, clear of h4.
        expect(FightRoom.planFor('h1', enemy, -1)).toEqual({ crowded: true, to: { x: 768, y: 500 } });

        // A Token 132 u left of the enemy (it stands legally) is 100 u from that spot.
        put('fixture_producer', 668, 500);
        const { crowded, to } = FightRoom.planFor('h1', enemy, -1);
        expect(crowded).toBe(true);
        expect(to).not.toBeNull();
        expect(to).not.toEqual({ x: 768, y: 500 });
        expect(dist(to, enemy)).toBeLessThanOrEqual(FightRoom.STEP_REACH);
        expect(tooClose(enemy, to)).toEqual([]);
        expect(FightRoom.crowds(FightRoom.fightBox('fss_brute', to, -1), FightRoom.heroBox({ x: 904, y: 450 }))).toBe(false);
    });

    it('with no such spot within reach, the fight starts where it stands', () => {
        const enemy = put('fss_brute', 800, 500);
        standing('h4', 904, 450);
        // Six Tokens round it, each edges touching it and its two neighbours: every spot within a
        // step of it is closer than the spacing to one of them.
        for (let k = 0; k < 6; k++) {
            const a = k * Math.PI / 3;
            put('fixture_producer', 800 + 128 * Math.cos(a), 500 + 128 * Math.sin(a));
        }
        expect(FightRoom.planFor('h1', enemy, -1)).toEqual({ crowded: true, to: null });
        expect(FightRoom.holdsArrival('h1', enemy, -1)).toBe(false);
        expect(FightRoom.stepOf(enemy.id)).toBeNull();
        expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 800, y: 500 });
    });
});

describe('⭐ a stepping enemy holds its ground', () => {
    /** Enemy at (800, 500), its fight crowded by h4: it steps 32 u left, to (768, 500). */
    function stepping() {
        const enemy = put('fss_goblin', 800, 500);
        standing('h4', 904, 450);
        expect(FightRoom.holdsArrival('h1', enemy, -1)).toBe(true);
        const spot = { x: FightRoom.stepOf(enemy.id).x, y: FightRoom.stepOf(enemy.id).y };
        expect(spot).toEqual({ x: 768, y: 500 });
        return { enemy, spot };
    }

    it('a spawn that lands on it does not push it, and lands clear of it and of its spot', () => {
        // Just setting off on a step 160 u up, so the room it walks to stands apart from it.
        const enemy = put('fss_goblin', 800, 500);
        const spot = { x: 800, y: 340 };
        BoardState.setStepPlan(enemy.id, { heroId: 'h1', ...spot, side: -1, done: false, leftoverMs: 0 });
        const at = { x: 860, y: 500 };
        const where = MatPlacement.forceSpot('fss_goblin', at, { fixedIds: FixedTokens.unpushableIds() });
        expect(where).not.toBeNull();
        expect(where.pushed.map(p => p.id)).not.toContain(enemy.id);
        expect(dist(where, enemy)).toBeGreaterThanOrEqual(128);
        expect(dist(where, spot)).toBeGreaterThanOrEqual(128);

        // The same spawn once the step is over pushes it as any spawned enemy.
        BoardState.setStepPlan(enemy.id, null);
        const after = MatPlacement.forceSpot('fss_goblin', at, { fixedIds: FixedTokens.unpushableIds() });
        expect(after.pushed.map(p => p.id)).toContain(enemy.id);
    });

    it('nothing is put down within its spacing of the spot it walks to while it steps', () => {
        const { enemy, spot } = stepping();
        // 100 u from the spot, 132 u from where the enemy stands now.
        const near = { x: 668, y: 500 };
        expect(MatPlacement.isLegal('fixture_producer', near)).toBe(false);
        expect(MatPlacement.findSpot('fixture_producer', near, { reach: 0 })).toBeNull();
        const nudged = MatPlacement.findSpot('fixture_producer', near);
        expect(dist(nudged, spot)).toBeGreaterThanOrEqual(128);

        // The step over, the same search finds room at once, though nothing has moved.
        BoardState.setStepPlan(enemy.id, null);
        expect(MatPlacement.findSpot('fixture_producer', near, { reach: 0 })).toMatchObject(near);
    });

    it('nor pushed there: a push that would shove a Token into that room is not made', () => {
        const { spot } = stepping();
        // A spawned goblin 148 u left of the spot, and a spawn landing 80 u left of it: pushed
        // straight right, the goblin would end 100 u from the spot.
        put('fss_goblin', 620, 500);
        const where = MatPlacement.forceSpot('fss_goblin', { x: 540, y: 500 }, { fixedIds: FixedTokens.unpushableIds() });
        expect(where).not.toBeNull();
        expect(dist(where, spot)).toBeGreaterThanOrEqual(128);
        for (const p of where.pushed) {
            expect(dist(p, spot), `${p.id} pushed to ${p.x}, ${p.y}`).toBeGreaterThanOrEqual(128);
        }
    });
});

describe('⭐ a step let go part-way still ends at its spot', () => {
    /**
     * A goblin at (800, 500) stepping 160 u up to (800, 340) for h1, past a Token at (690, 420):
     * 136 u from both ends of the walk, 110 u from its middle. Let go 0.8 s in, at about (800, 428).
     */
    function letGoMidWalk() {
        const enemy = put('fss_goblin', 800, 500);
        const passed = put('fixture_producer', 690, 420, BoardState.ORIGIN.PLACED);
        expect(crowdedPairs()).toEqual([]);
        BoardState.setClaim('h1', { instanceId: enemy.id, typeId: 'fss_goblin', x: 800, y: 500 });
        BoardState.setStepPlan(enemy.id, { heroId: 'h1', x: 800, y: 340, side: -1, done: false, leftoverMs: 0 });
        for (let i = 0; i < 8; i++) EnemyMotion.tick(100);
        expect(EnemyMotion.isWalking(enemy.id)).toBe(true);
        expect(dist(enemy, passed)).toBeLessThan(128);
        BoardState.setClaim('h1', null);
        EnemyMotion.tick(100);
        return { enemy, passed, spot: { x: 800, y: 340 } };
    }

    it('the enemy walks on to its spot, the step is forgotten as it arrives, and no fight starts', () => {
        const { enemy, spot } = letGoMidWalk();
        expect(FightRoom.stepOf(enemy.id)).toMatchObject({ heroId: null, ...spot, done: false });
        expect(EnemyMotion.isWalking(enemy.id)).toBe(true);
        for (let i = 0; i < 30; i++) EnemyMotion.tick(100);
        expect({ x: enemy.x, y: enemy.y }).toEqual(spot);
        expect(FightRoom.stepOf(enemy.id)).toBeNull();
        expect(FightRoom.steppingIds()).toEqual([]);
        expect(EnemyMotion.bodyOf(enemy.id)).toBeNull();
        expect(FightRoom.takeLeftover(enemy.id)).toBe(0);
        expect(BoardCombat.getFight(enemy.id)).toBeFalsy();
        expect(crowdedPairs()).toEqual([]);
    });

    it('nothing lands within its spacing of the spot while it finishes the walk', () => {
        const { enemy, spot } = letGoMidWalk();
        // 108 u from the spot, 150 u and more from the enemy and the Token it passes.
        const near = { x: 900, y: 300 };
        expect(dist(near, enemy)).toBeGreaterThan(128);
        expect(MatPlacement.isLegal('fixture_producer', near)).toBe(false);
        expect(MatPlacement.findSpot('fixture_producer', near, { reach: 0 })).toBeNull();
        const nudged = MatPlacement.findSpot('fixture_producer', near);
        expect(dist(nudged, spot)).toBeGreaterThanOrEqual(128);
        const spawned = MatPlacement.forceSpot('fss_goblin', { x: 860, y: 330 }, { fixedIds: FixedTokens.unpushableIds() });
        expect(spawned).not.toBeNull();
        expect(spawned.pushed.map(p => p.id)).not.toContain(enemy.id);
        expect(dist(spawned, spot)).toBeGreaterThanOrEqual(128);
    });

    it('picked into the hand mid-walk, the step is dropped and nothing stays held', () => {
        const { enemy } = letGoMidWalk();
        Hand.setInHand(enemy.id, true);
        try {
            EnemyMotion.tick(100);
            expect(FightRoom.stepOf(enemy.id)).toBeNull();
            EnemyMotion.tick(100);
            expect(EnemyMotion.bodyOf(enemy.id)).toBeNull();
        } finally {
            Hand.setInHand(enemy.id, false);
        }
        expect(MatPlacement.isLegal('fixture_producer', { x: 900, y: 300 })).toBe(true);
    });

    it('removed mid-walk, the step is dropped', () => {
        const { enemy } = letGoMidWalk();
        BoardState.removeToken(enemy.id);
        EnemyMotion.tick(100);
        expect(FightRoom.steppingIds()).toEqual([]);
        expect(MatPlacement.isLegal('fixture_producer', { x: 900, y: 300 })).toBe(true);
    });

    it('a hero who reaches it meanwhile waits for it to get there, then asks afresh from the spot', () => {
        const { enemy, spot } = letGoMidWalk();
        expect(FightRoom.holdsArrival('h2', enemy, -1)).toBe(true);
        expect(FightRoom.stepOf(enemy.id)).toMatchObject({ heroId: null, ...spot });
        for (let i = 0; i < 30; i++) EnemyMotion.tick(100);
        expect({ x: enemy.x, y: enemy.y }).toEqual(spot);
        // Nothing crowds it there: the fight starts at the spot.
        expect(FightRoom.holdsArrival('h2', enemy, -1)).toBe(false);
        expect(FightRoom.stepOf(enemy.id)).toBeNull();
    });

    it('let go once it is already there, the step is simply forgotten', () => {
        const enemy = put('fss_goblin', 800, 500);
        BoardState.setClaim('h1', { instanceId: enemy.id, typeId: 'fss_goblin', x: 800, y: 500 });
        BoardState.setStepPlan(enemy.id, { heroId: 'h1', x: 800, y: 460, side: -1, done: false, leftoverMs: 0 });
        for (let i = 0; i < 10; i++) EnemyMotion.tick(100);
        expect(FightRoom.stepOf(enemy.id)).toMatchObject({ heroId: 'h1', done: true });
        BoardState.setClaim('h1', null);
        EnemyMotion.tick(100);
        expect(FightRoom.stepOf(enemy.id)).toBeNull();
        expect({ x: enemy.x, y: enemy.y }).toEqual({ x: 800, y: 460 });
    });
});

/**
 * The hunt `FightStepFidelity.test.js` plays, at the shipped nudge reach: a camp keeping six
 * goblins (a new one each second while short), three heroes who cannot be beaten hunting it and a
 * fourth idling beside it. The camp often has no free place within its nudge reach, so its spawns
 * push its goblins about, while hundreds of fights step.
 */
function huntBoard() {
    stream.state = 11;
    Math.random = seeded;
    HeroMotion.setRandomForTests(seeded);
    freshGame();
    const heroes = fixtures.makeHeroes(4, {});
    for (const hero of heroes) {
        hero.skills.melee = { level: 50, xp: xpForLevel(50) };
        HeroManager.updateHeroFromSkills(hero);
        hero.hp = { current: 1e6, max: 1e6 };
    }
    const camp = fixtures.placeAt('fss_camp', 800, 520);
    [[-130, -20], [130, 10], [-20, 130], [30, -130]].forEach(([dx, dy]) => {
        put('fss_goblin', 800 + dx, 520 + dy).tether = camp.id;
    });
    heroes.slice(0, 3).forEach(h => fixtures.orderAt(h.id, { x: camp.x, y: camp.y }));
    fixtures.orderAt(heroes[3].id, { x: 730, y: 700 });
    TileModifiers.rebuildAll();
}

describe('⭐ an hour of a crowded hunt at the shipped nudge reach', () => {
    it.each([100, 1000])('in %i ms ticks: no stepping enemy is pushed, and no two standing Tokens are ever closer than their spacing', (stepMs) => {
        huntBoard();
        let since = BoardState.moveCount();
        const pushedWhileStepping = [];
        let pushes = 0;
        const crowdedAt = [];
        for (let t = 0; t < HOUR_MS; t += stepMs) {
            // The steps under way as the tick starts: a spawn comes before the heroes and the steps.
            const before = new Map(FightRoom.steppingIds().map(id => [id, { ...FightRoom.stepOf(id) }]));
            GameLoop.runHandlers(stepMs);
            BoardState.eachMoveSince(since, (id, fx, fy, tx, ty) => {
                // A step's own move lands on whole units, nearer its spot; a push wherever it leaves it.
                const plan = before.get(id) || FightRoom.stepOf(id);
                const own = plan && Number.isInteger(tx) && Number.isInteger(ty) && dist(plan, { x: tx, y: ty }) <= dist(plan, { x: fx, y: fy });
                if (own) return;
                pushes++;
                if (before.has(id)) pushedWhileStepping.push(`${id} at ${t} ms`);
            });
            since = BoardState.moveCount();
            if (crowdedAt.length < 3) {
                const pairs = crowdedPairs();
                if (pairs.length) crowdedAt.push(`${t} ms: ${pairs.join(', ')}`);
            }
        }
        // Crowded: hundreds of fights stepped, and the camp's spawns pushed its goblins about.
        expect(FightRoom.stats().stepped).toBeGreaterThan(250);
        expect(pushes).toBeGreaterThan(20);
        expect(pushedWhileStepping).toEqual([]);
        expect(crowdedAt).toEqual([]);
    }, 120_000);
});

describe('⭐ the hunt with its heroes called away mid-step', () => {
    it('every third step is let go 0.3 s in: each still ends at its spot, and no two standing Tokens are ever closer than their spacing', () => {
        huntBoard();
        const seen = new Map();
        const away = new Map();
        const letGo = new Map();
        let picked = 0;
        let finished = 0;
        const offSpot = [];
        const crowdedAt = [];
        for (let t = 0; t < 10 * 60_000; t += 100) {
            for (const id of FightRoom.steppingIds()) {
                const p = FightRoom.stepOf(id);
                if (p.heroId === null || p.done) continue;
                const key = `${id}|${p.x}|${p.y}`;
                if (!seen.has(key)) seen.set(key, { t, pick: picked++ % 3 === 0 });
                const s = seen.get(key);
                if (s.pick && t - s.t >= 300 && !away.has(p.heroId)) {
                    Orders.orderAt(p.heroId, { x: 300, y: 300 });
                    away.set(p.heroId, t + 4000);
                }
            }
            for (const [heroId, back] of away) {
                if (t < back) continue;
                Orders.orderAt(heroId, { x: 800, y: 520 });
                away.delete(heroId);
            }
            GameLoop.runHandlers(100);
            for (const id of FightRoom.steppingIds()) {
                const p = FightRoom.stepOf(id);
                if (p.heroId === null && !letGo.has(id)) letGo.set(id, { x: p.x, y: p.y });
            }
            for (const [id, spot] of [...letGo]) {
                if (FightRoom.stepOf(id)?.heroId === null) continue;
                const enemy = BoardState.getTokenById(id);
                if (enemy && enemy.x === spot.x && enemy.y === spot.y) finished++;
                else offSpot.push(`${id} at ${t} ms`);
                letGo.delete(id);
            }
            if (crowdedAt.length < 3) {
                const pairs = crowdedPairs();
                if (pairs.length) crowdedAt.push(`${t} ms: ${pairs.join(', ')}`);
            }
        }
        expect(finished).toBeGreaterThan(20);
        expect(offSpot).toEqual([]);
        expect(crowdedAt).toEqual([]);
    }, 120_000);
});

describe('⭐ the drawing bench\'s fights boards', () => {
    it.each([40, 80])('fights%i: once the fights have started, no two Tokens stand closer than their spacing', (n) => {
        envelopeScenario(`fights${n}`).build({ fixtures, setMatTuning });
        TileModifiers.rebuildAll();
        expect(crowdedPairs()).toEqual([]);
        for (let i = 0; i < 250; i++) GameLoop.runHandlers(100);
        // Fights stepped, and every one went where its enemy may stand.
        expect(FightRoom.stats().stepped).toBeGreaterThan(5);
        expect(crowdedPairs()).toEqual([]);
    }, 60_000);
});
