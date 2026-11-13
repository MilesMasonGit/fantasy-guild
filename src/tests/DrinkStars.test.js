import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
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
import * as HallRules from '../systems/progression/HallRules.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { HALL_NODE, getUpgradeDef } from '../config/guildUpgrades.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { makeStatement, KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as ConsumptionSystem from '../systems/hero/ConsumptionSystem.js';
import * as CombatFormulas from '../systems/combat/CombatFormulas.js';
import { carriedKindOf } from '../systems/hero/carriedKind.js';
import { DOSE, DOSE_LENGTH, lastingDoseLength } from '../systems/core/consumableRule.js';
import { DRINK_CYCLES, ELIXIR_FIGHTS } from '../config/loopConstants.js';
import { strengthenStatement } from '../systems/effects/effectLibrary.js';
import { getPaletteEntry, isDoseKindScope } from '../config/registries/modifierPalette.js';
import { CARRIED_KIND } from '../config/registries/carriedKinds.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { hallRuleSentence, starAmount, starSentence } from '../systems/progression/hallStarText.js';
import { hallStarFindings } from '../systems/core/hallStarRule.js';
import { tagExplanation } from '../ui/components/drawer/itemTags.js';
import { gearEffects } from '../ui/components/dock/heroCombatStats.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Long-lasting Brews and Strong Drink (brief 620 E3): two Guild Hall star effects on what a hero
 * drinks. Long-lasting Brews makes a fresh dose last longer (a drink's and a work potion's work
 * cycles, a fight elixir's fights); Strong Drink makes the modifiers a dose's effects give stronger,
 * a percentage on each. Each may name one kind of dose: drinks, potions or fight elixirs.
 */

const TREE_AT = { x: 400, y: 400 };
const ENEMY_AT = { x: 1400, y: 400 };

const forTheCycle = (effectId, skill = null) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'WORK_START', scope: 'self', ...(skill ? { skill } : {}) },
    target: { role: 'actor' },
    payload: { effectId, scale: 1, durationMs: 0, forCycle: true, chance: 100 }
});
const forTheFight = (effectId) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'COMBAT_ENGAGED', scope: 'self' },
    target: { role: 'actor' },
    payload: { effectId, scale: 1, durationMs: 0, forFight: true, chance: 100 }
});
const provides = (type, value, bucket = 'percentage') => ({
    ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket, value }, to: null
});
const grants = (itemId, chance) => ({
    ...makeStatement(KEYWORD.GRANTS), payload: { type: 'BONUS_DROP', itemId, quantity: 1, chance }, to: null
});

registerEffects({
    ds_fx_merry: { id: 'ds_fx_merry', name: 'Merry', statements: [provides('XP_BONUS', 1)] },
    ds_fx_beer_drink: { id: 'ds_fx_beer_drink', name: 'Beer Drink', statements: [forTheCycle('ds_fx_merry')] },
    ds_fx_lucky: { id: 'ds_fx_lucky', name: 'Lucky Splash', statements: [provides('LOOT_MULT', 60, 'flat')] },
    ds_fx_lucky_drink: { id: 'ds_fx_lucky_drink', name: 'Lucky Water', statements: [forTheCycle('ds_fx_lucky')] },
    ds_fx_birdwatcher: { id: 'ds_fx_birdwatcher', name: 'Birdwatcher', statements: [grants('ds_nest', 100)] },
    ds_fx_birdwatcher_potion: { id: 'ds_fx_birdwatcher_potion', name: 'Birdwatcher Potion', statements: [forTheCycle('ds_fx_birdwatcher', 'forestry')] },
    ds_fx_valor: { id: 'ds_fx_valor', name: 'Valor', statements: [provides('DAMAGE', 1, 'flat')] },
    ds_fx_elixir_valor: { id: 'ds_fx_elixir_valor', name: 'Elixir of Valor', statements: [forTheFight('ds_fx_valor')] }
});

