import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Orders from '../systems/board/Orders.js';
import * as HeroTools from '../systems/equipment/HeroTools.js';
import { effectBreakdown, EFFECT_KEY, SOURCE_KIND, LIMIT } from '../systems/board/EffectBreakdown.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { toolFindings } from '../systems/core/toolRule.js';
import { clearMat, placeAt } from './fixtures/mat.js';

/**
 * ⭐ A better tool works faster, and a hero uses the best one: each tool carries its family's Speed
 * effect at its tier's scale; only the tool the hero uses for the work lends it, and only to work
 * that needs that kind; the best tier in hand is the one used (ties keep grid order); a rod still
 * fishes with the first in hand. The audit names two tools of one family and tier that differ.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

registerEffects({
    ts_pick_speed: {
        id: 'ts_pick_speed', name: 'Pickaxe Speed',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.05 } }]
    },
    ts_axe_speed: {
        id: 'ts_axe_speed', name: 'Woodaxe Speed',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.05 } }]
    },
    ts_blur: {
        id: 'ts_blur', name: 'Blur',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.3 } }]
    }
});

const hand = (id, name, tool, effects = []) => ({
    id, name, type: 'tool', equipSlot: 'hand', stackable: true, sprite: 'i_pick_copper', tool, effects
});
const speed = (effectId, scale) => [{ effectId, scale }];
registerItems({
    ts_copper_pick: hand('ts_copper_pick', 'Copper Pick', { kind: 'pickaxe', tier: 1 }, speed('ts_pick_speed', 1)),
    ts_rusty_pick: hand('ts_rusty_pick', 'Rusty Pick', { kind: 'pickaxe', tier: 1 }, speed('ts_pick_speed', 1)),
    ts_iron_pick: hand('ts_iron_pick', 'Iron Pick', { kind: 'pickaxe', tier: 2 }, speed('ts_pick_speed', 2)),
    ts_blur_pick: hand('ts_blur_pick', 'Blur Pick', { kind: 'pickaxe', tier: 3 }, speed('ts_blur', 5)),
    ts_axe: hand('ts_axe', 'Copper Axe', { kind: 'woodaxe', tier: 1 }, speed('ts_axe_speed', 1)),
    ts_rod: hand('ts_rod', 'Rod', { kind: 'fishing_rod', tier: 1 }),
    ts_fine_rod: hand('ts_fine_rod', 'Fine Rod', { kind: 'fishing_rod', tier: 2 })
});

const worked = (id, name, skill, needsTool) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 500, size: 1, sprite: 's_nature', requiresHero: true,
    ...(needsTool ? { needsTool } : {}),
    config: { skill, skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }] }
});
registerTokenTypes({
    ts_vein: worked('ts_vein', 'Fixture Vein', 'mining', { kind: 'pickaxe', minTier: 1 }),
    ts_tree: worked('ts_tree', 'Fixture Tree', 'forestry', { kind: 'woodaxe', minTier: 1 }),
    ts_plain: worked('ts_plain', 'Fixture Plain', 'mining', null),
    ts_pond: {
        ...worked('ts_pond', 'Fixture Pond', 'fishing', null),
        catchPools: [{ tool: 'fishing_rod', catches: [{ itemId: 'fixture_copper_ore', weight: 1 }] }]
    }
});

const AT = { x: 800, y: 500 };
const HERO = 'hero_ts';

/** A hero holding `equipment` (their own copies), in grid order. */
function hire(equipment) {
    const slots = [...equipment];
    while (slots.length < 9) slots.push(null);
    GameState.state.heroes = [{
        id: HERO, name: 'Mira', status: 'idle', equipment: slots, heldCopies: slots.map(Boolean),
        hp: { current: 100, max: 100 },
        skills: { mining: { level: 5, xp: 0 }, forestry: { level: 5, xp: 0 }, fishing: { level: 5, xp: 0 } }
    }];
}

/** Hero `HERO` working a fresh Token of `typeId`; its work time from the authored 10 s. */
function workAt(typeId) {
    const token = placeAt(typeId, AT.x, AT.y);
    TileModifiers.rebuildAround([AT]);
    expect(Orders.orderAt(HERO, AT).success).toBe(true);
    return token;
}
const workMs = (token, skill = 'mining') => TileModifiers.workTimeOf(token.id, 10000, skill);

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    getGlobalAggregator().clearAll();
    clearMat();
});

afterEach(() => {
    clearMat();
    vi.restoreAllMocks();
});

