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
import * as HeroEffects from '../systems/hero/HeroEffects.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../config/registries/itemRegistry.js';
import { registerEffects, EFFECTS, getEffect } from '../config/registries/effectRegistry.js';
import { makeStatement, KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { statusBlockOf } from '../systems/effects/effectLibrary.js';
import * as CF from '../systems/combat/CombatFormulas.js';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { isWeapon, isOffHand } from '../config/registries/weaponStyles.js';
import { handsOf } from '../config/registries/toolKinds.js';
import { gearResistancesOf, gearDamageCutOf, isWornGear } from '../config/registries/gearDefence.js';
import { VENOM_EFFECT_ID } from '../config/registries/enemyKinds.js';
import { gearDefenceFindings, bestResistanceStacks } from '../systems/core/gearDefenceRule.js';
import { heroSide, liveEnemyResistLines } from '../ui/components/combat/fightView.js';
import { itemTipFacts } from '../ui/components/drawer/ItemTip.jsx';
import { registerStatusFixtures, SUNDER, VENOM } from './fixtures/statusEffects.js';
import { ROLE } from '../config/registries/roleRegistry.js';

/**
 * Gear and defence (brief 280 V2): a worn piece lends resistances in percent by type or group and
 * lists a damage cut to named styles; only the weapon swung lends, and the second hand is for an
 * off-hand item (a shield acts like a piece of body armour); Sunder, a stacking status, lowers a
 * fighter's resistances for the fight, never below 0; an arrow's rules count on its own shot; the
 * audit adds up the best stack and names any type it takes to 100 %.
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
/** "On Hit: applies <effect> to the enemy." */
const onHitApplies = (id, effectId) => ({
    ...makeStatement(KEYWORD.APPLIES), id,
    when: { event: 'FIGHT_HIT', scope: 'self', every: 1 },
    target: { role: ROLE.OPPONENT },
    payload: { effectId, chance: 100 }
});

registerStatusFixtures();
registerEffects({
    gd_keen: { id: 'gd_keen', name: 'Keen', statements: [provides(EFFECT_TYPES.CRIT_CHANCE, 10)] },
    gd_bulwark: { id: 'gd_bulwark', name: 'Bulwark', statements: [provides(EFFECT_TYPES.DODGE, 5)] },
    gd_warded: { id: 'gd_warded', name: 'Warded', statements: [provides(EFFECT_TYPES.TYPE_RESIST, 10, 'fire')] },
    gd_sundering: { id: 'gd_sundering', name: 'Sundering', statements: [onHitApplies('stm_gd_sunder', SUNDER)] }
});

const weapon = (id, name, extra) => ({ id, name, type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', ...extra });
const armour = (id, name, equipSlot, extra) => ({ id, name, type: 'armor', equipSlot, stackable: true, ...extra });
registerItems({
    gd_sword: weapon('gd_sword', 'Sword', { styles: ['melee'], damage: 2 }),
    gd_axe: weapon('gd_axe', 'Axe', { styles: ['melee'], damage: 2 }),
    gd_greatsword: weapon('gd_greatsword', 'Greatsword', { styles: ['melee'], damage: 3, hands: 2 }),
    gd_wand: weapon('gd_wand', 'Frost Wand', { styles: ['magic'], damage: 2, damageType: 'ice' }),
    gd_dagger: weapon('gd_dagger', 'Keen Dagger', { styles: ['stealth'], damage: 1, effects: [{ effectId: 'gd_keen', scale: 1 }] }),
    gd_dagger_b: weapon('gd_dagger_b', 'Keen Dagger B', { styles: ['stealth'], damage: 1, effects: [{ effectId: 'gd_keen', scale: 1 }], resistances: { fire: 20 } }),
    gd_spear: weapon('gd_spear', 'Sundering Spear', { styles: ['melee'], damage: 2, damageType: 'stab', effects: [{ effectId: 'gd_sundering', scale: 1 }] }),
    gd_bow: weapon('gd_bow', 'Bow', { styles: ['ranged'], damage: 1, damageType: 'stab' }),
    gd_pick: { id: 'gd_pick', name: 'Pick', type: 'tool', equipSlot: 'hand', stackable: true, tool: { kind: 'pickaxe', tier: 1 } },
    gd_shield: armour('gd_shield', 'Kite Shield', 'hand', { offHand: true, resistances: { physical: 15, fire: 10 }, effects: [{ effectId: 'gd_bulwark', scale: 1 }] }),
    gd_buckler: armour('gd_buckler', 'Buckler', 'hand', { offHand: true, resistances: { physical: 5 } }),
    gd_plate: armour('gd_plate', 'Iron Chestplate', 'chest', { resistances: { physical: 20 }, damageCut: { magic: 30, stealth: 15 } }),
    gd_helm: armour('gd_helm', 'Iron Helmet', 'hat', { resistances: { physical: 10, slash: 10 }, damageCut: { magic: 15 } }),
    gd_gated_helm: armour('gd_gated_helm', 'Gated Helmet', 'hat', { resistances: { physical: 40 }, skillRequired: 'melee', levelRequired: 30 }),
    gd_fur: armour('gd_fur', 'Fur Cloak', 'chest', { resistances: { ice: 25, fire: -10 } }),
    gd_bodkin: { id: 'gd_bodkin', name: 'Sundering Bodkin', type: 'material', equipSlot: 'consumable', stackable: true, arrow: { damage: 1, damageType: 'stab' }, effects: [{ effectId: 'gd_sundering', scale: 1 }] },
    gd_plain_arrow: { id: 'gd_plain_arrow', name: 'Plain Arrow', type: 'material', equipSlot: 'consumable', stackable: true, arrow: { damage: 1, damageType: 'stab' } },
    gd_warded_arrow: { id: 'gd_warded_arrow', name: 'Warded Arrow', type: 'material', equipSlot: 'consumable', stackable: true, arrow: { damage: 1 }, effects: [{ effectId: 'gd_warded', scale: 1 }] }
});

const enemyType = (id, enemy) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50, sprite: 's_occult', requiresHero: true,
    enemy: { level: 1, style: 'melee', hp: 500, ...enemy },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
});
registerTokenTypes({
    gd_dummy: enemyType('gd_dummy', { hit: 10 }),
    gd_crab: enemyType('gd_crab', { kinds: ['armoured'], resistances: { crush: -50 } }),
    gd_venom_rat: enemyType('gd_venom_rat', { hit: 4, kinds: ['venomous'] })
});

const profile = (enemy) => enemyProfileOf({ id: 'e', name: 'E', enemy: { level: 1, style: 'melee', ...enemy } });

function addHero(name, skills = {}) {
    const hero = generateHero({ name });
    hero.status = 'idle';
    for (const [id, level] of Object.entries(skills)) hero.skills[id] = { level, xp: 0 };
    hero.hp = { current: 500, max: 500 };
    GameState.state.heroes.push(hero);
    return hero;
}
const equip = (hero, id) => {
    InventoryManager.addItem(id, 1);
    const res = EquipmentManager.equipItem(hero.id, id);
    expect(res.success, res.error).toBe(true);
};
const held = (hero) => hero.equipment.filter(Boolean);

const AT = { x: 400, y: 300 };
function startFight(typeId, hero) {
    const enemy = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(enemy, AT);
    TileModifiers.rebuildAround([enemy]);
    Orders.orderAt(hero.id, AT);
    return enemy;
}
function play(ms, each = null) {
    const seen = { hero: [], enemy: [], statuses: [] };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => seen.hero.push(p)),
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_ENEMY_ATTACK, (p) => seen.enemy.push(p)),
        EventBus.subscribe(ENGINE_EVENTS.STATUS_APPLIED, (p) => seen.statuses.push(p))
    ];
    for (let t = 0; t < ms; t += 100) {
        LiveEffects.tick(100, TriggerSystem.fireLiveStatement);
        BoardRunner.tick(100);
        each?.();
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

describe('a worn piece\'s fields: resistances and a damage cut', () => {
    it('reads known types and groups at any number but 0, held within ±100; cuts by combat style, 1 to 100', () => {
        expect(gearResistancesOf(getItem('gd_helm'))).toEqual({ physical: 10, slash: 10 });
        expect(gearResistancesOf({ equipSlot: 'chest', resistances: { fire: -10, earth: 20, ice: 0, dark: 250 } }))
            .toEqual({ fire: -10, dark: 100 });
        expect(gearDamageCutOf(getItem('gd_plate'))).toEqual({ magic: 30, stealth: 15 });
        expect(gearDamageCutOf({ equipSlot: 'hat', damageCut: { magic: 120, mining: 10, melee: -5 } })).toEqual({ magic: 100 });
    });

    it('only worn gear carries them: a food or an arrow with resistances lends none', () => {
        expect(isWornGear(getItem('gd_shield'))).toBe(true);
        expect(gearResistancesOf({ equipSlot: 'food', resistances: { fire: 20 } })).toEqual({});
        expect(gearDamageCutOf({ equipSlot: 'consumable', damageCut: { magic: 20 } })).toEqual({});
    });

    it('an off-hand item takes one hand, is never a weapon, and a tool is never an off-hand item', () => {
        expect(isOffHand(getItem('gd_shield'))).toBe(true);
        expect(isWeapon(getItem('gd_shield'))).toBe(false);
        expect(handsOf({ equipSlot: 'hand', offHand: true, hands: 2 })).toBe(1);
        expect(isOffHand({ equipSlot: 'hand', offHand: true, tool: { kind: 'pickaxe', tier: 1 } })).toBe(false);
        expect(isOffHand({ equipSlot: 'chest', offHand: true })).toBe(false);
    });
});

describe('resistances from gear', () => {
    it('a Physical line takes its share off an enemy\'s plain swing, and the swing says Resisted', () => {
        const hero = addHero('Dara', { melee: 1 });
        const enemy = profile({ hit: 10 });
        expect(CF.enemyBlow(enemy, hero).exact).toBe(10);
        equip(hero, 'gd_plate');
        expect(CF.heroTypeResistance(hero, 'physical')).toBe(20);
        const blow = CF.enemyBlow(enemy, hero);
        expect(blow.exact).toBe(8);
        expect(CF.blowVerdict(blow.parts)).toBe('resisted');
    });

    it('lines add: a group\'s counts on each of its types beside a type\'s own, across pieces', () => {
        const hero = addHero('Dara', { melee: 1 });
        equip(hero, 'gd_plate');
        equip(hero, 'gd_helm');
        expect(CF.heroTypeResistance(hero, 'physical')).toBe(30);
        expect(CF.heroTypeResistance(hero, 'slash')).toBe(40);
        expect(CF.heroTypeResistance(hero, 'crush')).toBe(30);
        expect(CF.heroTypeResistance(hero, 'fire')).toBe(0);
    });

    it('a weakness is a negative line: hits of that type land harder', () => {
        const hero = addHero('Dara', { melee: 1 });
        equip(hero, 'gd_fur');
        expect(CF.heroTypeResistance(hero, 'ice')).toBe(25);
        expect(CF.heroTypeResistance(hero, 'fire')).toBe(-10);
    });

    it('a piece below its level lends nothing until the hero reaches it', () => {
        const hero = addHero('Dara', { melee: 30 });
        equip(hero, 'gd_gated_helm');
        expect(CF.heroTypeResistance(hero, 'physical')).toBe(40);
        hero.skills.melee = { level: 10, xp: 0 };
        EquipmentManager.recalculateEquipmentModifiers(hero);
        expect(CF.heroTypeResistance(hero, 'physical')).toBe(0);
    });

    it('in a fight: an armoured hero takes less from every swing, each said Resisted', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const hero = addHero('Dara', { melee: 1 });
        equip(hero, 'gd_sword');
        equip(hero, 'gd_plate');
        equip(hero, 'gd_shield');
        startFight('gd_dummy', hero);
        const seen = play(20000);
        const hits = seen.enemy.filter(p => p.hit);
        expect(hits.length).toBeGreaterThan(3);
        // 10 Physical, 35 % resisted: 6.5 rolls 6 or 7 (every draw is 0.5 here, not under the
        // fraction's 0.5: 6).
        expect(hits.every(p => p.types[0] === 'physical' && p.verdict === 'resisted' && p.damage === 6)).toBe(true);
    });
});

