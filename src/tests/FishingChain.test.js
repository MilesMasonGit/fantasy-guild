import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';
import { expandBearer } from '../systems/effects/effectLibrary.js';

/**
 * Token Lifecycle slice 7.3 — the Fishing chain, pinned from the SHIPPED data
 * (authored through the CMS, never by hand).
 */

const DATA = path.resolve(__dirname, '../../data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const tokens = read('tokens.json');
const items = read('items.json');
const recipes = read('tokenRecipes.json');

// Expanded for the audit, as the game and the CMS Economy Audit read them.
const effects = read('effects.json');
const expanded = Object.fromEntries(Object.entries(tokens).map(([id, t]) => [id, expandBearer(t, effects)]));

const coast = tokens.token_coast;
const dock = tokens.token_dock;
const pool = (tool, bait = undefined) => coast.catchPools.find((p) => p.tool === tool && p.bait === bait);
const landed = (p) => p.catches.map((c) => c.itemId);

describe('The Fishing chain in shipped data (7.3)', () => {
    it('the Coast no longer turns into a Shrimp Coast: it is water, and never runs out', () => {
        expect(coast.turns).toBeUndefined();
        expect(coast.uses).toBeNull();
        expect(coast.tags).toContain('Water');
    });

    it('the Coast is sold at the Shop for 10 Oak Wood, in the Fishing section', () => {
        expect(coast.shop).toEqual({ price: [{ itemId: 'item_oak_wood', quantity: 10 }], section: 'fishing' });
    });

    it('the Coast is worked with Fishing, keeps its placement limit, and its catch replaces its Outputs', () => {
        expect(coast.effects.map((e) => e.effectId)).toEqual(['effect_placement_limit']);
        expect(coast.config).toMatchObject({ skill: 'fishing', skillRequired: 1, outputs: [] });
        expect(coast.spawner).toBeUndefined();
    });

    it('a Fishing Rod catches fish at the Coast; a Trap catches Raw Shrimp, and Lobster with Worm Bait', () => {
        expect(landed(pool('fishing_rod'))).toEqual(['item_tropical_fish', 'item_salmon', 'item_swordfish']);
        expect(landed(pool('fishing_rod', 'item_shrimp_bait'))).toEqual(['item_tropical_fish', 'item_salmon', 'item_swordfish']);
        expect(landed(pool('fishing_trap'))).toEqual(['item_raw_shrimp']);
        expect(landed(pool('fishing_trap', 'item_worm_bait'))).toEqual(['item_raw_shrimp', 'item_lobster']);
    });

    it('the Dock is not worked: it speeds nearby water', () => {
        expect(dock.config).toBeNull();
        expect(dock.requiresHero).toBe(false);
        expect(dock.effects.map((e) => e.effectId)).toEqual(['effect_dock_speed']);
    });

    it('the lifecycle audit has nothing to say about the chain', () => {
        const ids = new Set(['token_coast', 'token_dock']);
        const findings = auditLifecycleBlocks({ tokens: expanded, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        expect(findings).toEqual([]);
    });
});
