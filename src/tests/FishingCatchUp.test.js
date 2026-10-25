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
 * of bait on the same catch. Two fishers: one with a rod and five worms that run out part-way
 * (the worm pool, then the lake's basic pool), one with a net.
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
    cu5_rod: { id: 'cu5_rod', name: 'Rod', type: 'tool', equipSlot: 'hand', stackable: true, tool: { kind: 'fishing_rod', tier: 1 } },
    cu5_net: { id: 'cu5_net', name: 'Net', type: 'tool', equipSlot: 'hand', stackable: true, tool: { kind: 'fishing_net', tier: 1 } }
});

registerTokenTypes({
    cu5_lake: {
        id: 'cu5_lake', name: 'Catch-up Lake', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_lake_small', requiresHero: true,
        config: { skill: 'fishing', skillRequired: 1, cycleTimeMs: 2500, xp: 2, inputs: [], outputs: [] },
        catchPools: [
            { tool: 'fishing_rod', catches: [{ itemId: 'cu5_trout', weight: 50 }, { itemId: 'cu5_pike', weight: 40 }, { itemId: 'cu5_eel', weight: 10 }] },
            { tool: 'fishing_rod', bait: 'cu5_worm', catches: [{ itemId: 'cu5_salmon', weight: 70 }, { itemId: 'cu5_eel', weight: 30 }] },
            { tool: 'fishing_net', catches: [{ itemId: 'cu5_shrimp', weight: 3 }, { itemId: 'cu5_trout', weight: 1 }] }
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

/** Two fishers on two lakes, far apart: a rod with five worms in the Bank, and a net. */
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
    netter.equipment[0] = 'cu5_net';
    markHeld(netter, 0, true);
    InventoryManager.addItem('cu5_worm', 5);
    const a = fixtures.placeAt('cu5_lake', 400, 400);
    const b = fixtures.placeAt('cu5_lake', 1300, 400);
    fixtures.plant(angler.id, { x: a.x, y: a.y }, { pin: true });
    fixtures.plant(netter.id, { x: b.x, y: b.y }, { pin: true });
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

        // And the fishing really happened: the worms ran out part-way, the worm pool's Salmon came
        // first and the basic pool's Trout and Pike after; the net landed its own pool.
        const rod = plain.seen.rod;
        expect(rod.length).toBeGreaterThanOrEqual(30);
        expect(plain.worms).toBe(0);
        expect(rod.slice(0, 5).every(f => f === 'cu5_salmon' || f === 'cu5_eel')).toBe(true);
        expect(rod.slice(0, 5)).toContain('cu5_salmon');
        expect(rod.slice(5)).not.toContain('cu5_salmon');
        expect(rod.slice(5).some(f => f === 'cu5_trout' || f === 'cu5_pike')).toBe(true);
        expect(new Set(plain.seen.net)).toEqual(new Set(['cu5_shrimp', 'cu5_trout']));
        // Every catch is on the board or in the Bank: one fish a catch, nothing widened here.
        const total = Object.values(plain.caught).reduce((a, b) => a + b, 0);
        expect(total).toBe(rod.length + plain.seen.net.length);
        expect(plain.lakes).toEqual([null, null]);
    }, 60_000);
});
