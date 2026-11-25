// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getCoins } from '../systems/inventory/Coins.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as HeroMotion from '../systems/board/HeroMotion.js';
import * as Demolition from '../systems/board/Demolition.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { COIN_ITEM_ID } from '../config/registries/coinCosts.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * ⭐ Salvage and Master Builder while the player is away (brief 800 P4): a catch-up ends exactly
 * where the same time played in 1000 ms steps ends, and both perks acted in it. Two builders at
 * Construction 99 on one mat: one on a Foundation whose build asks 10 Coal with 8 in the Bank (Master
 * Builder's 20 % off is what lets it build), the other taking down a Shed the guild paid 10 Wood and
 * 6 coins for (Salvage's half comes back as loot where it stood).
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 2 * 60_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const material = (id) => ({ id, name: id, type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw' });
const ITEMS = ['bpc_wood', 'bpc_coal'];
registerItems({ bpc_wood: material('bpc_wood'), bpc_coal: material('bpc_coal') });

const structure = (id, extra) => ({ id, name: id, rarity: 'common', theme: 'fixture', uses: null, sprite: 's_industry', ...extra });
registerTokenTypes({
    bpc_foundation: structure('bpc_foundation', { uses: 1, foundation: { kind: 'bpc_kind', skill: 'construction' } }),
    bpc_hall: structure('bpc_hall', { tokenType: 'structure' }),
    bpc_shed: structure('bpc_shed', { tokenType: 'structure' })
});

const BUILD = 'bpc_build_hall';
registerRecipePools({
    construction: [{
        id: BUILD, name: 'Build BPC Hall', levelRequirement: 1, foundationKinds: ['bpc_kind'],
        inputs: [{ itemId: 'bpc_coal', quantity: 10 }],
        outputs: [{ tokenId: 'bpc_hall', chance: 100, minQty: 1, maxQty: 1 }],
        durationMs: 20000, xp: 5
    }]
});

const perk = (id, type, value) => ({
    id, name: id,
    statements: [{ id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby', payload: { type, bucket: 'flat', value } }]
});
registerEffects({
    bpc_salvage: perk('bpc_salvage', EFFECT_TYPES.SALVAGE, 50),
    bpc_master_builder: perk('bpc_master_builder', EFFECT_TYPES.BUILD_DISCOUNT, 20)
});

function holdPerks(on) {
    registerSkillPerks({ construction: { perks: on ? [{ level: 75, effectId: 'bpc_salvage' }, { level: 99, effectId: 'bpc_master_builder' }] : [] } });
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

const FOUNDATION = { x: 500, y: 400 };
const SHED = { x: 1300, y: 600 };

function buildBoard(withPerks = true) {
    stream.state = 23;
    stream.draws = 0;
    resetMatTuning();
    holdPerks(withPerks);
    GameState.initNew();
    InventoryManager.init();
    const [builder, wrecker] = fixtures.makeHeroes(2, { construction: 99 });
    InventoryManager.addItem('bpc_coal', 8);
    const foundation = fixtures.placeAt('bpc_foundation', FOUNDATION.x, FOUNDATION.y);
    StationRecipe.setSelectedRecipe(foundation, BUILD);
    const shed = fixtures.placeAt('bpc_shed', SHED.x, SHED.y);
    shed.paid = { items: [{ itemId: 'bpc_wood', quantity: 10 }], coins: 6 };
    Demolition.mark(shed.id);
    fixtures.orderAt(builder.id, FOUNDATION);
    fixtures.orderAt(wrecker.id, SHED);
    TileModifiers.rebuildAll();
    return { shed: shed.id };
}

function listen() {
    const seen = { built: [], demolished: [] };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.TOKEN_BUILT, (p) => seen.built.push(p.typeId)),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_DEMOLISHED, (p) => seen.demolished.push(p.typeId))
    ];
    return { stop: () => { offs.forEach(off => off()); return seen; } };
}

/** What every item and the coins came to, on the board or banked: a catch-up banks as it goes, live play leaves it lying. */
function end(seen) {
    const items = Object.fromEntries(ITEMS.map(id => [id, InventoryManager.getItemCount(id)]));
    let coins = getCoins();
    for (const s of SpriteLayer.getSprites()) {
        if (s.refId in items) items[s.refId] += s.quantity;
        if (s.refId === COIN_ITEM_ID) coins += s.quantity;
    }
    const hall = BoardState.tokens().find(t => t.typeId === 'bpc_hall');
    return { seen, items, coins, hallPaid: hall?.paid ?? null, draws: stream.draws };
}

async function caughtUp(withPerks = true) {
    buildBoard(withPerks);
    const seen = listen();
    await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
    return end(seen.stop());
}

function plain(withPerks = true) {
    buildBoard(withPerks);
    const seen = listen();
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

describe('⭐ Salvage and Master Builder during time away', () => {
    it('a catch-up ends where 1000 ms steps end, and both perks acted in it', async () => {
        const live = plain();
        const away = await caughtUp();
        expect(away).toEqual(live);

        // Master Builder: the Hall was built for 8 Coal; without it the build waits for 10.
        expect(live.seen.built).toEqual(['bpc_hall']);
        expect(live.items.bpc_coal).toBe(0);
        expect(live.hallPaid).toEqual({ items: [{ itemId: 'bpc_coal', quantity: 8 }], coins: 0 });
        // Salvage: half the Shed's 10 Wood and 6 coins came back.
        expect(live.seen.demolished).toEqual(['bpc_shed']);
        expect(live.items.bpc_wood).toBe(5);
        expect(live.coins).toBe(3);

        const without = plain(false);
        expect(without.seen.built).toEqual([]);
        expect(without.items.bpc_coal).toBe(8);
        expect(without.seen.demolished).toEqual(['bpc_shed']);
        expect(without.items.bpc_wood).toBe(0);
        expect(without.coins).toBe(0);
    }, 120_000);
});
