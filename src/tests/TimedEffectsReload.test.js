import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { GAME_VERSION } from '../state/StateSchema.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as GameClock from '../systems/core/GameClock.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { loadSavedState } from '../systems/core/LoadedState.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { STATUS_TICK_INTERVAL_MS } from '../config/FormulaRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * A hero's timed effect ("Well Fed for ten minutes") across a save and a load: its fight numbers
 * count again at once, and it keeps the game time it had left, whatever the wall clock did in
 * between (a reload, "Load as I left it", a paused game). For-the-fight and for-the-cycle
 * instances keep their shape.
 */

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const HOUR = 60 * MIN;

registerEffects({
    tr_nimble: {
        id: 'tr_nimble', name: 'Nimble',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), to: null, payload: { type: EFFECT_TYPES.DODGE, bucket: 'flat', value: 5 } }]
    }
});

const hero = () => HeroManager.getHero(GameState.state.heroes[0].id);
const carried = () => hero().effects.map(e => e.effectId);
const dodge = () => hero().aggregator.query(EFFECT_TYPES.DODGE);
const ticks = (n) => {
    for (let i = 0; i < n; i++) LiveEffects.tick(STATUS_TICK_INTERVAL_MS, TriggerSystem.fireLiveStatement);
};

/** The game saved now and loaded again, as a reload does, with the wall clock at `at` by then. */
function saveAndLoad(at, { dated = null } = {}) {
    const savedAt = Date.now();
    const data = JSON.parse(GameState.serializeJson(savedAt));
    // "Load as I left it" dates the save it puts back at the moment it does so.
    if (dated != null) {
        data.savedAt = dated;
        data.state.meta.lastSavedAt = dated;
    }
    vi.setSystemTime(at);
    loadSavedState(migrateState(data.state, data.version));
    return data;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    GameState.initNew();
    const h = generateHero({ name: 'Ada' });
    h.status = 'idle';
    GameState.state.heroes = [h];
    HeroManager.rehydrateHero(h);
    LiveEffects.resetClock();
});

afterEach(() => {
    GameClock.end();
    vi.useRealTimers();
});

describe('a timed effect on a hero, after a load', () => {
    it('its fight numbers count again as soon as the save is loaded', () => {
        LiveEffects.applyToHero(hero().id, { effectId: 'tr_nimble', durationMs: 10 * MIN });
        const before = dodge();
        expect(before).toBeGreaterThanOrEqual(5);

        saveAndLoad(NOW + 1000);

        expect(carried()).toEqual(['tr_nimble']);
        expect(dodge()).toBe(before);
    });

    it('"Load as I left it" keeps the time it had left, though the wall clock moved on an hour', () => {
        LiveEffects.applyToHero(hero().id, { effectId: 'tr_nimble', durationMs: MIN });

        saveAndLoad(NOW + HOUR, { dated: NOW + HOUR });

        ticks(1);
        expect(carried()).toEqual(['tr_nimble']);
        ticks(18);                                      // 57 s of game time: still a few seconds left
        expect(carried()).toEqual(['tr_nimble']);
        ticks(1);                                       // 60 s: over
        expect(carried()).toEqual([]);
    });

    it('stores the game time left in the save, never a wall-clock end', () => {
        LiveEffects.applyToHero(hero().id, { effectId: 'tr_nimble', durationMs: MIN });
        ticks(2);                                       // 6 s played

        const data = JSON.parse(GameState.serializeJson(NOW));
        const [saved] = data.state.heroes[0].effects;
        expect(saved.remainingMs).toBe(54_000);
        expect(saved).not.toHaveProperty('expiresAt');
    });

    it('a game that does not run (paused, closed without a catch-up) spends none of it', () => {
        LiveEffects.applyToHero(hero().id, { effectId: 'tr_nimble', durationMs: MIN });
        vi.setSystemTime(NOW + HOUR);
        ticks(1);
        expect(carried()).toEqual(['tr_nimble']);
    });

    it('a reload with a catch-up spends it during the catch-up\'s game time', () => {
        LiveEffects.applyToHero(hero().id, { effectId: 'tr_nimble', durationMs: MIN });
        saveAndLoad(NOW + HOUR);

        GameClock.begin(NOW);
        for (let i = 0; i < 18; i++) { GameClock.advance(3000); ticks(1); }
        expect(carried()).toEqual(['tr_nimble']);
        for (let i = 0; i < 2; i++) { GameClock.advance(3000); ticks(1); }
        expect(carried()).toEqual([]);
        expect(dodge()).toBe(0);
    });

    it('an effect carried for the fight and for a while keeps its while across a load mid-fight', () => {
        const id = hero().id;
        LiveEffects.applyToHero(id, { effectId: 'tr_nimble', durationMs: MIN });
        LiveEffects.applyToHero(id, { effectId: 'tr_nimble', forFight: true });

        saveAndLoad(NOW + HOUR, { dated: NOW + HOUR });
        // The board's load handler ends every hero's fight.
        LiveEffects.endHeroFightEffects(id);

        expect(carried()).toEqual(['tr_nimble']);
        expect(hero().effects[0].forFight).toBeUndefined();
        expect(dodge()).toBeGreaterThanOrEqual(5);
        ticks(20);
        expect(carried()).toEqual([]);
    });
});