const item = (id, equipSlot, effectId, extra = {}) => ({
    id, name: id, equipSlot, stackable: true, sprite: 'i_potion_shrimp_pink', ...(effectId ? { effects: [{ effectId }] } : {}), ...extra
});
registerItems({
    ds_nest: { id: 'ds_nest', name: 'Bird Nest', stackable: true },
    ds_log: { id: 'ds_log', name: 'Log', stackable: true },
    ds_beer: item('ds_beer', 'drink', 'ds_fx_beer_drink', { name: 'Beer' }),
    ds_lucky: item('ds_lucky', 'drink', 'ds_fx_lucky_drink'),
    ds_birdwatcher: item('ds_birdwatcher', 'consumable', 'ds_fx_birdwatcher_potion'),
    ds_valor: item('ds_valor', 'consumable', 'ds_fx_elixir_valor', { name: 'Valor Elixir' })
});

registerTokenTypes({
    ds_tree: {
        id: 'ds_tree', name: 'ds_tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        requiresHero: true,
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 4000, xp: 10, inputs: [], outputs: [{ itemId: 'ds_log', quantity: 1, chance: 100 }] }
    }
});

let seq = 0;
/** A star rank's rule. `category` names a kind of dose: drink, potion or elixir. */
const rule = (type, value, { bucket = 'percentage', category } = {}) => ({
    id: `stm_ds_${++seq}`, keyword: KEYWORD.PROVIDES,
    payload: { type, bucket, value, ...(category ? { category } : {}) },
    chargeDelta: 0, to: { mode: 'all', value: '' }, reach: 'board', target: null, when: null, upkeep: null
});
const brews = (value, options) => rule(EFFECT_TYPES.LONG_LASTING_BREWS, value, options);
const strong = (value, options) => rule(EFFECT_TYPES.STRONG_DRINK, value, options);

/** A sky of one star on the Hearth with one rank per list of rules. */
function sky(ranks) {
    return {
        constellations: {},
        stars: {
            ds_star: {
                id: 'ds_star', constellation: 'hearth', name: 'Brewer', node: { x: 0, y: -2.6 }, links: [HALL_NODE],
                ranks: ranks.map(rules => ({ tier: 1, price: [{ itemId: 'item_oak_wood', quantity: 5 }], rules, lines: [] }))
            }
        }
    };
}

/** Put `rules` in force as a held star rank (rank 0: authored but not bought). */
function holdStar(rules, rank = 1) {
    registerHallSky(sky([rules]));
    HallRules.apply({ ds_star: rank });
}

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
let completions;
let engagements;
let consumed;
let offs = [];

const step = () => BoardRunner.tick(100);

function work(typeId = 'ds_tree', at = TREE_AT) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, at);
    TileModifiers.rebuildAround([instance]);
    Orders.orderAt(hero.id, at);
    return instance;
}

function fight() {
    const instance = BoardState.createTokenInstance('fixture_enemy', tokenStartingUses('fixture_enemy'));
    Placement.placeTokenAt(instance, ENEMY_AT);
    TileModifiers.rebuildAround([instance]);
    Orders.orderAt(hero.id, ENEMY_AT);
    return instance;
}

function untilCycles(n) {
    const target = completions.length + n;
    for (let i = 0; i < 40000 && completions.length < target; i++) step();
    expect(completions.length).toBe(target);
}

function untilEngagements(n) {
    const target = engagements.length + n;
    for (let i = 0; i < 40000 && engagements.length < target; i++) step();
    expect(engagements.length).toBe(target);
}

const onBoard = (itemId) => SpriteLayer.countOnBoard(itemId) + InventoryManager.getItemCount(itemId);

