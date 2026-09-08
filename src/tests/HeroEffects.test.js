import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as HeroEffects from '../systems/hero/HeroEffects.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import { makeStatement, KEYWORD } from '../systems/effects/statements.js';
import { renderStatement } from '../systems/effects/statementText.js';
import { MAX_SCALE } from '../systems/effects/effectLibrary.js';
import './fixtures/testTokens.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';

/** A tile well away from the Guild Hall's reserved square. */
const TILE = 10;

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * A hero's loadout as a bearer — Unified Effects P4.
 *
 * Items carry the same named library effects Tokens carry. What differs is the
 * two things this file is about:
 *
 * 1. **The loadout is one bearer, not nine.** Two items naming one effect merge,
 *    their scales add, and the total is capped at 5 (UE-19).
 * 2. **The inventory stack is the charge pool** (UE-21). An item has no
 *    `usesRemaining` and cannot have one — it is a fungible id in a shared
 *    stack — so a rule's authored cost is spent as units of the item itself. A
 *    rule costing 0 is never consumed, which is how weapons and armour are built.
 */

const YIELD_STATEMENT = {
    ...makeStatement(KEYWORD.PROVIDES),
    payload: { type: 'YIELD', bucket: 'percentage', value: 0.05 },
};

const statementFor = (keyword, payload, extra = {}) => ({ ...makeStatement(keyword), payload, ...extra });

/** A hero holding the given item ids, without going through the equip rules. */
function heroCarrying(...itemIds) {
    const hero = { id: 'hero_test', name: 'Tester', equipment: [...itemIds] };
    while (hero.equipment.length < 9) hero.equipment.push(null);
    return hero;
}

beforeEach(() => {
    // The Bank has slot capacity only once a game exists — a fresh GameState
    // starts with none, so `addItem` would hand every fixture item to the board
    // as litter (D-138) instead of banking it.
    GameState.initNew();
    InventoryManager.init();

    registerEffects({
        fixture_effect_trawler: {
            id: 'fixture_effect_trawler',
            name: 'Shrimp Trawler',
            statements: [YIELD_STATEMENT],
        },
        fixture_effect_potion: {
            id: 'fixture_effect_potion',
            name: 'Draught of Vigour',
            statements: [statementFor(
                KEYWORD.APPLIES,
                { statusId: 'well_fed', stacks: 1, chance: 100, target: 'hero' },
                { chargeDelta: -1 },
            )],
        },
    });

    registerItems({
        fixture_sword: { id: 'fixture_sword', name: 'Sword', effects: [{ effectId: 'fixture_effect_trawler', scale: 2 }] },
        fixture_charm: { id: 'fixture_charm', name: 'Charm', effects: [{ effectId: 'fixture_effect_trawler', scale: 3 }] },
        fixture_relic: { id: 'fixture_relic', name: 'Relic', effects: [{ effectId: 'fixture_effect_trawler', scale: 4 }] },
        fixture_potion: { id: 'fixture_potion', name: 'Potion', effects: [{ effectId: 'fixture_effect_potion', scale: 1 }] },
        fixture_plain: { id: 'fixture_plain', name: 'Plain Rock' },
    });

    for (const id of ['fixture_sword', 'fixture_charm', 'fixture_relic', 'fixture_potion', 'fixture_plain']) {
        InventoryManager.addItem(id, 5);
    }
});

