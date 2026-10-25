import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import * as HeroEffects from '../systems/hero/HeroEffects.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as ConsumptionSystem from '../systems/hero/ConsumptionSystem.js';
import { DRINK_CYCLES, ELIXIR_FIGHTS } from '../config/loopConstants.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { usedBubbleText } from '../ui/components/board/fx/matFx.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Brief 230 S6b: work consumables.
 * - A **work potion** (the Birdwatcher) is spent only when a cycle of its own skill starts, and its
 *   effect lasts that cycle: a Bird Nest when the Forestry cycle completes.
 * - A **drink** is a work buff drunk as a work cycle starts, lasting `DRINK_CYCLES` cycles from a
 *   dose saved on the hero (Coffee: faster cycles; Beer: more XP).
 * - **Nothing acts by sitting in the Bank**: a food, drink or potion's always-on rule does nothing.
 */

const TREE_AT = { x: 400, y: 400 };
const VEIN_AT = { x: 1400, y: 400 };

const forTheCycle = (effectId, skill = null) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'WORK_START', scope: 'self', ...(skill ? { skill } : {}) },
    target: { role: 'actor' },
    payload: { effectId, scale: 1, durationMs: 0, forCycle: true, chance: 100 }
});
const provides = (type, value, bucket = 'percentage') => ({
    ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket, value }, to: null
});
const grants = (itemId, chance = 100) => ({
    ...makeStatement(KEYWORD.GRANTS), payload: { type: 'BONUS_DROP', itemId, quantity: 1, chance }, to: null
});

registerEffects({
    s6b_fx_birdwatcher: { id: 's6b_fx_birdwatcher', name: 'Birdwatcher', statements: [grants('s6b_nest')] },
    s6b_fx_birdwatcher_potion: { id: 's6b_fx_birdwatcher_potion', name: 'Birdwatcher Potion', statements: [forTheCycle('s6b_fx_birdwatcher', 'forestry')] },
    s6b_fx_coffee: { id: 's6b_fx_coffee', name: 'Coffee', statements: [provides('WORK_TIME', -0.5)] },
    s6b_fx_coffee_drink: { id: 's6b_fx_coffee_drink', name: 'Coffee Drink', statements: [forTheCycle('s6b_fx_coffee')] },
    s6b_fx_beer: { id: 's6b_fx_beer', name: 'Beer', statements: [provides('XP_BONUS', 1)] },
    s6b_fx_beer_drink: { id: 's6b_fx_beer_drink', name: 'Beer Drink', statements: [forTheCycle('s6b_fx_beer')] },
    s6b_fx_mining_tea: { id: 's6b_fx_mining_tea', name: 'Mining Tea', statements: [forTheCycle('s6b_fx_coffee', 'mining')] },
    // Always on: the loophole.
    s6b_fx_haste: { id: 's6b_fx_haste', name: 'Haste', statements: [provides('WORK_TIME', -0.5)] },
    s6b_fx_might: { id: 's6b_fx_might', name: 'Might', statements: [provides('DAMAGE', 1, 'flat')] },
    s6b_fx_nest_on_start: {
        id: 's6b_fx_nest_on_start', name: 'Nest On Start',
        statements: [{ ...grants('s6b_nest'), when: { event: 'WORK_START', scope: 'self' }, chargeDelta: 0 }]
    }
});

