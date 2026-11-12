import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as Fields from '../systems/board/Fields.js';
import * as Orders from '../systems/board/Orders.js';
import * as HallRules from '../systems/progression/HallRules.js';
import * as LiveEffects from '../systems/effects/LiveEffects.js';
import { effectBreakdown, EFFECT_KEY, LIMIT, SOURCE_KIND, UNIT } from '../systems/board/EffectBreakdown.js';
import { applyThreeBucket } from '../systems/effects/ModifierAggregator.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES, TARGET_CATEGORIES } from '../systems/effects/constants.js';
import { KEYWORD, makeStatement } from '../systems/effects/statements.js';
import { modifiersOf } from '../systems/atlas/regionModifiers.js';
import { applyXpBonus } from '../systems/hero/xpBonus.js';
import { getCombatXpAward } from '../systems/combat/CombatFormulas.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerHallSky } from '../config/registries/hallStarRegistry.js';
import { enemyProfileOf } from '../config/registries/enemyProfile.js';
import { HALL_NODE } from '../config/guildUpgrades.js';
import { cropTermsOf } from '../config/registries/tokenConstants.js';
import { clearMat, placeAt } from './fixtures/mat.js';
import { exactInputQuantity } from '../systems/board/InputCost.js';
import { preservationChance, chanceOf } from '../systems/board/CycleSavings.js';
import { rareChanceAt } from '../systems/board/RareTables.js';

