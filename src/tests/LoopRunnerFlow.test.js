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
        deckSlots: [
            { templateId: 't_task_a' },
            { templateId: 't_task_b' }
        ]
    } : null)),
    getAllAreaSets: vi.fn(() => ({}))
}));

vi.mock('../config/registries/cardRegistry.js', () => ({
    getCard: vi.fn((id) => (id?.startsWith('t_task') ? {
        id,
        templateId: id,
        name: id,
        cardType: 'task',
        baseTickTime: 4000,
        config: { skill: 'labor' },
        traits: [{ type: 'workcycle', skill: 'labor' }]
    } : null)),
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

    it('shuffles on wrap-around and carries overshoot through the shuffle', () => {
        LoopRunner.tick(100);
        LoopRunner.tick(DRAW_TIME_MS);        // running slot 0
        LoopRunner.tick(TASK_TIME);           // -> drawing slot 1
        LoopRunner.tick(DRAW_TIME_MS);        // running slot 1
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
