// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildRateBook, chainRates, axisResolverOf, LIFECYCLE, LIMIT } from '../systems/progression/ledger/rates.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EquipmentManager } from '../systems/equipment/EquipmentManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Orders from '../systems/board/Orders.js';
import * as HeroManager from '../systems/hero/HeroManager.js';
import { generateHero } from '../systems/hero/HeroGenerator.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { modifiersOf } from '../systems/atlas/regionModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { registerTokenTypes, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { xpForLevel } from '../utils/XPCurve.js';

/**
 * The progression ledger's rate calculator (`rates.js`): one hero's cycle time, items and XP per hour
 * on a piece of work, factor by factor, worked out from the content alone. First on a fixture
 * workspace (the numbers by hand), then against the real board: the same supports, gear, drink, perk
 * and Region rule on a mat, every axis resolved by `TileModifiers` and by the calculator, equal.
 * The engine-level check (a whole setup played through the catch-up) is `bench/calibrate.mjs`.
 */

const provides = (id, type, bucket, value, to, extra = {}, reach = 'nearby') => ({
    id: `stm_${id}`, keyword: 'provides', to, reach, payload: { type, bucket, value, ...extra }
});

const EFFECTS = {
    rt_fx_merry: { id: 'rt_fx_merry', name: 'RT Merry', statements: [provides('rt_merry', EFFECT_TYPES.XP_BONUS, 'percentage', 0.1, { mode: 'all', value: '' })] },
    rt_fx_beer: {
        id: 'rt_fx_beer', name: 'RT Beer',
        statements: [{ id: 'stm_rt_beer', keyword: 'applies', to: { mode: 'all', value: '' }, target: { role: 'actor' }, when: { event: 'WORK_START', scope: 'self' }, payload: { effectId: 'rt_fx_merry', scale: 1, durationMs: 0, forCycle: true, chance: 100 } }]
    },
    rt_fx_quick: { id: 'rt_fx_quick', name: 'RT Quick Hands', statements: [provides('rt_quick', EFFECT_TYPES.WORK_TIME, 'percentage', -0.1, { mode: 'all', value: '' }, { category: 'mining' })] },
    // Narrowed to another skill: carried by the miner, it must speed nothing on a vein.
    rt_fx_woody: { id: 'rt_fx_woody', name: 'RT Woody', statements: [provides('rt_woody', EFFECT_TYPES.WORK_TIME, 'percentage', -0.3, { mode: 'all', value: '' }, { category: 'forestry' })] },
    rt_fx_rich: { id: 'rt_fx_rich', name: 'RT Rich Seams', statements: [provides('rt_rich', EFFECT_TYPES.YIELD, 'percentage', 0.5, { mode: 'all', value: '' }, { category: 'mining' })] }
};

const ITEMS = {
    rt_ore: { id: 'rt_ore', name: 'RT Ore', type: 'material', stackable: true, equipSlot: '' },
    rt_coal: { id: 'rt_coal', name: 'RT Coal', type: 'material', stackable: true, equipSlot: '' },
    rt_ingot: { id: 'rt_ingot', name: 'RT Ingot', type: 'material', stackable: true, equipSlot: '' },
    rt_wood: { id: 'rt_wood', name: 'RT Wood', type: 'material', stackable: true, equipSlot: '' },
    rt_seedling: { id: 'rt_seedling', name: 'RT Seedling', type: 'material', stackable: true, equipSlot: '' },
    rt_pick: { id: 'rt_pick', name: 'RT Pickaxe', type: 'tool', equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 1, starter: true } },
    rt_iron_pick: { id: 'rt_iron_pick', name: 'RT Iron Pickaxe', type: 'tool', equipSlot: 'hand', tool: { kind: 'pickaxe', tier: 2 } },
    rt_charm: { id: 'rt_charm', name: 'RT Charm', type: 'armor', equipSlot: 'trinket', effects: [{ effectId: 'rt_fx_quick', scale: 1 }, { effectId: 'rt_fx_woody', scale: 1 }] },
    rt_beer: { id: 'rt_beer', name: 'RT Beer', type: 'drink', stackable: true, equipSlot: 'drink', effects: [{ effectId: 'rt_fx_beer', scale: 1 }] }
};

