import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
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
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { CARRIED_KIND } from '../config/registries/carriedKinds.js';
import { NO_AMMO_DAMAGE_FACTOR } from '../config/FormulaRegistry.js';
import { findUnknownRefs } from '../systems/core/unknownRefRule.js';
import { carriedKindOf } from '../systems/hero/carriedKind.js';
import * as CF from '../systems/combat/CombatFormulas.js';
import * as Ammo from '../systems/combat/Ammo.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import { heroSide } from '../ui/components/combat/fightView.js';
import { itemTipFacts } from '../ui/components/drawer/ItemTip.jsx';

/**
 * One ammo rule for a bow's arrows, a wand's Motes and a Kunai thrown (`Ammo.js`): one spent an
 * attack, hit or miss, from the Bank. Out of arrows the hero leaves the fight (the enemy keeping its
 * wounds) and says Needs; a hero with none never starts one. Out of Motes or spare Kunai the hero
 * fights on at half damage and says Needs once a fight. Preservation keeps any of the three.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const weapon = (id, name, extra) => ({ id, name, type: 'weapon', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', ...extra });
registerItems({
    am_bow: weapon('am_bow', 'Test Bow', { styles: ['ranged'], damage: 1, damageType: 'electric' }),
    am_arrow: { id: 'am_arrow', name: 'Test Arrow', type: 'material', equipSlot: 'consumable', stackable: true, arrow: { damage: 1, damageType: 'stab' } },
    am_fire_arrow: { id: 'am_fire_arrow', name: 'Test Fire Arrow', type: 'material', equipSlot: 'consumable', stackable: true, arrow: { damage: 1, damageType: 'fire' } },
    am_mote: { id: 'am_mote', name: 'Test Fire Mote', type: 'material', equipSlot: 'consumable', stackable: true },
    am_wand: weapon('am_wand', 'Test Wand', { styles: ['magic'], damage: 4, damageType: 'fire', mote: 'am_mote' }),
    am_free_wand: weapon('am_free_wand', 'Free Wand', { styles: ['magic'], damage: 4, damageType: 'fire' }),
    am_kunai: weapon('am_kunai', 'Test Kunai', { styles: ['stealth'], damage: 4, speed: 'fast', thrown: true }),
    am_dagger: weapon('am_dagger', 'Test Dagger', { styles: ['stealth'], damage: 4, speed: 'fast' }),
    am_ammo_charm: { id: 'am_ammo_charm', name: 'Thrift Charm', type: 'armor', equipSlot: 'hat', stackable: true, effects: [{ effectId: 'am_thrift', scale: 1 }] }
});
registerEffects({
    am_thrift: {
        id: 'am_thrift', name: 'Thrift',
        statements: [{ id: 'stm_am_thrift', keyword: 'provides', to: null, payload: { type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value: 100, category: CARRIED_KIND.AMMO } }]
    }
});
registerTokenTypes({
    am_dummy: {
        id: 'am_dummy', name: 'Dummy', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult', requiresHero: true,
        // Never hits back: the hero's health never ends a test.
        enemy: { level: 1, style: 'melee', hp: 500, hit: 0 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    },
    // Even with Stealth (Ranged and Stealth are opposites), so a Kunai's hit is its own.
    am_dummy_ranged: {
        id: 'am_dummy_ranged', name: 'Ranged Dummy', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, sprite: 's_occult', requiresHero: true,
        enemy: { level: 1, style: 'ranged', hp: 500, hit: 0 },
        config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] }
    }
});

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
function startFight(hero, at = AT, typeId = 'am_dummy') {
    const enemy = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(enemy, at);
    TileModifiers.rebuildAround([enemy]);
    Orders.orderAt(hero.id, at);
    return enemy;
}
function play(ms, step = 100) {
    const seen = { hero: [], needs: [] };
    const offs = [
        EventBus.subscribe(ENGINE_EVENTS.COMBAT_HERO_ATTACK, (p) => seen.hero.push(p)),
        EventBus.subscribe(BOARD_EVENTS.INPUT_NEEDED, (p) => seen.needs.push(p))
    ];
    for (let t = 0; t < ms; t += step) {
        LiveEffects.tick(step, TriggerSystem.fireLiveStatement);
        BoardRunner.tick(step);
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
});
afterEach(() => vi.restoreAllMocks());

describe('arrows: out of them, the hero leaves the fight and says so', () => {
    it('shoots its three arrows, leaves after the third, and the enemy keeps its wounds and heals', () => {
        const archer = addHero('Cara', { ranged: 10 });
        equip(archer, 'am_bow');
        equip(archer, 'am_arrow', 3);
        const enemy = startFight(archer);
        const seen = play(30000);
        expect(seen.hero).toHaveLength(3);
        expect(seen.hero.every(p => p.arrowId === 'am_arrow' && p.ammoId === 'am_arrow')).toBe(true);
        expect(InventoryManager.getItemCount('am_arrow')).toBe(0);
        // No longer fighting, still ordered onto the enemy, and not working it.
        expect(BoardCombat.fightOfHero(archer.id)).toBeNull();
        expect(BoardState.workTokenOf(archer.id)).toBeNull();
        expect(Flags.pinnedIdOf(archer.id)).toBe(enemy.id);
        // "Needs Test Arrow", carried, the hero having let go of the enemy for it.
        expect(seen.needs.at(-1)).toMatchObject({ heroId: archer.id, itemId: 'am_arrow', needed: 1, carried: true, left: true, instanceId: enemy.id });
        expect(Flags.skipsOfHero(archer.id).map(s => s.reason)).toEqual([ALERT.NO_AMMO]);
    });

    it('the enemy it left keeps its damage, then heals back while the hero waits', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);   // every shot lands, none crits
        const archer = addHero('Cara', { ranged: 10 });
        equip(archer, 'am_bow');
        equip(archer, 'am_arrow', 2);
        // Even with Ranged: each shot is the bow's 1 and the arrow's 1.
        const enemy = startFight(archer, AT, 'am_dummy_ranged');
        // Until the hero lets go: then the enemy is as hurt as the two shots left it.
        let fought = false;
        for (let t = 0; t < 12000 && !(fought && !BoardCombat.fightOfHero(archer.id)); t += 100) {
            play(100);
            fought = fought || !!BoardCombat.fightOfHero(archer.id);
        }
        expect(fought).toBe(true);
        expect(BoardCombat.fightOfHero(archer.id)).toBeNull();
        const hurt = BoardCombat.enemyHealthOf(enemy);
        expect(hurt.current).toBe(hurt.max - 4);
        expect(enemy.fightHp?.current).toBe(hurt.max - 4);
        // Out of the fight it heals (5 % a second), and nobody fights it meanwhile.
        const later = play(1000);
        expect(later.hero).toHaveLength(0);
        expect(BoardCombat.enemyHealthOf(enemy).current).toBe(hurt.max);
    });

    it('a hero holding a bow with no arrow the Bank holds starts no fight and says the same', () => {
        const archer = addHero('Cara', { ranged: 10 });
        equip(archer, 'am_bow');
        equip(archer, 'am_arrow', 1);
        InventoryManager.removeItem('am_arrow', 1);
        expect(Ammo.leavesWithout(archer)).toBe(true);
        expect(WorkCheck.carriedStop(archer.id, { typeId: 'am_dummy' })).toBe(ALERT.NO_AMMO);
        const enemy = startFight(archer);
        const seen = play(10000);
        expect(seen.hero).toHaveLength(0);
        expect(BoardCombat.fightOfHero(archer.id)).toBeNull();
        expect(seen.needs[0]).toMatchObject({ heroId: archer.id, itemId: 'am_arrow', carried: true, left: true, instanceId: enemy.id });

        // Arrows back in the Bank: the hero takes the fight up again.
        InventoryManager.addItem('am_arrow', 2);
        const again = play(10000);
        expect(again.hero.length).toBe(2);
    });

    it('a hero carrying no arrow at all names an arrow the game has', () => {
        const archer = addHero('Cara', { ranged: 10 });
        equip(archer, 'am_bow');
        expect(Ammo.ammoNeedOf(archer)?.itemId).toBeTruthy();
        expect(Ammo.carriedArrowIds(archer)).toEqual([]);
        startFight(archer);
        const watched = play(5000);
        expect(watched.hero).toHaveLength(0);
        expect(watched.needs[0]?.itemId).toBe(Ammo.ammoNeedOf(archer).itemId);
    });

    it('with two kinds carried the next is shot when the first runs out; Needs names the first carried', () => {
        const archer = addHero('Cara', { ranged: 10 });
        equip(archer, 'am_bow');
        equip(archer, 'am_fire_arrow', 1);
        equip(archer, 'am_arrow', 1);
        startFight(archer);
        const seen = play(20000);
        expect(seen.hero.map(p => p.arrowId)).toEqual(['am_fire_arrow', 'am_arrow']);
        expect(seen.needs.at(-1).itemId).toBe('am_fire_arrow');
    });

    it('a sword hero carrying arrows spends none and never stops for them', () => {
        const fighter = addHero('Bram', { melee: 10 });
        expect(Ammo.ammoRuleOf(fighter)).toBeNull();
        expect(Ammo.leavesWithout(fighter)).toBe(false);
        equip(fighter, 'am_arrow', 3);
        startFight(fighter);
        const seen = play(12000);
        expect(seen.hero.length).toBeGreaterThan(2);
        expect(seen.hero.every(p => p.arrowId === null && !('ammoId' in p))).toBe(true);
        expect(InventoryManager.getItemCount('am_arrow')).toBe(3);
    });
});

describe('Motes: every cast spends one; with none, half damage and Needs once a fight', () => {
    it('spends one a cast, hit or miss, then casts at half and says Needs Fire Mote once', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const mage = addHero('Aela', { magic: 10 });
        equip(mage, 'am_wand');
        equip(mage, 'am_mote', 2);
        startFight(mage);
        const seen = play(40000);
        expect(seen.hero.length).toBeGreaterThan(4);
        const [a, b, ...rest] = seen.hero;
        expect([a.ammoId, b.ammoId]).toEqual(['am_mote', 'am_mote']);
        expect(InventoryManager.getItemCount('am_mote')).toBe(0);
        expect(rest.every(p => p.short === true && !('ammoId' in p))).toBe(true);
        // 4 Fire, even matchup: 4 a cast, 2 at half.
        expect(a.damage).toBe(4);
        expect(rest.every(p => p.damage === 4 * NO_AMMO_DAMAGE_FACTOR)).toBe(true);
        // Still fighting, and said once for the fight.
        expect(BoardCombat.fightOfHero(mage.id)).not.toBeNull();
        expect(seen.needs).toHaveLength(1);
        expect(seen.needs[0]).toMatchObject({ heroId: mage.id, itemId: 'am_mote', needed: 1, carried: true });
        expect(seen.needs[0]).not.toHaveProperty('left');
    });

    it('a Mote in the Bank but not carried casts at half', () => {
        const mage = addHero('Aela', { magic: 10 });
        equip(mage, 'am_wand');
        InventoryManager.addItem('am_mote', 5);
        expect(Ammo.isShort(mage)).toBe(true);
        expect(Ammo.ammoNeedOf(mage)).toEqual({ itemId: 'am_mote', needed: 1, carried: true });
        startFight(mage);
        const seen = play(10000);
        expect(seen.hero.length).toBeGreaterThan(1);
        expect(seen.hero.every(p => p.short)).toBe(true);
        expect(InventoryManager.getItemCount('am_mote')).toBe(5);
    });

    it('a Magic weapon naming no Mote casts free at full damage', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const mage = addHero('Aela', { magic: 10 });
        equip(mage, 'am_free_wand');
        expect(Ammo.ammoRuleOf(mage)).toBeNull();
        startFight(mage);
        const seen = play(10000);
        expect(seen.hero.length).toBeGreaterThan(1);
        expect(seen.hero.every(p => p.damage === 4 && !p.short)).toBe(true);
        expect(seen.needs).toHaveLength(0);
    });

    it('a new fight says it again', () => {
        const mage = addHero('Aela', { magic: 10 });
        equip(mage, 'am_wand');
        startFight(mage, { x: 400, y: 300 });
        const one = play(6000);
        expect(one.needs).toHaveLength(1);
        // The fight ends (the hero sent elsewhere), and a new one begins.
        BoardCombat.endFightOfHero(mage.id);
        Flags.init();
        startFight(mage, { x: 900, y: 300 });
        const two = play(6000);
        expect(two.needs).toHaveLength(1);
    });
});

describe('Kunai: thrown, spending themselves; the one in hand kept for half damage', () => {
    it('each throw spends one from the Bank; with none there, the one in hand at half, Needs once', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const thief = addHero('Vex', { stealth: 10 });
        equip(thief, 'am_kunai', 3);   // one in hand, two more in the Bank
        expect(InventoryManager.getItemCount('am_kunai')).toBe(2);
        startFight(thief, AT, 'am_dummy_ranged');
        const seen = play(20000);
        expect(seen.hero.slice(0, 2).every(p => p.ammoId === 'am_kunai' && p.damage === 4)).toBe(true);
        expect(seen.hero.slice(2).length).toBeGreaterThan(2);
        expect(seen.hero.slice(2).every(p => p.short && p.damage === 2)).toBe(true);
        expect(InventoryManager.getItemCount('am_kunai')).toBe(0);
        // The one in hand stays in hand.
        expect(CF.getHeroWeapon(thief)?.id).toBe('am_kunai');
        expect(seen.needs).toHaveLength(1);
        expect(seen.needs[0]).toMatchObject({ heroId: thief.id, itemId: 'am_kunai', needed: 1 });
        expect(seen.needs[0]).not.toHaveProperty('carried');
    });

    it('a dagger needs nothing', () => {
        const thief = addHero('Vex', { stealth: 10 });
        equip(thief, 'am_dagger', 3);
        expect(Ammo.ammoRuleOf(thief)).toBeNull();
        startFight(thief);
        const seen = play(10000);
        expect(seen.hero.length).toBeGreaterThan(2);
        expect(InventoryManager.getItemCount('am_dagger')).toBe(2);
    });

    it('the thrown flag counts only on a Stealth weapon', () => {
        const odd = addHero('Odd', { melee: 10 });
        registerItems({ am_thrown_sword: weapon('am_thrown_sword', 'Thrown Sword', { styles: ['melee'], damage: 2, thrown: true }) });
        equip(odd, 'am_thrown_sword', 3);
        expect(Ammo.ammoRuleOf(odd)).toBeNull();
    });
});

describe('Preservation keeps all three', () => {
    it('a 100 % ammo rule keeps every arrow, Mote and Kunai', () => {
        const archer = addHero('Cara', { ranged: 10 });
        equip(archer, 'am_bow');
        equip(archer, 'am_arrow', 2);
        equip(archer, 'am_ammo_charm');
        const mage = addHero('Aela', { magic: 10 });
        equip(mage, 'am_wand');
        equip(mage, 'am_mote', 2);
        equip(mage, 'am_ammo_charm');
        const thief = addHero('Vex', { stealth: 10 });
        equip(thief, 'am_kunai', 3);
        equip(thief, 'am_ammo_charm');
        startFight(archer, { x: 300, y: 300 });
        startFight(mage, { x: 900, y: 300 });
        startFight(thief, { x: 1500, y: 300 });
        const seen = play(15000);
        const by = (id) => seen.hero.filter(p => p.heroId === id);
        expect(by(archer.id).length).toBeGreaterThan(3);
        expect(by(archer.id).every(p => p.ammoKept)).toBe(true);
        expect(by(mage.id).every(p => p.ammoKept && !p.short)).toBe(true);
        expect(by(thief.id).every(p => p.ammoKept && !p.short)).toBe(true);
        expect(InventoryManager.getItemCount('am_arrow')).toBe(2);
        expect(InventoryManager.getItemCount('am_mote')).toBe(2);
        expect(InventoryManager.getItemCount('am_kunai')).toBe(2);
        // Each counts as ammo for a Preservation rule's hover.
        expect(['am_arrow', 'am_mote', 'am_kunai'].map(carriedKindOf)).toEqual([CARRIED_KIND.AMMO, CARRIED_KIND.AMMO, CARRIED_KIND.AMMO]);
    });
});

describe('what the screen and the content check say', () => {
    it('the hero sheet shows a cast at half with its line once the Motes are out', () => {
        const mage = addHero('Aela', { magic: 10 });
        equip(mage, 'am_wand');
        equip(mage, 'am_mote', 3);
        expect(heroSide(mage).ammo).toMatchObject({ kind: 'mote', itemId: 'am_mote', count: 3, short: false });
        expect(heroSide(mage).hit).toBe(4);
        InventoryManager.removeItem('am_mote', 3);
        expect(heroSide(mage).ammo).toMatchObject({ short: true, count: 0 });
        expect(heroSide(mage).hit).toBe(2);
        expect(heroSide(mage).hitLines.some(l => l.includes('Test Fire Mote') && l.includes('half'))).toBe(true);
    });

    it('the item tooltip says what a wand burns and that a Kunai is thrown', () => {
        expect(itemTipFacts({ id: 'am_wand', name: 'Test Wand', type: 'weapon', equipSlot: 'hand', styles: ['magic'], mote: 'am_mote' }).ammo).toContain('Test Fire Mote');
        expect(itemTipFacts({ id: 'am_kunai', type: 'weapon', equipSlot: 'hand', styles: ['stealth'], thrown: true }).ammo).toMatch(/Thrown/);
        expect(itemTipFacts({ id: 'am_dagger', type: 'weapon', equipSlot: 'hand', styles: ['stealth'] }).ammo).toBeNull();
    });

    it('the content check names a wand with no Mote, a Mote that is no Consumable, and a thrown flag off Stealth', () => {
        const findings = findUnknownRefs({
            tokens: {},
            items: {
                w_free: { id: 'w_free', equipSlot: 'hand', styles: ['magic'] },
                w_bad: { id: 'w_bad', equipSlot: 'hand', styles: ['magic'], mote: 'gone' },
                w_hat: { id: 'w_hat', equipSlot: 'hand', styles: ['magic'], mote: 'hat' },
                hat: { id: 'hat', name: 'Hat', equipSlot: 'hat' },
                s_thrown: { id: 's_thrown', equipSlot: 'hand', styles: ['melee'], thrown: true },
                k: { id: 'k', equipSlot: 'hand', styles: ['stealth'], thrown: true },
                m: { id: 'm', equipSlot: 'consumable' },
                w_ok: { id: 'w_ok', equipSlot: 'hand', styles: ['magic'], mote: 'm' }
            },
            effects: {}
        });
        const text = findings.map(f => `${f.entityId}|${f.field}|${f.message}`);
        expect(text.some(t => t.startsWith('w_free|mote') && t.includes('casts free'))).toBe(true);
        expect(text.some(t => t.startsWith('w_bad|mote') && t.includes('"gone"'))).toBe(true);
        expect(text.some(t => t.startsWith('w_hat|mote') && t.includes('not a Consumable'))).toBe(true);
        expect(text.some(t => t.startsWith('s_thrown|thrown'))).toBe(true);
        expect(text.filter(t => /^(k|m|w_ok)\|/.test(t))).toEqual([]);
    });
});
