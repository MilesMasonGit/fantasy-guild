import { describe, it, expect, vi, beforeEach } from 'vitest';

// D-20/D-25b/D-28: a loop opens with the Prep Phase — one quick card per
// equipped Consumable, spent before the deck proper begins. It makes buffing
// legible, and prices it in the currency the loop cares about: TIME.

const { spent } = vi.hoisted(() => ({ spent: { items: [] } }));

vi.mock('../systems/hero/ConsumptionSystem.js', () => ({
    consumeLoopConsumables: vi.fn(() => spent.items),
    tryDrink: vi.fn(() => null),
    tryEat: vi.fn(() => null)
}));

vi.mock('../config/registries/areaSetRegistry.js', () => ({
    getAreaSet: vi.fn((id) => (id === 'area_test' ? {
        id: 'area_test',
        name: 'Test Area',
        deckSlots: [{ templateId: 't_task_a' }, { templateId: 't_task_b' },
                    { templateId: 't_task_c' }, { templateId: 't_task_d' }]
    } : null)),
    getAllAreaSets: vi.fn(() => ({}))
}));

vi.mock('../config/registries/cardRegistry.js', () => ({
    getCard: vi.fn((id) => (id?.startsWith('t_task') ? {
        id, templateId: id, name: id, cardType: 'task', baseTickTime: 4000,
        config: { skill: 'labor' }, traits: [{ type: 'workcycle', skill: 'labor' }]
    } : null)),
    getAllCards: vi.fn(() => ({})),
    getCardsByAreaSet: vi.fn(() => []),
    CARD_TYPES: { TASK: 'task', COMBAT: 'combat', STATION: 'station' }
}));

vi.mock('../config/registries/itemRegistry.js', () => ({
    getItem: vi.fn((id) => ({
        elixir: { id: 'elixir', name: 'Haste Elixir', loopEffect: { type: 'SPEED', value: 0.3, bucket: 'percentage' } },
        scroll: { id: 'scroll', name: 'Scroll of Bounty', loopEffect: { type: 'YIELD', value: 0.25, bucket: 'percentage' } },
        plain:  { id: 'plain',  name: 'Plain Thing' }   // no loopEffect
    }[id] || null)),
    ITEMS: {}
}));

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(),
    error: vi.fn(), getQueue: vi.fn(() => [])
}));

import { GameState } from '../state/GameState.js';
import { LoopRunner } from '../systems/loop/LoopRunner.js';
import { ensureAreaState } from '../systems/area/AreaStateManager.js';
import { assignHeroToArea } from '../systems/area/HeroAssignmentManager.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { getAreaAggregator, clearAllAreaAggregators } from '../systems/loop/AreaModifiers.js';
import { clearAllLoopBuffs } from '../systems/loop/LoopBuffs.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { PREP_CARD_TIME_MS, DRAW_TIME_MS } from '../config/loopConstants.js';

const area = () => GameState.state.areaStates['area_test'];
const speed = () => getAreaAggregator('area_test').getPercentageBucket(EFFECT_TYPES.SPEED);

function setup() {
    GameState.initNew();
    LoopRunner.init();
    LoopRunner._activeCards.clear();
    clearAllLoopBuffs();
    clearAllAreaAggregators();
    const hero = HeroManager.createHero({ name: 'Tester' });
    hero.energy.current = 1e9;
    hero.energy.max = 1e9;
    ensureAreaState('area_test');
    assignHeroToArea(hero.id, 'area_test');
    return hero;
}

beforeEach(() => { spent.items = []; setup(); });

describe('a loop with no Consumables', () => {
    it('goes straight to drawing — an empty prep phase costs nothing', () => {
        LoopRunner.tick(100);
        expect(area().status).toBe('drawing');
        expect(area().executionTimer).toBe(DRAW_TIME_MS);
    });
});