const vein = (id, extra = {}) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', tags: ['Ore'], uses: 5, requiresHero: true, staysPut: true,
    needsTool: { kind: 'pickaxe', minTier: 1 },
    respawn: { mode: 'refill', afterMs: 60000 },
    config: { skill: 'mining', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [{ itemId: 'rt_ore', chance: 100, minQty: 1, maxQty: 2 }] },
    ...extra
});

const TOKENS = {
    rt_vein: vein('rt_vein'),
    rt_ambush_vein: vein('rt_ambush_vein', {
        statements: [{ id: 'stm_rt_ambush', keyword: 'spawns', to: null, reach: null, when: { event: 'SELF_CYCLE_COMPLETE', scope: 'self' }, payload: { typeId: 'rt_goblin', placement: 'nearest_free', chance: 2 } }]
    }),
    rt_cart: { id: 'rt_cart', name: 'RT Cart', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, requiresHero: false, config: null, statements: [provides('rt_cart', EFFECT_TYPES.WORK_TIME, 'percentage', -0.2, { mode: 'id', value: 'rt_vein' })] },
    rt_mine: { id: 'rt_mine', name: 'RT Mine', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, requiresHero: false, config: null, statements: [provides('rt_mine', EFFECT_TYPES.DOUBLE_DROP, 'flat', 25, { mode: 'id', value: 'rt_vein' }, { category: 'rt_ore' })] },
    rt_lamp: { id: 'rt_lamp', name: 'RT Lamp', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, requiresHero: false, config: null, noStackDuplicates: true, statements: [provides('rt_lamp', EFFECT_TYPES.YIELD, 'flat', 1, { mode: 'tag', value: 'Ore', filters: [{ kind: 'worked' }] })] },
    rt_selfish: { id: 'rt_selfish', name: 'RT Selfish', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, requiresHero: false, config: null, statements: [provides('rt_selfish', EFFECT_TYPES.WORK_TIME, 'percentage', -0.5, { mode: 'all', value: '' }, {}, 'self')] },
    rt_beacon: { id: 'rt_beacon', name: 'RT Beacon', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null, requiresHero: false, config: null, statements: [provides('rt_beacon', EFFECT_TYPES.XP_BONUS, 'flat', 2, { mode: 'all', value: '' }, {}, 'board')] },
    rt_furnace: {
        id: 'rt_furnace', name: 'RT Furnace', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, requiresHero: true,
        config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 12000, xp: 0, inputs: [], outputs: [] },
        statements: [{ id: 'stm_rt_furnace', keyword: 'station', payload: { skill: 'smithing', stationKind: 'rt_furnace_kind' } }]
    },
    rt_forest: {
        id: 'rt_forest', name: 'RT Forest', tokenType: 'spawner', rarity: 'common', theme: 'fixture', uses: null, requiresHero: false, config: null,
        spawner: { spawns: [{ typeId: 'rt_sapling', weight: 1 }], allowance: 5, intervalMs: 20000, upkeep: [{ itemId: 'rt_seedling', quantity: 1 }], withinReach: true },
        statements: [provides('rt_forest', EFFECT_TYPES.GROW_TIME, 'percentage', -0.25, { mode: 'tag', value: 'Oak' })]
    },
    rt_tree: {
        id: 'rt_tree', name: 'RT Tree', tokenType: 'resource', rarity: 'common', theme: 'fixture', tags: ['Oak'], uses: 5, requiresHero: true, staysPut: true,
        respawn: { mode: 'regrow', into: 'rt_stump' },
        config: { skill: 'forestry', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [{ itemId: 'rt_wood', chance: 100, minQty: 1, maxQty: 2 }, { itemId: 'rt_seedling', chance: 20, minQty: 1, maxQty: 1 }] }
    },
    rt_stump: { id: 'rt_stump', name: 'RT Stump', tokenType: 'resource', rarity: 'common', theme: 'fixture', tags: ['Oak'], uses: null, requiresHero: false, config: null, staysPut: true, grows: { into: 'rt_sapling', afterMs: 150000, needsNearby: ['rt_forest'], cost: [{ itemId: 'rt_seedling', quantity: 1 }] } },
    rt_sapling: { id: 'rt_sapling', name: 'RT Sapling', tokenType: 'resource', rarity: 'common', theme: 'fixture', tags: ['Oak'], uses: null, requiresHero: false, config: null, grows: { into: 'rt_tree', afterMs: 150000 } },
    rt_goblin: { id: 'rt_goblin', name: 'RT Goblin', tokenType: 'enemy', rarity: 'common', theme: 'fixture', uses: 1, requiresHero: true, enemy: { level: 1, style: 'melee' }, config: { skill: '', skillRequired: 1, cycleTimeMs: 5000, xp: 0, inputs: [], outputs: [] } }
};