/**
 * Brief 600 B2: the effect breakdown behind the Token card's badges. For one Token, each named
 * effect with its sources and total, summed by the engine's own walk: so a badge is exactly what
 * the engine does, and reading it draws nothing and writes nothing.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), setQuiet: vi.fn()
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const item = (id, name, extra = {}) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1, ...extra
});
const ORE = 'eb_ore';
const COAL = 'eb_coal';
const FLUX = 'eb_flux';
const BAR = 'eb_bar';
const SEED = 'eb_seed';
const WHEAT_ITEM = 'eb_wheat';
const GLOVES = 'eb_gloves';
const QUIVER = 'eb_quiver';

registerEffects({
    eb_quick_hands: {
        id: 'eb_quick_hands', name: 'Quick Hands',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.05 } }]
    },
    eb_quiver_care: {
        id: 'eb_quiver_care', name: 'Quiver Care',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value: 6, category: 'ammo' } }]
    },
    eb_draught: {
        id: 'eb_draught', name: 'Draught',
        statements: [{ ...makeStatement(KEYWORD.PROVIDES), payload: { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.2 } }]
    }
});

registerItems({
    [ORE]: item(ORE, 'Fixture Ore'),
    [COAL]: item(COAL, 'Fixture Coal'),
    [FLUX]: item(FLUX, 'Fixture Flux'),
    [BAR]: item(BAR, 'Fixture Bar'),
    [SEED]: item(SEED, 'Fixture Seed'),
    [WHEAT_ITEM]: item(WHEAT_ITEM, 'Fixture Wheat'),
    [QUIVER]: item(QUIVER, 'Quiver', { type: 'tool', effects: [{ effectId: 'eb_quiver_care', scale: 1 }] }),
    [GLOVES]: item(GLOVES, 'Gloves', { type: 'tool', effects: [{ effectId: 'eb_quick_hands', scale: 1 }] })
});

const WHEAT = 'eb_recipe_wheat';
registerRecipePools({
    farming: [{
        id: WHEAT, name: WHEAT, levelRequirement: 1, durationMs: 3000, xp: 1, stationKinds: ['eb_field'],
        inputs: [{ itemId: SEED, quantity: 1 }],
        outputs: [{ itemId: WHEAT_ITEM, chance: 100, minQty: 1, maxQty: 1 }],
        crop: { growMs: 60000, load: 3 }
    }]
}, { takeOver: false });

const VEIN = 'eb_vein';
const QUICK = 'eb_quick_vein';
const SMITHY = 'eb_smithy';
const FIELD = 'eb_field';
const SELFIE = 'eb_selfie';
const ENEMY = 'fixture_enemy';

const provides = (id, to, payload, extra = {}) => ({ id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to, reach: 'nearby', payload, ...extra });
const support = (id, name, statements) => ({
    id, name, tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_well_wishing', requiresHero: false, statements
});
const toId = (value) => ({ mode: 'id', value });
const ALL = { mode: 'all' };

registerTokenTypes({
    [VEIN]: {
        id: VEIN, name: 'Fixture Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 5,
        sprite: 't_ore_vein_copper', requiresHero: true, tags: ['Ore'],
        respawn: { mode: 'refill', afterMs: 60000 },
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 10, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
    },
    [QUICK]: {
        id: QUICK, name: 'Fixture Quick Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: 5,
        sprite: 't_ore_vein_copper', requiresHero: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 1500, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] }
    },
    [SMITHY]: {
        id: SMITHY, name: 'Fixture Smithy', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_ore_vein_copper', requiresHero: true,
        config: {
            skill: 'smithing', skillRequired: 1, cycleTimeMs: 10000, xp: 5,
            inputs: [{ itemId: ORE, quantity: 3 }, { itemId: COAL, quantity: 10 }, { itemId: FLUX, quantity: 1 }],
            outputs: [{ itemId: BAR, chance: 100, minQty: 1, maxQty: 1 }]
        }
    },
    [FIELD]: {
        id: FIELD, name: 'Fixture Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_farmland', requiresHero: true,
        config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] },
        statements: [{ id: 'stm_eb_field_works', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'eb_field' } }],
        field: {}
    },
    [SELFIE]: {
        id: SELFIE, name: 'Fixture Spring', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_ore_vein_copper', requiresHero: true,
        config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] },
        statements: [provides('eb_selfie', ALL, { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.25 }, { reach: 'self' })]
    },
    eb_cart: support('eb_cart', 'Fixture Cart', [provides('eb_cart', toId(VEIN), { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.15 })]),
    eb_rush: support('eb_rush', 'Fixture Rush', [provides('eb_rush', ALL, { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.7 })]),
    eb_banner: support('eb_banner', 'Fixture Banner', [provides('eb_banner', toId(VEIN), { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 }, { reach: 'board' })]),
    eb_plus: support('eb_plus', 'Fixture Plus', [provides('eb_plus', toId(VEIN), { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1 })]),
    eb_minus: support('eb_minus', 'Fixture Minus', [provides('eb_minus', toId(VEIN), { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: -0.1 })]),
    eb_mine: support('eb_mine', 'Fixture Mine', [provides('eb_mine', ALL, { type: EFFECT_TYPES.DOUBLE_DROP, bucket: 'flat', value: 30, category: ORE })]),
    eb_berry: support('eb_berry', 'Fixture Berry Patch', [provides('eb_berry', ALL, { type: EFFECT_TYPES.DOUBLE_DROP, bucket: 'flat', value: 25, category: 'item_blackberry' })]),
    eb_looter: support('eb_looter', 'Fixture Looter', [provides('eb_looter', ALL, { type: EFFECT_TYPES.LOOT_MULT, bucket: 'flat', value: 60 })]),
    eb_tutor: support('eb_tutor', 'Fixture Tutor', [provides('eb_tutor', ALL, { type: EFFECT_TYPES.XP_BONUS, bucket: 'percentage', value: 0.5 })]),
    eb_hoard: support('eb_hoard', 'Fixture Hoard', [provides('eb_hoard', toId(SMITHY), { type: EFFECT_TYPES.INPUT_COST, bucket: 'flat', value: -12 })]),
    eb_rack: support('eb_rack', 'Fixture Rack', [provides('eb_rack', toId(SMITHY), { type: EFFECT_TYPES.INPUT_COST, bucket: 'percentage', value: -0.2 })]),
    eb_well: support('eb_well', 'Fixture Well', [provides('eb_well', toId(FIELD), { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.5 })]),
    eb_composter: support('eb_composter', 'Fixture Composter', [provides('eb_composter', toId(FIELD), { type: EFFECT_TYPES.CROP_LOAD, bucket: 'flat', value: 2 })]),
    eb_grove: support('eb_grove', 'Fixture Grove', [provides('eb_grove', toId(VEIN), { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.5 })]),
    // Every bucket at once, a bare entry (no `bucket`) among them: it counts as a flat AND a percentage.
    eb_mixed: support('eb_mixed', 'Fixture Mixed', [
        provides('eb_mixed_flat', toId(VEIN), { type: EFFECT_TYPES.YIELD, bucket: 'flat', value: 2 }),
        provides('eb_mixed_bare', toId(VEIN), { type: EFFECT_TYPES.YIELD, value: 0.05 }),
        provides('eb_mixed_mult', toId(VEIN), { type: EFFECT_TYPES.YIELD, bucket: 'multiplier', value: 1.5 })
    ])
});

const AT = { x: 800, y: 500 };
const NEAR = { x: 950, y: 500 };    // 150 away: within reach
const NEAR2 = { x: 800, y: 650 };
const FAR = { x: 1500, y: 500 };    // 700 away: out of reach

/** A Token on the mat with its neighbourhood rebuilt, as a placement does. */
function arrive(typeId, point = AT) {
    const t = placeAt(typeId, point.x, point.y);
    TileModifiers.rebuildAround([point]);
    return t;
}

