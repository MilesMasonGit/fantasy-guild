import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as Demolition from '../systems/board/Demolition.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * A work cycle starts fresh: a new recipe begins its cycle from zero and announces its start, and
 * what a hero carried "for the cycle" ends when they leave the cycle.
 */

const KITCHEN_AT = { x: 400, y: 400 };
const TREE_AT = { x: 1400, y: 400 };

const recipe = (id, durationMs) => ({
    id, levelRequirement: 0, requiresContext: [], inputs: [],
    outputs: [{ itemId: 'm6_meal', minQty: 1, maxQty: 1, chance: 100 }], durationMs, xp: 1
});
registerRecipePools({ cooking: [recipe('m6_slow_meal', 16000), recipe('m6_quick_meal', 8000)] });
const crop = (id) => ({ ...recipe(id, 1000), stationKinds: ['field'], crop: { growMs: 20000, load: 3 } });
registerRecipePools({ farming: [crop('m6_crop_a'), crop('m6_crop_b')] });

registerEffects({
    m6_fx_watch: { id: 'm6_fx_watch', name: 'Watch', statements: [] },
    m6_fx_watch_potion: {
        id: 'm6_fx_watch_potion', name: 'Watch Potion',
        statements: [{
            ...makeStatement(KEYWORD.APPLIES),
            when: { event: 'WORK_START', scope: 'self' },
            target: { role: 'actor' },
            payload: { effectId: 'm6_fx_watch', scale: 1, durationMs: 0, forCycle: true, chance: 100 }
        }]
    }
});
registerItems({
    m6_meal: { id: 'm6_meal', name: 'Meal', stackable: true },
    m6_log: { id: 'm6_log', name: 'Log', stackable: true },
    m6_watch_potion: {
        id: 'm6_watch_potion', name: 'Watch Potion', equipSlot: 'consumable', stackable: true,
        sprite: 'i_potion_shrimp_pink', effects: [{ effectId: 'm6_fx_watch_potion' }]
    }
});
registerTokenTypes({
    m6_field: {
        id: 'm6_field', name: 'Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_farmland', requiresHero: true, field: {},
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_m6_field', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
    },
    m6_tree: {
        id: 'm6_tree', name: 'Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: true,
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 4000, xp: 1, inputs: [], outputs: [{ itemId: 'm6_log', quantity: 1, chance: 100 }] }
    }
});

let hero;
let seen;
let offs = [];

function makeHero(id) {
    const h = generateHero({ name: id });
    h.id = id;
    h.status = 'idle';
    h.hp = { current: 100, max: 100 };
    for (const s of getAllSkillIds()) h.skills[s] = { level: 60, xp: 0 };
    h.equipment = Array(9).fill(null);
    h.aggregator = new ModifierAggregator(h.id);
    return h;
}

function place(typeId, at) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, at);
    TileModifiers.rebuildAround([instance]);
    return instance;
}

const step = (n = 1) => { for (let i = 0; i < n; i++) BoardRunner.tick(100); };
function stepUntil(done, max = 2000) {
    for (let i = 0; i < max && !done(); i++) step();
    return done();
}

beforeEach(() => {
    offs.forEach(off => off());
    seen = [];
    offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_START, (p) => seen.push(['start', p.instanceId])),
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => seen.push(['complete', p.instanceId, p.recipeId ?? null])),
        EventBus.subscribe(BOARD_EVENTS.PROGRESS, (p) => seen.push(['progress', p.instanceId, p.percent]))
    ];
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    LoadoutMoments.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    hero = makeHero('hero_1');
    GameState.state.heroes = [hero];
    GameState.state.inventory.maxSlots = 50;
});

const of = (kind, id) => seen.filter(e => e[0] === kind && e[1] === id);

