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
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as Flags from '../systems/board/Flags.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { PLACEMENT } from '../config/registries/placementRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * The encounters (brief 220, C5) during a catch-up: a guardian's camp of one beside a rich vein, a
 * node's ambush roll, a boss's den with a hero fighting it and another waiting, and a Summoning
 * Circle calling a boss all run on the tick's `delta` and draw from `Math.random` in a fixed order,
 * so time away ends exactly where the same time played live ends. The same harness as
 * `CombatCatchUp.test.js`, in a file of its own.
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

registerItems({
    cu_enc_horn: { id: 'cu_enc_horn', name: 'Catch-up Horn', type: 'material', stackable: true, sprite: 'i_bones' }
});

registerTokenTypes({
    cu_enc_guardian: {
        id: 'cu_enc_guardian', name: 'Catch-up Guardian', tokenType: 'enemy', rarity: 'common', theme: 'fixture',
        uses: 1, sprite: 's_occult', enemy: { level: 2, style: 'melee', hostile: true }, config: enemyConfig
    },
    cu_enc_guardian_camp: {
        id: 'cu_enc_guardian_camp', name: 'Catch-up Guardian Camp', tokenType: 'spawner', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'cu_enc_guardian', weight: 1 }], allowance: 1, intervalMs: 40000, upkeep: [] }
    },
    cu_enc_vein: {
        id: 'cu_enc_vein', name: 'Catch-up Rich Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_industry', config: mining
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
    cu_enc_den: {
        id: 'cu_enc_den', name: 'Catch-up Den', tokenType: 'spawner', rarity: 'rare', theme: 'fixture',
        uses: null, sprite: 's_crime',
        spawner: { spawns: [{ typeId: 'cu_enc_boss', weight: 1 }], allowance: 1, intervalMs: 30000, upkeep: [] }
    },
    cu_enc_circle: {
        id: 'cu_enc_circle', name: 'Catch-up Circle', tokenType: 'station', rarity: 'rare', theme: 'fixture',
        uses: null, sprite: 's_occult',
        config: { skill: 'alchemy', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] },
        statements: [{ id: 'stm_cu_enc_circle_station', keyword: 'station', payload: { skill: 'alchemy' } }]
    }
});

