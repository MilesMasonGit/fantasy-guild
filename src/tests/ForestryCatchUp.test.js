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
import * as Growth from '../systems/board/Growth.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Time away with a felled Oak in a Forest's reach (brief 230 S2a): a forester fells it, it becomes
 * a Stump, the Stump pays the Bank's one seedling and grows into a Sapling, the Sapling into an Oak,
 * the forester fells it again, and the second Stump, with no seedling left, is stopped. The same in
 * 100 ms steps, in 1000 ms steps and through the game's own catch-up.
 */

const NOW = 1_800_000_000_000;
const AWAY_MS = 90_000;
const SEEDLING = 'item_oak_seedling';

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const plain = (id, name, extra) => ({ id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra });
registerTokenTypes({
    fcu_forest: plain('fcu_forest', 'FCU Oak Forest', { tokenType: 'buff' }),
    fcu_oak: plain('fcu_oak', 'FCU Oak', {
        uses: 2, requiresHero: true, staysPut: true, respawn: { mode: 'regrow', into: 'fcu_stump' },
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [],
            outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }] }
    }),
    fcu_stump: plain('fcu_stump', 'FCU Oak Stump', {
        grows: { into: 'fcu_sapling', afterMs: 20000, needsNearby: ['fcu_forest'], cost: [{ itemId: SEEDLING, quantity: 1 }] }
    }),
    fcu_sapling: plain('fcu_sapling', 'FCU Oak Sapling', { artSize: 'small', grows: { into: 'fcu_oak', afterMs: 15000 } })
});

const OAK = { x: 700, y: 500 };

function buildBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    Growth.resetGrowthAlerts();
    const [forester] = fixtures.makeHeroes(1);
    fixtures.placeAt('fcu_forest', OAK.x + 150, OAK.y);
    fixtures.placeAt('fcu_oak', OAK.x, OAK.y);
    InventoryManager.addItem(SEEDLING, 1);
    fixtures.plant(forester.id, { x: OAK.x, y: OAK.y });
    TileModifiers.rebuildAll();
}

function watch() {
    const seen = { regrown: 0, became: [] };
    const offs = [
        EventBus.subscribe(BOARD_EVENTS.TOKEN_RESPAWNED, (p) => { if (p?.mode === 'regrow') seen.regrown++; }),
        EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => {
            if (p?.typeId && BoardState.tokensAtPoint(OAK.x, OAK.y)[0]?.id === p.instanceId) seen.became.push(p.typeId);
        })
    ];
    return { stop: () => { offs.forEach(off => off()); return seen; } };
}

function snapshot(seen) {
    const t = BoardState.tokensAtPoint(OAK.x, OAK.y)[0] ?? null;
    return {
        ...seen,
        at: t?.typeId ?? null,
        clocks: t?.clocks ?? null,
        alert: t ? Growth.growthAlertOf(t.id) : null,
        seedlings: InventoryManager.getItemCount(SEEDLING),
        wood: InventoryManager.getItemCount('fixture_oak_wood') + SpriteLayer.countOnBoard('fixture_oak_wood')
    };
}

function plainLoop(step) {
    buildBoard();
    const w = watch();
    for (let t = 0; t < AWAY_MS; t += step) GameLoop.runHandlers(step);
    return snapshot(w.stop());
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

describe('⭐ a catch-up over a felled Oak in a Forest\'s reach', () => {
    it('regrows through Stump and Sapling, paying the one seedling, the same in 100 ms and 1000 ms steps and through the catch-up', async () => {
        const small = plainLoop(100);
        const big = plainLoop(1000);
        expect(big).toEqual(small);

        buildBoard();
        const w = watch();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        expect(snapshot(w.stop())).toEqual(small);

        // And what happened: felled, a Stump, the seedling paid, a Sapling, an Oak, felled again,
        // and the second Stump stopped with no seedling left.
        expect(small.became).toEqual(['fcu_stump', 'fcu_sapling', 'fcu_oak', 'fcu_stump']);
        expect(small.regrown).toBe(2);
        expect(small.seedlings).toBe(0);
        expect(small.at).toBe('fcu_stump');
        expect(small.alert).toEqual({ alert: ALERT.GROW_NEEDS_ITEM, needs: [SEEDLING] });
        expect(small.wood).toBe(4);
    }, 60_000);
});
