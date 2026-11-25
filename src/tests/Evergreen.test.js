import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Orders from '../systems/board/Orders.js';
import * as Fields from '../systems/board/Fields.js';
import * as Flags from '../systems/board/Flags.js';
import * as Growth from '../systems/board/Growth.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD, paletteForKeyword } from '../systems/effects/statements.js';
import { getPaletteEntry, MODIFIER_SHAPES } from '../config/registries/modifierPalette.js';
import { registerTokenTypes, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { registerEffects } from '../config/registries/effectRegistry.js';
import { registerSkillPerks } from '../config/registries/perkRegistry.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ Evergreen (brief 800 P1, Farming 99): a Field harvested by a hero holding it replants the same
 * crop with no seed spent. A ripe Field still ends by its roll (860 R1); on the harvest that ends it,
 * the Field sows the crop it just gave again, owing no seed and needing none in the Bank, its growth
 * counting from the cycle's end as any sowing's. A pick changed meanwhile is a new crop: it sows as
 * always and its seed is owed. As a chance (Free Replant), 100 % is the perk; holding it draws
 * nothing more at 100 %.
 */

const SEED = 'fixture_eg_seed';
const GRAIN = 'fixture_eg_grain';
const OAT_SEED = 'fixture_eg_oat_seed';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({ [SEED]: item(SEED, 'EG Seed'), [GRAIN]: item(GRAIN, 'EG Grain'), [OAT_SEED]: item(OAT_SEED, 'EG Oat Seed') });

const WHEAT = 'eg_recipe_wheat';
const OATS = 'eg_recipe_oats';
const crop = (id, seed) => ({
    id, name: id, levelRequirement: 1, durationMs: 1000, xp: 1, stationKinds: ['field'],
    inputs: [{ itemId: seed, quantity: 1 }], outputs: [{ itemId: GRAIN, chance: 100, minQty: 1, maxQty: 1 }],
    crop: { growMs: 5000, load: 4 }
});
registerRecipePools({ farming: [crop(WHEAT, SEED), crop(OATS, OAT_SEED)] });

const harvest = { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] };
registerTokenTypes({
    eg_field: {
        id: 'eg_field', name: 'EG Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_farmland', requiresHero: true, config: harvest, field: {},
        statements: [{ id: 'stm_eg_field_works', keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }]
    }
});

const replants = (id, value) => ({
    id, name: id,
    statements: [{
        id: `stm_${id}`, keyword: KEYWORD.PROVIDES, to: { mode: 'all', value: '' }, reach: 'nearby',
        payload: { type: EFFECT_TYPES.FREE_REPLANT, bucket: 'flat', value, category: 'farming' }
    }]
});
registerEffects({ eg_evergreen: replants('eg_evergreen', 100), eg_half: replants('eg_half', 50) });

function hero(id, farming) {
    return { id, name: id, status: 'idle', level: 10, hp: { current: 100, max: 100 }, skills: { farming: { level: farming, xp: 0 } } };
}

const AT = { x: 800, y: 500 };
const def = () => getTokenType('eg_field');
const rollsAt = (value) => vi.spyOn(Math, 'random').mockReturnValue(value);

/** A Field ripe with `recipeId`, sown with its seed from the Bank (owed to the first harvest). */
function ripe(recipeId = WHEAT, at = AT) {
    const field = placeAt('eg_field', at.x, at.y);
    TileModifiers.rebuildAround([at]);
    expect(StationRecipe.setSelectedRecipe(field, recipeId)).toBe(true);
    InventoryManager.addItem(recipeId === WHEAT ? SEED : OAT_SEED, 1);
    Fields.clockFired(field, def());
    Fields.clockFired(field, def());
    expect(Fields.stageOf(field, def())).toBe(Fields.STAGE.RIPE);
    // The first harvest has paid the seed it owed.
    InventoryManager.removeItem(recipeId === WHEAT ? SEED : OAT_SEED, 1);
    delete field.field.seedOwed;
    return field;
}

beforeAll(() => { Flags.init(); TimedChanges.init(); });
afterAll(() => {
    registerSkillPerks({ farming: { perks: [] } });
    Flags.teardown();
});
afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
    vi.clearAllMocks();
    registerSkillPerks({ farming: { perks: [{ level: 99, effectId: 'eg_evergreen' }] } });
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    LootSystem.init();
    BoardCombat.init();
    BoardCombat.clearAll();
    BoardRunner.init();
    Flags.init();
    TileModifiers.clearAll();
    Growth.resetGrowthAlerts();
    clearMat();
    GameState.state.heroes = [hero('master', 99), hero('novice', 10)];
    GameState.state.inventory.maxSlots = 50;
});

