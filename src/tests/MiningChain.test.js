import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { familyOf } from '../systems/board/SpawnerSystem.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';
import { expandBearer } from '../systems/effects/effectLibrary.js';

/**
 * Token Lifecycle slice 7.2 — the Mining chain, pinned from the SHIPPED data
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

// The Copper and Coal Mines stopped spawning veins once the Starter Camp and
// the Mountain map placed veins of their own; they stay supports (a 25 % double
// drop on the veins in reach). The Quarry still spawns its outcrops.
const CHAIN = [
    { mine: 'token_copper_mine', name: 'Copper Mine', worked: 'token_copper_ore_vein', item: 'item_copper_ore', spawns: false },
    { mine: 'token_coal_mine', name: 'Coal Mine', worked: 'token_coal_vein', item: 'item_coal', spawns: false },
    { mine: 'token_quarry', name: 'Quarry', worked: 'token_stone_outcrop', item: 'item_stone', spawns: true },
];

describe('The Mining chain in shipped data (7.2)', () => {
    it('Stone is a live item', () => {
        expect(items.item_stone).toMatchObject({ id: 'item_stone', name: 'Stone' });
    });

    it('the Stone Outcrop is a new workable Token', () => {
        expect(tokens.token_stone_outcrop).toMatchObject({ id: 'token_stone_outcrop', name: 'Stone Outcrop' });
    });

    for (const { mine, name, worked, item, spawns } of CHAIN) {
        describe(name, () => {
            const def = tokens[mine];
            const vein = tokens[worked];

            if (spawns) {
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
            } else {
                it(`spawns nothing: it is a support, doubling ${item} 25 % of the time on the ${worked} in reach`, () => {
                    expect(def.name).toBe(name);
                    expect(def.spawner).toBeUndefined();
                    expect(def.tokenType).toBe('buff');
                    const statements = (def.effects || []).flatMap((ref) => effects[ref.effectId].statements);
                    expect(statements).toEqual([expect.objectContaining({
                        keyword: 'provides',
                        payload: expect.objectContaining({ type: 'DOUBLE_DROP', value: 25, category: item }),
                        to: { mode: 'id', value: worked },
                        reach: 'nearby',
                    })]);
                });
            }

            it('is not worked directly', () => {
                expect(def.config).toBeNull();
                expect(def.requiresHero).toBe(false);
            });

            it('is not sold: it is built on a Wood Foundation', () => {
                expect(def.shop).toBeUndefined();
                const build = recipes.find((r) => r.outputs?.some((o) => o.tokenId === mine));
                expect(build.skill).toBe('construction');
                expect(build.foundationKinds).toEqual(['wood']);
            });

            it(spawns ? 'its family is just the Token it spawns (no growth stage)' : 'has no family: it spawns nothing', () => {
                expect(familyOf(mine)).toEqual(spawns ? [worked] : []);
            });

            it(`what it spawns is mined for ${item}, needs a pickaxe in hand (any tier), no nearby Token, and rests 60 s to refill`, () => {
                expect(vein.config.skill).toBe('mining');
                expect(vein.config.skillRequired).toBe(1);
                expect(vein.config.outputs.map((o) => o.itemId)).toEqual([item]);
                expect(vein.config.outputs[0].chance).toBe(100);
                expect(vein.needsTool).toEqual({ kind: 'pickaxe', minTier: 1 });
                expect(vein.acceptedTokens || []).toEqual([]);
                expect(vein.uses).toBe(5);
                expect(vein.staysPut).toBe(true);
                expect(vein.respawn).toMatchObject({ mode: 'refill', afterMs: 60000 });
            });

            it('what it spawns is not sold at the Shop itself', () => {
                expect(vein.shop).toBeUndefined();
            });
        });
    }

    it('the lifecycle audit has no errors about the chain', () => {
        const ids = new Set(CHAIN.flatMap((c) => [c.mine, c.worked]));
        const findings = auditLifecycleBlocks({ tokens: expanded, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        // Only the allowed "spawns for free" warning (decided per Token), and
        // only the Quarry still spawns.
        expect(findings.map((f) => [f.severity, f.entityId, f.field]).sort()).toEqual(
            ['token_quarry']
                .map((id) => ['warning', id, 'spawner.upkeep']));
    });
});
