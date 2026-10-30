import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    buildWorld, computeReach, describePath, reachPath, ingredientTree, treeSummary, buildLedger,
    itemKey, tokenKey, recipeKey, BOUNTY_MAP_CHANCE, LUCK_BELOW,
} from '../systems/atlas/ledgerEngine.js';
import { BOUNTY_MAP_REWARD } from '../systems/quests/questBounties.js';
import { ledgerWorkspace } from './fixtures/ledgerWorld.js';

/**
 * The ledger's engines on a small fixture world (`fixtures/ledgerWorld.js`): reach (the earliest
 * tier and the path to every entry) and the ingredient tree (effort, skills, depth, origins).
 */

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const ledger = () => buildLedger(ledgerWorkspace());
const reachOf = (key) => ledger().reachOf(key);

describe('reach: what the Starter Camp and the Guild Hall give', () => {
    it('puts the camp, its work and its Bank at tier 0, each with the path that gets there', () => {
        const l = ledger();
        expect(l.reachOf(itemKey('item_copper_ore'))).toMatchObject({ tier: 0, how: 'work', via: tokenKey('token_copper_vein'), levels: { mining: 1 } });
        expect(l.pathOf(itemKey('item_copper_ore'))).toBe('Copper Ore ← Copper Vein (Mining 1) ← in the Starter Camp');
        expect(l.reachOf(itemKey('item_worm'))).toMatchObject({ tier: 0, how: 'starter-bank' });
        expect(l.reachOf(itemKey('item_copper_pickaxe'))).toMatchObject({ tier: 0, how: 'starter-tool' });
        expect(l.reachOf(itemKey('item_seed'))).toMatchObject({ tier: 0, how: 'trickle', via: tokenKey('token_guild_hall') });
        expect(l.reachOf(itemKey('item_water'))).toMatchObject({ tier: 0, how: 'upgrade' });
    });

    it('follows a recipe to its station and its inputs', () => {
        const l = ledger();
        expect(l.reachOf(recipeKey('recipe_copper_ingot'))).toMatchObject({ tier: 0, via: tokenKey('token_furnace') });
        expect(l.pathOf(itemKey('item_copper_ingot'))).toBe('Copper Ingot ← Furnace (Smithing 1) ← in the Starter Camp');
    });

    it('builds on a Foundation bought at the Shop, and a station with no work cycle offers nothing', () => {
        const l = ledger();
        expect(l.reachOf(tokenKey('token_wood_foundation'))).toMatchObject({ tier: 0, how: 'shop' });
        expect(l.reachOf(tokenKey('token_smithy'))).toMatchObject({ tier: 0, levels: { construction: 3 } });
        expect(l.pathOf(tokenKey('token_smithy'))).toBe('Smithy ← Build Smithy ← Wood Foundation (Construction 3) ← bought at the Shop');
        expect(l.world.rules.some((r) => r.via === tokenKey('token_idle_anvil') && r.how === 'station')).toBe(false);
    });

    it('regrows, grows and spawns, paying a growth cost from Passive Production', () => {
        const l = ledger();
        expect(l.reachOf(tokenKey('token_oak_stump'))).toMatchObject({ tier: 0, how: 'regrow' });
        expect(l.reachOf(tokenKey('token_oak_sapling'))).toMatchObject({ tier: 0, how: 'grow' });
        expect(l.reachOf(tokenKey('token_goblin'))).toMatchObject({ tier: 0, how: 'spawn', via: tokenKey('token_goblin_camp') });
    });

    it('catches with the rod, and with bait from the Bank', () => {
        const l = ledger();
        expect(l.reachOf(itemKey('item_shrimp'))).toMatchObject({ tier: 0, how: 'catch' });
        expect(l.reachOf(itemKey('item_trout'))).toMatchObject({ tier: 0, how: 'catch' });
        const baited = l.world.rules.find((r) => r.gives.some((g) => g.key === itemKey('item_trout')));
        expect(baited.needs).toContain(itemKey('item_worm'));
    });

    it('harvests a Field that starts ripe without a seed nothing else makes', () => {
        const l = ledger();
        expect(l.reachOf(itemKey('item_wheat'))).toMatchObject({ tier: 0 });
        expect(l.reachOf(itemKey('item_wheat_seed'))).toMatchObject({ tier: 0, chance: 0.4 });
    });

    it('asks for a tool only where the work names a skill, as the game does', () => {
        const ws = ledgerWorkspace();
        const vein = (skill) => ({ id: 'token_deep_vein', name: 'Deep Vein', needsTool: { kind: 'pickaxe', minTier: 4 }, config: { skill, skillRequired: 1, cycleTimeMs: 1000, inputs: [], outputs: [{ itemId: 'item_gem', chance: 100, minQty: 1, maxQty: 1 }] } });
        ws.starterCamp.tokens.push({ typeId: 'token_deep_vein', x: 900, y: 100 });
        ws.tokens.token_deep_vein = vein('mining');
        expect(buildLedger(ws).reachOf(itemKey('item_gem')).tier).toBeNull();
        ws.tokens.token_deep_vein = vein('');
        expect(buildLedger(ws).reachOf(itemKey('item_gem')).tier).toBe(0);
    });

    it('gets a bonus drop from a rule granting it to the work in reach', () => {
        expect(reachOf(itemKey('item_bird_nest'))).toMatchObject({ tier: 0, how: 'bonus', via: tokenKey('token_birdwatcher'), chance: 0.25, luckOnly: false });
    });
});