const HERO = 'hero_1';
function hire({ equipment = [GLOVES] } = {}) {
    const slots = [...equipment];
    while (slots.length < 9) slots.push(null);
    GameState.state.heroes = [{
        id: HERO, name: 'Mira', status: 'idle', equipment: slots,
        hp: { current: 100, max: 100 },
        skills: { mining: { level: 5, xp: 0 }, smithing: { level: 5, xp: 0 }, farming: { level: 5, xp: 0 } }
    }];
    for (const id of equipment) InventoryManager.addItem(id, 1);
}

/** A Guild Hall star "Deep Soil" held at rank 3: a guild-wide Mining Speed rule and a Growth rule aimed at the vein. */
const rule = (id, payload, to = { mode: 'all', value: '' }) => ({
    id, keyword: KEYWORD.PROVIDES, payload, chargeDelta: 0, to, reach: 'nearby', target: null, when: null, upkeep: null
});
function holdDeepSoil(extraRules = []) {
    const rank = (rules) => ({ tier: 1, price: [], rules, lines: [] });
    registerHallSky({
        constellations: { mining: { id: 'mining', name: 'Mining', label: { x: 1, y: 0 }, skill: 'mining' } },
        stars: {
            eb_deep: {
                id: 'eb_deep', constellation: 'mining', name: 'Deep Soil', node: { x: 0.7, y: 0 }, links: [HALL_NODE],
                ranks: [rank([]), rank([]), rank([
                    rule('stm_eb_deep_speed', { type: EFFECT_TYPES.WORK_TIME, bucket: 'percentage', value: -0.03, category: 'mining' }),
                    rule('stm_eb_deep_rest', { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.25 }, toId(VEIN)),
                    ...extraRules
                ])]
            }
        }
    });
    GameState.state.progress.guildUpgrades = { ...(GameState.state.progress.guildUpgrades || {}), eb_deep: 3 };
    HallRules.apply();
}

const badge = (out, key) => out?.effects.find(e => e.key === key) || null;
const names = (b) => b.sources.map(s => s.name);

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
    registerHallSky(null);
    HallRules.apply({});
    getGlobalAggregator().clearAll();
    clearMat();
    vi.restoreAllMocks();
});

describe('each source kind gets its own line, named for the hover', () => {
    it('a Hall star and a building nearby: two lines and the right total', () => {
        const vein = arrive(VEIN);
        arrive('eb_cart', NEAR);
        holdDeepSoil();

        const speed = badge(effectBreakdown(vein.id), EFFECT_KEY.SPEED);
        expect(speed).toMatchObject({ name: 'Speed', unit: UNIT.PERCENT, held: false, limit: null, base: 10000 });
        expect(names(speed)).toEqual(['Fixture Cart nearby', 'Hall star Deep Soil III']);
        expect(speed.sources.map(s => s.kind)).toEqual([SOURCE_KIND.BUILDING, SOURCE_KIND.STAR]);
        expect(speed.sources[0].amount).toBeCloseTo(15);
        expect(speed.sources[1]).toMatchObject({ starId: 'eb_deep', rank: 3 });
        expect(speed.sources[1].amount).toBeCloseTo(3);
        expect(speed.total).toBeCloseTo(18);
        expect(speed.counted).toBe(speed.total);
    });

    it('a star aimed at the Token joins its Growth, beside a building', () => {
        const vein = arrive(VEIN);
        arrive('eb_grove', NEAR);
        holdDeepSoil();

        const growth = badge(effectBreakdown(vein.id), EFFECT_KEY.GROWTH);
        expect(names(growth)).toEqual(['Fixture Grove nearby', 'Hall star Deep Soil III']);
        expect(growth.total).toBeCloseTo(75);
        expect(growth.final).toBe(Respawn.restMsOf(vein));
        expect(growth.final).toBeCloseTo(15000);
    });

    it('a rule from across the mat, the Token\'s own rule and a Region\'s rule', () => {
        const spring = arrive(SELFIE);
        arrive('eb_banner', FAR);   // aimed at the vein only: not here
        const vein = arrive(VEIN, NEAR2);
        GameState.state.atlas.regions.region_eb = { id: 'region_eb', flavourName: 'Copper Hills', practicalName: '', rules: [] };
        const regionRule = rule('stm_eb_region', { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.05, category: 'mining' });
        for (const m of modifiersOf([regionRule], 'region_eb').modifiers) getGlobalAggregator().addModifier(m);

        const own = badge(effectBreakdown(spring.id), EFFECT_KEY.YIELD);
        expect(own.sources.map(s => [s.kind, s.name])).toEqual([
            [SOURCE_KIND.SELF, 'Fixture Spring itself'],
            [SOURCE_KIND.REGION, 'Copper Hills rule']
        ]);
        expect(own.total).toBeCloseTo(30);

        const far = badge(effectBreakdown(vein.id), EFFECT_KEY.YIELD);
        expect(far.sources.map(s => [s.kind, s.name])).toEqual([
            [SOURCE_KIND.BUILDING, 'Fixture Banner on the mat'],
            [SOURCE_KIND.REGION, 'Copper Hills rule']
        ]);
    });

    it('a rule counted in two buckets is one line, and its amount is what the total loses without it', () => {
        const vein = arrive(VEIN);
        arrive('eb_mixed', NEAR);
        const y = badge(effectBreakdown(vein.id), EFFECT_KEY.YIELD);
        expect(y.sources).toHaveLength(1);
        // The bare 0.05 counts as a flat and a percentage; with the flat 2 and the ×1.5:
        // (1 + 2 + 0.05) × 1.5 × 1.05.
        expect(y.sources[0].rules.map(r => r.bucket).sort()).toEqual(['flat', 'flat', 'multiplier', 'percentage']);
        expect(y.resolved).toBeCloseTo(3.05 * 1.5 * 1.05);
        expect(y.resolved).toBe(TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.YIELD, 1, 'mining'));
        expect(y.sources[0].amount).toBeCloseTo(y.total);
    });
});

