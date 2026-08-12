import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regen must survive a hero with a missing vital.
 *
 * ## Why this is worth a test rather than a one-line guard and a shrug
 * `RegenSystem.tick` runs inside a **GameLoop tick handler**. An exception there
 * does not fail once and stop — it is raised on every frame, forever, and the
 * loop swallows it into the console. The symptom is an endlessly repeating
 * `Cannot read properties of undefined (reading 'current')` rather than anything
 * that looks like a hero bug.
 *
 * `HeroGenerator` always supplies `hp` and `energy`, so a hero without one is
 * legacy or test-shaped save data. That is precisely the shape a tick handler
 * has to tolerate, and the rest of the codebase already assumes it can happen —
 * `ConsumptionSystem` and `HeroDockTab` both read `hero.energy?.current`.
 * `RegenSystem` was the only reader that did not.
 */

const heroes = [];

vi.mock('../systems/hero/HeroManager.js', () => ({
    getAllHeroes: () => heroes,
    modifyHeroHp: vi.fn((id, amount) => {
        const h = heroes.find(x => x.id === id);
        if (!h?.hp) return { success: false, error: 'NO_HP' };
        h.hp.current = Math.min(h.hp.max, h.hp.current + amount);
        return { success: true };
    }),
    modifyHeroEnergy: vi.fn((id, amount) => {
        const h = heroes.find(x => x.id === id);
        if (!h?.energy) return { success: false, error: 'NO_ENERGY' };
        h.energy.current = Math.min(h.energy.max, h.energy.current + amount);
        return { success: true };
    })
}));

vi.mock('../systems/hero/ConsumptionSystem.js', () => ({
    tryEat: vi.fn(() => false)
}));

vi.mock('../systems/core/EventBus.js', () => ({
    EventBus: { publish: vi.fn(), subscribe: vi.fn(() => () => {}) }
}));

vi.mock('../state/GameState.js', () => ({
    GameState: { state: { heroes: [] } }
}));

/** Heroes the real `HeroState` mutators will look up. */
const lookupHeroes = [];
vi.mock('../systems/hero/logic/HeroLookup.js', () => ({
    getHero: (id) => lookupHeroes.find(h => h.id === id) || null
}));

import * as RegenSystem from '../systems/hero/RegenSystem.js';
import * as HeroState from '../systems/hero/logic/HeroState.js';

/** Long enough that both the HP and Energy intervals fire. */
const A_GOOD_LONG_TICK = 60_000;

beforeEach(() => {
    heroes.length = 0;
    lookupHeroes.length = 0;
    RegenSystem.reset();
});

describe('RegenSystem tolerates heroes with missing vitals', () => {
    it('does not throw for a hero with no energy — the crash that spammed every frame', () => {
        heroes.push({ id: 'h1', status: 'idle', hp: { current: 10, max: 100 } });

        expect(() => RegenSystem.tick(A_GOOD_LONG_TICK)).not.toThrow();
    });

    it('does not throw for a hero with no hp either', () => {
        heroes.push({ id: 'h2', status: 'idle', energy: { current: 10, max: 100 } });

        expect(() => RegenSystem.tick(A_GOOD_LONG_TICK)).not.toThrow();
    });

    it('does not throw for a hero with neither', () => {
        heroes.push({ id: 'h3', status: 'idle' });

        expect(() => RegenSystem.tick(A_GOOD_LONG_TICK)).not.toThrow();
    });

    /**
     * The important half: guarding must not turn regen off for everyone else.
     * One malformed hero in a roster of eight should cost nothing.
     */
    it('still regenerates the healthy heroes standing next to the broken one', () => {
        heroes.push({ id: 'broken', status: 'idle', hp: { current: 10, max: 100 } });
        heroes.push({ id: 'fine', status: 'idle', hp: { current: 10, max: 100 }, energy: { current: 10, max: 100 } });

        RegenSystem.tick(A_GOOD_LONG_TICK);

        const fine = heroes.find(h => h.id === 'fine');
        expect(fine.hp.current).toBeGreaterThan(10);
        expect(fine.energy.current).toBeGreaterThan(10);
        // and the broken one still got the vital it DOES have
        expect(heroes.find(h => h.id === 'broken').hp.current).toBeGreaterThan(10);
    });
});

/**
 * The mutators are the deeper fix: guarding only `RegenSystem` would leave every
 * other caller (`effectResolvers`, `ConsumptionSystem`) able to throw on the same
 * data.
 */
describe('HeroState mutators report a missing vital rather than throwing', () => {
    it('modifyHeroEnergy returns NO_ENERGY for a hero that has none', () => {
        lookupHeroes.push({ id: 'noEnergy', hp: { current: 5, max: 10 } });

        const result = HeroState.modifyHeroEnergy('noEnergy', 5);

        expect(result.success).toBe(false);
        expect(result.error).toBe('NO_ENERGY');
    });

    it('modifyHeroHp returns NO_HP for a hero that has none', () => {
        lookupHeroes.push({ id: 'noHp', energy: { current: 5, max: 10 } });

        const result = HeroState.modifyHeroHp('noHp', 5);

        expect(result.success).toBe(false);
        expect(result.error).toBe('NO_HP');
    });

    it('still writes normally to a well-formed hero', () => {
        lookupHeroes.push({ id: 'ok', hp: { current: 5, max: 10 }, energy: { current: 5, max: 10 } });

        expect(HeroState.modifyHeroHp('ok', 3)).toMatchObject({ success: true, newHp: 8 });
        expect(HeroState.modifyHeroEnergy('ok', 3)).toMatchObject({ success: true, newEnergy: 8 });
    });
});
