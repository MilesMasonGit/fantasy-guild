import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as FightMoments from '../systems/board/FightMoments.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EquipmentManager } from '../systems/equipment/EquipmentManager.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getAllSkillIds } from '../config/registries/skillRegistry.js';
import { ModifierAggregator } from '../systems/effects/ModifierAggregator.js';
import * as CombatFormulas from '../systems/combat/CombatFormulas.js';
import { activeElixirsOf } from '../ui/components/combat/fightView.js';
import { equipOrAnnounce, unequipOrAnnounce } from '../ui/components/dock/dockEquip.js';
import { equipBubbleOf, clearEquipBubbles } from '../ui/components/dock/equipBubbles.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * No loadout changes while a hero trades blows: from the moment an enemy steps up until it falls
 * or the hero leaves. Between enemies, and off the mat, the loadout is open as ever. One guard in
 * the engine's equip, move and unequip, so every gesture on screen gets the same refusal.
 */

const SPOT = { x: 400, y: 400 };

registerEffects({
    lock_valor: { id: 'lock_valor', name: 'Valor', statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: 'DAMAGE', bucket: 'flat', value: 1 }, to: null }] },
    lock_elixir_valor: {
        id: 'lock_elixir_valor', name: 'Elixir of Valor', statements: [{
            ...makeStatement(KEYWORD.APPLIES),
            when: { event: 'COMBAT_ENGAGED', scope: 'self' },
            payload: { effectId: 'lock_valor', scale: 1, durationMs: 0, forFight: true, chance: 100 }
        }]
    }
});

const weapon = (id, name, extra) => ({ id, name, type: 'weapon', equipSlot: 'hand', stackable: true, ...extra });
registerItems({
    lock_sword: weapon('lock_sword', 'Lock Sword', { styles: ['melee'], damage: 1 }),
    lock_greatsword: weapon('lock_greatsword', 'Lock Greatsword', { styles: ['melee'], damage: 1, speed: 'slow', hands: 2 }),
    lock_dagger: weapon('lock_dagger', 'Lock Dagger', { styles: ['melee'], damage: 1, speed: 'fast' }),
    lock_wand: weapon('lock_wand', 'Lock Wand', { styles: ['magic'], damage: 1, speed: 'fast' }),
    lock_bread: { id: 'lock_bread', name: 'Lock Bread', equipSlot: 'food', stackable: true, restoreAmount: 5 },
    lock_elixir: { id: 'lock_elixir', name: 'Lock Elixir', equipSlot: 'consumable', stackable: true, effects: [{ effectId: 'lock_elixir_valor' }] }
});

function makeHero(id) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.name = id;
    hero.status = 'idle';
    hero.hp = { current: 1000, max: 1000 };
    for (const s of getAllSkillIds()) hero.skills[s] = { level: 60, xp: 0 };
    hero.equipment = Array(9).fill(null);
    hero.aggregator = new ModifierAggregator(hero.id);
    return hero;
}

let hero;
let other;
let engagements;
let victories;
let callouts;
let offs = [];

const step = () => BoardRunner.tick(100);

function give(heroId, itemId) {
    InventoryManager.addItem(itemId, 1);
    expect(EquipmentManager.equipItem(heroId, itemId).success).toBe(true);
}

/** Send the hero at a fresh enemy and tick until it steps up: blows are now being traded. */
function fight() {
    const instance = BoardState.createTokenInstance('fixture_enemy', tokenStartingUses('fixture_enemy'));
    Placement.placeTokenAt(instance, SPOT);
    TileModifiers.rebuildAround([instance]);
    Orders.orderAt(hero.id, SPOT);
    untilEngagements(1);
    expect(BoardCombat.tradingBlows(hero.id)).toBe(true);
    return instance;
}

function untilEngagements(n) {
    const target = engagements.length + n;
    for (let i = 0; i < 20000 && engagements.length < target; i++) step();
    expect(engagements.length).toBe(target);
}

