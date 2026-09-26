import { describe, it, expect, beforeEach, vi } from 'vitest';
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
import { recipesForToken } from '../config/registries/recipePoolRegistry.js';
import { stationSkillOf, promotedJobOf } from '../systems/effects/statements.js';

/**
 * Token Lifecycle slices 7.5 (Processing) and 6.2 (Academies), pinned from the
 * SHIPPED data (authored through the CMS, never by hand).
 *
 * Two Foundations are sold at the Shop (Construction section). A Construction
 * hero builds on them with a recipe picked on the Foundation, and the
 * Foundation BECOMES the building in place (DP-6):
 *   Wood Foundation  → Workbench (Crafting) or Cooking Pot (Cooking)
 *   Stone Foundation → Furnace (Smithing) or Fighter's Academy (SP-62)
 * Crafting burns no fuel (SP-26): Oak Wood → Charcoal, Oak Wood + Charcoal →
 * Torch. Cooking and Smithing do: Shrimp and Apple Juice take a Charcoal,
 * Copper Ingot a Coal. A Copper Anvil, bought with Copper Ingots, is a context
 * Token with charges (DP-8, SP-30): beside a Furnace it lets Copper Nails be
 * smithed, and each cycle wears it by one.
 *
 * The numbers are placeholders (TL-5); this pins the shape of the chain.
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
        it('the Wood Foundation is a wood Foundation built with Construction, sold for 15 Oak Wood', () => {
            const def = tokens.token_wood_foundation;
            expect(def.name).toBe('Wood Foundation');
            expect(def.foundation).toEqual({ kind: 'wood', skill: 'construction' });
            expect(def.shop).toEqual({ price: [{ itemId: 'item_oak_wood', quantity: 15 }], section: 'construction' });
            expect(def.config).toBeNull();
        });

        it('the Stone Foundation is a stone Foundation, sold for 10 Stone and 5 Oak Wood', () => {
            const def = tokens.token_stone_foundation;
            expect(def.name).toBe('Stone Foundation');
            expect(def.foundation).toEqual({ kind: 'stone', skill: 'construction' });
            expect(def.shop).toEqual({
                price: [{ itemId: 'item_stone', quantity: 10 }, { itemId: 'item_oak_wood', quantity: 5 }],
                section: 'construction',
            });
            expect(def.config).toBeNull();
        });

        it('a Wood Foundation offers the Workbench and the Cooking Pot', () => {
            expect(poolNames('token_wood_foundation')).toEqual(['Build Cooking Pot', 'Build Workbench']);
        });

        it("a Stone Foundation offers the Furnace and the Fighter's Academy (SP-62)", () => {
            expect(poolNames('token_stone_foundation')).toEqual(["Build Fighter's Academy", 'Build Furnace']);
        });

        for (const [name, kind, inputs, builds] of [
            ['Build Workbench', 'wood', [{ itemId: 'item_oak_wood', quantity: 5 }], 'token_workbench'],
            ['Build Cooking Pot', 'wood', [{ itemId: 'item_oak_wood', quantity: 5 }], 'token_cooking_pot'],
            ['Build Furnace', 'stone', [{ itemId: 'item_stone', quantity: 5 }], 'token_furnace'],
            ["Build Fighter's Academy", 'stone',
                [{ itemId: 'item_stone', quantity: 10 }, { itemId: 'item_oak_wood', quantity: 10 }], 'token_fighter_s_academy'],
        ]) {
            it(`${name}: Construction 1, 15 s, on ${kind}, builds ${builds}`, () => {
                const r = named(name);
                expect(r).toBeTruthy();
                expect(r.skill).toBe('construction');
                expect(r.foundationKinds).toEqual([kind]);
                expect(r.levelRequirement).toBe(1);
                expect(r.durationMs).toBe(15000);
                expect(r.inputs).toEqual(inputs);
                expect(r.outputs.map((o) => o.tokenId)).toEqual([builds]);
            });
        }

        it('no building recipe reaches an ordinary station', () => {
            for (const def of Object.values(tokens)) {
                if (def.foundation) continue;
                const pool = recipesForToken(getTokenType(def.id)) || [];
                expect(pool.filter((r) => r.skill === 'construction')).toEqual([]);
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

        it('each has a work config naming its skill, so a hero will work it (as the Ceramics Kiln has)', () => {
            for (const [id, skill] of [['token_workbench', 'crafting'], ['token_cooking_pot', 'cooking'], ['token_furnace', 'smithing']]) {
                expect(tokens[id].config, id).toMatchObject({ skill, skillRequired: 1, inputs: [], outputs: [] });
                expect(tokens[id].requiresHero, id).toBe(true);
            }
        });

        it('the Workbench offers exactly Charcoal and Torch, and a new one starts on Charcoal', () => {
            // The malformed, never-runnable Pickaxe Mould recipe was removed in
            // 7.5: as the Workbench's default it crashed the mat's progress bar.
            expect(poolNames('token_workbench')).toEqual(['Charcoal', 'Torch']);
            expect(StationRecipe.defaultRecipeFor(getTokenType('token_workbench')).name).toBe('Charcoal');
        });

        it('no recipe names its context as a bare string', () => {
            for (const r of recipes) {
                for (const c of r.requiresContext || []) expect(typeof c, r.name).toBe('object');
            }
        });
    });

    describe('Recipes and fuel (SP-26)', () => {
        it('Crafting burns no fuel: Charcoal is 2 Oak Wood, a Torch is 1 Oak Wood + 1 Charcoal', () => {
            const charcoal = named('Charcoal');
            expect(charcoal.skill).toBe('crafting');
            expect(charcoal.levelRequirement).toBe(1);
            expect(charcoal.inputs).toEqual([{ itemId: 'item_oak_wood', quantity: 2 }]);
            expect(charcoal.outputs.map((o) => [o.itemId, o.minQty, o.maxQty])).toEqual([['item_charcoal', 1, 1]]);

            const torch = named('Torch');
            expect(torch.skill).toBe('crafting');
            expect(torch.levelRequirement).toBe(1);
            expect(torch.inputs).toEqual([
                { itemId: 'item_oak_wood', quantity: 1 }, { itemId: 'item_charcoal', quantity: 1 },
            ]);
            expect(torch.outputs.map((o) => o.itemId)).toEqual(['item_torch']);
        });

        it('Smithing smelts Copper Ingots from 4 Copper Ore and 1 Coal, no Anvil (SP-31)', () => {
            const ingot = recipes.find((r) => r.id === 'recipe_copper_ingot');
            expect(ingot.inputs).toEqual([
                { itemId: 'item_copper_ore', quantity: 4 }, { itemId: 'item_coal', quantity: 1 },
            ]);
            expect(ingot.requiresContext).toEqual([]);
            expect(ingot.levelRequirement).toBe(1);
        });

        it('Cooking burns a Charcoal: Shrimp and Apple Juice, both level 1', () => {
            const shrimp = recipes.find((r) => r.id === 'recipe_shrimp');
            expect(shrimp.inputs).toEqual([
                { itemId: 'item_raw_shrimp', quantity: 1 }, { itemId: 'item_charcoal', quantity: 1 },
            ]);
            expect(shrimp.levelRequirement).toBe(1);

            const juice = named('Apple Juice');
            expect(juice.skill).toBe('cooking');
            expect(juice.inputs).toEqual([
                { itemId: 'item_apple', quantity: 4 }, { itemId: 'item_charcoal', quantity: 1 },
            ]);
            expect(juice.levelRequirement).toBe(1);
        });
    });

    describe('The Copper Anvil (DP-8, SP-30, SP-56)', () => {
        const anvil = tokens.token_copper_anvil;

        it('is sold in the Smithing section for 5 Copper Ingots and has 20 charges', () => {
            expect(anvil.shop).toEqual({ price: [{ itemId: 'item_copper_ingot', quantity: 5 }], section: 'smithing' });
            expect(anvil.uses).toBe(20);
            expect(anvil.requiresHero).toBe(false);
        });

        it('acts as a tier-1 anvil, and nothing else on the mat provides one', () => {
            expect(getProvidedTagsWithTiers(getTokenType('token_copper_anvil'))).toEqual({ anvil: 1 });
            const others = Object.keys(tokens)
                .filter((id) => id !== 'token_copper_anvil')
                .filter((id) => getProvidedTagsWithTiers(getTokenType(id)).anvil);
            expect(others).toEqual([]);
        });

        it('Copper Nails: 1 Copper Ingot + 1 Coal → 2 Nails, needs an anvil and wears it by one', () => {
            const nails = named('Copper Nails');
            expect(nails.skill).toBe('smithing');
            expect(nails.levelRequirement).toBe(1);
            expect(nails.inputs).toEqual([
                { itemId: 'item_copper_ingot', quantity: 1 }, { itemId: 'item_coal', quantity: 1 },
            ]);
            expect(nails.outputs.map((o) => [o.itemId, o.minQty, o.maxQty])).toEqual([['item_copper_nails', 2, 2]]);
            expect(nails.requiresContext).toEqual([{ tag: 'anvil', minTier: 1, chargeCost: 1 }]);
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
        const nailsId = () => named('Copper Nails').id;

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

        it('with an Anvil beside it the recipe runs, and a cycle takes one Anvil charge', () => {
            const furnace = place(FURNACE, 'token_furnace');
            const anvil = place(BESIDE, 'token_copper_anvil');
            StationRecipe.setSelectedRecipe(furnace, nailsId());

            const verdict = RecipeResolver.resolveRecipe(furnace.id, furnace);
            expect(verdict.reason).toBeUndefined();
            expect(verdict.recipe.id).toBe(nailsId());

            expect(anvil.usesRemaining).toBe(20);
            const plan = Charges.planCycle(furnace.id, furnace, { recipe: verdict.recipe });
            expect(plan.ok).toBe(true);
            // The Furnace is unlimited (SP-23), so the Anvil is the only debit.
            expect(plan.debits.map((d) => [d.id, d.amount])).toEqual([[anvil.id, 1]]);
            Charges.commitPlan(plan);
            expect(anvil.usesRemaining).toBe(19);
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

describe("Academies (6.2, SP-62)", () => {
    it("the Fighter's Academy still promotes to Fighter, with its charges as before", () => {
        expect(promotedJobOf(getTokenType('token_fighter_s_academy'))).toBe('fighter');
        expect(tokens.token_fighter_s_academy.uses).toBe(10);
        expect(tokens.token_fighter_s_academy.shop).toBeUndefined();
    });
});

describe('The lifecycle audit on the Processing chain', () => {
    it('has no errors, and only the Anvil\'s known shop warning', () => {
        const ids = new Set([
            'token_wood_foundation', 'token_stone_foundation', 'token_workbench', 'token_cooking_pot',
            'token_furnace', 'token_fighter_s_academy', 'token_copper_anvil',
            ...recipes.filter((r) => ['construction', 'crafting', 'smithing', 'cooking'].includes(r.skill)).map((r) => r.id),
        ]);
        const findings = auditLifecycleBlocks({ tokens, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        // The audit's "sold but cannot be worked or spawn anything" rule does not
        // count a context provider (an `Acts as` Token) as useful, so the Anvil
        // warns. Warnings are allowed content; reported to the director.
        expect(findings.map((f) => [f.severity, f.entityId, f.field])).toEqual([
            ['warning', 'token_copper_anvil', 'shop'],
        ]);
    });
});