describe('the effect: Free Replant, a chance on a skill the CMS offers', () => {
    it('is a chance narrowed to the work\'s skill, and the effect editor lists it', () => {
        const entry = getPaletteEntry(EFFECT_TYPES.FREE_REPLANT);
        expect(entry).toMatchObject({ shape: MODIFIER_SHAPES.PROC, categories: 'skill', scales: 'value' });
        expect(entry.explains).toMatch(/seed/i);
        expect(paletteForKeyword(KEYWORD.PROVIDES).map(e => e.type)).toContain(EFFECT_TYPES.FREE_REPLANT);
    });
});

describe('the harvest that ends a ripe Field', () => {
    it('sows the same crop again for a hero holding it, owing no seed and needing none in the Bank', () => {
        const field = ripe();
        expect(InventoryManager.getItemCount(SEED)).toBe(0);
        const spy = rollsAt(0);
        Fields.harvested(field, def(), { heroId: 'master', overMs: 300 });
        expect(Fields.stageOf(field, def())).toBe(Fields.STAGE.GROWING);
        expect(field.field).toEqual({ cropId: WHEAT });
        expect(field.clocks[Fields.CLOCK]).toBe(300);
        expect(Fields.isStopped(field)).toBe(false);
        // Only the end roll: at 100 % the replant is sure.
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('without it, the same harvest stops the Field for want of a seed', () => {
        const field = ripe();
        rollsAt(0);
        Fields.harvested(field, def(), { heroId: 'novice' });
        expect(Fields.stageOf(field, def())).toBe(Fields.STAGE.EMPTY);
        expect(Fields.isStopped(field)).toBe(true);
    });

    it('a seed in the Bank stays there: the replanted crop never asks for it', () => {
        const field = ripe();
        InventoryManager.addItem(SEED, 3);
        rollsAt(0);
        Fields.harvested(field, def(), { heroId: 'master' });
        // It ripens and its first harvest owes nothing.
        Fields.clockFired(field, def());
        expect(Fields.stageOf(field, def())).toBe(Fields.STAGE.RIPE);
        expect(Fields.seedOwedOf(field, def())).toEqual([]);
        expect(InventoryManager.getItemCount(SEED)).toBe(3);
    });

    it('a harvest that does not end it changes nothing and draws nothing more', () => {
        const field = ripe();
        const spy = rollsAt(0.9);
        Fields.harvested(field, def(), { heroId: 'master' });
        expect(Fields.stageOf(field, def())).toBe(Fields.STAGE.RIPE);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('a pick changed meanwhile is a new crop: sown as always, its seed owed', () => {
        const field = ripe();
        expect(StationRecipe.setSelectedRecipe(field, OATS)).toBe(true);
        InventoryManager.addItem(OAT_SEED, 1);
        rollsAt(0);
        Fields.harvested(field, def(), { heroId: 'master' });
        expect(field.field).toEqual({ cropId: OATS, seedOwed: true });
    });

    it('at half, one more draw on the harvest that ends it: over 50 sows as always', () => {
        registerSkillPerks({ farming: { perks: [{ level: 99, effectId: 'eg_half' }] } });
        const field = ripe();
        InventoryManager.addItem(SEED, 1);
        const rolls = [0, 0.6];
        const spy = vi.spyOn(Math, 'random').mockImplementation(() => rolls.shift());
        Fields.harvested(field, def(), { heroId: 'master' });
        expect(spy).toHaveBeenCalledTimes(2);
        expect(field.field).toEqual({ cropId: WHEAT, seedOwed: true });
    });
});

describe('on the mat', () => {
    it('a master farmer works a Field crop after crop with no seed at all', () => {
        const field = ripe();
        Orders.orderAt('master', AT);
        expect(InventoryManager.getItemCount(SEED)).toBe(0);
        const grain = () => InventoryManager.getItemCount(GRAIN) + SpriteLayer.countOnBoard(GRAIN);
        let crops = 0;
        let wasRipe = true;
        for (let t = 0; t < 120_000; t += 100) {
            BoardRunner.tick(100);
            const nowRipe = Fields.stageOf(field, def()) === Fields.STAGE.RIPE;
            if (wasRipe && !nowRipe) crops++;
            wasRipe = nowRipe;
        }
        expect(crops).toBeGreaterThanOrEqual(3);
        expect(Fields.isStopped(field)).toBe(false);
        expect(grain()).toBeGreaterThan(crops);
        expect(InventoryManager.getItemCount(SEED)).toBe(0);
    });
});