registerRecipePools({
    alchemy: [{
        id: 'recipe_cu_enc_summon', name: 'Catch-up Summon', levelRequirement: 1, requiresContext: [],
        inputs: [{ itemId: 'cu_enc_horn', quantity: 1 }],
        outputs: [{ tokenId: 'cu_enc_boss', chance: 100, minQty: 1, maxQty: 1 }],
        durationMs: 5000, xp: 0
    }]
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
 * A guardian's camp beside a rich vein with a fighter flagged there; a haunted vein with a miner
 * pinned to it; a den whose boss a fighter fights while a second waits pinned beside it; a
 * Summoning Circle with a hero on it and two Horns in the Bank, and a fighter beside it.
 */
function buildBoard() {
    stream.state = 23;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const heroes = fixtures.makeHeroes(6, { forestry: 30, mining: 30, alchemy: 30, melee: 30 });
    for (const h of heroes) h.hp.current = h.hp.max;
    const camp = fixtures.placeAt('cu_enc_guardian_camp', 300, 300);
    const vein = fixtures.placeAt('cu_enc_vein', 460, 300);
    const haunted = fixtures.placeAt('cu_enc_haunted', 1000, 300);
    const den = fixtures.placeAt('cu_enc_den', 1000, 800);
    const circle = fixtures.placeAt('cu_enc_circle', 300, 800);
    InventoryManager.addItem('cu_enc_horn', 2);
    StationRecipe.setSelectedRecipe(circle, 'recipe_cu_enc_summon');
    // The camps' first members stand at once (they would arrive after an interval); the flags go down after.
    SpawnerSystem.attemptSpawn(camp, getTokenType(camp.typeId));
    SpawnerSystem.attemptSpawn(den, getTokenType(den.typeId));
    const boss = BoardState.tokens().find(t => t.typeId === 'cu_enc_boss');
    fixtures.plant(heroes[0].id, { x: vein.x, y: vein.y + 40 });
    fixtures.plant(heroes[1].id, { x: haunted.x, y: haunted.y }, { pin: true });
    fixtures.plant(heroes[2].id, { x: boss.x, y: boss.y }, { pin: true });
    fixtures.plant(heroes[3].id, { x: boss.x, y: boss.y }, { pin: true });
    fixtures.plant(heroes[4].id, { x: circle.x, y: circle.y }, { pin: true });
    fixtures.plant(heroes[5].id, { x: circle.x + 160, y: circle.y });
    playerResends([heroes[2].id, heroes[3].id, heroes[5].id]);
    TileModifiers.rebuildAll();
    return { heroes, camp, vein, haunted, den, circle };
}

/**
 * The player, under hero orders (brief 260 O1): a boss beaten is gone, and the heroes sent at it
 * need a job, so at the start of each tick every one of `heroIds` with no Token order is sent at
 * the boss standing on the mat, if any. A tick handler, so a catch-up runs it exactly as the plain
 * loop does.
 */
const RESEND = 'test_player_resends';
function playerResends(heroIds) {
    GameLoop.offTick(RESEND);
    GameLoop.onTick(RESEND, () => {
        const boss = BoardState.tokens().find(t => t.typeId === 'cu_enc_boss');
        if (!boss) return;
        for (const id of heroIds) if (!Flags.pinnedTokenOf(id)) Flags.orderToken(id, boss);
    }, 0);
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
        tokens: BoardState.tokens().map(t => ({ typeId: t.typeId, uses: t.usesRemaining, clocks: t.clocks ?? null, x: t.x, y: t.y })),
        horns: InventoryManager.getItemCount('cu_enc_horn'),
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
    GameLoop.offTick(RESEND);
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
    it('a guardian camp, an ambush node, a boss den and a Summoning Circle end exactly where the same 1000 ms steps through the plain loop end', async () => {
        let board = buildBoard();
        let seen = listen();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(board, seen.stop());

        board = buildBoard();
        seen = listen();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(board, seen.stop());

        expect(caughtUp).toEqual(plain);

        // It all really happened: the guardian and the den's boss beaten and back more than once,
        // ambushes sprung and beaten, both Horns used, and never two heroes on one enemy.
        expect(plain.seen.kills.filter(k => k === 'cu_enc_guardian').length).toBeGreaterThanOrEqual(2);
        expect(plain.seen.kills.filter(k => k === 'cu_enc_boss').length).toBeGreaterThanOrEqual(3);
        expect(plain.seen.ambushes).toBeGreaterThan(0);
        expect(plain.seen.kills.filter(k => k === 'cu_enc_ambusher').length).toBeGreaterThan(0);
        expect(plain.horns).toBe(0);
    }, 60_000);

    it('a full den banks no time: its boss comes back a whole interval after each kill, live and in a catch-up alike', async () => {
        // One fighter pinned to a den's boss; each duel lasts longer than the den's 30 s interval,
        // so under the old timing the den's clock would be full at every kill.
        const buildDen = () => {
            stream.state = 41;
            stream.draws = 0;
            resetMatTuning();
            GameState.initNew();
            InventoryManager.init();
            const [hunter] = fixtures.makeHeroes(1, { melee: 30 });
            hunter.hp.current = hunter.hp.max;
            const den = fixtures.placeAt('cu_enc_den', 600, 500);
            SpawnerSystem.attemptSpawn(den, getTokenType(den.typeId));
            const boss = BoardState.tokens().find(t => t.typeId === 'cu_enc_boss');
            fixtures.plant(hunter.id, { x: boss.x, y: boss.y }, { pin: true });
            playerResends([hunter.id]);
            TileModifiers.rebuildAll();
            return hunter;
        };
        const watch = (clock) => {
            const events = [];
            const offs = [
                EventBus.subscribe(ENGINE_EVENTS.COMBAT_VICTORY, () => events.push(['kill', clock()])),
                EventBus.subscribe(BOARD_EVENTS.TOKEN_SPAWNED, (p) => { if (p.typeId === 'cu_enc_boss') events.push(['back', clock()]); })
            ];
            return () => { offs.forEach(off => off()); return events; };
        };

        let step = 0;
        let hunter = buildDen();
        let stop = watch(() => step);
        for (step = 0; step < AWAY_MS / 1000; step++) GameLoop.runHandlers(1000);
        const plainEvents = stop();
        const plain = { events: plainEvents.map(([e]) => e), hero: GameState.state.heroes[0].skills.melee.xp, draws: stream.draws,
            tokens: BoardState.tokens().map(t => ({ typeId: t.typeId, uses: t.usesRemaining, clocks: t.clocks ?? null })) };

        // Live: every return comes at least a whole interval (30 steps of 1 s) after its kill.
        const kills = plainEvents.filter(([e]) => e === 'kill').map(([, t]) => t);
        const backs = plainEvents.filter(([e]) => e === 'back').map(([, t]) => t);
        expect(kills.length).toBeGreaterThanOrEqual(2);
        for (const k of kills) {
            const next = backs.find(t => t > k);
            if (next !== undefined) expect(next - k).toBeGreaterThanOrEqual(29);
        }

        hunter = buildDen();
        stop = watch(() => 0);
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtEvents = stop();
        const caught = { events: caughtEvents.map(([e]) => e), hero: GameState.state.heroes[0].skills.melee.xp, draws: stream.draws,
            tokens: BoardState.tokens().map(t => ({ typeId: t.typeId, uses: t.usesRemaining, clocks: t.clocks ?? null })) };
        expect(caught).toEqual(plain);
        void hunter;
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
