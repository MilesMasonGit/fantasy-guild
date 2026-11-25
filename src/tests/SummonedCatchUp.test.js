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
import * as Summons from '../systems/board/Summons.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { isSummoned } from '../systems/hero/summoned.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Summoned workers during time away (brief 810 K5): a Summoned worker mining runs out and leaves,
 * and its Circle calls another and charges it, all on the tick's `delta`, so a catch-up ends exactly
 * where the same 1000 ms steps through the plain loop end. The harness of
 * `CombatCatchUpEncounters.test.js`.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 12_000;

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

registerItems({
    k5c_gel: { id: 'k5c_gel', name: 'Away Gel', type: 'material', stackable: true, sprite: 'i_bones' },
    k5c_ore: { id: 'k5c_ore', name: 'Away Ore', type: 'material', stackable: true, sprite: 'i_bones' }
});

registerTokenTypes({
    k5c_slime: {
        id: 'k5c_slime', name: 'Away Slime', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult',
        enemy: { level: 1 }, config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    k5c_summon: {
        id: 'k5c_summon', name: 'Summoned Away Slime', rarity: 'common', theme: 'fixture', sprite: 's_occult',
        summon: { of: 'k5c_slime', skills: { mining: 20 } }
    },
    k5c_circle: {
        id: 'k5c_circle', name: 'Away Circle', tokenType: 'station', rarity: 'rare', theme: 'fixture', uses: null, sprite: 's_occult',
        summonCircle: { charges: 2, perLevel: 0 },
        config: { skill: 'summoning', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] },
        statements: [{ id: 'stm_k5c_circle', keyword: KEYWORD.STATION, payload: { skill: 'summoning' } }]
    },
    k5c_vein: {
        id: 'k5c_vein', name: 'Away Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_industry',
        needsTool: { kind: 'pickaxe', minTier: 1 },
        config: { skill: 'mining', skillRequired: 10, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [{ itemId: 'k5c_ore', chance: 100, minQty: 1, maxQty: 1 }] }
    }
});

registerRecipePools({
    summoning: [{
        id: 'recipe_k5c_summon', name: 'Summoned Away Slime', skill: 'summoning', levelRequirement: 1, requiresContext: [],
        inputs: [{ itemId: 'k5c_gel', quantity: 1 }],
        outputs: [{ tokenId: 'k5c_summon', chance: 100, minQty: 1, maxQty: 1 }],
        durationMs: 5000, xp: 0
    }]
});

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
 * A Circle with its hero on it and Gel for two more calls; a Summoned worker it already called (2
 * charges), sent to mine a vein beside it.
 */
function buildBoard() {
    stream.state = 31;
    stream.draws = 0;
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    BoardCombat.clearAll();
    const [summoner] = fixtures.makeHeroes(1, { summoning: 30 });
    const circle = fixtures.placeAt('k5c_circle', 400, 400);
    const vein = fixtures.placeAt('k5c_vein', 900, 400);
    StationRecipe.setSelectedRecipe(circle, 'recipe_k5c_summon');
    InventoryManager.addItem('k5c_gel', 2);
    fixtures.orderAt(summoner.id, { x: circle.x, y: circle.y });
    const first = Summons.chargeFromCircle(circle, 'k5c_summon', summoner.id, 'summoning');
    fixtures.orderAt(first.id, { x: vein.x, y: vein.y });
    TileModifiers.rebuildAll();
    return { summoner, circle, vein, first };
}

function listen() {
    const changes = [];
    const off = EventBus.subscribe(BOARD_EVENTS.SUMMON_CHANGED, (p) => changes.push(`${p.change}:${p.charges}${p.reason ? `:${p.reason}` : ''}`));
    return { stop: () => { off(); return changes; } };
}

function end(board, changes) {
    return {
        summons: GameState.state.heroes.filter(isSummoned).map(s => ({
            typeId: s.summon.typeId, charges: s.summon.charges, ofCircle: s.summon.circleId === board.circle.id,
            first: s.id === board.first.id, flag: BoardState.flagOf(s.id) ? { spot: BoardState.flagOf(s.id).spot === true } : null
        })),
        firstGone: !GameState.state.heroes.some(h => h.id === board.first.id) && !BoardState.flagOf(board.first.id),
        gel: InventoryManager.getItemCount('k5c_gel'),
        ore: InventoryManager.getItemCount('k5c_ore') + SpriteLayer.countOnBoard('k5c_ore'),
        tokens: BoardState.tokens().map(t => ({ typeId: t.typeId, cycle: t.cycleElapsedMs ?? 0 })),
        draws: stream.draws,
        changes
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

describe('Summoned workers during time away', () => {
    it('one runs out and leaves, its Circle calls and charges the next: a catch-up ends where the plain loop does', async () => {
        let board = buildBoard();
        let seen = listen();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = end(board, seen.stop());

        board = buildBoard();
        seen = listen();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        const caughtUp = end(board, seen.stop());

        expect(caughtUp).toEqual(plain);

        // It all really happened: the first worked its two charges and left, the Circle called a
        // second at its next cycle, idle beside it, and charged it again, spending both Gels.
        expect(plain.firstGone).toBe(true);
        expect(plain.changes).toEqual(['spent:1', 'spent:0', 'left:0:spent', 'called:2', 'charged:4']);
        expect(plain.summons).toEqual([{ typeId: 'k5c_summon', charges: 4, ofCircle: true, first: false, flag: { spot: true } }]);
        expect(plain.gel).toBe(0);
        expect(plain.ore).toBe(2);
    }, 60_000);
});
