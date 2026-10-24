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
import * as Guardians from '../systems/board/Guardians.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * The encounters (brief 220, C5) during a catch-up: a guardian's return clock, a node's ambush roll,
 * a lair's boss and a hero waiting for it all run on the tick's `delta` and draw from `Math.random`
 * in a fixed order, so time away ends exactly where the same time played live ends. And a
 * guardian's return clock survives a save and a load. The same harness as `CombatCatchUp.test.js`,
 * in a file of its own.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 6 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const mining = {
    skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1,
    inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }]
};
const enemyConfig = { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [{ itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 2 }] };

registerTokenTypes({
    cu_enc_guardian: {
        id: 'cu_enc_guardian', name: 'Catch-up Guardian', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 's_occult', enemy: { level: 2, style: 'melee' }, config: enemyConfig
    },
    cu_enc_vein: {
        id: 'cu_enc_vein', name: 'Catch-up Guarded Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_industry', config: mining, guardian: { typeId: 'cu_enc_guardian', returnMs: 40000 }
    },
    cu_enc_ambusher: {
        id: 'cu_enc_ambusher', name: 'Catch-up Ambusher', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 5, sprite: 's_occult', enemy: { level: 1, style: 'melee' }, config: enemyConfig
    },
    cu_enc_haunted: {
        id: 'cu_enc_haunted', name: 'Catch-up Haunted Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_industry', config: mining,
        statements: [{
            ...makeStatement(KEYWORD.SPAWNS),
            id: 'stm_cu_enc_ambush',
            payload: { typeId: 'cu_enc_ambusher', placement: PLACEMENT.NEAREST_FREE, chance: 10 },
            when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self', cooldownMs: 0 },
            chargeDelta: 0
        }]
    },
    cu_enc_boss: {
        id: 'cu_enc_boss', name: 'Catch-up Boss', tokenType: 'enemy', rarity: 'rare', theme: 'fixture',
        uses: 1, sprite: 's_occult', enemy: { level: 3, style: 'melee', boss: true }, config: enemyConfig
    },
    cu_enc_lair: {
        id: 'cu_enc_lair', name: 'Catch-up Lair', tokenType: 'resource', rarity: 'rare', theme: 'fixture',
        uses: null, sprite: 's_industry', guardian: { typeId: 'cu_enc_boss', returnMs: 30000 }
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

/**
 * A guarded vein with a fighter on an area flag beside it; a haunted vein with a miner pinned to it;
 * a lair whose boss a fighter fights while a second waits pinned beside it.
 */
function buildBoard() {
    stream.state = 23;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const heroes = fixtures.makeHeroes(4, { forestry: 30, mining: 30, melee: 30 });
    for (const h of heroes) h.hp.current = h.hp.max;
    const vein = fixtures.placeAt('cu_enc_vein', 300, 300);
    const haunted = fixtures.placeAt('cu_enc_haunted', 1000, 300);
    const lair = fixtures.placeAt('cu_enc_lair', 1000, 800);
    // The first tick brings the guardian and the boss; the flags go down after it.
    GameLoop.runHandlers(1000);
    const boss = Guardians.standingGuardianOf(lair);
    fixtures.plant(heroes[0].id, { x: vein.x - 40, y: vein.y + 40 });
    fixtures.plant(heroes[1].id, { x: haunted.x, y: haunted.y }, { pin: true });
    fixtures.plant(heroes[2].id, { x: boss.x, y: boss.y }, { pin: true });
    fixtures.plant(heroes[3].id, { x: boss.x, y: boss.y }, { pin: true });
    TileModifiers.rebuildAll();
    return { heroes, vein, haunted, lair };
}

function listen() {
    const seen = { kills: [], ambushes: 0, defeats: 0, spawned: [] };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, (p) => { seen.kills.push(p.enemyId); }),
        EventBus.subscribe(BOARD_EVENTS.AMBUSHED, () => { seen.ambushes++; }),
        EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, () => { seen.defeats++; }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_SPAWNED, (p) => { seen.spawned.push(p.typeId); })
    ];
    return { stop: () => { offs.forEach(off => off()); return seen; } };
}

