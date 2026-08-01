import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameState } from '../state/GameState.js';
import { LoopRunner } from '../systems/loop/LoopRunner.js';
import { ensureAreaState } from '../systems/area/AreaStateManager.js';
import { assignHeroToArea, resetAreaLoop } from '../systems/area/HeroAssignmentManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { DRAW_TIME_MS, SHUFFLE_TIME_MS } from '../config/loopConstants.js';

// CR-053: first regression net for the loop engine's phase machine,
// including the CR-022 remainder-carry behavior measured in Session 7.

const TASK_TIME = 4000;

vi.mock('../config/registries/areaSetRegistry.js', () => ({
    getAreaSet: vi.fn((id) => (id === 'area_test' ? {
        id: 'area_test',
        name: 'Test Area',
        // Four slots: every area has exactly DECK_SLOT_COUNT of them (D-1/D-2),
        // so a wrap-around test has to run all four before it shuffles.
        deckSlots: [
            { templateId: 't_task_a' },
            { templateId: 't_task_b' },
            { templateId: 't_task_c' },
            { templateId: 't_task_d' }
        ]
    } : null)),
    getAllAreaSets: vi.fn(() => ({}))
}));

vi.mock('../config/registries/cardRegistry.js', () => ({
    getCard: vi.fn((id) => {
        if (id?.startsWith('t_task')) return {
            id,
            templateId: id,
            name: id,
            cardType: 'task',
            baseTickTime: 4000,
            config: { skill: 'labor' },
            traits: [{ type: 'workcycle', skill: 'labor' }]
        };
        // A hazard Task card (D-8): yields like any task AND bites on arrival.
        // Damage is high enough to be lethal in these tests.
        if (id === 't_hazard') return {
            id,
            templateId: id,
            name: 't_hazard',
            cardType: 'task',
            baseTickTime: 4000,
            config: { skill: 'labor' },
            traits: [{ type: 'workcycle', skill: 'labor' }],
            effects: [{ kind: 'hazard', damage: 999, hazardType: 'bleed' }]
        };
        // A Boost authored purely as EFFECTS (D-60) — deliberately NO traits,
        // which is what exposed the work-pipeline jam this file regresses.
        if (id === 't_boost') return {
            id,
            templateId: id,
            name: 't_boost',
            cardType: 'boost',
            baseTickTime: 2000,
            effects: [{ kind: 'buff', reach: 'loop', modifiers: [{ type: 'SPEED', value: 0.25, bucket: 'percentage' }] }]
        };
        return null;
    }),
    getAllCards: vi.fn(() => ({})),
    getCardsByAreaSet: vi.fn(() => []),
    CARD_TYPES: { TASK: 'task', COMBAT: 'combat', STATION: 'station' }
}));

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(),
    error: vi.fn(), getQueue: vi.fn(() => [])
}));

const area = () => GameState.state.areaStates['area_test'];

function setupRunningArea() {
    GameState.initNew();
    // Subscribes the STATS_DIRTY -> discard-and-pause handler (idempotent).
    LoopRunner.init();
    LoopRunner._activeCards.clear();
    const hero = HeroManager.createHero({ name: 'Tester' });
    hero.energy.current = 1e9;
    hero.energy.max = 1e9;
    ensureAreaState('area_test');
    assignHeroToArea(hero.id, 'area_test');
    return hero;
}