const item = (id, equipSlot, effectId) => ({
    id, name: id, equipSlot, stackable: true, sprite: 'i_potion_shrimp_pink', ...(effectId ? { effects: [{ effectId }] } : {})
});
registerItems({
    s6b_nest: { id: 's6b_nest', name: 'Bird Nest', stackable: true },
    s6b_log: { id: 's6b_log', name: 'Log', stackable: true },
    s6b_ore: { id: 's6b_ore', name: 'Ore', stackable: true },
    s6b_birdwatcher: item('s6b_birdwatcher', 'consumable', 's6b_fx_birdwatcher_potion'),
    s6b_coffee: item('s6b_coffee', 'drink', 's6b_fx_coffee_drink'),
    s6b_beer: item('s6b_beer', 'drink', 's6b_fx_beer_drink'),
    s6b_mining_tea: item('s6b_mining_tea', 'drink', 's6b_fx_mining_tea'),
    s6b_haste_potion: item('s6b_haste_potion', 'consumable', 's6b_fx_haste'),
    s6b_haste_snack: item('s6b_haste_snack', 'food', 's6b_fx_haste'),
    s6b_haste_charm: item('s6b_haste_charm', 'trinket', 's6b_fx_haste'),
    s6b_might_potion: item('s6b_might_potion', 'consumable', 's6b_fx_might'),
    s6b_might_charm: item('s6b_might_charm', 'trinket', 's6b_fx_might'),
    s6b_nest_charm: item('s6b_nest_charm', 'trinket', 's6b_fx_nest_on_start')
});

const node = (id, skill, output) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
    requiresHero: true,
    config: { skill, skillRequired: 1, cycleTimeMs: 4000, xp: 10, inputs: [], outputs: [{ itemId: output, quantity: 1, chance: 100 }] }
});
registerTokenTypes({
    s6b_tree: node('s6b_tree', 'forestry', 's6b_log'),
    s6b_vein: node('s6b_vein', 'mining', 's6b_ore')
});

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    for (const s of getAllSkillIds()) hero.skills[s] = { level: 60, xp: 0 };
    hero.equipment = Array(9).fill(null);
    hero.aggregator = new ModifierAggregator(hero.id);
    return hero;
}

let hero;
let ticks;
let completions;
let consumed;
let offs = [];

function place(typeId, at) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, at);
    TileModifiers.rebuildAround([instance]);
    Placement.plantFlagAt(hero.id, at);
    return instance;
}

const step = () => { ticks += 1; BoardRunner.tick(100); };

/** Tick until `n` more cycles have completed (or give up). */
function untilCycles(n) {
    const target = completions.length + n;
    for (let i = 0; i < 20000 && completions.length < target; i++) step();
    expect(completions.length).toBe(target);
}

/** Ticks between the last two completions. */
const lastGap = () => completions[completions.length - 1].tick - completions[completions.length - 2].tick;
const onBoard = (itemId) => SpriteLayer.countOnBoard(itemId) + InventoryManager.getItemCount(itemId);

beforeEach(() => {
    // Subscribed before `LoadoutMoments.init`, so a completion is seen before "for the cycle" ends,
    // as every reader of a finished cycle sees it in the game.
    offs.forEach(off => off());
    ticks = 0;
    completions = [];
    consumed = [];
    offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => completions.push({ ...p, tick: ticks, effects: (hero.effects || []).map(e => e.effectId) })),
        EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, (p) => consumed.push(p))
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

describe('⭐ a work potion is spent only when a cycle of its own skill starts', () => {
    it('one Birdwatcher per Forestry cycle, and a Bird Nest as each cycle completes', () => {
        hero.equipment[0] = 's6b_birdwatcher';
        InventoryManager.addItem('s6b_birdwatcher', 5);
        place('s6b_tree', TREE_AT);
        untilCycles(3);

        expect(InventoryManager.getItemCount('s6b_birdwatcher')).toBe(2);
        expect(onBoard('s6b_nest')).toBe(3);
        expect(consumed.map(c => [c.itemId, c.dose])).toEqual(Array(3).fill(['s6b_birdwatcher', 'potion']));
        // The effect lasted each cycle: it was on at the completion, and is off after it.
        expect(completions.every(c => c.effects.includes('s6b_fx_birdwatcher'))).toBe(true);
        expect(hero.effects).toEqual([]);
    });

    it('is kept while the hero works another skill', () => {
        hero.equipment[0] = 's6b_birdwatcher';
        InventoryManager.addItem('s6b_birdwatcher', 5);
        place('s6b_vein', VEIN_AT);
        untilCycles(3);

        expect(InventoryManager.getItemCount('s6b_birdwatcher')).toBe(5);
        expect(onBoard('s6b_nest')).toBe(0);
        expect(consumed).toEqual([]);
    });

    it('does nothing, without an error, once the Bank has none', () => {
        hero.equipment[0] = 's6b_birdwatcher';
        InventoryManager.addItem('s6b_birdwatcher', 1);
        place('s6b_tree', TREE_AT);
        untilCycles(3);

        expect(InventoryManager.getItemCount('s6b_birdwatcher')).toBe(0);
        expect(onBoard('s6b_nest')).toBe(1);
        expect(consumed).toHaveLength(1);
    });

    it('raises no rule callout: a dose says itself only in the used bubble', () => {
        hero.equipment[0] = 's6b_birdwatcher';
        InventoryManager.addItem('s6b_birdwatcher', 5);
        const fired = [];
        const off = EventBus.subscribe(BOARD_EVENTS.EFFECT_FIRED, (p) => fired.push(p));
        place('s6b_tree', TREE_AT);
        untilCycles(2);
        off();
        // The Bird Nest itself is announced as it drops (a grant landing), never the potion.
        expect(fired.every(p => p.effectTitle !== 'Birdwatcher Potion')).toBe(true);
        expect(usedBubbleText(consumed[0])).toBe('s6b_birdwatcher');
    });
});