function end(board, seen) {
    return {
        heroes: board.heroes.map(h => {
            const hero = GameState.state.heroes.find(x => x.id === h.id);
            return { hp: hero.hp.current, xp: hero.skills.melee?.xp ?? null, mining: hero.skills.mining?.xp ?? null, status: hero.status };
        }),
        tokens: BoardState.tokens().map(t => ({ typeId: t.typeId, uses: t.usesRemaining, clocks: t.clocks ?? null })),
        // Less the enemy's instance id, whose first half is the wall clock at its making.
        guardians: [board.vein, board.lair].map(t => {
            const { guardianId: _id, ...state } = Guardians.guardianState(BoardState.getTokenById(t.id));
            return state;
        }),
        draws: stream.draws,
        seen
    };
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    Math.random = seeded;
    HeroMotion.setRandomForTests(seeded);
    EnemyMotion.setRandomForTests(seeded);
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
    EnemyMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('encounters during a catch-up', () => {
    it('a guardian, an ambush node and a boss lair end exactly where the same 1000 ms steps through the plain loop end', async () => {
        let board = buildBoard();
        let seen = listen();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(board, seen.stop());

        board = buildBoard();
        seen = listen();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(board, seen.stop());

        expect(caughtUp).toEqual(plain);

        // It all really happened: the guardian and the boss beaten and back more than once, ambushes
        // sprung and beaten, and never two heroes on one enemy.
        expect(plain.seen.kills.filter(k => k === 'cu_enc_guardian').length).toBeGreaterThanOrEqual(2);
        expect(plain.seen.kills.filter(k => k === 'cu_enc_boss').length).toBeGreaterThanOrEqual(2);
        expect(plain.seen.ambushes).toBeGreaterThan(0);
        expect(plain.seen.kills.filter(k => k === 'cu_enc_ambusher').length).toBeGreaterThan(0);
        expect(plain.seen.spawned.filter(t => t === 'cu_enc_boss').length).toBeGreaterThanOrEqual(2);
    }, 60_000);

    it('a beaten guardian\'s return clock survives a save and a load, and it comes back on time', async () => {
        const board = buildBoard();
        const veinId = board.vein.id;
        // Play until the guardian has fallen and its clock has run a while.
        let beatenAt = null;
        for (let i = 0; i < 300 && beatenAt === null; i++) {
            GameLoop.runHandlers(1000);
            if (Guardians.guardianState(BoardState.getTokenById(veinId))?.beaten) beatenAt = i;
        }
        expect(beatenAt).not.toBeNull();
        for (let i = 0; i < 10; i++) GameLoop.runHandlers(1000);
        const before = Guardians.guardianState(BoardState.getTokenById(veinId));
        expect(before.beaten).toBe(true);
        expect(before.inMs).toBeGreaterThan(0);
        const savedClock = BoardState.getTokenById(veinId).clocks.guardianMs;

        localStorage.setItem(SaveManager.getSlotKey(0), GameState.serializeJson());
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);

        const vein = BoardState.getTokenById(veinId);
        expect(vein.clocks.guardianMs).toBe(savedClock);
        expect(Guardians.guardianState(vein)).toEqual(before);
        const steps = Math.ceil(before.inMs / 1000);
        for (let i = 0; i < steps - 1; i++) GameLoop.runHandlers(1000);
        expect(Guardians.isGuarded(BoardState.getTokenById(veinId))).toBe(false);
        GameLoop.runHandlers(1000);
        expect(Guardians.isGuarded(BoardState.getTokenById(veinId))).toBe(true);
    }, 60_000);

    it('an old save with two heroes working one enemy loads into one fight; the second waits', async () => {
        const board = buildBoard();
        const [, , hunter, waiter] = board.heroes;
        for (let i = 0; i < 3; i++) GameLoop.runHandlers(1000);
        const fight = BoardCombat.fightOfHero(hunter.id);
        expect(fight).toBeTruthy();
        // Written as a save from before one-on-one fights could hold it: both noted at the enemy.
        const save = JSON.parse(GameState.serializeJson());
        save.state.board.workClaims[waiter.id] = { instanceId: fight.instanceId, side: -1 };
        localStorage.setItem(SaveManager.getSlotKey(0), JSON.stringify(save));
        expect(await SaveManager.loadSlot(0, { catchUp: false })).toBe(true);

        for (let i = 0; i < 3; i++) GameLoop.runHandlers(1000);
        const fighting = [hunter.id, waiter.id].filter(id => BoardCombat.fightOfHero(id)?.instanceId === fight.instanceId);
        expect(fighting).toHaveLength(1);
    }, 60_000);
});
