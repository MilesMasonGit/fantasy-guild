import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { loadoutCapOf } from '../systems/equipment/loadoutCaps.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { isDrinkLike, doseKindsOf, DOSE } from '../systems/core/consumableRule.js';
import { hallStarFindings } from '../systems/core/hallStarRule.js';
import { HALL_NODE } from '../config/guildUpgrades.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * One drink at a time (owner, 2026-11-26): drinks, work potions and elixirs are all drinks, and a
 * hero carries one of them. Poisons, bait, arrows and Motes give no buff and stack as before. The
 * Loadout Slots Hall star never adds a drink.
 */

const onWork = (effectId) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'WORK_START', scope: 'self' },
    target: { role: 'actor' },
    payload: { effectId, scale: 1, durationMs: 0, forCycle: true, chance: 100 }
});
const onFight = (effectId, extra = {}) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'COMBAT_ENGAGED', scope: 'self' },
    target: { role: 'actor' },
    payload: { effectId, scale: 1, durationMs: 0, chance: 100, ...extra }
});
const onHit = (effectId) => ({
    ...makeStatement(KEYWORD.APPLIES),
    when: { event: 'FIGHT_HIT', scope: 'self', every: 1 },
    target: { role: 'opponent' },
    payload: { effectId, scale: 1, durationMs: 0, chance: 100 }
});
const provides = (type, value) => ({ ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket: 'percentage', value }, to: null });

registerEffects({
    od_fx_fast: { id: 'od_fx_fast', name: 'Fast', statements: [provides('WORK_TIME', -0.2)] },
    od_fx_coffee: { id: 'od_fx_coffee', name: 'Coffee Drink', statements: [onWork('od_fx_fast')] },
    od_fx_potion: { id: 'od_fx_potion', name: 'Work Potion', statements: [{ ...onWork('od_fx_fast'), when: { event: 'WORK_START', scope: 'self', skill: 'mining' } }] },
    od_fx_valor: { id: 'od_fx_valor', name: 'Valor Elixir', statements: [onFight('od_fx_fast')] },
    od_fx_venom: { id: 'od_fx_venom', name: 'Venom', statements: [onFight('od_fx_fast', { forAttacks: 3 })] },
    od_fx_sunder: { id: 'od_fx_sunder', name: 'Sunder Arrow', statements: [onHit('od_fx_fast')] }
});

const item = (id, equipSlot, effectId, extra = {}) => ({
    id, name: id, equipSlot, stackable: true, sprite: 'i_potion_shrimp_pink',
    ...(effectId ? { effects: [{ effectId }] } : {}), ...extra
});
registerItems({
    od_coffee: item('od_coffee', 'drink', 'od_fx_coffee'),
    od_tea: item('od_tea', 'drink', 'od_fx_coffee'),
    // A drink nobody has finished: no rule yet, still a drink.
    od_unfinished_drink: item('od_unfinished_drink', 'drink', null),
    od_work_potion: item('od_work_potion', 'consumable', 'od_fx_potion'),
    od_elixir: item('od_elixir', 'consumable', 'od_fx_valor'),
    od_poison: item('od_poison', 'consumable', 'od_fx_venom'),
    od_bait: item('od_bait', 'consumable', null),
    od_arrow: item('od_arrow', 'consumable', 'od_fx_sunder', { arrow: { damage: 2 } }),
    od_mote: item('od_mote', 'consumable', null),
    od_bread: item('od_bread', 'food', null)
});

const BOOSTS = ['od_coffee', 'od_tea', 'od_unfinished_drink', 'od_work_potion', 'od_elixir'];
const PLAIN = ['od_poison', 'od_bait', 'od_arrow', 'od_mote'];

let hero;

function makeHero(id) {
    const h = generateHero({ name: id });
    h.id = id;
    h.status = 'idle';
    h.hp = { current: 100, max: 100 };
    h.equipment = Array(9).fill(null);
    h.aggregator = new ModifierAggregator(h.id);
    return h;
}

const equip = (itemId, slot = null) => EquipmentManager.equipItem(hero.id, itemId, slot);
const boostsHeld = () => hero.equipment.filter(id => BOOSTS.includes(id));

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.maxSlots = 50;
    getGlobalAggregator().clearAll();
    hero = makeHero('od_hero');
    GameState.state.heroes = [hero];
    for (const id of [...BOOSTS, ...PLAIN, 'od_bread']) InventoryManager.addItem(id, 20);
});