/** Tick until the enemy falls: the hero rests before the next one steps up. */
function untilKill() {
    const target = victories.length + 1;
    for (let i = 0; i < 20000 && victories.length < target; i++) step();
    expect(victories.length).toBe(target);
    expect(BoardCombat.fightOfHero(hero.id)).not.toBeNull();
    expect(BoardCombat.tradingBlows(hero.id)).toBe(false);
}

const fightingRefusal = (name = 'hero_1') => ({ success: false, error: `${name} is fighting` });

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    FightMoments.init();
    LoadoutMoments.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
    clearEquipBubbles();
    hero = makeHero('hero_1');
    other = makeHero('hero_2');
    GameState.state.heroes = [hero, other];
    GameState.state.inventory.maxSlots = 50;

    engagements = [];
    victories = [];
    callouts = [];
    offs = [
        EventBus.subscribe(BOARD_EVENTS.COMBAT_ENGAGED, (p) => engagements.push(p)),
        EventBus.subscribe(BOARD_EVENTS.COMBAT_RESOLVED, (p) => { if (p.outcome === 'victory') victories.push(p); }),
        EventBus.subscribe(UI_EVENTS.UI_SCREEN_CALLOUT, (p) => callouts.push(p.text))
    ];
});

afterEach(() => {
    offs.forEach(off => off());
    offs = [];
});

describe('a hero trading blows keeps their loadout', () => {
    it('refuses a Bank item put on them, naming who is fighting', () => {
        give(hero.id, 'lock_sword');
        fight();
        InventoryManager.addItem('lock_bread', 3);
        const before = [...hero.equipment];

        expect(EquipmentManager.equipItem(hero.id, 'lock_bread')).toEqual(fightingRefusal());
        expect(EquipmentManager.equipItem(hero.id, 'lock_bread', 4)).toEqual(fightingRefusal());
        expect(hero.equipment).toEqual(before);
    });

    it('refuses a move within the loadout, a right-click and a drag to the Bank', () => {
        give(hero.id, 'lock_sword');
        give(hero.id, 'lock_bread');
        fight();
        const before = [...hero.equipment];
        const swordSlot = hero.equipment.indexOf('lock_sword');

        expect(EquipmentManager.moveItem(hero.id, 'lock_sword', swordSlot, 8)).toEqual(fightingRefusal());
        expect(EquipmentManager.unequipItem(hero.id, swordSlot)).toEqual(fightingRefusal());
        expect(hero.equipment).toEqual(before);
        expect(InventoryManager.getItemCount('lock_sword')).toBe(0);
    });

    it('refuses a hand-over to a fighting taker and from a fighting giver, leaving both as they were', () => {
        give(hero.id, 'lock_sword');
        give(other.id, 'lock_dagger');
        fight();
        const mine = [...hero.equipment];
        const theirs = [...other.equipment];

        const daggerFrom = { heroId: other.id, slot: other.equipment.indexOf('lock_dagger') };
        expect(EquipmentManager.equipItem(hero.id, 'lock_dagger', null, daggerFrom)).toEqual(fightingRefusal());
        const swordFrom = { heroId: hero.id, slot: hero.equipment.indexOf('lock_sword') };
        expect(EquipmentManager.equipItem(other.id, 'lock_sword', null, swordFrom)).toEqual(fightingRefusal());
        expect(EquipmentManager.equipItem(other.id, 'lock_sword', 5, swordFrom)).toEqual(fightingRefusal());

        expect(hero.equipment).toEqual(mine);
        expect(other.equipment).toEqual(theirs);
    });

    it('says why over the hero on every route on screen', () => {
        give(hero.id, 'lock_sword');
        fight();
        InventoryManager.addItem('lock_wand', 1);
        const swordSlot = hero.equipment.indexOf('lock_sword');

        expect(equipOrAnnounce(EquipmentManager, hero.id, 'lock_wand', null, null)).toBe(false);
        expect(equipBubbleOf(hero.id)?.text).toBe("Can't equip Lock Wand. hero_1 is fighting.");

        expect(equipOrAnnounce(EquipmentManager, hero.id, 'lock_sword', 7, { fromHeroId: hero.id, fromSlot: swordSlot })).toBe(false);
        expect(equipBubbleOf(hero.id)?.text).toBe("Can't equip Lock Sword. hero_1 is fighting.");

        expect(unequipOrAnnounce(EquipmentManager, hero.id, swordSlot)).toBe(false);
        expect(callouts).toEqual(['hero_1 is fighting']);
    });

    it('still lets the fight itself take gear (a lost fight)', () => {
        give(hero.id, 'lock_sword');
        fight();
        expect(EquipmentManager.destroyEquipped(hero.id, hero.equipment.indexOf('lock_sword')).success).toBe(true);
        expect(hero.equipment).not.toContain('lock_sword');
    });

    it('leaves other heroes free: one not fighting changes gear from the Bank as ever', () => {
        give(hero.id, 'lock_sword');
        fight();
        InventoryManager.addItem('lock_wand', 1);
        expect(EquipmentManager.equipItem(other.id, 'lock_wand').success).toBe(true);
    });
});

