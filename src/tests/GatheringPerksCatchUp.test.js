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
import * as Fields from '../systems/board/Fields.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { markHeld } from '../systems/equipment/heldCopies.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * ⭐ The four gathering signature perks while the player is away (brief 800 P1 and P2): a catch-up
 * ends exactly where the same time played in 1000 ms steps ends, perks and all, and each perk acted
 * during it. Four masters at 99 on one mat: a miner on a vein that ends one in three (Motherlode:
 * it never rests), a farmer on a wild Field with no seed in the Bank (Evergreen: it replants crop
 * after crop), a forester on an Oak with two touching Oaks (Grove Feller: they fall with it, each
 * paid), and an angler on a lake whose lowest fish never lands (Master Angler).
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 3 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const material = (id, extra = {}) => ({ id, name: id, type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw', ...extra });
const ITEMS = ['gp_ore', 'gp_wood', 'gp_grain', 'gp_seed', 'gp_trout', 'gp_tuna', 'gp_salmon', 'gp_bait'];
registerItems({
    gp_ore: material('gp_ore'),
    gp_wood: material('gp_wood'),
    gp_grain: material('gp_grain'),
    gp_seed: material('gp_seed'),
    gp_trout: material('gp_trout', { fish: { level: 1, cycleMs: 2000, bait: 1 } }),
    gp_tuna: material('gp_tuna', { fish: { level: 5, cycleMs: 3000, bait: 1 } }),
    gp_salmon: material('gp_salmon', { fish: { level: 20, cycleMs: 4000, bait: 2 } }),
    gp_bait: material('gp_bait', { equipSlot: 'consumable', sprite: 'i_fish_bait' }),
    gp_rod: { id: 'gp_rod', name: 'Rod', type: 'tool', equipSlot: 'hand', stackable: true, tool: { kind: 'fishing_rod', tier: 1 } }
});

const WHEAT = 'gp_recipe_wheat';
registerRecipePools({
    farming: [{
        id: WHEAT, name: 'GP Wheat', levelRequirement: 1, durationMs: 1500, xp: 1, stationKinds: ['field'],
        inputs: [{ itemId: 'gp_seed', quantity: 1 }], outputs: [{ itemId: 'gp_grain', chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 8000, load: 3 }
    }]
});

const work = (skill, itemId, ms, extra = {}) => ({
    skill, skillRequired: 1, cycleTimeMs: ms, xp: 2, inputs: [],
    outputs: itemId ? [{ itemId, quantity: 1, chance: 100 }] : [], ...extra
});
const resource = (id, extra) => ({ id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_nature', requiresHero: true, ...extra });

registerTokenTypes({
    gp_vein: resource('gp_vein', { uses: 3, config: work('mining', 'gp_ore', 1500), respawn: { mode: 'refill', afterMs: 20000 } }),
    gp_oak: resource('gp_oak', { uses: 4, config: work('forestry', 'gp_wood', 2000), respawn: { mode: 'regrow', into: 'gp_oak_stump' } }),
    gp_oak_stump: resource('gp_oak_stump', { uses: null, config: null, requiresHero: false, grows: { into: 'gp_oak', afterMs: 15000 } }),
    gp_field: {
        id: 'gp_field', name: 'GP Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_farmland', requiresHero: true, config: work('farming', null, 1500), field: { startsWith: WHEAT },
        statements: [{ id: 'stm_gp_field_works', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
    },
    gp_lake: resource('gp_lake', {
        uses: null, sprite: 't_lake_small', tags: ['water'], config: work('fishing', null, 2000),
        catchPools: [{ tool: 'fishing_rod', bait: 'gp_bait', catches: [
            { itemId: 'gp_trout', weight: 3 }, { itemId: 'gp_tuna', weight: 2 }, { itemId: 'gp_salmon', weight: 1 }
        ] }]
    })
});

const perk = (id, type, skill) => ({
    id, name: id,
    statements: [{
        id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
        payload: { type, bucket: 'flat', value: 100, category: skill }
    }]
});
registerEffects({
    gp_motherlode: perk('gp_motherlode', EFFECT_TYPES.NEVER_RUNS_OUT, 'mining'),
    gp_evergreen: perk('gp_evergreen', EFFECT_TYPES.FREE_REPLANT, 'farming'),
    gp_grove_feller: perk('gp_grove_feller', EFFECT_TYPES.GROVE_FELLING, 'forestry'),
    gp_master_angler: perk('gp_master_angler', EFFECT_TYPES.BETTER_CATCH, 'fishing')
});

function holdPerks(on) {
    const row = (effectId) => ({ perks: on ? [{ level: 99, effectId }] : [] });
    registerSkillPerks({
        mining: row('gp_motherlode'), farming: row('gp_evergreen'),
        forestry: row('gp_grove_feller'), fishing: row('gp_master_angler')
    });
}

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

const VEIN = { x: 300, y: 300 };
const FIELD = { x: 900, y: 300 };
const OAK = { x: 1500, y: 300 };
const LAKE = { x: 900, y: 800 };

function buildBoard(withPerks = true) {
    stream.state = 41;
    stream.draws = 0;
    resetMatTuning();
    holdPerks(withPerks);
    GameState.initNew();
    InventoryManager.init();
    const skills = { mining: 99, forestry: 99, farming: 99, fishing: 99 };
    const [miner, farmer, forester, angler] = fixtures.makeHeroes(4, skills);
    angler.equipment[0] = 'gp_rod';
    markHeld(angler, 0, true);
    angler.equipment[1] = 'gp_bait';
    InventoryManager.addItem('gp_bait', 300);
    const vein = fixtures.placeAt('gp_vein', VEIN.x, VEIN.y);
    const field = fixtures.placeAt('gp_field', FIELD.x, FIELD.y);
    const oak = fixtures.placeAt('gp_oak', OAK.x, OAK.y);
    // Edges touching (128 u), the closest two Tokens may stand, so Grove Feller reaches them.
    fixtures.placeAt('gp_oak', OAK.x + 128, OAK.y);
    fixtures.placeAt('gp_oak', OAK.x, OAK.y + 128);
    const lake = fixtures.placeAt('gp_lake', LAKE.x, LAKE.y);
    fixtures.orderAt(miner.id, VEIN);
    fixtures.orderAt(farmer.id, FIELD);
    fixtures.orderAt(forester.id, OAK);
    fixtures.orderAt(angler.id, LAKE);
    TileModifiers.rebuildAll();
    return { vein: vein.id, field: field.id, oak: oak.id, lake: lake.id };
}

function listen(ids) {
    const seen = { rested: [], cycles: { vein: 0, oak: 0, field: 0 }, caught: [], replants: 0 };
    let stage = Fields.STAGE.RIPE;
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.TOKEN_RESTING, (p) => seen.rested.push(p.typeId)),
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
            if (p.instanceId === ids.vein) seen.cycles.vein++;
            if (p.instanceId === ids.field) seen.cycles.field++;
            if (p.typeId === 'gp_oak') seen.cycles.oak++;
            if (p.instanceId === ids.lake) seen.caught.push(...p.produced);
        }),
        EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => {
            const field = p.instanceId === ids.field ? BoardState.getTokenById(ids.field) : null;
            if (!field) return;
            const now = Fields.stageOf(field);
            if (now === Fields.STAGE.GROWING && stage !== Fields.STAGE.GROWING) seen.replants++;
            stage = now;
        })
    ];
    return { stop: () => { offs.forEach(off => off()); return seen; } };
}

/** What every item came to, on the board or banked: a catch-up banks as it goes, live play leaves it lying. */
function end(seen) {
    const items = Object.fromEntries(ITEMS.map(id => [id, InventoryManager.getItemCount(id)]));
    for (const s of SpriteLayer.getSprites()) if (s.refId in items) items[s.refId] += s.quantity;
    const xp = Object.fromEntries(GameState.state.heroes.map(h => [h.id, h.skills]));
    const field = BoardState.tokens().find(t => t.typeId === 'gp_field');
    return { seen, items, xp: JSON.stringify(xp), stopped: Fields.isStopped(field), draws: stream.draws };
}

async function caughtUp(withPerks = true) {
    const ids = buildBoard(withPerks);
    const seen = listen(ids);
    await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
    return end(seen.stop());
}

function plain(withPerks = true) {
    const ids = buildBoard(withPerks);
    const seen = listen(ids);
    for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
    return end(seen.stop());
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
    holdPerks(false);
    Math.random = realRandom;
    HeroMotion.setRandomForTests();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('⭐ the gathering signature perks during time away', () => {
    it('a catch-up ends where 1000 ms steps end, and every perk acted in it', async () => {
        const live = plain();
        const away = await caughtUp();
        expect(away).toEqual(live);

        const without = plain(false);
        // Motherlode: the vein never rested; without it, it rests and waits again and again.
        expect(live.seen.rested).not.toContain('gp_vein');
        expect(without.seen.rested).toContain('gp_vein');
        expect(live.seen.cycles.vein).toBeGreaterThan(without.seen.cycles.vein);
        // Evergreen: crop after crop with no seed ever in the Bank; without it, the first crop out stops it.
        expect(live.stopped).toBe(false);
        expect(live.seen.replants).toBeGreaterThanOrEqual(3);
        expect(live.items.gp_seed).toBe(0);
        expect(without.stopped).toBe(true);
        // Grove Feller: more Oak fell than were worked down, and every Oak felled paid its logs.
        const oaksRested = (r) => r.seen.rested.filter(t => t === 'gp_oak').length;
        expect(oaksRested(live)).toBeGreaterThan(oaksRested(without));
        expect(live.items.gp_wood).toBeGreaterThan(live.seen.cycles.oak);
        expect(without.items.gp_wood).toBe(without.seen.cycles.oak);
        // Master Angler: no Trout ever landed; without it, Trout bite most often.
        expect(live.seen.caught.length).toBeGreaterThan(20);
        expect(live.seen.caught).not.toContain('gp_trout');
        expect(without.seen.caught).toContain('gp_trout');
    }, 120_000);
});