describe('LoopRunner phase machine (CR-053)', () => {
    beforeEach(() => {
        setupRunningArea();
    });

    it('auto-starts a paused area with an assigned hero into drawing', () => {
        expect(area().status).toBe('paused');
        LoopRunner.tick(100);
        expect(area().status).toBe('drawing');
        expect(area().executionTimer).toBe(DRAW_TIME_MS);
    });

    it('activates the slot when the draw timer runs out', () => {
        LoopRunner.tick(100);                 // paused -> drawing
        LoopRunner.tick(DRAW_TIME_MS);        // draw timer exactly consumed
        expect(area().status).toBe('running');
        expect(LoopRunner.getActiveCardForArea('area_test')?.templateId).toBe('t_task_a');
    });

    it('carries draw-timer overshoot into the task countdown (CR-022)', () => {
        LoopRunner.tick(100);                 // paused -> drawing (timer 1500)
        const overshoot = 700;
        LoopRunner.tick(DRAW_TIME_MS + overshoot);
        expect(area().status).toBe('running');
        // _activeDuration holds the full task time; the countdown starts
        // short by exactly the overshoot.
        expect(area()._activeDuration - area().executionTimer).toBe(overshoot);
    });

    it('completes the task, advances the cursor, and re-enters drawing', () => {
        LoopRunner.tick(100);
        LoopRunner.tick(DRAW_TIME_MS);        // running t_task_a
        LoopRunner.tick(TASK_TIME);           // complete exactly
        expect(area().activeCardIndex).toBe(1);
        expect(area().status).toBe('drawing');
    });

    // REGRESSION: a card with no `traits` — which is every card authored
    // purely as effects (D-60) — used to throw inside completeWorkCycle every
    // tick. `_completeActiveSlot` aborted, the slot never advanced, and the
    // area's executionTimer ran away negative forever. Silent and total.
    it('a traitless effects-only card completes and advances the loop', () => {
        area().deckSlots[0].templateId = 't_boost';
        LoopRunner.tick(100);                 // paused -> drawing
        LoopRunner.tick(DRAW_TIME_MS);        // running the boost card
        expect(area().status).toBe('running');

        expect(() => LoopRunner.tick(2000)).not.toThrow();

        // It advanced rather than jamming, and the timer never went negative.
        expect(area().activeCardIndex).toBe(1);
        expect(area().executionTimer).toBeGreaterThanOrEqual(0);
    });

    // D-8/D-11: hazards live on cards now and bite once per execution, on
    // arrival. A lethal hit must route through Forced Retreat rather than
    // leaving the hero at negative HP with the loop still running.
    describe('hazard cards', () => {
        it('damages the hero when the card activates, not when it completes', () => {
            const hero = HeroManager.getHero(GameState.state.heroes[0].id);
            hero.hp.current = hero.hp.max;
            area().deckSlots[0].templateId = 't_hazard';

            LoopRunner.tick(100);                 // -> drawing
            const before = hero.hp.current;
            LoopRunner.tick(DRAW_TIME_MS);        // slot activates: hazard bites here
            expect(hero.hp.current).toBeLessThan(before);
        });

        it('a lethal hit forces a retreat instead of running on at 0 HP', () => {
            const hero = HeroManager.getHero(GameState.state.heroes[0].id);
            hero.hp.current = 5;                  // the 999 hazard will kill
            area().deckSlots[0].templateId = 't_hazard';

            LoopRunner.tick(100);
            LoopRunner.tick(DRAW_TIME_MS);

            expect(hero.status).toBe('wounded');
            expect(area().status).toBe('injured');
            // The loop stopped rather than continuing to tick a dead hero.
            expect(LoopRunner.getActiveCardForArea('area_test')).toBeFalsy();
        });
    });

    it('builds exactly four slots, however many the area authored (D-1/D-2)', () => {
        expect(area().deckSlots).toHaveLength(4);
        // Free and identical: no slot types, no tag gates, no locks.
        for (const slot of area().deckSlots) {
            expect(slot.slotType).toBeUndefined();
            expect(slot.specializedTags).toBeUndefined();
            expect(slot.isLocked).toBeUndefined();
            expect(slot.hazard).toBeUndefined();
        }
    });

    it('shuffles on wrap-around and carries overshoot through the shuffle', () => {
        LoopRunner.tick(100);
        // Work all four slots; the wrap happens after the last one.
        for (let i = 0; i < 3; i++) {
            LoopRunner.tick(DRAW_TIME_MS);    // running slot i
            LoopRunner.tick(TASK_TIME);       // -> drawing slot i+1
        }
        LoopRunner.tick(DRAW_TIME_MS);        // running slot 3
        LoopRunner.tick(TASK_TIME + 300);     // complete with 300ms overshoot -> wrap
        expect(area().activeCardIndex).toBe(0);
        expect(area().status).toBe('shuffling');
        expect(SHUFFLE_TIME_MS - area().executionTimer).toBe(300);
    });

    it('records completions in collection.cardUseCounts', () => {
        LoopRunner.tick(100);
        LoopRunner.tick(DRAW_TIME_MS);
        LoopRunner.tick(TASK_TIME);
        expect(GameState.state.collection.cardUseCounts.t_task_a).toBe(1);
    });

    it('loop reset (deck/hero change) discards the active card and pauses', () => {
        LoopRunner.tick(100);
        LoopRunner.tick(DRAW_TIME_MS);        // running with an ephemeral card
        expect(LoopRunner.getActiveCardForArea('area_test')).not.toBeNull();
        resetAreaLoop('area_test');
        expect(LoopRunner.getActiveCardForArea('area_test')).toBeNull();
        expect(area().status).toBe('paused');
        expect(area().activeCardIndex).toBe(0);
    });
});
