import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { auditLifecycleBlocks, spawnerFamily } from '../systems/core/lifecycleAudit.js';
import { auditContent } from '../systems/core/ContentAudit.js';
import { auditConnectivity } from '../../cms/src/engine/connectivityAuditor.js';
import { TOKENS, registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { deriveTokenType } from '../config/registries/tokenTypeDerivation.js';
import { ITEMS as ITEMS_LIVE } from '../config/registries/itemRegistry.js';
import { listRecipes } from '../config/registries/recipePoolRegistry.js';
import { SKILLS as GAME_SKILLS } from '../config/registries/skillRegistry.js';
import { expandBearer } from '../systems/effects/effectLibrary.js';

/**
 * Token Lifecycle slice 4.2 — the content audit for the new Token blocks.
 */

const clone = (v) => JSON.parse(JSON.stringify(v));

const SKILLS = ['construction', 'farming', 'forestry'];

const ITEMS = {
    item_oak_seed: { id: 'item_oak_seed', name: 'Oak Seed' },
    item_oak_wood: { id: 'item_oak_wood', name: 'Oak Wood' },
    oak_wood: { id: 'oak_wood', name: 'Oak Wood (legacy)' },
};

/** A small, fully valid world using every block. */
function clean() {
    return {
        skills: SKILLS,
        items: clone(ITEMS),
        tokens: {
            token_guild_hall: {
                id: 'token_guild_hall', name: 'Guild Hall',
                trickle: [{ itemId: 'item_oak_seed', quantity: 1, everyMs: 300000 }],
            },
            token_oak_forest: {
                id: 'token_oak_forest', name: 'Oak Forest',
                spawner: {
                    spawns: [{ typeId: 'token_oak_sapling', weight: 1 }],
                    allowance: 5, intervalMs: 20000,
                    upkeep: [{ itemId: 'item_oak_seed', quantity: 1 }],
                },
                shop: { price: [{ itemId: 'item_oak_wood', quantity: 10 }], section: 'forestry' },
            },
            token_oak_sapling: {
                id: 'token_oak_sapling', name: 'Oak Sapling',
                grows: { into: 'token_oak_tree', afterMs: 30000 },
            },
            token_oak_tree: {
                id: 'token_oak_tree', name: 'Oak Tree',
                config: { skill: 'forestry', cycleTimeMs: 12000, inputs: [], outputs: [] },
                shop: { price: [{ itemId: 'item_oak_wood', quantity: 2 }], section: 'forestry' },
            },
            token_birch_sapling: {
                id: 'token_birch_sapling', name: 'Birch Sapling',
                grows: { into: 'token_birch_tree', afterMs: 30000 },
            },
            token_birch_tree: {
                id: 'token_birch_tree', name: 'Birch Tree', uses: 5,
                respawn: { mode: 'regrow', into: 'token_birch_sapling' },
            },
            token_copper_vein: {
                id: 'token_copper_vein', name: 'Copper Ore Vein', uses: 5,
                respawn: { mode: 'refill', afterMs: 12000 },
            },
            token_coast: {
                id: 'token_coast', name: 'Coast',
                turns: { into: [{ typeId: 'token_shrimp_coast', weight: 1 }], everyMs: 60000, chance: 30 },
            },
            token_shrimp_coast: { id: 'token_shrimp_coast', name: 'Shrimp Coast' },
            token_stone_foundation: {
                id: 'token_stone_foundation', name: 'Stone Foundation',
                foundation: { kind: 'stone', skill: 'construction' },
                shop: { price: [{ itemId: 'item_oak_wood', quantity: 5 }], section: 'general' },
            },
            token_furnace: { id: 'token_furnace', name: 'Furnace' },
        },
        recipes: {
            recipe_build_furnace: {
                id: 'recipe_build_furnace', name: 'Build Furnace', skill: 'construction',
                foundationKinds: ['stone'],
                inputs: [], outputs: [{ tokenId: 'token_furnace', chance: 100 }],
            },
            recipe_plain: {
                id: 'recipe_plain', name: 'Plain', skill: 'forestry',
                inputs: [], outputs: [{ itemId: 'item_oak_wood' }],
            },
        },
    };
}

const errors = (world) => auditLifecycleBlocks(world).filter((f) => f.severity === 'error');
const warnings = (world) => auditLifecycleBlocks(world).filter((f) => f.severity === 'warning');

/** Break one thing; expect exactly one finding of that severity, with the given text. */
function expectOne(mutate, { severity = 'error', id, field, includes }) {
    const world = clean();
    mutate(world);
    const found = auditLifecycleBlocks(world);
    expect(found, JSON.stringify(found, null, 2)).toHaveLength(1);
    const [f] = found;
    expect(f.severity).toBe(severity);
    expect(f.entityId).toBe(id);
    if (field) expect(f.field).toBe(field);
    for (const text of [].concat(includes)) expect(f.message).toContain(text);
    return f;
}

describe('Lifecycle audit — a clean world', () => {
    it('produces no findings at all', () => {
        expect(auditLifecycleBlocks(clean())).toEqual([]);
    });

    it('accepts collections as lists as well as maps, and skills as objects', () => {
        const w = clean();
        expect(auditLifecycleBlocks({
            tokens: Object.values(w.tokens),
            items: Object.values(w.items),
            recipes: Object.values(w.recipes),
            skills: SKILLS.map((id) => ({ id, name: id })),
        })).toEqual([]);
    });

    it('computes a family as spawns plus everything they grow into', () => {
        const w = clean();
        expect([...spawnerFamily(w.tokens.token_oak_forest.spawner, w.tokens)])
            .toEqual(['token_oak_sapling', 'token_oak_tree']);
    });
});

describe('Lifecycle audit — errors: references', () => {
    it('a spawner lists a Token that does not exist', () => {
        const f = expectOne((w) => { w.tokens.token_oak_forest.spawner.spawns[0].typeId = 'token_ghost'; },
            { id: 'token_oak_forest', field: 'spawner.spawns[0].typeId', includes: 'token_ghost' });
        expect(f.message).toBe('Oak Forest (token_oak_forest): spawner lists token_ghost, which does not exist.');
    });

    it('grows into a Token that does not exist', () => {
        expectOne((w) => { w.tokens.token_oak_sapling.grows.into = 'token_ghost'; },
            { id: 'token_oak_sapling', field: 'grows.into', includes: ['Oak Sapling (token_oak_sapling)', 'token_ghost', 'does not exist'] });
    });

    it('turns into a Token that does not exist', () => {
        expectOne((w) => { w.tokens.token_coast.turns.into[0].typeId = 'token_ghost'; },
            { id: 'token_coast', field: 'turns.into[0].typeId', includes: ['Coast (token_coast)', 'token_ghost'] });
    });

    it('a building recipe outputs a Token that does not exist', () => {
        expectOne((w) => { w.recipes.recipe_build_furnace.outputs[0].tokenId = 'token_ghost'; },
            { id: 'recipe_build_furnace', field: 'outputs[0].tokenId', includes: ['Build Furnace (recipe_build_furnace)', 'token_ghost'] });
    });

    it('an upkeep item that does not exist', () => {
        expectOne((w) => { w.tokens.token_oak_forest.spawner.upkeep[0].itemId = 'item_ghost'; },
            { id: 'token_oak_forest', field: 'spawner.upkeep[0].itemId', includes: 'item_ghost' });
    });

    it('a shop price item that does not exist', () => {
        expectOne((w) => { w.tokens.token_oak_tree.shop.price[0].itemId = 'item_ghost'; },
            { id: 'token_oak_tree', field: 'shop.price[0].itemId', includes: ['shop price names item_ghost', 'does not exist'] });
    });

    it('a trickle item that does not exist', () => {
        expectOne((w) => { w.tokens.token_guild_hall.trickle[0].itemId = 'item_ghost'; },
            { id: 'token_guild_hall', field: 'trickle[0].itemId', includes: 'item_ghost' });
    });

    it('a legacy item id, even one that exists', () => {
        expectOne((w) => { w.tokens.token_oak_tree.shop.price[0].itemId = 'oak_wood'; },
            { id: 'token_oak_tree', field: 'shop.price[0].itemId', includes: ['oak_wood', 'legacy', 'item_*'] });
    });
});

describe('Lifecycle audit — errors: shape rules', () => {
    it('a spawner whose family contains itself', () => {
        expectOne((w) => { w.tokens.token_oak_sapling.grows.into = 'token_oak_forest'; },
            { id: 'token_oak_forest', field: 'spawner.spawns', includes: 'family contains the spawner itself' });
    });

    it('a grows chain that loops, reported once', () => {
        expectOne((w) => {
            w.tokens.token_oak_tree.grows = { into: 'token_oak_sapling', afterMs: 30000 };
        }, { id: 'token_oak_sapling', field: 'grows.into', includes: 'token_oak_sapling → token_oak_tree → token_oak_sapling' });
    });

    it('a Token that grows into itself', () => {
        expectOne((w) => { w.tokens.token_oak_sapling.grows.into = 'token_oak_sapling'; },
            { id: 'token_oak_sapling', field: 'grows.into', includes: 'loops' });
    });

    it('turns into itself', () => {
        expectOne((w) => { w.tokens.token_coast.turns.into[0].typeId = 'token_coast'; },
            { id: 'token_coast', field: 'turns.into[0].typeId', includes: 'turns into itself' });
    });

    it('turns into a Token that has a turns block of its own', () => {
        expectOne((w) => {
            w.tokens.token_coast.turns.into.push({ typeId: 'token_tide', weight: 1 });
            w.tokens.token_tide = {
                id: 'token_tide', name: 'Tide',
                turns: { into: [{ typeId: 'token_shrimp_coast', weight: 1 }], everyMs: 5000, chance: 30 },
            };
        }, { id: 'token_coast', field: 'turns.into[1].typeId', includes: ['Tide (token_tide)', 'turns block of its own'] });
    });

    it.each([
        ['spawner weight', (w) => { w.tokens.token_oak_forest.spawner.spawns[0].weight = 0; }, 'token_oak_forest', 'spawner.spawns[0].weight'],
        ['turns weight', (w) => { w.tokens.token_coast.turns.into[0].weight = 1.5; }, 'token_coast', 'turns.into[0].weight'],
        ['upkeep quantity', (w) => { w.tokens.token_oak_forest.spawner.upkeep[0].quantity = -1; }, 'token_oak_forest', 'spawner.upkeep[0].quantity'],
        ['shop quantity', (w) => { w.tokens.token_oak_tree.shop.price[0].quantity = '3'; }, 'token_oak_tree', 'shop.price[0].quantity'],
        ['trickle quantity', (w) => { w.tokens.token_guild_hall.trickle[0].quantity = 0; }, 'token_guild_hall', 'trickle[0].quantity'],
        ['allowance', (w) => { w.tokens.token_oak_forest.spawner.allowance = 0; }, 'token_oak_forest', 'spawner.allowance'],
    ])('%s must be a positive integer', (_, mutate, id, field) => {
        expectOne(mutate, { id, field, includes: 'whole number of 1 or more' });
    });

    it.each([
        ['spawner interval', (w) => { w.tokens.token_oak_forest.spawner.intervalMs = 999; }, 'token_oak_forest', 'spawner.intervalMs'],
        ['grow time', (w) => { w.tokens.token_oak_sapling.grows.afterMs = 0; }, 'token_oak_sapling', 'grows.afterMs'],
        ['turns every', (w) => { delete w.tokens.token_coast.turns.everyMs; }, 'token_coast', 'turns.everyMs'],
    ])('%s must be at least 1000 ms', (_, mutate, id, field) => {
        expectOne(mutate, { id, field, includes: 'at least 1000 ms' });
    });

    it.each([0, -5, 101, '30', Number.NaN])('a turns chance of %s is not a percent above 0 and at most 100 (TL-12)', (chance) => {
        expectOne((w) => { w.tokens.token_coast.turns.chance = chance; },
            { id: 'token_coast', field: 'turns.chance', includes: 'percent above 0 and at most 100' });
    });

    it('a turns chance of 100 or a fraction is fine (TL-12)', () => {
        const world = clean();
        world.tokens.token_coast.turns.chance = 100;
        expect(auditLifecycleBlocks(world)).toEqual([]);
        world.tokens.token_coast.turns.chance = 12.5;
        expect(auditLifecycleBlocks(world)).toEqual([]);
    });

    it('a turns block with no chance warns that it rolls the default 30% (TL-12)', () => {
        expectOne((w) => { delete w.tokens.token_coast.turns.chance; },
            { severity: 'warning', id: 'token_coast', field: 'turns.chance', includes: 'default 30%' });
    });

    it('a turns block still carrying the retired lastsMs warns (TL-12)', () => {
        expectOne((w) => { w.tokens.token_coast.turns.lastsMs = 60000; },
            { severity: 'warning', id: 'token_coast', field: 'turns.lastsMs', includes: 'nothing reads since TL-12' });
    });

    it('an empty spawn list', () => {
        expectOne((w) => { w.tokens.token_oak_forest.spawner.spawns = []; },
            { id: 'token_oak_forest', field: 'spawner.spawns', includes: 'is empty' });
    });

    it('an empty shop price', () => {
        expectOne((w) => { w.tokens.token_oak_tree.shop.price = []; },
            { id: 'token_oak_tree', field: 'shop.price', includes: 'is empty' });
    });

    it('a foundation kind that is not one of FOUNDATION_KINDS', () => {
        expectOne((w) => { w.tokens.token_stone_foundation.foundation.kind = 'marble'; },
            { id: 'token_stone_foundation', field: 'foundation.kind', includes: ['marble', 'wood, stone, bench, farmland'] });
    });

    it('a foundation skill that is not a real skill', () => {
        expectOne((w) => { w.tokens.token_stone_foundation.foundation.skill = 'masonry'; },
            { id: 'token_stone_foundation', field: 'foundation.skill', includes: ['masonry', 'not a real skill'] });
    });

    it('a sold Foundation kind with no recipe', () => {
        expectOne((w) => { delete w.recipes.recipe_build_furnace; },
            { id: 'token_stone_foundation', field: 'foundation.kind', includes: ['stone Foundation sold at the Shop', 'no construction recipe'] });
    });

    it('an unsold Foundation kind needs no recipe', () => {
        const w = clean();
        delete w.recipes.recipe_build_furnace;
        delete w.tokens.token_stone_foundation.shop;
        expect(auditLifecycleBlocks(w)).toEqual([]);
    });

    it('a building recipe with more than one output', () => {
        expectOne((w) => { w.recipes.recipe_build_furnace.outputs.push({ itemId: 'item_oak_wood' }); },
            { id: 'recipe_build_furnace', field: 'outputs', includes: 'exactly one Token' });
    });

    it('a building recipe that outputs an item, not a Token', () => {
        expectOne((w) => { w.recipes.recipe_build_furnace.outputs = [{ itemId: 'item_oak_wood' }]; },
            { id: 'recipe_build_furnace', field: 'outputs', includes: 'exactly one Token' });
    });

    it('a building recipe whose skill does not match its Foundations', () => {
        expectOne((w) => {
            // A second, unsold stone Foundation built with farming.
            w.tokens.token_odd_stone = { id: 'token_odd_stone', name: 'Odd Stone', foundation: { kind: 'stone', skill: 'farming' } };
        }, { id: 'recipe_build_furnace', field: 'skill', includes: ['construction recipe', 'stone Foundations are built with farming'] });
    });

    it('a building recipe naming an unknown Foundation kind', () => {
        expectOne((w) => { w.recipes.recipe_build_furnace.foundationKinds.push('marble'); },
            { id: 'recipe_build_furnace', field: 'foundationKinds', includes: 'marble' });
    });

    it.each([0, -1, 1.5, '2'])('a foundation tier of %s is not a whole number of 1 or more', (tier) => {
        expectOne((w) => { w.tokens.token_stone_foundation.foundation.tier = tier; },
            { id: 'token_stone_foundation', field: 'foundation.tier', includes: 'whole number of 1 or more' });
    });

    it.each([0, 2.5, '2'])('a recipe minimum Foundation tier of %s is not a whole number of 1 or more', (tier) => {
        expectOne((w) => { w.recipes.recipe_build_furnace.foundationMinTier = tier; },
            { id: 'recipe_build_furnace', field: 'foundationMinTier', includes: 'whole number of 1 or more' });
    });

    it('a tier that reaches every recipe is fine, and no tier at all is tier 1', () => {
        const w = clean();
        w.tokens.token_stone_foundation.foundation.tier = 3;
        w.recipes.recipe_build_furnace.foundationMinTier = 2;
        expect(auditLifecycleBlocks(w)).toEqual([]);
        w.tokens.token_stone_foundation.foundation.tier = 1;
        w.recipes.recipe_build_furnace.foundationMinTier = 1;
        expect(auditLifecycleBlocks(w)).toEqual([]);
    });

    it('a sold Foundation whose tier is below every recipe of its kind', () => {
        const found = auditLifecycleBlocks((() => {
            const w = clean();
            w.recipes.recipe_build_furnace.foundationMinTier = 2;
            return w;
        })());
        expect(found).toEqual(expect.arrayContaining([
            expect.objectContaining({
                severity: 'error', entityId: 'token_stone_foundation', field: 'foundation.tier',
                message: expect.stringContaining('tier 1 stone Foundation sold at the Shop'),
            }),
            expect.objectContaining({
                severity: 'warning', entityId: 'recipe_build_furnace', field: 'foundationMinTier',
                message: expect.stringContaining('no stone Foundation is tier 2 or higher yet'),
            }),
        ]));
        expect(found).toHaveLength(2);
    });

    it('a Token with more than one of spawner, turns and foundation', () => {
        expectOne((w) => {
            w.tokens.token_shrimp_coast.foundation = { kind: 'wood', skill: 'construction' };
            w.tokens.token_shrimp_coast.spawner = {
                spawns: [{ typeId: 'token_oak_tree', weight: 1 }], allowance: 1, intervalMs: 5000,
                upkeep: [{ itemId: 'item_oak_seed', quantity: 1 }],
            };
        }, { id: 'token_shrimp_coast', field: 'spawner, foundation', includes: 'at most one of spawner, turns and foundation' });
    });
});

describe('Lifecycle audit — respawn', () => {
    it('the clean world carries both kinds and says nothing about them', () => {
        const w = clean();
        expect(w.tokens.token_birch_tree.respawn.mode).toBe('regrow');
        expect(w.tokens.token_copper_vein.respawn.mode).toBe('refill');
        expect(auditLifecycleBlocks(w)).toEqual([]);
    });

    it('a mode the game does not know', () => {
        expectOne((w) => { w.tokens.token_copper_vein.respawn.mode = 'trickle'; },
            { id: 'token_copper_vein', field: 'respawn.mode', includes: ['Copper Ore Vein (token_copper_vein)', 'trickle', 'refill, regrow'] });
    });

    it('a refill shorter than a second, or with no time at all', () => {
        expectOne((w) => { w.tokens.token_copper_vein.respawn.afterMs = 500; },
            { id: 'token_copper_vein', field: 'respawn.afterMs', includes: 'at least 1000 ms' });
        expectOne((w) => { delete w.tokens.token_copper_vein.respawn.afterMs; },
            { id: 'token_copper_vein', field: 'respawn.afterMs', includes: 'at least 1000 ms' });
    });

    it('a regrow from a Token that does not exist, or from nothing', () => {
        expectOne((w) => { w.tokens.token_birch_tree.respawn.into = 'token_ghost'; },
            { id: 'token_birch_tree', field: 'respawn.into', includes: ['token_ghost', 'does not exist'] });
        expectOne((w) => { w.tokens.token_birch_tree.respawn.into = ''; },
            { id: 'token_birch_tree', field: 'respawn.into', includes: 'names no Token' });
    });

    it('a regrow from itself', () => {
        expectOne((w) => { w.tokens.token_birch_tree.respawn.into = 'token_birch_tree'; },
            { id: 'token_birch_tree', field: 'respawn.into', includes: 'regrows from itself' });
    });

    it('a regrow from a Token that never grows back into it', () => {
        expectOne((w) => { w.tokens.token_birch_tree.respawn.into = 'token_furnace'; },
            { id: 'token_birch_tree', field: 'respawn.into', includes: ['Furnace (token_furnace)', 'never grows back'] });
    });

    it('a regrow through a longer chain that does come back is fine', () => {
        const w = clean();
        w.tokens.token_birch_stump = { id: 'token_birch_stump', name: 'Birch Stump', grows: { into: 'token_birch_sapling', afterMs: 10000 } };
        w.tokens.token_birch_tree.respawn.into = 'token_birch_stump';
        expect(auditLifecycleBlocks(w)).toEqual([]);
    });

    it('never on an enemy, a spawner or a Foundation', () => {
        const block = { mode: 'refill', afterMs: 12000 };
        expectOne((w) => { Object.assign(w.tokens.token_shrimp_coast, { uses: 5, enemy: { level: 2 }, respawn: block }); },
            { id: 'token_shrimp_coast', field: 'respawn', includes: 'an enemy never respawns' });
        expectOne((w) => { w.tokens.token_oak_forest.uses = 5; w.tokens.token_oak_forest.respawn = block; },
            { id: 'token_oak_forest', field: 'respawn', includes: 'a spawner never respawns' });
        expectOne((w) => { w.tokens.token_stone_foundation.uses = 5; w.tokens.token_stone_foundation.respawn = block; },
            { id: 'token_stone_foundation', field: 'respawn', includes: 'a Foundation never respawns' });
    });

    it('a Token that never runs out is warned that it never rests (allowed)', () => {
        expectOne((w) => { delete w.tokens.token_copper_vein.uses; },
            { severity: 'warning', id: 'token_copper_vein', field: 'respawn', includes: 'never runs out' });
    });

    it('a family counts the Token a spawned tree regrows from', () => {
        const w = clean();
        w.tokens.token_oak_forest.spawner.spawns = [{ typeId: 'token_birch_tree', weight: 1 }];
        w.tokens.token_birch_stump = { id: 'token_birch_stump', name: 'Birch Stump', grows: { into: 'token_birch_tree', afterMs: 10000 } };
        w.tokens.token_birch_tree.respawn.into = 'token_birch_stump';
        expect([...spawnerFamily(w.tokens.token_oak_forest.spawner, w.tokens)]).toEqual(['token_birch_tree', 'token_birch_stump']);
        expect(auditLifecycleBlocks(w)).toEqual([]);
    });
});

describe('Lifecycle audit — warnings (allowed)', () => {
    it('a spawner with empty upkeep', () => {
        expectOne((w) => { w.tokens.token_oak_forest.spawner.upkeep = []; },
            { severity: 'warning', id: 'token_oak_forest', field: 'spawner.upkeep', includes: 'no upkeep' });
    });

    it('Passive Production lines need no interval: one shared timer pays them (T-099)', () => {
        const w = clean();
        w.tokens.token_guild_hall.trickle = [{ itemId: 'item_oak_seed', quantity: 1 }, { itemId: 'item_oak_wood', quantity: 2, everyMs: 10 }];
        expect(auditLifecycleBlocks(w)).toEqual([]);
    });

    it('a trickle on a Token other than the Guild Hall', () => {
        expectOne((w) => { w.tokens.token_oak_tree.trickle = [{ itemId: 'item_oak_seed', quantity: 1, everyMs: 5000 }]; },
            { severity: 'warning', id: 'token_oak_tree', field: 'trickle', includes: 'only the Guild Hall' });
    });

    it('a sold Token that can neither be worked nor spawn anything', () => {
        expectOne((w) => { w.tokens.token_furnace.shop = { price: [{ itemId: 'item_oak_wood', quantity: 1 }], section: 'general' }; },
            { severity: 'warning', id: 'token_furnace', field: 'shop', includes: 'no way to be worked or to spawn anything' });
    });

    it('a sold station, recognised by its Station rule, is workable', () => {
        const w = clean();
        w.tokens.token_furnace.shop = { price: [{ itemId: 'item_oak_wood', quantity: 1 }], section: 'general' };
        w.tokens.token_furnace.statements = [{ id: 's', keyword: 'station', payload: { skill: 'smithing' } }];
        expect(warnings(w)).toEqual([]);
        expect(errors(w)).toEqual([]);
    });

    it('a sold Token that turns into a workable Token is workable (slice 7.3, the Coast)', () => {
        const w = clean();
        w.tokens.token_coast.shop = { price: [{ itemId: 'item_oak_wood', quantity: 10 }], section: 'fishing' };
        w.tokens.token_shrimp_coast.config = { skill: 'fishing', cycleTimeMs: 16000, inputs: [], outputs: [] };
        expect(warnings(w)).toEqual([]);
        expect(errors(w)).toEqual([]);
    });

    it('a sold context provider (an Acts as rule) is useful (slice 7.5a, the Anvil)', () => {
        const w = clean();
        w.tokens.token_furnace.shop = { price: [{ itemId: 'item_oak_wood', quantity: 1 }], section: 'general' };
        w.tokens.token_furnace.statements = [{ id: 's', keyword: 'acts_as', payload: { tag: 'anvil', tier: 1 } }];
        expect(warnings(w)).toEqual([]);
        expect(errors(w)).toEqual([]);
    });

    it('a sold Token with a legacy provides list is useful too', () => {
        const w = clean();
        w.tokens.token_furnace.shop = { price: [{ itemId: 'item_oak_wood', quantity: 1 }], section: 'general' };
        w.tokens.token_furnace.provides = ['anvil'];
        expect(warnings(w)).toEqual([]);
    });

    it('a sold Token that only turns into something unworkable still warns', () => {
        expectOne((w) => { w.tokens.token_coast.shop = { price: [{ itemId: 'item_oak_wood', quantity: 10 }], section: 'fishing' }; },
            { severity: 'warning', id: 'token_coast', field: 'shop', includes: 'no way to be worked or to spawn anything' });
    });
});

// Shipped data may carry only ALLOWED findings: slice 7.2's three mines spawn
// for free (director's call for the first build is decided per Token). Slice
// 7.5's Copper Anvil is sold at the Shop and is a context provider; since slice
// 7.5a the audit counts that as useful, so it is not on this list. Slice 7.7's
// Goblin Camp also spawns for free (director's call: no upkeep for camps in
// this build). Any error, or any other warning, still fails.
const summarise = (findings) => findings.map((f) => [f.severity, f.entityId, f.field]).sort();
const SHIPPED_ALLOWED = [
    ...['token_coal_mine', 'token_copper_mine', 'token_quarry', 'token_goblin_camp']
        .map((id) => ['warning', id, 'spawner.upkeep']),
].sort();

describe('Lifecycle audit — reaches both audits', () => {
    it('the CMS Economy Audit shows each finding as a row, errors Critical and warnings Warning', () => {
        const w = clean();
        w.tokens.token_oak_forest.spawner.spawns[0].typeId = 'token_ghost';
        w.tokens.token_oak_forest.spawner.upkeep = [];
        const rows = auditConnectivity({ items: w.items, tokens: w.tokens, recipes: w.recipes, effects: {} })
            .filter((r) => r.entityId === 'token_oak_forest');
        const crit = rows.find((r) => r.details.includes('spawner lists token_ghost'));
        const warn = rows.find((r) => r.details.includes('no upkeep'));
        expect(crit).toMatchObject({ entityType: 'Token', severity: 'Critical', issueType: 'Data Integrity', entityName: 'Oak Forest' });
        expect(warn).toMatchObject({ severity: 'Warning' });
    });

    it('the game registries (what the boot audit reads) give the checker nothing to report but the free mines and camp', () => {
        expect(summarise(auditLifecycleBlocks({ tokens: TOKENS, items: ITEMS_LIVE, recipes: listRecipes(), skills: GAME_SKILLS })))
            .toEqual(SHIPPED_ALLOWED);
    });

    it('the game boot audit reports a broken fixture Token, by Token', () => {
        registerTokenTypes({
            fx_la_forest: {
                id: 'fx_la_forest', name: 'Broken Forest',
                spawner: { spawns: [{ typeId: 'token_ghost', weight: 1 }], allowance: 1, intervalMs: 5000, upkeep: [] },
            },
        });
        // Every line about this Token: since slice 4.4 the derived-type check
        // no longer calls a spawner-only Token a buff that does nothing.
        const mine = auditContent().filter((f) => f.where === 'Token "fx_la_forest"');
        expect(mine.map((f) => f.what)).toEqual([
            'Broken Forest (fx_la_forest): spawner lists token_ghost, which does not exist.',
            '(allowed) Broken Forest (fx_la_forest): spawner has no upkeep, so it spawns for free (allowed; SP-70 is decided per Token).',
        ]);
    });

    it('the shared checker finds nothing in the shipped data files', () => {
        const DATA = path.resolve(__dirname, '../../data');
        const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
        // Expanded first, exactly as the CMS Economy Audit does: the audit's
        // contract is expanded Tokens (a station's Station rule and a context
        // provider's Acts as rule live in the effect library).
        const effects = read('effects.json');
        const tokens = Object.fromEntries(Object.entries(read('tokens.json')).map(([id, t]) => [id, expandBearer(t, effects)]));
        const items = read('items.json');
        const recipes = read('tokenRecipes.json');
        expect(summarise(auditLifecycleBlocks({ tokens, items, recipes, skills: GAME_SKILLS }))).toEqual(SHIPPED_ALLOWED);
    });
});

describe('The derived type knows the lifecycle blocks (slice 4.4)', () => {
    const fixtures = {
        fx_la_only_spawner: {
            id: 'fx_la_only_spawner', name: 'Only Spawner',
            spawner: { spawns: [{ typeId: 'token_guild_hall', weight: 1 }], allowance: 1, intervalMs: 5000, upkeep: [{ itemId: 'item_oak_wood', quantity: 1 }] },
        },
        fx_la_only_turns: {
            id: 'fx_la_only_turns', name: 'Only Turns',
            turns: { into: [{ typeId: 'token_guild_hall', weight: 1 }], everyMs: 5000, chance: 30 },
        },
        fx_la_only_foundation: {
            id: 'fx_la_only_foundation', name: 'Only Foundation',
            foundation: { kind: 'stone', skill: 'construction' },
        },
    };

    it('derives spawner, resource and station', () => {
        expect(deriveTokenType(fixtures.fx_la_only_spawner)).toMatchObject({ type: 'spawner' });
        expect(deriveTokenType(fixtures.fx_la_only_turns)).toMatchObject({ type: 'resource' });
        expect(deriveTokenType(fixtures.fx_la_only_foundation)).toMatchObject({ type: 'station' });
        for (const def of Object.values(fixtures)) expect(deriveTokenType(def).warn).toBeFalsy();
        // A sapling: only a grows block, no work cycle of its own.
        const sapling = { id: 'fx_la_only_grows', name: 'Only Grows', grows: { into: 'fx_la_only_turns', afterMs: 30000 } };
        expect(deriveTokenType(sapling)).toMatchObject({ type: 'resource' });
        expect(deriveTokenType(sapling).warn).toBeFalsy();
    });

    it('a Token that also has a work cycle keeps the spawner type; a turning Token with a cycle stays a resource', () => {
        const cycle = { outputs: [{ itemId: 'item_oak_wood', quantity: 1 }] };
        expect(deriveTokenType({ ...fixtures.fx_la_only_spawner, config: cycle }).type).toBe('spawner');
        expect(deriveTokenType({ ...fixtures.fx_la_only_turns, config: cycle }).type).toBe('resource');
    });

    it('the boot audit has no does nothing finding for any of them', () => {
        registerTokenTypes(fixtures);
        const lines = auditContent().filter((f) => Object.keys(fixtures).some((id) => f.where === `Token "${id}"`));
        expect(lines.filter((f) => f.what.includes('does nothing'))).toEqual([]);
        expect(lines.filter((f) => f.what.includes('reads as'))).toEqual([]);
    });
});
