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
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as FightRoom from '../systems/board/FightRoom.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { matTuning, resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Crowded fights step to open space for the same game time in a catch-up's 1000 ms steps as in
 * live play's 100 ms ticks: a stepped fight's clock starts the moment its enemy reaches open space,
 * whatever the tick (`FightRoom`, the leftover). Proven over an hour of hunting a camp, where
 * hundreds of fights step: in each, the fighting its swing clock has counted at the end of its first
 * tick is everything after the enemy's walk.
 *
 * The scene: a camp keeping six enemies (a new one each second while short), three heroes who
 * cannot be beaten hunting it, and a fourth idling beside it, so the fights crowd each other and the
 * idler again and again.
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
    fsf_goblin: {
        id: 'fsf_goblin', name: 'FSF Goblin', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 's_crime', requiresHero: true,
        enemy: { level: 1, style: 'melee', budgetScale: 0.3 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    fsf_camp: {
        id: 'fsf_camp', name: 'FSF Camp', tokenType: 'spawner', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_nature', requiresHero: false, config: null,
        spawner: { spawns: [{ typeId: 'fsf_goblin', weight: 1 }], allowance: 6, intervalMs: 1000, upkeep: [] }
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

function buildBoard() {
    stream.state = 11;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    BoardState.setInstantArrival(false);
    BoardCombat.clearAll();
    FightRoom.resetStats();
    const heroes = fixtures.makeHeroes(4, {});
    for (const hero of heroes) {
        hero.skills.melee = { level: 50, xp: xpForLevel(50) };
        HeroManager.updateHeroFromSkills(hero);
        hero.hp = { current: 1e6, max: 1e6 };
    }
    const camp = fixtures.placeAt('fsf_camp', 800, 520);
    [[-110, -20], [100, 10], [-20, 110], [30, -100]].forEach(([dx, dy]) => {
        fixtures.placeAt('fsf_goblin', 800 + dx, 520 + dy).tether = camp.id;
    });
    heroes.slice(0, 3).forEach(h => fixtures.orderAt(h.id, { x: camp.x, y: camp.y }));
    fixtures.orderAt(heroes[3].id, { x: 730, y: 700 });
    TileModifiers.rebuildAll();
    return heroes.slice(0, 3).map(h => h.id);
}

/**
 * An hour of the hunt in ticks of `stepMs`. Each stepped fight: how much of the time from the start
 * of the tick its step was planned in to the end of its fight's first tick the swing clock did not
 * count, against the enemy's walk at its walking speed.
 */
function huntAnHour(stepMs) {
    const hunters = buildBoard();
    const speed = matTuning('enemyWalkSpeed');
    const seenAt = new Map();     // enemyId → where it stood at the end of the last tick
    const planned = new Map();    // enemyId → { heroId, fromMs, walkMs }
    const fights = new Set();
    const steps = [];
    for (let t = 0; t < HOUR_MS; t += stepMs) {
        GameLoop.runHandlers(stepMs);
        const end = t + stepMs;
        for (const enemyId of FightRoom.steppingIds()) {
            if (planned.has(enemyId)) continue;
            const plan = FightRoom.stepOf(enemyId);
            const from = seenAt.get(enemyId);
            if (!from) continue;
            planned.set(enemyId, { heroId: plan.heroId, fromMs: t, walkMs: Math.hypot(plan.x - from.x, plan.y - from.y) * 1000 / speed });
        }
        for (const heroId of hunters) {
            const fight = BoardCombat.fightOfHero(heroId);
            if (!fight || fights.has(fight)) continue;
            fights.add(fight);
            const plan = planned.get(fight.instanceId);
            planned.delete(fight.instanceId);
            if (plan?.heroId !== heroId) continue;
            steps.push({ unfoughtMs: end - plan.fromMs - fight.combat.heroTickProcesses[heroId], walkMs: plan.walkMs });
        }
        seenAt.clear();
        for (const token of BoardState.tokens()) {
            if (token.typeId === 'fsf_goblin') seenAt.set(token.id, { x: token.x, y: token.y });
        }
    }
    return steps;
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    Math.random = seeded;
    HeroMotion.setRandomForTests(seeded);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterEach(() => {
    SaveManager.currentSlot = null;
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    GameLoop.stop();
    localStorage.clear();
});

afterAll(() => {
    Math.random = realRandom;
    HeroMotion.setRandomForTests();
    BoardState.setInstantArrival(true);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ an hour of crowded fights, in 1000 ms steps and in 100 ms ticks', () => {
    for (const stepMs of [1000, 100]) {
        it(`in ${stepMs} ms ticks every stepped fight counts from the moment its enemy got there`, () => {
            const steps = huntAnHour(stepMs);
            // Crowded: hundreds of fights stepped, some across more than one 1 s step.
            expect(steps.length).toBeGreaterThan(500);
            expect(steps.some(s => s.walkMs > 1000)).toBe(true);
            // The time the swing clock did not count is the enemy's walk. Measured from the Token's
            // point, the rounded copy of where the enemy really stands (half a unit each way, 8 ms
            // at 90 u/s), and the leftover rounded to the ms.
            const off = steps.filter(s => Math.abs(s.unfoughtMs - s.walkMs) > 9);
            expect(off.slice(0, 3)).toEqual([]);
        }, 120_000);
    }
});
