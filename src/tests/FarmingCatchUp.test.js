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
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as EnemyMotion from '../systems/board/EnemyMotion.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as Fields from '../systems/board/Fields.js';
import * as Growth from '../systems/board/Growth.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { resetMatTuning, setMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Time away beside a Field (brief 230 S4): a farmer is pinned to a Field sown with wheat (sown
 * before the time away: a pick sows on the next tick), with a Well (Grow Time −25 %), a Composter
 * (+2 to the load) and a Beehive (25 % to double the wheat) in reach, and one more seed in the Bank.
 * The crop grows about 45 minutes, ripens with twelve harvests of 2.35 s, is harvested over its load,
 * sows again with the last seed, grows and is harvested again, and then stops: no seed. Its times
 * fall part-way through ticks of either size. The Beehive's rolls draw from a seeded `Math.random`
 * in fixed places of each finished cycle, so the same time played in 100 ms steps, in 1000 ms steps
 * and through the game's own catch-up stands in the same place at two moments: 46 minutes in (the
 * second crop growing, on the same clock) and 100 minutes in (stopped): the same harvests, the same
 * doubles, the same wheat.
 */

const NOW = 1_800_000_000_000;
/** The first look: the second crop growing. Then the rest of the time away, to the stop. */
const FIRST_MS = 46 * 60_000;
const AWAY_MS = 100 * 60_000;
const SEED = 'fixture_fcu_seed';
const WHEAT_ITEM = 'fixture_fcu_wheat';
const WHEAT = 'fcu_recipe_wheat';

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({ [SEED]: item(SEED, 'FCU Wheat Seed'), [WHEAT_ITEM]: item(WHEAT_ITEM, 'FCU Wheat') });
registerRecipePools({
    farming: [{
        id: WHEAT, name: 'FCU Wheat', levelRequirement: 1, durationMs: 2350, xp: 1, stationKinds: ['field'],
        inputs: [{ itemId: SEED, quantity: 1 }],
        outputs: [{ itemId: WHEAT_ITEM, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 60 * 60_000 + 530, load: 10 }
    }]
});

const provides = (id, type, bucket, value, extra = {}) => ({
    id: `stm_${id}`, keyword: 'provides', to: { mode: 'id', value: 'fcu_field' }, reach: 'nearby',
    payload: { type, bucket, value, ...extra }
});
const support = (id, name, statement) => ({
    id, name, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', statements: [statement]
});
registerTokenTypes({
    fcu_field: {
        id: 'fcu_field', name: 'FCU Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_farmland', requiresHero: true, field: {},
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 2350, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_fcu_works', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
    },
    fcu_well: support('fcu_well', 'FCU Well', provides('fcu_well', EFFECT_TYPES.GROW_TIME, 'percentage', -0.25)),
    fcu_composter: support('fcu_composter', 'FCU Composter', provides('fcu_composter', EFFECT_TYPES.CROP_LOAD, 'flat', 2)),
    fcu_beehive: support('fcu_beehive', 'FCU Beehive', provides('fcu_beehive', EFFECT_TYPES.DOUBLE_DROP, 'flat', 25, { category: WHEAT_ITEM }))
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
/** The heroes' and enemies' footsteps get a stream of their own (they draw per tick). */
const motion = { state: 7 };
function motionRandom() {
    motion.state = (motion.state + 0x6D2B79F5) | 0;
    let t = motion.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const FIELD = { x: 700, y: 500 };

function buildBoard() {
    stream.state = 41;
    stream.draws = 0;
    motion.state = 7;
    resetMatTuning();
    // No bounty quests: with no Guild Hall to stand beside, each would be retried every tick, and
    // its draws would differ by step size. Nothing here is about quests.
    setMatTuning('questCap', 0);
    GameState.initNew();
    InventoryManager.init();
    const [farmer] = fixtures.makeHeroes(1, { farming: 10 });
    const field = fixtures.placeAt('fcu_field', FIELD.x, FIELD.y);
    fixtures.placeAt('fcu_well', FIELD.x + 150, FIELD.y);
    fixtures.placeAt('fcu_composter', FIELD.x - 150, FIELD.y);
    fixtures.placeAt('fcu_beehive', FIELD.x, FIELD.y + 150);
    InventoryManager.addItem(SEED, 2);
    TileModifiers.rebuildAll();
    expect(StationRecipe.setSelectedRecipe(BoardState.getTokenById(field.id), WHEAT)).toBe(true);
    // Sown before the time away starts: a pick sows on the next tick, whatever its size.
    TimedChanges.tick(1);
    expect(Fields.stageOf(BoardState.getTokenById(field.id))).toBe('growing');
    fixtures.plant(farmer.id, { x: FIELD.x, y: FIELD.y }, { pin: true });
    return field.id;
}

function watch(fieldId) {
    const seen = { cycles: 0, wheat: [], cycleMs: new Set(), stages: [] };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
            if (p.instanceId !== fieldId) return;
            seen.cycles++;
            seen.wheat.push(InventoryManager.getItemCount(WHEAT_ITEM) + SpriteLayer.countOnBoard(WHEAT_ITEM));
        }),
        EventBus.subscribe(BOARD_EVENTS.PROGRESS, (p) => { if (p.instanceId === fieldId && p.cycleTimeMs != null) seen.cycleMs.add(p.cycleTimeMs); }),
        EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => {
            if (p.instanceId !== fieldId) return;
            const field = BoardState.getTokenById(fieldId);
            const stage = field ? Fields.stageOf(field) : null;
            if (stage && seen.stages.at(-1) !== stage) seen.stages.push(stage);
        })
    ];
    return { seen, stop: () => { offs.forEach(off => off()); return seen; } };
}

