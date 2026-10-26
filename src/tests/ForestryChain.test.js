import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { familyOf } from '../systems/board/SpawnerSystem.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';
import { migrateSkillIdsIn, migrateRecipeList } from '../systems/effects/skillIdMigration.js';
import { expandBearer } from '../systems/effects/effectLibrary.js';

/**
 * Token Lifecycle slices 7.0 and 7.1 — the Forestry (formerly Logging) chain,
 * pinned from the SHIPPED data (authored through the CMS, never by hand).
 *
 * ⚠️ Read through the skill-id migration, exactly as the game's loaders read
 * it, so these pass both before and after the owner's Sync writes `forestry`
 * over `logging` in `data/`.
 */

const DATA = path.resolve(__dirname, '../../data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const tokens = migrateSkillIdsIn(read('tokens.json'));
const items = migrateSkillIdsIn(read('items.json'));
const recipes = migrateRecipeList(read('tokenRecipes.json'));
// Expanded for the audit, as the game and the CMS Economy Audit read them (a station's rules live
// in the effect library).
const effects = read('effects.json');
const expanded = Object.fromEntries(Object.entries(tokens).map(([id, t]) => [id, expandBearer(t, effects)]));

const forest = tokens.token_oak_forest;
const sapling = tokens.token_oak_sapling;
const tree = tokens.token_oak_tree;
const stump = tokens.token_oak_stump;
const hall = tokens.token_guild_hall;

describe('The Forestry chain in shipped data (7.0, 7.1)', () => {
    it('Oak Seedling is a live item', () => {
        expect(items.item_oak_seedling).toMatchObject({ id: 'item_oak_seedling', name: 'Oak Seedling' });
    });

    it('the Oak Forest is a spawner of saplings within its reach that pays one Oak Seedling per spawn', () => {
        expect(forest.spawner).toEqual({
            spawns: [{ typeId: 'token_oak_sapling', weight: 1 }],
            allowance: 5,
            intervalMs: 20000,
            upkeep: [{ itemId: 'item_oak_seedling', quantity: 1 }],
            withinReach: true,
        });
        expect(forest.tokenType).toBe('spawner');
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

    it('an Oak Sapling grows into an Oak Tree in 150 s and has no work cycle', () => {
        expect(sapling.grows).toEqual({ into: 'token_oak_tree', afterMs: 150000 });
        expect(sapling.config).toBeNull();
    });

    it('a felled Oak Tree regrows into an Oak Stump, which grows a new sapling with a Forest in reach', () => {
        expect(tree.staysPut).toBe(true);
        expect(tree.respawn).toEqual({ mode: 'regrow', into: 'token_oak_stump' });
        expect(stump.grows).toEqual({
            into: 'token_oak_sapling', afterMs: 150000, needsNearby: ['token_oak_forest'],
            cost: [{ itemId: 'item_oak_seedling', quantity: 1 }],
        });
    });

    it('the Forest family is sapling, tree, then stump', () => {
        expect(familyOf('token_oak_forest')).toEqual(['token_oak_sapling', 'token_oak_tree', 'token_oak_stump']);
    });

    it('an Oak Tree is felled with Forestry for Oak Wood and a 20% Oak Seedling, and runs out', () => {
        expect(tree.config.skill).toBe('forestry');
        const byItem = Object.fromEntries(tree.config.outputs.map((o) => [o.itemId, o]));
        expect(byItem.item_oak_wood.chance).toBe(100);
        expect(byItem.item_oak_seedling.chance).toBe(20);
        expect(tree.uses).toBe(5);   // Q9 pacing: was 10
    });

    it('no Token in the chain needs a tool nearby (TL-2)', () => {
        for (const def of [forest, sapling, tree, stump]) expect(def.acceptedTokens || []).toEqual([]);
    });

    it('the Guild Hall trickles an Oak Seedling every 5 minutes (SP-66)', () => {
        // Other chains add their own seed lines (7.4: Wheat and Apple Seed).
        expect(hall.trickle).toContainEqual({ itemId: 'item_oak_seedling', quantity: 1, everyMs: 300000 });
        expect(hall.trickle.filter((t) => t.itemId === 'item_oak_seedling')).toHaveLength(1);
    });

    it('the lifecycle audit has nothing to say about the chain', () => {
        // Scoped to this chain: other chains carry allowed warnings (7.2's
        // free mines). Errors anywhere still fail.
        const ids = new Set(['token_oak_forest', 'token_oak_sapling', 'token_oak_tree', 'token_oak_stump', 'token_guild_hall']);
        const findings = auditLifecycleBlocks({ tokens: expanded, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        expect(findings).toEqual([]);
    });
});
