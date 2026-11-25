import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as Charges from '../systems/board/Charges.js';
import * as Respawn from '../systems/board/Respawn.js';
import * as Fields from '../systems/board/Fields.js';
import * as Flags from '../systems/board/Flags.js';
import * as Growth from '../systems/board/Growth.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import { LootSystem } from '../systems/combat/LootSystem.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { registerTokenTypes, tokenStartingUses, getTokenType } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { registerRecipePools, getRecipe } from '../config/registries/recipePoolRegistry.js';
import { endTermsOf, cropTermsOf } from '../config/registries/tokenConstants.js';
import { buildRateBook, LIFECYCLE } from '../../cms/src/engine/ledger/rates.js';
import { tokenCardModel, CARD_BLOCK, cardLifecycle, liveCardSources } from '../ui/components/board/tokenCard.js';
import { oneInText } from '../utils/Formatters.js';
import { placeAt, clearMat } from './fixtures/mat.js';
import { migrateState } from '../systems/core/SaveMigration.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * Running out by chance: a gathering source that comes back (a vein rests, a tree becomes its
 * Stump, a ripe Field is harvested out and sows again) ends by a chance each cycle instead of a
 * count. Unauthored, the chance is one over today's count, so the average life stays; an authored
 * `endChance` (on the Token, or `crop.endChance` on a crop) takes its place. A Composter in reach
 * lowers a Field's chance (more harvests on average). Tokens that leave the mat keep their counts.
 */

const mining = {
    skill: 'mining', skillRequired: 1, cycleTimeMs: 1000, xp: 1,
    inputs: [], outputs: [{ itemId: 'fixture_copper_ore', quantity: 1, chance: 100 }]
};
const logging = {
    skill: 'forestry', skillRequired: 1, cycleTimeMs: 1000, xp: 1,
    inputs: [], outputs: [{ itemId: 'fixture_oak_wood', quantity: 1, chance: 100 }]
};
const resource = (id, extra) => ({
    id, name: id, tokenType: 'resource', rarity: 'common', theme: 'fixture', sprite: 's_industry', ...extra
});

const SEED = 'fixture_ce_seed';
const GRAIN = 'fixture_ce_grain';
const item = (id, name) => ({
    id, name, type: 'material', sprite: 'i_wheat', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({ [SEED]: item(SEED, 'CE Seed'), [GRAIN]: item(GRAIN, 'CE Grain') });

const WHEAT = 'ce_recipe_wheat';
const BARLEY = 'ce_recipe_barley';
const crop = (id, cropBlock) => ({
    id, name: id, levelRequirement: 1, durationMs: 1000, xp: 1, stationKinds: ['field'],
    inputs: [], outputs: [{ itemId: GRAIN, chance: 100, minQty: 1, maxQty: 1 }], crop: cropBlock
});
registerRecipePools({
    farming: [
        // Today's count: ten harvests a crop, so one in ten to finish each harvest.
        crop(WHEAT, { growMs: 10000, load: 10 }),
        // Authored by chance, in place of the count.
        crop(BARLEY, { growMs: 10000, endChance: 25 })
    ]
});

const works = (id) => [{ id: `stm_${id}_works`, keyword: KEYWORD.STATION, payload: { skill: 'farming', stationKind: 'field' } }];
const harvest = { skill: 'farming', skillRequired: 1, cycleTimeMs: 1000, xp: 1, inputs: [], outputs: [] };

registerTokenTypes({
    ce_vein: resource('ce_vein', { uses: 5, config: mining, respawn: { mode: 'refill', afterMs: 5000 } }),
    ce_rich_vein: resource('ce_rich_vein', { uses: 5, endChance: 15, config: mining, respawn: { mode: 'refill', afterMs: 5000 } }),
    ce_chance_only: resource('ce_chance_only', { endChance: 50, config: mining, respawn: { mode: 'refill', afterMs: 5000 } }),
    ce_sure_vein: resource('ce_sure_vein', { endChance: 100, config: mining, respawn: { mode: 'refill', afterMs: 5000 } }),
    ce_endless_vein: resource('ce_endless_vein', { uses: null, config: mining, respawn: { mode: 'refill', afterMs: 5000 } }),
    ce_plain_vein: resource('ce_plain_vein', { uses: 3, config: mining }),
    ce_tree: resource('ce_tree', { uses: 5, sprite: 's_nature', config: logging, respawn: { mode: 'regrow', into: 'ce_stump' } }),
    ce_stump: resource('ce_stump', { uses: null, sprite: 's_nature', config: null, grows: { into: 'ce_tree', afterMs: 60000 } }),
    ce_spawner: resource('ce_spawner', {
        tokenType: 'spawner', uses: 4, respawn: { mode: 'refill', afterMs: 5000 },
        spawner: { spawns: [{ typeId: 'ce_vein', weight: 1 }], allowance: 1, intervalMs: 5000, upkeep: [] }
    }),
    ce_field: {
        id: 'ce_field', name: 'CE Field', tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 't_farmland', requiresHero: true, config: harvest, statements: works('ce_field'), field: {}
    },
    ce_composter: {
        id: 'ce_composter', name: 'CE Composter', tokenType: 'buff', rarity: 'common', theme: 'fixture', uses: null,
        sprite: 's_nature', requiresHero: false,
        statements: [{
            id: 'stm_ce_compost', keyword: 'provides', to: { mode: 'id', value: 'ce_field' }, reach: 'nearby',
            payload: { type: EFFECT_TYPES.CROP_LOAD, bucket: 'flat', value: 1 }
        }]
    }
});

function hero(id, skills) {
    const out = {};
    for (const [s, level] of Object.entries(skills)) out[s] = { level, xp: 0 };
    return { id, name: id, status: 'idle', level: 10, skills: out, hp: { current: 100, max: 100 } };
}

const AT = { x: 800, y: 500 };

/** `Math.random` answering `value` until the test ends (the seeded stream comes back after). */
const rollsAt = (value) => vi.spyOn(Math, 'random').mockReturnValue(value);

beforeAll(() => { Flags.init(); TimedChanges.init(); });
afterAll(() => Flags.teardown());
afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
    vi.clearAllMocks();
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
    GameState.state.heroes = [hero('miner', { mining: 10, forestry: 10, farming: 10 })];
    GameState.state.inventory.maxSlots = 50;
});