describe('a damage cut to named styles', () => {
    it('a mage in an iron chestplate hits 30 % softer; a fighter in it hits as hard as in nothing', () => {
        const mage = addHero('Eli', { magic: 1 });
        equip(mage, 'gd_wand');
        const dummy = profile({});
        const bare = CF.heroBlow(mage, dummy).exact;
        equip(mage, 'gd_plate');
        expect(CF.styleDamageCut(mage)).toBe(30);
        expect(CF.heroBlow(mage, dummy).exact).toBeCloseTo(bare * 0.7, 10);

        const fighter = addHero('Bram', { melee: 1 });
        equip(fighter, 'gd_sword');
        const before = CF.heroBlow(fighter, dummy).exact;
        equip(fighter, 'gd_plate');
        expect(CF.styleDamageCut(fighter)).toBe(0);
        expect(CF.heroBlow(fighter, dummy).exact).toBe(before);
    });

    it('cuts from several pieces add, and 100 or more leaves nothing; barehanded is Melee', () => {
        const mage = addHero('Eli', { magic: 1 });
        equip(mage, 'gd_wand');
        equip(mage, 'gd_plate');
        equip(mage, 'gd_helm');
        expect(CF.styleDamageCut(mage)).toBe(45);
        expect(CF.styleCutFactor(mage)).toBeCloseTo(0.55, 10);
        mage.aggregator.addModifier({ type: EFFECT_TYPES.STYLE_DAMAGE_CUT, value: 80, bucket: 'flat', source: 'test', target: { category: 'magic' } });
        expect(CF.styleCutFactor(mage)).toBe(0);
        expect(CF.heroBlow(mage, profile({})).exact).toBe(0);

        const fist = addHero('Fen', { melee: 1 });
        fist.aggregator.addModifier({ type: EFFECT_TYPES.STYLE_DAMAGE_CUT, value: 50, bucket: 'flat', source: 'test', target: { category: 'melee' } });
        expect(CF.getHeroWeapon(fist)).toBeNull();
        expect(CF.heroBlow(fist, profile({})).exact).toBe(CF.heroBaseDamage(fist) * 0.5);
    });

    it('the versus card shows the cut hit, and a line saying what the gear cuts', () => {
        const mage = addHero('Eli', { magic: 1 });
        equip(mage, 'gd_wand');
        const bare = heroSide(mage).hit;
        equip(mage, 'gd_plate');
        const side = heroSide(mage);
        expect(side.hit).toBeCloseTo(bare * 0.7, 10);
        expect(side.hitLines).toContain('Magic damage cut by gear: −30%');
        expect(side.resists).toEqual([{ id: 'physical', value: 20 }]);
    });
});

