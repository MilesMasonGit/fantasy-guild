import { describe, it, expect, beforeEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import * as CombatFormulas from '../utils/CombatFormulas.js';
import * as ConsumptionSystem from '../systems/hero/ConsumptionSystem.js';
import { ELIXIR_FIGHTS } from '../config/loopConstants.js';
import { renderStatement } from '../systems/effects/statementText.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Elixirs: an elixir is drunk as a fight starts and lasts ten fights; every equipped elixir type
 * works at once; a type is drunk again when its last dose runs out. Its rule is an ordinary
 * carried rule on the fight-start moment ("When a fight starts, applies Valor to the hero for the
 * fight").
 */

const SPOT = { x: 400, y: 400 };

/** The rule an elixir carries: put a library effect on its hero for the fight. */
const forTheFight = (effectId) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'COMBAT_ENGAGED', scope: 'self' },
    payload: { effectId, scale: 1, durationMs: 0, forFight: true, chance: 100 }
});

const provides = (type, value) => ({
    ...makeStatement(KEYWORD.PROVIDES),
    payload: { type, bucket: 'flat', value },
    to: null
});

registerEffects({
    fx_valor: { id: 'fx_valor', name: 'Valor', statements: [provides('DAMAGE', 1)] },
    fx_ironskin: { id: 'fx_ironskin', name: 'Ironskin', statements: [provides('ARMOR', 1)] },
    fx_elixir_valor: { id: 'fx_elixir_valor', name: 'Elixir of Valor', statements: [forTheFight('fx_valor')] },
    fx_elixir_ironskin: { id: 'fx_elixir_ironskin', name: 'Elixir of Ironskin', statements: [forTheFight('fx_ironskin')] }
});

registerItems({
    elixir_valor: { id: 'elixir_valor', name: 'Valor', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'fx_elixir_valor' }] },
    elixir_ironskin: { id: 'elixir_ironskin', name: 'Ironskin', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'fx_elixir_ironskin' }] },
    // A consumable with no fight rule (a work potion): never drunk by a fight.
    potion_work: { id: 'potion_work', name: 'Work Potion', equipSlot: 'consumable', stackable: true },
    fixture_bread: { id: 'fixture_bread', name: 'Bread', equipSlot: 'food', stackable: true, restoreAmount: 5 },
    fixture_ale: { id: 'fixture_ale', name: 'Ale', equipSlot: 'drink', stackable: true, restoreAmount: 5 }
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
let engagements;
let consumed;
let offs = [];

function placeEnemy(heroId = 'hero_1') {
    const instance = BoardState.createTokenInstance('fixture_enemy', tokenStartingUses('fixture_enemy'));
    Placement.placeTokenAt(instance, SPOT);
    TileModifiers.rebuildAround([instance]);
    if (heroId) Placement.plantFlagAt(heroId, SPOT);
    return instance;
}

const step = () => BoardRunner.tick(100);

/** Tick until `n` more engagements have happened (or give up). */
function untilEngagements(n) {
    const target = engagements.length + n;
    for (let i = 0; i < 20000 && engagements.length < target; i++) step();
    expect(engagements.length).toBe(target);
}

beforeEach(() => {
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

    offs.forEach(off => off());
    engagements = [];
    consumed = [];
    offs = [
        EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, (p) => engagements.push(p)),
        EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, (p) => consumed.push(p))
    ];
});

describe('an elixir is drunk as a fight starts and lasts ten fights', () => {
    it('drinks one at the first fight and counts the fight', () => {
        hero.equipment[0] = 'elixir_valor';
        InventoryManager.addItem('elixir_valor', 3);
        placeEnemy();
        untilEngagements(1);

        expect(InventoryManager.getItemCount('elixir_valor')).toBe(2);
        expect(hero.elixirFights).toEqual({ elixir_valor: ELIXIR_FIGHTS - 1 });
        expect(consumed).toEqual([expect.objectContaining({ heroId: 'hero_1', itemId: 'elixir_valor', elixir: true })]);
    });

    it('is ten fights for every elixir', () => {
        expect(ELIXIR_FIGHTS).toBe(10);
    });

    it('gives its effect for the fight: Valor adds 1 to every hit', () => {
        hero.equipment[0] = 'elixir_valor';
        const before = CombatFormulas.heroBaseDamage(hero);
        InventoryManager.addItem('elixir_valor', 1);
        placeEnemy();
        untilEngagements(1);

        expect(hero.effects.map(e => e.effectId)).toEqual(['fx_valor']);
        expect(CombatFormulas.heroBaseDamage(hero)).toBe(before + 1);
    });

    it('works every equipped type at once, and their effects stack', () => {
        hero.equipment[0] = 'elixir_valor';
        hero.equipment[1] = 'elixir_ironskin';
        InventoryManager.addItem('elixir_valor', 1);
        InventoryManager.addItem('elixir_ironskin', 1);
        const damage = CombatFormulas.heroBaseDamage(hero);
        const armour = CombatFormulas.heroFlatArmor(hero);
        placeEnemy();
        untilEngagements(1);

        expect(CombatFormulas.heroBaseDamage(hero)).toBe(damage + 1);
        expect(CombatFormulas.heroFlatArmor(hero)).toBe(armour + 1);
        expect(InventoryManager.getItemCount('elixir_valor')).toBe(0);
        expect(InventoryManager.getItemCount('elixir_ironskin')).toBe(0);
        expect(hero.elixirFights).toEqual({ elixir_valor: ELIXIR_FIGHTS - 1, elixir_ironskin: ELIXIR_FIGHTS - 1 });
    });

    it('drinks the next one only when the last has run out: after ten fights', () => {
        hero.equipment[0] = 'elixir_valor';
        InventoryManager.addItem('elixir_valor', 5);
        placeEnemy();
        untilEngagements(ELIXIR_FIGHTS);
        expect(InventoryManager.getItemCount('elixir_valor')).toBe(4);
        expect(hero.elixirFights.elixir_valor).toBe(0);
        // The tenth fight still had it.
        expect(hero.effects.map(e => e.effectId)).toEqual(['fx_valor']);

        untilEngagements(1);
        expect(InventoryManager.getItemCount('elixir_valor')).toBe(3);
        expect(hero.elixirFights.elixir_valor).toBe(ELIXIR_FIGHTS - 1);
        expect(consumed.filter(c => c.elixir)).toHaveLength(2);
    });

    it('keeps working for the rest of its ten fights after the Bank runs dry', () => {
        hero.equipment[0] = 'elixir_valor';
        InventoryManager.addItem('elixir_valor', 1);
        placeEnemy();
        untilEngagements(3);
        expect(InventoryManager.getItemCount('elixir_valor')).toBe(0);
        expect(hero.elixirFights.elixir_valor).toBe(ELIXIR_FIGHTS - 3);
        expect(hero.effects.map(e => e.effectId)).toEqual(['fx_valor']);
    });

    it('does nothing, without an error, when none are in the Bank', () => {
        hero.equipment[0] = 'elixir_valor';
        placeEnemy();
        untilEngagements(2);
        expect(hero.effects || []).toEqual([]);
        expect(hero.elixirFights?.elixir_valor ?? 0).toBe(0);
        expect(consumed).toEqual([]);
    });

    it('never drinks a consumable that has no fight rule', () => {
        hero.equipment[0] = 'potion_work';
        InventoryManager.addItem('potion_work', 2);
        placeEnemy();
        untilEngagements(2);
        expect(InventoryManager.getItemCount('potion_work')).toBe(2);
        expect(hero.elixirFights?.potion_work).toBeUndefined();
    });
});

