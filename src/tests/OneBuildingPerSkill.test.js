import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as Orders from '../systems/board/Orders.js';
import * as BoardRunner from '../systems/board/BoardRunner.js';
import * as BoardCombat from '../systems/board/BoardCombat.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Flags from '../systems/board/Flags.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as RecipeList from '../systems/board/RecipeList.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes, getTokenType, tokenStartingUses, TOKENS } from '../config/registries/tokenRegistry.js';
import { registerRecipePools, recipesForToken, getSkillRecipePool } from '../config/registries/recipePoolRegistry.js';
import {
    STATION_KINDS, RETIRED_STATION_KINDS, stationKindLabel, stationKindOffers, recipeStationKinds,
    retiredStationKindsOf, stationKindsOfSkill
} from '../config/registries/tokenConstants.js';
import { resetMatTuning } from '../config/matTuning.js';
import { KEYWORD } from '../systems/effects/statements.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { buildWorld, HOW, tokenKey } from '../systems/progression/ledger/engine.js';
import { ledgerContent } from './fixtures/ledgerWorld.js';
import { TUTORIAL_TEXT } from '../systems/quests/tutorialText.js';
import { LIMES_TEXT } from '../systems/quests/limesText.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * One building per skill: a skill's building works as that skill and names no station kind, so it
 * offers every recipe of the skill, the list gated by level. The kinds that used to split a craft
 * skill between stations (a Furnace smelted, a Smithy made tools) narrow nothing any more, so
 * today's stations keep working, each offering its whole skill, until the owner deletes them.
 * Farming still splits its own: a Field and a Herb Garden grow their own crops, a Windmill mills.
 */

const out = (itemId) => [{ itemId, chance: 100, minQty: 1, maxQty: 1 }];
const recipe = (id, level, extra = {}) => ({
    id, name: id, levelRequirement: level, durationMs: 2000, xp: 1, inputs: [], outputs: out('item_copper_ingot'), ...extra
});

// ⚠️ A fixture registration takes over its skill: shipped Smithing and Farming are hidden here.
registerRecipePools({
    smithing: [
        recipe('ob_ingot', 1, { stationKinds: ['furnace'], inputs: [{ itemId: 'item_copper_ore', quantity: 2 }] }),
        recipe('ob_nails', 1, { stationKinds: ['smithy'], outputs: out('item_copper_nails') }),
        recipe('ob_pickaxe', 2, { stationKinds: ['smithy'], inputs: [{ itemId: 'item_copper_ingot', quantity: 1 }], outputs: out('item_copper_pickaxe') }),
        recipe('ob_sword', 3, { outputs: out('item_copper_sword') }),
        recipe('ob_iron_ingot', 15, { stationKinds: ['furnace'], outputs: out('item_iron_ingot') }),
        recipe('ob_iron_pickaxe', 16, { stationKinds: ['smithy'], outputs: out('item_iron_pickaxe') }),
        recipe('ob_mythril_ingot', 60, { stationKinds: ['furnace'], outputs: out('item_mythril_ingot') }),
        // A building recipe of the skill: built on a Foundation, never offered at a station.
        recipe('ob_build_shed', 1, { foundationKinds: ['wood'], outputs: [{ tokenId: 'ob_blacksmith', chance: 100, minQty: 1, maxQty: 1 }] })
    ],
    farming: [
        recipe('ob_wheat', 1, { stationKinds: ['field'], outputs: out('item_wheat') }),
        recipe('ob_sage', 1, { stationKinds: ['herb_garden'], outputs: out('item_lavender') }),
        recipe('ob_flour', 1, { stationKinds: ['windmill'], outputs: out('item_flour') }),
        // Still ticked for a Kitchen beside the Field: only the Field counts now.
        recipe('ob_barley', 1, { stationKinds: ['field', 'kitchen'], outputs: out('item_wheat') })
    ]
});

const station = (id, skill, stationKind) => ({
    id, name: id, tokenType: 'station', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_flask',
    config: { skill, skillRequired: 1, cycleTimeMs: 2000, xp: 1, inputs: [], outputs: [] },
    statements: [{ id: `stm_${id}`, keyword: KEYWORD.STATION, payload: stationKind ? { skill, stationKind } : { skill } }]
});

