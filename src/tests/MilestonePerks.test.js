import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerSkillPerks, perkRowsFor, skillsWithPerks } from '../config/registries/perkRegistry.js';
import {
    perkRowsOf, normaliseSkillPerks, perksEarnedAt, perksReached, nextPerksAfter,
    DEFAULT_PERK_LEVELS, isPerkLevel
} from '../systems/hero/perkTable.js';
import { earnedPerks, earnedPerkRefs } from '../systems/hero/HeroPerks.js';
import * as HeroEffects from '../systems/hero/HeroEffects.js';
import * as SkillSystem from '../systems/hero/SkillSystem.js';
import * as EquipmentManager from '../systems/equipment/EquipmentManager.js';
import * as LoadoutMoments from '../systems/board/LoadoutMoments.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { rehydrateHero } from '../systems/hero/logic/HeroRehydration.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { xpForLevel } from '../utils/XPCurve.js';
import { withoutShippedPerks } from './fixtures/noPerks.js';

// Every perk table here is a fixture: the shipped ones are content.
withoutShippedPerks();

/**
 * Milestone perks: each skill's table of fixed perks at set levels, each a library effect a hero
 * holds from the level on. Read off the hero's levels, never stored, so a level-up, a load and a
 * catch-up all agree and nothing is granted twice.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const provides = (id, payload) => ({ id, keyword: KEYWORD.PROVIDES, payload, to: { mode: 'all', value: '' }, reach: 'nearby' });

registerEffects({
    k4_clean_felling: {
        id: 'k4_clean_felling', name: 'Clean Felling',
        statements: [provides('stm_k4_felling', { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.5, category: 'forestry' })]
    },
    k4_strong_arm: {
        id: 'k4_strong_arm', name: 'Strong Arm',
        statements: [provides('stm_k4_arm', { type: EFFECT_TYPES.DAMAGE, bucket: 'flat', value: 2 })]
    },
    k4_costly: {
        id: 'k4_costly', name: 'Costly',
        statements: [{ ...provides('stm_k4_costly', { type: EFFECT_TYPES.ARMOR, bucket: 'flat', value: 1 }), chargeDelta: -1 }]
    },
    k4_seed_finder: {
        id: 'k4_seed_finder', name: 'Seed Finder',
        statements: [{
            id: 'stm_k4_seed', keyword: KEYWORD.GRANTS,
            payload: { type: EFFECT_TYPES.BONUS_DROP, itemId: 'fixture_oak_wood', quantity: 1, chance: 100 },
            to: { mode: 'all', value: '' }, reach: 'nearby', target: null,
            when: { event: 'WORK_START', scope: 'self', skill: 'forestry' }
        }]
    }
});

registerItems({
    k4_axe: { id: 'k4_axe', name: 'K4 Felling Charm', type: 'armor', equipSlot: 'trinket', effects: [{ effectId: 'k4_clean_felling', scale: 1 }] },
    k4_helm: { id: 'k4_helm', name: 'K4 Iron Helm', type: 'armor', equipSlot: 'hat', skillRequired: 'melee', levelRequired: 15, effects: [{ effectId: 'k4_strong_arm', scale: 1 }] }
});

const at = (level, extra = 0) => ({ level, xp: xpForLevel(level) + extra });

/** A rehydrated hero on the roster with `skills` at their levels. */
function hero(skills = {}, equipment = []) {
    const h = generateHero({ name: 'Ana' });
    h.id = `hero_${GameState.state.heroes.length}`;
    for (const [id, level] of Object.entries(skills)) h.skills[id] = at(level);
    h.equipment = [...equipment, ...Array(9 - equipment.length).fill(null)];
    GameState.state.heroes.push(h);
    rehydrateHero(h);
    EquipmentManager.recalculateEquipmentModifiers(h);
    return h;
}

const perkStatementsOf = (h) => HeroEffects.loadoutStatements(h).filter(s => s.perk);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    registerSkillPerks({
        forestry: { perks: [{ level: 10, effectId: 'k4_clean_felling' }, { level: 25, effectId: 'k4_seed_finder' }] },
        melee: { perks: [{ level: 10, effectId: 'k4_strong_arm', scale: 1 }] }
    });
});

afterEach(() => {
    registerSkillPerks({ forestry: { perks: [] }, melee: { perks: [] }, mining: { perks: [] } });
});

