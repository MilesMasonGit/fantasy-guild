import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { familyOf } from '../systems/board/SpawnerSystem.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';

/**
 * Token Lifecycle slice 7.2 — the Mining chain, pinned from the SHIPPED data
 * (authored through the CMS, never by hand).
 */

const DATA = path.resolve(__dirname, '../../data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const tokens = read('tokens.json');
const items = read('items.json');
const recipes = read('tokenRecipes.json');

const CHAIN = [
    { mine: 'token_copper_mine', name: 'Copper Mine', worked: 'token_copper_ore_vein', item: 'item_copper_ore' },
    { mine: 'token_coal_mine', name: 'Coal Mine', worked: 'token_coal_vein', item: 'item_coal' },
    { mine: 'token_quarry', name: 'Quarry', worked: 'token_stone_outcrop', item: 'item_stone' },
];

describe('The Mining chain in shipped data (7.2)', () => {
    it('Stone is a live item', () => {
        expect(items.item_stone).toMatchObject({ id: 'item_stone', name: 'Stone' });
    });

    it('the Stone Outcrop is a new workable Token', () => {
        expect(tokens.token_stone_outcrop).toMatchObject({ id: 'token_stone_outcrop', name: 'Stone Outcrop' });
    });

    for (const { mine, name, worked, item } of CHAIN) {
        describe(name, () => {
            const def = tokens[mine];
            const vein = tokens[worked];

            it('is a spawner of one kind, allowance 3, every 30 s, with no upkeep', () => {
                expect(def.name).toBe(name);
                expect(def.spawner).toEqual({
                    spawns: [{ typeId: worked, weight: 1 }],
                    allowance: 3,
                    intervalMs: 30000,
                    upkeep: [],
                });
                expect(def.tokenType).toBe('spawner');
            });

            it('is not worked directly', () => {
                expect(def.config).toBeNull();
                expect(def.requiresHero).toBe(false);
            });

            it('is sold at the Shop for 15 Oak Wood, in the Mining section', () => {
                expect(def.shop).toEqual({ price: [{ itemId: 'item_oak_wood', quantity: 15 }], section: 'mining' });
            });

            it('its family is just the Token it spawns (no growth stage)', () => {
                expect(familyOf(mine)).toEqual([worked]);
            });

            it(`what it spawns is mined for ${item}, needs no pickaxe, and runs out`, () => {
                expect(vein.config.skill).toBe('mining');
                expect(vein.config.skillRequired).toBe(1);
                expect(vein.config.outputs.map((o) => o.itemId)).toEqual([item]);
                expect(vein.config.outputs[0].chance).toBe(100);
                expect(vein.acceptedTokens || []).toEqual([]);
                expect(vein.uses).toBe(5);   // Q9 pacing: was 10
            });

            it('what it spawns is not sold at the Shop itself', () => {
                expect(vein.shop).toBeUndefined();
            });
        });
    }

    it('the lifecycle audit has no errors about the chain', () => {
        const ids = new Set(CHAIN.flatMap((c) => [c.mine, c.worked]));
        const findings = auditLifecycleBlocks({ tokens, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        // Only the allowed "spawns for free" warning ( is decided per Token).
        expect(findings.map((f) => [f.severity, f.entityId, f.field]).sort()).toEqual(
            ['token_coal_mine', 'token_copper_mine', 'token_quarry']
                .map((id) => ['warning', id, 'spawner.upkeep']));
    });
});
