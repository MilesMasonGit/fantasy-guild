import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { EventBus } from '../systems/core/EventBus.js';
import { STATUS_TICK_INTERVAL_MS } from '../config/FormulaRegistry.js';
import { rolesOf } from '../config/registries/triggerRegistry.js';
import { ROLE } from '../config/registries/roleRegistry.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ **Effects that stay on you** (Effects Grammar v2, V6 — G-6, G-16, G-17).
 *
 * The only genuinely new runtime concept in the rework, and it is what a status
 * always secretly was: a rule with a clock, attached to somebody. A live
 * instance is a reference into the same library everything else references —
 * nothing here knows what Poison *is*.
 */

function makeHero(id, hp = 100) {
    const skills = {};
    for (const s of getAllSkillIds()) skills[s] = { level: 50, xp: 0 };
    return {
        id, name: id, status: 'idle', level: 50, skills,
        hp: { current: hp, max: hp }, statuses: [], effects: [],
        aggregator: new ModifierAggregator(id)
    };
}

/** A poison: deal N damage every tick, for as long as it lasts. */
function registerPoison(id = 'fixture_poison', amount = 2) {
    registerEffects({
        [id]: {
            id, name: 'Poison',
            statements: [{
                ...makeStatement(KEYWORD.DEALS), id: `stm_${id}`,
                when: { event: 'EFFECT_TICK', scope: 'self' },
                target: { role: ROLE.SELF },
                payload: { amount, ignoresArmor: true }
            }]
        }
    });
    return id;
}

const ticks = (n) => {
    for (let i = 0; i < n; i++) {
        LiveEffects.tick(STATUS_TICK_INTERVAL_MS, TriggerSystem.fireLiveStatement);
    }
};
const hp = () => HeroManager.getHero('hero_1').hp.current;
const carried = () => HeroManager.getHero('hero_1').effects;

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [makeHero('hero_1')];
    LiveEffects.resetClock();
    TriggerSystem.resetCascadeGuard();
    registerPoison();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('⭐ an effect can stay on somebody and keep acting', () => {
    it('ticks its damage while it is carried', () => {
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', durationMs: 60000 });

        ticks(3);

        expect(hp()).toBe(94);   // 2 damage, three times
    });

    it('stops once it expires', () => {
        vi.useFakeTimers();
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', durationMs: 1 });

        vi.advanceTimersByTime(10);
        ticks(1);                       // fires, then expires
        const afterFirst = hp();
        ticks(3);                       // gone: nothing more

        expect(carried()).toEqual([]);
        expect(hp()).toBe(afterFirst);
    });

    it('scales its damage by the reference tier, like everything else', () => {
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', scale: 3, durationMs: 60000 });

        ticks(1);

        expect(hp()).toBe(94);   // 2 × 3
    });

    it('is a reference into the same library, not a special kind of thing', () => {
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', durationMs: 60000 });
        expect(carried()[0]).toMatchObject({ effectId: 'fixture_poison', scale: 1 });
        expect(carried()[0].expiresAt).toBeGreaterThan(Date.now());
    });

    it('refuses an effect the library does not have', () => {
        expect(LiveEffects.applyToHero('hero_1', { effectId: 'no_such_effect' })).toBe(false);
        expect(carried()).toEqual([]);
    });
});

describe('⚠️ re-application REFRESHES, and never stacks (G-16)', () => {
    it('keeps one instance when the same effect lands twice', () => {
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', durationMs: 60000 });
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', durationMs: 60000 });

        expect(carried()).toHaveLength(1);
        ticks(1);
        expect(hp()).toBe(98);   // 2, not 4 — this is the 99-stack Poison, refused
    });

    it('pushes the clock out rather than adding a second timer', () => {
        vi.useFakeTimers();
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', durationMs: 1000 });
        const first = carried()[0].expiresAt;

        vi.advanceTimersByTime(500);
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', durationMs: 1000 });

        expect(carried()).toHaveLength(1);
        expect(carried()[0].expiresAt).toBeGreaterThan(first);
    });

    it('⚠️ lets a STRONGER application win, so better gear is not discarded', () => {
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', scale: 1, durationMs: 60000 });
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', scale: 3, durationMs: 60000 });

        expect(carried()[0].scale).toBe(3);
    });

    it('does not let a weaker one demote it', () => {
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', scale: 3, durationMs: 60000 });
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', scale: 1, durationMs: 60000 });

        expect(carried()[0].scale).toBe(3);
    });
});

describe('taking one off again', () => {
    it('removes one by name', () => {
        registerPoison('fixture_burning', 4);
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', durationMs: 60000 });
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_burning', durationMs: 60000 });

        expect(LiveEffects.removeFromHero('hero_1', 'fixture_poison')).toBe(1);
        expect(carried().map(e => e.effectId)).toEqual(['fixture_burning']);
    });

    it('clears the lot — the defeat cleanse', () => {
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', durationMs: 60000 });
        expect(LiveEffects.clearHero('hero_1')).toBe(1);
        expect(carried()).toEqual([]);
    });

    it('answers whether a hero is carrying something', () => {
        const hero = HeroManager.getHero('hero_1');
        expect(LiveEffects.heroCarries(hero, 'fixture_poison')).toBe(false);
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', durationMs: 60000 });
        expect(LiveEffects.heroCarries(HeroManager.getHero('hero_1'), 'fixture_poison')).toBe(true);
    });
});

describe('⚠️ a lethal tick announces, and never resolves the death', () => {
    it('publishes hero_downed rather than killing in place', () => {
        // The whole of what dying costs lives once, in `BoardCombat`. CR2-070:
        // this branch was a no-op for months and a poisoned hero worked on at 0.
        const downed = [];
        const un = EventBus.subscribe('hero_downed', p => downed.push(p));

        registerPoison('fixture_lethal', 500);
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_lethal', durationMs: 60000 });
        ticks(1);
        un();

        expect(downed).toContainEqual({ heroId: 'hero_1', cause: 'effect' });
    });

    it('leaves a wounded hero alone — they are off the board and already cleansed', () => {
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', durationMs: 60000 });
        HeroManager.getHero('hero_1').status = 'wounded';

        ticks(3);

        expect(hp()).toBe(100);
    });
});

describe('the clock', () => {
    it('⚠️ runs at exactly the interval the status engine used', () => {
        // Poison has always ticked at this rate. A different one would silently
        // re-balance every damage-over-time effect in the game when the seven
        // are re-authored.
        LiveEffects.applyToHero('hero_1', { effectId: 'fixture_poison', durationMs: 60000 });

        LiveEffects.tick(STATUS_TICK_INTERVAL_MS - 1, TriggerSystem.fireLiveStatement);
        expect(hp()).toBe(100);                 // not yet

        LiveEffects.tick(1, TriggerSystem.fireLiveStatement);
        expect(hp()).toBe(98);                  // now
    });
});

describe('the moment is declared like every other', () => {
    it('supplies only `self`, because a carried effect has no neighbours', () => {
        expect(rolesOf('EFFECT_TICK')).toEqual([ROLE.SELF]);
    });
});