describe('for the fight', () => {
    it('ends with the kill and comes back with the next enemy', () => {
        hero.equipment[0] = 'elixir_valor';
        InventoryManager.addItem('elixir_valor', 1);
        placeEnemy();
        untilEngagements(1);
        expect(hero.effects.map(e => e.effectId)).toEqual(['fx_valor']);

        // Run until the kill: the effect is gone during the rest between enemies.
        let resolved = false;
        const off = EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, () => { resolved = true; });
        for (let i = 0; i < 20000 && !resolved; i++) step();
        off();
        expect(resolved).toBe(true);
        expect(hero.effects).toEqual([]);

        untilEngagements(1);
        expect(hero.effects.map(e => e.effectId)).toEqual(['fx_valor']);
    });

    it('ends when the hero leaves the fight', () => {
        hero.equipment[0] = 'elixir_valor';
        InventoryManager.addItem('elixir_valor', 1);
        const damage = CombatFormulas.heroBaseDamage(hero);
        placeEnemy();
        untilEngagements(1);
        BoardCombat.endFightOfHero('hero_1');
        expect(hero.effects).toEqual([]);
        expect(CombatFormulas.heroBaseDamage(hero)).toBe(damage);
    });

    it('is not carried into a loaded game', () => {
        hero.equipment[0] = 'elixir_valor';
        InventoryManager.addItem('elixir_valor', 1);
        placeEnemy();
        untilEngagements(1);
        EventBus.publish(ENGINE_EVENTS.GAME_LOADED, {});
        expect(hero.effects).toEqual([]);
        // The count is the hero's and is kept.
        expect(hero.elixirFights.elixir_valor).toBe(ELIXIR_FIGHTS - 1);
    });

    it('reads as a sentence', () => {
        const text = renderStatement(forTheFight('fx_valor'), { effect: () => 'Valor' });
        expect(text).toMatch(/applies Valor to .* for the fight\.$/i);
    });
});

describe('the count is saved with the hero', () => {
    it('survives a save', () => {
        hero.equipment[0] = 'elixir_valor';
        InventoryManager.addItem('elixir_valor', 1);
        placeEnemy();
        untilEngagements(2);
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        expect(saved.state.heroes[0].elixirFights).toEqual({ elixir_valor: ELIXIR_FIGHTS - 2 });
    });
});

describe('food and drink in a fight', () => {
    it('eats food, and leaves an equipped drink alone (drinks no longer heal in fights)', () => {
        hero.equipment[0] = 'fixture_bread';
        hero.equipment[1] = 'fixture_ale';
        InventoryManager.addItem('fixture_bread', 1);
        InventoryManager.addItem('fixture_ale', 3);
        hero.hp = { current: 2, max: 11 };
        const meals = ConsumptionSystem.tryEat('hero_1', { inFight: true });
        expect(meals.map(m => m.itemId)).toEqual(['fixture_bread']);
        expect(hero.hp.current).toBe(7);

        // Still low after the food runs out: the drink stays in the Bank.
        hero.hp.current = 1;
        expect(ConsumptionSystem.tryEat('hero_1', { inFight: true })).toEqual([]);
        expect(InventoryManager.getItemCount('fixture_ale')).toBe(3);
        expect(hero.hp.current).toBe(1);
    });

    it('on the small numbers: an 11 HP hero at 2 HP is below 25 % and eats', () => {
        hero.equipment[0] = 'fixture_bread';
        InventoryManager.addItem('fixture_bread', 1);
        hero.hp = { current: 2, max: 11 };
        expect(ConsumptionSystem.needsFood('hero_1')).toBe(true);
        expect(ConsumptionSystem.tryEat('hero_1', { inFight: true })).toHaveLength(1);
        hero.hp = { current: 3, max: 11 };              // 27 %: not low
        expect(ConsumptionSystem.needsFood('hero_1')).toBe(false);
    });
});