beforeEach(() => {
    offs.forEach(off => off());
    completions = [];
    engagements = [];
    consumed = [];
    offs = [
        EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => completions.push({ ...p, effects: (hero.effects || []).map(e => ({ ...e })) })),
        EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, (p) => engagements.push(p)),
        EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, (p) => consumed.push(p))
    ];

    GameState.initNew();
    registerHallSky(null);
    HallRules.apply({});
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
afterEach(() => {
    registerHallSky(null);
    HallRules.apply({});
});
afterAll(() => HallRules.teardown());

describe('⭐ Long-lasting Brews: a fresh dose lasts longer', () => {
    it('with no star a dose lasts what it always has', () => {
        expect(ConsumptionSystem.doseLength(DOSE.DRINK)).toBe(DRINK_CYCLES);
        expect(ConsumptionSystem.doseLength(DOSE.ELIXIR)).toBe(ELIXIR_FIGHTS);
        expect(ConsumptionSystem.doseLength(DOSE.POTION)).toBe(1);
    });

    it('at +100 % from a Hall star a drink lasts twenty work cycles, one Beer for all twenty', () => {
        holdStar([brews(1)]);
        expect(ConsumptionSystem.doseLength(DOSE.DRINK)).toBe(2 * DRINK_CYCLES);

        hero.equipment[0] = 'ds_beer';
        InventoryManager.addItem('ds_beer', 3);
        work();
        untilCycles(1);
        expect(InventoryManager.getItemCount('ds_beer')).toBe(2);
        expect(hero.drinkCycles).toEqual({ ds_beer: 2 * DRINK_CYCLES - 1 });

        untilCycles(2 * DRINK_CYCLES - 1);
        expect(InventoryManager.getItemCount('ds_beer')).toBe(2);
        expect(hero.drinkCycles.ds_beer).toBe(0);
        // Every one of the twenty cycles had the Beer's effect on.
        expect(completions.every(c => c.effects.some(e => e.effectId === 'ds_fx_merry'))).toBe(true);

        untilCycles(1);
        expect(InventoryManager.getItemCount('ds_beer')).toBe(1);
        expect(consumed).toHaveLength(2);
    });

    it('at 0 % a drink lasts ten, as with no star; a star not yet bought gives nothing', () => {
        holdStar([brews(0)]);
        expect(ConsumptionSystem.doseLength(DOSE.DRINK)).toBe(DRINK_CYCLES);
        holdStar([brews(1)], 0);
        expect(ConsumptionSystem.doseLength(DOSE.DRINK)).toBe(DRINK_CYCLES);

        hero.equipment[0] = 'ds_beer';
        InventoryManager.addItem('ds_beer', 3);
        work();
        untilCycles(1);
        expect(hero.drinkCycles).toEqual({ ds_beer: DRINK_CYCLES - 1 });
    });

    it('a fight elixir lasts longer in fights: +100 % is twenty fights a dose', () => {
        holdStar([brews(1)]);
        hero.equipment[0] = 'ds_valor';
        InventoryManager.addItem('ds_valor', 3);
        fight();
        untilEngagements(1);
        expect(InventoryManager.getItemCount('ds_valor')).toBe(2);
        expect(hero.elixirFights).toEqual({ ds_valor: 2 * ELIXIR_FIGHTS - 1 });
    });

    it('a work potion lasts more than its one cycle: +100 % on potions is two Forestry cycles a potion', () => {
        holdStar([brews(1, { category: CARRIED_KIND.POTION })]);
        expect(ConsumptionSystem.doseLength(DOSE.POTION)).toBe(2);

        hero.equipment[0] = 'ds_birdwatcher';
        InventoryManager.addItem('ds_birdwatcher', 5);
        work();
        untilCycles(4);
        expect(InventoryManager.getItemCount('ds_birdwatcher')).toBe(3);
        // Its effect was on for all four cycles: a nest each.
        expect(onBoard('ds_nest')).toBe(4);
        // Still a potion, not a drink, though it now lasts more than one cycle.
        expect(consumed.map(c => c.dose)).toEqual(['potion', 'potion']);
        expect(carriedKindOf('ds_birdwatcher')).toBe(CARRIED_KIND.POTION);
        expect(hero.drinkCycles).toEqual({ ds_birdwatcher: 0 });
    });

    it('narrowed to one kind, it lengthens that kind only', () => {
        holdStar([brews(1, { category: CARRIED_KIND.DRINK })]);
        expect([DOSE.DRINK, DOSE.POTION, DOSE.ELIXIR].map(ConsumptionSystem.doseLength)).toEqual([20, 1, 10]);
        holdStar([brews(1, { category: CARRIED_KIND.ELIXIR })]);
        expect([DOSE.DRINK, DOSE.POTION, DOSE.ELIXIR].map(ConsumptionSystem.doseLength)).toEqual([10, 1, 20]);
        // A narrowing that names no kind of dose reaches nothing.
        holdStar([brews(1, { category: 'mining' })]);
        expect([DOSE.DRINK, DOSE.POTION, DOSE.ELIXIR].map(ConsumptionSystem.doseLength)).toEqual([10, 1, 10]);
    });

    it('a flat rule adds whole cycles and fights', () => {
        holdStar([brews(3, { bucket: 'flat' })]);
        expect([DOSE.DRINK, DOSE.POTION, DOSE.ELIXIR].map(ConsumptionSystem.doseLength)).toEqual([13, 4, 13]);
    });

    it('a whole length draws no random number', () => {
        const never = vi.fn(() => { throw new Error('drew a random number'); });
        expect(lastingDoseLength(10, 10, never)).toBe(10);
        expect(lastingDoseLength(10, 11, never)).toBe(11);
        // Float error is not a fraction: +10 % on 10 is 11, however the sum comes out.
        expect(lastingDoseLength(10, 10 * 1.1, never)).toBe(11);
        expect(lastingDoseLength(10, 11 - 1e-12, never)).toBe(11);
        expect(lastingDoseLength(10, Number.NaN, never)).toBe(10);
        expect(never).not.toHaveBeenCalled();
        holdStar([brews(0.1)]);
        expect(ConsumptionSystem.rollDoseLength(DOSE.DRINK, never)).toBe(11);
        expect(never).not.toHaveBeenCalled();
    });

    it('a fractional length rounds by chance, both ways: 3.6 is 4 under 0.6 and 3 above it', () => {
        expect(lastingDoseLength(3, 3.6, () => 0)).toBe(4);
        expect(lastingDoseLength(3, 3.6, () => 0.59)).toBe(4);
        // 3.6 - 3 is a hair over 0.6 in floating point, so the first draw that rolls down is above it.
        expect(lastingDoseLength(3, 3.6, () => 0.61)).toBe(3);
        expect(lastingDoseLength(3, 3.6, () => 0.99)).toBe(3);
        let draws = 0;
        lastingDoseLength(3, 3.6, () => { draws++; return 0.5; });
        expect(draws).toBe(1);

        holdStar([brews(0.05, { category: CARRIED_KIND.DRINK })]);
        expect(ConsumptionSystem.doseLength(DOSE.DRINK)).toBeCloseTo(10.5, 9);
        expect(ConsumptionSystem.rollDoseLength(DOSE.DRINK, () => 0.49)).toBe(11);
        expect(ConsumptionSystem.rollDoseLength(DOSE.DRINK, () => 0.5)).toBe(10);
        // A kind the star does not reach stays whole and draws nothing.
        expect(ConsumptionSystem.rollDoseLength(DOSE.POTION, () => { throw new Error('drew'); })).toBe(1);
    });

    it('a dose always lasts at least one', () => {
        const never = () => { throw new Error('drew a random number'); };
        expect(lastingDoseLength(10, 0, never)).toBe(1);
        expect(lastingDoseLength(10, -4, never)).toBe(1);
        // Below one is one before any roll: a 0.4 never comes out as 0.
        expect(lastingDoseLength(1, 0.4, never)).toBe(1);
        holdStar([brews(-0.6, { category: CARRIED_KIND.POTION })]);
        expect(ConsumptionSystem.doseLength(DOSE.POTION)).toBe(1);
        expect(ConsumptionSystem.rollDoseLength(DOSE.POTION, never)).toBe(1);
    });

    it('a hero starting a dose of fractional length rolls its count', () => {
        holdStar([brews(0.05)]);
        hero.equipment[0] = 'ds_beer';
        InventoryManager.addItem('ds_beer', 3);
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.4);
        work();
        untilCycles(1);
        spy.mockRestore();
        expect(hero.drinkCycles).toEqual({ ds_beer: 11 - 1 });
    });

    it('a hero starting a dose of fractional length may roll it down', () => {
        holdStar([brews(0.05)]);
        hero.equipment[0] = 'ds_valor';
        InventoryManager.addItem('ds_valor', 3);
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.6);
        fight();
        untilEngagements(1);
        spy.mockRestore();
        expect(hero.elixirFights).toEqual({ ds_valor: 10 - 1 });
    });

    it('what the game shows never draws: the exact length, read as 10–11', () => {
        holdStar([brews(0.05)]);
        hero.equipment[0] = 'ds_beer';
        hero.equipment[1] = 'ds_valor';
        InventoryManager.addItem('ds_beer', 1);
        InventoryManager.addItem('ds_valor', 1);
        const spy = vi.spyOn(Math, 'random');
        expect(ConsumptionSystem.doseLength(DOSE.DRINK)).toBeCloseTo(10.5, 9);
        expect(ConsumptionSystem.doseLengthText(DOSE.DRINK)).toBe('10–11');
        // A star on every kind: a potion's one cycle at +5 % is 1.05.
        expect(ConsumptionSystem.doseLengthText(DOSE.POTION)).toBe('1–2');
        expect(ConsumptionSystem.workDoseOf('ds_beer')).toBeCloseTo(10.5, 9);
        expect(tagExplanation('Drink')).toContain('one lasts 10–11 work cycles');
        expect(tagExplanation('Elixir')).toContain('one lasts 10–11 fights');
        const lines = gearEffects(hero).find(e => e.id === 'ds_fx_beer_drink').lines;
        expect(lines).toContain('One lasts 10–11 work cycles, with Long-lasting Brews.');
        const calls = spy.mock.calls.length;
        spy.mockRestore();
        expect(calls).toBe(0);
    });

    it('a star bought mid-dose lengthens the next dose, not the one under way', () => {
        hero.equipment[0] = 'ds_beer';
        InventoryManager.addItem('ds_beer', 3);
        work();
        untilCycles(3);
        expect(hero.drinkCycles.ds_beer).toBe(DRINK_CYCLES - 3);
        holdStar([brews(1)]);
        untilCycles(DRINK_CYCLES - 3);
        expect(hero.drinkCycles.ds_beer).toBe(0);
        untilCycles(1);
        expect(hero.drinkCycles.ds_beer).toBe(2 * DRINK_CYCLES - 1);
    });
});

