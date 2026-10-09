// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as BoardState from '../systems/board/BoardState.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { EventBus, UI_LISTENER } from '../systems/core/EventBus.js';
import * as GameClock from '../systems/core/GameClock.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { CATCH_UP } from '../config/loopConstants.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { buildRealistic } from '../../bench/scenarios/realistic.mjs';

/**
 * The catch-up driver: plays the time away through the real tick handlers, in 1000 ms steps,
 * with nothing drawn, heard, toasted or saved until the one save at the end.
 */

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;

/** Counts sound effects actually started (the music is not counted). */
let soundsPlayed = 0;
class CountingAudio {
    constructor(src = '') { this.src = src; this.paused = true; this.ended = false; this.currentTime = 0; }
    play() { if (this.src.includes('/sfx/')) soundsPlayed++; this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    addEventListener() {}
    removeEventListener() {}
}

/** The bench's realistic board (S2): producers, mills, spawners, goblins, 8 heroes. */
function buildBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    buildRealistic({ fixtures, setMatTuning });
    TileModifiers.rebuildAll();
    for (let i = 0; i < 100; i++) GameLoop.runHandlers(100);   // heroes reach their work
}

/** An empty table: every handler runs, nothing on the board. Cheap steps. */
function emptyGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
}

const run = (opts) => CatchUp.run({ yieldFn: () => Promise.resolve(), ...opts });

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', CountingAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    AudioSystem.init();          // as a slot being chosen does
    GameLoop.stop();
});