describe('the terms: a chance a charge, one over today\'s count unless authored', () => {
    it('a vein of five charges ends one in five; its average life is five', () => {
        expect(endTermsOf(getTokenType('ce_vein'))).toEqual({ chance: 20, life: 5 });
    });

    it('an authored chance takes the place of the count', () => {
        const terms = endTermsOf(getTokenType('ce_rich_vein'));
        expect(terms.chance).toBe(15);
        expect(terms.life).toBeCloseTo(100 / 15);
        expect(endTermsOf(getTokenType('ce_chance_only'))).toEqual({ chance: 50, life: 2 });
    });

    it('a Token that leaves the mat, one that never runs out, and a spawner keep no chance', () => {
        expect(endTermsOf(getTokenType('ce_plain_vein'))).toBeNull();
        expect(endTermsOf(getTokenType('ce_endless_vein'))).toBeNull();
        expect(endTermsOf(getTokenType('ce_spawner'))).toBeNull();
    });

    it('a crop: one over its load, or its authored chance; the load is the average harvests', () => {
        const wheat = cropTermsOf(getRecipe(WHEAT));
        expect(wheat).toMatchObject({ endChance: 10, load: 10 });
        const barley = cropTermsOf(getRecipe(BARLEY));
        expect(barley).toMatchObject({ endChance: 25, load: 4 });
        // No crop block: today's default of ten harvests.
        expect(cropTermsOf({ id: 'x' })).toMatchObject({ endChance: 10, load: 10 });
    });

    it('a Token that ends by chance starts with one life, whatever its count; others as before', () => {
        expect(tokenStartingUses('ce_vein')).toBe(1);
        expect(tokenStartingUses('ce_chance_only')).toBe(1);
        expect(tokenStartingUses('ce_plain_vein')).toBe(3);
        expect(tokenStartingUses('ce_endless_vein')).toBeNull();
        expect(tokenStartingUses('ce_spawner')).toBe(4);
    });
});

