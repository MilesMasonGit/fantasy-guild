import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { EventBus } from '../systems/core/EventBus.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Hideouts from '../systems/board/Hideouts.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { resetMatTuning } from '../config/matTuning.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { stealOf } from '../config/registries/crime.js';
import { setUpCrimeScene } from '../ui/dev/crimeScene.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * The Crime eye-check's QA scene (brief 810 K4, temporary: deleted with the scene once the look is
 * accepted): one click lays out a pasture with a steal table, two Hideouts in its reach, a thief
 * on one and a fighter at home, and the Hideout robs once its camp is chosen.
 */

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});
afterEach(() => { GameLoop.stop(); resetMatTuning(); });

describe('the Hideout scene', () => {
    it('lays out the pasture, both Hideouts and the two heroes, the thief on the Hideout with nothing chosen', () => {
        GameState.initNew();
        InventoryManager.init();
        TileModifiers.clearAll();
        expect(setUpCrimeScene()).toEqual({ ok: true });
        const byType = (id) => BoardState.tokens().filter(t => t.typeId === id);
        const [pasture] = byType('qa_crime_pasture');
        const [hideout] = byType('qa_crime_hideout');
        const [quiet] = byType('qa_crime_quiet_hideout');
        expect(byType('qa_crime_cow').length).toBe(3);
        // A theft not caught takes 6 coins beside the goods.
        expect(stealOf(getTokenType('qa_crime_cow')).coins).toBe(6);
        expect(Hideouts.campsInReach(hideout).map(c => c.id)).toEqual([pasture.id]);
        expect(Hideouts.campsInReach(quiet).map(c => c.id)).toEqual([pasture.id]);
        expect(Hideouts.targetOf(hideout)).toBeNull();
        const thief = GameState.state.heroes.find(h => h.name === 'QA Thief');
        expect(BoardState.flagOf(thief.id)?.pinnedTo).toBe(hideout.id);
        expect(GameState.state.heroes.some(h => h.name === 'QA Fighter')).toBe(true);
        // At Crime 3 against 5, about one theft in three is caught here; Quiet's twenty points take most of it.
        expect(Hideouts.caughtChanceAt(hideout.id, thief.id, pasture)).toBe(31);
        expect(Hideouts.caughtChanceAt(quiet.id, thief.id, pasture)).toBe(11);

        expect(Hideouts.setTarget(hideout, pasture.id)).toBe(true);
        const heard = [];
        const off = EventBus.subscribe(BOARD_EVENTS.THEFT, (p) => heard.push(p));
        for (let t = 0; t < 30_000; t += 100) GameLoop.runHandlers(100);
        off();
        expect(heard.length).toBeGreaterThan(0);
    });

    it('caught, the thief goes for the guard, beats it and goes back to stealing', () => {
        GameState.initNew();
        InventoryManager.init();
        TileModifiers.clearAll();
        expect(setUpCrimeScene()).toEqual({ ok: true });
        const [pasture] = BoardState.tokens().filter(t => t.typeId === 'qa_crime_pasture');
        const [hideout] = BoardState.tokens().filter(t => t.typeId === 'qa_crime_hideout');
        const thief = GameState.state.heroes.find(h => h.name === 'QA Thief');
        expect(Hideouts.setTarget(hideout, pasture.id)).toBe(true);
        const heard = [];
        const defeats = [];
        const offs = [
            EventBus.subscribe(BOARD_EVENTS.THEFT, (p) => heard.push(p)),
            EventBus.subscribe(BOARD_EVENTS.HERO_DEFEATED, (p) => defeats.push(p))
        ];
        let guardId = null;
        for (let t = 0; t < 10 * 60_000 && !guardId; t += 100) {
            GameLoop.runHandlers(100);
            guardId = heard.find(p => p.caught)?.guardId ?? null;
        }
        expect(guardId).toBeTruthy();
        expect(BoardState.flagOf(thief.id)).toMatchObject({ pinnedTo: guardId, returnTo: hideout.id });
        for (let t = 0; t < 120_000 && BoardState.getTokenById(guardId); t += 100) GameLoop.runHandlers(100);
        offs.forEach(off => off());
        expect(BoardState.getTokenById(guardId)).toBeNull();
        expect(defeats).toEqual([]);
        GameLoop.runHandlers(100);
        expect(BoardState.flagOf(thief.id)?.pinnedTo).toBe(hideout.id);
    });
});