/** Where the time away ended. Wheat is counted banked or lying on the mat: only the sum is the same. */
function snapshot(fieldId, seen) {
    const field = BoardState.getTokenById(fieldId);
    return {
        cycles: seen.cycles,
        progress: field?.cycleElapsedMs ?? null,
        stages: seen.stages,
        wheat: InventoryManager.getItemCount(WHEAT_ITEM) + SpriteLayer.countOnBoard(WHEAT_ITEM),
        seeds: InventoryManager.getItemCount(SEED) + SpriteLayer.countOnBoard(SEED),
        field: field?.field ? { ...field.field } : null,
        clocks: field?.clocks ? { ...field.clocks } : null,
        stage: field ? Fields.stageOf(field) : null,
        alert: field ? Growth.growthAlertOf(field.id) : null,
        draws: stream.draws
    };
}

function plainLoop(step) {
    const id = buildBoard();
    const w = watch(id);
    let t = 0;
    for (; t < FIRST_MS; t += step) GameLoop.runHandlers(step);
    const first = snapshot(id, { ...w.seen, stages: [...w.seen.stages] });
    for (; t < AWAY_MS; t += step) GameLoop.runHandlers(step);
    const seen = w.stop();
    return { first, snap: snapshot(id, seen), seen };
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    Math.random = seeded;
    HeroMotion.setRandomForTests(motionRandom);
    EnemyMotion.setRandomForTests(motionRandom);
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

describe('⭐ a catch-up beside a Field with a Well, a Composter and a Beehive in reach', () => {
    it('sows, grows, is harvested over its load, sows again, then stops: the same in 100 ms and 1000 ms steps and through the catch-up', async () => {
        const small = plainLoop(100);
        const big = plainLoop(1000);
        expect(big.first).toEqual(small.first);
        expect(big.snap).toEqual(small.snap);
        expect(big.seen.wheat).toEqual(small.seen.wheat);

        const id = buildBoard();
        const w = watch(id);
        const away = { save: false, yieldFn: () => Promise.resolve() };
        await CatchUp.run({ ...away, savedAt: NOW - FIRST_MS, now: NOW });
        expect(snapshot(id, { ...w.seen, stages: [...w.seen.stages] })).toEqual(small.first);
        await CatchUp.run({ ...away, savedAt: NOW, now: NOW + AWAY_MS - FIRST_MS });
        const seen = w.stop();
        expect(snapshot(id, seen)).toEqual(small.snap);
        expect(seen.wheat).toEqual(small.seen.wheat);

        // And what happened. 46 minutes in: the first crop's twelve harvests (ten, the
        // Composter's two) done and the second crop growing, on a clock that is not a whole second.
        expect(small.first.cycles).toBe(12);
        expect(small.first.stage).toBe('growing');
        expect(small.first.clocks.fieldMs % 1000).not.toBe(0);
        // At the end: two crops harvested, 2.35 s a harvest, sown twice, stopped with the Bank empty.
        expect(small.snap.cycles).toBe(24);
        expect([...small.seen.cycleMs]).toEqual([2350]);
        expect(small.snap.stages).toEqual(['ripe', 'growing', 'ripe', 'empty']);
        expect(small.snap.stage).toBe('empty');
        expect(small.snap.seeds).toBe(0);
        expect(small.snap.alert).toEqual({ alert: 'grow_needs_item', needs: [SEED] });
        // One wheat a harvest, some of it doubled by the Beehive: more than one a cycle, fewer than two.
        expect(small.snap.wheat).toBeGreaterThan(small.snap.cycles);
        expect(small.snap.wheat).toBeLessThan(2 * small.snap.cycles);
    }, 120_000);
});