describe('the hands: one weapon lends; an off-hand item beside it', () => {
    it('a shield beside a sword lends its resistances and its rules, and is never swung', () => {
        const hero = addHero('Dara', { melee: 1 });
        equip(hero, 'gd_sword');
        equip(hero, 'gd_shield');
        expect(held(hero)).toEqual(['gd_sword', 'gd_shield']);
        expect(CF.getHeroWeapon(hero).id).toBe('gd_sword');
        expect(CF.heroTypeResistance(hero, 'physical')).toBe(15);
        expect(CF.heroTypeResistance(hero, 'fire')).toBe(10);
        expect(CF.heroDodge(hero)).toBe(5);
    });

    it('a shield alone: the hero punches, and the shield still lends', () => {
        const hero = addHero('Dara', { melee: 1 });
        equip(hero, 'gd_shield');
        expect(CF.getHeroWeapon(hero)).toBeNull();
        expect(CF.getHeroCombatStyle(hero)).toBe('melee');
        expect(CF.heroTypeResistance(hero, 'physical')).toBe(15);
    });

    it('⭐ a weapon in the second hand lends nothing, whatever its style: two keen daggers crit as one', () => {
        const hero = addHero('Vex', { stealth: 1 });
        // An older save holding two daggers of one style (the equip puts one down now).
        hero.equipment[0] = 'gd_dagger';
        hero.equipment[1] = 'gd_dagger_b';
        hero.heldCopies = [true, true, false, false, false, false, false, false, false];
        EquipmentManager.recalculateEquipmentModifiers(hero);
        expect(CF.getHeroWeapon(hero).id).toBe('gd_dagger');
        expect(CF.heroCritChance(hero)).toBe(15);
        // Its own resistances stay off too.
        expect(CF.heroTypeResistance(hero, 'fire')).toBe(0);
        expect(HeroEffects.loadoutStatements(hero).every(s => s.sourceItemIds.includes('gd_dagger'))).toBe(true);

        hero.equipment[0] = 'gd_dagger_b';
        hero.equipment[1] = 'gd_dagger';
        EquipmentManager.recalculateEquipmentModifiers(hero);
        expect(CF.heroCritChance(hero)).toBe(15);
        expect(CF.heroTypeResistance(hero, 'fire')).toBe(20);
    });

    it('taking up a second weapon puts the one held down, in its place; a tool and a shield stay', () => {
        const hero = addHero('Dara', { melee: 1 });
        equip(hero, 'gd_pick');
        equip(hero, 'gd_sword');
        expect(held(hero)).toEqual(['gd_pick', 'gd_sword']);
        equip(hero, 'gd_axe');
        expect(held(hero)).toEqual(['gd_pick', 'gd_axe']);
        expect(InventoryManager.getItemCount('gd_sword')).toBe(1);

        const knight = addHero('Bram', { melee: 1 });
        equip(knight, 'gd_shield');
        equip(knight, 'gd_sword');
        expect(held(knight)).toEqual(['gd_shield', 'gd_sword']);
        InventoryManager.removeItem('gd_axe', InventoryManager.getItemCount('gd_axe'));
        equip(knight, 'gd_axe');
        expect(held(knight)).toEqual(['gd_shield', 'gd_axe']);
    });

    it('a second off-hand item replaces the first; a two-hander puts the shield down, and a shield the two-hander', () => {
        const hero = addHero('Dara', { melee: 1 });
        equip(hero, 'gd_sword');
        equip(hero, 'gd_shield');
        equip(hero, 'gd_buckler');
        expect(held(hero)).toEqual(['gd_sword', 'gd_buckler']);
        equip(hero, 'gd_greatsword');
        expect(held(hero)).toEqual(['gd_greatsword']);
        equip(hero, 'gd_shield');
        expect(held(hero)).toEqual(['gd_shield']);
    });

    it('an older save\'s two weapons: taking up a third puts both down', () => {
        const hero = addHero('Vex', { melee: 1 });
        InventoryManager.addItem('gd_sword', 1);
        InventoryManager.addItem('gd_axe', 1);
        EquipmentManager.equipItem(hero.id, 'gd_sword');
        // As a save from before V2 holds them: two weapons in the hands.
        InventoryManager.takeOut('gd_axe');
        hero.equipment[1] = 'gd_axe';
        hero.heldCopies[1] = true;
        equip(hero, 'gd_spear');
        expect(held(hero)).toEqual(['gd_spear']);
        expect(InventoryManager.getItemCount('gd_sword')).toBe(1);
        expect(InventoryManager.getItemCount('gd_axe')).toBe(1);
    });

    it('a weapon dropped on a cell goes where the weapon held was', () => {
        const hero = addHero('Dara', { melee: 1 });
        equip(hero, 'gd_shield');
        equip(hero, 'gd_sword');
        InventoryManager.addItem('gd_axe', 1);
        expect(EquipmentManager.equipItem(hero.id, 'gd_axe', 0).success).toBe(true);
        expect(held(hero)).toEqual(['gd_shield', 'gd_axe']);
    });
});

