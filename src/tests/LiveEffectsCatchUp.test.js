import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as GameClock from '../systems/core/GameClock.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * A live effect's expiry is a moment on the game clock: an effect with a minute left when the game
 * closed lasts a minute into the catch-up, not zero seconds (the wall clock says a day has passed).
 */

const DAY = 24 * 3_600_000;
const NOW = 1_800_000_000_000;
const SAVED_AT = NOW - DAY;

function makeHero(id) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return {
        id, name: id, status: 'idle', level: 50, skills,
        hp: { current: 100, max: 100 }, statuses: [], effects: [],
        aggregator: new ModifierAggregator(id)
    };
}

const carried = () => HeroManager.getHero('hero_1').effects.map(e => e.effectId);

/** One catch-up step: the game clock moves, then the effect clock ticks. */
function step(ms) {
    GameClock.advance(ms);
    LiveEffects.tick(ms, TriggerSystem.fireLiveStatement);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    GameState.initNew();
    GameState.state.heroes = [makeHero('hero_1')];
    LiveEffects.resetClock();
    registerEffects({ fixture_timer: { id: 'fixture_timer', name: 'Timer', statements: [] } });
    // Carried when the game was saved, with 60 s left.
    HeroManager.getHero('hero_1').effects = [
        { effectId: 'fixture_timer', scale: 1, expiresAt: SAVED_AT + 60_000, sourceId: null }
    ];
});

afterEach(() => {
    GameClock.end();
    vi.useRealTimers();
});

describe('a live effect during a catch-up', () => {
    it('an effect with 60 s left when the game closed ends 60 s into the catch-up', () => {
        GameClock.begin(SAVED_AT);
        for (let i = 0; i < 55; i++) step(1000);
        expect(carried()).toEqual(['fixture_timer']);    // 55 s in: still there

        for (let i = 0; i < 10; i++) step(1000);
        expect(carried()).toEqual([]);                   // by 65 s (the 5 s effect clock): gone
    });

    it('an effect applied during a catch-up lasts its duration in game time', () => {
        HeroManager.getHero('hero_1').effects = [];
        GameClock.begin(SAVED_AT);
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_timer', durationMs: 30_000 });
        expect(HeroManager.getHero('hero_1').effects[0].expiresAt).toBe(SAVED_AT + 30_000);

        for (let i = 0; i < 25; i++) step(1000);
        expect(carried()).toEqual(['fixture_timer']);
        for (let i = 0; i < 10; i++) step(1000);
        expect(carried()).toEqual([]);
    });
});