describe('a perk table', () => {
    it('offers 10, 25, 50, 75 and 99 by default', () => {
        expect(DEFAULT_PERK_LEVELS).toEqual([10, 25, 50, 75, 99]);
    });

    it('runs whole levels 2 to 99 with an effect, in level order, scale 1 to 5', () => {
        const rows = perkRowsOf({ perks: [
            { level: 50, effectId: 'b', scale: 9 },
            { level: 10, effectId: 'a' },
            { level: 25, effectId: '' },
            { level: 1, effectId: 'never' },
            { level: 100, effectId: 'never' },
            { level: 12.5, effectId: 'never' },
            { level: 10, effectId: 'c', scale: 2 }
        ] });
        expect(rows).toEqual([
            { level: 10, effectId: 'a', scale: 1 },
            { level: 10, effectId: 'c', scale: 2 },
            { level: 50, effectId: 'b', scale: 5 }
        ]);
        expect(isPerkLevel(2)).toBe(true);
        expect(isPerkLevel(1)).toBe(false);
        expect(isPerkLevel(99)).toBe(true);
    });

    it('is written by Sync without blank rows or empty tables', () => {
        expect(normaliseSkillPerks({
            forestry: { id: 'forestry', perks: [{ level: 25, effectId: '' }, { level: 10, effectId: 'a' }] },
            mining: { id: 'mining', perks: [{ level: 10, effectId: '' }] }
        })).toEqual({ forestry: { id: 'forestry', perks: [{ level: 10, effectId: 'a', scale: 1 }] } });
    });

    it('answers what a level holds, what a level-up reaches and what comes next', () => {
        const rows = perkRowsOf({ perks: [{ level: 10, effectId: 'a' }, { level: 25, effectId: 'b' }, { level: 25, effectId: 'c' }] });
        expect(perksEarnedAt(rows, 9)).toEqual([]);
        expect(perksEarnedAt(rows, 25).map(r => r.effectId)).toEqual(['a', 'b', 'c']);
        expect(perksReached(rows, 9, 10).map(r => r.effectId)).toEqual(['a']);
        expect(perksReached(rows, 10, 11)).toEqual([]);
        expect(perksReached(rows, 5, 30).map(r => r.effectId)).toEqual(['a', 'b', 'c']);
        expect(nextPerksAfter(rows, 10).map(r => r.effectId)).toEqual(['b', 'c']);
        expect(nextPerksAfter(rows, 25)).toEqual([]);
    });

    it('is replaced by a fixture, and an empty list clears it', () => {
        expect(skillsWithPerks()).toEqual(['forestry', 'melee']);
        registerSkillPerks({ melee: { perks: [] } });
        expect(skillsWithPerks()).toEqual(['forestry']);
        expect(perkRowsFor('melee')).toEqual([]);
    });
});

describe('a hero holds a perk from its level on', () => {
    it('holds none below it, the row at it, and every lower row above it', () => {
        expect(earnedPerks(hero({ forestry: 9 }))).toEqual([]);
        expect(earnedPerks(hero({ forestry: 10 })).map(p => p.effectId)).toEqual(['k4_clean_felling']);
        expect(earnedPerks(hero({ forestry: 40, melee: 12 })).map(p => `${p.skillId} ${p.level}`))
            .toEqual(['forestry 10', 'forestry 25', 'melee 10']);
    });

    it('holds nothing as a villager', () => {
        const v = hero({ forestry: 50 });
        v.isVillager = true;
        expect(earnedPerks(v)).toEqual([]);
    });

    it('adds the scales of two perks naming one effect, capped at 5, into one reference', () => {
        registerSkillPerks({ mining: { perks: [
            { level: 10, effectId: 'k4_strong_arm', scale: 3 }, { level: 20, effectId: 'k4_strong_arm', scale: 4 }
        ] } });
        const refs = earnedPerkRefs(hero({ mining: 20, melee: 1 }));
        expect(refs).toEqual([{ effectId: 'k4_strong_arm', scale: 5 }]);
    });
});