describe('reach: maps and the tiers they open', () => {
    it('opens plane 1 with the tutorial map, at the tier the owner set on it', () => {
        const l = ledger();
        expect(l.reachOf(itemKey('map_mountain'))).toMatchObject({ tier: 0, how: 'tutorial' });
        expect(l.reachOf(tokenKey('token_chief_tent'))).toMatchObject({ tier: 1, how: 'map', via: itemKey('map_mountain') });
        expect(l.reachOf(tokenKey('token_goblin_chief'))).toMatchObject({ tier: 1 });
    });

    it('takes a first-kill drop as sure, and the map it drops opens plane 2', () => {
        const l = ledger();
        expect(l.reachOf(itemKey('map_volcano'))).toMatchObject({ tier: 1, how: 'drop', firstKill: true, luckOnly: false });
        const iron = l.reachOf(itemKey('item_iron_ore'));
        expect(iron).toMatchObject({ tier: 2, sureTier: 2, luckOnly: false, levels: { mining: 15, combat: 20 }, gate: { skill: 'combat', level: 20 } });
        expect(l.pathOf(itemKey('item_iron_ore'))).toBe(
            "Iron Ore ← Iron Vein (Mining 15) ← Volcano Map ← Goblin Chief (Combat 20, first kill) ← Chief's Tent ← Mountain Map ← given by the tutorial"
        );
        expect(reachPath(l.reach, itemKey('item_iron_ore')).map((s) => s.tier)).toEqual([2, 2, 1, 1, 1, 0]);
    });

    it('carries the tier down a chain of recipes', () => {
        const l = ledger();
        expect(l.reachOf(recipeKey('recipe_iron_ingot'))).toMatchObject({ tier: 2, levels: { smithing: 15, mining: 15 } });
        expect(l.reachOf(itemKey('item_iron_pickaxe'))).toMatchObject({ tier: 2, levels: { smithing: 16 } });
    });

    it('a map with no set tier opens its Region at the tier its item is had', () => {
        const ws = ledgerWorkspace();
        delete ws.items.map_volcano.ledger;
        const l = buildLedger(ws);
        expect(l.reachOf(itemKey('item_iron_ore')).tier).toBe(1);
    });

    it('pays maps from bounties at the game’s odds', () => {
        expect(BOUNTY_MAP_CHANCE).toBe(BOUNTY_MAP_REWARD.chance);
        const bounty = buildWorld(ledgerWorkspace()).rules.find((r) => r.how === 'bounty');
        expect(bounty.gives).toEqual([{ key: itemKey('map_mountain'), chance: BOUNTY_MAP_CHANCE }]);
    });

    it('a modifier no one has writes nothing', () => {
        expect(reachOf(itemKey('mod_deep_veins')).tier).toBeNull();
    });
});

describe('reach: luck, never and Planned', () => {
    it('calls a drop under 5 % with no sure way luck only, and says when a sure way comes', () => {
        const honey = reachOf(itemKey('item_honey'));
        expect(LUCK_BELOW).toBe(0.05);
        expect(honey).toMatchObject({ tier: 0, sureTier: 2, luckOnly: true, chance: 0.03 });
        expect(reachOf(tokenKey('token_fire_elemental'))).toMatchObject({ tier: 2, sureTier: null, luckOnly: true });
        expect(describePath(ledger().reach, itemKey('item_honey'))).toBe('Honey ← Goblin (Combat 5, 3%) ← Goblin Camp ← in the Starter Camp');
    });

    it('says never for what nothing makes', () => {
        expect(reachOf(itemKey('item_gem'))).toMatchObject({ tier: null, planned: false });
        expect(ledger().pathOf(itemKey('item_gem'))).toBe('never');
    });

    it('keeps Planned stubs out of the world: no reach, and they make nothing', () => {
        const l = ledger();
        for (const key of [itemKey('item_mythril_ore'), tokenKey('token_mythril_vein'), recipeKey('recipe_mythril_bar')]) {
            expect(l.reachOf(key)).toMatchObject({ planned: true, tier: null });
            expect(l.pathOf(key)).toBe('planned');
        }
        // The Planned recipe names the Gem as an output; it still comes from nowhere.
        expect(l.reachOf(itemKey('item_gem')).tier).toBeNull();
        expect(l.world.rules.some((r) => r.id.includes('mythril'))).toBe(false);
    });

    it('settles on the same answer whatever order the content comes in', () => {
        const ws = ledgerWorkspace();
        const reversed = {
            ...ws,
            items: Object.fromEntries(Object.entries(ws.items).reverse()),
            tokens: Object.fromEntries(Object.entries(ws.tokens).reverse()),
        };
        const a = computeReach(buildWorld(ws));
        const b = computeReach(buildWorld(reversed));
        for (const [key, entry] of a) expect(b.get(key)?.tier).toBe(entry.tier);
    });
});

