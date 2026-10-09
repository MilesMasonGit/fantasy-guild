import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { GameLoop } from '../systems/core/GameLoop.js';
import { SaveManager } from '../systems/core/SaveManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { migrateState } from '../systems/core/SaveMigration.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import { getGlobalAggregator } from '../systems/effects/GuildModifiers.js';
import { EFFECT_TYPES } from '../systems/effects/constants.js';
import { resetMatTuning } from '../config/matTuning.js';
import { matW, matH } from '../config/matGeometry.js';
import * as Atlas from '../systems/atlas/Atlas.js';
import * as Cartography from '../systems/atlas/Cartography.js';
import * as RegionRules from '../systems/atlas/RegionRules.js';
import { placeAt } from './fixtures/mat.js';
import './fixtures/testTokens.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => []), dismissAll: vi.fn(), setQuiet: vi.fn()
}));

/**
 * ⭐ A Region's own rules hold all over its mat while the guild is there, and nowhere else: they
 * sit in the guild-wide aggregator only while their Region is the active one, and come back after
 * a load, because that aggregator is never saved.
 */

const OAK = 'fixture_producer';      // works as Forestry
const ORE = 'fixture_producer_alt';  // works as Mining

const FORESTRY_RULE = Object.freeze({
    id: 'stm_test_region_forestry', keyword: 'provides',
    payload: Object.freeze({ type: 'YIELD', bucket: 'percentage', value: 0.1, category: 'forestry' })
});
const WOOD = Object.freeze({
    id: 'test_map_wood', name: 'Wood Map', kind: 'base', biome: 'forest', points: 12,
    nodes: [{ typeId: OAK, weight: 1 }]
});
const HILLS = Object.freeze({
    id: 'test_map_hills', name: 'Hills Map', kind: 'base', biome: 'mountain', points: 12,
    nodes: [{ typeId: ORE, weight: 1 }]
});
const THICKET = Object.freeze({
    id: 'test_mod_thicket', name: 'Thicket', kind: 'modifier',
    effects: [{ kind: 'density', typeId: OAK, points: 4 }],
    rules: [FORESTRY_RULE]
});

const centre = () => ({ x: Math.round(matW() / 2), y: Math.round(matH() / 2) });

/** How a Token's Forestry (or Mining) yield of 100 resolves right now. */
const yieldOf = (instanceId, skill) => TileModifiers.resolveAxis(instanceId, EFFECT_TYPES.YIELD, 100, skill);
/** The guild-wide aggregator's percentages for a skill's yield. */
const guildYield = (skill) => getGlobalAggregator().collectPercentages(EFFECT_TYPES.YIELD, skill);

/** A fixture node of the active Region, of type `typeId`. */
const nodeOf = (typeId) => BoardState.tokens().find(t => BoardState.isFixture(t) && t.typeId === typeId);

function newGame() {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    const c = centre();
    placeAt('token_guild_hall', c.x, c.y);
    Atlas.createStarterRegion();
    Cartography.clearStock();
    // A new game: everything may have changed, as the engine announces it.
    EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'new_game' });
}

/** Settle `ingredients` (granting them first) and return the Region. */
function settleRegion(ingredients, seed = 1) {
    Cartography.grant(ingredients, 1);
    const result = Atlas.settle({ ingredients, seed });
    expect(result.success).toBe(true);
    return result.region;
}

async function reload(json) {
    const data = JSON.parse(json);
    await GameState.initFromSave(migrateState(data.state, data.version));
    EventBus.publish(ENGINE_EVENTS.GAME_LOADED, { slot: 0, savedAt: data.savedAt });
}

beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    SettingsManager.init();
    EngineBootstrap.init();
    GameLoop.stop();
});

beforeEach(() => {
    getGlobalAggregator().clearAll();
    newGame();
});

afterEach(() => {
    SaveManager.currentSlot = null;
    GameLoop.stop();
    Cartography.clearStock();
    getGlobalAggregator().clearAll();
});

afterAll(() => {
    vi.restoreAllMocks();
    resetMatTuning();
});