describe('the hero uses the best fitting tool in hand', () => {
    it('a copper and an iron pickaxe: the iron one, whichever hand it is in', () => {
        hire(['ts_copper_pick', 'ts_iron_pick']);
        const need = { kind: 'pickaxe', minTier: 1 };
        expect(HeroTools.fittingToolOf(HERO, need)).toBe('ts_iron_pick');
        expect(HeroTools.fittingToolSlotOf(HERO, need)).toBe(1);
        hire(['ts_iron_pick', 'ts_copper_pick']);
        expect(HeroTools.fittingToolOf(HERO, need)).toBe('ts_iron_pick');
    });

    it('two of one tier keep grid order', () => {
        hire(['ts_rusty_pick', 'ts_copper_pick']);
        expect(HeroTools.fittingToolOf(HERO, { kind: 'pickaxe', minTier: 1 })).toBe('ts_rusty_pick');
        hire(['ts_copper_pick', 'ts_rusty_pick']);
        expect(HeroTools.fittingToolOf(HERO, { kind: 'pickaxe', minTier: 1 })).toBe('ts_copper_pick');
    });

    it('a rod still fishes with the first fishing tool in hand, as before', () => {
        hire(['ts_rod', 'ts_fine_rod']);
        expect(HeroTools.catchToolOf(HERO, ['fishing_rod']).itemId).toBe('ts_rod');
        expect(HeroTools.fittingToolOf(HERO, { kind: 'fishing_rod', kinds: ['fishing_rod'], minTier: 1 })).toBe('ts_rod');
    });
});

describe('a tool lends its Speed only to the work it is used for', () => {
    it('the iron pickaxe\'s Speed II, not the copper one\'s as well', () => {
        hire(['ts_copper_pick', 'ts_iron_pick']);
        const vein = workAt('ts_vein');
        expect(workMs(vein)).toBeCloseTo(9000);
    });

    it('carrying three pickaxes adds one Speed, the best one\'s', () => {
        hire(['ts_iron_pick', 'ts_iron_pick', 'ts_copper_pick']);
        const vein = workAt('ts_vein');
        expect(workMs(vein)).toBeCloseTo(9000);
    });

    it('a pickaxe lends nothing at a tree or at work that needs no tool; the axe lends at the tree', () => {
        hire(['ts_iron_pick', 'ts_axe']);
        const plain = workAt('ts_plain');
        expect(workMs(plain)).toBeCloseTo(10000);
        Orders.sendHome(HERO);
        clearMat();
        const tree = workAt('ts_tree');
        expect(workMs(tree, 'forestry')).toBeCloseTo(9500);
    });

    it('the Speed hover names the tool, and the speed-up floor holds', () => {
        hire(['ts_copper_pick', 'ts_iron_pick']);
        const vein = workAt('ts_vein');
        const badge = effectBreakdown(vein.id).effects.find(e => e.key === EFFECT_KEY.SPEED);
        expect(badge.sources).toHaveLength(1);
        expect(badge.sources[0]).toMatchObject({ kind: SOURCE_KIND.GEAR, name: 'Mira\'s Iron Pick', itemIds: ['ts_iron_pick'] });
        expect(badge.sources[0].amount).toBeCloseTo(10);

        Orders.sendHome(HERO);
        clearMat();
        hire(['ts_blur_pick']);
        const fast = workAt('ts_vein');
        expect(workMs(fast)).toBeCloseTo(2000);
        expect(effectBreakdown(fast.id).effects.find(e => e.key === EFFECT_KEY.SPEED).limit).toBe(LIMIT.SPEED_FLOOR);
    });
});

describe('the audit: one family, one tier, one scale', () => {
    const tool = (id, kind, tier, effects) => ({ id, name: id, equipSlot: 'hand', tool: { kind, tier }, effects });

    it('names two tools of one family and tier whose scales differ, or where one lacks it', () => {
        const items = {
            a: tool('a', 'pickaxe', 1, speed('ts_pick_speed', 1)),
            b: tool('b', 'pickaxe', 1, speed('ts_pick_speed', 2)),
            c: tool('c', 'pickaxe', 1, []),
            d: tool('d', 'pickaxe', 2, speed('ts_pick_speed', 2))
        };
        const found = toolFindings({ items });
        expect(found.map(f => f.entityId).sort()).toEqual(['b', 'c']);
        expect(found.find(f => f.entityId === 'b').message).toMatch(/Pickaxe of tier 1 like a.*ts_pick_speed at scale 2.*a has 1/);
        expect(found.find(f => f.entityId === 'c').message).toMatch(/carries no ts_pick_speed where a has 1/);
    });

    it('says nothing when one family\'s tools of a tier agree', () => {
        const items = {
            a: tool('a', 'pickaxe', 1, speed('ts_pick_speed', 1)),
            b: tool('b', 'pickaxe', 1, speed('ts_pick_speed', 1)),
            d: tool('d', 'pickaxe', 2, speed('ts_pick_speed', 2)),
            e: tool('e', 'woodaxe', 1, speed('ts_axe_speed', 3))
        };
        expect(toolFindings({ items })).toEqual([]);
    });
});