describe('over the shipped content', () => {
    const read = (file) => JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));

    it('gives every item, Token and recipe an answer, and traces Iron Ingot to Iron Ore and Coal', () => {
        const content = {
            items: read('items.json'), tokens: read('tokens.json'), recipes: read('tokenRecipes.json'),
            effects: read('effects.json'), starterCamp: read('starterCamp.json'),
        };
        const l = buildLedger(content);
        for (const id of Object.keys(content.items)) expect(l.reach.has(itemKey(id))).toBe(true);
        for (const id of Object.keys(content.tokens)) expect(l.reach.has(tokenKey(id))).toBe(true);
        expect(l.reachOf(tokenKey('token_copper_ore_vein')).tier).toBe(0);
        const ingot = l.treeOf('item_iron_ingot');
        expect(ingot.origins.map((o) => o.id).sort()).toEqual(['item_coal', 'item_iron_ore']);
        expect(ingot.effortMs).toBeGreaterThan(0);
    });
});

describe('trees: a made item down to its origins', () => {
    it('prices Iron Ingot from its recipe: effort, skills, depth and origins', () => {
        const { tree, effortMs, skills, depth, origins, complete } = ledger().treeOf('item_iron_ingot');
        // 18 s smelting + 2 ore at 12 s + 2 coal at 4 s.
        expect(effortMs).toBe(18000 + 2 * 12000 + 2 * 4000);
        expect(skills).toEqual(['mining', 'smithing']);
        expect(depth).toBe(2);
        expect(origins).toEqual([
            { id: 'item_iron_ore', name: 'Iron Ore', tier: 2 },
            { id: 'item_coal', name: 'Coal', tier: 0 },
        ]);
        expect(complete).toBe(true);
        expect(tree.source).toMatchObject({ how: 'craft', at: 'Furnace', skill: 'smithing', level: 15 });
        expect(tree.children.map((c) => [c.id, c.quantity, c.tools])).toEqual([
            ['item_iron_ore', 2, ['item_copper_pickaxe']],
            ['item_coal', 2, ['item_copper_pickaxe']],
        ]);
    });

    it('goes all the way down, and divides by what a cycle yields', () => {
        const pickaxe = ledger().treeOf('item_iron_pickaxe');
        expect(pickaxe.effortMs).toBe(30000 + 3 * 50000 + 5000);
        expect(pickaxe.depth).toBe(3);
        expect(pickaxe.skills).toEqual(['forestry', 'mining', 'smithing']);
        // A vein that yields 1-2 ore a cycle costs 6 s over 1.5 ore.
        expect(ledger().treeOf('item_copper_ingot').effortMs).toBe(9000 + 2 * (6000 / 1.5) + 4000);
    });

    it('marks what it cannot price: a fight has no authored length, so the tree is a floor', () => {
        const bones = ledger().treeOf('item_bones');
        expect(bones.tree.source.how).toBe('drop');
        expect(bones.complete).toBe(false);
        const gem = ledger().treeOf('item_gem');
        expect(gem).toMatchObject({ effortMs: 0, depth: 0, complete: false });
    });

    it('costs no hero time for Passive Production, and takes another rate when given one', () => {
        expect(ledger().treeOf('item_seed')).toMatchObject({ effortMs: 0, complete: true });
        const fast = buildLedger(ledgerWorkspace(), { cycleTimeOf: (rule) => (rule.how === 'craft' ? 1000 : null) });
        expect(fast.treeOf('item_iron_ingot').effortMs).toBe(1000 + 2 * 12000 + 2 * 4000);
    });

    it('stops at an ingredient already on the way up', () => {
        const ws = ledgerWorkspace();
        ws.recipePools.smithing.push({ id: 'recipe_loop', name: 'Loop', skill: 'smithing', stationKinds: ['furnace'], durationMs: 1000, inputs: [{ itemId: 'item_gem', quantity: 1 }], outputs: [{ itemId: 'item_gem', chance: 100, minQty: 2, maxQty: 2 }] });
        const world = buildWorld(ws);
        const tree = ingredientTree(world, computeReach(world), 'item_gem');
        expect(tree.children[0].cycle).toBe(true);
        expect(treeSummary(tree).depth).toBe(1);
    });
});