describe('a hero\'s gear counts only while they work the Token', () => {
    it('joins the total, names the gear and makes the Hero Effects block; gone once they leave', () => {
        hire();
        const vein = arrive(VEIN);
        arrive('eb_cart', NEAR);

        const before = effectBreakdown(vein.id);
        expect(badge(before, EFFECT_KEY.SPEED).total).toBeCloseTo(15);
        expect(before.hero).toBeNull();

        expect(Orders.orderAt(HERO, AT).success).toBe(true);
        const working = effectBreakdown(vein.id);
        const speed = badge(working, EFFECT_KEY.SPEED);
        expect(working.heroId).toBe(HERO);
        expect(speed.total).toBeCloseTo(20);
        expect(speed.sources.at(-1)).toMatchObject({ kind: SOURCE_KIND.GEAR, name: 'Mira\'s Gloves', heroId: HERO, itemIds: [GLOVES] });
        expect(speed.sources.at(-1).amount).toBeCloseTo(5);
        expect(working.hero).toMatchObject({ heroId: HERO, name: 'Mira' });
        expect(working.hero.sources.map(s => [s.effect, s.name])).toEqual([[EFFECT_KEY.SPEED, 'Mira\'s Gloves']]);

        Orders.sendHome(HERO);
        const after = effectBreakdown(vein.id);
        expect(badge(after, EFFECT_KEY.SPEED).total).toBeCloseTo(15);
        expect(after.hero).toBeNull();
    });

    it('a carried rule narrowed to a kind reaches a read that names the item and its kind', () => {
        hire({ equipment: [QUIVER] });
        const vein = arrive(VEIN);
        Orders.orderAt(HERO, AT);
        // `CycleSavings.keepsCarried` asks with a list: the item, then its kind.
        expect(TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.PRESERVATION, 0, ['item_arrow', 'ammo'])).toBe(6);
        expect(TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.PRESERVATION, 0, 'item_arrow')).toBe(0);
        expect(TileModifiers.explainAxis(vein.id, EFFECT_TYPES.PRESERVATION, 0, ['item_arrow', 'ammo']).contributions)
            .toEqual([expect.objectContaining({ scope: 'hero', bucket: 'flat', value: 6 })]);
    });

    it('what a hero carries for a while is its own kind of line', () => {
        hire({ equipment: [] });
        const vein = arrive(VEIN);
        Orders.orderAt(HERO, AT);
        LiveEffects.applyToHero(HERO, { effectId: 'eb_draught', durationMs: 60000 });

        const y = badge(effectBreakdown(vein.id), EFFECT_KEY.YIELD);
        expect(y.sources).toEqual([expect.objectContaining({ kind: SOURCE_KIND.CARRIED, name: 'Mira\'s Draught', effectId: 'eb_draught' })]);
        expect(y.total).toBeCloseTo(20);
    });
});