describe('⭐ Strong Drink: a dose\'s effects are stronger', () => {
    it('at +100 % from a Hall star Beer\'s +100 % XP becomes +200 %', () => {
        holdStar([strong(1)]);
        expect(ConsumptionSystem.doseStrength(DOSE.DRINK)).toBe(2);
        hero.equipment[0] = 'ds_beer';
        InventoryManager.addItem('ds_beer', 1);
        work();
        untilCycles(2);
        // 10 XP a cycle, three times over.
        expect(hero.skills.forestry.xp).toBe(60);
    });

    it('at 0 % Beer gives what it always has, and its effect carries no boost', () => {
        holdStar([strong(0)]);
        expect(ConsumptionSystem.doseStrength(DOSE.DRINK)).toBe(1);
        hero.equipment[0] = 'ds_beer';
        InventoryManager.addItem('ds_beer', 1);
        work();
        untilCycles(2);
        expect(hero.skills.forestry.xp).toBe(40);
        expect(completions.every(c => c.effects.every(e => !('boost' in e)))).toBe(true);
    });

    it('a fight elixir hits harder: Valor\'s +1 Damage is +1.5 at +50 %', () => {
        holdStar([strong(0.5)]);
        hero.equipment[0] = 'ds_valor';
        const before = CombatFormulas.heroBaseDamage(hero);
        InventoryManager.addItem('ds_valor', 1);
        fight();
        untilEngagements(1);
        expect(hero.effects.map(e => e.effectId)).toEqual(['ds_fx_valor']);
        expect(CombatFormulas.heroBaseDamage(hero)).toBeCloseTo(before + 1.5, 9);
    });

    it('narrowed to drinks, it leaves a fight elixir as it is', () => {
        holdStar([strong(1, { category: CARRIED_KIND.DRINK })]);
        expect([DOSE.DRINK, DOSE.POTION, DOSE.ELIXIR].map(ConsumptionSystem.doseStrength)).toEqual([2, 1, 1]);
        hero.equipment[0] = 'ds_valor';
        const before = CombatFormulas.heroBaseDamage(hero);
        InventoryManager.addItem('ds_valor', 1);
        fight();
        untilEngagements(1);
        expect(CombatFormulas.heroBaseDamage(hero)).toBe(before + 1);
    });

    it('narrowed to elixirs, it leaves a drink as it is', () => {
        holdStar([strong(1, { category: CARRIED_KIND.ELIXIR })]);
        hero.equipment[0] = 'ds_beer';
        InventoryManager.addItem('ds_beer', 1);
        work();
        untilCycles(2);
        expect(hero.skills.forestry.xp).toBe(40);
    });

    it('a chance is held at 100 %: Lucky Water\'s 60 % double loot doubled is 100 %', () => {
        holdStar([strong(1)]);
        hero.equipment[0] = 'ds_lucky';
        InventoryManager.addItem('ds_lucky', 1);
        work();
        untilCycles(1);
        const lucky = completions[0].effects.find(e => e.effectId === 'ds_fx_lucky');
        expect(lucky.boost).toBe(2);
        const [statement] = LiveEffects.liveStatements({ effects: [lucky] });
        expect(statement.payload.value).toBe(100);
    });

    it('a grant is not a modifier: Birdwatcher\'s nest comes as it always has', () => {
        holdStar([strong(1)]);
        const [grant] = LiveEffects.liveStatements({ effects: [{ effectId: 'ds_fx_birdwatcher', scale: 1, boost: 2 }] });
        expect(grant.payload).toEqual(expect.objectContaining({ chance: 100, quantity: 1 }));
    });

    it('strengthens only a Provides rule\'s number, and never a stack limit, a switch or a grant', () => {
        const at = (type, value, bucket = 'flat') => strengthenStatement(provides(type, value, bucket), 1.5).payload.value;
        expect(at(EFFECT_TYPES.XP_BONUS, 0.1, 'percentage')).toBeCloseTo(0.15, 12);
        expect(at(EFFECT_TYPES.WORK_TIME, -0.2, 'percentage')).toBeCloseTo(-0.3, 12);
        expect(at(EFFECT_TYPES.LOOT_MULT, 80)).toBe(100);
        expect(at(EFFECT_TYPES.STATUS_MAX_STACKS, -1)).toBe(-1);
        expect(at(EFFECT_TYPES.STATUS_IMMUNITY, 1)).toBe(1);
        const grant = grants('ds_nest', 25);
        expect(strengthenStatement(grant, 1.5)).toBe(grant);
        const plain = provides(EFFECT_TYPES.YIELD, 0.1);
        expect(strengthenStatement(plain, 1)).toBe(plain);
    });
});

