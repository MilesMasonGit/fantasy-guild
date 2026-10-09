// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { TimeManager } from '../systems/core/TimeManager.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus, UI_LISTENER } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { CATCH_UP } from '../config/loopConstants.js';
import { resetMatTuning } from '../config/matTuning.js';

/**
 * A loaded save catches up the time since it was written before the loop starts, and a gap the
 * live loop could not deliver (a sleeping PC, a background tab) is caught up the same way.
 */

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;
const PLAYED_BEFORE = 5000;

class SilentAudio {
    constructor(src = '') { this.src = src; this.paused = true; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

/** Slot 0 holds an empty game saved at `savedAt`, with 5 s already played. */
function writeSlot(savedAt) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    GameState.state.time.gameTimeMs = PLAYED_BEFORE;
    const save = JSON.parse(GameState.serializeJson());
    save.savedAt = savedAt;
    localStorage.setItem(SaveManager.getSlotKey(0), JSON.stringify(save));
}

const stored = () => JSON.parse(localStorage.getItem(SaveManager.getSlotKey(0)));

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
    GameLoop.stop();
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    SaveManager.resumeSaving();
    CatchUp.forgetUndo();
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(Date.now).mockRestore();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('catching up on load', () => {
    it('loading a save written 2 h ago starts the loop 2 game-hours later and saves once', async () => {
        writeSlot(NOW - 2 * HOUR);
        expect(await SaveManager.loadSlot(0)).toBe(true);
        const saves = vi.spyOn(SaveManager, 'save');
        try {
            await EngineBootstrap.onSlotSelected(0, false);
            expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE + 2 * HOUR);
            expect(GameLoop.getIsRunning()).toBe(true);
            expect(saves).toHaveBeenCalledTimes(1);
            expect(stored().state.time.gameTimeMs).toBe(PLAYED_BEFORE + 2 * HOUR);
            expect(stored().savedAt).toBe(NOW);
            expect(CatchUp.lastResult()).toMatchObject({ simulatedMs: 2 * HOUR, droppedMs: 0, show: true });
        } finally {
            saves.mockRestore();
        }
    });

    it('a save written 30 h ago plays 24 h', async () => {
        writeSlot(NOW - 30 * HOUR);
        await SaveManager.loadSlot(0);
        await EngineBootstrap.onSlotSelected(0, false);
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE + CATCH_UP.CAP_MS);
        expect(CatchUp.lastResult()).toMatchObject({ simulatedMs: 24 * HOUR, droppedMs: 6 * HOUR });
    }, 30_000);

    it('"Load as I left it" puts the untouched save back, and the reload does not catch up again', async () => {
        writeSlot(NOW - 2 * HOUR);
        const original = JSON.parse(localStorage.getItem(SaveManager.getSlotKey(0)));
        await SaveManager.loadSlot(0);
        await EngineBootstrap.onSlotSelected(0, false);
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE + 2 * HOUR);
        expect(CatchUp.canUndo()).toBe(true);

        // A minute later the player turns it down.
        vi.mocked(Date.now).mockReturnValue(NOW + MIN);
        const reload = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            expect(CatchUp.undoLast()).toBe(true);
            expect(reload).toHaveBeenCalledTimes(1);
        } finally {
            reload.mockRestore();
        }
        // The very save it loaded, only dated now.
        expect(stored()).toEqual({
            ...original, savedAt: NOW + MIN,
            state: { ...original.state, meta: { ...original.state.meta, lastSavedAt: NOW + MIN } }
        });
        expect(CatchUp.canUndo()).toBe(false);

        // The page that loads next: the same slot, as it was, and no catch-up.
        GameLoop.stop();
        SaveManager.resumeSaving();
        const caughtUp = CatchUp.lastResult();
        vi.mocked(Date.now).mockReturnValue(NOW + MIN + 5000);
        const slot = SaveManager.takeResumeSlot();
        expect(slot).toBe(0);
        expect(await SaveManager.loadSlot(slot, { catchUp: false })).toBe(true);
        await EngineBootstrap.onSlotSelected(slot, false);
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE);
        expect(CatchUp.lastResult()).toBe(caughtUp);

        // And an ordinary load of it later catches up only from the moment it was put back.
        GameLoop.stop();
        vi.mocked(Date.now).mockReturnValue(NOW + MIN + 30_000);
        await SaveManager.loadSlot(0);
        expect(SaveManager.loadedSavedAt).toBe(NOW + MIN);
    });

    it('a new game does not catch up', () => {
        const before = CatchUp.lastResult();
        SaveManager.newGame(0);
        EngineBootstrap.onSlotSelected(0, true);
        expect(GameState.state.time.gameTimeMs).toBe(0);
        expect(GameLoop.getIsRunning()).toBe(true);
        expect(CatchUp.lastResult()).toBe(before);
    });
});

