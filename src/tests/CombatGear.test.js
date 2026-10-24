import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as HeroEffects from '../systems/hero/HeroEffects.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import { registerStatusFixtures, POISON, BURN } from './fixtures/statusEffects.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as OutputRules from '../systems/board/OutputRules.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import * as CF from '../utils/CombatFormulas.js';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { isWeapon, weaponStylesOf, weaponRefusal, WEAPON_REFUSAL } from '../config/registries/weaponStyles.js';
import { MODIFIER_PALETTE, getPaletteEntry } from '../config/registries/modifierPalette.js';
import { makeStatement, KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { slotsOf } from '../systems/effects/statementSlots.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { findUnknownRefs } from '../systems/core/unknownRefRule.js';
import { equipOrAnnounce } from '../ui/components/dock/dockEquip.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';

/**
 * Gear (brief 220, C2): a weapon names its style(s) and only a hero of that style holds it; a
 * weapon or armour family's ability is a Rules effect on the item, shared by every tier with the
 * tier's scale raising the number, and an ability may touch work as well as fights.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const provides = (type, value, extra = {}) => ({
    ...makeStatement(KEYWORD.PROVIDES),
    payload: { type, bucket: 'flat', value, ...extra }
});

registerStatusFixtures();

// The families: one library effect each, every tier pointing at it with its own scale.
registerEffects({
    gear_spear: { id: 'gear_spear', name: 'Spear', statements: [provides(EFFECT_TYPES.PIERCE, 1)] },
    gear_bow: { id: 'gear_bow', name: 'Bow', statements: [provides(EFFECT_TYPES.ACCURACY, 5)] },
    gear_rapier: { id: 'gear_rapier', name: 'Rapier', statements: [provides(EFFECT_TYPES.CRIT_CHANCE, 5)] },
    gear_cleaver: { id: 'gear_cleaver', name: 'Cleaver', statements: [provides(EFFECT_TYPES.DOUBLE_DROP, 50, { category: 'item_raw_beef' })] },
    gear_hide: { id: 'gear_hide', name: 'Hide Vest', statements: [provides(EFFECT_TYPES.STATUS_MAX_STACKS, -1, { category: POISON })] },
    gear_cloak: { id: 'gear_cloak', name: 'Cloak', statements: [provides(EFFECT_TYPES.DODGE, 10)] }
});

const weapon = (id, name, extra = {}) => ({ id, name, type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', ...extra });
const ITEMS = {
    gear_copper_sword: weapon('gear_copper_sword', 'Copper Sword', { styles: ['melee'], damage: 2 }),
    gear_copper_dagger: weapon('gear_copper_dagger', 'Copper Dagger', { styles: ['stealth', 'melee'], damage: 1, speed: 'fast' }),
    gear_copper_wand: weapon('gear_copper_wand', 'Copper Wand', { styles: ['magic'], damage: 1, speed: 'fast' }),
    gear_old_bow: weapon('gear_old_bow', 'Old Bow', { skillRequired: 'ranged', damage: 2 }),
    gear_stick: weapon('gear_stick', 'Training Stick', { damage: 1 }),
    gear_copper_spear: weapon('gear_copper_spear', 'Copper Spear', { styles: ['melee'], damage: 2, effects: [{ effectId: 'gear_spear', scale: 1 }] }),
    gear_iron_spear: weapon('gear_iron_spear', 'Iron Spear', { styles: ['melee'], damage: 3, effects: [{ effectId: 'gear_spear', scale: 2 }] }),
    gear_copper_bow: weapon('gear_copper_bow', 'Copper Bow', { styles: ['ranged'], damage: 2, effects: [{ effectId: 'gear_bow', scale: 1 }] }),
    gear_copper_rapier: weapon('gear_copper_rapier', 'Copper Rapier', { styles: ['stealth'], damage: 2, effects: [{ effectId: 'gear_rapier', scale: 1 }] }),
    gear_iron_rapier: weapon('gear_iron_rapier', 'Iron Rapier', { styles: ['stealth'], damage: 3, effects: [{ effectId: 'gear_rapier', scale: 2 }] }),
    gear_copper_cleaver: weapon('gear_copper_cleaver', 'Copper Cleaver', { styles: ['melee'], damage: 1, effects: [{ effectId: 'gear_cleaver', scale: 1 }] }),
    gear_iron_cleaver: weapon('gear_iron_cleaver', 'Iron Cleaver', { styles: ['melee'], damage: 2, effects: [{ effectId: 'gear_cleaver', scale: 2 }] }),
    gear_hide_vest: { id: 'gear_hide_vest', name: 'Hide Vest', type: 'armor', equipSlot: 'chest', stackable: true, effects: [{ effectId: 'gear_hide', scale: 1 }] },
    gear_thick_hide: { id: 'gear_thick_hide', name: 'Thick Hide', type: 'armor', equipSlot: 'chest', stackable: true, effects: [{ effectId: 'gear_hide', scale: 3 }] },
    gear_cloak: { id: 'gear_cloak', name: 'Cloak', type: 'armor', equipSlot: 'hat', stackable: true, effects: [{ effectId: 'gear_cloak', scale: 1 }] },
    gear_pick: { id: 'gear_pick', name: 'Pick', type: 'tool', equipSlot: 'hand', stackable: true, tool: { kind: 'pickaxe', tier: 1 } }
};
registerItems(ITEMS);

registerTokenTypes({
    gear_cow: {
        id: 'gear_cow', name: 'Gear Cow', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 50,
        sprite: 's_occult', enemy: { level: 1, style: 'melee', hp: 1 },
        config: {
            skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [],
            outputs: [
                { itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 },
                { itemId: 'item_raw_beef', chance: 100, minQty: 1, maxQty: 1 }
            ]
        }
    },
    gear_butcher: {
        id: 'gear_butcher', name: 'Gear Butcher Block', tokenType: 'resource', rarity: 'common', theme: 'fixture',
        uses: 500, sprite: 's_nature',
        config: {
            skill: 'cooking', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [],
            outputs: [
                { itemId: 'item_raw_beef', quantity: 1, chance: 100 },
                { itemId: 'item_bones', quantity: 1, chance: 100 }
            ]
        }
    }
});

function addHero(name, combat = null, level = 1) {
    const hero = generateHero({ name });
    if (combat) hero.skills[combat] = { level, xp: 0 };
    hero.status = 'idle';
    GameState.state.heroes.push(hero);
    return hero;
}
const give = (id, n = 1) => InventoryManager.addItem(id, n);
const equip = (hero, id) => {
    if (!InventoryManager.hasItem(id, 1)) give(id);
    return EquipmentManager.equipItem(hero.id, id);
};
const equipOk = (hero, id) => {
    const res = equip(hero, id);
    expect(res.success, res.error).toBe(true);
};

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
});
afterEach(() => vi.restoreAllMocks());

describe('a weapon names its style(s)', () => {
    it('reads `styles`, in the game\'s style order; an older item\'s one `skillRequired`; nothing else', () => {
        expect(weaponStylesOf(ITEMS.gear_copper_dagger)).toEqual(['melee', 'stealth']);
        expect(weaponStylesOf(ITEMS.gear_old_bow)).toEqual(['ranged']);
        expect(weaponStylesOf(ITEMS.gear_stick)).toEqual([]);
        expect(weaponStylesOf(weapon('x', 'X', { styles: ['melee', 'mining', 'nonsense'] }))).toEqual(['melee']);
        // A tool and a chest piece are not weapons, whatever they say.
        expect(isWeapon(ITEMS.gear_pick)).toBe(false);
        expect(isWeapon(ITEMS.gear_hide_vest)).toBe(false);
        expect(weaponStylesOf({ ...ITEMS.gear_pick, styles: ['melee'] })).toEqual([]);
    });

    it('refuses a Recruit any weapon, and a hero a weapon of another style; a style-less weapon suits any promoted hero', () => {
        expect(weaponRefusal(ITEMS.gear_copper_sword, null)).toBe(WEAPON_REFUSAL.RECRUIT);
        expect(weaponRefusal(ITEMS.gear_stick, null)).toBe(WEAPON_REFUSAL.RECRUIT);
        expect(weaponRefusal(ITEMS.gear_copper_sword, 'magic')).toBe(WEAPON_REFUSAL.STYLE);
        expect(weaponRefusal(ITEMS.gear_copper_dagger, 'melee')).toBeNull();
        expect(weaponRefusal(ITEMS.gear_copper_dagger, 'stealth')).toBeNull();
        expect(weaponRefusal(ITEMS.gear_copper_dagger, 'ranged')).toBe(WEAPON_REFUSAL.STYLE);
        expect(weaponRefusal(ITEMS.gear_stick, 'magic')).toBeNull();
        // A tool is never refused here: Recruits gather with them.
        expect(weaponRefusal(ITEMS.gear_pick, null)).toBeNull();
    });
});

describe('the equip paths: own style allowed, another style refused with a clear message', () => {
    it('a Fighter takes a Copper Sword: the copy leaves the Bank (one item, one hero)', () => {
        const fighter = addHero('Bram', 'melee');
        give('gear_copper_sword');
        equipOk(fighter, 'gear_copper_sword');
        expect(fighter.equipment).toContain('gear_copper_sword');
        expect(InventoryManager.getItemCount('gear_copper_sword')).toBe(0);
    });

    it('a Wizard is refused the sword, saying whose style it is; nothing moves', () => {
        const wizard = addHero('Mira', 'magic');
        give('gear_copper_sword');
        const res = EquipmentManager.equipItem(wizard.id, 'gear_copper_sword');
        expect(res).toEqual({ success: false, error: 'Mira fights with Magic: the Copper Sword is a Melee weapon' });
        expect(wizard.equipment.every(s => s === null)).toBe(true);
        expect(InventoryManager.getItemCount('gear_copper_sword')).toBe(1);
    });

    it('a Dagger is Melee and Stealth: a Fighter and a Rogue both take one; a Ranger is told both styles', () => {
        const fighter = addHero('Bram', 'melee');
        const rogue = addHero('Vex', 'stealth');
        const ranger = addHero('Lark', 'ranged');
        give('gear_copper_dagger', 3);
        equipOk(fighter, 'gear_copper_dagger');
        equipOk(rogue, 'gear_copper_dagger');
        expect(EquipmentManager.equipItem(ranger.id, 'gear_copper_dagger').error)
            .toBe('Lark fights with Ranged: the Copper Dagger is a Melee or Stealth weapon');
    });

    it('a Recruit is refused every weapon, but still takes a tool', () => {
        const recruit = addHero('Pip');
        give('gear_copper_sword');
        expect(EquipmentManager.equipItem(recruit.id, 'gear_copper_sword').error)
            .toBe('Recruits fight barehanded: promote Pip to use the Copper Sword');
        equipOk(recruit, 'gear_pick');
    });

    it('an older item\'s skillRequired style is honoured: a Ranger takes the Old Bow, a Fighter does not', () => {
        const ranger = addHero('Lark', 'ranged');
        const fighter = addHero('Bram', 'melee');
        give('gear_old_bow', 2);
        equipOk(ranger, 'gear_old_bow');
        expect(EquipmentManager.equipItem(fighter.id, 'gear_old_bow').success).toBe(false);
    });

    it('a hand-over from another hero\'s slot is refused for the wrong style, and the giver keeps the copy', () => {
        const fighter = addHero('Bram', 'melee');
        const wizard = addHero('Mira', 'magic');
        give('gear_copper_sword');
        equipOk(fighter, 'gear_copper_sword');
        const slot = fighter.equipment.indexOf('gear_copper_sword');
        const res = EquipmentManager.equipItem(wizard.id, 'gear_copper_sword', null, { heroId: fighter.id, slot });
        expect(res.success).toBe(false);
        expect(fighter.equipment[slot]).toBe('gear_copper_sword');
        expect(wizard.equipment).not.toContain('gear_copper_sword');
    });

    it('a dropped weapon of the wrong style says why where it was let go (the dock callout)', () => {
        const wizard = addHero('Mira', 'magic');
        give('gear_copper_sword');
        const said = [];
        const off = EventBus.subscribe(UI_EVENTS.UI_SCREEN_CALLOUT, ({ text }) => said.push(text));
        expect(equipOrAnnounce(EquipmentManager, wizard.id, 'gear_copper_sword')).toBe(false);
        off();
        expect(said).toEqual(['Mira fights with Magic: the Copper Sword is a Melee weapon']);
    });
});

describe('in a fight a hero swings only their own style', () => {
    const enemy = (style = 'melee', more = {}) => enemyProfileOf({ id: 'e', name: 'E', enemy: { level: 1, style, ...more } });

    it('a Fighter with a Dagger fights melee with it (1 every 2 s); a Rogue with the same Dagger fights stealth', () => {
        const fighter = addHero('Bram', 'melee');
        const rogue = addHero('Vex', 'stealth');
        give('gear_copper_dagger', 2);
        equipOk(fighter, 'gear_copper_dagger');
        equipOk(rogue, 'gear_copper_dagger');
        expect(CF.getHeroCombatStyle(fighter)).toBe('melee');
        expect(CF.getHeroCombatStyle(rogue)).toBe('stealth');
        expect(CF.heroAttackSpeedMs(fighter)).toBe(2000);
        expect(CF.heroBaseDamage(rogue)).toBe(1);
        // Stealth beats melee: the Rogue's 1 becomes 1.25, rounded to 1; against ranged the Fighter's 1 is 1.25 → 1.
        expect(CF.heroHitDamage(rogue, enemy('melee'))).toBe(1);
    });

    it('a weapon held from before a re-training is not swung, and its family\'s ability is off', () => {
        const hero = addHero('Bram', 'melee');
        give('gear_copper_spear');
        equipOk(hero, 'gear_copper_spear');
        expect(CF.heroPierce(hero)).toBe(1);

        // Re-trained to Wizard: the spear stays in hand (an older save, or a re-training) but does nothing.
        delete hero.skills.melee;
        hero.skills.magic = { level: 1, xp: 0 };
        EquipmentManager.recalculateEquipmentModifiers(hero);
        expect(CF.getHeroWeapon(hero)).toBeNull();
        expect(CF.heroBaseDamage(hero)).toBe(1);
        expect(CF.getHeroCombatStyle(hero)).toBe('magic');
        expect(CF.heroPierce(hero)).toBe(0);
        expect(HeroEffects.loadoutStatements(hero)).toEqual([]);
    });

    it('of two weapons in hand, the first of the hero\'s own style is swung', () => {
        const hero = addHero('Vex', 'stealth');
        hero.equipment[0] = 'gear_copper_sword';     // another style, from an older save
        hero.equipment[1] = 'gear_copper_rapier';
        expect(CF.getHeroWeapon(hero).id).toBe('gear_copper_rapier');
    });
});

describe('a family\'s ability is a Rules effect on the item; the tier raises the number', () => {
    const enemy = (more = {}) => enemyProfileOf({ id: 'e', name: 'E', enemy: { level: 1, style: 'magic', ...more } });

    it('Spear: Pierce 1 at copper, 2 at iron; against armour 2 the iron spear hits through', () => {
        const a = addHero('A', 'melee');
        const b = addHero('B', 'melee');
        equipOk(a, 'gear_copper_spear');
        equipOk(b, 'gear_iron_spear');
        expect(CF.heroPierce(a)).toBe(1);
        expect(CF.heroPierce(b)).toBe(2);
        // Copper 2 - (armour 2 - pierce 1) = 1; iron 3 - (2 - 2) = 3.
        expect(CF.heroHitDamage(a, enemy({ armor: 2 }))).toBe(1);
        expect(CF.heroHitDamage(b, enemy({ armor: 2 }))).toBe(3);
    });

    it('Bow: +5 Accuracy takes 5 points off the miss chance', () => {
        const ranger = addHero('Lark', 'ranged');
        const before = CF.heroMissChance(ranger, enemy({ dodge: 15 }));
        equipOk(ranger, 'gear_copper_bow');
        expect(CF.heroAccuracy(ranger)).toBe(5);
        expect(CF.heroMissChance(ranger, enemy({ dodge: 15 }))).toBe(before - 5);
    });

    it('Rapier: +5 crit chance at copper, +10 at iron (5 % base)', () => {
        const a = addHero('A', 'stealth');
        const b = addHero('B', 'stealth');
        equipOk(a, 'gear_copper_rapier');
        equipOk(b, 'gear_iron_rapier');
        expect(CF.heroCritChance(a)).toBe(10);
        expect(CF.heroCritChance(b)).toBe(15);
    });

    it('armour carries abilities the same way: a Cloak\'s Dodge makes enemies miss more', () => {
        const hero = addHero('A', 'melee');
        const foe = enemy();
        const before = CF.enemyMissChance(foe, hero);
        equipOk(hero, 'gear_cloak');
        expect(CF.heroDodge(hero)).toBe(10);
        expect(CF.enemyMissChance(foe, hero)).toBe(before + 10);
    });
});

describe('Hide Vest: poison stacks at most 1 lower', () => {
    // Statuses land only on a fighter; these heroes count as fighting.
    beforeEach(() => LiveEffects.setFightCheck(() => true));
    afterEach(() => LiveEffects.setFightCheck(null));
    const stacksOf = (hero, id) => LiveEffects.statusesOf(hero).find(s => s.effectId === id)?.stacks ?? 0;

    it('Poison (3 stacks) builds to 2 on a hero in a Hide Vest, 3 without', () => {
        const plain = addHero('A', 'melee');
        const vested = addHero('B', 'melee');
        equipOk(vested, 'gear_hide_vest');
        expect(CF.heroStatusStackCap(vested, POISON, 3)).toBe(2);
        for (let i = 0; i < 5; i++) {
            LiveEffects.applyToHero(plain.id, { effectId: POISON });
            LiveEffects.applyToHero(vested.id, { effectId: POISON });
        }
        expect(stacksOf(plain, POISON)).toBe(3);
        expect(stacksOf(vested, POISON)).toBe(2);
        // Only the status it names: Burn is untouched.
        expect(CF.heroStatusStackCap(vested, BURN, 1)).toBe(1);
    });

    it('a cap moved to 0 stops the status landing (said as a block); stacks already carried are never stripped', () => {
        const hero = addHero('A', 'melee');
        for (let i = 0; i < 3; i++) LiveEffects.applyToHero(hero.id, { effectId: POISON });
        const blocked = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.STATUS_BLOCKED, (p) => blocked.push(p.statusId));
        equipOk(hero, 'gear_thick_hide');               // scale 3: at most 3 lower
        expect(LiveEffects.applyToHero(hero.id, { effectId: POISON })).toBe(false);
        off();
        expect(blocked).toEqual([POISON]);
        expect(stacksOf(hero, POISON)).toBe(3);
    });
});

describe('Cleaver: a chance to double one item a kill or a cycle drops', () => {
    const fight = (hero) => {
        const at = { x: 400, y: 300 };
        const cow = BoardState.createTokenInstance('gear_cow', tokenStartingUses('gear_cow'));
        Placement.placeTokenAt(cow, at);
        TileModifiers.rebuildAround([cow]);
        Placement.plantFlagAt(hero.id, at);
        const kills = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.LOOT_GENERATED, (p) => kills.push(p.drops.map(d => [d.itemId, d.quantity])));
        for (let t = 0; t < 30000; t += 100) BoardRunner.tick(100);
        off();
        return kills;
    };

    it('the iron Cleaver (100 %) doubles every Raw Beef and never the Bones beside it', () => {
        const hero = addHero('Bram', 'melee', 50);
        hero.hp = { current: 60, max: 60 };
        equipOk(hero, 'gear_iron_cleaver');
        const kills = fight(hero);
        expect(kills.length).toBeGreaterThan(1);
        for (const drops of kills) expect(drops).toEqual([['item_bones', 1], ['item_raw_beef', 2]]);
    });

    it('without one, the kill is unchanged and no extra random number is drawn', () => {
        const hero = addHero('Bram', 'melee', 50);
        hero.hp = { current: 60, max: 60 };
        const kills = fight(hero);
        expect(kills.length).toBeGreaterThan(1);
        for (const drops of kills) expect(drops).toEqual([['item_bones', 1], ['item_raw_beef', 1]]);

        const random = vi.spyOn(Math, 'random');
        const cow = BoardState.tokens().find(t => t.typeId === 'gear_cow');
        expect(OutputRules.doubleItemDrop(cow.id, 'item_raw_beef', 1)).toBe(1);
        expect(random).not.toHaveBeenCalled();
    });

    it('the copper Cleaver (50 %) doubles about half the beef, and only beef', () => {
        const hero = addHero('Bram', 'melee', 50);
        hero.hp = { current: 60, max: 60 };
        equipOk(hero, 'gear_copper_cleaver');
        fight(hero);
        const cow = BoardState.tokens().find(t => t.typeId === 'gear_cow');
        expect(BoardState.workerOf(cow.id)).toBe(hero.id);
        let doubled = 0;
        const N = 400;
        for (let i = 0; i < N; i++) if (OutputRules.doubleItemDrop(cow.id, 'item_raw_beef', 1) === 2) doubled++;
        expect(doubled / N).toBeGreaterThan(0.4);
        expect(doubled / N).toBeLessThan(0.6);
        expect(OutputRules.doubleItemDrop(cow.id, 'item_bones', 1)).toBe(1);
    });

    it('work too: a hero with the iron Cleaver on a Butcher Block makes 2 Raw Beef a cycle, and 1 Bones', () => {
        const hero = addHero('Bram', 'melee', 1);
        hero.skills.cooking = { level: 1, xp: 0 };
        equipOk(hero, 'gear_iron_cleaver');
        const at = { x: 400, y: 300 };
        const block = BoardState.createTokenInstance('gear_butcher', tokenStartingUses('gear_butcher'));
        Placement.placeTokenAt(block, at);
        TileModifiers.rebuildAround([block]);
        Placement.plantFlagAt(hero.id, at);
        for (let t = 0; t < 12000; t += 100) BoardRunner.tick(100);
        const count = (id) => SpriteLayer.countOnBoard(id) + InventoryManager.getItemCount(id);
        const beef = count('item_raw_beef');
        const bones = count('item_bones');
        expect(bones).toBeGreaterThan(0);
        expect(beef).toBe(bones * 2);
    });
});

describe('the Rules editor offers the new modifiers', () => {
    it('Dodge, Pierce and Crit Chance are combat rows read as flat sums; Double Item Chance and Status Stack Limit are offered too', () => {
        const offered = paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type);
        for (const type of ['DODGE', 'PIERCE', 'CRIT_CHANCE', 'DOUBLE_DROP', 'STATUS_MAX_STACKS']) {
            expect(offered, type).toContain(type);
        }
        for (const type of ['DODGE', 'PIERCE', 'CRIT_CHANCE']) {
            expect(getPaletteEntry(type)).toMatchObject({ group: 'Combat', heroOnly: true, buckets: ['flat'] });
        }
        expect(getPaletteEntry('DOUBLE_DROP')).toMatchObject({ shape: 'proc', categories: 'item' });
        expect(getPaletteEntry('STATUS_MAX_STACKS')).toMatchObject({ heroOnly: true, categories: 'status' });
        expect(MODIFIER_PALETTE.filter(e => e.type === 'DODGE')).toHaveLength(1);
    });

    it('picking a combat axis starts the rule as a flat amount, the only bucket combat reads', () => {
        const statement = makeStatement(KEYWORD.PROVIDES);
        const typeSlot = slotsOf(statement).find(s => s.id === 'type');
        const picked = typeSlot.patch('PIERCE');
        expect(picked.payload).toEqual({ type: 'PIERCE', bucket: 'flat', value: 0 });
    });

    it('the item narrowing offers "Any item" and the items, and the sentence names the item', () => {
        const statement = { ...makeStatement(KEYWORD.PROVIDES), payload: { type: 'DOUBLE_DROP', bucket: 'flat', value: 10 } };
        const ctx = { items: { item_raw_beef: { id: 'item_raw_beef', name: 'Raw Beef' } } };
        const slot = slotsOf(statement, ctx).find(s => s.id === 'category');
        expect(slot.options.map(o => o.id)).toEqual(['', 'item_raw_beef']);
        const named = { ...statement, payload: { ...statement.payload, ...slot.patch('item_raw_beef').payload } };
        expect(renderStatement(named, { item: (id) => ctx.items[id]?.name || id }))
            .toContain('a 10% chance of double Raw Beef');
    });

    it('the Hide Vest reads as a sentence about poison, naming the status effect', () => {
        const statement = { ...makeStatement(KEYWORD.PROVIDES), payload: { type: 'STATUS_MAX_STACKS', bucket: 'flat', value: -1, category: POISON } };
        expect(renderStatement(statement, { effect: (id) => (id === POISON ? 'Poison' : id) })).toContain('Provides Poison stacks at most 1 lower');
    });

    it('the status narrowing offers the library status effects, and only those', () => {
        const statement = { ...makeStatement(KEYWORD.PROVIDES), payload: { type: 'STATUS_MAX_STACKS', bucket: 'flat', value: -1 } };
        const effects = {
            [POISON]: { id: POISON, name: 'Poison', status: { stacks: 3 } },
            gear_spear: { id: 'gear_spear', name: 'Spear' }
        };
        expect(slotsOf(statement, { effects }).find(s => s.id === 'category').options.map(o => o.id)).toEqual([POISON]);
    });
});

describe('the audit names a style that is not one', () => {
    it('a weapon style that is not a combat skill is reported', () => {
        const findings = findUnknownRefs({ items: { w: { id: 'w', name: 'W', equipSlot: 'hand', styles: ['melee', 'mining'] } } });
        expect(findings.map(f => f.field)).toEqual(['styles']);
        expect(findings[0].message).toContain('"mining"');
    });
});