describe('⭐ a drink lasts ten work cycles', () => {
    it('is drunk at the first cycle and counts each cycle on the hero', () => {
        hero.equipment[0] = 's6b_coffee';
        InventoryManager.addItem('s6b_coffee', 3);
        place('s6b_tree', TREE_AT);
        untilCycles(1);

        expect(InventoryManager.getItemCount('s6b_coffee')).toBe(2);
        expect(hero.drinkCycles).toEqual({ s6b_coffee: DRINK_CYCLES - 1 });
        expect(consumed).toEqual([expect.objectContaining({ heroId: 'hero_1', itemId: 's6b_coffee', dose: 'drink', amount: 0 })]);
    });

    it('is ten cycles for every drink, the same number as an elixir\'s fights', () => {
        expect(DRINK_CYCLES).toBe(10);
        expect(DRINK_CYCLES).toBe(ELIXIR_FIGHTS);
    });

    it('Coffee: its cycles run at half time while the dose lasts', () => {
        hero.equipment[0] = 's6b_coffee';
        InventoryManager.addItem('s6b_coffee', 1);
        place('s6b_tree', TREE_AT);
        untilCycles(3);
        expect(lastGap()).toBe(20);

        // Ten cycles later the dose is out and the Bank is empty: back to 4 s.
        untilCycles(DRINK_CYCLES);
        expect(InventoryManager.getItemCount('s6b_coffee')).toBe(0);
        expect(hero.drinkCycles.s6b_coffee).toBe(0);
        expect(lastGap()).toBe(40);
    });

    it('drinks the next one only when the last has run out', () => {
        hero.equipment[0] = 's6b_coffee';
        InventoryManager.addItem('s6b_coffee', 5);
        place('s6b_tree', TREE_AT);
        untilCycles(DRINK_CYCLES);
        expect(InventoryManager.getItemCount('s6b_coffee')).toBe(4);
        expect(hero.drinkCycles.s6b_coffee).toBe(0);

        untilCycles(1);
        expect(InventoryManager.getItemCount('s6b_coffee')).toBe(3);
        expect(hero.drinkCycles.s6b_coffee).toBe(DRINK_CYCLES - 1);
        expect(consumed).toHaveLength(2);
    });

    it('keeps working for the rest of its ten cycles after the Bank runs dry', () => {
        hero.equipment[0] = 's6b_coffee';
        InventoryManager.addItem('s6b_coffee', 1);
        place('s6b_tree', TREE_AT);
        untilCycles(4);
        expect(InventoryManager.getItemCount('s6b_coffee')).toBe(0);
        expect(hero.drinkCycles.s6b_coffee).toBe(DRINK_CYCLES - 4);
        expect(lastGap()).toBe(20);
    });

    it('Beer: twice the XP while the dose lasts', () => {
        hero.equipment[0] = 's6b_beer';
        InventoryManager.addItem('s6b_beer', 1);
        place('s6b_tree', TREE_AT);
        untilCycles(2);
        expect(hero.skills.forestry.xp).toBe(40);
    });

    it('a drink naming Mining counts only Mining cycles', () => {
        hero.equipment[0] = 's6b_mining_tea';
        InventoryManager.addItem('s6b_mining_tea', 2);
        place('s6b_tree', TREE_AT);
        untilCycles(3);
        expect(InventoryManager.getItemCount('s6b_mining_tea')).toBe(2);
        expect(hero.drinkCycles?.s6b_mining_tea).toBeUndefined();
        expect(lastGap()).toBe(40);
    });

    it('the count is saved with the hero', () => {
        hero.equipment[0] = 's6b_coffee';
        InventoryManager.addItem('s6b_coffee', 1);
        place('s6b_tree', TREE_AT);
        untilCycles(2);
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        expect(saved.state.heroes[0].drinkCycles).toEqual({ s6b_coffee: DRINK_CYCLES - 2 });
    });

    it('a fight is not a work cycle: an elixir\'s count and a drink\'s are apart', () => {
        expect(ConsumptionSystem.workDoseOf('s6b_coffee')).toBe(DRINK_CYCLES);
        expect(ConsumptionSystem.workDoseOf('s6b_birdwatcher')).toBe(1);
        expect(ConsumptionSystem.isFightElixir('s6b_birdwatcher')).toBe(false);
        expect(ConsumptionSystem.isFightElixir('s6b_coffee')).toBe(false);
    });
});

