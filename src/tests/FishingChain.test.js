import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';
import { expandBearer } from '../systems/effects/effectLibrary.js';
import { spotOf, arrivesByItself } from '../config/registries/fishingSpots.js';
import { poolForTool } from '../config/registries/catchPools.js';
import { STARTER_CAMP_GROUND } from '../systems/progression/ledger/engine.js';

/**
 * Token Lifecycle slice 7.3 — the Fishing chain, pinned from the SHIPPED data
 * (authored through the CMS, never by hand). Water is ground: a Fishing Spot drifts in on it by
 * itself, the Starter Camp's pond among it; a Trap there lands Raw Shrimp with no Bait, Raw Shrimp
 * makes Bait at the Bait Shed, and a Rod with Bait lands fish.
 */

const DATA = path.resolve(__dirname, '../../data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const tokens = read('tokens.json');
const items = read('items.json');
const recipes = read('tokenRecipes.json');

// Expanded for the audit, as the game and the CMS Economy Audit read them.
const effects = read('effects.json');
const expanded = Object.fromEntries(Object.entries(tokens).map(([id, t]) => [id, expandBearer(t, effects)]));

const spot = tokens.token_fishing_spot;
const dock = tokens.token_dock;
const shed = tokens.token_bait_shed;
/** The Starter Camp's pond, as the spot reads it: fresh water in a meadow. */
const POND = { water: STARTER_CAMP_GROUND.waters[0], biomes: [STARTER_CAMP_GROUND.biome] };
const landed = (p) => p.catches.map((c) => c.itemId);

describe('The Fishing chain in shipped data (7.3)', () => {
    it('the Fishing Spot is water, and never runs out', () => {
        expect(spot.turns).toBeUndefined();
        expect(spot.uses).toBeNull();
        expect(spot.tags).toContain('Water');
        expect(spot.standsOn).toEqual(['water']);
    });

    it('the Fishing Spot is not sold at the Shop nor laid by the Starter Camp: it drifts in on any water, the camp\'s pond among it', () => {
        expect(spot.shop).toBeUndefined();
        expect(read('starterCamp.json').tokens.filter((t) => spotOf(tokens[t.typeId]))).toEqual([]);
        const drifts = spotOf(spot);
        expect(arrivesByItself(drifts)).toBe(true);
        expect(drifts.water).toEqual(expect.arrayContaining(['sea', 'fresh']));
        expect(drifts.biomes).toEqual([]);
        expect(STARTER_CAMP_GROUND.waters).toContain('fresh');
        // No map places water as a Token any more.
        const waters = read('world.json').lines.find((l) => l.id === 'waters');
        expect([1, 2, 3].flatMap((n) => waters.origins[n])).toEqual([]);
    });

    it('the Fishing Spot is worked with Fishing, and its catch replaces its Outputs', () => {
        expect(spot.config).toMatchObject({ skill: 'fishing', skillRequired: 1, outputs: [] });
        expect(spot.spawner).toBeUndefined();
        expect(spot.effects).toBeUndefined();
    });

    it('on the Starter Camp\'s pond a Trap lands Raw Shrimp with no Bait, and a Rod with Bait lands fish', () => {
        const trap = poolForTool(spot, 'fishing_trap', POND);
        expect(landed(trap)).toEqual(['item_raw_shrimp']);
        expect(trap.bait).toBeNull();
        const rod = poolForTool(spot, 'fishing_rod', POND);
        expect(rod.bait).toBe('item_bait');
        expect(landed(rod)).toContain('item_trout');
        // The Trap and the Rod are starter tools, so the chain needs nothing first.
        expect(items.item_trap.tool).toMatchObject({ kind: 'fishing_trap', starter: true });
        expect(items.item_fishing_rod.tool).toMatchObject({ kind: 'fishing_rod', starter: true });
    });

    it('Raw Shrimp makes Bait: a Fishing recipe, at the Bait Shed', () => {
        const bait = recipes.find((r) => r.id === 'recipe_bait_from_raw_shrimp');
        expect(bait).toMatchObject({ skill: 'fishing', inputs: [{ itemId: 'item_raw_shrimp', quantity: 1 }] });
        expect(bait.outputs.map((o) => o.itemId)).toEqual(['item_bait']);
        expect(items.item_bait.equipSlot).toBe('consumable');
        expect(shed.effects.map((e) => effects[e.effectId].statements[0])).toEqual([
            expect.objectContaining({ keyword: 'station', payload: { skill: 'fishing' } })
        ]);
    });

    it('the Dock is a Foundation on the shore, sold at the Shop: the Bait Shed and the other fishing buildings are built on it', () => {
        expect(dock.config).toBeNull();
        expect(dock.foundation).toEqual({ kind: 'dock', skill: 'construction' });
        expect(dock.standsOn).toEqual(['shore']);
        expect(dock.shop).toMatchObject({ section: 'fishing' });
        const builtOnDock = recipes.filter((r) => r.foundationKinds?.includes('dock')).flatMap((r) => r.outputs.map((o) => o.tokenId));
        expect(builtOnDock).toContain('token_bait_shed');
        expect(builtOnDock).toContain('token_fishing_hut');
    });

    it('the lifecycle audit has nothing to say about the chain', () => {
        const ids = new Set(['token_fishing_spot', 'token_dock', 'token_bait_shed']);
        const findings = auditLifecycleBlocks({ tokens: expanded, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        expect(findings).toEqual([]);
    });
});
