import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { handleVictory } from '../systems/combat/CombatResolutionProcessor.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { EFFECTS, registerEffects } from '../config/registries/effectRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';

/**
 * Every XP bonus is skill-specific, combat skills included: a bonus aimed at a kill's style (Melee,
 * Ranged, Magic, Stealth) widens that kill's XP, an all-skills bonus widens it as it widens every work
 * cycle, and a bonus aimed elsewhere leaves it alone. A kill reads the same three scopes a work cycle
 * does: the enemy Token's, the guild's (Hall stars) and the loadout of the hero fighting it.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const xpBonusStatement = (category) => ({
    keyword: 'provides',
    payload: { type: 'XP_BONUS', bucket: 'percentage', value: 0.5, ...(category ? { category } : {}) },
    to: { mode: 'all', value: '' }
});

registerEffects({
    fixture_effect_melee_xp: { id: 'fixture_effect_melee_xp', name: 'Melee Study', statements: [xpBonusStatement('melee')] },
    fixture_effect_ranged_xp: { id: 'fixture_effect_ranged_xp', name: 'Ranged Study', statements: [xpBonusStatement('ranged')] }
});

registerItems({
    xpb_melee_charm: { id: 'xpb_melee_charm', name: 'Melee Charm', type: 'armor', equipSlot: 'trinket', effects: [{ effectId: 'fixture_effect_melee_xp' }] },
    xpb_ranged_charm: { id: 'xpb_ranged_charm', name: 'Ranged Charm', type: 'armor', equipSlot: 'trinket', effects: [{ effectId: 'fixture_effect_ranged_xp' }] },
    xpb_merry_charm: { id: 'xpb_merry_charm', name: 'Merry Charm', type: 'armor', equipSlot: 'trinket', effects: [{ effectId: 'effect_merry' }] }
});

const C = (i) => ({ x: 400 + (i % 6) * 160, y: 200 + Math.floor(i / 6) * 160 });

/** A strong barehanded hero (so Melee), carrying `items` in the first slots. */
function makeHero(id, items = []) {
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

function place(tile, typeId, heroId) {
    const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
    Placement.placeTokenAt(instance, C(tile));
    TileModifiers.rebuildAround([instance]);
    if (heroId) Orders.orderAt(heroId, C(tile));
    return instance;
}

/** The XP one kill worth `award` gives `hero`, won in a live fight on an enemy Token. */
function killXp(hero, award = 10) {
    const enemy = place(10, 'fixture_enemy', hero.id);
    BoardRunner.tick(100);
    const fight = BoardCombat.getFight(enemy.id);
    expect(fight).not.toBeNull();
    expect(BoardState.workerOf(enemy.id)).toBe(hero.id);

    const before = hero.skills.melee.xp;
    // A copy of the live fight: its enemy Token and its hero, without ending the real one.
    handleVictory({ ...fight, combat: { state: {} }, drops: [] }, hero,
        { id: 'fixture_enemy', name: 'Fixture Enemy', xpAwarded: award }, hero.id, [hero.id]);
    return hero.skills.melee.xp - before;
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    GameState.state.inventory.maxSlots = 50;
    BoardCombat.init();
    BoardCombat.clearAll();
    TileModifiers.clearAll();
});

afterEach(() => {
    getGlobalAggregator().removeModifiersBySource('test:star');
});

describe('a kill gets its style\'s XP bonuses', () => {
    it('no bonus leaves the award unchanged', () => {
        expect(killXp(makeHero('h1'))).toBe(10);
    });

    it('a Melee XP bonus the hero carries raises a melee kill\'s XP', () => {
        expect(killXp(makeHero('h1', ['xpb_melee_charm']))).toBe(15);
    });

    it('a Ranged XP bonus does not touch a melee kill', () => {
        expect(killXp(makeHero('h1', ['xpb_ranged_charm']))).toBe(10);
    });

    it('a guild-wide Melee XP bonus (a Hall star) raises it too', () => {
        getGlobalAggregator().addModifier({
            source: 'test:star', type: EFFECT_TYPES.XP_BONUS, target: { category: 'melee' }, value: 0.2
        });
        expect(killXp(makeHero('h1'))).toBe(12);
    });

    it("the guild's and the hero's bonuses sum into one percentage, as for work", () => {
        getGlobalAggregator().addModifier({
            source: 'test:star', type: EFFECT_TYPES.XP_BONUS, target: { category: 'melee' }, value: 0.2
        });
        // +20% and +50% give +70%, not x1.8.
        expect(killXp(makeHero('h1', ['xpb_melee_charm']))).toBe(17);
    });

    it('a guild-wide Ranged XP bonus does not touch a melee kill', () => {
        getGlobalAggregator().addModifier({
            source: 'test:star', type: EFFECT_TYPES.XP_BONUS, target: { category: 'ranged' }, value: 0.2
        });
        expect(killXp(makeHero('h1'))).toBe(10);
    });

    it('the shipped all-skills bonus, Merry, applies to kills as it does to work', () => {
        // Merry names no skill: it is the all-skills case.
        const merry = EFFECTS.effect_merry;
        expect(merry).toBeTruthy();
        const xpRules = merry.statements.filter(s => s.payload?.type === 'XP_BONUS');
        expect(xpRules.length).toBeGreaterThan(0);
        for (const rule of xpRules) expect(rule.payload.category ?? '').toBe('');
        const value = xpRules.reduce((sum, r) => sum + r.payload.value, 0);

        expect(killXp(makeHero('h1', ['xpb_merry_charm']), 20)).toBe(Math.round(20 * (1 + value)));
    });

    it('keeps the +1 floor: +10% on a 1 XP kill gives 2', () => {
        getGlobalAggregator().addModifier({
            source: 'test:star', type: EFFECT_TYPES.XP_BONUS, target: { category: 'melee' }, value: 0.1
        });
        expect(killXp(makeHero('h1'), 1)).toBe(2);
    });
});

describe('work XP is unchanged', () => {
    /** The Forestry XP of one work cycle (4 XP authored) for `hero`. */
    function cycleXp(hero) {
        place(11, 'fixture_producer', hero.id);
        const before = hero.skills.forestry.xp;
        for (let t = 0; t < 12000; t += 100) BoardRunner.tick(100);
        return hero.skills.forestry.xp - before;
    }

    it('a cycle with no bonus gives its authored XP', () => {
        expect(cycleXp(makeHero('h1'))).toBe(4);
    });

    it('a Melee XP bonus does nothing for a work cycle', () => {
        expect(cycleXp(makeHero('h1', ['xpb_melee_charm']))).toBe(4);
    });

    it('Merry widens a work cycle through the same floor', () => {
        // 4 × 1.1 = 4.4: a positive bonus adds at least 1.
        expect(cycleXp(makeHero('h1', ['xpb_merry_charm']))).toBe(5);
    });
});