describe('the loadout is one bearer, not nine', () => {
    it('carries an item’s effect at the scale that item names', () => {
        const statements = HeroEffects.loadoutStatements(heroCarrying('fixture_sword'));
        expect(statements).toHaveLength(1);
        expect(statements[0].scale).toBe(2);
        expect(statements[0].payload.value).toBeCloseTo(0.10);
        expect(statements[0].effectTitle).toBe('Shrimp Trawler II');
    });

    it('adds the scales of two items naming one effect, and applies it ONCE', () => {
        const statements = HeroEffects.loadoutStatements(heroCarrying('fixture_sword', 'fixture_charm'));
        // Not two statements at 2 and 3 — one at 5.
        expect(statements).toHaveLength(1);
        expect(statements[0].scale).toBe(5);
        expect(statements[0].payload.value).toBeCloseTo(0.25);
    });

    it('caps the total at 5 however much the player piles on', () => {
        const statements = HeroEffects.loadoutStatements(
            heroCarrying('fixture_sword', 'fixture_charm', 'fixture_relic')
        );
        expect(statements).toHaveLength(1);
        expect(statements[0].scale).toBe(MAX_SCALE);
    });

    it('remembers every item that granted the merged effect', () => {
        const statements = HeroEffects.loadoutStatements(heroCarrying('fixture_sword', 'fixture_charm'));
        expect(statements[0].sourceItemIds).toEqual(['fixture_sword', 'fixture_charm']);
    });

    it('ignores items with no rules, and empty slots', () => {
        expect(HeroEffects.loadoutStatements(heroCarrying('fixture_plain', null))).toEqual([]);
        expect(HeroEffects.loadoutStatements(heroCarrying())).toEqual([]);
    });

    it('contributes nothing from an item the Bank has run out of (UE-22)', () => {
        InventoryManager.removeItem('fixture_sword', 5);
        expect(HeroEffects.loadoutStatements(heroCarrying('fixture_sword'))).toEqual([]);
    });
});

describe('the stack is the charge pool (UE-21)', () => {
    it('spends one unit of the item when its rule fires', () => {
        const [statement] = HeroEffects.loadoutStatements(heroCarrying('fixture_potion'));
        const before = InventoryManager.getItemCount('fixture_potion');

        expect(HeroEffects.payLoadoutCost(statement)).toBe(true);
        expect(InventoryManager.getItemCount('fixture_potion')).toBe(before - 1);
    });

    it('never consumes a rule that costs nothing — weapons and armour', () => {
        const [statement] = HeroEffects.loadoutStatements(heroCarrying('fixture_sword'));
        const before = InventoryManager.getItemCount('fixture_sword');

        expect(HeroEffects.payLoadoutCost(statement)).toBe(true);
        expect(InventoryManager.getItemCount('fixture_sword')).toBe(before);
    });

    it('spends ONE item when two granted the merged effect, not both', () => {
        // Carrying a spare must not make each firing twice as expensive.
        registerItems({
            fixture_potion_b: { id: 'fixture_potion_b', name: 'Potion B', effects: [{ effectId: 'fixture_effect_potion' }] },
        });
        InventoryManager.addItem('fixture_potion_b', 5);

        const [statement] = HeroEffects.loadoutStatements(heroCarrying('fixture_potion', 'fixture_potion_b'));
        expect(statement.sourceItemIds).toEqual(['fixture_potion', 'fixture_potion_b']);

        HeroEffects.payLoadoutCost(statement);
        expect(InventoryManager.getItemCount('fixture_potion')).toBe(4);
        expect(InventoryManager.getItemCount('fixture_potion_b')).toBe(5);
    });

    it('refuses to fire on credit when nothing is left to spend', () => {
        const [statement] = HeroEffects.loadoutStatements(heroCarrying('fixture_potion'));
        InventoryManager.removeItem('fixture_potion', 5);

        expect(HeroEffects.canPayLoadoutCost(statement)).toBe(false);
        expect(HeroEffects.payLoadoutCost(statement)).toBe(false);
    });

    it('can be asked whether it is affordable WITHOUT spending', () => {
        const [statement] = HeroEffects.loadoutStatements(heroCarrying('fixture_potion'));
        const before = InventoryManager.getItemCount('fixture_potion');

        expect(HeroEffects.canPayLoadoutCost(statement)).toBe(true);
        expect(InventoryManager.getItemCount('fixture_potion')).toBe(before);
    });
});

