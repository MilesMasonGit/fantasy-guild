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
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { withoutShippedPerks } from './fixtures/noPerks.js';
import { sameRolls } from './fixtures/rolls.js';

// Its forester is Forestry 30: Clean Felling's roll would land on another number in each run.
withoutShippedPerks();

/**
 * Time away with a felled Oak beside its Forest (an older save's: it joins the Forest on the first
 * tick): a forester fells it, it becomes a Stump, the Stump grows into a Sapling for free, the
 * Sapling into an Oak, the forester fells it again, the second Stump grows back too, and the third
 * Oak falls in turn. Each Oak a Sapling grows into is worked only from the moment it stands. The same in
 * 100 ms steps, in 1000 ms steps and through the game's own catch-up. The Oak is felled by chance,
 * so each run draws the same numbers from its start: the steps and the catch-up roll alike.
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
    fixtures.orderAt(forester.id, { x: OAK.x, y: OAK.y });
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
    const rolls = sameRolls();
    buildBoard();
    const w = watch();
    for (let t = 0; t < AWAY_MS; t += step) GameLoop.runHandlers(step);
    rolls.mockRestore();
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
    it('regrows through Stump and Sapling for free, again and again, the same in 100 ms and 1000 ms steps and through the catch-up', async () => {
        const small = plainLoop(100);
        const big = plainLoop(1000);
        expect(big).toEqual(small);

        const rolls = sameRolls();
        buildBoard();
        const w = watch();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        rolls.mockRestore();
        expect(snapshot(w.stop())).toEqual(small);

        // And what happened: felled, a Stump, a Sapling, an Oak, felled again, round again, and
        // felled a third time, the seedling never spent.
        expect(small.became).toEqual(['fcu_stump', 'fcu_sapling', 'fcu_oak', 'fcu_stump', 'fcu_sapling', 'fcu_oak', 'fcu_stump']);
        expect(small.regrown).toBe(3);
        expect(small.seedlings).toBe(1);
        expect(small.at).toBe('fcu_stump');
        expect(small.clocks).toEqual({ growMs: 2000 });
        expect(small.alert).toBeNull();
        expect(small.wood).toBe(6);
    }, 60_000);
});