const RECIPES = [{
    id: 'rt_ingot_recipe', name: 'RT Ingot', skill: 'smithing', levelRequirement: 1, stationKinds: ['rt_furnace_kind'], durationMs: 8000, xp: 1,
    inputs: [{ itemId: 'rt_ore', quantity: 4 }, { itemId: 'rt_coal', quantity: 1 }],
    outputs: [{ itemId: 'rt_ingot', chance: 100, minQty: 1, maxQty: 1 }]
}];

const PERKS = { mining: { id: 'mining', perks: [{ level: 10, effectId: 'rt_fx_rich', scale: 1 }] } };

const content = () => ({ tokens: TOKENS, items: ITEMS, recipes: RECIPES, effects: EFFECTS, skillPerks: PERKS });
const book = () => buildRateBook(content());

describe('one hero on a vein: cycle, rest, items and XP an hour', () => {
    it('works five cycles, rests a minute, and so offers 240 cycles an hour, 1.5 ore each', () => {
        const r = book().rateOf({ token: 'rt_vein' });
        expect(r.ok).toBe(true);
        expect(r.cycleMs).toBe(3000);
        expect(r.lifecycle).toMatchObject({ kind: LIFECYCLE.REFILL, cycles: 5, restMs: 60000 });
        expect(r.heroCyclesPerHour).toBe(1200);
        expect(r.cyclesPerHour).toBeCloseTo(240);
        expect(r.limitedBy).toBe(LIMIT.SUPPLY);
        expect(r.items.rt_ore).toBeCloseTo(360);
        expect(r.xp.mining).toBeCloseTo(240);
        expect(r.gates).toMatchObject({ level: 1, needed: 1, tool: 'rt_pick' });
    });

    it('takes the supports in reach: the cart\'s 20 % off the cycle, the mine\'s 25 % double, each named with the axis it moved', () => {
        const r = book().rateOf({ token: 'rt_vein' }, { supports: ['rt_cart', 'rt_mine'] });
        expect(r.cycleMs).toBe(2400);
        expect(r.cyclesPerHour).toBeCloseTo(250);
        expect(r.items.rt_ore).toBeCloseTo(250 * 1.5 * 1.25);
        expect(r.factors.find(f => f.id === 'support:rt_cart')).toMatchObject({ on: true, axes: [EFFECT_TYPES.WORK_TIME] });
        expect(r.factors.find(f => f.id === 'support:rt_mine')).toMatchObject({ on: true, axes: [EFFECT_TYPES.DOUBLE_DROP] });
    });

    it('switches a factor off by its id, or every factor of a kind', () => {
        const b = book();
        const noMine = b.rateOf({ token: 'rt_vein' }, { supports: ['rt_cart', 'rt_mine'], off: ['support:rt_mine'] });
        expect(noMine.items.rt_ore).toBeCloseTo(250 * 1.5);
        expect(noMine.factors.find(f => f.id === 'support:rt_mine')).toMatchObject({ on: false, axes: [] });
        const bare = b.rateOf({ token: 'rt_vein' }, { supports: ['rt_cart', 'rt_mine'], off: ['support'] });
        expect(bare.cycleMs).toBe(3000);
        expect(bare.items.rt_ore).toBeCloseTo(360);
    });

    it('passes a +10 % XP drink through the XP floor: a 1 XP cycle pays 2, and the drink is drunk once every 10 cycles', () => {
        const r = book().rateOf({ token: 'rt_vein' }, { consumables: ['rt_beer'] });
        expect(r.xpPerCycle).toBe(2);
        expect(r.xp.mining).toBeCloseTo(480);
        expect(r.inputs.rt_beer).toBeCloseTo(24);
        expect(r.factors.find(f => f.id === 'consumable:rt_beer')).toMatchObject({ axes: [EFFECT_TYPES.XP_BONUS] });
    });

    it('counts worn gear always and milestone perks from their level only', () => {
        const b = book();
        expect(b.rateOf({ token: 'rt_vein' }, { gear: ['rt_charm'] }).cycleMs).toBe(2700);
        expect(b.rateOf({ token: 'rt_vein' }, { level: 9 }).items.rt_ore).toBeCloseTo(360);
        expect(b.rateOf({ token: 'rt_vein' }, { level: 10 }).items.rt_ore).toBeCloseTo(240 * 1.5 * 1.5);
        expect(b.rateOf({ token: 'rt_vein' }, { level: 10, perks: false }).items.rt_ore).toBeCloseTo(360);
    });

    it('stops at the hero\'s gates: a level too low, no tool in hand; a better tool answers the need too', () => {
        const b = book();
        expect(b.rateOf({ token: 'rt_vein' }, { tool: null })).toMatchObject({ ok: false, reason: 'no_tool', cyclesPerHour: 0 });
        expect(b.rateOf({ token: 'rt_vein' }, { tool: 'rt_iron_pick' })).toMatchObject({ ok: true });
        const gated = buildRateBook({ ...content(), tokens: { ...TOKENS, rt_vein: vein('rt_vein', { config: { ...TOKENS.rt_vein.config, skillRequired: 15 } }) } });
        expect(gated.rateOf({ token: 'rt_vein' }, { level: 10 })).toMatchObject({ ok: false, reason: 'level' });
        expect(gated.rateOf({ token: 'rt_vein' }).gates.level).toBe(15);
    });

    it('reads a Region\'s rules as the board does, and names the ones it cannot carry', () => {
        const region = [
            provides('rt_region_fast', EFFECT_TYPES.WORK_TIME, 'percentage', -0.1, null),
            provides('rt_region_narrow', EFFECT_TYPES.YIELD, 'percentage', 1, { mode: 'tag', value: 'Ore' })
        ];
        const r = book().rateOf({ token: 'rt_vein' }, { region });
        expect(r.cycleMs).toBe(2700);
        expect(r.cyclesPerHour).toBeCloseTo(5 * 3600000 / (5 * 2700 + 60000));
        // The narrowed Yield rule is left out, so each cycle still lands 1.5 ore.
        expect(r.items.rt_ore).toBeCloseTo(r.cyclesPerHour * 1.5);
        expect(r.unmodelled).toContainEqual(expect.objectContaining({ source: 'region', why: 'aimed at some Tokens only' }));
    });
});

