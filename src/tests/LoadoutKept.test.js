import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import * as HeroEffects from '../systems/hero/HeroEffects.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

withoutShippedPerks();

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * A hero's loadout statements are kept per hero rather than expanded on every read (the work time
 * reads them for every worked Token every tick). These tests change each thing the loadout is made
 * from, through the game's own paths and by writing the state straight, and see the new statements
 * on the very next read, mid-run included.
 */

const provides = (type, value, extra = {}) => ({
    ...makeStatement(KEYWORD.PROVIDES), payload: { type, bucket: 'percentage', value, ...extra }, to: null
});
const nestOnStart = () => ({
    ...makeStatement(KEYWORD.GRANTS),
    payload: { type: 'BONUS_DROP', itemId: 'lk_nest', quantity: 1, chance: 100 },
    when: { event: 'WORK_START', scope: 'self' }, to: null, chargeDelta: -1
});

registerEffects({
    lk_fx_quick: { id: 'lk_fx_quick', name: 'Quick Hands', statements: [provides(EFFECT_TYPES.WORK_TIME, -0.5)] },
    lk_fx_quicker: { id: 'lk_fx_quicker', name: 'Quicker Hands', statements: [provides(EFFECT_TYPES.WORK_TIME, -0.25)] },
    lk_fx_rush: { id: 'lk_fx_rush', name: 'Felling Rush', statements: [provides(EFFECT_TYPES.WORK_TIME, -0.5, { category: 'forestry' })] },
    lk_fx_nest: { id: 'lk_fx_nest', name: 'Nest Finder', statements: [nestOnStart()] }
});

const item = (id, equipSlot, effectId, extra = {}) => ({
    id, name: id, equipSlot, stackable: true, sprite: 'i_potion_shrimp_pink', effects: [{ effectId }], ...extra
});
registerItems({
    lk_nest: { id: 'lk_nest', name: 'Nest', stackable: true },
    lk_log: { id: 'lk_log', name: 'Log', stackable: true },
    lk_junk: { id: 'lk_junk', name: 'Junk', stackable: true },
    lk_quick_charm: item('lk_quick_charm', 'trinket', 'lk_fx_quick'),
    lk_quicker_hat: item('lk_quicker_hat', 'hat', 'lk_fx_quicker'),
    lk_guard_hat: item('lk_guard_hat', 'hat', 'lk_fx_quicker', { skillRequired: 'melee', levelRequired: 15 }),
    lk_nest_potion: item('lk_nest_potion', 'consumable', 'lk_fx_nest')
});

registerTokenTypes({
    lk_tree: {
        id: 'lk_tree', name: 'lk_tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature',
        requiresHero: true,
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 4000, xp: 10, inputs: [], outputs: [{ itemId: 'lk_log', quantity: 1, chance: 100 }] }
    }
});

const TREE_AT = { x: 400, y: 400 };
const BASE = 4000;

let hero;
let ticks;
let completions;
let offs = [];

function makeHero(id) {
    const h = generateHero({ name: id });
    h.id = id;
    h.status = 'idle';
    h.hp = { current: 100, max: 100 };
    for (const s of getAllSkillIds()) h.skills[s] = { level: 60, xp: xpForLevel(60) };
    h.equipment = Array(9).fill(null);
    h.aggregator = new ModifierAggregator(h.id);
    return h;
}

/** The loadout read afresh: a copy of the hero is a hero the kept answers have never seen. */
const fresh = (h) => HeroEffects.loadoutStatements({ ...h });
const ids = (statements) => statements.map(s => s.sourceEffectId);
const workTime = (tree) => TileModifiers.workTimeOf(tree.id, BASE, 'forestry');

function placeTree() {
    const tree = BoardState.createTokenInstance('lk_tree', tokenStartingUses('lk_tree'));
    Placement.placeTokenAt(tree, TREE_AT);
    TileModifiers.rebuildAround([tree]);
    Orders.orderAt(hero.id, TREE_AT);
    return tree;
}

const step = () => { ticks += 1; BoardRunner.tick(100); };

/** Tick until `n` more cycles have completed. */
function untilCycles(n) {
    const target = completions.length + n;
    for (let i = 0; i < 20000 && completions.length < target; i++) step();
    expect(completions.length).toBe(target);
}

