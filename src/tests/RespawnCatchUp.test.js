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
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { summaryView } from '../ui/components/hud/catchUpSummary.js';
import * as fixtures from '../../bench/fixtures.mjs';

/**
 * Time away with a respawning vein on the mat: the catch-up plays its rests and refills, and its
 * summary never counts it as a Token used up. A vein without the block, beside it, still is.
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

const mining = {
    skill: 'mining', skillRequired: 1, cycleTimeMs: 2000, xp: 1,
    inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }]
};

registerTokenTypes({
    catchup_respawn_vein: {
        id: 'catchup_respawn_vein', name: 'Catch-up Respawn Vein', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: 3, sprite: 'skill_industry', config: mining,
        respawn: { mode: 'refill', afterMs: 12000 }
    },
    catchup_plain_vein: {
        id: 'catchup_plain_vein', name: 'Catch-up Plain Vein', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: 3, sprite: 'skill_industry', config: mining
    }
});

/** Two heroes, each on a vein of their own, far apart. */
function buildBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const [a, b] = fixtures.makeHeroes(2);
    const vein = fixtures.placeAt('catchup_respawn_vein', 400, 400);
    const plain = fixtures.placeAt('catchup_plain_vein', 1200, 400);
    fixtures.plant(a.id, { x: vein.x, y: vein.y });
    fixtures.plant(b.id, { x: plain.x, y: plain.y });
    TileModifiers.rebuildAll();
    return vein;
}

function countRespawns() {
    let n = 0;
    const off = EventBus.subscribe(BOARD_EVENTS.TOKEN_RESPAWNED, () => { n++; });
    return { stop: () => { off(); return n; } };
}

const veinState = (vein) => {
    const t = BoardState.getTokenById(vein.id);
    return { usesRemaining: t.usesRemaining, clocks: t.clocks ?? null, cycleElapsedMs: t.cycleElapsedMs ?? 0 };
};

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

describe('a catch-up over a respawning vein', () => {
    it('plays its rests and refills, and counts only the vein without the block as used up', async () => {
        const vein = buildBoard();
        const respawns = countRespawns();
        const r = await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        expect(respawns.stop()).toBeGreaterThanOrEqual(3);

        expect(BoardState.getTokenById(vein.id)).not.toBeNull();
        expect(r.summary.depleted).toEqual({ total: 1, byType: { catchup_plain_vein: 1 } });
        expect(summaryView(r).depleted.map(d => d.typeId)).toEqual(['catchup_plain_vein']);
    }, 30_000);

    it('ends exactly where the same 1000 ms steps through the plain loop end', async () => {
        let vein = buildBoard();
        let respawns = countRespawns();
        for (let i = 0; i < AWAY_MS / 1000; i++) GameLoop.runHandlers(1000);
        const plain = { ...veinState(vein), respawns: respawns.stop() };

        vein = buildBoard();
        respawns = countRespawns();
        await CatchUp.run({ savedAt: NOW - AWAY_MS, now: NOW, save: false, yieldFn: () => Promise.resolve() });
        expect({ ...veinState(vein), respawns: respawns.stop() }).toEqual(plain);
        expect(plain.respawns).toBeGreaterThanOrEqual(3);
    }, 30_000);
});