describe('the Prep Phase (D-20)', () => {
    beforeEach(() => {
        spent.items = [
            { itemId: 'elixir', item: { id: 'elixir', loopEffect: { type: 'SPEED', value: 0.3, bucket: 'percentage' } } },
            { itemId: 'scroll', item: { id: 'scroll', loopEffect: { type: 'YIELD', value: 0.25, bucket: 'percentage' } } }
        ];
        setup();
    });

    it('opens the loop in prepping, not drawing', () => {
        LoopRunner.tick(100);
        expect(area().status).toBe('prepping');
        expect(area().prepQueue).toEqual(['elixir', 'scroll']);
        expect(area().prepIndex).toBe(0);
    });

    it('spends one quick card per Consumable, then starts the deck', () => {
        LoopRunner.tick(100);                    // -> prepping (card 1)
        expect(area().executionTimer).toBe(PREP_CARD_TIME_MS);

        LoopRunner.tick(PREP_CARD_TIME_MS);      // card 1 done -> card 2
        expect(area().status).toBe('prepping');
        expect(area().prepIndex).toBe(1);

        LoopRunner.tick(PREP_CARD_TIME_MS);      // card 2 done -> the deck
        expect(area().status).toBe('drawing');
    });

    it('costs real time — two potions delay the first task by 2x prep', () => {
        LoopRunner.tick(100);
        let elapsed = 0;
        while (area().status === 'prepping' && elapsed < 60000) {
            LoopRunner.tick(PREP_CARD_TIME_MS);
            elapsed += PREP_CARD_TIME_MS;
        }
        expect(elapsed).toBe(2 * PREP_CARD_TIME_MS);
    });

    it('applies each buff for the rest of the loop', () => {
        expect(speed()).toBe(1);
        LoopRunner.tick(100);                    // prepping card 1
        expect(speed()).toBe(1);                 // not applied until it FINISHES

        LoopRunner.tick(PREP_CARD_TIME_MS);      // elixir lands
        expect(speed()).toBeCloseTo(1.3);
    });

    // D-28: energy pays for TASK draws only. A hero too drained to drink the
    // thing that restores their energy would be an unrecoverable trap.
    it('charges no energy for prep cards', () => {
        const hero = HeroManager.getHero(area().assignedHeroId);
        hero.energy.current = 10;
        hero.energy.max = 100;

        LoopRunner.tick(100);
        LoopRunner.tick(PREP_CARD_TIME_MS);
        LoopRunner.tick(PREP_CARD_TIME_MS);

        expect(hero.energy.current).toBe(10);    // untouched by the whole prep
        expect(area().status).toBe('drawing');
    });

    it('tolerates a Consumable with no loop effect', () => {
        spent.items = [{ itemId: 'plain', item: { id: 'plain' } }];
        setup();
        LoopRunner.tick(100);
        expect(() => LoopRunner.tick(PREP_CARD_TIME_MS)).not.toThrow();
        expect(area().status).toBe('drawing');
    });
});

describe('prep buffs and the loop boundary', () => {
    beforeEach(() => {
        spent.items = [{ itemId: 'elixir', item: { id: 'elixir', loopEffect: { type: 'SPEED', value: 0.3, bucket: 'percentage' } } }];
        setup();
    });

    it('does not survive the wrap — a prep buff must not compound', () => {
        LoopRunner.tick(100);
        LoopRunner.tick(PREP_CARD_TIME_MS);
        expect(speed()).toBeCloseTo(1.3);

        // Work the whole deck so the loop wraps.
        for (let i = 0; i < 4; i++) {
            LoopRunner.tick(DRAW_TIME_MS);
            LoopRunner.tick(4000);
        }
        expect(area().status).toBe('shuffling');
        expect(speed()).toBe(1);
    });

    it('re-spends Consumables on the next loop rather than reusing them', () => {
        LoopRunner.tick(100);
        LoopRunner.tick(PREP_CARD_TIME_MS);
        for (let i = 0; i < 4; i++) { LoopRunner.tick(DRAW_TIME_MS); LoopRunner.tick(4000); }
        expect(area().status).toBe('shuffling');

        // The shuffle ends and the NEXT loop opens with prep all over again.
        LoopRunner.tick(20000);
        expect(area().status).toBe('prepping');
    });
});