/** Ticks between the last two completions. */
const lastGap = () => completions[completions.length - 1].tick - completions[completions.length - 2].tick;

beforeEach(() => {
    offs.forEach(off => off());
    ticks = 0;
    completions = [];
    offs = [EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, (p) => completions.push({ ...p, tick: ticks }))];

    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    LoadoutMoments.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    hero = makeHero('hero_lk');
    GameState.state.heroes = [hero];
    GameState.state.inventory.maxSlots = 50;
    registerSkillPerks({ forestry: { perks: [{ level: 10, effectId: 'lk_fx_rush' }] } });
});

afterEach(() => {
    registerSkillPerks({ forestry: { perks: [] } });
});

describe('the loadout is kept, not expanded on every read', () => {
    it('hands back the same frozen answer while nothing it is made from changes', () => {
        InventoryManager.addItem('lk_quick_charm', 1);
        EquipmentManager.equipItem(hero.id, 'lk_quick_charm');
        const first = HeroEffects.loadoutStatements(hero);
        expect(ids(first)).toEqual(['lk_fx_quick', 'lk_fx_rush']);
        expect(HeroEffects.loadoutStatements(hero)).toBe(first);
        expect(Object.isFrozen(first)).toBe(true);
        expect(first.every(Object.isFrozen)).toBe(true);
    });

    it('keeps it while the Bank fills with things no slot names', () => {
        hero.equipment[0] = 'lk_nest_potion';
        InventoryManager.addItem('lk_nest_potion', 3);
        const first = HeroEffects.loadoutStatements(hero);
        InventoryManager.addItem('lk_junk', 40);
        InventoryManager.removeItem('lk_junk', 10);
        InventoryManager.removeItem('lk_nest_potion', 2);
        expect(HeroEffects.loadoutStatements(hero)).toBe(first);
    });
});

describe('gear: every change shows on the next read', () => {
    it('equipping, moving and taking off an item, through the equip rules', () => {
        InventoryManager.addItem('lk_quick_charm', 1);
        InventoryManager.addItem('lk_quicker_hat', 1);
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_rush']);

        EquipmentManager.equipItem(hero.id, 'lk_quick_charm');
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_quick', 'lk_fx_rush']);

        EquipmentManager.equipItem(hero.id, 'lk_quicker_hat');
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_quick', 'lk_fx_quicker', 'lk_fx_rush']);

        const hatSlot = hero.equipment.indexOf('lk_quicker_hat');
        EquipmentManager.moveItem(hero.id, 'lk_quicker_hat', hatSlot, 8);
        expect(HeroEffects.loadoutStatements(hero)).toEqual(fresh(hero));
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_quick', 'lk_fx_quicker', 'lk_fx_rush']);
        EquipmentManager.moveItem(hero.id, 'lk_quicker_hat', 8, 0);
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_quicker', 'lk_fx_quick', 'lk_fx_rush']);

        EquipmentManager.unequipItem(hero.id, hero.equipment.indexOf('lk_quick_charm'));
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_quicker', 'lk_fx_rush']);
        expect(HeroEffects.loadoutStatements(hero)).toEqual(fresh(hero));
    });

    it('a grid written straight, as an older save or a test does', () => {
        InventoryManager.addItem('lk_quick_charm', 1);
        HeroEffects.loadoutStatements(hero);
        hero.equipment[4] = 'lk_quick_charm';
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_quick', 'lk_fx_rush']);
        hero.equipment[4] = null;
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_rush']);
        hero.equipment = [...hero.equipment];
        hero.equipment[2] = 'lk_quick_charm';
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_quick', 'lk_fx_rush']);
    });

    it('a copy held in the hands lends with the Bank empty; a link to the Bank only while it has one', () => {
        InventoryManager.addItem('lk_quick_charm', 1);
        EquipmentManager.equipItem(hero.id, 'lk_quick_charm');
        expect(InventoryManager.getItemCount('lk_quick_charm')).toBe(0);
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_quick', 'lk_fx_rush']);

        // The mark taken off by hand: now the slot is a link to an empty Bank stack.
        delete hero.heldCopies;
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_rush']);
        hero.heldCopies = hero.equipment.map(id => id === 'lk_quick_charm');
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_quick', 'lk_fx_rush']);
    });
});