describe('the loadout opens between enemies and when the hero leaves', () => {
    it('opens while the hero rests after a kill, and locks again when the next enemy steps up', () => {
        give(hero.id, 'lock_sword');
        fight();
        untilKill();
        InventoryManager.addItem('lock_bread', 1);
        expect(EquipmentManager.equipItem(hero.id, 'lock_bread').success).toBe(true);

        untilEngagements(1);
        expect(BoardCombat.tradingBlows(hero.id)).toBe(true);
        expect(EquipmentManager.unequipItem(hero.id, hero.equipment.indexOf('lock_bread'))).toEqual(fightingRefusal());
    });

    it('opens once the hero is sent home', () => {
        give(hero.id, 'lock_sword');
        fight();
        Orders.sendHome(hero.id);
        expect(BoardCombat.fightOfHero(hero.id)).toBeNull();
        expect(EquipmentManager.unequipItem(hero.id, hero.equipment.indexOf('lock_sword')).success).toBe(true);
    });
});

describe('what a mid-fight change used to buy', () => {
    it('a kill pays its XP into the style the fight was fought in: no switch to a wand before the kill', () => {
        hero.skills.melee = { level: 30, xp: 0 };
        hero.skills.magic = { level: 1, xp: 0 };
        give(hero.id, 'lock_sword');
        fight();
        InventoryManager.addItem('lock_wand', 1);
        expect(EquipmentManager.equipItem(hero.id, 'lock_wand')).toEqual(fightingRefusal());

        untilKill();
        expect(hero.skills.magic.xp).toBe(0);
        expect(hero.skills.melee.xp).toBeGreaterThan(0);
    });

    it('no burst: a dagger handed to a hero swinging a slow greatsword is refused, so the swing time stays', () => {
        give(hero.id, 'lock_greatsword');
        give(other.id, 'lock_dagger');
        fight();
        const slow = CombatFormulas.heroAttackSpeedMs(hero);
        const from = { heroId: other.id, slot: other.equipment.indexOf('lock_dagger') };
        expect(EquipmentManager.equipItem(hero.id, 'lock_dagger', null, from)).toEqual(fightingRefusal());
        expect(CombatFormulas.getHeroWeapon(hero)?.id).toBe('lock_greatsword');
        expect(CombatFormulas.heroAttackSpeedMs(hero)).toBe(slow);
    });

    it('an elixir with fights left cannot be put on mid-fight, so the fight panel never counts it a fight too many', () => {
        hero.elixirFights = { lock_elixir: 5 };
        InventoryManager.addItem('lock_elixir', 2);
        give(hero.id, 'lock_sword');
        fight();

        expect(EquipmentManager.equipItem(hero.id, 'lock_elixir')).toEqual(fightingRefusal());
        expect(activeElixirsOf(hero)).toEqual([]);

        untilKill();
        expect(EquipmentManager.equipItem(hero.id, 'lock_elixir').success).toBe(true);
        expect(activeElixirsOf(hero)).toEqual([expect.objectContaining({ itemId: 'lock_elixir', left: 5, count: 5 })]);

        untilEngagements(1);
        expect(activeElixirsOf(hero)).toEqual([expect.objectContaining({ itemId: 'lock_elixir', left: 4, count: 5 })]);
    });
});