describe('⭐ nothing acts by sitting in the Bank', () => {
    it('a potion\'s always-on Work Time does nothing, and none is spent', () => {
        hero.equipment[0] = 's6b_haste_potion';
        InventoryManager.addItem('s6b_haste_potion', 5);
        place('s6b_tree', TREE_AT);
        untilCycles(3);
        expect(lastGap()).toBe(40);
        expect(InventoryManager.getItemCount('s6b_haste_potion')).toBe(5);
    });

    it('nor does a food\'s', () => {
        hero.equipment[0] = 's6b_haste_snack';
        InventoryManager.addItem('s6b_haste_snack', 5);
        place('s6b_tree', TREE_AT);
        untilCycles(3);
        expect(lastGap()).toBe(40);
    });

    it('the same effect worn on a trinket still works (gear is not spent)', () => {
        hero.equipment[0] = 's6b_haste_charm';
        InventoryManager.addItem('s6b_haste_charm', 1);
        place('s6b_tree', TREE_AT);
        untilCycles(3);
        expect(lastGap()).toBe(20);
    });

    it('a potion\'s always-on fight number never reaches the hero either', () => {
        hero.equipment[0] = 's6b_might_potion';
        InventoryManager.addItem('s6b_might_potion', 5);
        expect(HeroEffects.loadoutCombatContributions(hero)).toEqual([]);
        hero.equipment[0] = 's6b_might_charm';
        InventoryManager.addItem('s6b_might_charm', 1);
        expect(HeroEffects.loadoutCombatContributions(hero)).toEqual([{ type: 'DAMAGE', value: 1 }]);
    });

    it('where gear and a potion share an effect, the always-on rule counts from the gear alone', () => {
        hero.equipment[0] = 's6b_haste_charm';
        hero.equipment[1] = 's6b_haste_potion';
        InventoryManager.addItem('s6b_haste_charm', 1);
        InventoryManager.addItem('s6b_haste_potion', 5);
        const [statement] = HeroEffects.loadoutStatements(hero);
        expect(statement.sourceItemIds).toEqual(['s6b_haste_charm']);
        expect(statement.scale).toBe(1);
    });
});