describe('a limit holds the total, and the badge says how much counts', () => {
    it('Speed held at the floor: no more than 80 % off', () => {
        const vein = arrive(VEIN);
        arrive('eb_rush', NEAR);
        arrive('eb_cart', NEAR2);
        const speed = badge(effectBreakdown(vein.id), EFFECT_KEY.SPEED);
        expect(speed.total).toBeCloseTo(85);
        expect(speed).toMatchObject({ held: true, limit: LIMIT.SPEED_FLOOR });
        expect(speed.counted).toBeCloseTo(80);
        expect(speed.final).toBe(TileModifiers.workTimeOf(vein.id, 10000, 'mining'));
        expect(speed.final).toBeCloseTo(2000);
    });

    it('Speed held at the shortest cycle, a second', () => {
        const quick = arrive(QUICK);
        arrive('eb_rush', NEAR);
        const speed = badge(effectBreakdown(quick.id), EFFECT_KEY.SPEED);
        expect(speed).toMatchObject({ held: true, limit: LIMIT.MIN_CYCLE, final: 1000 });
        expect(speed.counted).toBeCloseTo(100 / 3);
    });

    it('a chance over 100 % counts as 100 %', () => {
        const vein = arrive(VEIN);
        arrive('eb_looter', NEAR);
        arrive('eb_looter', NEAR2);
        const loot = badge(effectBreakdown(vein.id), EFFECT_KEY.DOUBLE_LOOT);
        expect(loot).toMatchObject({ unit: UNIT.CHANCE, total: 120, counted: 100, held: true, limit: LIMIT.CERTAIN });
        expect(loot.sources.map(s => s.amount)).toEqual([60, 60]);
    });
});

describe('item badges sit on their item', () => {
    it('Double Item on a made item; Efficiency on each need, the exact cost a cycle pays on average', () => {
        const vein = arrive(VEIN);
        arrive('eb_mine', NEAR);
        const out = effectBreakdown(vein.id);
        expect(out.outputs).toEqual([{ itemId: ORE, effects: [expect.objectContaining({ key: EFFECT_KEY.DOUBLE_ITEM, itemId: ORE, total: 30 })] }]);
        expect(out.effects.find(e => e.key === EFFECT_KEY.DOUBLE_ITEM)).toBeUndefined();

        clearMat();
        TileModifiers.clearAll();
        const smithy = arrive(SMITHY);
        arrive('eb_rack', NEAR);
        const needs = effectBreakdown(smithy.id).inputs;
        const byItem = Object.fromEntries(needs.map(n => [n.itemId, n.effects[0]]));
        // 10 coal at -20 % is 8.
        expect(byItem[COAL]).toMatchObject({ key: EFFECT_KEY.EFFICIENCY, base: 10, limit: null });
        expect(byItem[COAL].final).toBeCloseTo(8);
        expect(byItem[COAL].total).toBeCloseTo(20);
        // 3 ore is 2.4 and 1 flux is 0.8: no rounding and no minimum of one, all 20 % counts.
        for (const [id, base, exact] of [[ORE, 3, 2.4], [FLUX, 1, 0.8]]) {
            expect(byItem[id], id).toMatchObject({ base, limit: null, held: false });
            expect(byItem[id].final, id).toBeCloseTo(exact);
            expect(byItem[id].counted, id).toBeCloseTo(20);
        }
        for (const n of needs) {
            const authored = getTokenType(SMITHY).config.inputs.find(i => i.itemId === n.itemId).quantity;
            expect(n.effects[0].final, n.itemId).toBe(exactInputQuantity(smithy.id, authored, 'smithing'));
        }
    });

    it('Efficiency past -100 % costs nothing, and says the cost stops at nothing', () => {
        const smithy = arrive(SMITHY);
        arrive('eb_hoard', NEAR);
        // 10 coal less 12 is -2: the cost stops at nothing (a percentage alone stops at -100 % already).
        const coal = effectBreakdown(smithy.id).inputs.find(n => n.itemId === COAL).effects[0];
        expect(coal.total).toBeCloseTo(120);
        expect(coal).toMatchObject({ final: 0, limit: LIMIT.NOTHING_LEFT, held: true });
        expect(coal.counted).toBeCloseTo(100);
    });

    it('a Field: Growth on its crop and Abundance on its harvests', () => {
        const field = arrive(FIELD);
        StationRecipe.setSelectedRecipe(field, WHEAT);
        arrive('eb_well', NEAR);
        arrive('eb_composter', NEAR2);
        const out = effectBreakdown(field.id);
        const crop = Fields.cropOf(field);
        expect(badge(out, EFFECT_KEY.GROWTH)).toMatchObject({ base: 60000, final: TileModifiers.growTimeOf(field, 60000) });
        expect(badge(out, EFFECT_KEY.GROWTH).total).toBeCloseTo(50);
        expect(badge(out, EFFECT_KEY.ABUNDANCE)).toMatchObject({
            unit: UNIT.COUNT, total: 2, base: cropTermsOf(crop).load, final: Fields.loadAtRipening(field, getTokenType(FIELD), crop)
        });
    });
});

