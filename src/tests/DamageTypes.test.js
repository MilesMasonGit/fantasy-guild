import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TriggerSystem from '../systems/board/TriggerSystem.js';
import * as Flags from '../systems/board/Flags.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { slotsOf } from '../systems/effects/statementSlots.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import { findUnknownRefs } from '../systems/core/unknownRefRule.js';
import * as CF from '../systems/combat/CombatFormulas.js';
import { enemyProfileOf, ENEMY_OVERRIDE_FIELDS } from '../config/registries/enemyProfile.js';
import {
    DAMAGE_TYPES, DAMAGE_GROUPS, groupOf, typesOfGroup, weaponDamageTypeOf, arrowOf, normaliseResistances,
    resistanceFor, RESISTANCE_STEPS, DEFAULT_DAMAGE_TYPE_BY_STYLE, BAREHANDED_DAMAGE_TYPE
} from '../config/registries/damageTypes.js';
import { nextArrowOf } from '../systems/combat/Arrows.js';
import { heroSide, enemyCardView, heroResistLines } from '../ui/components/combat/fightView.js';
import { itemTipFacts } from '../ui/components/drawer/ItemTip.jsx';

/**
 * Damage types: nine types in three groups; one per weapon, two per shot (the bow's and the
 * arrow's); enemy resistances and weaknesses in fixed steps, a type's line replacing its group's;
 * the hit order (damage × matchup × buffs → crit → × type factor, never below 0 → the fraction
 * sub-roll); flat armour, the floor of 1, flat resistance and Pierce retired.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const provides = (type, value, category) => ({
    ...makeStatement(KEYWORD.PROVIDES), to: null,
    payload: { type, bucket: 'flat', value, ...(category ? { category } : {}) }
});

registerEffects({
    dt_poisoner: { id: 'dt_poisoner', name: 'Poisoner', statements: [provides(EFFECT_TYPES.TYPE_DAMAGE, 20, 'poison')] },
    dt_plate: { id: 'dt_plate', name: 'Plate', statements: [provides(EFFECT_TYPES.TYPE_RESIST, 20, 'physical')] },
    dt_old_armour: { id: 'dt_old_armour', name: 'Old Armour', statements: [provides(EFFECT_TYPES.ARMOR, 3)] }
});

const weapon = (id, name, extra) => ({ id, name, type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', ...extra });
registerItems({
    dt_ember_wand: weapon('dt_ember_wand', 'Ember Wand', { styles: ['magic'], damage: 2, damageType: 'fire' }),
    dt_frost_wand: weapon('dt_frost_wand', 'Frost Wand', { styles: ['magic'], damage: 2, damageType: 'ice' }),
    dt_plain_wand: weapon('dt_plain_wand', 'Plain Wand', { styles: ['magic'], damage: 2 }),
    dt_venom_dagger: weapon('dt_venom_dagger', 'Venom Dagger', { styles: ['stealth'], damage: 2, damageType: 'poison' }),
    dt_spark_bow: weapon('dt_spark_bow', 'Spark Bow', { styles: ['ranged'], damage: 1, damageType: 'electric' }),
    dt_sword: weapon('dt_sword', 'Sword', { styles: ['melee'], damage: 2 }),
    dt_arrow: { id: 'dt_arrow', name: 'Bodkin Arrow', type: 'material', equipSlot: 'consumable', stackable: true, arrow: { damage: 1, damageType: 'stab' } },
    dt_fire_arrow: { id: 'dt_fire_arrow', name: 'Fire Arrow', type: 'material', equipSlot: 'consumable', stackable: true, arrow: { damage: 2, damageType: 'fire' } },
    dt_poison_cloak: { id: 'dt_poison_cloak', name: 'Poisoner\'s Cloak', type: 'armor', equipSlot: 'hat', stackable: true, effects: [{ effectId: 'dt_poisoner', scale: 1 }] },
    dt_plate_chest: { id: 'dt_plate_chest', name: 'Plate', type: 'armor', equipSlot: 'chest', stackable: true, effects: [{ effectId: 'dt_plate', scale: 1 }] },
    dt_old_chest: { id: 'dt_old_chest', name: 'Old Chest', type: 'armor', equipSlot: 'chest', stackable: true, effects: [{ effectId: 'dt_old_armour', scale: 1 }] }
});

const enemyType = (id, enemy) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult', requiresHero: true,
    enemy: { level: 1, style: 'melee', hp: 500, ...enemy },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
});
registerTokenTypes({
    dt_fire_elemental: enemyType('dt_fire_elemental', { resistances: { fire: 100, ice: -50 } }),
    dt_crab: enemyType('dt_crab', { style: 'stealth', kinds: ['armoured'], resistances: { crush: -50 } }),
    dt_dummy: enemyType('dt_dummy', {})
});

const profile = (enemy) => enemyProfileOf({ id: 'e', name: 'E', enemy: { level: 1, style: 'melee', ...enemy } });

function addHero(name, skills = {}) {
    const hero = generateHero({ name });
    hero.status = 'idle';
    for (const [id, level] of Object.entries(skills)) hero.skills[id] = { level, xp: 0 };
    hero.hp = { current: 200, max: 200 };
    GameState.state.heroes.push(hero);
    return hero;
}
const equip = (hero, id, n = 1) => {
    InventoryManager.addItem(id, n);
    const res = EquipmentManager.equipItem(hero.id, id);
    expect(res.success, res.error).toBe(true);
};

const AT = { x: 400, y: 300 };
function startFight(typeId, hero) {
    const enemy = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(enemy, AT);
    TileModifiers.rebuildAround([enemy]);
    Orders.orderAt(hero.id, AT);
    return enemy;
}
function play(ms) {
    const seen = { hero: [], enemy: [] };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => seen.hero.push(p)),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => seen.enemy.push(p))
    ];
    for (let t = 0; t < ms; t += 100) {
        LiveEffects.tick(100, TriggerSystem.fireLiveStatement);
        BoardRunner.tick(100);
    }
    offs.forEach(off => off());
    return seen;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    TriggerSystem.init();
    Flags.init();
    LiveEffects.resetClock();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
});
afterEach(() => {
    TriggerSystem.teardown();
    Flags.teardown();
    vi.restoreAllMocks();
});

describe('the registry: nine types in three groups', () => {
    it('Physical (Slash, Crush, Stab), Elemental (Fire, Ice, Electric), Special (Poison, Light, Dark)', () => {
        expect(DAMAGE_GROUPS.map(g => g.id)).toEqual(['physical', 'elemental', 'special']);
        expect(DAMAGE_TYPES).toHaveLength(9);
        expect(typesOfGroup('physical')).toEqual(['slash', 'crush', 'stab']);
        expect(typesOfGroup('elemental')).toEqual(['fire', 'ice', 'electric']);
        expect(typesOfGroup('special')).toEqual(['poison', 'light', 'dark']);
        expect(groupOf('ice')).toBe('elemental');
        expect(groupOf('special')).toBe('special');
        expect(groupOf('earth')).toBeNull();
    });

    it('an untyped weapon hits with its style\'s default, so older content fights as it did; a fist is Crush', () => {
        expect(DEFAULT_DAMAGE_TYPE_BY_STYLE).toEqual({ melee: 'slash', ranged: 'stab', magic: 'fire', stealth: 'stab' });
        expect(weaponDamageTypeOf({ damage: 2 }, 'melee')).toBe('slash');
        expect(weaponDamageTypeOf({ damageType: 'ice' }, 'magic')).toBe('ice');
        expect(weaponDamageTypeOf({ damageType: 'earth' }, 'magic')).toBe('fire');
        expect(BAREHANDED_DAMAGE_TYPE).toBe('crush');
    });

    it('an arrow is `arrow: { damage, damageType }`; a bad type reads Stab, a bad damage 0', () => {
        expect(arrowOf({ arrow: { damage: 1, damageType: 'stab' } })).toEqual({ damage: 1, damageType: 'stab' });
        expect(arrowOf({ arrow: { damage: 'x', damageType: 'earth' } })).toEqual({ damage: 0, damageType: 'stab' });
        expect(arrowOf({ damage: 2 })).toBeNull();
    });

    it('resistances keep the owner\'s steps only; a type\'s line replaces its group\'s', () => {
        expect(RESISTANCE_STEPS).toEqual([100, 50, 25, -25, -50]);
        expect(normaliseResistances({ physical: 50, crush: -50, fire: 30, earth: 50, ice: '-25' }))
            .toEqual({ physical: 50, crush: -50, ice: -25 });
        const skeleton = { physical: 50, crush: -50 };
        expect(resistanceFor(skeleton, 'slash')).toBe(50);
        expect(resistanceFor(skeleton, 'crush')).toBe(-50);
        expect(resistanceFor(skeleton, 'fire')).toBe(0);
        // A hit typed only by its group (an enemy's plain swing) meets the group's line alone.
        expect(resistanceFor({ crush: -50 }, 'physical')).toBe(0);
        expect(resistanceFor(skeleton, 'physical')).toBe(50);
    });
});

describe('the enemy profile', () => {
    it('Armoured is a Physical resistance step (50 %), and slow; flat armour and Pierce are gone', () => {
        const p = profile({ kinds: ['armoured'] });
        expect(p.resistances).toEqual({ physical: 50 });
        expect(p.speed).toBe('slow');
        expect(p).not.toHaveProperty('armor');
        expect(p).not.toHaveProperty('pierce');
        expect(ENEMY_OVERRIDE_FIELDS).not.toContain('armor');
        expect(ENEMY_OVERRIDE_FIELDS).not.toContain('pierce');
        // An older enemy's typed armour is read by nothing.
        expect(profile({ armor: 5, pierce: 2 })).not.toHaveProperty('armor');
    });

    it('the author\'s line replaces the kind\'s for that key; other lines add', () => {
        expect(profile({ kinds: ['armoured'], resistances: { physical: 25, crush: -50 } }).resistances)
            .toEqual({ physical: 25, crush: -50 });
        expect(profile({ kinds: ['armoured'], resistances: { fire: 100 } }).resistances)
            .toEqual({ physical: 50, fire: 100 });
    });

    it('no enemy level brings armour any more', () => {
        expect(profile({ level: 90 }).resistances).toEqual({});
    });
});

describe('the hit order', () => {
    const hero = () => addHero('Mira', { magic: 1, ranged: 1, stealth: 1, melee: 1 });

    it('a Fire wand on a Fire Elemental does 0 and is Resisted; an Ice wand is Weak!', () => {
        const fire = hero();
        equip(fire, 'dt_ember_wand');
        const elemental = profile({ resistances: { fire: 100, ice: -50 } });
        const resisted = CF.heroBlow(fire, elemental);
        expect(resisted.exact).toBe(0);
        expect(CF.blowVerdict(resisted.parts)).toBe('resisted');

        const ice = hero();
        equip(ice, 'dt_frost_wand');
        const weak = CF.heroBlow(ice, elemental);
        expect(weak.exact).toBe(3);
        expect(weak.parts).toEqual([{ type: 'ice', pre: 2, amount: 3, resist: -50 }]);
        expect(CF.blowVerdict(weak.parts)).toBe('weak');
    });

    it('matchup and buffs, then the crit, then the type factor: no rounding until the sub-roll', () => {
        const h = hero();
        equip(h, 'dt_plain_wand');                                  // Magic, untyped: Fire
        // Magic beats Stealth (+25 %): 2 × 1.25 = 2.5; a crit doubles it to 5; Fire resist 50 % → 2.5.
        const blow = CF.heroBlow(h, profile({ style: 'stealth', resistances: { fire: 50 } }), { crit: true });
        expect(blow.parts[0].pre).toBe(5);
        expect(blow.exact).toBe(2.5);
    });

    it('no floor: a resisted hit can do 0; the old flat armour is read by nothing', () => {
        const h = hero();
        equip(h, 'dt_ember_wand');
        equip(h, 'dt_old_chest');
        expect(CF.heroHitDamage(h, profile({ resistances: { fire: 100 } }))).toBe(0);
        // The enemy's plain hit of 1 lands whole on a hero in the old armour.
        expect(CF.enemyBlow(profile({ hit: 1 }), h).exact).toBe(1);
    });

    it('Type Damage % on the type or its group, Type Resistance % against the plain Physical swing', () => {
        const h = hero();
        equip(h, 'dt_venom_dagger');
        equip(h, 'dt_poison_cloak');
        expect(CF.typeDamageBoost(h, 'poison')).toBe(20);
        // Stealth and Ranged are even: 2 × (1 + 20 %).
        expect(CF.heroBlow(h, profile({ style: 'ranged' })).exact).toBeCloseTo(2.4);
        equip(h, 'dt_plate_chest');
        expect(CF.heroTypeResistance(h, 'physical')).toBe(20);
        expect(CF.heroTypeResistance(h, 'slash')).toBe(20);          // the group's row counts on its types
        expect(CF.enemyBlow(profile({ style: 'ranged', hit: 5 }), h).exact).toBe(4);  // 5 × (1 − 20 %)
    });

    it('a type row on one type does not count against a hit typed only by its group', () => {
        const agg = new ModifierAggregator('x');
        agg.addModifier({ type: EFFECT_TYPES.TYPE_RESIST, value: 30, bucket: 'flat', source: 's', target: { category: 'slash' } });
        agg.addModifier({ type: EFFECT_TYPES.TYPE_RESIST, value: 10, bucket: 'flat', source: 's', target: { category: 'physical' } });
        expect(agg.query(EFFECT_TYPES.TYPE_RESIST, 'slash')).toBe(40);
        expect(agg.query(EFFECT_TYPES.TYPE_RESIST, 'crush')).toBe(10);
        expect(agg.query(EFFECT_TYPES.TYPE_RESIST, 'physical')).toBe(10);
        expect(agg.query(EFFECT_TYPES.TYPE_RESIST, 'fire')).toBe(0);
    });

    it('the type factor is never below 0', () => {
        expect(CF.typeFactor(0, 150)).toBe(0);
        expect(CF.typeFactor(25, 100)).toBe(0.25);
    });
});

describe('the fraction sub-roll', () => {
    it('a whole blow draws nothing', () => {
        const spy = vi.spyOn(Math, 'random');
        expect(CF.rollFraction(3)).toBe(3);
        expect(CF.rollFraction(2.0000000000000004)).toBe(2);
        expect(CF.rollFraction(0)).toBe(0);
        expect(spy).not.toHaveBeenCalled();
    });

    it('1.1 does 2 one time in ten, else 1: one draw', () => {
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.05);
        expect(CF.rollFraction(1.1)).toBe(2);
        spy.mockReturnValue(0.5);
        expect(CF.rollFraction(1.1)).toBe(1);
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('over many rolls 1.1 averages 1.1', () => {
        let sum = 0;
        for (let i = 0; i < 20000; i++) sum += CF.rollFraction(1.1);
        expect(sum / 20000).toBeCloseTo(1.1, 1);
    });
});

describe('arrows', () => {
    it('a bow hero shoots one arrow a swing, hit or miss, and a hit names both types', () => {
        const archer = addHero('Cara', { ranged: 1 });
        equip(archer, 'dt_spark_bow');
        InventoryManager.addItem('dt_arrow', 20);
        expect(EquipmentManager.equipItem(archer.id, 'dt_arrow').success).toBe(true);
        expect(InventoryManager.getItemCount('dt_arrow')).toBe(20);
        expect(nextArrowOf(archer)).toBe('dt_arrow');

        startFight('dt_crab', archer);
        const seen = play(30000);
        const shots = seen.hero.length;
        expect(shots).toBeGreaterThan(5);
        expect(seen.hero.every(p => p.arrowId === 'dt_arrow')).toBe(true);
        expect(InventoryManager.getItemCount('dt_arrow')).toBe(20 - shots);
        const hit = seen.hero.find(p => p.hit);
        expect(hit.types).toEqual(['electric', 'stab']);
        // Stealth is even with Ranged: 1 Electric + 1 Stab at the crab's Physical 50 % = 1.5, rolled.
        expect(seen.hero.filter(p => p.hit && !p.crit).every(p => p.damage === 1 || p.damage === 2)).toBe(true);
        expect(hit.verdict).toBe('resisted');
    });

    it('with none left the bow shoots its own part alone and spends nothing', () => {
        const archer = addHero('Cara', { ranged: 1 });
        equip(archer, 'dt_spark_bow');
        expect(nextArrowOf(archer)).toBeNull();
        startFight('dt_dummy', archer);
        const seen = play(12000);
        expect(seen.hero.length).toBeGreaterThan(2);
        expect(seen.hero.every(p => p.arrowId === null)).toBe(true);
        expect(seen.hero.filter(p => p.hit).every(p => p.types.length === 1 && p.types[0] === 'electric')).toBe(true);
    });

    it('the first carried arrow the Bank holds is the one shot; a melee hero carrying arrows spends none', () => {
        const archer = addHero('Cara', { ranged: 1 });
        equip(archer, 'dt_spark_bow');
        InventoryManager.addItem('dt_fire_arrow', 1);
        EquipmentManager.equipItem(archer.id, 'dt_fire_arrow');
        InventoryManager.addItem('dt_arrow', 1);
        EquipmentManager.equipItem(archer.id, 'dt_arrow');
        expect(nextArrowOf(archer)).toBe('dt_fire_arrow');
        InventoryManager.removeItem('dt_fire_arrow', 1);
        expect(nextArrowOf(archer)).toBe('dt_arrow');

        const fighter = addHero('Bram', { melee: 1 });
        equip(fighter, 'dt_sword');
        InventoryManager.addItem('dt_arrow', 3);
        EquipmentManager.equipItem(fighter.id, 'dt_arrow');
        expect(nextArrowOf(fighter)).toBeNull();
    });
});

describe('a fight end to end', () => {
    it('a Fire wand on a Fire Elemental: every hit Resisted for 0; an Ice wand: Weak! for 3', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);    // every swing hits, none crits
        const fire = addHero('Aela', { magic: 1 });
        equip(fire, 'dt_ember_wand');
        startFight('dt_fire_elemental', fire);
        const a = play(9000);
        expect(a.hero.length).toBeGreaterThan(0);
        expect(a.hero.every(p => p.hit && p.damage === 0 && p.verdict === 'resisted' && p.types[0] === 'fire')).toBe(true);
        // The enemy's plain swing is Physical.
        expect(a.enemy.filter(p => p.hit).every(p => p.types[0] === 'physical' && p.verdict === null)).toBe(true);
    });

    it('an Ice wand on the same elemental', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const ice = addHero('Bram', { magic: 1 });
        equip(ice, 'dt_frost_wand');
        startFight('dt_fire_elemental', ice);
        const b = play(9000);
        expect(b.hero.length).toBeGreaterThan(0);
        expect(b.hero.every(p => p.damage === 3 && p.verdict === 'weak')).toBe(true);
    });
});

describe('the Rules rows', () => {
    it('Type Damage % and Type Resistance % are offered; Armor, Resistance and Pierce are not', () => {
        const offered = paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type);
        expect(offered).toEqual(expect.arrayContaining([EFFECT_TYPES.TYPE_DAMAGE, EFFECT_TYPES.TYPE_RESIST]));
        for (const retired of [EFFECT_TYPES.ARMOR, EFFECT_TYPES.RESIST_FLAT, EFFECT_TYPES.PIERCE]) {
            expect(offered).not.toContain(retired);
        }
    });

    it('a type row picks a type or a group; its sentence names it', () => {
        const statement = provides(EFFECT_TYPES.TYPE_DAMAGE, 15, 'poison');
        const slot = slotsOf(statement, {}).find(s => s.id === 'category');
        expect(slot.options.map(o => o.id)).toEqual(['', ...DAMAGE_GROUPS.map(g => g.id), ...DAMAGE_TYPES.map(t => t.id)]);
        expect(renderStatement(statement)).toMatch(/^Provides 15% more Poison damage in combat/);
        expect(renderStatement(provides(EFFECT_TYPES.TYPE_RESIST, 20, 'physical'))).toMatch(/^Provides 20% Physical resistance in combat/);
        expect(renderStatement(provides(EFFECT_TYPES.TYPE_RESIST, -25, 'fire'))).toMatch(/^Provides a 25% Fire weakness in combat/);
    });

    it('a retired row on a rule keeps its name in the picker, marked retired', () => {
        const slot = slotsOf(provides(EFFECT_TYPES.ARMOR, 1), {}).find(s => s.id === 'type');
        expect(slot.options.find(o => o.id === EFFECT_TYPES.ARMOR)?.label).toBe('Armor (retired)');
    });
});

describe('the audits', () => {
    it('name a bad weapon type, a misplaced or empty arrow, a bad resistance, retired numbers and rows', () => {
        const findings = findUnknownRefs({
            tokens: {
                t_bad: { id: 't_bad', name: 'Bad', enemy: { level: 1, resistances: { fire: 30, earth: 50 }, armor: 2, pierce: 1 } }
            },
            items: {
                i_wand: { id: 'i_wand', name: 'Wand', equipSlot: 'hand', styles: ['magic'], damageType: 'earth' },
                i_arrow: { id: 'i_arrow', name: 'Arrow', equipSlot: 'food', arrow: { damage: 0, damageType: 'mud' } }
            },
            // Rows are read off the library, once per effect, whoever carries it.
            effects: {
                e_plate: { id: 'e_plate', name: 'Plate', statements: [provides(EFFECT_TYPES.ARMOR, 1)] },
                e_cloak: { id: 'e_cloak', name: 'Cloak', statements: [provides(EFFECT_TYPES.TYPE_RESIST, 10, 'earth')] }
            }
        });
        const text = findings.map(f => `${f.entityId}|${f.field}|${f.message}`);
        expect(text.some(t => t.startsWith('t_bad|enemy.resistances') && t.includes('30'))).toBe(true);
        expect(text.some(t => t.startsWith('t_bad|enemy.resistances') && t.includes('"earth"'))).toBe(true);
        expect(text.some(t => t.startsWith('t_bad|enemy.armor'))).toBe(true);
        expect(text.some(t => t.startsWith('t_bad|enemy.pierce'))).toBe(true);
        expect(text.some(t => t.startsWith('i_wand|damageType'))).toBe(true);
        expect(text.filter(t => t.startsWith('i_arrow|arrow'))).toHaveLength(3);
        expect(text.some(t => t.startsWith('e_plate|statements') && t.includes('Armor'))).toBe(true);
        expect(text.some(t => t.startsWith('e_cloak|statements') && t.includes('"earth"'))).toBe(true);
        expect(findings.find(f => f.entityId === 'e_plate').entityType).toBe('Effect');
    });

    it('say nothing about good content', () => {
        expect(findUnknownRefs({
            tokens: { t: { id: 't', enemy: { level: 1, kinds: ['armoured'], resistances: { physical: 50, crush: -50 } } } },
            items: {
                w: { id: 'w', equipSlot: 'hand', styles: ['magic'], damageType: 'ice' },
                a: { id: 'a', equipSlot: 'consumable', arrow: { damage: 1, damageType: 'stab' } }
            },
            effects: { e: { id: 'e', statements: [provides(EFFECT_TYPES.TYPE_DAMAGE, 15, 'special')] } }
        })).toEqual([]);
    });
});

describe('what the screen shows', () => {
    it('the versus card: the hit\'s parts with their types, the arrows left, the hero\'s resistances', () => {
        const archer = addHero('Cara', { ranged: 1 });
        equip(archer, 'dt_spark_bow');
        InventoryManager.addItem('dt_arrow', 6);
        EquipmentManager.equipItem(archer.id, 'dt_arrow');
        equip(archer, 'dt_plate_chest');
        const side = heroSide(archer);
        expect(side.hitParts).toEqual([{ type: 'electric', hit: 1, arrow: false }, { type: 'stab', hit: 1, arrow: true }]);
        expect(side.hit).toBe(2);
        expect(side.arrows).toMatchObject({ itemId: 'dt_arrow', count: 6 });
        expect(side.resists).toEqual([{ id: 'physical', value: 20 }]);
        expect(heroResistLines(archer)).toEqual([{ id: 'physical', value: 20 }]);
        expect(side).not.toHaveProperty('armour');
    });

    it('the item tooltip says what a weapon hits with and what an arrow adds', () => {
        const row = (item, id) => itemTipFacts(item).stats.find(s => s.id === id)?.value;
        const wand = { id: 'dt_ember_wand', equipSlot: 'hand', styles: ['magic'], damage: 2, damageType: 'fire' };
        expect([row(wand, 'damage'), row(wand, 'type'), row(wand, 'skill')]).toEqual(['2', 'Fire', 'Magic']);
        const sword = { id: 'dt_sword', equipSlot: 'hand', styles: ['melee'], damage: 2 };
        expect([row(sword, 'damage'), row(sword, 'type'), row(sword, 'skill')]).toEqual(['2', 'Slash', 'Melee']);
        expect(itemTipFacts({ id: 'dt_arrow', equipSlot: 'consumable', arrow: { damage: 1, damageType: 'stab' } }).arrow)
            .toBe('Arrow: +1 Stab a shot, from a bow');
        expect(itemTipFacts({ id: 'x', equipSlot: 'hat' })).toMatchObject({ stats: null, arrow: null });
    });

    it('the enemy card: its hit\'s type and its lines as written, groups first', () => {
        const card = enemyCardView('dt_crab');
        expect(card.hitType).toBe('physical');
        expect(card.resists).toEqual([{ id: 'physical', value: 50 }, { id: 'crush', value: -50 }]);
        expect(card).not.toHaveProperty('armour');
    });
});
