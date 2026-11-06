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
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as FightRoom from '../systems/board/FightRoom.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Crowded fights step to open space the same in time away as in play: the step is decided by
 * the engine alone (no listener, no screen), from whole mat units and the board as it stands, so a
 * catch-up that replays the same 1000 ms steps steps the same fights to the same spots.
 *
 * The scene: an enemy camp of four (a new one every 10 s), three heroes hunting it, and a fourth
 * idling beside it, so the fights crowd each other and the idler again and again.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 8 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerTokenTypes({
    fsc_goblin: {
        id: 'fsc_goblin', name: 'FSC Goblin', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 's_crime', requiresHero: true,
        enemy: { level: 3, style: 'melee' },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 }] }
    },
    fsc_camp: {
        id: 'fsc_camp', name: 'FSC Camp', tokenType: 'spawner', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_nature', requiresHero: false, config: null,
        spawner: { spawns: [{ typeId: 'fsc_goblin', weight: 1 }], allowance: 4, intervalMs: 10_000, upkeep: [] }
    }
});

/** A seeded `Math.random` (mulberry32) that counts its draws, as the bench's prelude does. */
const stream = { state: 1, draws: 0 };
function seeded() {
    stream.draws++;
    stream.state = (stream.state + 0x6D2B79F5) | 0;
    let t = stream.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const realRandom = Math.random;

function buildBoard() {
    stream.state = 11;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    BoardState.setInstantArrival(false);
    FightRoom.resetStats();
    const heroes = fixtures.makeHeroes(4, {});
    for (const hero of heroes) {
        hero.skills.melee = { level: 20, xp: xpForLevel(20) };
        HeroManager.updateHeroFromSkills(hero);
        hero.hp.current = hero.hp.max;
    }
    const camp = fixtures.placeAt('fsc_camp', 800, 520);
    // The camp starts full, its four packed round it.
    [[-110, -20], [100, 10], [-20, 110], [30, -100]].forEach(([dx, dy]) => {
        const g = fixtures.placeAt('fsc_goblin', 800 + dx, 520 + dy);
        g.tether = camp.id;
    });
    heroes.slice(0, 3).forEach(h => fixtures.orderAt(h.id, { x: camp.x, y: camp.y }));
    // The fourth idles just below the camp.
    fixtures.orderAt(heroes[3].id, { x: 730, y: 700 });
    TileModifiers.rebuildAll();
    return heroes.map(h => h.id);
}

function listen() {
    const seen = { kills: 0, defeats: 0, swings: 0, engaged: 0 };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => { seen.kills++; }),
        EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, () => { seen.defeats++; }),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, () => { seen.swings++; }),
        EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, () => { seen.engaged++; })
    ];
    return { stop: () => { offs.forEach(off => off()); return seen; } };
}

const end = (ids, seen) => ({
    heroes: ids.map(id => {
        const h = GameState.state.heroes.find(x => x.id === id);
        const body = BoardState.heroBodyOf(id);
        return { id, hp: h.hp.current, status: h.status, xp: h.skills.melee?.xp ?? null, at: body ? [body.x, body.y] : null };
    }),
    // Where every Token stands, by arrival order: ids carry the wall clock, places do not.
    tokens: BoardState.tokens().map(t => [t.typeId, t.x, t.y, t.usesRemaining ?? null]),
    draws: stream.draws,
    steps: FightRoom.stats(),
    seen
});

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

describe('crowded fights during a catch-up', () => {
    it('step exactly as the same 1000 ms steps through the plain loop do', async () => {
        let ids = buildBoard();
        let seen = listen();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(ids, seen.stop());

        ids = buildBoard();
        seen = listen();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(ids, seen.stop());

        expect(caughtUp).toEqual(plain);

        // And it was crowded: fights looked for room again and again, and the camp was hunted.
        expect(plain.steps.searches).toBeGreaterThanOrEqual(5);
        expect(plain.seen.kills).toBeGreaterThanOrEqual(8);
    }, 120_000);

    it('in 100 ms ticks, the same hour-shaped hunt kills within a tenth of the 1000 ms steps (fidelity)', () => {
        let ids = buildBoard();
        let seen = listen();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const coarse = end(ids, seen.stop());

        ids = buildBoard();
        seen = listen();
        for (let i = 0; i < AWAY_MS / 100; i++) GameLoop.runHandlers(100);
        const fine = end(ids, seen.stop());

        console.info(`fidelity: kills ${coarse.seen.kills} at 1000 ms, ${fine.seen.kills} at 100 ms; searches ${coarse.steps.searches} / ${fine.steps.searches}`);
        expect(Math.abs(coarse.seen.kills - fine.seen.kills)).toBeLessThanOrEqual(Math.max(2, Math.ceil(fine.seen.kills / 10)));
        expect(fine.steps.searches).toBeGreaterThan(0);
    }, 120_000);
});