describe('an item’s rules read truthfully (UE-24)', () => {
    it('says who a carried status lands on', () => {
        const toHero = statementFor(KEYWORD.APPLIES, { statusId: 'well_fed', stacks: 1, chance: 100, target: 'hero' });
        const toEnemy = statementFor(KEYWORD.APPLIES, { statusId: 'poison', stacks: 2, chance: 100, target: 'enemy' });

        expect(renderStatement(toHero, {})).toContain('to the hero carrying it');
        expect(renderStatement(toEnemy, {})).toContain('to the enemy its hero is fighting');
    });

    it('leaves a Token’s reading alone when no target is named', () => {
        const onToken = statementFor(KEYWORD.APPLIES, { statusId: 'well_fed', stacks: 1, chance: 100 });
        expect(renderStatement(onToken, {})).toContain('heroes on adjacent');
    });
});

describe('the legacy gear pipeline is gone (UE-16)', () => {
    it('registers no equipment modifiers at all any more', () => {
        const hero = heroCarrying('fixture_sword');
        hero.aggregator = {
            modifiers: new Map([['equip:0', {}], ['skill:mining', {}]]),
            removeModifiersBySource: vi.fn(function (id) { this.modifiers.delete(id); }),
            addModifier: vi.fn(),
        };

        EquipmentManager.recalculateEquipmentModifiers(hero);

        // It wipes what the deleted pipeline left on an existing save...
        expect(hero.aggregator.modifiers.has('equip:0')).toBe(false);
        // ...leaves everything else alone, and writes nothing new.
        expect(hero.aggregator.modifiers.has('skill:mining')).toBe(true);
        expect(hero.aggregator.addModifier).not.toHaveBeenCalled();
    });
});

describe('a carried rule reaches the tile its hero is working', () => {
    it('adds the loadout’s Provides into resolveAxis, alongside tile and guild', () => {
        GameState.state.heroes = [{
            id: 'hero_1', name: 'hero_1', status: 'idle',
            equipment: ['fixture_sword', null, null, null, null, null, null, null, null],
            hp: { current: 100, max: 100 }, skills: {},
        }];

        const instance = BoardState.createTokenInstance('fixture_producer', 100);
        Placement.placeToken(TILE, instance);
        TileModifiers.rebuildAround(TILE);

        // Nobody standing here: the tile resolves its own base.
        expect(TileModifiers.resolveAxis(TILE, EFFECT_TYPES.YIELD, 10)).toBeCloseTo(10);

        // The hero arrives carrying a +5% Yield effect at scale 2 — the number
        // travels with the person, not the square, which is the whole reason
        // the hero is a third scope rather than a cached tile modifier.
        Placement.placeHero('hero_1', TILE);
        expect(TileModifiers.resolveAxis(TILE, EFFECT_TYPES.YIELD, 10)).toBeCloseTo(11);
    });

    it('stops contributing the moment the Bank runs dry (UE-22)', () => {
        GameState.state.heroes = [{
            id: 'hero_1', name: 'hero_1', status: 'idle',
            equipment: ['fixture_sword', null, null, null, null, null, null, null, null],
            hp: { current: 100, max: 100 }, skills: {},
        }];

        const instance = BoardState.createTokenInstance('fixture_producer', 100);
        Placement.placeToken(TILE, instance);
        TileModifiers.rebuildAround(TILE);
        Placement.placeHero('hero_1', TILE);

        expect(TileModifiers.resolveAxis(TILE, EFFECT_TYPES.YIELD, 10)).toBeCloseTo(11);

        // No rebuild, no re-equip — the loadout is read live, so an emptied
        // Bank is felt on the very next resolution.
        InventoryManager.removeItem('fixture_sword', 5);
        expect(TileModifiers.resolveAxis(TILE, EFFECT_TYPES.YIELD, 10)).toBeCloseTo(10);
    });
});