describe('⭐ no change when no rule offers either', () => {
    it('draws no random number of its own: the same draws with the stars as without', () => {
        const draws = (rules) => {
            if (rules) holdStar(rules);
            hero.equipment[0] = 'ds_beer';
            InventoryManager.addItem('ds_beer', 2);
            const spy = vi.spyOn(Math, 'random');
            work();
            untilCycles(12);
            const n = spy.mock.calls.length;
            spy.mockRestore();
            return n;
        };
        const plain = draws(null);
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        hero = makeHero('hero_1');
        GameState.state.heroes = [hero];
        GameState.state.inventory.maxSlots = 50;
        completions = [];
        expect(draws([brews(1), strong(1)])).toBe(plain);
    });

    it('with no star, a fresh dose writes what it always wrote', () => {
        hero.equipment[0] = 'ds_birdwatcher';
        hero.equipment[1] = 'ds_beer';
        InventoryManager.addItem('ds_birdwatcher', 5);
        InventoryManager.addItem('ds_beer', 5);
        work();
        untilCycles(3);
        // A potion keeps no count; a drink's is its ten less the cycles run.
        expect(hero.drinkCycles).toEqual({ ds_beer: DRINK_CYCLES - 3 });
        expect(consumed.map(c => c.dose)).toEqual(['potion', 'drink', 'potion', 'potion']);
    });
});