describe('an enemy wears badges too', () => {
    it('Double Loot and XP on the enemy, Double Item on its drop', () => {
        const enemy = arrive(ENEMY);
        arrive('eb_looter', NEAR);
        arrive('eb_berry', NEAR2);
        arrive('eb_tutor', { x: 650, y: 500 });
        const out = effectBreakdown(enemy.id);
        expect(out.enemy).toBe(true);
        expect(out.effects.map(e => e.key)).toEqual([EFFECT_KEY.XP, EFFECT_KEY.DOUBLE_LOOT]);
        expect(badge(out, EFFECT_KEY.DOUBLE_LOOT)).toMatchObject({ total: 60, sources: [expect.objectContaining({ name: 'Fixture Looter nearby' })] });
        // The kill's XP, as `CombatResolutionProcessor` widens it.
        const xp = badge(out, EFFECT_KEY.XP);
        const award = getCombatXpAward(enemyProfileOf(getTokenType(ENEMY)));
        expect(xp.final).toBe(applyXpBonus(award, TileModifiers.resolveAxis(enemy.id, EFFECT_TYPES.XP_BONUS, award, TARGET_CATEGORIES.ALL)));
        expect(out.outputs).toEqual([{ itemId: 'item_blackberry', effects: [expect.objectContaining({ key: EFFECT_KEY.DOUBLE_ITEM, total: 25 })] }]);
        // No work cycle: no Speed, whatever reaches it.
        expect(badge(out, EFFECT_KEY.SPEED)).toBeNull();
    });
});

