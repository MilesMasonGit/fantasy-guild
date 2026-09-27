import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { familyOf } from '../systems/board/SpawnerSystem.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';
import { recipesForToken } from '../config/registries/recipePoolRegistry.js';

/**
 * Token Lifecycle slice 7.4 — the Farming chain, pinned from the SHIPPED data
 * (authored through the CMS, never by hand).
 *
 * Farmland (shop, a Foundation of kind `farmland`) → a Farming hero plants it
 * with a recipe picked on it, spending one seed, and it BECOMES a Wheat Field or
 * an Apple Orchard in place (DP-6). The Field spawns Wheat Sprouts, paying 1
 * Wheat Seed each; a sprout grows into Ripe Wheat, harvested a few times for
 * Wheat and sometimes a Wheat Seed, then gone. The Orchard does the same with
 * Apple Saplings → Apple Trees (SP-73: fruit is Farming). The Guild Hall
 * trickles both seeds so a new game can start and never stalls for good.
 *
 * The numbers are placeholders (TL-5); this pins the shape of the chain.
 */

const DATA = path.resolve(__dirname, '../../data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const tokens = read('tokens.json');
const items = read('items.json');
const recipes = read('tokenRecipes.json');

const farmland = tokens.token_farmland;
const field = tokens.token_wheat_field;
const sprout = tokens.token_wheat_sprout;
const ripe = tokens.token_ripe_wheat;
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
        it('is a Foundation of kind farmland, built on with Farming', () => {
            expect(farmland.name).toBe('Farmland');
            expect(farmland.foundation).toEqual({ kind: 'farmland', skill: 'farming' });
        });

        it('has no work config of its own (6.1: it comes from the picked recipe)', () => {
            expect(farmland.config).toBeNull();
        });

        it('is sold at the Shop for 10 Oak Wood, in the Farming section', () => {
            expect(farmland.shop).toEqual({ price: [{ itemId: 'item_oak_wood', quantity: 10 }], section: 'farming' });
        });

        it('offers exactly the two planting recipes', () => {
            const pool = recipesForToken(getTokenType('token_farmland'));
            expect(pool.map((r) => r.name).sort()).toEqual(['Plant Apple Orchard', 'Plant Wheat Field']);
        });
    });

    for (const [name, seed, builds] of [
        ['Plant Wheat Field', 'item_wheat_seed', 'token_wheat_field'],
        ['Plant Apple Orchard', 'item_apple_seed', 'token_apple_orchard'],
    ]) {
        it(`${name} is a level-1 Farming recipe on Farmland: 1 seed, 30 s, builds one Token`, () => {
            const r = building(name);
            expect(r).toBeTruthy();
            expect(r.skill).toBe('farming');
            expect(r.foundationKinds).toEqual(['farmland']);
            expect(r.levelRequirement).toBe(1);
            expect(r.durationMs).toBe(30000);   // Q9 pacing (FB-19): was 15000
            expect(r.inputs).toEqual([{ itemId: seed, quantity: 1 }]);
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
        it('the Wheat Field is a spawner of sprouts, allowance 3, every 30 s, paying 1 Wheat Seed', () => {
            expect(field.spawner).toEqual({
                spawns: [{ typeId: 'token_wheat_sprout', weight: 1 }],
                allowance: 3,
                intervalMs: 30000,
                upkeep: [{ itemId: 'item_wheat_seed', quantity: 1 }],
            });
            expect(field.tokenType).toBe('spawner');
        });

        it('the Wheat Field is not worked, carries no rules and is not sold (it is planted)', () => {
            expect(field.config).toBeNull();
            expect(field.requiresHero).toBe(false);
            expect(field.effects || []).toEqual([]);
            expect(field.shop).toBeUndefined();
        });

        it('a Wheat Sprout grows into Ripe Wheat in 30 s and has no work cycle', () => {
            expect(sprout.grows).toEqual({ into: 'token_ripe_wheat', afterMs: 30000 });
            expect(sprout.config).toBeNull();
        });

        it('the Field family is sprout then ripe wheat', () => {
            expect(familyOf('token_wheat_field')).toEqual(['token_wheat_sprout', 'token_ripe_wheat']);
        });

        it('Ripe Wheat is harvested (Farming 1, 3 s) three times for Wheat and a 40% Wheat Seed', () => {
            expect(ripe.config.skill).toBe('farming');
            expect(ripe.config.skillRequired).toBe(1);
            expect(ripe.config.cycleTimeMs).toBe(3000);   // Q9: Quick, the sync places it at 3 s (was 16000)
            const out = byItem(ripe);
            expect(Object.keys(out).sort()).toEqual(['item_wheat', 'item_wheat_seed']);
            expect(out.item_wheat).toMatchObject({ chance: 100, minQty: 1, maxQty: 2 });
            expect(out.item_wheat_seed).toMatchObject({ chance: 40, minQty: 1, maxQty: 1 });
            expect(ripe.uses).toBe(3);
        });
    });

    describe('Apples (SP-73)', () => {
        it('the Apple Orchard is a spawner of saplings, allowance 2, every 45 s, paying 1 Apple Seed', () => {
            expect(orchard.spawner).toEqual({
                spawns: [{ typeId: 'token_apple_sapling', weight: 1 }],
                allowance: 2,
                intervalMs: 45000,
                upkeep: [{ itemId: 'item_apple_seed', quantity: 1 }],
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
            expect(appleTree.uses).toBe(3);   // Q9 pacing (FB-19): was 5
            const out = byItem(appleTree);
            expect(out.item_apple.chance).toBe(100);
            expect(out.item_apple_seed).toMatchObject({ chance: 30, minQty: 1, maxQty: 1 });
        });
    });

    it('no Token in the chain needs a tool nearby (TL-2)', () => {
        for (const def of [farmland, field, sprout, ripe, orchard, sapling, appleTree]) {
            expect(def.acceptedTokens || []).toEqual([]);
        }
    });

    it('the Guild Hall trickles Oak, Wheat and Apple Seeds (SP-66 placeholder)', () => {
        expect(hall.trickle).toEqual([
            { itemId: 'item_oak_seed', quantity: 1, everyMs: 300000 },
            { itemId: 'item_wheat_seed', quantity: 1, everyMs: 300000 },
            { itemId: 'item_apple_seed', quantity: 1, everyMs: 600000 },
        ]);
    });

    it('the lifecycle audit has nothing to say about the chain', () => {
        const ids = new Set([
            'token_farmland', 'token_wheat_field', 'token_wheat_sprout', 'token_ripe_wheat',
            'token_apple_orchard', 'token_apple_sapling', 'token_apple_tree', 'token_guild_hall',
            ...recipes.filter((r) => r.skill === 'farming').map((r) => r.id),
        ]);
        const findings = auditLifecycleBlocks({ tokens, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        expect(findings).toEqual([]);
    });
});
