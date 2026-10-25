import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Growth from '../systems/board/Growth.js';
import * as Fields from '../systems/board/Fields.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as BoardState from '../systems/board/BoardState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes, getTokenType, tokenName } from '../config/registries/tokenRegistry.js';
import { registerItems, getItem } from '../config/registries/itemRegistry.js';
import { registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { tokenDetailOf } from '../ui/components/board/useTokenDetail.js';
import { tokenCardModel, liveCardSources, CARD_BLOCK } from '../ui/components/board/tokenCard.js';
import { lifecycleLines } from '../ui/components/drawer/lifecycleLines.js';
import { getRecipe } from '../config/registries/recipePoolRegistry.js';
import { clearMat, placeAt } from './fixtures/mat.js';

/**
 * How a Field shows itself (brief 230 S4): drawn as its type's empty or growing picture or its
 * crop's ripe one (one state-sprite hook with the resting vein's rock), a countdown while its crop
 * grows, the crop it sows on its gear (a wild patch's starting crop before any pick), and its
 * card and inspection lines: growing, ripe with harvests left, stopped for a seed, what it sows
 * next, what a sowing costs. Its seed is never shown as a per-harvest input.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const SEED = 'fixture_fv_seed';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({ [SEED]: item(SEED, 'View Wheat Seed'), fixture_fv_wheat: item('fixture_fv_wheat', 'View Wheat') });
const WHEAT = 'fv_recipe_wheat';
const OATS = 'fv_recipe_oats';
const crop = (id, name, extra) => ({
    id, name, levelRequirement: 1, durationMs: 2000, xp: 1, stationKinds: ['field'],
    inputs: [{ itemId: SEED, quantity: 1 }],
    outputs: [{ itemId: 'fixture_fv_wheat', chance: 100, minQty: 1, maxQty: 1 }],
    ...extra
});
registerRecipePools({
    farming: [
        crop(WHEAT, 'Wheat', { crop: { growMs: 60000, load: 3, ripeSprite: 't_field_wheat' } }),
        crop(OATS, 'Oats', { crop: { growMs: 30000, load: 2 } })
    ]
});
const fieldType = (id, name, field) => ({
    id, name, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 't_farmland', requiresHero: true,
    config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [] },
    statements: [{ id: `stm_${id}`, keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }],
    field
});
registerTokenTypes({
    fv_field: fieldType('fv_field', 'View Field', { emptySprite: 't_farmland', growingSprite: 't_garden' }),
    fv_wild: fieldType('fv_wild', 'View Wild Wheat', { emptySprite: 't_farmland', startsWith: WHEAT })
});

const tick = (ms) => { for (let t = 0; t < ms; t += 100) TimedChanges.tick(100); };
function arrive(typeId, x = 800, y = 500) {
    const t = placeAt(typeId, x, y);
    TileModifiers.rebuildAround([{ x, y }]);
    return t;
}
const detail = (t) => tokenDetailOf(t.id, getTokenType(t.typeId));
const card = (t) => tokenCardModel(t.typeId, t.id);
const block = (model, id) => model.blocks.find(b => b.id === id);
const inspectSources = () => ({
    typeOf: getTokenType, tokenName, itemName: (id) => getItem(id)?.name || id,
    spawnerStatus: () => null, selectedRecipe: StationRecipe.selectedRecipe, poolFor: StationRecipe.poolFor,
    originOf: BoardState.originOf, field: Fields.fieldState,
    recipeName: (id) => getRecipe(id)?.name || id, recipeOf: getRecipe
});
const rows = (t) => lifecycleLines(t, inspectSources());

beforeAll(() => TimedChanges.init());
beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    Growth.resetGrowthAlerts();
    clearMat();
});
afterEach(() => clearMat());

describe('⭐ drawn by its state, one hook with the resting rock', () => {
    it('empty, then growing with a countdown, then ripe as its crop; the gear shows the pick', () => {
        InventoryManager.addItem(SEED, 1);
        const field = arrive('fv_field');
        expect(detail(field)).toMatchObject({ stateSprite: 't_farmland', ripens: false, recipe: null });
        StationRecipe.setSelectedRecipe(field, WHEAT);
        tick(100);
        expect(detail(field)).toMatchObject({ stateSprite: 't_garden', ripens: true });
        expect(detail(field).recipe.id).toBe(WHEAT);
        tick(60000);
        expect(detail(field)).toMatchObject({ stateSprite: 't_field_wheat', ripens: false });
    });

    it('a wild patch: ripe as its crop at once, its gear showing that crop before any pick', () => {
        const wild = arrive('fv_wild');
        expect(detail(wild)).toMatchObject({ stateSprite: 't_field_wheat' });
        expect(detail(wild).recipe.id).toBe(WHEAT);
    });
});

describe('the card', () => {
    it('growing: the crop, no seed per harvest, a countdown, what a sowing costs; Change crop', () => {
        InventoryManager.addItem(SEED, 1);
        const field = arrive('fv_field');
        StationRecipe.setSelectedRecipe(field, WHEAT);
        tick(20100);
        const model = card(field);
        const recipe = block(model, CARD_BLOCK.RECIPE);
        expect(recipe.recipeName).toBe('Wheat');
        expect(recipe.needs).toEqual([]);
        expect(recipe.change).toEqual({ label: 'Change crop', chosen: true });
        const lines = block(model, CARD_BLOCK.LIFECYCLE).lines;
        expect(lines[0]).toMatchObject({ icon: 'grow', text: '0:40', tip: 'Wheat growing: ripe in 40 s' });
        expect(lines.at(-1)).toMatchObject({ tip: 'Each sowing costs 1 View Wheat Seed from the Bank' });
    });

    it('ripe: harvests left; after a change of pick, what it sows next', () => {
        InventoryManager.addItem(SEED, 1);
        const field = arrive('fv_field');
        StationRecipe.setSelectedRecipe(field, WHEAT);
        tick(60100);
        StationRecipe.setSelectedRecipe(field, OATS);
        const lines = block(card(field), CARD_BLOCK.LIFECYCLE).lines;
        expect(lines[0]).toMatchObject({ text: '3/3', tip: 'Wheat ripe: 3 of 3 harvests left; the last sows it again' });
        expect(lines[1]).toMatchObject({ text: 'Oats', tip: 'Sows Oats next' });
    });

    it('stopped: what it needs to sow', () => {
        const field = arrive('fv_field');
        StationRecipe.setSelectedRecipe(field, WHEAT);
        tick(200);
        const lines = block(card(field), CARD_BLOCK.LIFECYCLE).lines;
        expect(lines[0]).toMatchObject({ text: '–', tip: 'Stopped: needs View Wheat Seed to sow Wheat', tone: 'warning' });
    });

    it('the live sources carry the Field readers', () => {
        const src = liveCardSources();
        expect(src.field).toBe(Fields.fieldState);
        expect(src.fieldCrop).toBe(Fields.cropOf);
    });
});

describe('the inspection rows', () => {
    it('nothing picked: Choose a crop, and not the station\'s Choose a recipe', () => {
        const out = rows(arrive('fv_field'));
        expect(out).toContainEqual({ label: 'Field', value: 'Choose a crop', tone: 'warning' });
        expect(out.some(r => r.label === 'Recipe')).toBe(false);
    });

    it('growing, ripe, stopped', () => {
        InventoryManager.addItem(SEED, 1);
        const field = arrive('fv_field');
        StationRecipe.setSelectedRecipe(field, WHEAT);
        tick(100);
        expect(rows(field)[0]).toEqual({ label: 'Growing Wheat', value: 'ripe in 1 min' });
        expect(rows(field)).toContainEqual({ label: 'Each sowing', value: '1 View Wheat Seed from the Bank', tone: 'muted' });
        tick(60000);
        expect(rows(field)[0]).toEqual({ label: 'Ripe Wheat', value: '3 of 3 harvests left', tone: 'good' });
        for (let i = 0; i < 3; i++) Fields.harvested(field, getTokenType(field.typeId));
        expect(rows(field)[0]).toEqual({ label: 'Field', value: 'stopped: needs View Wheat Seed to sow Wheat', tone: 'warning' });
    });
});
