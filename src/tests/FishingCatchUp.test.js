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
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { markHeld } from '../systems/equipment/heldCopies.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Brief 230 S5: fishing during time away ends exactly where the same time played live ends. Each
 * catch's pick draws from `Math.random` in a fixed place of the finished cycle, and each bait is
 * spent at its catch, so a catch-up that replays the same steps lands the same fish and runs out
 * of bait on the same catch, and each lure breaks on the same catch. Two fishers: one with a rod,
 * three Salmon Lures that break by chance and eight worms that run out part-way (then they stop
 * fishing), one with a Trap, which needs no bait.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 2 * 60_000;
const FISH = ['cu5_trout', 'cu5_salmon', 'cu5_pike', 'cu5_eel', 'cu5_shrimp'];

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const material = (id) => ({ id, name: id, type: 'material', stackable: true, equipSlot: '', sprite: 'i_trout_raw' });
registerItems({
    ...Object.fromEntries(FISH.map(id => [id, material(id)])),
    cu5_worm: { id: 'cu5_worm', name: 'Worm', type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait' },
    // Picks the Salmon, and breaks often: its break is one more draw a lured catch.
    cu5_lure: { id: 'cu5_lure', name: 'Salmon Lure', type: 'material', stackable: true, equipSlot: 'consumable', sprite: 'i_fish_bait', lure: { fish: ['cu5_salmon'], breakChance: 50 } },
    cu5_rod: { id: 'cu5_rod', name: 'Rod', type: 'tool', equipSlot: 'hand', stackable: true, tool: { kind: 'fishing_rod', tier: 1 } },
    cu5_trap: { id: 'cu5_trap', name: 'Trap', type: 'tool', equipSlot: 'hand', stackable: true, tool: { kind: 'fishing_trap', tier: 1 } }
});

registerTokenTypes({
    cu5_lake: {
        id: 'cu5_lake', name: 'Catch-up Lake', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_lake_small', requiresHero: true,
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 2500, xp: 2, inputs: [], outputs: [] },
        catchPools: [
            { tool: 'fishing_rod', bait: 'cu5_worm', catches: [{ itemId: 'cu5_salmon', weight: 70 }, { itemId: 'cu5_eel', weight: 30 }] },
            { tool: 'fishing_trap', catches: [{ itemId: 'cu5_shrimp', weight: 3 }, { itemId: 'cu5_trout', weight: 1 }] }
        ]
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

/** Two fishers on two lakes, far apart: a rod with five worms in the Bank, and a Trap. */
function buildBoard() {
    stream.state = 23;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [angler, netter] = fixtures.makeHeroes(2, { fishing: 10 });
    angler.equipment[0] = 'cu5_rod';
    markHeld(angler, 0, true);
    angler.equipment[1] = 'cu5_worm';
    angler.equipment[2] = 'cu5_lure';
    InventoryManager.addItem('cu5_lure', 3);
    netter.equipment[0] = 'cu5_trap';
    markHeld(netter, 0, true);
    InventoryManager.addItem('cu5_worm', 8);
    const a = fixtures.placeAt('cu5_lake', 400, 400);
    const b = fixtures.placeAt('cu5_lake', 1300, 400);
    fixtures.orderAt(angler.id, { x: a.x, y: a.y });
    fixtures.orderAt(netter.id, { x: b.x, y: b.y });
    TileModifiers.rebuildAll();
    return { a: a.id, b: b.id, angler: angler.id };
}

function listen(ids) {
    const seen = { rod: [], net: [] };
    const role = { [ids.a]: 'rod', [ids.b]: 'net' };
    const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => {
        if (role[p.instanceId]) seen[role[p.instanceId]].push(p.produced.join('+') || '-');
    });
    return { stop: () => { off(); return seen; } };
}

/**
 * Every fish caught, on the board or banked: a catch-up collects what lands as it goes, live play
 * leaves it lying until it is picked up, so only the sum is the same.
 */
function end(ids, seen) {
    const caught = Object.fromEntries(FISH.map(id => [id, InventoryManager.getItemCount(id)]));
    for (const s of SpriteLayer.getSprites()) if (s.refId in caught) caught[s.refId] += s.quantity;
    const angler = GameState.state.heroes.find(h => h.id === ids.angler);
    return {
        seen, caught,
        worms: InventoryManager.getItemCount('cu5_worm'),
        lures: InventoryManager.getItemCount('cu5_lure'),
        xp: angler.skills.fishing.xp,
        lakes: BoardState.tokens().filter(t => t.typeId === 'cu5_lake').map(t => t.usesRemaining),
        draws: stream.draws
    };
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('fishing during a catch-up', () => {
    it('ends exactly where the same 1000 ms steps through the plain loop end, bait running out on the same catch', async () => {
        let ids = buildBoard();
        let seen = listen(ids);
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(ids, seen.stop());

        ids = buildBoard();
        seen = listen(ids);
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(ids, seen.stop());

        expect(caughtUp).toEqual(plain);

        // And the fishing really happened: the eight worms landed the worm pool's catches, the lure
        // picking the Salmon and breaking now and then, then the rod stopped; the Trap kept landing its own pool.
        const rod = plain.seen.rod;
        expect(rod).toHaveLength(8);
        expect(plain.worms).toBe(0);
        expect(plain.lures).toBeLessThan(3);
        // A lure still left picked the Salmon every catch.
        if (plain.lures > 0) expect(new Set(rod)).toEqual(new Set(['cu5_salmon']));
        expect(rod.every(f => f === 'cu5_salmon' || f === 'cu5_eel')).toBe(true);
        expect(rod).toContain('cu5_salmon');
        expect(plain.seen.net.length).toBeGreaterThanOrEqual(30);
        expect(new Set(plain.seen.net)).toEqual(new Set(['cu5_shrimp', 'cu5_trout']));
        // Every catch is on the board or in the Bank: one fish a catch, nothing widened here.
        const total = Object.values(plain.caught).reduce((a, b) => a + b, 0);
        expect(total).toBe(rod.length + plain.seen.net.length);
        expect(plain.lakes).toEqual([null, null]);
    }, 60_000);
});