describe('a gap the live loop could not deliver', () => {
    let perf = 0;
    let finished;
    let resets;
    let offs;

    beforeEach(() => {
        writeSlot(NOW);
        perf = 1000;
        vi.spyOn(performance, 'now').mockImplementation(() => perf);
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
        GameLoop.start();
        finished = [];
        resets = 0;
        offs = [
            EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_FINISHED, (r) => finished.push(r)),
            EventBus.subscribe(ENGINE_EVENTS.GAME_RESET, () => { resets++; }, UI_LISTENER)
        ];
    });

    afterEach(() => {
        offs.forEach(off => off());
        GameLoop.stop();
        vi.useRealTimers();
        vi.mocked(performance.now).mockRestore();
    });

    /** One live tick, `ms` of real time after the last. */
    function tickAfter(ms) {
        perf += ms;
        GameLoop.tick();
    }

    it('a gap under 2 minutes plays at once, quietly, before the tick\'s own step', () => {
        tickAfter(61_000);                                   // 60 s overflow + this tick's 1 s
        expect(finished).toHaveLength(1);
        expect(finished[0]).toMatchObject({ simulatedMs: 60_000, show: false });
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE + 61_000);
        expect(resets).toBe(1);
        expect(GameLoop.getIsRunning()).toBe(true);
    });

    it('less than a step waits for the next gap', () => {
        tickAfter(1500);                                     // 500 ms over
        expect(finished).toHaveLength(0);
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE + 1000);
        tickAfter(1500);                                     // 500 more: one whole step
        expect(finished).toHaveLength(1);
        expect(finished[0].simulatedMs).toBe(1000);
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE + 3000);
    });

    it('a gap of 2 minutes or more pauses the loop and catches up with the bar and the summary', async () => {
        const done = new Promise(resolve => {
            const off = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_FINISHED, (r) => { off(); resolve(r); });
        });
        tickAfter(10 * MIN + 1000);
        expect(GameLoop.getIsRunning()).toBe(false);         // paused while it catches up
        const result = await done;
        expect(result).toMatchObject({ simulatedMs: 10 * MIN + 1000, show: true });
        expect(result.summary).toBeTruthy();
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE + 10 * MIN + 1000);
        await vi.waitFor(() => expect(GameLoop.getIsRunning()).toBe(true));
        expect(TimeManager.consumeOverflow()).toBe(0);
    });

    it('after a sleeping PC, "Load as I left it" goes back to the game as it was when it slept', async () => {
        SaveManager.currentSlot = 0;
        tickAfter(1000);                                     // one ordinary second, unsaved
        const asLeft = JSON.parse(GameState.serializeJson());
        expect(asLeft.state.time.gameTimeMs).toBe(PLAYED_BEFORE + 1000);
        const done = new Promise(resolve => {
            const off = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_FINISHED, (r) => { off(); resolve(r); });
        });
        tickAfter(3 * HOUR + 1000);
        await done;
        expect(GameState.state.time.gameTimeMs).toBe(PLAYED_BEFORE + 1000 + 3 * HOUR + 1000);
        expect(CatchUp.canUndo()).toBe(true);

        const reload = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            expect(CatchUp.undoLast()).toBe(true);
            expect(reload).toHaveBeenCalledTimes(1);
        } finally {
            reload.mockRestore();
            SaveManager.resumeSaving();
        }
        // Not the slot's older save: the game as it stood when the gap began, dated now.
        expect(stored()).toEqual(asLeft);
        expect(stored().savedAt).toBe(NOW);
        expect(SaveManager.takeResumeSlot()).toBe(0);
    });
});