describe('each charge spent is a roll at the chance', () => {
    it('a roll under the chance rests the vein, one over it leaves it working', () => {
        const vein = placeAt('ce_vein', AT.x, AT.y);
        const resting = vi.fn();
        const depleted = vi.fn();
        const offRest = EventBus.subscribe(BOARD_EVENTS.TOKEN_RESTING, resting);
        const offDepleted = EventBus.subscribe(BOARD_EVENTS.TOKEN_DEPLETED, depleted);

        const high = rollsAt(0.2);
        expect(Charges.applyDelta(vein, -1)).toMatchObject({ applied: 0, remaining: 1, depleted: false });
        expect(high).toHaveBeenCalledTimes(1);
        expect(Respawn.isResting(vein)).toBe(false);

        rollsAt(0.19);
        expect(Charges.applyDelta(vein, -1)).toMatchObject({ applied: -1, remaining: 0, depleted: true });
        expect(Respawn.isResting(vein)).toBe(true);
        expect(resting).toHaveBeenCalledTimes(1);
        expect(depleted).not.toHaveBeenCalled();
        offRest(); offDepleted();
    });

    it('a sure end draws nothing; a resting Token spends nothing and draws nothing', () => {
        const vein = placeAt('ce_sure_vein', AT.x, AT.y);
        const spy = rollsAt(0.99);
        expect(Charges.applyDelta(vein, -1).depleted).toBe(true);
        expect(Charges.applyDelta(vein, -1)).toMatchObject({ applied: 0, remaining: 0, depleted: false });
        expect(spy).not.toHaveBeenCalled();
    });

    it('two charges at once are one draw at the chance of either ending it', () => {
        // One in five a charge: two charges end it 36 times in a hundred.
        const first = placeAt('ce_vein', AT.x, AT.y);
        const second = placeAt('ce_vein', AT.x + 400, AT.y);
        rollsAt(0.355);
        expect(Charges.applyDelta(first, -2).depleted).toBe(true);
        vi.restoreAllMocks();
        const spy = rollsAt(0.365);
        expect(Charges.applyDelta(second, -2).depleted).toBe(false);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('while it lasts it affords any cost; resting it affords none', () => {
        const vein = placeAt('ce_vein', AT.x, AT.y);
        expect(Charges.canAfford(vein, 3)).toBe(true);
        vein.usesRemaining = 0;
        expect(Charges.canAfford(vein, 1)).toBe(false);
    });

    it('a Token with no way back keeps its count and draws nothing', () => {
        const plain = placeAt('ce_plain_vein', AT.x, AT.y);
        const spy = rollsAt(0);
        expect(Charges.applyDelta(plain, -1)).toMatchObject({ applied: -1, remaining: 2 });
        expect(Charges.applyDelta(plain, -1)).toMatchObject({ applied: -1, remaining: 1 });
        expect(spy).not.toHaveBeenCalled();
    });

    it('a refill gives back its one life', () => {
        const vein = placeAt('ce_vein', AT.x, AT.y);
        rollsAt(0);
        Charges.applyDelta(vein, -1);
        expect(vein.usesRemaining).toBe(0);
        Respawn.refill(vein);
        expect(vein.usesRemaining).toBe(1);
    });
});

describe('the averages stay', () => {
    /** Cycles a life lasts, over many lives on the seeded stream. */
    function averageLife(typeId, lives) {
        const vein = placeAt(typeId, AT.x, AT.y);
        let spent = 0;
        for (let i = 0; i < lives; i++) {
            Respawn.refill(vein);
            do { spent++; } while (!Charges.applyDelta(vein, -1).depleted);
        }
        return spent / lives;
    }

    it('a vein of five charges lasts five cycles on average', () => {
        // One in five: a life's spread is about 4.5 cycles, so 4,000 lives land within 0.4 of 5.
        expect(Math.abs(averageLife('ce_vein', 4000) - 5)).toBeLessThan(0.4);
    });

    it('an authored one in two lasts two', () => {
        expect(Math.abs(averageLife('ce_chance_only', 4000) - 2)).toBeLessThan(0.15);
    });

    it('a Field of ten harvests gives ten on average, and its sowing comes after the last', () => {
        const field = placeAt('ce_field', AT.x, AT.y);
        const def = getTokenType('ce_field');
        expect(StationRecipe.setSelectedRecipe(field, WHEAT)).toBe(true);
        let harvests = 0;
        const crops = 3000;
        for (let i = 0; i < crops; i++) {
            Fields.clockFired(field, def);
            if (Fields.stageOf(field, def) === Fields.STAGE.GROWING) Fields.clockFired(field, def);
            expect(Fields.stageOf(field, def)).toBe(Fields.STAGE.RIPE);
            do {
                harvests++;
                Fields.harvested(field, def);
            } while (Fields.stageOf(field, def) === Fields.STAGE.RIPE);
            expect(Fields.stageOf(field, def)).toBe(Fields.STAGE.GROWING);
        }
        // One in ten: a crop's spread is about 9.5 harvests, so 3,000 crops land within 0.8 of 10.
        expect(Math.abs(harvests / crops - 10)).toBeLessThan(0.8);
    });
});

describe('on the mat', () => {
    /** Tick until `done()` holds, at most `ms`; whether it did. */
    function runUntil(done, ms) {
        for (let t = 0; t < ms; t += 100) {
            if (done()) return true;
            BoardRunner.tick(100);
        }
        return done();
    }
    const ore = () => InventoryManager.getItemCount('fixture_copper_ore') + SpriteLayer.countOnBoard('fixture_copper_ore');
    const wood = () => InventoryManager.getItemCount('fixture_oak_wood') + SpriteLayer.countOnBoard('fixture_oak_wood');

    it('a vein rests after a number of cycles the rolls decide, not five', () => {
        const vein = placeAt('ce_vein', AT.x, AT.y);
        TileModifiers.rebuildAround([AT]);
        Orders.orderAt('miner', AT);
        // Every roll over the chance: twelve cycles and still working, where five charges ran out.
        rollsAt(0.99);
        expect(runUntil(() => ore() >= 12, 60000)).toBe(true);
        expect(Respawn.isResting(vein)).toBe(false);
        // The next roll under it rests the vein at its cycle's end.
        vi.restoreAllMocks();
        rollsAt(0);
        expect(runUntil(() => Respawn.isResting(vein), 3000)).toBe(true);
        expect(vein.usesRemaining).toBe(0);
    });

    it('a tree is felled by a roll: it becomes its Stump', () => {
        const tree = placeAt('ce_tree', AT.x, AT.y);
        TileModifiers.rebuildAround([AT]);
        Orders.orderAt('miner', AT);
        rollsAt(0.99);
        expect(runUntil(() => wood() >= 8, 60000)).toBe(true);
        expect(BoardState.getTokenById(tree.id)?.typeId).toBe('ce_tree');
        vi.restoreAllMocks();
        rollsAt(0);
        expect(runUntil(() => BoardState.tokens().some(t => t.typeId === 'ce_stump'), 3000)).toBe(true);
        expect(BoardState.tokens().some(t => t.typeId === 'ce_tree')).toBe(false);
    });
});

describe('a Field ends by chance; a Composter lowers it', () => {
    function ripe(typeId = 'ce_field', recipeId = WHEAT) {
        const field = placeAt(typeId, AT.x, AT.y);
        TileModifiers.rebuildAround([AT]);
        expect(StationRecipe.setSelectedRecipe(field, recipeId)).toBe(true);
        const def = getTokenType(typeId);
        Fields.clockFired(field, def);
        Fields.clockFired(field, def);
        expect(Fields.stageOf(field, def)).toBe(Fields.STAGE.RIPE);
        return field;
    }

    it('ripe, it holds no count: one in ten to finish each harvest', () => {
        const field = ripe();
        expect(field.field).toEqual({ cropId: WHEAT, ripe: true, full: 10 });
        expect(Fields.fieldState(field)).toMatchObject({ stage: 'ripe', endChance: 10, harvests: 10 });
        expect(Fields.harvestEndChance(field)).toBe(10);
    });

    it('a roll under the chance finishes it and sows again; one over keeps it ripe', () => {
        const field = ripe();
        const def = getTokenType('ce_field');
        rollsAt(0.1);
        Fields.harvested(field, def);
        expect(Fields.stageOf(field, def)).toBe(Fields.STAGE.RIPE);
        vi.restoreAllMocks();
        rollsAt(0.0999);
        Fields.harvested(field, def);
        expect(Fields.stageOf(field, def)).toBe(Fields.STAGE.GROWING);
    });

    it('a refreshed harvest draws nothing and keeps it ripe', () => {
        const field = ripe();
        const def = getTokenType('ce_field');
        const spy = rollsAt(0);
        Fields.harvested(field, def, { refreshed: true });
        expect(spy).not.toHaveBeenCalled();
        expect(Fields.stageOf(field, def)).toBe(Fields.STAGE.RIPE);
    });

    it('an authored chance on the crop takes the place of its load', () => {
        const field = ripe('ce_field', BARLEY);
        expect(Fields.harvestEndChance(field)).toBe(25);
        expect(Fields.fieldState(field).harvests).toBe(4);
    });

    it('a Composter in reach (one more harvest) lowers the chance to one in eleven', () => {
        placeAt('ce_composter', AT.x + 120, AT.y);
        TileModifiers.rebuildAround([{ x: AT.x + 120, y: AT.y }]);
        const field = ripe();
        expect(field.field.full).toBe(11);
        expect(Fields.harvestEndChance(field)).toBeCloseTo(100 / 11);
    });
});

describe('an old save with a count in progress', () => {
    it('a vein part-way through its count works on and ends by chance from its next cycle', () => {
        const vein = placeAt(BoardState.createTokenInstance('ce_vein', 3), AT.x, AT.y);
        rollsAt(0.5);
        expect(Charges.applyDelta(vein, -1)).toMatchObject({ applied: 0, remaining: 3 });
        vi.restoreAllMocks();
        rollsAt(0);
        expect(Charges.applyDelta(vein, -1)).toMatchObject({ remaining: 0, depleted: true });
        expect(Respawn.isResting(vein)).toBe(true);
        Respawn.refill(vein);
        expect(vein.usesRemaining).toBe(1);
    });

    it('a resting vein keeps resting, its rest clock as saved', () => {
        const saved = BoardState.createTokenInstance('ce_vein', 0);
        saved.clocks = { [Respawn.CLOCK]: 3000 };
        const vein = placeAt(saved, AT.x, AT.y);
        expect(Respawn.isResting(vein)).toBe(true);
        expect(Respawn.nextRespawn(vein)).toMatchObject({ mode: 'refill', inMs: 2000 });
    });

    it('a ripe Field saved with harvests left is ripe and ends by chance; a miss drops the count', () => {
        const saved = BoardState.createTokenInstance('ce_field', null);
        saved.selectedRecipeId = WHEAT;
        saved.field = { cropId: WHEAT, load: 4, full: 10, seedOwed: true };
        const field = placeAt(saved, AT.x, AT.y);
        const def = getTokenType('ce_field');
        expect(Fields.stageOf(field, def)).toBe(Fields.STAGE.RIPE);
        expect(Fields.harvestEndChance(field)).toBe(10);
        rollsAt(0.5);
        Fields.harvested(field, def);
        expect(field.field).toEqual({ cropId: WHEAT, ripe: true, full: 10 });
        vi.restoreAllMocks();
        rollsAt(0);
        Fields.harvested(field, def);
        expect(Fields.stageOf(field, def)).toBe(Fields.STAGE.GROWING);
    });

    it('through a save and a load, both keep what they held until they next work', () => {
        const vein = placeAt(BoardState.createTokenInstance('ce_vein', 3), AT.x, AT.y);
        const saved = BoardState.createTokenInstance('ce_field', null);
        saved.selectedRecipeId = WHEAT;
        saved.field = { cropId: WHEAT, load: 4, full: 10 };
        const field = placeAt(saved, AT.x + 400, AT.y);
        const revived = JSON.parse(JSON.stringify(GameState.serialize()));
        GameState.state = migrateState(revived.state, revived.version);
        const loadedVein = BoardState.getTokenById(vein.id);
        const loadedField = BoardState.getTokenById(field.id);
        expect(loadedVein.usesRemaining).toBe(3);
        expect(Respawn.isResting(loadedVein)).toBe(false);
        expect(Charges.endChanceOf(loadedVein)).toBe(20);
        expect(loadedField.field).toEqual({ cropId: WHEAT, load: 4, full: 10 });
        expect(Fields.stageOf(loadedField)).toBe(Fields.STAGE.RIPE);
        expect(Fields.harvestEndChance(loadedField)).toBe(10);
    });

    it('a growing Field saved mid-growth grows on', () => {
        const saved = BoardState.createTokenInstance('ce_field', null);
        saved.selectedRecipeId = WHEAT;
        saved.field = { cropId: WHEAT };
        const field = placeAt(saved, AT.x, AT.y);
        expect(Fields.stageOf(field)).toBe(Fields.STAGE.GROWING);
    });
});

describe('the card says the chance, never a count', () => {
    it('a vein\'s cycle shows one in five to run out, and no charges', () => {
        const vein = placeAt('ce_vein', AT.x, AT.y);
        const cycle = tokenCardModel('ce_vein', vein.id).blocks.find(b => b.id === CARD_BLOCK.CYCLE);
        expect(cycle).toMatchObject({ endChance: 20, uses: null });
        // Off the mat (a shop, the Encyclopedia), the type's own chance.
        expect(tokenCardModel('ce_vein').blocks.find(b => b.id === CARD_BLOCK.CYCLE)).toMatchObject({ endChance: 20, uses: null });
    });

    it('a Token that leaves the mat still shows its charges', () => {
        const plain = placeAt('ce_plain_vein', AT.x, AT.y);
        expect(tokenCardModel('ce_plain_vein', plain.id).blocks.find(b => b.id === CARD_BLOCK.CYCLE)).toMatchObject({ uses: 3, endChance: null });
    });

    it('a ripe Field says one in ten to finish each harvest', () => {
        const field = placeAt('ce_field', AT.x, AT.y);
        StationRecipe.setSelectedRecipe(field, WHEAT);
        const def = getTokenType('ce_field');
        Fields.clockFired(field, def);
        Fields.clockFired(field, def);
        const line = cardLifecycle(field, def, liveCardSources()).find(l => l.icon === 'grow');
        expect(line.text).toBe('1 in 10');
        expect(line.tip).toMatch(/1 in 10 chance to be the last/);
    });

    it('one in N when the chance is one over a whole number, else the chance', () => {
        expect(oneInText(20)).toBe('1 in 5');
        expect(oneInText(100 / 3)).toBe('1 in 3');
        expect(oneInText(0.1)).toBe('1 in 1,000');
        expect(oneInText(15)).toBe('15%');
        expect(oneInText(100)).toBe('1 in 1');
    });
});

describe('the ledger reads the average life', () => {
    const tokens = {
        ce_vein: resource('ce_vein', { uses: 5, requiresHero: true, config: { ...mining, cycleTimeMs: 3000 }, respawn: { mode: 'refill', afterMs: 60000 } }),
        ce_rich_vein: resource('ce_rich_vein', { endChance: 15, requiresHero: true, config: { ...mining, cycleTimeMs: 3000 }, respawn: { mode: 'refill', afterMs: 60000 } }),
        ce_field: {
            id: 'ce_field', name: 'CE Field', uses: null, field: {},
            config: { skill: 'farming', skillRequired: 1, cycleTimeMs: 3000, xp: 1, inputs: [], outputs: [] },
            statements: [{ keyword: 'station', payload: { skill: 'farming', stationKind: 'field' } }]
        }
    };
    const recipes = [
        { ...crop(WHEAT, { growMs: 600000, load: 5 }), skill: 'farming' },
        { ...crop(BARLEY, { growMs: 600000, endChance: 15 }), skill: 'farming' }
    ];
    const items = {
        fixture_copper_ore: { id: 'fixture_copper_ore', name: 'Ore', type: 'material' },
        [GRAIN]: { id: GRAIN, name: 'Grain', type: 'material' }
    };
    const book = () => buildRateBook({ tokens, items, recipes, effects: {}, skillPerks: {} });

    it('a vein of five charges: five cycles a life, as before', () => {
        expect(book().rateOf({ token: 'ce_vein' }).lifecycle).toMatchObject({ kind: LIFECYCLE.REFILL, cycles: 5 });
    });

    it('an authored one in 15 %: 100 / 15 cycles a life', () => {
        const life = book().rateOf({ token: 'ce_rich_vein' }).lifecycle;
        expect(life.kind).toBe(LIFECYCLE.REFILL);
        expect(life.cycles).toBeCloseTo(100 / 15);
    });

    it('a Field: its load, or one over its authored chance', () => {
        expect(book().rateOf({ token: 'ce_field', recipe: WHEAT }).lifecycle.cycles).toBe(5);
        expect(book().rateOf({ token: 'ce_field', recipe: BARLEY }).lifecycle.cycles).toBeCloseTo(100 / 15);
    });
});
