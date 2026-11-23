import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { registerTokenTypes, tokenStartingUses, getTokenType, rollOutputQuantity } from '../config/registries/tokenRegistry.js';
import { enemyDropsOf } from '../config/registries/enemyProfile.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { getHeroCombatStyle } from '../systems/combat/CombatFormulas.js';
import { effectBreakdown, EFFECT_KEY } from '../systems/board/EffectBreakdown.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { EventBus } from '../systems/core/EventBus.js';

/**
 * A kill is a cycle of the enemy Token, so a loot rule or a drop line means on a kill what it means on
 * a station's cycle: a rule narrowed to the fighter's style reaches the kill (as the kill's XP does),
 * a kill with no drop lines still drops the nearby Bonus Drops, and a drop line rolls the range a
 * station's output roll would.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const buff = (id, payload) => ({
    id, name: id, tokenType: 'buff', rarity: 'rare', theme: 'fixture', uses: null, sprite: 's_occult',
    statements: [{ id: `stm_${id}`, keyword: 'provides', to: { mode: 'all' }, payload }]
});
const enemy = (id, outputs) => ({
    id, name: id, tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 20, sprite: 's_occult',
    enemy: { level: 2, style: 'melee' },
    config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs }
});

registerTokenTypes({
    fixture_kls_melee_double: buff('fixture_kls_melee_double', { type: 'LOOT_MULT', bucket: 'flat', value: 100, category: 'melee' }),
    fixture_kls_ranged_double: buff('fixture_kls_ranged_double', { type: 'LOOT_MULT', bucket: 'flat', value: 100, category: 'ranged' }),
    fixture_kls_melee_yield: buff('fixture_kls_melee_yield', { type: 'YIELD', bucket: 'percentage', value: 1.0, category: 'melee' }),
    fixture_kls_combat_yield: buff('fixture_kls_combat_yield', { type: 'YIELD', bucket: 'percentage', value: 1.0, category: 'combat' }),
    fixture_kls_enemy: enemy('fixture_kls_enemy', [
        { itemId: 'item_blackberry', chance: 100, minQty: 1, maxQty: 1 },
        { itemId: 'fixture_oak_wood', chance: 100, minQty: 2, maxQty: 2 }
    ]),
    fixture_kls_enemy_bare: enemy('fixture_kls_enemy_bare', []),
    fixture_kls_enemy_odd_ranges: enemy('fixture_kls_enemy_odd_ranges', [
        { itemId: 'item_blackberry', chance: 100, minQty: 5, maxQty: 2 },
        { itemId: 'fixture_oak_wood', chance: 100, minQty: 5, quantity: 2 },
        { itemId: 'fixture_charcoal', chance: 100, quantity: 3 }
    ])
});

registerEffects({
    fixture_effect_kls_melee_yield: {
        id: 'fixture_effect_kls_melee_yield', name: 'Melee Haul',
        statements: [{ keyword: 'provides', to: { mode: 'all', value: '' },
            payload: { type: 'YIELD', bucket: 'percentage', value: 1.0, category: 'melee' } }]
    }
});
registerItems({
    kls_melee_yield_charm: { id: 'kls_melee_yield_charm', name: 'Melee Haul Charm', type: 'armor', equipSlot: 'trinket', effects: [{ effectId: 'fixture_effect_kls_melee_yield' }] },
    kls_bow: { id: 'kls_bow', name: 'KLS Bow', type: 'weapon', equipSlot: 'hand', styles: ['ranged'], damage: 2 }
});

const AT = { x: 400, y: 300 };

/** A strong hero, barehanded (so Melee) unless `items` holds a weapon. */
function makeHero(id = 'hero_1', items = []) {
    const hero = generateHero({ name: id });
    hero.id = id;
    hero.status = 'idle';
    hero.hp = { current: 100, max: 100 };
    Object.values(hero.skills).forEach(s => { s.level = 50; s.xp = 0; });
    hero.equipment = [...items, ...Array(9 - items.length).fill(null)];
    GameState.state.heroes = [hero];
    rehydrateHero(hero);
    for (const itemId of items) InventoryManager.addItem(itemId, 1);
    return hero;
}

