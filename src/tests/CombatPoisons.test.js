import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { enemyCampType } from './fixtures/enemyCamp.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
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
import * as CombatFormulas from '../systems/combat/CombatFormulas.js';
import * as ConsumptionSystem from '../systems/hero/ConsumptionSystem.js';
import { doseKindsOf, DOSE, DOSE_WHY } from '../systems/core/consumableRule.js';
import { CARRIED_KIND } from '../config/registries/carriedKinds.js';
import { carriedKindOf } from '../systems/hero/carriedKind.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { slotsOf } from '../../cms/src/engine/ledger/statementSlots.js';
import { startFightWatch, resetFightWatch, fightsOf } from '../ui/components/combat/fightWatch.js';
import { usedBubbleText } from '../ui/components/board/fx/matFx.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Poisons for Stealth weapons (brief 750 S3, owner 2026-11-21): a Consumable whose fight-start rule
 * applies its effect "for N attacks" is taken like an elixir as a fight starts, only by a hero
 * holding a Stealth weapon; every attack counts, hit or miss; what is left carries into later
 * fights, saved on the hero; a fresh one is taken only as a fight starts, so one that runs out
 * mid-fight leaves the rest of that fight unpoisoned.
 */

const SPOT = { x: 400, y: 400 };

const forAttacks = (effectId, n) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'COMBAT_ENGAGED', scope: 'self' },
    payload: { effectId, scale: 1, durationMs: 0, forAttacks: n, chance: 100 }
});
const provides = (type, value) => ({ ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket: 'flat', value }, to: null });

registerEffects({
    px_coat: { id: 'px_coat', name: 'Venom Coat', statements: [provides('DAMAGE', 2)] },
    px_poison_3: { id: 'px_poison_3', name: 'Poison of 3', statements: [forAttacks('px_coat', 3)] },
    px_poison_5: { id: 'px_poison_5', name: 'Poison of 5', statements: [forAttacks('px_coat', 5)] }
});
registerItems({
    px_dagger: { id: 'px_dagger', name: 'Dagger', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['stealth'], damage: 2, speed: 'fast' },
    px_sword: { id: 'px_sword', name: 'Sword', type: 'weapon', equipSlot: 'hand', stackable: true, styles: ['melee'], damage: 2 },
    px_venom: { id: 'px_venom', name: 'Venom Vial', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'px_poison_3' }] },
    px_venom_5: { id: 'px_venom_5', name: 'Long Venom', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'px_poison_5' }] }
});
registerTokenTypes({
    px_dummy: {
        id: 'px_dummy', name: 'Dummy', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult', requiresHero: true,
        enemy: { level: 1, style: 'ranged', hp: 2000 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }
});

function makeHero(id, weapon) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 500, max: 500 };
    for (const s of getAllSkillIds()) hero.skills[s] = { level: 20, xp: 0 };
    hero.equipment = Array(9).fill(null);
    hero.aggregator = new ModifierAggregator(hero.id);
    GameState.state.heroes.push(hero);
    InventoryManager.addItem(weapon, 1);
    InventoryManager.takeOut(weapon);
    hero.equipment[0] = weapon;
    hero.heldCopies = [true];
    return hero;
}

let attacks;
let consumed;
let offs = [];

function place(typeId = 'px_dummy', at = SPOT, heroId = null) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, at);
    TileModifiers.rebuildAround([instance]);
    if (heroId) Orders.orderAt(heroId, at);
    return instance;
}
const step = (n = 1) => { for (let i = 0; i < n; i++) BoardRunner.tick(100); };
/** Tick until the hero has made `n` more attacks. */
function untilAttacks(heroId, n) {
    const target = attacks.filter(a => a.heroId === heroId).length + n;
    for (let i = 0; i < 20000 && attacks.filter(a => a.heroId === heroId).length < target; i++) step();
    expect(attacks.filter(a => a.heroId === heroId).length).toBe(target);
}
const coated = (hero) => (hero.effects || []).filter(e => e.effectId === 'px_coat');

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    LoadoutMoments.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    Flags.init();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
    offs.forEach(off => off());
    attacks = [];
    consumed = [];
    offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => attacks.push(p)),
        EventBus.subscribe(ENGINE_EVENTS.HERO_CONSUMED, (p) => consumed.push(p))
    ];
});
afterEach(() => { vi.restoreAllMocks(); resetFightWatch(); });