describe('the Bank: a shared item counts while the Bank has one, read at once', () => {
    it('leaves as the last one is spent and comes back with the next one in', () => {
        hero.equipment[0] = 'lk_nest_potion';
        InventoryManager.addItem('lk_nest_potion', 2);
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_nest', 'lk_fx_rush']);

        const [potion] = HeroEffects.loadoutStatements(hero);
        expect(HeroEffects.payLoadoutCost(potion)).toBe(true);
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_nest', 'lk_fx_rush']);
        expect(HeroEffects.payLoadoutCost(potion)).toBe(true);
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_rush']);

        InventoryManager.addItem('lk_nest_potion', 1);
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_nest', 'lk_fx_rush']);
    });

    it('follows a Bank replaced or written straight (a load, a new game, a dev button)', () => {
        hero.equipment[0] = 'lk_nest_potion';
        InventoryManager.addItem('lk_nest_potion', 2);
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_nest', 'lk_fx_rush']);

        GameState.state.inventory.items = {};
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_rush']);
        GameState.state.inventory.items.lk_nest_potion = { quantity: 1, dur: null };
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_nest', 'lk_fx_rush']);
        GameState.state.inventory.items.lk_nest_potion.quantity = 0;
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_rush']);
    });
});

describe('levels: a perk or a gear requirement reached shows on the next read', () => {
    it('a perk crossed by XP', () => {
        hero.skills.forestry = { level: 9, xp: xpForLevel(10) - 1 };
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual([]);
        SkillSystem.addXP(hero.id, 'forestry', 1);
        expect(hero.skills.forestry.level).toBe(10);
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_rush']);
    });

    it('a level written straight, and a villager, who holds no perk', () => {
        hero.skills.forestry.level = 9;
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual([]);
        hero.skills.forestry.level = 10;
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_rush']);
        hero.skills.forestry = { level: 5, xp: 0 };
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual([]);
        hero.skills = { ...hero.skills, forestry: { level: 12, xp: 0 } };
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_rush']);
        hero.isVillager = true;
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual([]);
    });

    it('gear lends from the level its wearer meets it', () => {
        hero.skills.melee = { level: 14, xp: xpForLevel(15) - 1 };
        hero.skills.forestry = { level: 1, xp: 0 };
        hero.equipment[1] = 'lk_guard_hat';
        hero.heldCopies = hero.equipment.map(id => !!id);
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual([]);
        SkillSystem.addXP(hero.id, 'melee', 1);
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_quicker']);
    });
});

describe('content registered again shows on the next read', () => {
    it('an item, an effect and a perk table', () => {
        InventoryManager.addItem('lk_quick_charm', 1);
        EquipmentManager.equipItem(hero.id, 'lk_quick_charm');
        expect(HeroEffects.loadoutStatements(hero)[0].payload.value).toBe(-0.5);

        try {
            registerItems({ lk_quick_charm: item('lk_quick_charm', 'trinket', 'lk_fx_quicker') });
            expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_quicker', 'lk_fx_rush']);

            registerEffects({ lk_fx_quicker: { id: 'lk_fx_quicker', name: 'Quicker Hands', statements: [provides(EFFECT_TYPES.WORK_TIME, -0.75)] } });
            expect(HeroEffects.loadoutStatements(hero)[0].payload.value).toBe(-0.75);

            registerSkillPerks({ forestry: { perks: [] } });
            expect(ids(HeroEffects.loadoutStatements(hero))).toEqual(['lk_fx_quicker']);
        } finally {
            registerEffects({ lk_fx_quicker: { id: 'lk_fx_quicker', name: 'Quicker Hands', statements: [provides(EFFECT_TYPES.WORK_TIME, -0.25)] } });
            registerItems({ lk_quick_charm: item('lk_quick_charm', 'trinket', 'lk_fx_quick') });
        }
        expect(HeroEffects.loadoutStatements(hero)).toEqual(fresh(hero));
    });
});

