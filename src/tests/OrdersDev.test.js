// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Flags from '../systems/board/Flags.js';
import * as Orders from '../systems/board/Orders.js';
import { AudioSystem } from '../systems/core/AudioSystem.js';
import { getBackupKey } from '../systems/core/SaveSlotHelper.js';
import { resetMatTuning } from '../config/matTuning.js';
import * as fixtures from '../../bench/fixtures.mjs';
import { setUpOrdersScene, knockOutAHero, healEveryone, loadOldFlagsSave, QA_ORDER_TYPES } from '../ui/dev/ordersDev.js';

/**
 * The QA panel's hero orders section (brief 260 O1): what the owner clicks to check orders in the
 * running game, so the eye-check needs no console.
 */

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const run = (ms) => { for (let t = 0; t < ms; t += 100) GameLoop.runHandlers(100); };

function newGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    fixtures.placeAt('bench_hall', 880, 560);
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

describe('the hero orders QA section', () => {
    it('lays out a Goblin Camp beside a QA Old Oak, a QA Berry Bush and a QA Fighter at home', () => {
        newGame();
        expect(setUpOrdersScene()).toEqual({ ok: true });
        const of = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);
        expect(of('token_goblin_camp')).toHaveLength(1);
        expect(of('token_goblin').length).toBeGreaterThan(0);
        expect(of(QA_ORDER_TYPES.OAK)).toHaveLength(1);
        expect(of(QA_ORDER_TYPES.BUSH)).toHaveLength(1);
        const fighter = GameState.state.heroes.find(h => h.name === 'QA Fighter');
        expect(fighter).toBeTruthy();
        expect(BoardState.flagOf(fighter.id)).toBeNull();
        const oak = of(QA_ORDER_TYPES.OAK)[0];
        expect(Orders.canOrderOnto(fighter.id, oak)).toBe(true);
    });

    it('knocks a hero out (order cleared, healing), and heals them back to waiting at the Hall', () => {
        newGame();
        setUpOrdersScene();
        const fighter = GameState.state.heroes.find(h => h.name === 'QA Fighter');
        const bush = BoardState.tokens().find(t => t.typeId === QA_ORDER_TYPES.BUSH);
        Orders.orderAt(fighter.id, { x: bush.x, y: bush.y });
        expect(knockOutAHero()).toMatchObject({ ok: true, name: 'QA Fighter' });
        expect(BoardState.flagOf(fighter.id)).toBeNull();
        expect(fighter.status).toBe('wounded');
        expect(Orders.orderAt(fighter.id, { x: bush.x, y: bush.y }).success).toBe(false);
        expect(healEveryone()).toEqual({ ok: true, count: 1 });
        expect(fighter.status).toBe('idle');
        expect(Flags.statusOf(fighter.id).state).toBe('docked');
    });

    it('⭐ loads an old save: the pinned hero works their Oak, the area hero idles where their flag stood', async () => {
        newGame();
        fixtures.makeHeroes(2);
        SaveManager.currentSlot = 1;
        const r = await loadOldFlagsSave();
        expect(r).toMatchObject({ ok: true, flags: 'spot' });
        const [pinned, area] = GameState.state.heroes;
        run(2000);
        const oak = BoardState.getTokenById(BoardState.workTokenOf(pinned.id));
        expect(oak?.typeId).toBe(QA_ORDER_TYPES.OAK);
        expect(BoardState.flagOf(area.id)).toMatchObject({ spot: true });
        expect(BoardState.workTokenOf(area.id)).toBeNull();
        expect(GameState.state.heroes.some(h => 'flagRules' in h)).toBe(false);
        expect(GameState.state.board.orders).toBe(1);
        // The game before is the slot's backup: no area flag in it.
        const backup = JSON.parse(localStorage.getItem(getBackupKey(1)));
        expect(Object.keys((backup.state || backup).board.flags)).toEqual([]);
    });
});