describe('Sunder: a stacking status lowering every resistance for the fight', () => {
    it('lowers a resistance, never below 0, and leaves a weakness or no resistance as it was', () => {
        expect(CF.afterSunder(50, 20)).toBe(30);
        expect(CF.afterSunder(50, 70)).toBe(0);
        expect(CF.afterSunder(-50, 20)).toBe(-50);
        expect(CF.afterSunder(0, 20)).toBe(0);
        expect(CF.afterSunder(50, 0)).toBe(50);
    });

    it('is a status the library authors: Sunder 10 a stack, three stacks, the fight long', () => {
        expect(statusBlockOf(getEffect(SUNDER))).toEqual({ stacks: 3, ticks: 0 });
        expect(paletteForKeyword(KEYWORD.PROVIDES).map(p => p.type)).toContain(EFFECT_TYPES.SUNDER);
        expect(renderStatement(provides(EFFECT_TYPES.SUNDER, 10)))
            .toContain('Provides Sunder 10: every resistance 10 points lower, never below 0, in combat');
    });

    it('⭐ a spear\'s hits sunder an Armoured crab: its Physical 50 falls 10 a stack to 20, its Crush weakness stays, and it ends with the fight', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const hero = addHero('Gus', { melee: 1 });
        equip(hero, 'gd_spear');
        const crab = startFight('gd_crab', hero);
        const resists = [];
        play(25000, () => {
            const fight = BoardCombat.getFight(crab.id);
            if (fight?.enemy) resists.push(CF.enemyTypeResistance(fight.enemy, 'stab'));
        });
        const fight = BoardCombat.getFight(crab.id);
        expect(LiveEffects.statusesOf(fight)).toEqual([{ effectId: SUNDER, stacks: 3, ticksLeft: null }]);
        expect(CF.sunderOf(fight.enemy)).toBe(30);
        expect(CF.enemyTypeResistance(fight.enemy, 'stab')).toBe(20);
        expect(CF.enemyTypeResistance(fight.enemy, 'crush')).toBe(-50);
        expect(CF.enemyTypeResistance(fight.enemy, 'fire')).toBe(0);
        expect([...new Set(resists)]).toEqual([50, 40, 30, 20]);
        expect(liveEnemyResistLines(fight.enemy)).toEqual([{ id: 'physical', value: 20 }, { id: 'crush', value: -50 }]);

        Orders.orderAt(hero.id, { x: 50, y: 50 });
        play(500);
        expect(BoardCombat.getFight(crab.id)).toBeFalsy();
    });

    it('on a hero, it lowers what their gear resists', () => {
        const hero = addHero('Dara', { melee: 1 });
        equip(hero, 'gd_plate');
        hero.aggregator.addModifier({ type: EFFECT_TYPES.SUNDER, value: 15, bucket: 'flat', source: 'test' });
        expect(CF.heroTypeResistance(hero, 'physical')).toBe(5);
    });
});