registerTokenTypes({
    ob_blacksmith: station('ob_blacksmith', 'smithing'),
    ob_old_furnace: station('ob_old_furnace', 'smithing', 'furnace'),
    ob_old_smithy: station('ob_old_smithy', 'smithing', 'smithy'),
    ob_field: station('ob_field', 'farming', 'field'),
    ob_herb_garden: station('ob_herb_garden', 'farming', 'herb_garden'),
    ob_windmill: station('ob_windmill', 'farming', 'windmill')
});

const ids = (recipes) => recipes.map(r => r.id).sort();
const def = (typeId) => getTokenType(typeId);
const SMITHING = ['ob_ingot', 'ob_iron_ingot', 'ob_iron_pickaxe', 'ob_mythril_ingot', 'ob_nails', 'ob_pickaxe', 'ob_sword'];

describe('a skill\'s building offers every recipe of its skill', () => {
    it('smelting and smithing alike, never a building recipe', () => {
        expect(ids(recipesForToken(def('ob_blacksmith')))).toEqual(SMITHING);
        expect(ids(getSkillRecipePool('smithing'))).toEqual(SMITHING);
    });

    it('its list is gated by the skill\'s level: what the guild can run, then the next two locked', () => {
        const listed = (level) => {
            const hero = { id: 'h1', skills: { smithing: { level, xp: 0 } } };
            const { entries } = RecipeList.recipeListFor(def('ob_blacksmith'), { heroes: [hero] });
            return {
                runs: entries.filter(e => e.kind === RecipeList.ENTRY.RECIPE).map(e => e.recipe.id),
                locked: entries.filter(e => e.kind === RecipeList.ENTRY.LOCKED).map(e => e.recipe.id)
            };
        };
        expect(listed(2)).toEqual({ runs: ['ob_ingot', 'ob_nails', 'ob_pickaxe'], locked: ['ob_sword', 'ob_iron_ingot'] });
        expect(listed(16)).toEqual({
            runs: ['ob_ingot', 'ob_nails', 'ob_pickaxe', 'ob_sword', 'ob_iron_ingot', 'ob_iron_pickaxe'],
            locked: ['ob_mythril_ingot']
        });
    });

    it('takes any of them as its recipe', () => {
        GameState.initNew();
        const smith = BoardState.createTokenInstance('ob_blacksmith', tokenStartingUses('ob_blacksmith'));
        Placement.placeTokenAt(smith, { x: 400, y: 300 });
        for (const id of SMITHING) expect(StationRecipe.setSelectedRecipe(smith, id), id).toBe(true);
        expect(StationRecipe.setSelectedRecipe(smith, 'ob_build_shed')).toBe(false);
        expect(StationRecipe.setSelectedRecipe(smith, 'ob_wheat')).toBe(false);
    });
});

describe('a hero smelts and then smiths at the one building', () => {
    const AT = { x: 560, y: 520 };
    const run = (ms) => { for (let t = 0; t < ms; t += 100) BoardRunner.tick(100); };
    const made = (itemId) => InventoryManager.getItemCount(itemId) + SpriteLayer.countOnBoard(itemId);

    beforeAll(() => Flags.init());
    afterAll(() => { Flags.teardown(); resetMatTuning(); });
    beforeEach(() => {
        resetMatTuning();
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        BoardCombat.clearAll();
        TileModifiers.clearAll();
        GameState.state.inventory.maxSlots = 50;
        GameState.state.heroes = [{ id: 'h1', name: 'h1', status: 'idle', level: 5, skills: { smithing: { level: 5, xp: 0 } }, hp: { current: 100, max: 100 } }];
    });

    it('Copper Ingots first, then a Copper Pickaxe from them, with no second station', () => {
        const smith = BoardState.createTokenInstance('ob_blacksmith', tokenStartingUses('ob_blacksmith'));
        expect(Placement.placeTokenAt(smith, AT).success).toBe(true);
        InventoryManager.addItem('item_copper_ore', 4, 'test');

        expect(StationRecipe.setSelectedRecipe(smith, 'ob_ingot')).toBe(true);
        expect(Orders.orderAt('h1', AT).success).toBe(true);
        run(8000);
        expect(made('item_copper_ingot')).toBeGreaterThan(0);
        expect(InventoryManager.getItemCount('item_copper_ore')).toBeLessThan(4);

        // Into the Bank, as the hover would collect it, so the next recipe can spend it.
        SpriteLayer.collectAll();
        expect(StationRecipe.setSelectedRecipe(smith, 'ob_pickaxe')).toBe(true);
        run(8000);
        expect(made('item_copper_pickaxe')).toBeGreaterThan(0);
        expect(BoardState.workTokenOf('h1')).toBe(smith.id);
    });
});