/** The enemy Token on the mat, with each of `buffs` beside it. */
function enemyBeside(enemyTypeId, buffs = []) {
    const target = BoardState.createTokenInstance(enemyTypeId, tokenStartingUses(enemyTypeId));
    Placement.placeTokenAt(target, AT);
    const placed = [target];
    buffs.forEach((typeId, i) => {
        const b = BoardState.createTokenInstance(typeId, null);
        Placement.placeTokenAt(b, { x: AT.x + (i % 2 ? -70 : 70), y: AT.y + (i > 1 ? 70 : 0) });
        placed.push(b);
    });
    TileModifiers.rebuildAround(placed);
    return target;
}

/** One kill of `target` won by `heroId`, its drops read off the Token; the loot event. */
function kill(target, heroId = 'hero_1') {
    const seen = [];
    const unsub = EventBus.subscribe('loot_generated', p => seen.push(p));
    LootSystem.handleCombatVictory({
        heroId, enemyId: target.typeId, instanceId: target.id
    });
    unsub();
    return seen[0];
}

const landed = (loot) => loot.drops.map(d => [d.itemId, d.quantity]);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.maxSlots = 50;
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
});

afterEach(() => {
    getGlobalAggregator().removeModifiersBySource('test:star');
    vi.restoreAllMocks();
});

describe('a loot rule narrowed to a combat style reaches a kill in that style', () => {
    it('the fixture hero fights in Melee, barehanded', () => {
        expect(getHeroCombatStyle(makeHero())).toBe('melee');
        expect(getHeroCombatStyle(makeHero('hero_1', ['kls_bow']))).toBe('ranged');
    });

    it('Double Loot on Melee beside the enemy doubles a melee kill', () => {
        makeHero();
        const loot = kill(enemyBeside('fixture_kls_enemy', ['fixture_kls_melee_double']));
        expect(landed(loot)).toEqual([['item_blackberry', 2], ['fixture_oak_wood', 4]]);
    });

    it('Double Loot on Ranged does not touch a melee kill', () => {
        makeHero();
        const loot = kill(enemyBeside('fixture_kls_enemy', ['fixture_kls_ranged_double']));
        expect(landed(loot)).toEqual([['item_blackberry', 1], ['fixture_oak_wood', 2]]);
    });

    it('...and doubles a kill won with a bow', () => {
        makeHero('hero_1', ['kls_bow']);
        const loot = kill(enemyBeside('fixture_kls_enemy', ['fixture_kls_ranged_double']));
        expect(landed(loot)).toEqual([['item_blackberry', 2], ['fixture_oak_wood', 4]]);
    });

    it('Yield on Melee beside the enemy widens a melee kill', () => {
        makeHero();
        const loot = kill(enemyBeside('fixture_kls_enemy', ['fixture_kls_melee_yield']));
        expect(landed(loot)).toEqual([['item_blackberry', 2], ['fixture_oak_wood', 4]]);
    });

    it('Yield on every combat style widens a melee kill', () => {
        makeHero();
        const loot = kill(enemyBeside('fixture_kls_enemy', ['fixture_kls_combat_yield']));
        expect(landed(loot)).toEqual([['item_blackberry', 2], ['fixture_oak_wood', 4]]);
    });

    it('a guild-wide Yield on Melee (a Hall star) widens it', () => {
        makeHero();
        getGlobalAggregator().addModifier({
            source: 'test:star', type: EFFECT_TYPES.YIELD, bucket: 'percentage', target: { category: 'melee' }, value: 1.0
        });
        const loot = kill(enemyBeside('fixture_kls_enemy'));
        expect(landed(loot)).toEqual([['item_blackberry', 2], ['fixture_oak_wood', 4]]);
    });

    it('a Yield on Melee the fighter carries widens it', () => {
        const hero = makeHero('hero_1', ['kls_melee_yield_charm']);
        const target = enemyBeside('fixture_kls_enemy');
        Orders.orderAt(hero.id, AT);
        BoardRunner.tick(100);
        expect(BoardState.workerOf(target.id)).toBe(hero.id);
        const loot = kill(target, hero.id);
        expect(landed(loot)).toEqual([['item_blackberry', 2], ['fixture_oak_wood', 4]]);
    });

    it("the enemy's Double Loot and Yield badges read the fighter's style, as the kill does", () => {
        const hero = makeHero();
        const target = enemyBeside('fixture_kls_enemy', ['fixture_kls_melee_double', 'fixture_kls_melee_yield']);
        Orders.orderAt(hero.id, AT);
        BoardRunner.tick(100);
        expect(BoardState.workerOf(target.id)).toBe(hero.id);
        const out = effectBreakdown(target.id);
        const badge = (key) => out.effects.find(e => e.key === key) || null;
        expect(badge(EFFECT_KEY.DOUBLE_LOOT)?.final).toBe(100);
        expect(badge(EFFECT_KEY.YIELD)?.final).toBe(2);
    });

    it('in a live fight, Double Loot on Melee doubles every kill a melee hero wins', () => {
        const hero = makeHero();
        enemyBeside('fixture_kls_enemy', ['fixture_kls_melee_double']);
        const kills = [];
        const unsub = EventBus.subscribe('loot_generated', p => kills.push(p));
        Orders.orderAt(hero.id, AT);
        for (let t = 0; t < 60000 && kills.length < 2; t += 100) BoardRunner.tick(100);
        unsub();
        expect(kills.length).toBeGreaterThan(0);
        for (const k of kills) expect(landed(k)).toEqual([['item_blackberry', 2], ['fixture_oak_wood', 4]]);
    });
});

