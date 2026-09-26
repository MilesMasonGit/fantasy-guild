import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';

/**
 * Token Lifecycle slice 7.3 — the Fishing chain, pinned from the SHIPPED data
 * (authored through the CMS, never by hand).
 *
 * Coast (sold at the Shop) → after 2 minutes turns into a Shrimp Coast → a hero
 * fishes Raw Shrimp from it → after 1 minute it turns back into a Coast (a
 * cycle in progress is lost, SP-51) → and again. No spawns, so no cap and no
 * upkeep. No fishing net (TL-2).
 *
 * The numbers are placeholders (TL-5); this pins the shape of the chain.
 */

const DATA = path.resolve(__dirname, '../../data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const tokens = read('tokens.json');
const items = read('items.json');
const recipes = read('tokenRecipes.json');

const coast = tokens.token_coast;
const shrimpCoast = tokens.token_shrimp_coast;

describe('The Fishing chain in shipped data (7.3)', () => {
    it('the Coast turns into a Shrimp Coast every 2 minutes, for 1 minute', () => {
        expect(coast.turns).toEqual({
            into: [{ typeId: 'token_shrimp_coast', weight: 1 }],
            everyMs: 120000,
            lastsMs: 60000,
        });
    });

    it('the Coast is sold at the Shop for 10 Oak Wood, in the Fishing section', () => {
        expect(coast.shop).toEqual({ price: [{ itemId: 'item_oak_wood', quantity: 10 }], section: 'fishing' });
    });

    it('the Coast keeps its existing rules and is not worked directly', () => {
        expect(coast.effects.map((e) => e.effectId)).toEqual(['effect_work_time_bonus', 'effect_placement_limit']);
        expect(coast.config).toBeNull();
        expect(coast.spawner).toBeUndefined();
    });

    it('the Shrimp Coast is fished for Raw Shrimp, with no net needed', () => {
        expect(shrimpCoast.config.skill).toBe('fishing');
        expect(shrimpCoast.config.skillRequired).toBe(1);
        expect(shrimpCoast.config.outputs.map((o) => o.itemId)).toEqual(['item_raw_shrimp']);
        expect(shrimpCoast.acceptedTokens || []).toEqual([]);
    });

    it('the Shrimp Coast has no timed block of its own (it turns back by the Coast\'s clock)', () => {
        expect(shrimpCoast.turns).toBeUndefined();
        expect(shrimpCoast.shop).toBeUndefined();
    });

    it('the lifecycle audit has nothing to say about the chain', () => {
        const ids = new Set(['token_coast', 'token_shrimp_coast']);
        const findings = auditLifecycleBlocks({ tokens, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        expect(findings).toEqual([]);
    });
});