describe('today\'s stations keep working until they are deleted', () => {
    it('a Furnace and a Smithy, still naming their old kinds, each offer the whole skill', () => {
        expect(ids(recipesForToken(def('ob_old_furnace')))).toEqual(SMITHING);
        expect(ids(recipesForToken(def('ob_old_smithy')))).toEqual(SMITHING);
    });

    it('so a saved Furnace set to smelting keeps its pick, and may now make tools too', () => {
        GameState.initNew();
        const furnace = BoardState.createTokenInstance('ob_old_furnace', tokenStartingUses('ob_old_furnace'));
        Placement.placeTokenAt(furnace, { x: 400, y: 300 });
        furnace.selectedRecipeId = 'ob_ingot';
        expect(StationRecipe.validateSelection(furnace)?.id).toBe('ob_ingot');
        expect(StationRecipe.setSelectedRecipe(furnace, 'ob_pickaxe')).toBe(true);
    });

    it('the craft kinds are retired; their names still read, so an old rule says what it named', () => {
        for (const kind of ['furnace', 'smithy', 'kitchen', 'brewery', 'tannery', 'workbench', 'alchemy_table', 'summoning_circle']) {
            expect(RETIRED_STATION_KINDS).toContain(kind);
            expect(STATION_KINDS).not.toContain(kind);
            expect(stationKindLabel(kind)).toMatch(/\S/);
            expect(stationKindOffers(kind, { stationKinds: ['field'] })).toBe(true);
        }
        expect(stationKindLabel('furnace')).toBe('Furnace');
        expect(recipeStationKinds({ stationKinds: ['furnace', 'smithy'] })).toEqual([]);
        expect(retiredStationKindsOf({ stationKinds: ['field', 'furnace'] })).toEqual(['furnace']);
        expect(retiredStationKindsOf({})).toEqual([]);
    });
});

describe('Farming still splits its recipes between its stations', () => {
    it('Field, Herb Garden and Windmill are the kinds left, all Farming\'s', () => {
        expect([...STATION_KINDS]).toEqual(['field', 'herb_garden', 'windmill']);
        expect(stationKindsOfSkill('farming')).toEqual(['field', 'herb_garden', 'windmill']);
        expect(stationKindsOfSkill('smithing')).toEqual([]);
        expect(stationKindsOfSkill(null)).toEqual([]);
    });

    it('a Field grows its crops, a Herb Garden its own, a Windmill mills; a retired tick beside a live one is dropped', () => {
        expect(ids(recipesForToken(def('ob_field')))).toEqual(['ob_barley', 'ob_wheat']);
        expect(ids(recipesForToken(def('ob_herb_garden')))).toEqual(['ob_sage']);
        expect(ids(recipesForToken(def('ob_windmill')))).toEqual(['ob_flour']);
        expect(recipeStationKinds({ stationKinds: ['field', 'kitchen'] })).toEqual(['field']);
    });
});