describe('a Region\'s rules are in force only while the guild is there', () => {
    it('settling registers nothing; travelling there does; leaving drops them; coming back restores them', () => {
        const home = Atlas.activeRegionId();
        const forest = settleRegion([WOOD, THICKET]);
        const mountain = settleRegion([HILLS]);
        expect(guildYield('forestry')).toEqual([]);

        Atlas.travel(forest.id);
        expect(guildYield('forestry')).toEqual([0.1]);
        expect(yieldOf(nodeOf(OAK).id, 'forestry')).toBeCloseTo(110);
        // Narrowed to its skill, as a Token's own rule would be.
        expect(guildYield('mining')).toEqual([]);

        Atlas.travel(mountain.id);
        expect(guildYield('forestry')).toEqual([]);
        expect(yieldOf(nodeOf(ORE).id, 'mining')).toBe(100);

        Atlas.travel(forest.id);
        expect(guildYield('forestry')).toEqual([0.1]);
        expect(yieldOf(nodeOf(OAK).id, 'forestry')).toBeCloseTo(110);

        Atlas.travel(home);
        expect(guildYield('forestry')).toEqual([]);
    });

    it('they hold from the moment the board swaps, before the screen hears of the travel', () => {
        const forest = settleRegion([WOOD, THICKET]);
        const seen = [];
        const offAtlas = EventBus.subscribe(ENGINE_EVENTS.ATLAS_CHANGED, ({ reason }) => {
            if (reason === 'travelled') seen.push(guildYield('forestry'));
        });
        try {
            Atlas.travel(forest.id);
        } finally {
            offAtlas();
        }
        expect(seen).toEqual([[0.1]]);
    });

    it('after a load they are back if the save was made in the Region, and gone if it was not', async () => {
        const home = Atlas.activeRegionId();
        const forest = settleRegion([WOOD, THICKET]);
        Atlas.travel(forest.id);
        const savedThere = GameState.serializeJson();
        Atlas.travel(home);
        const savedHome = GameState.serializeJson();
        expect(guildYield('forestry')).toEqual([]);

        await reload(savedThere);
        expect(Atlas.activeRegionId()).toBe(forest.id);
        expect(guildYield('forestry')).toEqual([0.1]);
        expect(yieldOf(nodeOf(OAK).id, 'forestry')).toBeCloseTo(110);

        await reload(savedHome);
        expect(guildYield('forestry')).toEqual([]);
    });

    it('a fresh page (an empty aggregator) gets them back on load', async () => {
        const forest = settleRegion([WOOD, THICKET]);
        Atlas.travel(forest.id);
        const saved = GameState.serializeJson();
        getGlobalAggregator().clearAll();
        expect(guildYield('forestry')).toEqual([]);
        await reload(saved);
        expect(guildYield('forestry')).toEqual([0.1]);
    });

    it('a new game does not keep the last game\'s Region rules', () => {
        const forest = settleRegion([WOOD, THICKET]);
        Atlas.travel(forest.id);
        expect(guildYield('forestry')).toEqual([0.1]);
        newGame();
        expect(guildYield('forestry')).toEqual([]);
    });
});

describe('how they register', () => {
    it('two copies of a ruled map stack, each under a source of its own', () => {
        Cartography.grant([THICKET], 1);
        const forest = settleRegion([WOOD, THICKET, THICKET]);
        expect(forest.rules).toHaveLength(2);
        Atlas.travel(forest.id);
        expect(guildYield('forestry')).toEqual([0.1, 0.1]);
        expect(RegionRules.installedSources()).toHaveLength(2);
        expect(yieldOf(nodeOf(OAK).id, 'forestry')).toBeCloseTo(120);
    });

    it('they take out only what they put in: anything else in the guild-wide aggregator stays', () => {
        const home = Atlas.activeRegionId();
        const forest = settleRegion([WOOD, THICKET]);
        getGlobalAggregator().addModifier({ source: 'guild:aura_test', type: EFFECT_TYPES.YIELD, bucket: 'percentage', value: 0.05 });
        Atlas.travel(forest.id);
        expect(guildYield('forestry').sort()).toEqual([0.05, 0.1]);
        Atlas.travel(home);
        expect(guildYield('forestry')).toEqual([0.05]);
    });

    it('a rule the guild-wide aggregator cannot carry is skipped and said so, never widened', () => {
        const provides = (extra = {}) => ({ ...FORESTRY_RULE, ...extra });
        const { modifiers, ignored } = RegionRules.modifiersOf([
            provides(),
            { id: 'g', keyword: 'grants', payload: { type: 'BONUS_DROP', itemId: 'x', quantity: 1, chance: 100 } },
            provides({ when: { event: 'cycle_complete' } }),
            provides({ to: { mode: 'tag', value: 'Tree' } }),
            provides({ to: { mode: 'all', filters: [{ kind: 'being_worked' }] } }),
            provides({ to: { mode: 'all' } }),
            provides({ payload: { type: 'YIELD' } })
        ], 'region_9');
        expect(ignored.map(i => i.index)).toEqual([1, 2, 3, 4, 6]);
        expect(modifiers).toEqual([
            { type: 'YIELD', bucket: 'percentage', value: 0.1, target: { category: 'forestry' }, source: 'region:region_9#0:stm_test_region_forestry' },
            { type: 'YIELD', bucket: 'percentage', value: 0.1, target: { category: 'forestry' }, source: 'region:region_9#5:stm_test_region_forestry' }
        ]);
    });

    it('a Region with no rules, or no Atlas at all, registers nothing', () => {
        expect(RegionRules.apply()).toEqual([]);
        delete GameState.state.atlas;
        expect(RegionRules.apply()).toEqual([]);
        expect(GameState.state.atlas).toBeUndefined();
        expect(guildYield('forestry')).toEqual([]);
    });
});
