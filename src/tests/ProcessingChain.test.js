import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as RecipeResolver from '../systems/board/RecipeResolver.js';
import * as Charges from '../systems/board/Charges.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';
import { getTokenType, getProvidedTagsWithTiers, tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { recipesForToken, registerRecipePools } from '../config/registries/recipePoolRegistry.js';
import { stationSkillOf } from '../systems/effects/statements.js';
import { createRequire } from 'module';

// The balance solver, for the count rule (BALANCE_RULES section 3): a raw ingredient's count is its
// base doubling every 40 levels, ore per bar on a base of 2.
const solver = createRequire(import.meta.url)(path.resolve(__dirname, '../../.claude/skills/balancer/balance_solver.cjs'));
const RULES = solver.make({});
const ORE_PER_BAR_BASE = 2;
/** Every input is one of `itemIds`, each named once, each a whole count of at least 1. */
const madeOnlyFrom = (recipe, itemIds) => {
    expect(recipe.inputs.map((i) => i.itemId)).toEqual(itemIds);
    for (const i of recipe.inputs) {
        expect(Number.isInteger(i.quantity), `${recipe.name}: ${i.itemId}`).toBe(true);
        expect(i.quantity).toBeGreaterThanOrEqual(1);
    }
};

/**
 * Token Lifecycle slices 7.5 (Processing) and 6.2 (Academies), pinned from the
 * SHIPPED data (authored through the CMS, never by hand).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

const DATA = path.resolve(__dirname, '../../data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const tokens = read('tokens.json');
const items = read('items.json');
const recipes = read('tokenRecipes.json');

const named = (name) => recipes.find((r) => r.name === name);
const poolNames = (typeId) => recipesForToken(getTokenType(typeId)).map((r) => r.name).sort();

describe('The Processing chain in shipped data (7.5)', () => {
    it('Torch and Copper Nails are live items', () => {
        expect(items.item_torch).toMatchObject({ id: 'item_torch', name: 'Torch' });
        expect(items.item_copper_nails).toMatchObject({ id: 'item_copper_nails', name: 'Copper Nails', type: 'material' });
    });

    describe('Foundations', () => {
        it('the Wood Foundation is a wood Foundation built with Construction, sold for 15 Oak Wood, no coins (the opening buy is free of coins), first in the list', () => {
            const def = tokens.token_wood_foundation;
            expect(def.name).toBe('Wood Foundation');
            expect(def.foundation).toEqual({ kind: 'wood', skill: 'construction' });
            expect(def.shop).toEqual({
                price: [{ itemId: 'item_oak_wood', quantity: 15 }],
                section: 'construction',
                skills: ['crafting', 'cooking', 'alchemy', 'forestry'],
                order: 1,
            });
            expect(def.config).toBeNull();
        });

        it('the Stone Foundation is a stone Foundation, sold for 10 Stone, 5 Oak Wood and coins, second in the list', () => {
            const def = tokens.token_stone_foundation;
            expect(def.name).toBe('Stone Foundation');
            expect(def.foundation).toEqual({ kind: 'stone', skill: 'construction' });
            expect(def.shop).toEqual({
                price: [{ itemId: 'item_stone', quantity: 10 }, { itemId: 'item_oak_wood', quantity: 5 }],
                section: 'construction',
                skills: ['smithing', 'faith'],
                order: 2,
                coins: 250,
            });
            expect(def.config).toBeNull();
        });

        it('a Wood Foundation offers the wooden buildings: the Workshop, the Kitchen, the Mining Camp and the rest', () => {
            expect(poolNames('token_wood_foundation')).toEqual([
                "Build Alchemist's Hall", 'Build Apothecary', 'Build Bakehouse', 'Build Banquet Hall', 'Build Barn',
                'Build Beehive', 'Build Brewery', "Build Builder's Yard", 'Build Composter', "Build Craftsmen's Yard",
                'Build Deep Workings',
                "Build Farmers' Market", 'Build Farmstead',
                "Build Forester's Lodge", 'Build Greenhouse', "Build Grovekeeper's Hut", 'Build Guild Workshop', "Build Herbalist's Hut",
                'Build Hideout', "Build Jeweller's Hall", 'Build Kitchen', 'Build Laboratory', 'Build Logging Camp', 'Build Manor Farm', 'Build Market Kitchen',
                "Build Master's Study", 'Build Mine Head', 'Build Minecart', 'Build Mining Camp', 'Build Ore Market', 'Build Physic Garden',
                'Build Sawmill', 'Build Tannery', 'Build Timber Yard', 'Build Windmill', 'Build Workshop',
            ]);
        });

        it('a Dock offers the fishing buildings: the Fishing Hut, the Bait Shed, the Pier and the rest', () => {
            expect(poolNames('token_dock')).toEqual([
                'Build Bait Shed', 'Build Chum Station', 'Build Fish Market', 'Build Fishing Hut', "Build Fishmonger's", 'Build Pier',
            ]);
        });

        it('a Stone Foundation offers the Blacksmith, the Well, the mines, the shrine, the Counting House and the better Smithing stations (SP-62)', () => {
            expect(poolNames('token_stone_foundation')).toEqual([
                'Build Blacksmith', 'Build Coal Mine', 'Build Copper Mine', 'Build Counting House', 'Build Foundry', 'Build Grand Forge', 'Build Master Smithy',
                'Build Nature Shrine', "Build Smiths' Row", 'Build Town Square', 'Build University', 'Build Well',
            ]);
        });

        it('an Excavation offers the Quarry and a Dig for each vein', () => {
            expect(poolNames('token_excavation')).toEqual([
                'Build Quarry', 'Dig Adamantine Vein', 'Dig Coal Vein', 'Dig Copper Vein', 'Dig Darkmetal Vein', 'Dig Gold Vein',
                'Dig Iron Vein', 'Dig Mythril Vein', 'Dig Silver Vein',
            ]);
        });

        it('a Battlefield offers every creature camp from its banner', () => {
            expect(poolNames('token_battlefield')).toEqual([
                "Build Alpha's Den", 'Build Basking Stone', "Build Chief's Tent", 'Build Cow Pasture', 'Build Crab Rocks',
                'Build Drake Roost', 'Build Ember Vents', 'Build Frog Pond', 'Build Goblin Camp', 'Build Phoenix Nest', "Build Queen's Hive", 'Build Sheep Pasture', 'Build Slime Pit',
                'Build Smoking Crater', 'Build Sulphur Rocks', 'Build Thorn Thicket', 'Build Tide Pool', 'Build Toxic Pool',
                'Build Treant Grove', 'Build Troll Bridge', 'Build Void Rift', 'Build Wild Hive', 'Build Wind Stones', 'Build Wolf Den',
            ]);
        });

        for (const [name, kind, seconds, inputs, builds] of [
            ['Build Workshop', 'wood', 60, [{ itemId: 'item_oak_wood', quantity: 5 }], 'token_workbench'],
            ['Build Kitchen', 'wood', 60, [{ itemId: 'item_oak_wood', quantity: 5 }], 'token_cooking_pot'],
            ['Build Blacksmith', 'stone', 90, [{ itemId: 'item_stone', quantity: 5 }], 'token_furnace'],
            ['Build Well', 'stone', 30, [{ itemId: 'item_stone', quantity: 8 }], 'token_well'],
        ]) {
            it(`${name}: Construction 1, ${seconds} s, on ${kind}, builds ${builds}`, () => {
                const r = named(name);
                expect(r).toBeTruthy();
                expect(r.skill).toBe('construction');
                expect(r.foundationKinds).toEqual([kind]);
                expect(r.levelRequirement).toBe(1);
                expect(r.durationMs).toBe(seconds * 1000);
                expect(r.inputs).toEqual(inputs);
                expect(r.outputs.map((o) => o.tokenId)).toEqual([builds]);
            });
        }

        it('no building recipe reaches an ordinary station (a Construction station makes materials only)', () => {
            for (const def of Object.values(tokens)) {
                if (def.foundation) continue;
                const pool = recipesForToken(getTokenType(def.id)) || [];
                expect(pool.filter((r) => r.skill === 'construction' && r.outputs?.some((o) => o.tokenId))).toEqual([]);
            }
        });
    });

    describe('Stations', () => {
        it('the Workbench is a Crafting station (it was a buff with no rule)', () => {
            expect(stationSkillOf(getTokenType('token_workbench'))).toBe('crafting');
            expect(tokens.token_workbench.tokenType).toBe('station');
        });

        it('the Cooking Pot cooks and the Furnace smiths', () => {
            expect(stationSkillOf(getTokenType('token_cooking_pot'))).toBe('cooking');
            expect(stationSkillOf(getTokenType('token_furnace'))).toBe('smithing');
        });

        it('the three stations are permanent (SP-23: unlimited, never deplete)', () => {
            for (const id of ['token_workbench', 'token_cooking_pot', 'token_furnace']) {
                expect(tokens[id].uses, id).toBeNull();
            }
        });

        it('each has a work config naming its skill, so a hero will work it', () => {
            for (const [id, skill] of [['token_workbench', 'crafting'], ['token_cooking_pot', 'cooking'], ['token_furnace', 'smithing']]) {
                expect(tokens[id].config, id).toMatchObject({ skill, skillRequired: 1, inputs: [], outputs: [] });
                expect(tokens[id].requiresHero, id).toBe(true);
            }
        });

        it('the Workbench offers every Crafting recipe, and a new one starts on none (TL-15)', () => {
            // Its old kind narrows nothing now, nor does the Tannery's: each offers the whole skill. Bait is
            // a Fishing recipe (the Bait Shed's); the lures are Crafting's.
            expect(poolNames('token_workbench')).toEqual(expect.arrayContaining([
                'Charcoal', 'Fine Fishing Rod', 'Fishing Rod', 'Torch', 'Trap', 'Fly Lure', 'Spinner Lure',
                'Glow Lure', 'Leather', 'Leather Chest', 'Leather Hat',
            ]));
            expect(poolNames('token_tannery')).toEqual(poolNames('token_workbench'));
            const bench = BoardState.createTokenInstance('token_workbench');
            expect(StationRecipe.validateSelection(bench, getTokenType('token_workbench'))).toBeNull();
            expect(bench.selectedRecipeId).toBeUndefined();
        });

        it('no recipe names its context as a bare string', () => {
            for (const r of recipes) {
                for (const c of r.requiresContext || []) expect(typeof c, r.name).toBe('object');
            }
        });
    });

    describe('Recipes and fuel (SP-26)', () => {
        it('Crafting burns no fuel: Charcoal is Oak Wood alone, a Torch (Crafting 13) is 1 Oak Wood + 1 Charcoal', () => {
            const charcoal = named('Charcoal');
            expect(charcoal.skill).toBe('crafting');
            expect(charcoal.levelRequirement).toBe(1);
            // How much wood is the balance rules' count, the content's base: only the wood is pinned here.
            madeOnlyFrom(charcoal, ['item_oak_wood']);
            expect(charcoal.outputs.map((o) => [o.itemId, o.minQty, o.maxQty])).toEqual([['item_charcoal', 1, 1]]);

            const torch = named('Torch');
            expect(torch.skill).toBe('crafting');
            expect(torch.levelRequirement).toBe(13);
            expect(torch.inputs).toEqual([
                { itemId: 'item_oak_wood', quantity: 1 }, { itemId: 'item_charcoal', quantity: 1 },
            ]);
            expect(torch.outputs.map((o) => o.itemId)).toEqual(['item_torch']);
        });

        it('Smithing smelts Copper Ingots from Copper Ore, by the count rule, and Coal, no Anvil (SP-31)', () => {
            const ingot = recipes.find((r) => r.id === 'recipe_copper_ingot');
            madeOnlyFrom(ingot, ['item_copper_ore', 'item_coal']);
            // 2 ore a copper bar (BALANCE_RULES section 3).
            expect(ingot.inputs[0].quantity).toBe(RULES.count(ORE_PER_BAR_BASE, ingot.levelRequirement));
            expect(ingot.requiresContext).toEqual([]);
            expect(ingot.levelRequirement).toBe(1);
        });

        it('Cooking burns no fuel: Shrimp at a Kitchen at level 1, Apple Juice at any Cooking station at level 6', () => {
            const shrimp = recipes.find((r) => r.id === 'recipe_shrimp');
            expect(shrimp.inputs).toEqual([{ itemId: 'item_raw_shrimp', quantity: 1 }]);
            expect(shrimp.stationKinds).toEqual(['kitchen']);
            expect(shrimp.levelRequirement).toBe(1);

            const juice = named('Apple Juice');
            expect(juice.skill).toBe('cooking');
            madeOnlyFrom(juice, ['item_apple']);
            expect(juice.stationKinds ?? []).toEqual([]);
            expect(juice.levelRequirement).toBe(6);
        });
    });

    describe('The Copper Anvil (DP-8, SP-30, SP-56)', () => {
        const anvil = tokens.token_copper_anvil;

        it('is no longer sold, never wears out and needs no hero', () => {
            expect(anvil.shop).toBeUndefined();
            expect(anvil.uses).toBeNull();
            expect(anvil.requiresHero).toBe(false);
        });

        it('acts as a tier-1 anvil, and nothing else on the mat provides one', () => {
            expect(getProvidedTagsWithTiers(getTokenType('token_copper_anvil'))).toEqual({ anvil: 1 });
            const others = Object.keys(tokens)
                .filter((id) => id !== 'token_copper_anvil')
                .filter((id) => getProvidedTagsWithTiers(getTokenType(id)).anvil);
            expect(others).toEqual([]);
        });

        it('Copper Nails: 1 Copper Ingot + 1 Coal → 5 Nails at any Smithing station from level 5, no anvil needed', () => {
            const nails = named('Copper Nails');
            expect(nails.skill).toBe('smithing');
            expect(nails.levelRequirement).toBe(5);
            expect(nails.inputs).toEqual([
                { itemId: 'item_copper_ingot', quantity: 1 }, { itemId: 'item_coal', quantity: 1 },
            ]);
            // Nails are 5 a bar (owner, BALANCE_RULES section 3), a count the number pack writes and pins.
            expect(nails.outputs.map((o) => [o.itemId, o.minQty, o.maxQty])).toEqual([['item_copper_nails', 5, 5]]);
            expect(nails.requiresContext).toEqual([]);
            expect(nails.stationKinds ?? []).toEqual([]);
        });
    });

    describe('The Anvil on the mat', () => {
        // 160 u apart: inside the Near radius, so the Anvil is the Furnace's neighbour.
        const FURNACE = { x: 400, y: 300 };
        const BESIDE = { x: 560, y: 300 };
        const place = (point, typeId) => {
            const instance = BoardState.createTokenInstance(typeId, tokenStartingUses(typeId));
            Placement.placeTokenAt(instance, point);
            return instance;
        };
        // Fixture: no shipped recipe needs an anvil any more, so a Furnace recipe that does is
        // added beside the shipped ones.
        const nailsId = () => 'recipe_fixture_anvil_nails';
        beforeAll(() => {
            registerRecipePools({
                smithing: [{
                    id: 'recipe_fixture_anvil_nails', name: 'Fixture Anvil Nails', levelRequirement: 1,
                    durationMs: 6000, xp: 2, stationKinds: ['furnace'],
                    inputs: [{ itemId: 'item_copper_ingot', quantity: 1 }, { itemId: 'item_coal', quantity: 1 }],
                    outputs: [{ itemId: 'item_copper_nails', chance: 100, minQty: 2, maxQty: 2 }],
                    requiresContext: [{ tag: 'anvil', minTier: 1, chargeCost: 1 }],
                }],
            }, { takeOver: false });
        });

        beforeEach(() => {
            GameState.initNew();
        });

        it('without an Anvil nearby the Nails recipe cannot run', () => {
            const furnace = place(FURNACE, 'token_furnace');
            expect(StationRecipe.setSelectedRecipe(furnace, nailsId())).toBeTruthy();
            const verdict = RecipeResolver.resolveRecipe(furnace.id, furnace);
            expect(verdict.status).not.toBe('ok');
            expect(verdict.reason).toBe('missing_context');
            expect(verdict.missingContext.map((c) => c.tag)).toEqual(['anvil']);
        });

        it('with an Anvil beside it the recipe runs, and the Anvil never wears (brief 230 S1a)', () => {
            const furnace = place(FURNACE, 'token_furnace');
            const anvil = place(BESIDE, 'token_copper_anvil');
            StationRecipe.setSelectedRecipe(furnace, nailsId());

            const verdict = RecipeResolver.resolveRecipe(furnace.id, furnace);
            expect(verdict.reason).toBeUndefined();
            expect(verdict.recipe.id).toBe(nailsId());

            // A context Token is a support, and supports never wear out: it starts unlimited and
            // the recipe's charge cost debits nothing from it.
            expect(anvil.usesRemaining).toBeNull();
            const plan = Charges.planCycle(furnace.id, furnace, { recipe: verdict.recipe });
            expect(plan.ok).toBe(true);
            expect(plan.debits).toEqual([]);
            Charges.commitPlan(plan);
            expect(anvil.usesRemaining).toBeNull();
        });

        it('smelting Copper Ingots needs no Anvil (SP-31)', () => {
            const furnace = place(FURNACE, 'token_furnace');
            StationRecipe.setSelectedRecipe(furnace, 'recipe_copper_ingot');
            const verdict = RecipeResolver.resolveRecipe(furnace.id, furnace);
            expect(verdict.reason).toBeUndefined();
            expect(verdict.recipe.id).toBe('recipe_copper_ingot');
        });
    });
});

describe('The lifecycle audit on the Processing chain', () => {
    it('has no errors and no warnings (slice 7.5a)', () => {
        const ids = new Set([
            'token_wood_foundation', 'token_stone_foundation', 'token_workbench', 'token_cooking_pot',
            'token_furnace', 'token_well', 'token_copper_anvil', 'token_iron_smithy',
            'token_brewery', 'token_alchemy_table',
            ...recipes.filter((r) => ['construction', 'crafting', 'smithing', 'cooking', 'alchemy'].includes(r.skill)).map((r) => r.id),
        ]);
        // The audit reads Tokens EXPANDED (its contract): the Anvil's `Acts as`
        // rule lives in the effect library, so the registry's copy is used.
        const expanded = Object.fromEntries(Object.keys(tokens).map((id) => [id, getTokenType(id) || tokens[id]]));
        // A retired station kind still on a station or a recipe is a leftover for the content pack
        // to clear: a warning, since it narrows nothing. Everything else must stay clean.
        const leftover = (f) => f.severity === 'warning' && (f.field === 'stationKind' || f.field === 'stationKinds');
        const findings = auditLifecycleBlocks({ tokens: expanded, items, recipes, skills: SKILLS })
            .filter((f) => (f.severity === 'error' || ids.has(f.entityId)) && !leftover(f));
        expect(findings.map((f) => [f.severity, f.entityId, f.field])).toEqual([]);
    });
});