describe('the audit asks for a retired kind to be cleared, and still refuses a made-up one', () => {
    const works = (stationKind) => [{ id: 'stm_works', keyword: 'station', payload: { skill: 'smithing', stationKind } }];
    const world = (mutate) => {
        const w = {
            skills: [{ id: 'smithing', name: 'Smithing' }, { id: 'farming', name: 'Farming' }],
            items: { item_copper_ingot: { id: 'item_copper_ingot', name: 'Copper Ingot' } },
            tokens: { token_forge: { id: 'token_forge', name: 'Forge', statements: works(undefined) } },
            recipes: { recipe_bar: { id: 'recipe_bar', name: 'Bar', skill: 'smithing', inputs: [], outputs: [{ itemId: 'item_copper_ingot' }] } }
        };
        mutate(w);
        return auditLifecycleBlocks(w).filter(f => f.field === 'stationKind' || f.field === 'stationKinds');
    };

    it('a station still naming a retired kind: a warning that it now offers the whole skill', () => {
        const found = world((w) => { w.tokens.token_forge.statements = works('furnace'); });
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({ severity: 'warning', entityId: 'token_forge' });
        expect(found[0].message).toContain('Furnace');
        expect(found[0].message).toContain('every smithing recipe');
    });

    it('a recipe still ticked for retired kinds: one warning naming them', () => {
        const found = world((w) => { w.recipes.recipe_bar.stationKinds = ['furnace', 'smithy']; });
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({ severity: 'warning', entityId: 'recipe_bar' });
        expect(found[0].message).toContain('Furnace, Smithy');
    });

    it('a kind that never existed is still an error, on either side', () => {
        expect(world((w) => { w.tokens.token_forge.statements = works('forge_kind'); })[0]).toMatchObject({ severity: 'error' });
        expect(world((w) => { w.recipes.recipe_bar.stationKinds = ['forge_kind']; })[0]).toMatchObject({ severity: 'error' });
    });

    it('nothing to say about a building with no kind, or Farming\'s kinds', () => {
        expect(world(() => {})).toEqual([]);
        expect(world((w) => {
            w.tokens.token_forge.statements = [{ id: 'stm_works', keyword: 'station', payload: { skill: 'farming', stationKind: 'windmill' } }];
            w.recipes.recipe_bar.skill = 'farming';
            w.recipes.recipe_bar.stationKinds = ['windmill'];
        })).toEqual([]);
    });
});

describe('the ledger reads the new buildings', () => {
    it('a building with no kind runs every recipe of its skill, a Furnace still naming its retired kind too', () => {
        const ws = ledgerContent();
        ws.tokens.token_furnace.statements = [{ keyword: 'station', payload: { skill: 'smithing', stationKind: 'furnace' } }];
        ws.tokens.token_blacksmith = {
            id: 'token_blacksmith', name: 'Blacksmith',
            statements: [{ keyword: 'station', payload: { skill: 'smithing' } }],
            config: { skill: 'smithing', skillRequired: 1, cycleTimeMs: 9000, xp: 1, inputs: [], outputs: [] }
        };
        const world = buildWorld(ws);
        const runsAt = (tokenId) => world.rules
            .filter(r => r.how === HOW.STATION && r.via === tokenKey(tokenId))
            .map(r => r.gives[0]?.key).filter(Boolean);
        // A Planned recipe makes nothing, wherever it is offered.
        const smithing = ws.recipePools.smithing
            .filter(r => !(r.foundationKinds || []).length && r.plan?.status !== 'planned')
            .map(r => `recipe:${r.id}`).sort();
        expect(smithing).toEqual(['recipe:recipe_copper_ingot', 'recipe:recipe_iron_ingot', 'recipe:recipe_iron_pickaxe']);
        expect([...new Set(runsAt('token_blacksmith'))].sort()).toEqual(smithing);
        expect([...new Set(runsAt('token_furnace'))].sort()).toEqual(smithing);
    });
});

describe('the words name buildings the content has', () => {
    // ⚠️ The copper step names today's Furnace and Copper Smithy until the content has a Blacksmith;
    // deleting either Token fails this, so the words change with that Sync.
    it('the tutorial sends copper to a Furnace and a Copper Smithy, both still in the content', () => {
        const names = new Set(Object.values(TOKENS).map(t => t?.name));
        const words = TUTORIAL_TEXT.steps.cart_copper_tool.instruction;
        expect(words).toContain('Furnace');
        expect(words).toContain('Copper Smithy');
        expect(names.has('Furnace')).toBe(true);
        expect(names.has('Copper Smithy')).toBe(true);
    });

    it('Limes names none of today\'s stations', () => {
        expect(JSON.stringify(LIMES_TEXT)).not.toMatch(/Furnace|Smithy|Workbench|Campfire|Brewery|Alchemy Table|Tannery/);
    });
});