describe('for the cycle', () => {
    it('is bound to the Token whose cycle started: it counts there and nowhere else', () => {
        const bearer = LiveEffects.heroBearer(hero);
        LiveEffects.applyTo(bearer, { effectId: 's6b_fx_coffee', forCycle: 'tok_a' });
        expect(hero.effects).toEqual([expect.objectContaining({ effectId: 's6b_fx_coffee', forCycle: 'tok_a' })]);
        expect(LiveEffects.modifierStatements(hero, 'tok_a')).toHaveLength(1);
        expect(LiveEffects.modifierStatements(hero, 'tok_b')).toHaveLength(0);
        // Every reader without a Token (the fight's aggregator) still sees it.
        expect(LiveEffects.modifierStatements(hero)).toHaveLength(1);

        // Another Token's cycle ending leaves it; its own ends it.
        expect(LiveEffects.endCycleEffects(bearer, 'tok_b')).toBe(0);
        expect(LiveEffects.endCycleEffects(bearer, 'tok_a')).toBe(1);
        expect(hero.effects).toEqual([]);
    });

    it('never runs out by time, and a new cycle starting ends whatever the last one left', () => {
        const bearer = LiveEffects.heroBearer(hero);
        LiveEffects.applyTo(bearer, { effectId: 's6b_fx_coffee', forCycle: 'tok_a' });
        LiveEffects.tickBearer(bearer, () => {}, Number.MAX_SAFE_INTEGER - 1);
        expect(hero.effects).toHaveLength(1);
        expect(LiveEffects.endCycleEffects(bearer)).toBe(1);
    });

    it('a cycle left part-way lends nothing to the next Token', () => {
        hero.equipment[0] = 's6b_coffee';
        InventoryManager.addItem('s6b_coffee', 1);
        const tree = place('s6b_tree', TREE_AT);
        // Into the first cycle, the Coffee on, then the hero moves to the vein.
        for (let i = 0; i < 400 && !(tree.cycleElapsedMs > 0); i++) step();
        expect(hero.effects.map(e => e.forCycle)).toEqual([tree.id]);
        const vein = place('s6b_vein', VEIN_AT);
        for (let i = 0; i < 2000 && !(vein.cycleElapsedMs > 0); i++) step();
        // The vein's cycle started: the tree's Coffee is over, and the vein's is the vein's own.
        expect(hero.effects.map(e => e.forCycle)).toEqual([vein.id]);
        expect(hero.drinkCycles.s6b_coffee).toBe(DRINK_CYCLES - 2);
    });

    it('reads as a sentence, with its skill in the moment', () => {
        const names = { effect: (id) => ({ s6b_fx_birdwatcher: 'Birdwatcher', s6b_fx_coffee: 'Coffee' })[id] };
        expect(renderStatement(forTheCycle('s6b_fx_birdwatcher', 'forestry'), names))
            .toBe('On Forestry Work Start: applies Birdwatcher to the hero for the cycle.');
        expect(renderStatement(forTheCycle('s6b_fx_coffee'), names))
            .toBe('On Work Start: applies Coffee to the hero for the cycle.');
    });
});

describe('carried rules with a moment fire on their moment only', () => {
    it('a worn item\'s On Work Start grant drops once per cycle, at its start, not again at the end', () => {
        hero.equipment[0] = 's6b_nest_charm';
        InventoryManager.addItem('s6b_nest_charm', 1);
        place('s6b_tree', TREE_AT);
        untilCycles(3);
        // Three cycles started; the fourth starts on the tick after the third ends, not yet run.
        expect(onBoard('s6b_nest')).toBe(3);
    });

    it('a Token never hears On Work Start', () => {
        registerTokenTypes({
            s6b_listener: {
                id: 's6b_listener', name: 'Listener', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null,
                sprite: 's_nature', requiresHero: false,
                statements: [{ ...grants('s6b_nest'), id: 'stm_s6b_listener', when: { event: 'WORK_START', scope: 'self' }, chargeDelta: 0 }]
            }
        });
        TriggerSystem.init();
        const listener = BoardState.createTokenInstance('s6b_listener', null);
        Placement.placeTokenAt(listener, { x: TREE_AT.x + 150, y: TREE_AT.y });
        place('s6b_tree', TREE_AT);
        untilCycles(2);
        expect(onBoard('s6b_nest')).toBe(0);
        TriggerSystem.teardown();
    });
});
