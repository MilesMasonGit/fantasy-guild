import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { familyOf } from '../systems/board/SpawnerSystem.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { recipesForToken } from '../config/registries/recipePoolRegistry.js';
import { expandBearer } from '../systems/effects/effectLibrary.js';
import { stationSkillOf } from '../systems/effects/statements.js';

/**
 * Token Lifecycle slice 7.4 — the Farming chain, pinned from the SHIPPED data
 * (authored through the CMS, never by hand).
 */

const DATA = path.resolve(__dirname, '../../data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const tokens = read('tokens.json');
const items = read('items.json');
// Expanded, as the game and the CMS Economy Audit read them: a Field's Station rule lives in the
// effect library.
const effects = read('effects.json');
const expanded = Object.fromEntries(Object.entries(tokens).map(([id, t]) => [id, expandBearer(t, effects)]));
const recipes = read('tokenRecipes.json');

const farmland = tokens.token_farmland;
const field = tokens.token_wheat_field;
const herbGarden = tokens.token_herb_garden;
const orchard = tokens.token_apple_orchard;
const sapling = tokens.token_apple_sapling;
const appleTree = tokens.token_apple_tree;
const hall = tokens.token_guild_hall;

const byItem = (def) => Object.fromEntries(def.config.outputs.map((o) => [o.itemId, o]));
const building = (name) => recipes.find((r) => r.name === name);

describe('The Farming chain in shipped data (7.4)', () => {
    it('Wheat Seed and Apple Seed are live items', () => {
        expect(items.item_wheat_seed).toMatchObject({ id: 'item_wheat_seed', name: 'Wheat Seed' });
        expect(items.item_apple_seed).toMatchObject({ id: 'item_apple_seed', name: 'Apple Seed' });
    });

    describe('Farmland', () => {
        it('is a Foundation of kind farmland, built on with Construction', () => {
            expect(farmland.name).toBe('Farmland');
            expect(farmland.foundation).toEqual({ kind: 'farmland', skill: 'construction' });
        });

        it('has no work config of its own (6.1: it comes from the picked recipe)', () => {
            expect(farmland.config).toBeNull();
        });

        it('is sold at the Shop for 10 Oak Wood, in the Farming section', () => {
            expect(farmland.shop).toEqual({ price: [{ itemId: 'item_oak_wood', quantity: 10 }], section: 'farming' });
        });

        it('offers exactly the six building recipes', () => {
            const pool = recipesForToken(getTokenType('token_farmland'));
            expect(pool.map((r) => r.name).sort()).toEqual([
                'Build Apple Orchard', 'Build Field', 'Build Fir Forest', 'Build Grapevine', 'Build Herb Garden', 'Build Oak Forest',
            ]);
        });
    });

    for (const [name, level, inputs, builds] of [
        ['Build Field', 1, [{ itemId: 'item_oak_wood', quantity: 3 }], 'token_wheat_field'],
        ['Build Apple Orchard', 1, [{ itemId: 'item_apple_seed', quantity: 3 }], 'token_apple_orchard'],
        ['Build Herb Garden', 5, [{ itemId: 'item_fir_wood', quantity: 5 }, { itemId: 'item_stone', quantity: 2 }], 'token_herb_garden'],
        ['Build Oak Forest', 1, [{ itemId: 'item_oak_seedling', quantity: 3 }], 'token_oak_forest'],
    ]) {
        it(`${name} is a level-${level} Construction recipe on Farmland: 30 s, builds one Token`, () => {
            const r = building(name);
            expect(r).toBeTruthy();
            expect(r.skill).toBe('construction');
            expect(r.foundationKinds).toEqual(['farmland']);
            expect(r.levelRequirement).toBe(level);
            expect(r.durationMs).toBe(30000);
            expect(r.inputs).toEqual(inputs);
            expect(r.outputs.map((o) => o.tokenId)).toEqual([builds]);
        });

        it(`${name} never reaches an ordinary station's pool`, () => {
            for (const def of Object.values(tokens)) {
                if (def.foundation) continue;
                const pool = recipesForToken(getTokenType(def.id)) || [];
                expect(pool.map((r) => r.name)).not.toContain(name);
            }
        });
    }

    describe('Wheat', () => {
        it('the Field is a Farming station of kind field, worked with a Sickle, and is not sold (it is built)', () => {
            expect(field.name).toBe('Field');
            expect(stationSkillOf(expanded.token_wheat_field)).toBe('farming');
            expect(field.needsTool).toEqual({ kind: 'sickle', minTier: 1 });
            expect(field.requiresHero).toBe(true);
            expect(field.spawner).toBeUndefined();
            expect(field.shop).toBeUndefined();
        });

        it('the Herb Garden is a Farming station too, worked with a Sickle', () => {
            expect(stationSkillOf(expanded.token_herb_garden)).toBe('farming');
            expect(herbGarden.needsTool).toEqual({ kind: 'sickle', minTier: 1 });
        });

        it('the Field offers the Wheat crop: 1 Wheat Seed, grows an hour, harvested ten times for Wheat and a 40% Wheat Seed', () => {
            const pool = recipesForToken(getTokenType('token_wheat_field'));
            expect(pool.map((r) => r.id)).toContain('recipe_wheat');
            const wheat = recipes.find((r) => r.id === 'recipe_wheat');
            expect(wheat.skill).toBe('farming');
            expect(wheat.levelRequirement).toBe(1);
            expect(wheat.stationKinds).toEqual(['field']);
            expect(wheat.inputs).toEqual([{ itemId: 'item_wheat_seed', quantity: 1 }]);
            expect(wheat.crop).toMatchObject({ growMs: 3600000, load: 10 });
            const out = Object.fromEntries(wheat.outputs.map((o) => [o.itemId, o]));
            expect(out.item_wheat).toMatchObject({ chance: 100, minQty: 1, maxQty: 2 });
            expect(out.item_wheat_seed).toMatchObject({ chance: 40, minQty: 1, maxQty: 1 });
        });
    });

    describe('Apples (SP-73)', () => {
        it('the Apple Orchard is a spawner of saplings within its reach, allowance 2, every 45 s, paying 1 Apple Seed', () => {
            expect(orchard.spawner).toEqual({
                spawns: [{ typeId: 'token_apple_sapling', weight: 1 }],
                allowance: 2,
                intervalMs: 45000,
                upkeep: [{ itemId: 'item_apple_seed', quantity: 1 }],
                withinReach: true,
            });
            expect(orchard.config).toBeNull();
            expect(orchard.shop).toBeUndefined();
        });

        it('an Apple Sapling grows into an Apple Tree in 45 s', () => {
            expect(sapling.grows).toEqual({ into: 'token_apple_tree', afterMs: 45000 });
            expect(sapling.config).toBeNull();
            expect(familyOf('token_apple_orchard')).toEqual(['token_apple_sapling', 'token_apple_tree']);
        });

        it('an Apple Tree is Farming, has 3 charges and drops Apples and a 30% Apple Seed', () => {
            expect(appleTree.config.skill).toBe('farming');
            expect(appleTree.uses).toBe(3);   // Q9 pacing: was 5
            const out = byItem(appleTree);
            expect(out.item_apple.chance).toBe(100);
            expect(out.item_apple_seed).toMatchObject({ chance: 30, minQty: 1, maxQty: 1 });
        });

        it('an Apple Tree stays put and refills after 3 minutes with an Orchard in reach', () => {
            expect(appleTree.staysPut).toBe(true);
            expect(appleTree.respawn).toMatchObject({ mode: 'refill', afterMs: 180000, needsNearby: ['token_apple_orchard'] });
        });
    });

    it('no Token in the chain needs a tool nearby (TL-2)', () => {
        for (const def of [farmland, field, herbGarden, orchard, sapling, appleTree]) {
            expect(def.acceptedTokens || []).toEqual([]);
        }
    });

    it('the Guild Hall trickles Oak Seedling, Wheat and Apple Seeds (SP-66 placeholder)', () => {
        expect(hall.trickle).toEqual([
            { itemId: 'item_oak_seedling', quantity: 1, everyMs: 300000 },
            { itemId: 'item_wheat_seed', quantity: 1, everyMs: 300000 },
            { itemId: 'item_apple_seed', quantity: 1, everyMs: 600000 },
        ]);
    });

    it('the lifecycle audit has nothing to say about the chain', () => {
        const ids = new Set([
            'token_farmland', 'token_wheat_field', 'token_herb_garden',
            'token_apple_orchard', 'token_apple_sapling', 'token_apple_tree', 'token_guild_hall',
            ...recipes.filter((r) => r.skill === 'farming').map((r) => r.id),
        ]);
        const findings = auditLifecycleBlocks({ tokens: expanded, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        expect(findings).toEqual([]);
    });
});