describe('a kill with no drop lines still drops what is granted nearby', () => {
    it('a Bonus Drop beside an enemy with no drops lands on its kill, as beside a station', () => {
        makeHero();
        const target = enemyBeside('fixture_kls_enemy_bare', ['fixture_bonus_drop']);
        expect(enemyDropsOf(getTokenType(target.typeId))).toEqual([]);
        kill(target);
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(1);
    });

    it('...and Double Loot doubles it', () => {
        makeHero();
        kill(enemyBeside('fixture_kls_enemy_bare', ['fixture_bonus_drop', 'fixture_buff_always_doubles']));
        expect(SpriteLayer.countOnBoard('fixture_charcoal')).toBe(2);
    });

    it('a kill with nothing at all still says so, with nothing on the mat', () => {
        makeHero();
        const loot = kill(enemyBeside('fixture_kls_enemy_bare'));
        expect(loot.drops).toEqual([]);
        expect(SpriteLayer.getSprites()).toEqual([]);
    });
});

describe('a drop line rolls the range a station would', () => {
    const DRAWS = [0, 0.3, 0.6, 0.999];
    const outputs = () => getTokenType('fixture_kls_enemy_odd_ranges').config.outputs;

    it('min above max rolls between the two on a kill, as on a station', () => {
        const line = { itemId: 'item_blackberry', chance: 100, minQty: 5, maxQty: 2 };
        for (const r of DRAWS) {
            vi.spyOn(Math, 'random').mockReturnValue(r);
            const [drop] = LootSystem.rollEachLine([line]);
            expect(drop.quantity).toBe(rollOutputQuantity(line, () => r));
            vi.restoreAllMocks();
        }
    });

    it('every line of an enemy reads its range as a station reads the same output', () => {
        for (const r of DRAWS) {
            vi.spyOn(Math, 'random').mockReturnValue(r);
            const drops = LootSystem.rollEachLine(enemyDropsOf(getTokenType('fixture_kls_enemy_odd_ranges')));
            vi.restoreAllMocks();
            expect(drops.map(d => d.quantity)).toEqual(outputs().map(o => rollOutputQuantity(o, () => r)));
        }
    });

    it('on the mat, an inverted line lands anywhere from 2 to 5', () => {
        makeHero();
        const target = enemyBeside('fixture_kls_enemy_odd_ranges');
        const seen = new Set();
        for (const r of DRAWS) {
            vi.spyOn(Math, 'random').mockReturnValue(r);
            const loot = kill(target);
            vi.restoreAllMocks();
            seen.add(loot.drops.find(d => d.itemId === 'item_blackberry').quantity);
        }
        expect([...seen].sort()).toEqual([2, 3, 4, 5]);
    });

    it('a line in the plain shape rolls as it always did', () => {
        const line = { itemId: 'item_blackberry', chance: 100, minQty: 1, maxQty: 3 };
        for (const r of DRAWS) {
            vi.spyOn(Math, 'random').mockReturnValue(r);
            const [drop] = LootSystem.rollEachLine([line]);
            vi.restoreAllMocks();
            expect(drop.quantity).toBe(1 + Math.floor(r * 3));
        }
    });
});