beforeEach(() => {
    localStorage.clear();
    soundsPlayed = 0;
    NotificationSystem.dismissAll();
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

describe('how much it plays', () => {
    it('plays min(now − savedAt, 24 h) and reports the rest as dropped', async () => {
        emptyGame();
        expect(CATCH_UP.CAP_MS).toBe(24 * HOUR);

        const capped = await run({ savedAt: NOW - 90 * MIN, now: NOW, capMs: HOUR, save: false });
        expect(capped.awayMs).toBe(90 * MIN);
        expect(capped.simulatedMs).toBe(HOUR);
        expect(capped.droppedMs).toBe(30 * MIN);

        const whole = await run({ savedAt: NOW - 10 * MIN, now: NOW, save: false });
        expect(whole.simulatedMs).toBe(10 * MIN);
        expect(whole.droppedMs).toBe(0);
        expect(whole.steps).toBe(600);
    });

    it('does nothing for a gap under one step or a savedAt in the future', async () => {
        emptyGame();
        SaveManager.currentSlot = 0;
        const before = GameState.state.time.gameTimeMs;
        for (const savedAt of [NOW - 999, NOW, NOW + 60_000]) {
            const r = await run({ savedAt, now: NOW });
            expect(r.steps).toBe(0);
            expect(r.simulatedMs).toBe(0);
            expect(r.summary).toBeNull();
        }
        expect(GameState.state.time.gameTimeMs).toBe(before);
        expect(localStorage.getItem(SaveManager.getSlotKey(0))).toBeNull();
    });

    it('gameTimeMs advances by exactly the time played', async () => {
        emptyGame();
        const before = GameState.state.time.gameTimeMs;
        const r = await run({ savedAt: NOW - (10 * MIN + 500), now: NOW, save: false });
        expect(r.simulatedMs).toBe(10 * MIN + 500);
        expect(GameState.state.time.gameTimeMs - before).toBe(10 * MIN + 500);
    });

    it('also plays the time the catch-up itself took', async () => {
        emptyGame();
        let calls = 0;
        // The catch-up itself takes 5 s of real time.
        const now = () => (calls++ === 0 ? NOW : NOW + 5000);
        const r = await run({ savedAt: NOW - MIN, now, sliceMs: 0, save: false });
        expect(r.simulatedMs).toBe(MIN + 5000);
        expect(r.awayMs).toBe(MIN + 5000);
    });

    it('the game clock runs from savedAt with the steps, and is back on the wall clock after', async () => {
        emptyGame();
        const seen = [];
        GameLoop.onTick('test_clock', () => seen.push(GameClock.now()), 1);
        try {
            await run({ savedAt: NOW - 3000, now: NOW, save: false });
        } finally {
            GameLoop.offTick('test_clock');
        }
        expect(seen).toEqual([NOW - 2000, NOW - 1000, NOW]);
        expect(GameClock.isCatchingUp()).toBe(false);
    });
});

describe('what it keeps quiet', () => {
    it('UI listeners hear nothing while it runs and one GAME_RESET after (with the broad updates, once each)', async () => {
        buildBoard();
        const ui = [];
        const engine = [];
        const offs = [
            ...[BOARD_EVENTS.CYCLE_COMPLETE, BOARD_EVENTS.PROGRESS, BOARD_EVENTS.SPRITES_CHANGED,
                ENGINE_EVENTS.INVENTORY_UPDATED, ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.STATE_CHANGED,
                ENGINE_EVENTS.GAME_RESET, ENGINE_EVENTS.CATCH_UP_FINISHED]
                .map(name => EventBus.subscribe(name, () => ui.push(name), UI_LISTENER)),
            EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, () => engine.push('cycle'))
        ];
        try {
            await run({ savedAt: NOW - 10 * MIN, now: NOW, save: false });
        } finally {
            offs.forEach(off => off());
        }
        expect(engine.length).toBeGreaterThan(20);             // the board really worked
        expect(ui).toEqual([ENGINE_EVENTS.CATCH_UP_FINISHED, ENGINE_EVENTS.GAME_RESET,
            ENGINE_EVENTS.STATE_CHANGED, ENGINE_EVENTS.HEROES_UPDATED, ENGINE_EVENTS.INVENTORY_UPDATED]);
        expect(EventBus.isQuiet()).toBe(false);
    }, 30_000);

    it('no toast or sound while it runs', async () => {
        emptyGame();
        SettingsManager.set('audio.masterVolume', 80);
        const toasts = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.NOTIFICATION_ADDED, (n) => toasts.push(n));
        let n = 0;
        GameLoop.onTick('test_noise', () => {
            if (++n % 10) return;
            NotificationSystem.notify('A thing happened', 'info');
            EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'levelup' });
            EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, { heroId: 'nobody', newLevel: 2, oldLevel: 1 });
        }, 1);
        try {
            await run({ savedAt: NOW - 2 * MIN, now: NOW, save: false });
            expect(n).toBe(120);
            expect(toasts).toEqual([]);
            expect(NotificationSystem.getQueue()).toEqual([]);
            expect(soundsPlayed).toBe(0);

            // And afterwards, both are back.
            NotificationSystem.notify('Back', 'info');
            EventBus.publish(ENGINE_EVENTS.AUDIO_PLAY, { clip: 'levelup' });
            expect(toasts).toHaveLength(1);
            expect(soundsPlayed).toBe(1);
        } finally {
            off();
            GameLoop.offTick('test_noise');
            SettingsManager.set('audio.masterVolume', 0);
        }
    });
});