describe('the rules are guild-only, narrowed by the kind of dose', () => {
    it('two palette rows, offered to no Token or item editor', () => {
        for (const type of [EFFECT_TYPES.LONG_LASTING_BREWS, EFFECT_TYPES.STRONG_DRINK]) {
            const entry = getPaletteEntry(type);
            expect(entry.guildOnly).toBe(true);
            expect(entry.categories).toBe('doseKind');
            expect(paletteForKeyword(KEYWORD.PROVIDES).some(e => e.type === type)).toBe(false);
        }
        expect(getPaletteEntry(EFFECT_TYPES.LONG_LASTING_BREWS).label).toBe('Long-lasting Brews');
        expect(getPaletteEntry(EFFECT_TYPES.STRONG_DRINK).label).toBe('Strong Drink');
    });

    it('a dose kind is a carried kind, so one id names both', () => {
        expect([DOSE.DRINK, DOSE.POTION, DOSE.ELIXIR]).toEqual([CARRIED_KIND.DRINK, CARRIED_KIND.POTION, CARRIED_KIND.ELIXIR]);
        expect(Object.keys(DOSE_LENGTH).sort()).toEqual([DOSE.DRINK, DOSE.ELIXIR, DOSE.POTION].sort());
        expect(['', undefined, 'drink', 'potion', 'elixir'].every(isDoseKindScope)).toBe(true);
        expect(['mining', 'food', 'ammo'].some(isDoseKindScope)).toBe(false);
    });

    it('the boot audit names a star rule narrowed to something that is no kind of dose', () => {
        const findings = hallStarFindings({ sky: sky([[brews(0.1, { category: 'mining' })], [strong(0.1, { category: 'food' })]]), items: { item_oak_wood: {} } });
        const lines = findings.filter(f => f.entityId === 'ds_star').map(f => f.message);
        expect(lines).toEqual([
            expect.stringMatching(/rank 1 has a Long-lasting Brews rule narrowed to "mining", which is no kind of dose/),
            expect.stringMatching(/rank 2 has a Strong Drink rule narrowed to "food", which is no kind of dose/)
        ]);
        expect(hallStarFindings({ sky: sky([[brews(0.1, { category: 'drink' }), strong(0.1)]]), items: { item_oak_wood: {} } })
            .filter(f => f.entityId === 'ds_star')).toEqual([]);
    });
});