describe('an older save, written with wall-clock ends', () => {
    const oldSave = (instance) => {
        const h = generateHero({ name: 'Old' });
        h.effects = [instance];
        return { ...structuredClone(GameState.state), heroes: [h], meta: { ...GameState.state.meta, lastSavedAt: NOW - HOUR } };
    };

    it('turns an end into the time that was left when it was written', () => {
        const state = migrateState(oldSave({ effectId: 'tr_nimble', scale: 1, expiresAt: NOW - HOUR + 45_000, sourceId: null }), GAME_VERSION);
        const [instance] = state.heroes[0].effects;
        expect(instance.remainingMs).toBe(45_000);
        expect(instance).not.toHaveProperty('expiresAt');
    });

    it('turns the while of one carried for the fight too, and leaves its fight lifetime as it was', () => {
        const state = migrateState(oldSave({
            effectId: 'tr_nimble', scale: 1, expiresAt: Number.MAX_SAFE_INTEGER, forFight: true, whileUntil: NOW - HOUR + 30_000
        }), GAME_VERSION);
        const [instance] = state.heroes[0].effects;
        expect(instance).toMatchObject({ expiresAt: Number.MAX_SAFE_INTEGER, forFight: true, whileLeftMs: 30_000 });
        expect(instance).not.toHaveProperty('whileUntil');
    });

    it('an end that had already passed ends on the first tick', () => {
        const state = migrateState(oldSave({ effectId: 'tr_nimble', scale: 1, expiresAt: NOW - 2 * HOUR, sourceId: null }), GAME_VERSION);
        expect(state.heroes[0].effects[0].remainingMs).toBe(0);
        loadSavedState(state);
        ticks(1);
        expect(carried()).toEqual([]);
    });
});

describe('for-the-fight and for-the-cycle instances keep their shape', () => {
    it('carry the never-by-time end and no time left', () => {
        const id = hero().id;
        LiveEffects.applyToHero(id, { effectId: 'tr_nimble', forFight: true });
        expect(hero().effects[0]).toEqual({ effectId: 'tr_nimble', scale: 1, expiresAt: Number.MAX_SAFE_INTEGER, sourceId: null, forFight: true });
        LiveEffects.removeFromHero(id);
        LiveEffects.applyToHero(id, { effectId: 'tr_nimble', forCycle: true });
        expect(hero().effects[0]).toEqual({ effectId: 'tr_nimble', scale: 1, expiresAt: Number.MAX_SAFE_INTEGER, sourceId: null, forCycle: true });
    });
});