describe('an arrow\'s rules count on the shot that spends it', () => {
    it('a sundering bodkin sunders only when shot; a sword hero carrying it lands nothing', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const archer = addHero('Cara', { ranged: 1 });
        equip(archer, 'gd_bow');
        InventoryManager.addItem('gd_bodkin', 30);
        expect(EquipmentManager.equipItem(archer.id, 'gd_bodkin').success).toBe(true);
        // Carried, it lends nothing by being there.
        expect(HeroEffects.loadoutStatements(archer)).toEqual([]);
        const crab = startFight('gd_crab', archer);
        const seen = play(15000);
        expect(seen.hero.filter(p => p.hit).every(p => p.arrowId === 'gd_bodkin')).toBe(true);
        expect(seen.statuses.filter(s => s.statusId === SUNDER).length).toBeGreaterThan(0);
        expect(LiveEffects.statusesOf(BoardCombat.getFight(crab.id))[0]).toMatchObject({ effectId: SUNDER });
    });

    it('a sword hero carrying the bodkin, or a bow hero shooting another arrow first, sunders nothing', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const fighter = addHero('Bram', { melee: 1 });
        equip(fighter, 'gd_sword');
        InventoryManager.addItem('gd_bodkin', 5);
        expect(EquipmentManager.equipItem(fighter.id, 'gd_bodkin').success).toBe(true);
        startFight('gd_crab', fighter);
        const melee = play(12000);
        expect(melee.hero.filter(p => p.hit).length).toBeGreaterThan(2);
        expect(melee.statuses).toEqual([]);
        expect(InventoryManager.getItemCount('gd_bodkin')).toBe(5);
    });

    it('a shot\'s arrow ahead in the grid is the one whose rules count', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const archer = addHero('Cara', { ranged: 1 });
        equip(archer, 'gd_bow');
        InventoryManager.addItem('gd_plain_arrow', 30);
        EquipmentManager.equipItem(archer.id, 'gd_plain_arrow');
        InventoryManager.addItem('gd_bodkin', 30);
        EquipmentManager.equipItem(archer.id, 'gd_bodkin');
        startFight('gd_crab', archer);
        const seen = play(12000);
        expect(seen.hero.every(p => p.arrowId === 'gd_plain_arrow')).toBe(true);
        expect(seen.statuses).toEqual([]);
        // An arrow's always-on rows lend nothing while carried.
        InventoryManager.addItem('gd_warded_arrow', 3);
        EquipmentManager.equipItem(archer.id, 'gd_warded_arrow');
        expect(CF.heroTypeResistance(archer, 'fire')).toBe(0);
    });
});