describe('what a poison is', () => {
    it('a Consumable whose fight-start rule lasts for N attacks; an elixir is not one', () => {
        expect(ConsumptionSystem.isPoison('px_venom')).toBe(true);
        expect(ConsumptionSystem.isFightElixir('px_venom')).toBe(false);
        expect(ConsumptionSystem.poisonAttacksOfItem('px_venom_5')).toBe(5);
        expect(doseKindsOf('consumable', [forAttacks('px_coat', 3)])).toEqual([DOSE.POISON]);
        expect(DOSE_WHY[DOSE.POISON]).toMatch(/Stealth weapon/);
        expect(carriedKindOf('px_venom')).toBe(CARRIED_KIND.POISON);
    });

    it('says what it does: applies its effect to the hero for N attacks', () => {
        expect(renderStatement(forAttacks('px_coat', 3), { effect: () => 'Venom Coat', carried: true })).toMatch(/applies Venom Coat to the hero for 3 attacks/i);
        expect(renderStatement(forAttacks('px_coat', 1), { effect: () => 'Venom Coat', carried: true })).toMatch(/for 1 attack\b/i);
    });

    it('the CMS offers "for N attacks" on a fight-start Applies, and writes it', () => {
        const statement = { ...forAttacks('px_coat', 0), payload: { effectId: 'px_coat', scale: 1, chance: 100 } };
        const slot = slotsOf(statement, { effects: { px_coat: { id: 'px_coat', name: 'Venom Coat' } } }).find(s => s.id === 'forAttacks');
        expect(slot).toBeTruthy();
        expect(slot.patch(20).payload.forAttacks).toBe(20);
        expect(slot.patch(0).payload).not.toHaveProperty('forAttacks');
        const onHit = { ...statement, when: { event: 'FIGHT_HIT', scope: 'self' } };
        expect(slotsOf(onHit, { effects: {} }).some(s => s.id === 'forAttacks')).toBe(false);
    });
});

