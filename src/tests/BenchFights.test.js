// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as BoardState from '../systems/board/BoardState.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { buildRealistic } from '../../bench/scenarios/realistic.mjs';
import { capPlaced, spawnRoom } from '../../bench/scenarios/cap.mjs';
import { envelopeScenario, fightPlaced, MAX_FIGHTS } from '../../bench/scenarios/envelope.mjs';
import { sceneFor } from '../../bench/browser/scenes.mjs';

/**
 * The bench's fights start as a player's do, since enemies never start one: heroes sent at enemy
 * camps. S2's board (shared by S2, S3, S5, S6, the S8 hour, C240 and C256) and the drawing bench's
 * fights<N> boards.
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();
    GameLoop.stop();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

const ctx = { fixtures, setMatTuning };

function freshGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    BoardCombat.clearAll();
}

function tick(n) {
    for (let i = 0; i < n; i++) GameLoop.runHandlers(100);
}

const fighting = () => GameState.state.heroes.filter(h => BoardCombat.fightOfHero(h.id)).length;

describe("S2's board", () => {
    it('sends heroes 1 and 2 at the goblin camps, and they hunt their goblins', () => {
        freshGame();
        buildRealistic(ctx);
        TileModifiers.rebuildAll();
        for (const i of [1, 2]) {
            const camp = BoardState.getTokenById(BoardState.flagOf(`hero_bench_${i}`).pinnedTo);
            expect(camp?.typeId).toBe('bench_camp');
        }
        let kills = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, (p) => { if (p?.outcome === 'victory') kills++; });
        try {
            tick(600);
        } finally {
            off();
        }
        // Six goblins stand at the start and each camp brings one back every 30 s.
        expect(kills).toBeGreaterThanOrEqual(6);
    });
});

describe('the fights<N> boards', () => {
    it('leave every brute its room under the cap, from Forests and Quarries first', () => {
        const base = capPlaced(128);
        for (const n of [8, 40, MAX_FIGHTS]) {
            const list = fightPlaced(n);
            const camps = list.filter(t => t === 'env_brute_camp').length;
            expect(list).toHaveLength(base.length);
            expect(camps).toBe(Math.ceil(n / 4));
            expect(list.length + spawnRoom(list) + camps * 4).toBeLessThanOrEqual(128);
        }
        expect(fightPlaced(8).filter(t => t === 'bench_camp')).toHaveLength(3);
        expect(fightPlaced(0)).toEqual(base);
        expect(MAX_FIGHTS).toBe(128 - base.length);
    });

    it.each([8, 40, 80])('fights%i: that many heroes, every one fighting 25 s after the build', (n) => {
        freshGame();
        envelopeScenario(`fights${n}`).build(ctx);
        TileModifiers.rebuildAll();
        tick(250);
        expect(GameState.state.heroes).toHaveLength(Math.max(8, n));
        expect(fighting()).toBe(n);
    });

    it('no board above the room, and the drawing bench refuses one before starting Chrome', () => {
        expect(envelopeScenario(`fights${MAX_FIGHTS + 1}`)).toBeNull();
        expect(sceneFor(`fights${MAX_FIGHTS}`)?.stressId).toBe(`F${MAX_FIGHTS}`);
        expect(() => sceneFor(`fights${MAX_FIGHTS + 1}`)).toThrow(/up to 80 fights/);
    });
});
