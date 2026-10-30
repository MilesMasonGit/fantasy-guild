// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Time away with the S1a speed-ups on the mat (brief 230): a Sapling a Forest speeds, a resting
 * vein a support speeds, and a vein whose five Minecarts are held at the 80 % floor. The catch-up
 * must end exactly where the same time played through the plain loop ends, and a growth clock
 * must not care how big the steps were.
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

const mining = (cycleTimeMs) => ({
    skill: 'mining', skillRequired: 1, cycleTimeMs, xp: 1,
    inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }]
});
const provides = (id, type, value, to) => ({
    id, name: id, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
    statements: [{ id: `stm_${id}`, keyword: 'provides', to, payload: { type, bucket: 'percentage', value } }]
});

registerTokenTypes({
    cu_sapling: {
        id: 'cu_sapling', name: 'CU Sapling', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: null, sprite: 's_nature', tags: ['Oak'], grows: { into: 'cu_tree', afterMs: 40000 }
    },
    cu_tree: {
        id: 'cu_tree', name: 'CU Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 5, sprite: 's_nature', tags: ['Oak'],
        // A Token no bench hero may work (a skill they lack), so nothing walks to it.
        config: { skill: 'fishing', skillRequired: 99, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] }
    },
    cu_rest_vein: {
        id: 'cu_rest_vein', name: 'CU Resting Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 3, sprite: 's_industry', tags: ['Copper'],
        config: { ...mining(3000), skillRequired: 99 },
        respawn: { mode: 'refill', afterMs: 20000 }
    },
    cu_vein: {
        id: 'cu_vein', name: 'CU Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 1000, sprite: 's_industry', config: mining(10000)
    },
    cu_forest: provides('cu_forest', EFFECT_TYPES.GROW_TIME, -0.5, { mode: 'tag', value: 'Oak' }),
    cu_cart: provides('cu_cart', EFFECT_TYPES.GROW_TIME, -0.5, { mode: 'tag', value: 'Copper' }),
    cu_minecart: provides('cu_minecart', EFFECT_TYPES.WORK_TIME, -0.2, { mode: 'id', value: 'cu_vein' })
});

const ring = (c, n, r = 150) => Array.from({ length: n }, (_, i) => ({
    x: Math.round(c.x + r * Math.cos((2 * Math.PI * i) / n)),
    y: Math.round(c.y + r * Math.sin((2 * Math.PI * i) / n))
}));

const SAPLING = { x: 400, y: 300 };
const REST = { x: 1300, y: 300 };
const VEIN = { x: 800, y: 800 };

/** One hero on a vein held at the floor; a sped Sapling and a sped resting vein far from them. */
function buildBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [miner] = fixtures.makeHeroes(1);
    fixtures.placeAt('cu_sapling', SAPLING.x, SAPLING.y);
    fixtures.placeAt('cu_forest', SAPLING.x + 150, SAPLING.y);
    const rest = fixtures.placeAt('cu_rest_vein', REST.x, REST.y);
    rest.usesRemaining = 0;
    fixtures.placeAt('cu_cart', REST.x - 150, REST.y);
    const vein = fixtures.placeAt('cu_vein', VEIN.x, VEIN.y);
    for (const p of ring(VEIN, 5)) fixtures.placeAt('cu_minecart', p.x, p.y);
    fixtures.orderAt(miner.id, { x: VEIN.x, y: VEIN.y });
    TileModifiers.rebuildAll();
    return { vein, rest };
}

function watch() {
    const seen = { veinCycles: 0, refills: 0 };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => { if (p?.typeId === 'cu_vein') seen.veinCycles++; }),
        EventBus.subscribe(BOARD_EVENTS.TOKEN_RESPAWNED, (p) => { if (p?.typeId === 'cu_rest_vein') seen.refills++; })
    ];
    return { stop: () => { offs.forEach(off => off()); return seen; } };
}

/** Everything the speed-ups decide, in a form two runs can be compared by. */
function snapshot({ vein, rest }, seen) {
    const at = (p) => BoardState.tokensAtPoint(p.x, p.y)[0] ?? null;
    const v = BoardState.getTokenById(vein.id);
    const r = BoardState.getTokenById(rest.id);
    return {
        ...seen,
        sapling: at(SAPLING)?.typeId ?? null,
        saplingClocks: at(SAPLING)?.clocks ?? null,
        vein: { usesRemaining: v.usesRemaining, cycleElapsedMs: v.cycleElapsedMs ?? 0 },
        rest: { usesRemaining: r.usesRemaining, clocks: r.clocks ?? null },
        // Banked or still on the mat: when loot is collected is not what this file is about.
        ore: InventoryManager.getItemCount('fixture_copper_ore') + SpriteLayer.countOnBoard('fixture_copper_ore')
    };
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a catch-up over the S1a speed-ups', () => {
    it('⭐ ends exactly where the same 1000 ms steps through the plain loop end', async () => {
        let board = buildBoard();
        let w = watch();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = snapshot(board, w.stop());

        board = buildBoard();
        w = watch();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        expect(snapshot(board, w.stop())).toEqual(plain);

        // And the speed-ups did their work in both: the Sapling grew (20 s, not 40 s), the vein
        // refilled (10 s, not 20 s), the floored vein ran 2 s cycles (about 90 in 3 minutes, not
        // the 18 its own 10 s would give, nor the 180 a 1 s floor alone would allow).
        expect(plain.sapling).toBe('cu_tree');
        expect(plain.refills).toBe(1);
        expect(plain.veinCycles).toBeGreaterThanOrEqual(85);
        expect(plain.veinCycles).toBeLessThanOrEqual(90);
    }, 30_000);

    it('a sped growth falls due at the same moment in 100 ms ticks and in one 1000 ms step per second', () => {
        const due = (step) => {
            buildBoard();
            for (let t = 0; t < 19_000; t += step) TimedChanges.tick(step);
            const before = BoardState.tokensAtPoint(SAPLING.x, SAPLING.y)[0];
            const clockBefore = before.clocks.growMs;
            for (let t = 0; t < 1000; t += step) TimedChanges.tick(step);
            return { clockBefore, after: BoardState.tokensAtPoint(SAPLING.x, SAPLING.y)[0].typeId };
        };
        expect(due(100)).toEqual({ clockBefore: 19_000, after: 'cu_tree' });
        expect(due(1000)).toEqual({ clockBefore: 19_000, after: 'cu_tree' });
    });
});