describe('the Venom status (once Poison)', () => {
    it('the shipped library has it under its new id and name, and Venomous lands it', () => {
        expect(VENOM_EFFECT_ID).toBe('effect_venom');
        expect(VENOM).toBe(VENOM_EFFECT_ID);
        expect(EFFECTS.effect_poison).toBeUndefined();
        expect(statusBlockOf(getEffect('effect_venom'))).toEqual({ stacks: 3, ticks: 0 });
        const slime = Object.values(EFFECTS).find(e => e.id === 'effect_greater_slime_moves');
        if (slime) expect(slime.statements[0].payload.effectId).toBe('effect_venom');
    });

    it('a Venomous enemy lands Venom on the hero it hits; the hero\'s gear resists its Physical swing', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const hero = addHero('Dara', { melee: 1 });
        equip(hero, 'gd_sword');
        equip(hero, 'gd_plate');
        startFight('gd_venom_rat', hero);
        const seen = play(15000);
        expect(seen.statuses.some(s => s.statusId === VENOM && s.targetType === 'hero')).toBe(true);
        expect(seen.enemy.filter(p => p.hit).every(p => p.verdict === 'resisted')).toBe(true);
        expect(LiveEffects.statusesOf(hero)[0]).toMatchObject({ effectId: VENOM });
    });
});