describe('a perk rides with what the hero carries', () => {
    it('joins the loadout\'s statements, free, naming no item', () => {
        const h = hero({ forestry: 10 });
        const mine = perkStatementsOf(h);
        expect(mine).toHaveLength(1);
        expect(mine[0]).toMatchObject({ sourceEffectId: 'k4_clean_felling', chargeDelta: 0, sourceItemIds: [], perk: true });
    });

    it('spends nothing even when its effect carries a cost', () => {
        registerSkillPerks({ mining: { perks: [{ level: 5, effectId: 'k4_costly' }] } });
        const [statement] = perkStatementsOf(hero({ mining: 5 }));
        expect(statement.chargeDelta).toBe(0);
        expect(HeroEffects.canPayLoadoutCost(statement)).toBe(true);
        expect(HeroEffects.payLoadoutCost(statement)).toBe(true);
    });

    it('stays apart from an item naming the same effect: each gives its own statement', () => {
        InventoryManager.addItem('k4_axe', 1);
        const h = hero({ forestry: 10 }, ['k4_axe']);
        const felling = HeroEffects.loadoutStatements(h).filter(s => s.sourceEffectId === 'k4_clean_felling');
        expect(felling).toHaveLength(2);
        expect(felling.map(s => s.sourceItemIds)).toEqual([['k4_axe'], []]);
    });

    it('widens the work of its own skill at the Token the hero works, and no other', () => {
        const h = hero({ forestry: 10, mining: 10 });
        const tree = BoardState.createTokenInstance('fixture_producer', 100);
        Placement.placeTokenAt(tree, { x: 400, y: 400 });
        const vein = BoardState.createTokenInstance('fixture_producer_alt', 100);
        Placement.placeTokenAt(vein, { x: 900, y: 400 });
        TileModifiers.rebuildAll();

        Orders.orderAt(h.id, { x: 400, y: 400 });
        expect(TileModifiers.resolveAxis(tree.id, EFFECT_TYPES.YIELD, 10, 'forestry')).toBeCloseTo(15);
        Orders.orderAt(h.id, { x: 900, y: 400 });
        expect(TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.YIELD, 10, 'mining')).toBeCloseTo(10);
    });

    it('fires its own On Work Start rule: a perk is never taken for a dose', () => {
        const h = hero({ forestry: 25 });
        const tree = BoardState.createTokenInstance('fixture_producer', 100);
        Placement.placeTokenAt(tree, { x: 400, y: 400 });
        const before = SpriteLayer.countOnBoard('fixture_oak_wood');
        expect(LoadoutMoments.fire(tree.id, h.id, 'CYCLE_START')).toBe(1);
        expect(SpriteLayer.countOnBoard('fixture_oak_wood')).toBe(before + 1);
    });
});

describe('the combat numbers follow the levels', () => {
    it('registers a perk\'s Damage the moment the level-up reaches it, and only once', () => {
        const h = hero({ melee: 9 });
        h.skills.melee.xp = xpForLevel(10) - 1;
        expect(h.aggregator.query(EFFECT_TYPES.DAMAGE)).toBe(0);
        SkillSystem.addXP(h.id, 'melee', 1);
        expect(h.skills.melee.level).toBe(10);
        expect(h.aggregator.query(EFFECT_TYPES.DAMAGE)).toBe(2);
        // More levels, and a second refresh, add nothing: the perk is held, not granted again.
        SkillSystem.addXP(h.id, 'melee', xpForLevel(14) - h.skills.melee.xp);
        EquipmentManager.recalculateEquipmentModifiers(h);
        expect(h.aggregator.query(EFFECT_TYPES.DAMAGE)).toBe(2);
    });

    it('comes back from the levels on load, however many times the hero is loaded', () => {
        const h = hero({ melee: 30 });
        for (let i = 0; i < 3; i++) {
            rehydrateHero(h);
            EquipmentManager.recalculateEquipmentModifiers(h);
        }
        expect(h.aggregator.query(EFFECT_TYPES.DAMAGE)).toBe(2);
        expect(h.perks).toEqual({});
    });

    it('lends gear its rules the level its wearer meets it, without a re-equip', () => {
        registerSkillPerks({ melee: { perks: [] } });
        InventoryManager.addItem('k4_helm', 1);
        const h = hero({ melee: 14 }, ['k4_helm']);
        h.skills.melee.xp = xpForLevel(15) - 1;
        expect(h.aggregator.query(EFFECT_TYPES.DAMAGE)).toBe(0);
        SkillSystem.addXP(h.id, 'melee', 1);
        expect(h.aggregator.query(EFFECT_TYPES.DAMAGE)).toBe(2);
    });
});

describe('reading perks draws no random numbers', () => {
    it('leaves Math.random alone through every read and refresh', () => {
        const h = hero({ forestry: 30, melee: 12 });
        const spy = vi.spyOn(Math, 'random');
        earnedPerks(h);
        HeroEffects.loadoutStatements(h);
        EquipmentManager.recalculateEquipmentModifiers(h);
        SkillSystem.addXP(h.id, 'forestry', xpForLevel(31) - h.skills.forestry.xp);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
