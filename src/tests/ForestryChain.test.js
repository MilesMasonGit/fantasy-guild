import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { familyOf } from '../systems/board/SpawnerSystem.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';
import { expandBearer } from '../systems/effects/effectLibrary.js';

/**
 * The Forestry chain, pinned from the SHIPPED data (authored through the CMS,
 * never by hand).
 */

const DATA = path.resolve(__dirname, '../../data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const tokens = read('tokens.json');
const items = read('items.json');
const recipes = read('tokenRecipes.json');
// Expanded for the audit, as the game and the CMS Economy Audit read them (a station's rules live
// in the effect library).
const effects = read('effects.json');
const expanded = Object.fromEntries(Object.entries(tokens).map(([id, t]) => [id, expandBearer(t, effects)]));

const forest = tokens.token_oak_forest;
const tree = tokens.token_oak_tree;
const stump = tokens.token_oak_stump;
const hall = tokens.token_guild_hall;

describe('The Forestry chain in shipped data (7.0, 7.1)', () => {
    it('Oak Seedling is a live item', () => {
        expect(items.item_oak_seedling).toMatchObject({ id: 'item_oak_seedling', name: 'Oak Seedling' });
    });

    it('the Oak Forest is a spawner of whole Oak Trees within its reach, for free, and speeds no growth', () => {
        expect(forest.spawner).toEqual({
            spawns: [{ typeId: 'token_oak_tree', weight: 1 }],
            allowance: 4,
            intervalMs: 20000,
            withinReach: true,
        });
        expect(forest.tokenType).toBe('spawner');
        expect(forest.effects ?? []).toEqual([]);
    });

    it('the Oak Forest is no longer worked directly', () => {
        expect(forest.config).toBeNull();
        expect(forest.requiresHero).toBe(false);
    });

    it('the Oak Forest is not sold: it is built on Farmland from 3 Oak Seedlings', () => {
        expect(forest.shop).toBeUndefined();
        const build = recipes.find((r) => r.outputs?.some((o) => o.tokenId === 'token_oak_forest'));
        expect(build.foundationKinds).toEqual(['farmland']);
        expect(build.inputs).toEqual([{ itemId: 'item_oak_seedling', quantity: 3 }]);
    });

    it('a felled Oak Tree regrows into an Oak Stump, which grows back into its Tree in 300 s with a Forest in reach, for free', () => {
        expect(tree.staysPut).toBe(true);
        expect(tree.respawn).toEqual({ mode: 'regrow', into: 'token_oak_stump' });
        expect(stump.grows).toEqual({
            into: 'token_oak_tree', afterMs: 300000, needsNearby: ['token_oak_forest'],
        });
    });

    it('the Forest family is tree, then stump', () => {
        expect(familyOf('token_oak_forest')).toEqual(['token_oak_tree', 'token_oak_stump']);
    });

    it('an Oak Tree is felled with Forestry for Oak Wood and a 20% Oak Seedling, and runs out', () => {
        expect(tree.config.skill).toBe('forestry');
        const byItem = Object.fromEntries(tree.config.outputs.map((o) => [o.itemId, o]));
        expect(byItem.item_oak_wood.chance).toBe(100);
        expect(byItem.item_oak_seedling.chance).toBe(20);
        expect(tree.uses).toBe(5);   // Q9 pacing: was 10
    });

    it('no Token in the chain needs a tool nearby (TL-2)', () => {
        for (const def of [forest, tree, stump]) expect(def.acceptedTokens || []).toEqual([]);
    });

    it('the Guild Hall trickles an Oak Seedling once a lap (SP-66)', () => {
        // Other chains add their own seed lines (7.4: Wheat and Apple Seed).
        expect(hall.trickle).toContainEqual({ itemId: 'item_oak_seedling', quantity: 1 });
        expect(hall.trickle.filter((t) => t.itemId === 'item_oak_seedling')).toHaveLength(1);
    });

    it('the lifecycle audit has nothing to say about the chain', () => {
        // Scoped to this chain: other chains carry allowed warnings (7.2's
        // free mines). Errors anywhere still fail.
        const ids = new Set(['token_oak_forest', 'token_oak_tree', 'token_oak_stump', 'token_guild_hall']);
        const findings = auditLifecycleBlocks({ tokens: expanded, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        expect(findings).toEqual([]);
    });
});