describe('⭐ a new recipe starts its work cycle from zero', () => {
    it('switching mid-cycle zeroes the bar, announces a start, and runs the new recipe its whole time', () => {
        const kitchen = place('fixture_kitchen', KITCHEN_AT);
        StationRecipe.setSelectedRecipe(kitchen, 'm6_slow_meal');
        Orders.orderAt(hero.id, KITCHEN_AT);
        expect(stepUntil(() => kitchen.cycleElapsedMs >= 15000)).toBe(true);
        expect(of('start', kitchen.id)).toHaveLength(1);
        expect(of('complete', kitchen.id)).toHaveLength(0);

        seen.length = 0;
        expect(StationRecipe.setSelectedRecipe(kitchen, 'm6_quick_meal')).toBe(true);
        expect(kitchen.cycleElapsedMs).toBe(0);
        expect(seen).toContainEqual(['progress', kitchen.id, 0]);

        // The next tick begins the quick recipe's own cycle, which then takes its full 8 s.
        step();
        expect(of('start', kitchen.id)).toHaveLength(1);
        step(70);
        expect(of('complete', kitchen.id)).toHaveLength(0);
        expect(stepUntil(() => of('complete', kitchen.id).length > 0, 20)).toBe(true);
        expect(InventoryManager.getItemCount('m6_meal') + SpriteLayer.countOnBoard('m6_meal')).toBe(1);
    });

    it('picking the recipe it already runs keeps the cycle', () => {
        const kitchen = place('fixture_kitchen', KITCHEN_AT);
        StationRecipe.setSelectedRecipe(kitchen, 'm6_slow_meal');
        Orders.orderAt(hero.id, KITCHEN_AT);
        step(50);
        const elapsed = kitchen.cycleElapsedMs;
        expect(elapsed).toBeGreaterThan(0);
        expect(StationRecipe.setSelectedRecipe(kitchen, 'm6_slow_meal')).toBe(true);
        expect(kitchen.cycleElapsedMs).toBe(elapsed);
    });

    it('a refused pick keeps the cycle', () => {
        const kitchen = place('fixture_kitchen', KITCHEN_AT);
        StationRecipe.setSelectedRecipe(kitchen, 'm6_slow_meal');
        kitchen.cycleElapsedMs = 5000;
        expect(StationRecipe.setSelectedRecipe(kitchen, 'not_in_the_pool')).toBe(false);
        expect(kitchen.cycleElapsedMs).toBe(5000);
    });

    it('a Field keeps its harvest: a new pick waits for the next sowing', () => {
        const field = place('m6_field', KITCHEN_AT);
        expect(StationRecipe.setSelectedRecipe(field, 'm6_crop_a')).toBe(true);
        field.cycleElapsedMs = 500;
        expect(StationRecipe.setSelectedRecipe(field, 'm6_crop_b')).toBe(true);
        expect(field.cycleElapsedMs).toBe(500);
    });

    it('a Token marked for demolition keeps its demolishing progress', () => {
        const kitchen = place('fixture_kitchen', KITCHEN_AT);
        StationRecipe.setSelectedRecipe(kitchen, 'm6_slow_meal');
        vi.spyOn(Demolition, 'isMarked').mockReturnValue(true);
        try {
            kitchen.cycleElapsedMs = 5000;
            StationRecipe.setSelectedRecipe(kitchen, 'm6_quick_meal');
            expect(kitchen.cycleElapsedMs).toBe(5000);
        } finally {
            vi.restoreAllMocks();
        }
    });
});

describe('⭐ what a hero carried for the cycle ends when they leave it', () => {
    it('recalled mid-cycle, the hero no longer carries the cycle\'s effect', () => {
        hero.equipment[0] = 'm6_watch_potion';
        InventoryManager.addItem('m6_watch_potion', 5);
        const tree = place('m6_tree', TREE_AT);
        Orders.orderAt(hero.id, TREE_AT);
        expect(stepUntil(() => tree.cycleElapsedMs >= 1000)).toBe(true);
        expect((hero.effects || []).map(e => e.effectId)).toEqual(['m6_fx_watch']);

        Orders.sendHome(hero.id);
        expect(hero.effects || []).toEqual([]);
        expect(tree.cycleElapsedMs).toBe(0);
    });

    it('ordered onto other work mid-cycle, the effect ends as they leave', () => {
        hero.equipment[0] = 'm6_watch_potion';
        InventoryManager.addItem('m6_watch_potion', 5);
        const tree = place('m6_tree', TREE_AT);
        place('fixture_kitchen', KITCHEN_AT);
        Orders.orderAt(hero.id, TREE_AT);
        expect(stepUntil(() => tree.cycleElapsedMs >= 1000)).toBe(true);
        expect((hero.effects || []).map(e => e.effectId)).toEqual(['m6_fx_watch']);

        Orders.orderAt(hero.id, KITCHEN_AT);
        expect(hero.effects || []).toEqual([]);
    });
});
