import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Shop from '../systems/board/Shop.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes, getTokenType, TOKENS } from '../config/registries/tokenRegistry.js';
import { recipesForFoundation, listRecipes } from '../config/registries/recipePoolRegistry.js';
import { ITEMS } from '../config/registries/itemRegistry.js';
import { SKILLS } from '../config/registries/skillRegistry.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { workspaceFromDataFiles, setValue, proposedValue, validatePack } from '../../cms/src/engine/changePacks.js';

/**
 * The Foundations pack (brief 410 S1) applied to a copy of today's content, as the owner's CMS will
 * apply it and Sync: the game must work before the Sync (the Shop's new fields are optional) and
 * after it. `data/` is never written; the pack is the copy in `fixtures/packs/`, the same file
 * the owner reviews. Once the owner has Synced it, the "today" half describes the past and goes.
 *
 * ⚠️ The "today" tests run first, before `beforeAll` below swaps the pack's content into the
 * registries (Vitest runs a file's describes in order).
 */

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const ROOT = path.resolve(__dirname, '../..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const PACK = readJson('src/tests/fixtures/packs/2026-11-06-foundations-s1.json');

const BANNER_SPAWNERS = [
    'token_wild_hive', 'token_basking_stone', 'token_cow_pasture', 'token_crab_rocks', 'token_ember_vents',
    'token_smoking_crater', 'token_frog_pond', 'token_goblin_camp', 'token_chief_tent', 'token_slime_pit',
    'token_queens_hive', 'token_sulphur_rocks', 'token_thorn_thicket', 'token_toxic_pool', 'token_tide_pool',
    'token_wind_stones', 'token_wolf_den', 'token_alpha_den'
];

/** Today's content with every entry of the pack applied, as the CMS's Finish review does. */
function appliedWorkspace() {
    let ws = workspaceFromDataFiles({
        items: readJson('data/items.json'), tokens: readJson('data/tokens.json'),
        tokenRecipes: readJson('data/tokenRecipes.json'), plan: readJson('cms/plan/plan.json'),
    });
    for (const entry of PACK.entries) ws = { ...ws, ...setValue(ws, entry.kind, entry.id, proposedValue(entry)) };
    return ws;
}

const flatCatalogue = () => Shop.catalogue().flatMap(g => g.items.map(i => i.typeId));
const builds = (typeId) => recipesForFoundation(getTokenType(typeId)).map(r => r.outputs.find(o => o.tokenId).tokenId);

function newGame() {
    GameState.initNew();
    InventoryManager.init();
    EngineBootstrap.createDefaultGameData();
    for (const t of BoardState.tokens()) if (t.typeId !== 'token_guild_hall') BoardState.removeToken(t.id);
    GameState.state.inventory.items = {};
}

/** The content audit's findings over what the registries hold, as comparable lines. */
const contentFindings = () => auditLifecycleBlocks({ tokens: TOKENS, items: ITEMS, recipes: listRecipes(), skills: SKILLS })
    .map(f => `${f.severity} ${f.entityId} ${f.field}`).sort();
let todayFindings = [];

describe('today, before the Sync: content without the new fields', () => {
    it('the content audit finds what it finds today', () => {
        todayFindings = contentFindings();
        expect(todayFindings.filter(f => f.startsWith('error'))).toEqual([]);
    });

    it('the Shop sells the five it sells today, in name order within each section', () => {
        expect(flatCatalogue()).toEqual(expect.arrayContaining([
            'token_wood_foundation', 'token_stone_foundation', 'token_farmland', 'token_coast', 'token_goblin_camp'
        ]));
        expect(flatCatalogue()).not.toContain('token_excavation');
        expect(Shop.catalogue().flatMap(g => g.items).every(i => i.order === Infinity)).toBe(true);
    });

    it('the Wood Foundation still builds the Quarry, the mines and the banner camps', () => {
        expect(builds('token_wood_foundation')).toEqual(expect.arrayContaining(['token_quarry', 'token_copper_mine', 'token_goblin_camp']));
    });
});

describe('the Foundations pack, applied to a copy of today\'s content', () => {
    let ws;
    beforeAll(() => {
        ws = appliedWorkspace();
        const touched = PACK.entries.filter(e => e.kind === 'token').map(e => e.id);
        registerTokenTypes(Object.fromEntries(touched.map(id => [id, ws.tokens[id]])));
        // The live recipe list, changed in place: a registered fixture pool would sit beside the
        // shipped recipes of the same ids rather than replace them.
        for (const e of PACK.entries.filter(x => x.kind === 'recipe')) {
            Object.assign(listRecipes().find(r => r.id === e.id), { foundationKinds: e.value.foundationKinds });
        }
    });
    beforeEach(newGame);

    it('is a well-formed pack of 29 entries', () => {
        expect(validatePack(PACK).ok).toBe(true);
        expect(PACK.entries).toHaveLength(29);
    });

    it('the Shop sells the five Foundations only, in the authored order, with their icons', () => {
        const entries = Shop.catalogue().flatMap(g => g.items);
        expect(entries.map(e => e.typeId)).toEqual([
            'token_wood_foundation', 'token_stone_foundation', 'token_farmland', 'token_excavation', 'token_battlefield'
        ]);
        expect(entries.map(e => e.skills)).toEqual([
            ['crafting', 'cooking', 'alchemy', 'fishing', 'forestry'], ['smithing', 'faith'], ['farming', 'forestry'],
            ['mining'], ['melee', 'ranged', 'magic']
        ]);
        expect(Shop.canBuy('token_coast')).toEqual({ success: false, reason: 'Not sold at the Shop' });
        expect(Shop.canBuy('token_goblin_camp').success).toBe(false);
    });

    it('each Foundation builds its own list', () => {
        expect(builds('token_excavation').sort()).toEqual(['token_coal_mine', 'token_copper_mine', 'token_quarry']);
        expect(builds('token_battlefield').sort()).toEqual([...BANNER_SPAWNERS].sort());
        const wood = builds('token_wood_foundation');
        expect(wood).toEqual(expect.arrayContaining(['token_workbench', 'token_logging_camp', 'token_mining_camp', 'token_copper_ore_minecart']));
        for (const gone of ['token_quarry', 'token_copper_mine', 'token_coal_mine', ...BANNER_SPAWNERS]) expect(wood).not.toContain(gone);
        expect(builds('token_stone_foundation')).not.toContain('token_mining_camp');
        expect(builds('token_stone_foundation')).toContain('token_furnace');
        expect(builds('token_farmland')).toEqual(expect.arrayContaining(['token_wheat_field', 'token_oak_forest']));
    });

    it('a new game buys an Excavation for Oak Wood alone and sets it to build the first Quarry', () => {
        InventoryManager.addItem('item_oak_wood', 15);
        const bought = Shop.buy('token_excavation');
        expect(bought.success).toBe(true);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(0);
        expect(StationRecipe.setSelectedRecipe(bought.instance, 'recipe_build_quarry')).toBe(true);
    });

    it('a saved Wood Foundation already set to build a Quarry drops the pick and asks for a new one', () => {
        InventoryManager.addItem('item_oak_wood', 15);
        const { instance } = Shop.buy('token_wood_foundation');
        // As a save made before the Sync holds it; the setter would refuse it now.
        instance.selectedRecipeId = 'recipe_build_quarry';
        expect(WorkCheck.fixableReason(instance.id, instance).reason).toBe(ALERT.CHOOSE_BUILD);
        expect(instance.selectedRecipeId).toBeUndefined();
        // Its own list is still there to pick from: it is never stuck.
        expect(StationRecipe.setSelectedRecipe(instance, 'recipe_muily2pb')).toBe(true);
    });

    it('the tutorial\'s Foundation step still buys a Wood Foundation, which still builds the Workbench', () => {
        const bought = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.TOKEN_PURCHASED, (e) => bought.push(e.typeId));
        InventoryManager.addItem('item_oak_wood', 15);
        expect(Shop.buy('token_wood_foundation').success).toBe(true);
        off?.();
        expect(bought).toEqual(['token_wood_foundation']);
        expect(builds('token_wood_foundation')).toContain('token_workbench');
    });

    it('adds no content-audit finding to those of today', () => {
        expect(todayFindings.length).toBeGreaterThan(0);
        expect(contentFindings()).toEqual(todayFindings);
    });
});