describe('the badges are what the engine does', () => {
    it('each total and final equals the engine\'s own reader for the same Token', () => {
        hire();
        const vein = arrive(VEIN);
        arrive('eb_cart', NEAR);
        arrive('eb_mine', NEAR2);
        arrive('eb_looter', { x: 650, y: 500 });
        arrive('eb_tutor', { x: 800, y: 350 });
        holdDeepSoil([rule('stm_eb_deep_yield', { type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.1, category: 'mining' })]);
        Orders.orderAt(HERO, AT);

        const out = effectBreakdown(vein.id);
        expect(badge(out, EFFECT_KEY.SPEED).final).toBe(TileModifiers.workTimeOf(vein.id, 10000, 'mining'));
        expect(badge(out, EFFECT_KEY.YIELD).resolved).toBe(TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.YIELD, 1, 'mining'));
        expect(badge(out, EFFECT_KEY.XP).final).toBe(applyXpBonus(10, TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.XP_BONUS, 10, 'mining')));
        expect(badge(out, EFFECT_KEY.DOUBLE_LOOT).resolved).toBe(TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.LOOT_MULT, 0, 'mining'));
        expect(out.outputs[0].effects[0].resolved).toBe(TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.DOUBLE_DROP, 0, ORE));
        expect(badge(out, EFFECT_KEY.GROWTH).final).toBe(Respawn.restMsOf(vein));

        // Every badge's sources rebuild its total through the engine's formula.
        for (const b of [...out.effects, ...out.outputs.flatMap(o => o.effects)]) {
            expect(b.sources.reduce((sum, s) => sum + s.amount, 0), b.key).toBeCloseTo(b.total);
        }
    });

    it('the Speed badge is the cycle the runner runs', () => {
        hire();
        const vein = arrive(VEIN);
        arrive('eb_cart', NEAR);
        holdDeepSoil();
        Orders.orderAt(HERO, AT);
        const lengths = [];
        const off = EventBus.subscribe(BOARD_EVENTS.PROGRESS, ({ instanceId, cycleTimeMs }) => {
            if (instanceId === vein.id) lengths.push(cycleTimeMs);
        });
        for (let i = 0; i < 6; i++) BoardRunner.tick(100);
        off();
        expect(lengths.length).toBeGreaterThan(0);
        expect(new Set(lengths)).toEqual(new Set([badge(effectBreakdown(vein.id), EFFECT_KEY.SPEED).final]));
    });

    it('the Efficiency badges are what a cycle takes from the Bank: their exact cost, rounded by chance either way', () => {
        hire({ equipment: [] });
        const smithy = arrive(SMITHY);
        arrive('eb_rack', NEAR);
        for (const id of [ORE, COAL, FLUX]) InventoryManager.addItem(id, 100);
        const exact = Object.fromEntries(effectBreakdown(smithy.id).inputs.map(n => [n.itemId, n.effects[0].final]));
        Orders.orderAt(HERO, AT);

        /** One cycle with every draw at `roll`: what it took from the Bank. */
        const cycleAt = (roll) => {
            const before = Object.fromEntries([ORE, COAL, FLUX].map(id => [id, InventoryManager.getItemCount(id)]));
            vi.spyOn(Math, 'random').mockReturnValue(roll);
            let cycles = 0;
            const off = EventBus.subscribe(BOARD_EVENTS.CYCLE_COMPLETE, ({ instanceId }) => { if (instanceId === smithy.id) cycles++; });
            for (let i = 0; i < 101 && !cycles; i++) BoardRunner.tick(100);
            off();
            vi.restoreAllMocks();
            expect(cycles).toBe(1);
            return Object.fromEntries([ORE, COAL, FLUX].map(id => [id, before[id] - InventoryManager.getItemCount(id)]));
        };
        // A roll at the top rounds every fraction down, a roll of 0 rounds it up; a whole cost never moves.
        const down = cycleAt(0.999999);
        const up = cycleAt(0);
        for (const id of [ORE, COAL, FLUX]) {
            expect(down[id], id).toBe(Math.floor(exact[id] + 1e-9));
            expect(up[id], id).toBe(Math.ceil(exact[id] - 1e-9));
        }
        expect(down).toEqual({ [ORE]: 2, [COAL]: 8, [FLUX]: 0 });
        expect(up).toEqual({ [ORE]: 3, [COAL]: 8, [FLUX]: 1 });
    });

    it('explainAxis resolves exactly as resolveAxis, every bucket and scope at once', () => {
        hire();
        const vein = arrive(VEIN);
        arrive('eb_mixed', NEAR);
        arrive('eb_plus', NEAR2);
        getGlobalAggregator().addModifier({ source: 'guild:eb_test', type: EFFECT_TYPES.YIELD, bucket: 'multiplier', value: 0.5 });
        Orders.orderAt(HERO, AT);
        LiveEffects.applyToHero(HERO, { effectId: 'eb_draught', durationMs: 60000 });

        for (const base of [1, 3, 7.5]) {
            const { resolved, contributions } = TileModifiers.explainAxis(vein.id, EFFECT_TYPES.YIELD, base, 'mining');
            expect(resolved).toBe(TileModifiers.resolveAxis(vein.id, EFFECT_TYPES.YIELD, base, 'mining'));
            const buckets = { flat: [], multipliers: [], percentages: [] };
            for (const c of contributions) (c.bucket === 'flat' ? buckets.flat : c.bucket === 'multiplier' ? buckets.multipliers : buckets.percentages).push(c.value);
            expect(applyThreeBucket(base, buckets)).toBeCloseTo(resolved);
            expect(new Set(contributions.map(c => c.scope))).toEqual(new Set(['token', 'guild', 'hero']));
        }
    });

    it('reading draws no random number and changes nothing in the save', () => {
        hire();
        const vein = arrive(VEIN);
        arrive('eb_cart', NEAR);
        arrive('eb_looter', NEAR2);
        holdDeepSoil();
        Orders.orderAt(HERO, AT);
        const before = JSON.stringify(GameState.state);
        const random = vi.spyOn(Math, 'random');
        effectBreakdown(vein.id);
        expect(random).not.toHaveBeenCalled();
        expect(JSON.stringify(GameState.state)).toBe(before);
    });
});

describe('nothing at zero', () => {
    it('a Token nothing boosts has no badges; sources that cancel show nothing', () => {
        const vein = arrive(VEIN);
        expect(effectBreakdown(vein.id)).toMatchObject({ effects: [], outputs: [], inputs: [], hero: null });
        arrive('eb_plus', NEAR);
        arrive('eb_minus', NEAR2);
        expect(badge(effectBreakdown(vein.id), EFFECT_KEY.YIELD)).toBeNull();
    });

    it('an effect that cannot apply shows nothing: Growth on a Token that never grows', () => {
        const smithy = arrive(SMITHY);
        arrive('eb_rush', NEAR);
        holdDeepSoil([rule('stm_eb_deep_grow_all', { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.25 })]);
        const out = effectBreakdown(smithy.id);
        expect(badge(out, EFFECT_KEY.GROWTH)).toBeNull();
        expect(badge(out, EFFECT_KEY.SPEED)).not.toBeNull();
    });

    it('a Token off the mat has no breakdown', () => {
        expect(effectBreakdown('no_such_token')).toBeNull();
    });
});

