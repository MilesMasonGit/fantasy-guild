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
import { workspaceFromDataFiles, setValue, proposedValue, validatePack, currentValue, canonicalJson } from '../../cms/src/engine/changePacks.js';

/**
 * The Foundations pack (brief 410 S1), which the owner has Synced: the shipped data must still be the
 * pack applied, and the game must play by it. `data/` is never written; the pack is the copy in
 * `fixtures/packs/`, the same file the owner reviewed.
 *
 * ⚠️ The shipped-data tests run first, before `beforeAll` below swaps the pack's content into the
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
    'token_wind_stones', 'token_wolf_den', 'token_alpha_den', 'token_sheep_pasture',
    'token_drake_roost', 'token_treant_grove', 'token_troll_bridge', 'token_phoenix_nest', 'token_void_rift'
];

const shippedWorkspace = () => workspaceFromDataFiles({
    items: readJson('data/items.json'), tokens: readJson('data/tokens.json'),
    tokenRecipes: readJson('data/tokenRecipes.json'), plan: readJson('cms/plan/plan.json'),
});

// Fields a later pack has moved since, by entry: the fishing buildings went to the Dock (and with them
// Fishing off the Wood Foundation's Shop skills), Farmland stands on grass and an Excavation on stone,
// and the mines went onto the Stone Foundation, the Coal Mine asking for a Coal Prospecting Map. And
// entries a later pack deleted: the Coast (the fishing spots pack retired the fixed waters).
const LATER = {
    token_wood_foundation: ['shop'],
    token_farmland: ['standsOn'],
    token_excavation: ['standsOn'],
    recipe_build_copper_mine: ['foundationKinds'],
    recipe_build_coal_mine: ['inputs', 'foundationKinds']
};
const DELETED_LATER = new Set(['token_coast']);

/**
 * The shipped content with every entry of the pack applied, as the CMS's Finish review does, but for
 * the fields a later pack has moved since, which stay as shipped.
 */
function appliedWorkspace() {
    let ws = shippedWorkspace();
    for (const entry of PACK.entries) {
        const value = { ...proposedValue(entry) };
        const now = currentValue(ws, entry.kind, entry.id) || {};
        for (const field of LATER[entry.id] || []) {
            if (now[field] === undefined) delete value[field]; else value[field] = now[field];
        }
        ws = { ...ws, ...setValue(ws, entry.kind, entry.id, value) };
    }
    return ws;
}

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
let shippedFindings = [];

describe('the shipped data, after the Sync', () => {
    it('the content audit finds no error', () => {
        shippedFindings = contentFindings();
        expect(shippedFindings.filter(f => f.startsWith('error'))).toEqual([]);
    });

    // The CMS writes a Token's description from its rules on Sync, so the pack's hand-written
    // descriptions for the two new Foundations never ship; everything else must, but for the fields
    // later packs moved (`LATER`).

    it('holds every entry of the pack as the pack sets it, the description and the fields later packs moved aside', () => {
        const shipped = shippedWorkspace();
        const asPacked = (id, value) => {
            const out = { ...value, description: undefined };
            for (const field of LATER[id] || []) out[field] = undefined;
            return canonicalJson(out);
        };
        for (const entry of PACK.entries) {
            if (DELETED_LATER.has(entry.id)) {
                expect(currentValue(shipped, entry.kind, entry.id), `${entry.kind} ${entry.id} is gone`).toBeNull();
                continue;
            }
            expect(asPacked(entry.id, currentValue(shipped, entry.kind, entry.id)), `${entry.kind} ${entry.id}`)
                .toBe(asPacked(entry.id, proposedValue(entry)));
        }
    });
});

describe('the Foundations pack, applied to a copy of the shipped content', () => {
    let ws;
    beforeAll(() => {
        ws = appliedWorkspace();
        const touched = PACK.entries.filter(e => e.kind === 'token').map(e => e.id);
        registerTokenTypes(Object.fromEntries(touched.map(id => [id, ws.tokens[id]])));
        // The live recipe list, changed in place: a registered fixture pool would sit beside the
        // shipped recipes of the same ids rather than replace them.
        for (const e of PACK.entries.filter(x => x.kind === 'recipe')) {
            if ((LATER[e.id] || []).includes('foundationKinds')) continue;
            Object.assign(listRecipes().find(r => r.id === e.id), { foundationKinds: e.value.foundationKinds });
        }
    });
    beforeEach(newGame);

    it('is a well-formed pack of 29 entries', () => {
        expect(validatePack(PACK).ok).toBe(true);
        expect(PACK.entries).toHaveLength(29);
    });

    it('the Shop sells the Foundations only (the five and the Dock a later pack added), in the authored order, with their icons', () => {
        const entries = Shop.catalogue();
        expect(entries.map(e => e.typeId)).toEqual([
            'token_wood_foundation', 'token_stone_foundation', 'token_farmland', 'token_excavation', 'token_battlefield', 'token_dock'
        ]);
        expect(entries.map(e => e.skills)).toEqual([
            ['crafting', 'cooking', 'alchemy', 'forestry'], ['smithing', 'faith'], ['farming', 'forestry'],
            ['mining'], ['melee', 'ranged', 'magic'], ['fishing']
        ]);
        expect(Shop.canBuy('token_coast')).toEqual({ success: false, reason: 'Not sold at the Shop' });
        expect(Shop.canBuy('token_goblin_camp').success).toBe(false);
    });

    it('each Foundation builds its own list', () => {
        expect(builds('token_excavation').sort()).toEqual([
            'token_adamantium_ore', 'token_coal_vein', 'token_copper_ore_vein', 'token_darkmetal_ore_vein', 'token_gold_ore_vein',
            'token_iron_ore_vein', 'token_mythril_ore_vein', 'token_quarry', 'token_silver_ore_vein'
        ]);
        expect(builds('token_stone_foundation')).toEqual(expect.arrayContaining(['token_copper_mine', 'token_coal_mine']));
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

    it('a saved Wood Foundation already set to build a Quarry reads as no pick and asks for a new one', () => {
        InventoryManager.addItem('item_oak_wood', 15);
        const { instance } = Shop.buy('token_wood_foundation');
        // As a save made before the Sync holds it; the setter would refuse it now.
        instance.selectedRecipeId = 'recipe_build_quarry';
        expect(WorkCheck.fixableReason(instance.id, instance).reason).toBe(ALERT.CHOOSE_BUILD);
        // Kept, so a recipe that comes back is picked again; the player's next pick overwrites it.
        expect(instance.selectedRecipeId).toBe('recipe_build_quarry');
        // Its own list is still there to pick from: it is never stuck.
        expect(StationRecipe.setSelectedRecipe(instance, 'recipe_muily2pb')).toBe(true);
    });

    it('the lessons\' Foundation step still buys a Wood Foundation, which still builds the Workbench', () => {
        const bought = [];
        const off = EventBus.subscribe(ENGINE_EVENTS.TOKEN_PURCHASED, (e) => bought.push(e.typeId));
        InventoryManager.addItem('item_oak_wood', 15);
        expect(Shop.buy('token_wood_foundation').success).toBe(true);
        off?.();
        expect(bought).toEqual(['token_wood_foundation']);
        expect(builds('token_wood_foundation')).toContain('token_workbench');
    });

    it('adds no content-audit finding to those of the shipped data', () => {
        expect(shippedFindings.length).toBeGreaterThan(0);
        expect(contentFindings()).toEqual(shippedFindings);
    });
});