describe('the kept answer is always the answer read afresh', () => {
    it('through a long run of every kind of change', () => {
        const items = ['lk_quick_charm', 'lk_quicker_hat', 'lk_guard_hat', 'lk_nest_potion'];
        for (const id of items) InventoryManager.addItem(id, 3);
        const roll = (n) => Math.floor(Math.random() * n);
        for (let i = 0; i < 400; i++) {
            const kind = roll(7);
            const id = items[roll(items.length)];
            if (kind === 0) EquipmentManager.equipItem(hero.id, id);
            else if (kind === 1) EquipmentManager.unequipItem(hero.id, roll(9));
            else if (kind === 2) InventoryManager.addItem(id, 1 + roll(2));
            else if (kind === 3) InventoryManager.removeItem(id, Math.min(InventoryManager.getItemCount(id), 1 + roll(2)));
            else if (kind === 4) hero.skills[roll(2) ? 'forestry' : 'melee'].level = 1 + roll(30);
            else if (kind === 5) hero.equipment[roll(9)] = roll(3) ? id : null;
            else if (kind === 6) hero.isVillager = roll(4) === 0;
            expect(HeroEffects.loadoutStatements(hero)).toEqual(fresh(hero));
        }
    });
});

describe('mid-run: the work time follows the loadout at once', () => {
    it('an item equipped part-way through a cycle', () => {
        hero.skills.forestry = { level: 1, xp: 0 };
        const tree = placeTree();
        untilCycles(2);
        expect(lastGap()).toBe(40);
        expect(workTime(tree)).toBe(BASE);

        InventoryManager.addItem('lk_quick_charm', 1);
        EquipmentManager.equipItem(hero.id, 'lk_quick_charm');
        expect(workTime(tree)).toBe(BASE / 2);
        untilCycles(2);
        expect(lastGap()).toBe(20);

        EquipmentManager.unequipItem(hero.id, hero.equipment.indexOf('lk_quick_charm'));
        expect(workTime(tree)).toBe(BASE);
    });

    it('a perk reached by the cycle that just completed', () => {
        hero.skills.forestry = { level: 9, xp: xpForLevel(10) - 1 };
        const tree = placeTree();
        expect(workTime(tree)).toBe(BASE);
        untilCycles(1);
        expect(hero.skills.forestry.level).toBe(10);
        expect(workTime(tree)).toBe(BASE / 2);
        untilCycles(2);
        expect(lastGap()).toBe(20);
    });

    it('a slot linked to the Bank, when the Bank runs out and fills again', () => {
        hero.skills.forestry = { level: 1, xp: 0 };
        hero.equipment[3] = 'lk_quick_charm';       // no held mark: an older save's link to the Bank
        InventoryManager.addItem('lk_quick_charm', 1);
        const tree = placeTree();
        untilCycles(1);
        expect(workTime(tree)).toBe(BASE / 2);

        InventoryManager.removeItem('lk_quick_charm', 1);
        expect(workTime(tree)).toBe(BASE);
        untilCycles(2);
        expect(lastGap()).toBe(40);

        InventoryManager.addItem('lk_quick_charm', 1);
        expect(workTime(tree)).toBe(BASE / 2);
    });

    it('a shared potion stops firing its On Work Start as the Bank runs dry', () => {
        hero.skills.forestry = { level: 1, xp: 0 };
        hero.equipment[0] = 'lk_nest_potion';
        InventoryManager.addItem('lk_nest_potion', 2);
        placeTree();
        untilCycles(4);
        expect(InventoryManager.getItemCount('lk_nest_potion')).toBe(0);
        expect(SpriteLayer.countOnBoard('lk_nest') + InventoryManager.getItemCount('lk_nest')).toBe(2);
        expect(ids(HeroEffects.loadoutStatements(hero))).toEqual([]);
    });

    it('a live effect still counts and ends on its own clock', () => {
        hero.skills.forestry = { level: 1, xp: 0 };
        const tree = placeTree();
        HeroEffects.loadoutStatements(hero);
        expect(LiveEffects.applyToHero(hero.id, { effectId: 'lk_fx_quick', scale: 1, durationMs: 60000 })).toBeTruthy();
        expect(workTime(tree)).toBe(BASE / 2);
        LiveEffects.removeFromHero(hero.id, 'lk_fx_quick');
        expect(workTime(tree)).toBe(BASE);
    });
});
