import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Growth from '../systems/board/Growth.js';
import * as Fields from '../systems/board/Fields.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { effectiveIO } from '../systems/board/RecipeResolver.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS, ALERT } from '../systems/board/boardEvents.js';
import { fieldOf, cropTermsOf, CROP_DEFAULTS, STATION_KINDS, stationKindLabel } from '../config/registries/tokenConstants.js';
import { registerTokenTypes, getTokenType, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { MAX_SPEED_UP_CUT } from '../config/loopConstants.js';
import { clearMat, placeAt } from './fixtures/mat.js';

/**
 * Farming (brief 230 S4): a Field is one Token that grows itself, empty → growing → ripe. The crop
 * is a Farming recipe the Field offers (its station kind narrows the list), picked on the Field and
 * kept for every sowing; sowing pays the recipe's inputs (the seed) once. A ripe Field holds a load
 * of harvest cycles; the last sows again from the Bank, or the Field is stopped without a seed. A
 * Well in reach shortens the growth (to the standard floor), a Composter adds to the load as it
 * ripens. A map's wild patch starts ripe with its crop picked.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const SEED = 'fixture_fa_seed';
const CARROT_SEED = 'fixture_fa_carrot_seed';
const HERB_SEED = 'fixture_fa_herb_seed';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({
    [SEED]: item(SEED, 'Fixture Wheat Seed'),
    [CARROT_SEED]: item(CARROT_SEED, 'Fixture Carrot Seed'),
    [HERB_SEED]: item(HERB_SEED, 'Fixture Herb Seed'),
    fixture_fa_wheat: item('fixture_fa_wheat', 'Fixture Wheat'),
    fixture_fa_carrot: item('fixture_fa_carrot', 'Fixture Carrot'),
    fixture_fa_herb: item('fixture_fa_herb', 'Fixture Herb')
});

const WHEAT = 'fa_recipe_wheat';
const CARROT = 'fa_recipe_carrot';
const HERB = 'fa_recipe_herb';
const crop = (id, kind, seed, out, extra = {}) => ({
    id, name: id, levelRequirement: 1, durationMs: 3000, xp: 1, stationKinds: [kind],
    inputs: [{ itemId: seed, quantity: 1 }],
    outputs: [{ itemId: out, chance: 100, minQty: 1, maxQty: 1 }],
    ...extra
});
registerRecipePools({
    farming: [
        crop(WHEAT, 'field', SEED, 'fixture_fa_wheat', { crop: { growMs: 60000, load: 3, ripeSprite: 't_field_wheat' } }),
        crop(CARROT, 'field', CARROT_SEED, 'fixture_fa_carrot', { crop: { growMs: 30000, load: 2 } }),
        crop(HERB, 'herb_garden', HERB_SEED, 'fixture_fa_herb', { crop: { growMs: 20000, load: 1 } })
    ]
});

const works = (id, kind) => [{ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: kind } }];
const harvest = { skill: 'farming', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] };
const provides = (id, target, payload) => ({
    id: `stm_${id}`, keyword: 'provides', to: { mode: 'id', value: target }, reach: 'nearby', payload
});
const base = (id, extra) => ({ id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_farmland', requiresHero: true, ...extra });
registerTokenTypes({
    fa_field: base('fa_field', {
        name: 'Fixture Field', config: harvest, statements: works('fa_field', 'field'),
        field: { emptySprite: 't_farmland', growingSprite: 't_garden' }
    }),
    fa_garden: base('fa_garden', {
        name: 'Fixture Herb Garden', config: harvest, statements: works('fa_garden', 'herb_garden'),
        field: { emptySprite: 't_garden' }
    }),
    fa_wild: base('fa_wild', {
        name: 'Fixture Wild Wheat', config: harvest, statements: works('fa_wild', 'field'),
        field: { emptySprite: 't_farmland', startsWith: WHEAT }
    }),
    fa_plain_field: base('fa_plain_field', { name: 'Fixture Plain Field', config: harvest, statements: works('fa_plain_field', 'field'), field: {} }),
    fa_well: base('fa_well', { tokenType: 'buff', requiresHero: false, statements: [
        provides('fa_well', 'fa_field', { type: EFFECT_TYPES.GROW_TIME, bucket: 'percentage', value: -0.5 })] }),
    fa_composter: base('fa_composter', { tokenType: 'buff', requiresHero: false, statements: [
        provides('fa_composter', 'fa_field', { type: EFFECT_TYPES.CROP_LOAD, bucket: 'flat', value: 2 })] })
});

const AT = { x: 800, y: 500 };
const tick = (ms, step = 100) => { for (let t = 0; t < ms; t += step) TimedChanges.tick(step); };
const seeds = (id = SEED) => InventoryManager.getItemCount(id);

function arrive(typeId, x = AT.x, y = AT.y) {
    const t = placeAt(typeId, x, y);
    TileModifiers.rebuildAround([{ x, y }]);
    return t;
}
const def = (instance) => getTokenType(instance.typeId);
const stage = (instance) => Fields.stageOf(instance, def(instance));
const pick = (instance, recipeId) => expect(StationRecipe.setSelectedRecipe(instance, recipeId)).toBe(true);

beforeAll(() => TimedChanges.init());

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    getGlobalAggregator().clearAll();
    Growth.resetGrowthAlerts();
    clearMat();
});

afterEach(() => {
    clearMat();
    vi.restoreAllMocks();
});

describe('the Field and crop terms', () => {
    it('a field block reads with blanks dropped; none is not a Field', () => {
        expect(fieldOf({ field: { emptySprite: ' t_farmland ', growingSprite: '', startsWith: WHEAT } }))
            .toEqual({ emptySprite: 't_farmland', growingSprite: null, startsWith: WHEAT });
        expect(fieldOf({})).toBeNull();
        expect(fieldOf({ field: [] })).toBeNull();
        expect(Fields.isField(getTokenType('fa_field'))).toBe(true);
        expect(Fields.isField(getTokenType('fa_well'))).toBe(false);
    });

    it('a crop reads its grow time, load, ripe sprite and seed; defaults when unauthored; kept per recipe', () => {
        const recipe = { inputs: [{ itemId: 's', quantity: 1 }, { itemId: 's', quantity: 2 }, { itemId: '', quantity: 1 }], crop: { growMs: 5400000, load: 12, ripeSprite: ' t_x ' } };
        const terms = cropTermsOf(recipe);
        expect(terms).toEqual({ growMs: 5400000, load: 12, ripeSprite: 't_x', seeds: [{ itemId: 's', quantity: 3 }] });
        expect(cropTermsOf(recipe)).toBe(terms);
        expect(Object.isFrozen(terms.seeds)).toBe(true);
        expect(cropTermsOf({})).toEqual({ ...CROP_DEFAULTS, ripeSprite: null, seeds: [] });
        expect(CROP_DEFAULTS).toEqual({ growMs: 3600000, load: 10 });
        expect(cropTermsOf({ crop: { growMs: -1, load: 0.5 } })).toMatchObject(CROP_DEFAULTS);
    });

    it('Field, Herb Garden and Windmill are station kinds with words', () => {
        for (const kind of ['field', 'herb_garden', 'windmill']) expect(STATION_KINDS).toContain(kind);
        expect(stationKindLabel('herb_garden')).toBe('Herb Garden');
    });

    it('each kind offers its own crops; a Field never wears out', () => {
        expect(StationRecipe.poolFor(getTokenType('fa_field')).map(r => r.id)).toEqual([WHEAT, CARROT]);
        expect(StationRecipe.poolFor(getTokenType('fa_garden')).map(r => r.id)).toEqual([HERB]);
        expect(tokenStartingUses('fa_field')).toBeNull();
    });
});

describe('⭐ empty → growing → ripe', () => {
    it('a new Field is empty with nothing picked: the station\'s Choose a recipe, no clock', () => {
        const field = arrive('fa_field');
        expect(stage(field)).toBe(Fields.STAGE.EMPTY);
        expect(Fields.workReason(field)).toBeNull();
        expect(WorkCheck.fixableReason(field.id, field).reason).toBe(ALERT.CHOOSE_RECIPE);
        tick(5000);
        expect(stage(field)).toBe(Fields.STAGE.EMPTY);
        expect(field.clocks?.fieldMs ?? 0).toBe(0);
    });

    it('picking a crop sows it on the next tick for one seed; it ripens on time with its load', () => {
        InventoryManager.addItem(SEED, 2);
        const field = arrive('fa_field');
        pick(field, WHEAT);
        expect(WorkCheck.fixableReason(field.id, field).reason).toBe(ALERT.GROWING);
        tick(100);
        expect(stage(field)).toBe(Fields.STAGE.GROWING);
        expect(seeds()).toBe(1);
        expect(Fields.nextRipening(field)).toMatchObject({ totalMs: 60000, cropId: WHEAT });
        tick(59900);
        expect(stage(field)).toBe(Fields.STAGE.GROWING);
        tick(100);
        expect(stage(field)).toBe(Fields.STAGE.RIPE);
        expect(Fields.loadLeft(field)).toBe(3);
        expect(field.field).toEqual({ cropId: WHEAT, load: 3, full: 3 });
        expect(WorkCheck.fixableReason(field.id, field).reason).toBeNull();
        // Ripe, its clock stands at zero: nothing more happens until it is harvested.
        tick(120000);
        expect(Fields.loadLeft(field)).toBe(3);
        expect(seeds()).toBe(1);
    });

    it('ripe, it is worked as its crop: no inputs per harvest, the crop\'s outputs and time', () => {
        InventoryManager.addItem(SEED, 1);
        const field = arrive('fa_field');
        pick(field, WHEAT);
        tick(60100);
        const io = effectiveIO(field.id, field);
        expect(io.recipe.id).toBe(WHEAT);
        expect(io.inputs).toEqual([]);
        expect(io.outputs.map(o => o.itemId)).toEqual(['fixture_fa_wheat']);
        expect(io.cycleTimeMs).toBe(3000);
    });

    it('with no seed it is stopped: says what it needs, pays nothing, and sows the tick a seed arrives', () => {
        const watch = [];
        const off = EventBus.subscribe(BOARD_EVENTS.GROWTH_ALERT_CHANGED, (p) => watch.push({ alert: p.alert, needs: [...(p.needs || [])] }));
        const field = arrive('fa_field');
        pick(field, WHEAT);
        tick(1000);
        expect(stage(field)).toBe(Fields.STAGE.EMPTY);
        expect(Fields.isStopped(field)).toBe(true);
        expect(Growth.growthAlertOf(field.id)).toEqual({ alert: ALERT.GROW_NEEDS_ITEM, needs: [SEED] });
        expect(Fields.workReason(field)).toBe(ALERT.GROW_NEEDS_ITEM);
        expect(WorkCheck.isAway(field)).toBe(true);
        // Said once as it stopped, not every tick.
        expect(watch).toEqual([{ alert: ALERT.GROW_NEEDS_ITEM, needs: [SEED] }]);

        InventoryManager.addItem(SEED, 1);
        tick(100);
        expect(stage(field)).toBe(Fields.STAGE.GROWING);
        expect(seeds()).toBe(0);
        expect(Growth.growthAlertOf(field.id)).toBeNull();
        expect(watch.at(-1)).toEqual({ alert: null, needs: [] });
        off();
    });

    it('a seed lying on the mat pays as well as one in the Bank', () => {
        const field = arrive('fa_field');
        SpriteLayer.addSprite('item', SEED, 1, field.id);
        pick(field, WHEAT);
        tick(100);
        expect(stage(field)).toBe(Fields.STAGE.GROWING);
        expect(SpriteLayer.countOnBoard(SEED)).toBe(0);
    });
});

describe('⭐ harvesting the load; the last cycle sows again', () => {
    function ripeField(seedsInBank) {
        InventoryManager.addItem(SEED, 1 + seedsInBank);
        const field = arrive('fa_field');
        pick(field, WHEAT);
        tick(60100);
        expect(stage(field)).toBe(Fields.STAGE.RIPE);
        return field;
    }

    it('each harvest spends one; the last sows the pick again, paying a seed, growing from when it ended', () => {
        const field = ripeField(1);
        Fields.harvested(field, def(field));
        Fields.harvested(field, def(field));
        expect(Fields.loadLeft(field)).toBe(1);
        expect(seeds()).toBe(1);
        Fields.harvested(field, def(field), { overMs: 400 });
        expect(stage(field)).toBe(Fields.STAGE.GROWING);
        expect(seeds()).toBe(0);
        expect(field.clocks.fieldMs).toBe(400);
        expect(Fields.nextRipening(field).inMs).toBe(59600);
    });

    it('with no seed the last harvest leaves it empty and stopped, saying Needs the seed', () => {
        const field = ripeField(0);
        for (let i = 0; i < 3; i++) Fields.harvested(field, def(field));
        expect(stage(field)).toBe(Fields.STAGE.EMPTY);
        expect(Fields.isStopped(field)).toBe(true);
        expect(Growth.growthAlertOf(field.id)).toEqual({ alert: ALERT.GROW_NEEDS_ITEM, needs: [SEED] });
        expect(WorkCheck.fixableReason(field.id, field).reason).toBe(ALERT.GROW_NEEDS_ITEM);
        // The pick stays: a seed coming in sows it.
        expect(field.selectedRecipeId).toBe(WHEAT);
        InventoryManager.addItem(SEED, 1);
        tick(100);
        expect(stage(field)).toBe(Fields.STAGE.GROWING);
    });

    it('a harvest on a Field with nothing ripe does nothing', () => {
        InventoryManager.addItem(SEED, 1);
        const field = arrive('fa_field');
        pick(field, WHEAT);
        tick(100);
        Fields.harvested(field, def(field));
        expect(stage(field)).toBe(Fields.STAGE.GROWING);
        expect(seeds()).toBe(0);
    });

    it('a change of pick while it grows keeps the crop in the ground; the next sowing is the new pick', () => {
        InventoryManager.addItem(SEED, 1);
        InventoryManager.addItem(CARROT_SEED, 1);
        const field = arrive('fa_field');
        pick(field, WHEAT);
        tick(100);
        pick(field, CARROT);
        expect(Fields.plantedCrop(field).id).toBe(WHEAT);
        expect(Fields.fieldState(field)).toMatchObject({ stage: 'growing', cropId: WHEAT, pickId: CARROT });
        tick(60000);
        expect(effectiveIO(field.id, field).recipe.id).toBe(WHEAT);
        for (let i = 0; i < 3; i++) Fields.harvested(field, def(field));
        expect(Fields.plantedCrop(field).id).toBe(CARROT);
        expect(seeds(CARROT_SEED)).toBe(0);
        expect(Fields.nextRipening(field).totalMs).toBe(30000);
    });
});

describe('supports in reach', () => {
    it('a Well shortens the growth; Wells stack only to the standard floor', () => {
        InventoryManager.addItem(SEED, 1);
        const field = arrive('fa_field');
        arrive('fa_well', AT.x + 150, AT.y);
        pick(field, WHEAT);
        tick(100);
        expect(Fields.nextRipening(field).totalMs).toBe(30000);
        arrive('fa_well', AT.x - 150, AT.y);
        arrive('fa_well', AT.x, AT.y + 150);
        expect(Fields.nextRipening(field).totalMs).toBe(60000 - 60000 * MAX_SPEED_UP_CUT);
    });

    it('a Composter adds to the load as the crop ripens, read once', () => {
        InventoryManager.addItem(SEED, 1);
        const field = arrive('fa_field');
        arrive('fa_composter', AT.x + 150, AT.y);
        pick(field, WHEAT);
        tick(60100);
        expect(Fields.loadLeft(field)).toBe(5);
        expect(Fields.fieldState(field)).toMatchObject({ stage: 'ripe', load: 5, full: 5 });
        // One arriving after it ripened changes nothing until the next crop.
        arrive('fa_composter', AT.x - 150, AT.y);
        expect(Fields.loadLeft(field)).toBe(5);
    });
});

describe('a map\'s wild patch starts ripe with its crop picked', () => {
    it('reads as ripe with the crop\'s load and its pick, writing nothing until it changes', () => {
        const wild = arrive('fa_wild');
        expect(wild.field).toBeUndefined();
        expect(stage(wild)).toBe(Fields.STAGE.RIPE);
        expect(Fields.loadLeft(wild)).toBe(3);
        expect(Fields.pickOf(wild).id).toBe(WHEAT);
        expect(WorkCheck.fixableReason(wild.id, wild).reason).toBeNull();
        tick(10000);
        expect(wild.field).toBeUndefined();
        expect(wild.selectedRecipeId).toBeUndefined();
    });

    it('its first harvest makes the state its own and the pick its starting crop; the last sows from the Bank', () => {
        InventoryManager.addItem(SEED, 1);
        const wild = arrive('fa_wild');
        Fields.harvested(wild, def(wild));
        expect(wild.field).toEqual({ cropId: WHEAT, load: 2, full: 3 });
        expect(wild.selectedRecipeId).toBe(WHEAT);
        Fields.harvested(wild, def(wild));
        Fields.harvested(wild, def(wild));
        expect(stage(wild)).toBe(Fields.STAGE.GROWING);
        expect(seeds()).toBe(0);
    });

    it('with nothing to start with (none named, or not one of its crops) a new copy is empty', () => {
        expect(stage(arrive('fa_plain_field'))).toBe(Fields.STAGE.EMPTY);
        registerTokenTypes({ fa_bad_wild: base('fa_bad_wild', { config: harvest, statements: works('fa_bad_wild', 'field'), field: { startsWith: HERB } }) });
        expect(stage(arrive('fa_bad_wild', AT.x + 300))).toBe(Fields.STAGE.EMPTY);
    });
});

describe('what it looks like', () => {
    it('empty, growing and ripe sprites; the Token\'s own art where none is authored; nothing for other Tokens', () => {
        InventoryManager.addItem(SEED, 1);
        const field = arrive('fa_field');
        expect(Fields.stateSpriteOf(field)).toBe('t_farmland');
        pick(field, WHEAT);
        tick(100);
        expect(Fields.stateSpriteOf(field)).toBe('t_garden');
        tick(60000);
        expect(Fields.stateSpriteOf(field)).toBe('t_field_wheat');

        const garden = arrive('fa_garden', AT.x + 300);
        expect(Fields.stateSpriteOf(garden)).toBe('t_garden');
        expect(Fields.stateSpriteOf(arrive('fa_plain_field', AT.x - 300))).toBeNull();
        expect(Fields.stateSpriteOf(arrive('fa_well', AT.x, AT.y + 300))).toBeNull();
    });

    it('a growing crop counts down; the stage changes are announced on the Field', () => {
        const changes = [];
        const off = EventBus.subscribe(BOARD_EVENTS.TILE_CHANGED, (p) => changes.push(p.instanceId));
        InventoryManager.addItem(SEED, 1);
        const field = arrive('fa_field');
        pick(field, WHEAT);
        changes.length = 0;
        tick(100);
        expect(changes).toEqual([field.id]);
        tick(20000);
        expect(Fields.nextRipening(field).inMs).toBe(40000);
        tick(40000);
        expect(changes).toEqual([field.id, field.id]);
        off();
    });
});

describe('old saves and changed content', () => {
    it('a Field saved before Fields (an old spawner clock, no field state) loads as empty, waiting for a pick', () => {
        const old = BoardState.createTokenInstance('fa_field', null);
        old.clocks = { spawnMs: 12000 };
        placeAt(old, AT.x, AT.y);
        expect(stage(old)).toBe(Fields.STAGE.EMPTY);
        tick(1000);
        expect(stage(old)).toBe(Fields.STAGE.EMPTY);
        expect(WorkCheck.fixableReason(old.id, old).reason).toBe(ALERT.CHOOSE_RECIPE);
    });

    it('a crop gone from its recipes reads as empty ground, and is cleared on the next change', () => {
        const field = arrive('fa_field');
        field.field = { cropId: 'fa_recipe_gone', load: 2, full: 3 };
        expect(stage(field)).toBe(Fields.STAGE.EMPTY);
        expect(Fields.plantedCrop(field)).toBeNull();
        InventoryManager.addItem(SEED, 1);
        pick(field, WHEAT);
        tick(100);
        expect(field.field).toEqual({ cropId: WHEAT });
    });
});