describe('a station, a chain, a regrowing family', () => {
    it('runs a recipe at its station, and slows it to the ore a vein beside it supplies', () => {
        const b = book();
        const alone = b.rateOf({ token: 'rt_furnace', recipe: 'rt_ingot_recipe' });
        expect(alone).toMatchObject({ ok: true, cycleMs: 8000, cyclesPerHour: 450, limitedBy: LIMIT.HERO });
        expect(alone.inputs).toEqual({ rt_ore: 1800, rt_coal: 450 });
        const chain = chainRates(b, [
            { target: { token: 'rt_vein' }, setup: { supports: ['rt_cart', 'rt_mine'] } },
            { target: { token: 'rt_furnace', recipe: 'rt_ingot_recipe' } }
        ]);
        const smelt = chain.works[1];
        expect(smelt.fed).toBe(true);
        expect(smelt.cyclesPerHour).toBeCloseTo(468.75 / 4);
        expect(chain.made.rt_ingot).toBeCloseTo(468.75 / 4);
        expect(chain.net.rt_ore).toBeCloseTo(0);
        expect(chain.xp).toMatchObject({ mining: 250, smithing: expect.closeTo(117.1875, 3) });
    });

    it('regrows a felled tree through its stump and sapling, sped by the forest, the forest\'s allowance taking turns', () => {
        const r = book().rateOf({ token: 'rt_tree' }, { supports: ['rt_forest'], family: { spawner: 'rt_forest' } });
        expect(r.lifecycle).toMatchObject({ kind: LIFECYCLE.REGROW, cycles: 5, members: 5, growMs: 225000 });
        expect(r.cyclesPerHour).toBeCloseTo(5 * 5 * 3600000 / 240000);
        expect(r.items.rt_wood).toBeCloseTo(375 * 1.5);
        expect(r.inputs.rt_seedling).toBeCloseTo(375 / 5);
        expect(r.factors.find(f => f.id === 'support:rt_forest').axes).toEqual([EFFECT_TYPES.GROW_TIME]);
    });

    it('a stump that grows only beside a forest never comes back without one', () => {
        const r = book().rateOf({ token: 'rt_tree' });
        expect(r.lifecycle).toMatchObject({ kind: LIFECYCLE.ONE_OFF, why: 'rt_stump grows only beside rt_forest' });
        expect(r.cyclesPerHour).toBe(0);
    });
});