describe('brief 590\'s effects: Refresh, Preservation and Lucky', () => {
    registerTokenTypes({
        eb_spring: support('eb_spring', 'Fixture Fountain', [
            provides('eb_spring_refresh', ALL, { type: EFFECT_TYPES.REFRESH, bucket: 'flat', value: 5 }),
            provides('eb_spring_keep', ALL, { type: EFFECT_TYPES.PRESERVATION, bucket: 'flat', value: 7 }),
            provides('eb_spring_luck', ALL, { type: EFFECT_TYPES.LUCKY, bucket: 'percentage', value: 0.5 })
        ]),
        eb_lucky_vein: {
            id: 'eb_lucky_vein', name: 'Fixture Lucky Vein', tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null,
            sprite: 't_ore_vein_copper', requiresHero: true,
            config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 10000, xp: 1, inputs: [], outputs: [{ itemId: ORE, chance: 100, minQty: 1, maxQty: 1 }] },
            rareTable: { chance: 2, entries: [{ itemId: BAR, weight: 1 }] }
        },
        eb_lucky_enemy: { ...getTokenType(ENEMY), id: 'eb_lucky_enemy', rareTable: { chance: 4, entries: [{ itemId: BAR, weight: 1 }] } },
        eb_clover: support('eb_clover', 'Fixture Clover', [provides('eb_clover', ALL, { type: EFFECT_TYPES.LUCKY, bucket: 'flat', value: 99 })])
    });

    it('Refresh on a Token with charges and Preservation on one with inputs, from a building; Lucky needs a rare table', () => {
        const vein = arrive(VEIN);
        const smithy = arrive(SMITHY, { x: 1100, y: 500 });
        arrive('eb_spring', NEAR);

        const v = effectBreakdown(vein.id);
        expect(v.effects.map(e => e.key)).toEqual([EFFECT_KEY.REFRESH]);
        expect(badge(v, EFFECT_KEY.REFRESH)).toMatchObject({ name: 'Refresh', unit: UNIT.CHANCE, total: 5 });
        expect(badge(v, EFFECT_KEY.REFRESH).final).toBe(chanceOf(vein.id, EFFECT_TYPES.REFRESH, 'mining'));

        const s = effectBreakdown(smithy.id);
        expect(s.effects.map(e => e.key)).toEqual([EFFECT_KEY.PRESERVATION]);
        expect(badge(s, EFFECT_KEY.PRESERVATION).total).toBe(7);
        expect(badge(s, EFFECT_KEY.PRESERVATION).final).toBe(preservationChance(smithy.id, 'smithing'));
    });

    it('no Preservation when Efficiency leaves nothing to pay, as the cycle asks for none', () => {
        const smithy = arrive(SMITHY);
        arrive('eb_spring', NEAR);
        expect(badge(effectBreakdown(smithy.id), EFFECT_KEY.PRESERVATION)).not.toBeNull();
        arrive('eb_hoard', NEAR2);
        expect(badge(effectBreakdown(smithy.id), EFFECT_KEY.PRESERVATION)).toBeNull();
    });

    it('Lucky widens the rare table\'s own chance, as the cycle rolls it', () => {
        const vein = arrive('eb_lucky_vein');
        arrive('eb_spring', NEAR);
        const lucky = badge(effectBreakdown(vein.id), EFFECT_KEY.LUCKY);
        // 2 % at +50 %: 3 %.
        expect(lucky).toMatchObject({ name: 'Lucky', unit: UNIT.PERCENT, base: 2, limit: null });
        expect(lucky.total).toBeCloseTo(50);
        expect(lucky.final).toBeCloseTo(3);
        expect(lucky.final).toBe(rareChanceAt(vein.id, getTokenType('eb_lucky_vein'), 'mining'));
        expect(lucky.sources).toEqual([expect.objectContaining({ name: 'Fixture Fountain nearby' })]);
    });

    it('Lucky past 100 % is certain', () => {
        const vein = arrive('eb_lucky_vein');
        arrive('eb_clover', NEAR);
        const lucky = badge(effectBreakdown(vein.id), EFFECT_KEY.LUCKY);
        expect(lucky).toMatchObject({ resolved: 101, final: 100, limit: LIMIT.CERTAIN, held: true });
        expect(lucky.final).toBe(rareChanceAt(vein.id, getTokenType('eb_lucky_vein'), 'mining'));
    });

    it('an enemy\'s rare table wears Lucky, on the skill its kill\'s loot reads', () => {
        const enemy = arrive('eb_lucky_enemy');
        arrive('eb_spring', NEAR);
        const def = getTokenType('eb_lucky_enemy');
        const lucky = badge(effectBreakdown(enemy.id), EFFECT_KEY.LUCKY);
        expect(lucky.base).toBe(4);
        expect(lucky.final).toBeCloseTo(6);
        expect(lucky.final).toBe(rareChanceAt(enemy.id, def, def.config?.skill || ''));
    });
});