describe('the item tooltip', () => {
    it('lists what a piece resists, and in red the styles it cuts; an off-hand item says so', () => {
        const plate = itemTipFacts(getItem('gd_plate'));
        expect(plate.resists).toEqual(['Resists Physical 20%']);
        expect(plate.cuts).toEqual(['Magic damage −30%', 'Stealth damage −15%']);
        const fur = itemTipFacts(getItem('gd_fur'));
        expect(fur.resists).toEqual(['Weak to Fire 10%', 'Resists Ice 25%']);
        const shield = itemTipFacts(getItem('gd_shield'));
        expect(shield.offHand).toBe('Off hand: beside a weapon, never swung');
        expect(shield.stats).toBeNull();
        expect(shield.resists).toEqual(['Resists Physical 15%', 'Resists Fire 10%']);
    });
});

describe('the audit: field problems and the best stack', () => {
    const item = (id, extra) => ({ id, name: id, ...extra });

    it('names lines it cannot read, gear fields on a non-gear item, and weapon numbers on an off-hand item', () => {
        const findings = gearDefenceFindings({
            items: {
                a: item('a', { equipSlot: 'chest', resistances: { earth: 10, fire: 120, ice: 2.5 } }),
                b: item('b', { equipSlot: 'food', resistances: { fire: 10 }, damageCut: { magic: 10 } }),
                c: item('c', { equipSlot: 'hat', damageCut: { mining: 10, magic: 0 } }),
                d: item('d', { equipSlot: 'hand', offHand: true, damage: 3, styles: ['melee'] }),
                e: item('e', { equipSlot: 'chest', offHand: true }),
                f: item('f', { equipSlot: 'hand', offHand: true, tool: { kind: 'pickaxe', tier: 1 } })
            },
            effects: {}
        });
        const say = (id) => findings.filter(f => f.entityId === id).map(f => f.message).join(' | ');
        expect(say('a')).toContain('resists "earth"');
        expect(say('a')).toContain('Fire 120');
        expect(say('a')).toContain('Ice 2.5');
        expect(say('b')).toContain('has resistances but is not worn gear');
        expect(say('b')).toContain('not worn gear, so the cut does nothing');
        expect(say('c')).toContain('"mining"');
        expect(say('c')).toContain('Magic damage by 0');
        expect(say('d')).toContain('weapon numbers (styles, damage)');
        expect(say('e')).toContain('not held in the hands');
        expect(say('f')).toContain('is a tool and marked off-hand');
    });

    it('⭐ adds up the best piece in every place and names a type the stack takes to 100 %', () => {
        const items = {
            hat: item('hat', { equipSlot: 'hat', resistances: { fire: 30 } }),
            hat2: item('hat2', { equipSlot: 'hat', resistances: { fire: 20 } }),
            chest: item('chest', { equipSlot: 'chest', resistances: { elemental: 25 } }),
            ring: item('ring', { equipSlot: 'trinket', resistances: { fire: 10 } }),
            ring2: item('ring2', { equipSlot: 'trinket', effects: [{ effectId: 'warded', scale: 2 }] }),
            ring3: item('ring3', { equipSlot: 'trinket', resistances: { fire: 5 } }),
            shield: item('shield', { equipSlot: 'hand', offHand: true, resistances: { fire: 15 } }),
            sword: item('sword', { equipSlot: 'hand', styles: ['melee'], resistances: { fire: 5 } }),
            sword2: item('sword2', { equipSlot: 'hand', styles: ['melee'], resistances: { fire: 4 } }),
            great: item('great', { equipSlot: 'hand', styles: ['melee'], hands: 2, resistances: { fire: 18 } }),
            elixir: item('elixir', { equipSlot: 'consumable', resistances: { fire: 90 } })
        };
        const effects = { warded: { id: 'warded', name: 'Warded', statements: [provides(EFFECT_TYPES.TYPE_RESIST, 10, 'fire')] } };
        const fire = bestResistanceStacks({ items, effects }).find(s => s.id === 'fire');
        // Hat 30, chest 25 (its group's line), trinkets 20 (Warded at scale 2) and 10, shield 15 and
        // sword 5 (20 beats the two-hander's 18; two swords never stack).
        expect(fire.total).toBe(105);
        expect(fire.pieces.map(p => p.itemId).sort()).toEqual(['chest', 'hat', 'ring', 'ring2', 'shield', 'sword']);
        const findings = gearDefenceFindings({ items, effects }).filter(f => f.message.includes('best stack'));
        expect(findings).toHaveLength(1);
        expect(findings[0].entityId).toBe('hat');
        expect(findings[0].message).toContain('resist Fire 105%');

        // A group's best stack too (an enemy's plain swing is the Physical group).
        const physical = bestResistanceStacks({ items: { a: item('a', { equipSlot: 'chest', resistances: { physical: 60, slash: -50 } }), b: item('b', { equipSlot: 'hat', resistances: { physical: 45 } }) }, effects: {} });
        expect(physical.find(s => s.id === 'physical').total).toBe(105);
        expect(physical.find(s => s.id === 'slash').total).toBe(55);
    });

    it('counts the milestone perks a hero at 99 holds', () => {
        const items = { hat: item('hat', { equipSlot: 'hat', resistances: { ice: 80 } }) };
        const effects = { warded: { id: 'warded', name: 'Warded', statements: [provides(EFFECT_TYPES.TYPE_RESIST, 10, 'ice')] } };
        const skillPerks = { magic: { id: 'magic', perks: [{ level: 50, effectId: 'warded', scale: 2 }] } };
        const ice = bestResistanceStacks({ items, effects, skillPerks }).find(s => s.id === 'ice');
        expect(ice.total).toBe(100);
        expect(gearDefenceFindings({ items, effects, skillPerks }).some(f => f.message.includes('milestone perks 20'))).toBe(true);
    });
});