describe('what the calculator cannot read is listed, never dropped', () => {
    it('names a triggered rule on the worked Token, and refuses work it does not model', () => {
        const b = book();
        expect(b.rateOf({ token: 'rt_ambush_vein' }).unmodelled).toContainEqual(expect.objectContaining({ source: 'rt_ambush_vein', what: 'spawns' }));
        expect(b.rateOf({ token: 'rt_forest' })).toMatchObject({ ok: false, reason: 'no work cycle (a spawner)' });
        expect(b.rateOf({ token: 'rt_furnace' })).toMatchObject({ ok: false, reason: 'a station: name a recipe' });
    });

    it('rates a fight coarsely and says so: one kill a fight cycle, nothing for combat XP', () => {
        const r = book().rateOf({ token: 'rt_goblin' });
        expect(r).toMatchObject({ ok: true, kind: 'fight', cycleMs: 5000 });
        // One goblin, there once: a kill, then nothing more an hour.
        expect(r.lifecycle).toMatchObject({ kind: LIFECYCLE.ONE_OFF, cycles: 1 });
        expect(r.assumptions).toContainEqual(expect.objectContaining({ what: 'fight' }));
        expect(r.unmodelled).toContainEqual(expect.objectContaining({ what: 'combat XP' }));
    });
});

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const load = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));

describe('the shipped content', () => {
    it('rates every Token and recipe it can, with finite numbers, and says why for the rest', () => {
        const shipped = buildRateBook({ tokens: load('tokens.json'), items: load('items.json'), recipes: load('tokenRecipes.json'), effects: load('effects.json') });
        const all = shipped.everyRate({});
        expect(all.length).toBeGreaterThan(50);
        for (const r of all) {
            if (!r.ok) {
                expect(typeof r.reason).toBe('string');
                continue;
            }
            expect(Number.isFinite(r.cycleMs) && r.cycleMs >= 1000).toBe(true);
            expect(Number.isFinite(r.cyclesPerHour)).toBe(true);
            for (const n of [...Object.values(r.items), ...Object.values(r.xp), ...Object.values(r.inputs)]) expect(Number.isFinite(n)).toBe(true);
        }
    });
});

// ── against the board ──────────────────────────────────────────────────────────────────────────

class SilentAudio {
    constructor() { this.paused = true; this.currentTime = 0; }
    play() { return Promise.resolve(); }
    pause() {}
    addEventListener() {}
    removeEventListener() {}
}

const AT = { x: 800, y: 560 };
const STEP = 160;

function place(typeId, x, y) {
    return BoardState.addToken(BoardState.createTokenInstance(typeId, tokenStartingUses(typeId), null, BoardState.ORIGIN.PLACED), x, y);
}

/** A miner on the worked Token, carrying `carried`, mid-cycle (so a drink's effect for the cycle is on them). */
function minerOn(target, carried, level = 10) {
    GameState.state.progress.rosterLimit = 1;
    const made = generateHero({ name: 'Parity' });
    made.id = 'hero_rates_parity';
    made.skills.mining = { level, xp: xpForLevel(level) };
    const hero = HeroManager.addHero(made);
    for (const itemId of carried) {
        InventoryManager.addItem(itemId, itemId === 'rt_beer' ? 50 : 1);
        expect(EquipmentManager.equipItem(hero.id, itemId).success).toBe(true);
    }
    expect(Orders.orderAt(hero.id, { x: target.x, y: target.y }).success).toBe(true);
    for (let i = 0; i < 10; i++) GameLoop.runHandlers(100);
    expect(BoardState.workerOf(target.id)).toBe(hero.id);
    return hero;
}

