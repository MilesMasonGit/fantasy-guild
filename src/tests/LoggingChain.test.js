import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { familyOf } from '../systems/board/SpawnerSystem.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';

/**
 * Token Lifecycle slices 7.0 and 7.1 — the Logging chain, pinned from the
 * SHIPPED data (authored through the CMS, never by hand).
 *
 * Oak Forest (shop) → spawns Oak Saplings, paying 1 Oak Seed each → a sapling
 * grows into an Oak Tree → the tree is logged for Oak Wood and sometimes an Oak
 * Seed, and runs out → the Forest spawns again. The Guild Hall trickles Oak
 * Seeds so a new game can never run out (SP-66). No axe anywhere (TL-2).
 *
 * The numbers are placeholders (TL-5); this pins the shape of the chain, and
 * the few numbers the roadmap's 7.1 row names.
 */

const DATA = path.resolve(__dirname, '../../data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const tokens = read('tokens.json');
const items = read('items.json');
const recipes = read('tokenRecipes.json');

const forest = tokens.token_oak_forest;
const sapling = tokens.token_oak_sapling;
const tree = tokens.token_oak_tree;
const hall = tokens.token_guild_hall;

describe('The Logging chain in shipped data (7.0, 7.1)', () => {
    it('Oak Seed is a live item', () => {
        expect(items.item_oak_seed).toMatchObject({ id: 'item_oak_seed', name: 'Oak Seed' });
    });

    it('the Oak Forest is a spawner of saplings that pays one Oak Seed per spawn', () => {
        expect(forest.spawner).toEqual({
            spawns: [{ typeId: 'token_oak_sapling', weight: 1 }],
            allowance: 5,
            intervalMs: 20000,
            upkeep: [{ itemId: 'item_oak_seed', quantity: 1 }],
        });
        expect(forest.tokenType).toBe('spawner');
    });

    it('the Oak Forest is no longer worked directly', () => {
        expect(forest.config).toBeNull();
        expect(forest.requiresHero).toBe(false);
    });

    it('the Oak Forest is sold at the Shop for Oak Wood, in the Logging section', () => {
        expect(forest.shop).toEqual({ price: [{ itemId: 'item_oak_wood', quantity: 10 }], section: 'logging' });
    });

    it('an Oak Sapling grows into an Oak Tree and has no work cycle', () => {
        expect(sapling.grows).toEqual({ into: 'token_oak_tree', afterMs: 30000 });
        expect(sapling.config).toBeNull();
    });

    it('the Forest family is sapling then tree', () => {
        expect(familyOf('token_oak_forest')).toEqual(['token_oak_sapling', 'token_oak_tree']);
    });

    it('an Oak Tree is logged for Oak Wood and a 20% Oak Seed, and runs out', () => {
        expect(tree.config.skill).toBe('logging');
        const byItem = Object.fromEntries(tree.config.outputs.map((o) => [o.itemId, o]));
        expect(byItem.item_oak_wood.chance).toBe(100);
        expect(byItem.item_oak_seed.chance).toBe(20);
        expect(tree.uses).toBe(10);
    });

    it('no Token in the chain needs a tool nearby (TL-2)', () => {
        for (const def of [forest, sapling, tree]) expect(def.acceptedTokens || []).toEqual([]);
    });

    it('the Guild Hall trickles an Oak Seed every 5 minutes (SP-66)', () => {
        // Other chains add their own seed lines (7.4: Wheat and Apple Seed).
        expect(hall.trickle).toContainEqual({ itemId: 'item_oak_seed', quantity: 1, everyMs: 300000 });
        expect(hall.trickle.filter((t) => t.itemId === 'item_oak_seed')).toHaveLength(1);
    });

    it('the lifecycle audit has nothing to say about the chain', () => {
        // Scoped to this chain: other chains carry allowed warnings (7.2's
        // free mines, SP-70). Errors anywhere still fail.
        const ids = new Set(['token_oak_forest', 'token_oak_sapling', 'token_oak_tree', 'token_guild_hall']);
        const findings = auditLifecycleBlocks({ tokens, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        expect(findings).toEqual([]);
    });
});
