import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { GAME_VERSION } from '../state/StateSchema.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as NotificationSystem from '../systems/core/NotificationSystem.js';
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
 * An effect a hero carries lasts for the fight, the swing or the work cycle, never for a stretch of
 * game time: timed effects are retired. A carried effect's numbers count again after a load, and an
 * older save still holding a timed one loads with it gone, quietly.
 */

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

registerEffects({
    tr_nimble: {
        id: 'tr_nimble', name: 'Nimble',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), to: null, payload: { type: EFFECT_TYPES.DODGE, bucket: 'flat', value: 5 } }]
    },
    tr_sturdy: {
        id: 'tr_sturdy', name: 'Sturdy',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), to: null, payload: { type: EFFECT_TYPES.DODGE, bucket: 'flat', value: 3 } }]
    }
});

const hero = () => HeroManager.getHero(GameState.state.heroes[0].id);
const carried = () => hero().effects.map(e => e.effectId);
const dodge = () => hero().aggregator.query(EFFECT_TYPES.DODGE);
const ticks = (n) => {
    for (let i = 0; i < n; i++) LiveEffects.tick(STATUS_TICK_INTERVAL_MS, TriggerSystem.fireLiveStatement);
};

/** The game saved now and loaded again, as a reload does. */
function saveAndLoad() {
    const data = JSON.parse(GameState.serializeJson(Date.now()));
    loadSavedState(migrateState(data.state, data.version));
    return data;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    GameState.initNew();
    const h = generateHero({ name: 'Ada' });
    h.status = 'idle';
    GameState.state.heroes = [h];
    HeroManager.rehydrateHero(h);
    LiveEffects.resetClock();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('a carried effect on a hero, after a load', () => {
    it('its numbers count again as soon as the save is loaded', () => {
        LiveEffects.applyToHero(hero().id, { effectId: 'tr_nimble', forCycle: true });
        const before = dodge();
        expect(before).toBeGreaterThanOrEqual(5);

        saveAndLoad();

        expect(carried()).toEqual(['tr_nimble']);
        expect(dodge()).toBe(before);
    });

    it('carries its lifetime and no clock: for the fight, for the cycle', () => {
        const id = hero().id;
        LiveEffects.applyToHero(id, { effectId: 'tr_nimble', forFight: true });
        expect(hero().effects[0]).toEqual({ effectId: 'tr_nimble', scale: 1, sourceId: null, forFight: true });
        LiveEffects.removeFromHero(id);
        LiveEffects.applyToHero(id, { effectId: 'tr_nimble', forCycle: true });
        expect(hero().effects[0]).toEqual({ effectId: 'tr_nimble', scale: 1, sourceId: null, forCycle: true });
    });

    it('is never ended by time, however long the effect clock runs', () => {
        LiveEffects.applyToHero(hero().id, { effectId: 'tr_nimble', forFight: true });
        ticks(2000);                                    // 100 minutes of the effect clock
        expect(carried()).toEqual(['tr_nimble']);
        expect(dodge()).toBeGreaterThanOrEqual(5);
    });

    it('a landing with no lifetime fires once and is carried by nobody, whatever time it asks for', () => {
        const fired = [];
        const landed = LiveEffects.applyToHero(hero().id, { effectId: 'tr_nimble', durationMs: 60_000 }, null, (s) => fired.push(s));
        expect(landed).toBe(true);
        expect(fired).toHaveLength(1);
        expect(carried()).toEqual([]);
    });
});

describe('⭐ an older save holding a timed effect loads with it dropped, quietly', () => {
    const oldSave = (...instances) => {
        const h = generateHero({ name: 'Old' });
        h.effects = instances;
        return { ...structuredClone(GameState.state), heroes: [h], meta: { ...GameState.state.meta, lastSavedAt: NOW - HOUR } };
    };
    const effectsAfter = (...instances) => migrateState(oldSave(...instances), GAME_VERSION).heroes[0].effects;

    it('drops one holding the game time it had left', () => {
        expect(effectsAfter(
            { effectId: 'tr_nimble', scale: 1, remainingMs: 45_000, sourceId: null },
            { effectId: 'tr_sturdy', scale: 1, sourceId: null, forCycle: true }
        )).toEqual([{ effectId: 'tr_sturdy', scale: 1, sourceId: null, forCycle: true }]);
    });

    it('drops one from before that, holding a wall-clock end', () => {
        expect(effectsAfter({ effectId: 'tr_nimble', scale: 1, expiresAt: NOW - HOUR + 45_000, sourceId: null })).toEqual([]);
    });

    it('keeps one carried for the fight as well, losing only its while', () => {
        expect(effectsAfter(
            { effectId: 'tr_nimble', scale: 1, expiresAt: Number.MAX_SAFE_INTEGER, sourceId: null, forFight: true, whileLeftMs: 30_000 },
            { effectId: 'tr_sturdy', scale: 1, expiresAt: Number.MAX_SAFE_INTEGER, sourceId: null, forFight: true, whileUntil: NOW - HOUR + 30_000 }
        )).toEqual([
            { effectId: 'tr_nimble', scale: 1, sourceId: null, forFight: true },
            { effectId: 'tr_sturdy', scale: 1, sourceId: null, forFight: true }
        ]);
    });

    it('keeps the never-by-time mark off what lasts for its fight, its cycle or as a status', () => {
        expect(effectsAfter(
            { effectId: 'tr_nimble', scale: 1, expiresAt: Number.MAX_SAFE_INTEGER, sourceId: null, forCycle: 'tok_1' },
            { effectId: 'tr_sturdy', scale: 1, stacks: 2, ticksLeft: 3, expiresAt: Number.MAX_SAFE_INTEGER, forFight: true, sourceId: null }
        )).toEqual([
            { effectId: 'tr_nimble', scale: 1, sourceId: null, forCycle: 'tok_1' },
            { effectId: 'tr_sturdy', scale: 1, stacks: 2, ticksLeft: 3, forFight: true, sourceId: null }
        ]);
    });

    it('loads and plays without it, and says nothing about it', () => {
        loadSavedState(migrateState(oldSave({ effectId: 'tr_nimble', scale: 1, remainingMs: 45_000, sourceId: null }), GAME_VERSION));
        expect(carried()).toEqual([]);
        expect(dodge()).toBe(0);
        ticks(3);
        expect(carried()).toEqual([]);
        for (const say of ['notify', 'warning', 'info', 'success', 'error']) expect(NotificationSystem[say]).not.toHaveBeenCalled();
    });

    it('leaves a save with nothing timed exactly as it was', () => {
        const state = oldSave({ effectId: 'tr_sturdy', scale: 1, sourceId: null, forCycle: true });
        const heroes = state.heroes;
        expect(migrateState(state, GAME_VERSION).heroes).toBe(heroes);
    });
});