describe('which items are drinks', () => {
    it('drinks, work potions and elixirs are; poisons, bait, arrows and Motes are not', () => {
        expect(isDrinkLike('drink', [])).toBe(true);
        expect(isDrinkLike('consumable', [onWork('x')])).toBe(true);
        expect(isDrinkLike('consumable', [onFight('x')])).toBe(true);
        expect(isDrinkLike('consumable', [onFight('x', { forAttacks: 3 })])).toBe(false);
        expect(isDrinkLike('consumable', [onHit('x')])).toBe(false);
        expect(isDrinkLike('consumable', [])).toBe(false);
        expect(isDrinkLike('food', [onWork('x')])).toBe(false);
        expect(doseKindsOf('consumable', [onFight('x', { forAttacks: 3 })])).toEqual([DOSE.POISON]);
    });
});

describe('a hero carries one drink at a time', () => {
    it('refuses a work potion or an elixir beside a drink, and says why', () => {
        expect(equip('od_coffee').success).toBe(true);
        for (const id of ['od_work_potion', 'od_elixir', 'od_tea', 'od_unfinished_drink']) {
            const r = equip(id);
            expect(r.success, id).toBe(false);
            expect(r.error).toMatch(/already carries od_coffee/);
            expect(r.error).toMatch(/one drink at a time/i);
        }
        expect(boostsHeld()).toEqual(['od_coffee']);
    });

    it('refuses a drink or a second potion beside a potion, even dropped on a free slot', () => {
        expect(equip('od_work_potion').success).toBe(true);
        expect(equip('od_coffee', 5).success).toBe(false);
        expect(equip('od_elixir', 6).success).toBe(false);
        expect(boostsHeld()).toEqual(['od_work_potion']);
    });

    it('swaps when the new one is dropped on the one carried', () => {
        expect(equip('od_coffee', 2).success).toBe(true);
        expect(equip('od_elixir', 2).success).toBe(true);
        expect(hero.equipment[2]).toBe('od_elixir');
        expect(boostsHeld()).toEqual(['od_elixir']);
    });

    it('takes a new one once the old one is taken off', () => {
        expect(equip('od_coffee').success).toBe(true);
        const slot = hero.equipment.indexOf('od_coffee');
        expect(EquipmentManager.unequipItem(hero.id, slot).success).toBe(true);
        expect(equip('od_work_potion').success).toBe(true);
        expect(boostsHeld()).toEqual(['od_work_potion']);
    });

    it('keeps food beside the drink', () => {
        expect(equip('od_coffee').success).toBe(true);
        expect(equip('od_bread').success).toBe(true);
    });
});

describe('poisons, bait, arrows and Motes stack as before', () => {
    it('all of them beside a drink and beside one another', () => {
        expect(equip('od_elixir').success).toBe(true);
        for (const id of PLAIN) expect(equip(id).success, id).toBe(true);
        expect(hero.equipment.filter(Boolean).sort()).toEqual(['od_elixir', ...PLAIN].sort());
    });
});

describe('the Loadout Slots star never adds a drink', () => {
    const star = (category, value = 2) => getGlobalAggregator().addModifier({
        source: `guild:od_${category}`, type: EFFECT_TYPES.LOADOUT_SLOTS, bucket: 'flat', value, target: { category }
    });

    it('raises food but not drink', () => {
        star('food');
        star('drink');
        expect(loadoutCapOf('food')).toBe(3);
        expect(loadoutCapOf('drink')).toBe(1);
    });

    it('a second drink is still refused with the star bought', () => {
        star('drink');
        expect(equip('od_coffee').success).toBe(true);
        expect(equip('od_tea').success).toBe(false);
        expect(equip('od_work_potion').success).toBe(false);
        expect(boostsHeld()).toEqual(['od_coffee']);
    });

    it('the boot audit says a Drink star does nothing, and a Food star is fine', () => {
        const slots = (category) => ({
            id: `stm_od_${category}`, keyword: KEYWORD.PROVIDES,
            payload: { type: EFFECT_TYPES.LOADOUT_SLOTS, bucket: 'flat', value: 1, category },
            chargeDelta: 0, to: { mode: 'all', value: '' }, reach: 'board', target: null, when: null, upkeep: null
        });
        const sky = (rules) => ({
            constellations: {},
            stars: {
                od_star: {
                    id: 'od_star', constellation: 'hearth', name: 'Cellar', node: { x: 0, y: -2.6 }, links: [HALL_NODE],
                    ranks: [{ tier: 1, price: [{ itemId: 'item_oak_wood', quantity: 5 }], rules, lines: [] }]
                }
            }
        });
        const lines = (rules) => hallStarFindings({ sky: sky(rules), items: { item_oak_wood: {} } })
            .filter(f => f.entityId === 'od_star').map(f => f.message);
        expect(lines([slots('drink')])).toEqual([expect.stringMatching(/Loadout Slots rule for Drink, which a star never raises/)]);
        expect(lines([slots('food')])).toEqual([]);
    });
});