describe('a Stealth hero takes it as a fight starts; it lasts its attacks', () => {
    it('takes one from the Bank, is coated for three attacks hit or miss, then fights on unpoisoned', () => {
        const hero = makeHero('vex', 'px_dagger');
        hero.equipment[1] = 'px_venom';
        InventoryManager.addItem('px_venom', 2);
        const plain = CombatFormulas.heroBaseDamage(hero);
        // Every swing misses: misses count too.
        vi.spyOn(Math, 'random').mockReturnValue(0);
        place('px_dummy', SPOT, hero.id);
        untilAttacks(hero.id, 1);
        expect(InventoryManager.getItemCount('px_venom')).toBe(1);
        expect(consumed.filter(c => c.poison)).toEqual([expect.objectContaining({ heroId: 'vex', itemId: 'px_venom', poison: true })]);
        expect(coated(hero)).toHaveLength(1);
        expect(CombatFormulas.heroBaseDamage(hero)).toBe(plain + 2);
        expect(hero.poisonAttacks.px_venom).toBe(2);
        untilAttacks(hero.id, 2);
        expect(attacks.every(a => !a.hit)).toBe(true);
        expect(hero.poisonAttacks.px_venom).toBe(0);
        expect(coated(hero)).toHaveLength(0);
        expect(CombatFormulas.heroBaseDamage(hero)).toBe(plain);
        // No fresh one mid-fight, though the Bank has one.
        untilAttacks(hero.id, 3);
        expect(InventoryManager.getItemCount('px_venom')).toBe(1);
        expect(coated(hero)).toHaveLength(0);
    });

    it('a sword hero carrying it takes none and is never coated', () => {
        const hero = makeHero('bram', 'px_sword');
        hero.equipment[1] = 'px_venom';
        InventoryManager.addItem('px_venom', 2);
        place('px_dummy', SPOT, hero.id);
        untilAttacks(hero.id, 3);
        expect(InventoryManager.getItemCount('px_venom')).toBe(2);
        expect(consumed.filter(c => c.poison)).toEqual([]);
        expect(coated(hero)).toHaveLength(0);
        expect(hero.poisonAttacks).toBeUndefined();
    });

    it('its attacks left carry into the next fight, with no fresh one taken', () => {
        const hero = makeHero('vex', 'px_dagger');
        hero.equipment[1] = 'px_venom_5';
        InventoryManager.addItem('px_venom_5', 3);
        place('px_dummy', SPOT, hero.id);
        untilAttacks(hero.id, 2);
        expect(hero.poisonAttacks.px_venom_5).toBe(3);
        // The fight ends without a kill: the coat comes off, the attacks left stay.
        BoardCombat.endFightOfHero(hero.id);
        expect(coated(hero)).toHaveLength(0);
        expect(hero.poisonAttacks.px_venom_5).toBe(3);

        // A new enemy elsewhere: coated again from what was left.
        Orders.orderAt(hero.id, { x: 1200, y: 400 });
        place('px_dummy', { x: 1200, y: 400 }, hero.id);
        untilAttacks(hero.id, 1);
        expect(InventoryManager.getItemCount('px_venom_5')).toBe(2);
        expect(consumed.filter(c => c.poison)).toHaveLength(1);
        expect(coated(hero)).toHaveLength(1);
        untilAttacks(hero.id, 2);
        expect(hero.poisonAttacks.px_venom_5).toBe(0);
        expect(coated(hero)).toHaveLength(0);
    });

    it('a dose run out takes a fresh one at the next fight', () => {
        const hero = makeHero('vex', 'px_dagger');
        hero.equipment[1] = 'px_venom';
        InventoryManager.addItem('px_venom', 5);
        const camp = enemyCampType('px_dummy_small');
        registerTokenTypes({
            px_dummy_small: {
                id: 'px_dummy_small', name: 'Small Dummy', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult', requiresHero: true,
                enemy: { level: 1, style: 'ranged', hp: 40 },
                config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
            }
        });
        place(camp, SPOT, hero.id);
        let engaged = 0;
        const off = EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, () => { engaged++; });
        for (let i = 0; i < 40000 && engaged < 3; i++) step();
        off();
        expect(engaged).toBe(3);
        // Each fight long enough to spend three attacks: one taken a fight.
        expect(consumed.filter(c => c.poison).length).toBe(3);
        expect(InventoryManager.getItemCount('px_venom')).toBe(2);
    });

    it('is logged in the fight window as it is taken, and over the hero as an elixir is', () => {
        const stop = startFightWatch();
        const hero = makeHero('vex', 'px_dagger');
        hero.equipment[1] = 'px_venom';
        InventoryManager.addItem('px_venom', 1);
        place('px_dummy', SPOT, hero.id);
        untilAttacks(hero.id, 1);
        const log = fightsOf('vex').current?.log || [];
        expect(log.some(l => l.key === 'poisons' && l.vars.item === 'Venom Vial')).toBe(true);
        expect(usedBubbleText({ itemId: 'px_venom', poison: true })).toBe('Venom Vial');
        stop();
    });
});

describe('saved on the hero', () => {
    it('the attacks left and the fight it works in are in the save; a resumed fight takes none fresh', () => {
        const hero = makeHero('vex', 'px_dagger');
        hero.equipment[1] = 'px_venom_5';
        InventoryManager.addItem('px_venom_5', 2);
        const enemy = place('px_dummy', SPOT, hero.id);
        untilAttacks(hero.id, 2);
        const saved = JSON.parse(JSON.stringify(GameState.serialize()));
        const savedHero = saved.state.heroes.find(h => h.id === 'vex');
        expect(savedHero.poisonAttacks).toEqual({ px_venom_5: 3 });
        expect(savedHero.fightPoisons).toEqual({ at: enemy.id, items: ['px_venom_5'] });

        // A fight going on after a load: the coat comes back from what was left, none fresh.
        hero.effects = [];
        expect(ConsumptionSystem.startFightPoisons('vex', enemy.id, { resumed: true })).toEqual(['px_venom_5']);
        expect(InventoryManager.getItemCount('px_venom_5')).toBe(1);
        LoadoutMoments.fire(enemy.id, 'vex', 'COMBAT_ENGAGED', { resumed: true });
        expect(coated(hero)).toHaveLength(1);
        expect(InventoryManager.getItemCount('px_venom_5')).toBe(1);
    });
});