function freshBoard() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    getGlobalAggregator().clearAll();
}

const AXES = [
    [EFFECT_TYPES.WORK_TIME, 3000, 'mining'],
    [EFFECT_TYPES.YIELD, 1, 'mining'],
    [EFFECT_TYPES.YIELD, 2, 'mining'],
    [EFFECT_TYPES.DOUBLE_DROP, 0, 'rt_ore'],
    [EFFECT_TYPES.XP_BONUS, 1, 'mining'],
    [EFFECT_TYPES.LOOT_MULT, 0, 'mining'],
    [EFFECT_TYPES.FAIL_CHANCE, 0, 'mining'],
    [EFFECT_TYPES.INPUT_COST, 4, 'mining']
];

describe('⭐ against the board: every axis the calculator resolves is the one TileModifiers resolves', () => {
    beforeAll(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.stubGlobal('Audio', SilentAudio);
        registerEffects(EFFECTS);
        registerItems(ITEMS);
        registerTokenTypes(TOKENS);
        registerSkillPerks(PERKS);
        SettingsManager.init();
        EngineBootstrap.init();
        GameLoop.stop();
    });

    afterAll(() => {
        getGlobalAggregator().clearAll();
        registerSkillPerks({});
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        resetMatTuning();
    });

    it('supports near and far, a no-stack lamp twice, a self-only rule beside it, a board-wide beacon, worn gear, a drink, a perk and a Region rule', () => {
        freshBoard();
        const target = place('rt_vein', AT.x, AT.y);
        place('rt_cart', AT.x + STEP, AT.y);
        place('rt_mine', AT.x - STEP, AT.y);
        place('rt_lamp', AT.x, AT.y + STEP);
        place('rt_lamp', AT.x, AT.y - STEP);
        place('rt_selfish', AT.x + STEP, AT.y + STEP);
        place('rt_cart', AT.x + 5 * STEP, AT.y);
        place('rt_beacon', AT.x - 4 * STEP, AT.y + 2 * STEP);
        const region = [provides('rt_region', EFFECT_TYPES.XP_BONUS, 'percentage', 0.5, null)];
        for (const m of modifiersOf(region, 'parity').modifiers) getGlobalAggregator().addModifier(m);
        minerOn(target, ['rt_pick', 'rt_charm', 'rt_beer'], 10);
        TileModifiers.rebuildAll();

        const resolve = axisResolverOf(book(), { token: 'rt_vein' }, {
            level: 10,
            gear: ['rt_charm'],
            consumables: ['rt_beer'],
            supports: ['rt_cart', 'rt_mine', { id: 'rt_lamp', count: 2 }, 'rt_selfish', { id: 'rt_cart', distant: true }, { id: 'rt_beacon', distant: true }],
            region
        });
        expect(resolve).not.toBeNull();
        for (const [type, base, category] of AXES) {
            expect([type, base, category, resolve(type, base, category)]).toEqual([type, base, category, TileModifiers.resolveAxis(target.id, type, base, category)]);
        }
        // And the floored work time the board runs at.
        expect(book().rateOf({ token: 'rt_vein' }, { level: 10, gear: ['rt_charm'], supports: ['rt_cart'] }).cycleMs)
            .toBe(TileModifiers.workTimeOf(target.id, 3000, 'mining'));
    });

    it('a stump\'s and a sapling\'s grow time beside a forest', () => {
        freshBoard();
        place('rt_forest', AT.x, AT.y);
        const stump = place('rt_stump', AT.x + STEP, AT.y);
        const sapling = place('rt_sapling', AT.x - STEP, AT.y);
        TileModifiers.rebuildAll();
        const r = book().rateOf({ token: 'rt_tree' }, { supports: ['rt_forest'], family: { spawner: 'rt_forest' } });
        expect(r.lifecycle.steps).toEqual([
            { typeId: 'rt_stump', ms: TileModifiers.growTimeOf(stump, 150000) },
            { typeId: 'rt_sapling', ms: TileModifiers.growTimeOf(sapling, 150000) }
        ]);
    });
});