describe('⭐ the words say the longer and stronger numbers', () => {
    it('a star rule reads as a sentence', () => {
        const names = { carried: false };
        expect(renderStatement(brews(0.1), names)).toBe('Makes every hero\'s drinks, potions and fight elixirs last 10% longer.');
        expect(renderStatement(brews(0.1, { category: 'drink' }), names)).toBe('Makes every hero\'s drinks last 10% longer.');
        expect(renderStatement(brews(2, { bucket: 'flat', category: 'elixir' }), names)).toBe('Makes every hero\'s fight elixirs last 2 more fights.');
        expect(renderStatement(brews(1, { bucket: 'flat', category: 'potion' }), names)).toBe('Makes every hero\'s potions last 1 more cycle.');
        expect(renderStatement(brews(2, { bucket: 'flat' }), names)).toBe('Makes every hero\'s drinks, potions and fight elixirs last 2 more cycles or fights.');
        expect(renderStatement(strong(0.2), names)).toBe('Makes the effects of every hero\'s drinks, potions and fight elixirs 20% stronger.');
        expect(renderStatement(strong(0.2, { category: 'elixir' }), names)).toBe('Makes the effects of every hero\'s fight elixirs 20% stronger.');
    });

    it('a Hall star says what it does and its amount', () => {
        expect(hallRuleSentence(brews(0.1, { category: 'drink' }))).toBe('Makes every hero\'s drinks last 10% longer.');
        registerHallSky(sky([[brews(0.1)], [brews(0.2)]]));
        const def = getUpgradeDef('ds_star');
        expect(starSentence(def)).toBe('Every hero\'s drinks, potions and fight elixirs last longer.');
        expect(starAmount(def, 1)).toBe('10% longer');
        expect(starAmount(def, 2)).toBe('20% longer');
        registerHallSky(sky([[strong(0.05, { category: 'drink' })]]));
        expect(starSentence(getUpgradeDef('ds_star'))).toBe('The effects of every hero\'s drinks are stronger.');
        expect(starAmount(getUpgradeDef('ds_star'), 1)).toBe('5% stronger');
    });

    it('the Drink and Elixir tags say how long one lasts now', () => {
        expect(tagExplanation('Drink')).toContain('one lasts 10 work cycles');
        expect(tagExplanation('Elixir')).toContain('one lasts 10 fights');
        holdStar([brews(1, { category: 'drink' })]);
        expect(tagExplanation('Drink')).toContain('one lasts 20 work cycles');
        expect(tagExplanation('Elixir')).toContain('one lasts 10 fights');
    });

    it('the hero\'s Gear effects tooltip shows the longer dose and the stronger numbers, and nothing extra without a star', () => {
        hero.equipment[0] = 'ds_beer';
        hero.equipment[1] = 'ds_valor';
        InventoryManager.addItem('ds_beer', 1);
        InventoryManager.addItem('ds_valor', 1);
        const plain = gearEffects(hero);
        const linesOf = (list, id) => list.find(e => e.id === id).lines;
        // The item's own rule, one line each, as the tooltip has always read.
        expect(linesOf(plain, 'ds_fx_beer_drink')).toHaveLength(1);
        expect(linesOf(plain, 'ds_fx_elixir_valor')).toHaveLength(1);

        holdStar([brews(1), strong(0.5)]);
        const boosted = gearEffects(hero);
        expect(linesOf(boosted, 'ds_fx_beer_drink')).toEqual([
            ...linesOf(plain, 'ds_fx_beer_drink'),
            'One lasts 20 work cycles, with Long-lasting Brews.',
            'Merry, 50% stronger with Strong Drink: Gives the hero 150% more XP.'
        ]);
        expect(linesOf(boosted, 'ds_fx_elixir_valor')).toEqual([
            ...linesOf(plain, 'ds_fx_elixir_valor'),
            'One lasts 20 fights, with Long-lasting Brews.',
            'Valor, 50% stronger with Strong Drink: Gives the hero 1.5 more damage in combat.'
        ]);
    });
});