describe('saving', () => {
    function slotKeys() {
        const out = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            out[key] = localStorage.getItem(key);
        }
        return out;
    }

    it('localStorage is untouched until it ends, and a throw half-way leaves the slot byte for byte', async () => {
        emptyGame();
        SaveManager.currentSlot = 0;
        SaveManager.startAutoSave();                      // binds the save on closing the window
        expect(SaveManager.save(false)).toBe(true);
        expect(SaveManager.save(false)).toBe(true);       // a backup too
        const before = slotKeys();
        const savedAt = JSON.parse(before[SaveManager.getSlotKey(0)]).savedAt;

        // A catch-up that finishes: nothing written while it runs, one save at the end.
        let checks = 0;
        const done = await run({
            savedAt: NOW - 30_000, now: NOW, sliceMs: 0,
            onProgress: (fraction) => {
                if (fraction <= 0 || fraction >= 1) return;
                checks++;
                expect(SaveManager.save(false)).toBe(false);              // the autosave timer
                window.dispatchEvent(new Event('beforeunload'));          // the window closing
                expect(slotKeys()).toEqual(before);
            }
        });
        expect(checks).toBeGreaterThan(10);
        expect(done.simulatedMs).toBe(30_000);
        const after = JSON.parse(localStorage.getItem(SaveManager.getSlotKey(0)));
        expect(after.savedAt).not.toBe(savedAt);
        expect(after.state.time.gameTimeMs).toBe(GameState.state.time.gameTimeMs);

        // A catch-up that dies half-way: the slot and its backup stay exactly as they were.
        const written = slotKeys();
        await expect(run({
            savedAt: NOW - 30_000, now: NOW, sliceMs: 0,
            onProgress: (fraction) => { if (fraction > 0.5 && fraction < 1) throw new Error('the window closed'); }
        })).rejects.toThrow('the window closed');
        expect(slotKeys()).toEqual(written);

        // And everything it switched off is back on.
        expect(CatchUp.isRunning()).toBe(false);
        expect(GameClock.isCatchingUp()).toBe(false);
        expect(EventBus.isQuiet()).toBe(false);
        expect(SaveManager.savingSuspended).toBe(false);
        expect(SaveManager.save(false)).toBe(true);
    });
});

describe('the summary and the progress', () => {
    it('the summary counts items gained and spent, level-ups, Tokens depleted, heroes wounded', async () => {
        buildBoard();
        // The Tokens being worked run out within a few cycles, and every hero is one XP short of a
        // forestry and a mining level.
        for (const hero of GameState.state.heroes) {
            const worked = BoardState.getTokenById(BoardState.workTokenOf(hero.id));
            if (worked && worked.usesRemaining != null) worked.usesRemaining = 3;
            for (const skill of ['forestry', 'mining']) hero.skills[skill].xp = xpForLevel(hero.skills[skill].level + 1) - 1;
        }
        // A wound, through the one real path for dying, half-way through.
        const victim = GameState.state.heroes[3];
        let step = 0;
        GameLoop.onTick('test_wound', () => {
            if (++step === 1800) BoardCombat.resolveStatusDefeat(victim.id);
        }, 1);
        let r;
        try {
            r = await run({ savedAt: NOW - HOUR, now: NOW, save: false });
        } finally {
            GameLoop.offTick('test_wound');
        }
        const { summary } = r;
        const total = (map) => Object.values(map).reduce((a, b) => a + b, 0);
        expect(total(summary.items.gained)).toBeGreaterThan(100);
        expect(total(summary.items.spent)).toBeGreaterThan(0);
        expect(Object.keys(summary.items.net).length).toBeGreaterThan(0);
        expect(typeof summary.items.floor).toBe('object');
        expect(summary.levelUps.length).toBeGreaterThan(0);
        expect(summary.levelUps[0]).toMatchObject({ heroId: expect.any(String), skillId: expect.any(String) });
        expect(summary.levelUps.every(l => l.to > l.from)).toBe(true);
        expect(summary.depleted.total).toBeGreaterThan(0);
        expect(summary.wounded).toContainEqual({ heroId: victim.id, heroName: victim.name, times: 1 });
        expect(summary.fightsWon.total).toBeGreaterThanOrEqual(0);
    }, 60_000);

    it('it yields between slices and reports progress from 0 to 1', async () => {
        emptyGame();
        const fractions = [];
        const heard = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_PROGRESS, (p) => heard.push(p.fraction), UI_LISTENER);
        let yields = 0;
        try {
            await CatchUp.run({
                savedAt: NOW - 20_000, now: NOW, sliceMs: 0, save: false,
                onProgress: (f) => fractions.push(f),
                yieldFn: () => { yields++; return CatchUp.yieldToEventLoop(); }
            });
        } finally {
            off();
        }
        expect(yields).toBe(19);                          // 20 one-step slices, a yield between each
        expect(fractions[0]).toBe(0);
        expect(fractions.at(-1)).toBe(1);
        expect(fractions.every((f, i) => i === 0 || f >= fractions[i - 1])).toBe(true);
        expect(heard).toEqual(fractions);                 // the bar hears it through a quiet bus
    });
});
