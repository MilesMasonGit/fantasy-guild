import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Shop from '../systems/board/Shop.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';
import { enemyProfileOf, enemyDropsOf } from '../config/registries/enemyProfile.js';
import { getTokenType, registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { expandBearer } from '../systems/effects/effectLibrary.js';

/**
 * Token Lifecycle slice 7.7 — Combat, pinned from the SHIPPED data (authored
 * through the CMS, never by hand).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const DATA = path.resolve(__dirname, '../../data');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
// Expanded, as the game and the CMS Economy Audit audit them: a Field's Works-as rule and a
// station's Station rule live in the effect library.
const effects = read('effects.json');
const tokens = Object.fromEntries(Object.entries(read('tokens.json')).map(([id, t]) => [id, expandBearer(t, effects)]));
const items = read('items.json');
const recipes = read('tokenRecipes.json');

const CAMP = 'token_goblin_camp';
const GOBLIN = 'token_goblin';
const CHIEF = 'token_goblin_chief';
const TENT = 'token_chief_tent';
const MAP_DROPS = (chance) => ['map_forest', 'map_mountain', 'map_coast', 'map_meadow']
    .map((itemId) => ({ itemId, chance, minQty: 1, maxQty: 1 }));

describe('The Combat chain in shipped data (7.7)', () => {
    const camp = tokens[CAMP];
    const goblin = tokens[GOBLIN];
    const chief = tokens[CHIEF];

    const tent = tokens[TENT];

    it('the four Tokens exist under their names', () => {
        expect(camp).toMatchObject({ id: CAMP, name: 'Goblin Camp' });
        expect(goblin).toMatchObject({ id: GOBLIN, name: 'Goblin' });
        expect(chief).toMatchObject({ id: CHIEF, name: 'Goblin Chief' });
        expect(tent).toMatchObject({ id: TENT, name: "Chief's Tent" });
    });

    // The Chief became a boss with a tent of its own, so the camp (which the
    // Starter Camp places) never brings a level-20 Chief to a new game.
    it('the camp spawns only Goblins, 3 at a time, every 30 s, with no upkeep', () => {
        expect(camp.spawner).toEqual({
            spawns: [{ typeId: GOBLIN, weight: 1 }],
            allowance: 3,
            intervalMs: 30000,
            upkeep: [],
        });
        expect(camp.tokenType).toBe('spawner');
    });

    it("the Chief's Tent is a camp of one: a single Chief, back 5 min after it falls, with no upkeep", () => {
        expect(tent.spawner).toEqual({
            spawns: [{ typeId: CHIEF, weight: 1 }],
            allowance: 1,
            intervalMs: 300000,
            upkeep: [],
        });
        expect(tent.tokenType).toBe('spawner');
        expect(tent.config).toBeNull();
        expect(tent.requiresHero).toBe(false);
        expect(SpawnerSystem.familyOf(TENT)).toEqual([CHIEF]);
    });

    it('the camp is not worked or fought directly', () => {
        expect(camp.config).toBeNull();
        expect(camp.requiresHero).toBe(false);
        expect(camp.enemy).toBeUndefined();
    });

    it('the camp is sold at the Shop for 10 Stone and 10 Oak Wood, in the Melee section', () => {
        expect(camp.shop).toEqual({
            price: [{ itemId: 'item_stone', quantity: 10 }, { itemId: 'item_oak_wood', quantity: 10 }],
            section: 'melee',
        });
        expect(Shop.sectionName('melee')).toBe('Melee');
    });

    it('its family is its whole list: just the Goblins', () => {
        expect(SpawnerSystem.familyOf(CAMP)).toEqual([GOBLIN]);
    });

    it('both enemies are melee enemy Tokens that are not sold and need no tool', () => {
        for (const def of [goblin, chief]) {
            expect(def.tokenType).toBe('enemy');
            expect(def.enemy.style).toBe('melee');
            expect(def.requiresHero).toBe(true);
            expect(def.shop).toBeUndefined();
            expect(def.acceptedTokens || []).toEqual([]);
        }
    });

    // Its numbers come from the level table alone: no kinds, no older budget scale.
    it('a Goblin is a plain level 5 enemy with one charge, so a kill clears it and the camp spawns again', () => {
        expect(goblin.enemy).toEqual({ level: 5, style: 'melee', hostile: true });
        expect(goblin.uses).toBe(1);
    });

    it('a Goblin drops Bones, sometimes Copper Ore, and now and then a plane-1 map or modifier', () => {
        expect(enemyDropsOf(goblin)).toEqual([
            { itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 },
            { itemId: 'item_copper_ore', chance: 30, minQty: 1, maxQty: 1 },
            ...MAP_DROPS(1.5),
            { itemId: 'mod_rich_veins', chance: 1, minQty: 1, maxQty: 1 },
            { itemId: 'mod_goblin_camp', chance: 0.5, minQty: 1, maxQty: 1 },
            { itemId: 'mod_buried_copper', chance: 0.25, minQty: 1, maxQty: 1 },
        ]);
    });

    // A boss is beaten in one kill and fights only heroes sent at it (never
    // hostile); its typed hit sits one above what its level and kind fill.
    it('a Chief is a tougher boss: higher level, a Brute, one kill, a typed hit of 4', () => {
        expect(chief.enemy).toEqual({ level: 20, style: 'melee', kinds: ['brute'], boss: true, hit: 4 });
        expect(chief.uses).toBe(1);
        const g = enemyProfileOf(goblin);
        const c = enemyProfileOf(chief);
        expect(c.hp).toBeGreaterThan(g.hp);
        expect(c.level).toBeGreaterThan(g.level);
        expect(c.hit).toBeGreaterThan(g.hit);
        expect(c.xpAwarded).toBeGreaterThan(g.xpAwarded);
    });

    it('a Chief drops better loot: Copper Ingots, Bones, sometimes a Beeswax Comb, and the boss map drops', () => {
        expect(enemyDropsOf(chief).slice(0, 3)).toEqual([
            { itemId: 'item_copper_ingot', chance: 100, minQty: 1, maxQty: 2 },
            { itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 },
            { itemId: 'item_beeswax_comb', chance: 25, minQty: 1, maxQty: 1 },
        ]);
        // Its first kill always pays a Volcano Map (plane 2).
        expect(chief.config.outputs.find((o) => o.itemId === 'map_volcano'))
            .toMatchObject({ chance: 10, firstKill: true });
        const chiefMaps = enemyDropsOf(chief).map((d) => d.itemId).filter((id) => id.startsWith('map_'));
        expect(chiefMaps).toEqual(['map_forest', 'map_mountain', 'map_coast', 'map_meadow',
            'map_flower_meadow', 'map_cherry_grove', 'map_volcano', 'map_yellowstone']);
    });

    it('the lifecycle audit says only that the camp and the tent spawn for free (allowed, SP-70)', () => {
        const ids = new Set([CAMP, GOBLIN, CHIEF, TENT]);
        const findings = auditLifecycleBlocks({ tokens, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        expect(findings.map((f) => [f.severity, f.entityId, f.field]).sort()).toEqual([
            ['warning', TENT, 'spawner.upkeep'],
            ['warning', CAMP, 'spawner.upkeep'],
        ].sort());
    });
});

/**
 * The weighted-family mechanism (two kinds from one camp, one shared cap, a
 * spawned enemy keeping its charges) on a fixture: the shipped camp now spawns
 * one kind only.
 */
const MIXED = 'fx_cc_mixed_camp';
const BRUTE = 'fx_cc_brute';
registerTokenTypes({
    [BRUTE]: { ...read('tokens.json')[CHIEF], id: BRUTE, name: 'Fixture Brute', uses: 2 },
    [MIXED]: {
        ...read('tokens.json')[CAMP], id: MIXED, name: 'Fixture Mixed Camp', shop: undefined,
        spawner: {
            spawns: [{ typeId: GOBLIN, weight: 95 }, { typeId: BRUTE, weight: 5 }],
            allowance: 3, intervalMs: 30000, upkeep: [],
        },
    },
});

describe('The Goblin Camp on the mat', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        TileModifiers.clearAll();
        TileModifiers.init();
        SpawnerSystem.resetAlerts();
        EngineBootstrap.createDefaultGameData();
        // The Hall alone and an empty Bank: a new game minus the starter set and
        // opening items (Token Lifecycle 10.1), which these tests do not count.
        for (const t of BoardState.tokens()) if (t.typeId !== 'token_guild_hall') BoardState.removeToken(t.id);
        GameState.state.inventory.items = {};
    });

    afterEach(() => {
        TileModifiers.teardown();
    });

    const buyCamp = () => {
        InventoryManager.addItem('item_stone', 10);
        InventoryManager.addItem('item_oak_wood', 10);
        const result = Shop.buy(CAMP);
        expect(result.success).toBe(true);
        return BoardState.tokens().find((t) => t.typeId === CAMP);
    };
    const placeMixed = () => {
        const inst = BoardState.createTokenInstance(MIXED);
        BoardState.addToken(inst, 600, 400);
        return BoardState.getTokenById(inst.id);
    };
    const count = (typeId) => BoardState.tokens().filter((t) => t.typeId === typeId).length;
    const always = (value) => () => value;

    it('is bought with its price', () => {
        expect(buyCamp()).toBeTruthy();
        expect(InventoryManager.getItemCount('item_stone')).toBe(0);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(0);
    });

    it('the shipped camp spawns a Goblin whatever the roll, never a Chief', () => {
        const camp = buyCamp();
        const def = getTokenType(CAMP);
        expect(SpawnerSystem.attemptSpawn(camp, def, always(0.1))).toBe(camp);
        expect(SpawnerSystem.attemptSpawn(camp, def, always(0.99))).toBe(camp);
        expect(count(GOBLIN)).toBe(2);
        expect(count(CHIEF)).toBe(0);
    });

    it('the shipped camp counts its Goblins against a cap of 3', () => {
        const camp = buyCamp();
        const def = getTokenType(CAMP);
        for (let i = 0; i < 3; i++) SpawnerSystem.attemptSpawn(camp, def, always(0.5));
        expect(SpawnerSystem.spawnerStatus(camp.id)).toMatchObject({ state: 'at_cap', count: 3, cap: 3 });
        expect(SpawnerSystem.attemptSpawn(camp, def, always(0.5))).toBeNull();
        expect(count(GOBLIN)).toBe(3);
    });

    it('a weighted camp: a low roll spawns a Goblin and a high roll the rarer kind, both from the one camp', () => {
        const camp = placeMixed();
        const def = getTokenType(MIXED);
        expect(SpawnerSystem.attemptSpawn(camp, def, always(0.1))).toBe(camp);
        expect(SpawnerSystem.attemptSpawn(camp, def, always(0.99))).toBe(camp);
        expect(count(GOBLIN)).toBe(1);
        expect(count(BRUTE)).toBe(1);
    });

    it("a weighted camp's kinds share one family and count against the same cap of 3 (DP-4)", () => {
        const camp = placeMixed();
        const def = getTokenType(MIXED);
        expect(SpawnerSystem.familyOf(MIXED)).toEqual([GOBLIN, BRUTE]);
        SpawnerSystem.attemptSpawn(camp, def, always(0.99));   // the rarer kind
        SpawnerSystem.attemptSpawn(camp, def, always(0.1));    // a Goblin
        SpawnerSystem.attemptSpawn(camp, def, always(0.1));    // a Goblin
        expect(SpawnerSystem.spawnerStatus(camp.id)).toMatchObject({ state: 'at_cap', count: 3, cap: 3 });
        expect(SpawnerSystem.attemptSpawn(camp, def, always(0.1))).toBeNull();
        expect(count(GOBLIN) + count(BRUTE)).toBe(3);
    });

    it('spawns for free: nothing is taken from the Bank', () => {
        const camp = buyCamp();
        InventoryManager.addItem('item_oak_wood', 5);
        SpawnerSystem.attemptSpawn(camp, getTokenType(CAMP), always(0.1));
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(5);
    });

    it('a spawned enemy lands with its charges and is marked spawned', () => {
        const camp = placeMixed();
        SpawnerSystem.attemptSpawn(camp, getTokenType(MIXED), always(0.99));
        const brute = BoardState.tokens().find((t) => t.typeId === BRUTE);
        expect(brute.usesRemaining).toBe(2);
        expect(BoardState.originOf(brute)).toBe('spawned');
    });
});
