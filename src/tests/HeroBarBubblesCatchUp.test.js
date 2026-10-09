// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import * as CatchUp from '../systems/core/CatchUp.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { resetMatTuning } from '../config/matTuning.js';
import { bubblesOf, clearAllHeroBubbles, clearHeroBubble } from '../ui/components/dock/heroBarBubbles.js';

/**
 * A catch-up plays with the UI's listeners quiet, so the hero bar never hears its level-ups as
 * they happen: it reads them off the catch-up's summary once it has finished.
 */

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;

class SilentAudio {
    constructor(src = '') { this.src = src; this.paused = true; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

function writeSlot(savedAt) {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const save = JSON.parse(GameState.serializeJson());
    save.savedAt = savedAt;
    localStorage.setItem(SaveManager.getSlotKey(0), JSON.stringify(save));
}

const leveled = (heroId, skillName, oldLevel, newLevel) => EventBus.publish(ENGINE_EVENTS.HERO_LEVELED, {
    heroId, heroName: heroId, skillId: skillName.toLowerCase(), skillName, oldLevel, newLevel, startLevel: oldLevel
});

/**
 * While a catch-up plays, publish each level-up on its tick (counted from the catch-up's first),
 * the way `SkillSystem` does.
 */
function levelUpsDuringCatchUp(plan) {
    let ticks = 0;
    GameLoop.onTick('test_level_ups', () => {
        if (!CatchUp.isRunning()) return;
        ticks++;
        for (const [at, ...args] of plan) if (at === ticks) leveled(...args);
    }, 1);
}

const texts = (heroId) => bubblesOf(heroId).map(b => b.text);

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.stubGlobal('Audio', SilentAudio);
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    localStorage.clear();
    clearAllHeroBubbles();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

afterEach(() => {
    GameLoop.offTick('test_level_ups');
    GameLoop.stop();
    if (SaveManager.autoSaveTimer) clearInterval(SaveManager.autoSaveTimer);
    SaveManager.autoSaveTimer = null;
    SaveManager.currentSlot = null;
    SaveManager.resumeSaving();
    CatchUp.forgetUndo();
    localStorage.clear();
    sessionStorage.clear();
    clearAllHeroBubbles();
    vi.mocked(Date.now).mockRestore();
});

afterAll(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetMatTuning();
});

const LOAD_PLAN = [
    [100, 'h1', 'Mining', 1, 2],
    [900, 'h1', 'Forestry', 1, 2],
    [2000, 'h2', 'Mining', 1, 2],
    [5000, 'h1', 'Mining', 2, 3]
];

async function loadTwoHoursLater() {
    writeSlot(NOW - 2 * HOUR);
    levelUpsDuringCatchUp(LOAD_PLAN);
    expect(await SaveManager.loadSlot(0)).toBe(true);
    await EngineBootstrap.onSlotSelected(0, false);
}

describe('a load\'s catch-up on the hero bar', () => {
    it('a 2 h load with 3 level-ups leaves one bubble each on the right heroes', async () => {
        await loadTwoHoursLater();
        expect(CatchUp.lastResult().summary.levelUps).toHaveLength(3);
        expect(texts('h1')).toEqual(['LVL UP! 3 Mining! (+2)', 'LVL UP! 2 Forestry!']);
        expect(texts('h2')).toEqual(['LVL UP! 2 Mining!']);
    });

    it('a later reset that keeps bubbles does not add the catch-up a second time', async () => {
        await loadTwoHoursLater();
        clearHeroBubble('h1', 'level:Forestry');
        EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'dev_time_skip' });
        EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'catch_up' });
        expect(texts('h1')).toEqual(['LVL UP! 3 Mining! (+2)']);
        expect(texts('h2')).toEqual(['LVL UP! 2 Mining!']);
    });

    it('"Load as I left it" leaves no bubbles from the catch-up it turned down', async () => {
        await loadTwoHoursLater();
        expect(texts('h1')).toHaveLength(2);

        vi.mocked(Date.now).mockReturnValue(NOW + MIN);
        const reload = vi.spyOn(SaveManager, 'reloadPage').mockImplementation(() => {});
        try {
            expect(CatchUp.undoLast()).toBe(true);
        } finally {
            reload.mockRestore();
        }
        // The page that loads next opens the slot as it was, with no catch-up.
        GameLoop.stop();
        SaveManager.resumeSaving();
        vi.mocked(Date.now).mockReturnValue(NOW + MIN + 5000);
        const slot = SaveManager.takeResumeSlot();
        expect(await SaveManager.loadSlot(slot, { catchUp: false })).toBe(true);
        await EngineBootstrap.onSlotSelected(slot, false);
        expect(texts('h1')).toEqual([]);
        expect(texts('h2')).toEqual([]);
    });

    it('a new game shows none of an earlier load\'s catch-up', async () => {
        await loadTwoHoursLater();
        GameLoop.stop();
        SaveManager.newGame(0);
        EngineBootstrap.onSlotSelected(0, true);
        expect(texts('h1')).toEqual([]);
        expect(texts('h2')).toEqual([]);
    });
});

describe('a gap the live loop could not deliver, on the hero bar', () => {
    let perf = 0;

    beforeEach(() => {
        writeSlot(NOW);
        perf = 1000;
        vi.spyOn(performance, 'now').mockImplementation(() => perf);
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
        GameLoop.start();
    });

    afterEach(() => {
        GameLoop.stop();
        vi.useRealTimers();
        vi.mocked(performance.now).mockRestore();
    });

    function tickAfter(ms) {
        perf += ms;
        GameLoop.tick();
    }

    it('a sleeping PC keeps the bubbles not yet read and adds its own on top', async () => {
        leveled('h2', 'Fishing', 9, 10);
        leveled('h1', 'Mining', 4, 5);
        levelUpsDuringCatchUp([[10, 'h1', 'Mining', 5, 6], [200, 'h1', 'Forestry', 1, 2]]);
        const done = new Promise(resolve => {
            const off = EventBus.subscribe(ENGINE_EVENTS.CATCH_UP_FINISHED, (r) => { off(); resolve(r); });
        });
        tickAfter(10 * MIN + 1000);
        const result = await done;
        expect(result.show).toBe(true);
        expect(texts('h2')).toEqual(['LVL UP! 10 Fishing!']);
        expect(texts('h1')).toEqual(['LVL UP! 6 Mining! (+2)', 'LVL UP! 2 Forestry!']);
    });

    it('a silent catch-up adds nothing and keeps what was there', () => {
        leveled('h2', 'Fishing', 9, 10);
        levelUpsDuringCatchUp([[5, 'h1', 'Mining', 1, 2]]);
        tickAfter(61_000);
        expect(CatchUp.lastResult()).toMatchObject({ show: false });
        expect(CatchUp.lastResult().summary.levelUps).toHaveLength(1);
        expect(texts('h1')).toEqual([]);
        expect(texts('h2')).toEqual(['LVL UP! 10 Fishing!']);
    });
});
