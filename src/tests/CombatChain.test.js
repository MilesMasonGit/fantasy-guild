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
import { getTokenType } from '../config/registries/tokenRegistry.js';

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
const tokens = read('tokens.json');
const items = read('items.json');
const recipes = read('tokenRecipes.json');

const CAMP = 'token_goblin_camp';
const GOBLIN = 'token_goblin';
const CHIEF = 'token_goblin_chief';

describe('The Combat chain in shipped data (7.7)', () => {
    const camp = tokens[CAMP];
    const goblin = tokens[GOBLIN];
    const chief = tokens[CHIEF];

    it('the three Tokens exist under their names', () => {
        expect(camp).toMatchObject({ id: CAMP, name: 'Goblin Camp' });
        expect(goblin).toMatchObject({ id: GOBLIN, name: 'Goblin' });
        expect(chief).toMatchObject({ id: CHIEF, name: 'Goblin Chief' });
    });

    it('the camp spawns Goblins (95) and Chiefs (5), 3 at a time, every 30 s, with no upkeep', () => {
        expect(camp.spawner).toEqual({
            spawns: [{ typeId: GOBLIN, weight: 95 }, { typeId: CHIEF, weight: 5 }],
            allowance: 3,
            intervalMs: 30000,
            upkeep: [],
        });
        expect(camp.tokenType).toBe('spawner');
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

    it('its family is its whole weighted list: Goblins and Chiefs share one cap (DP-4)', () => {
        expect(SpawnerSystem.familyOf(CAMP)).toEqual([GOBLIN, CHIEF]);
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

    // budgetScale 0.3: at the full level-1 budget an unarmed Melee 1 hero (all
    // this build can make) lost to a single Goblin in the game; at 0.3 it wins
    // steadily. Placeholder numbers.
    it('a Goblin is a level 1 pushover with one charge, so a kill clears it and the camp spawns again', () => {
        expect(goblin.enemy).toEqual({ level: 1, style: 'melee', budgetScale: 0.3, hostile: true });
        expect(goblin.uses).toBe(1);
    });

    it('a Goblin drops Bones, and sometimes Copper Ore', () => {
        expect(enemyDropsOf(goblin)).toEqual([
            { itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 },
            { itemId: 'item_copper_ore', chance: 30, minQty: 1, maxQty: 1 },
        ]);
    });

    // Two charges are two fights back to back, with no rest for the hero between.
    it('a Chief is tougher: higher level, twice the budget and two charges (SP-38)', () => {
        expect(chief.enemy).toEqual({ level: 3, style: 'melee', budgetScale: 0.6, hostile: true });
        expect(chief.uses).toBe(2);
        const g = enemyProfileOf(goblin);
        const c = enemyProfileOf(chief);
        expect(c.hp).toBeGreaterThan(g.hp);
        expect(c.maxDamage).toBeGreaterThan(g.maxDamage);
        expect(c.attackSkill).toBeGreaterThan(g.attackSkill);
        expect(c.defenceSkill).toBeGreaterThan(g.defenceSkill);
        expect(c.xpAwarded).toBeGreaterThan(g.xpAwarded);
    });

    it('a Chief drops better loot: Copper Ingots, Bones and sometimes a Beeswax Comb', () => {
        expect(enemyDropsOf(chief)).toEqual([
            { itemId: 'item_copper_ingot', chance: 100, minQty: 1, maxQty: 2 },
            { itemId: 'item_bones', chance: 100, minQty: 1, maxQty: 1 },
            { itemId: 'item_beeswax_comb', chance: 25, minQty: 1, maxQty: 1 },
        ]);
    });

    it('the lifecycle audit says only that the camp spawns for free (allowed, SP-70)', () => {
        const ids = new Set([CAMP, GOBLIN, CHIEF]);
        const findings = auditLifecycleBlocks({ tokens, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || ids.has(f.entityId));
        expect(findings.map((f) => [f.severity, f.entityId, f.field])).toEqual([
            ['warning', CAMP, 'spawner.upkeep'],
        ]);
    });
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
    const count = (typeId) => BoardState.tokens().filter((t) => t.typeId === typeId).length;
    const always = (value) => () => value;

    it('is bought with its price', () => {
        expect(buyCamp()).toBeTruthy();
        expect(InventoryManager.getItemCount('item_stone')).toBe(0);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(0);
    });

    it('a low roll spawns a Goblin and a high roll a Chief, both from the one camp', () => {
        const camp = buyCamp();
        const def = getTokenType(CAMP);
        expect(SpawnerSystem.attemptSpawn(camp, def, always(0.1))).toBe(camp);
        expect(SpawnerSystem.attemptSpawn(camp, def, always(0.99))).toBe(camp);
        expect(count(GOBLIN)).toBe(1);
        expect(count(CHIEF)).toBe(1);
    });

    it('Goblins and Chiefs count against the same cap of 3', () => {
        const camp = buyCamp();
        const def = getTokenType(CAMP);
        SpawnerSystem.attemptSpawn(camp, def, always(0.99));   // a Chief
        SpawnerSystem.attemptSpawn(camp, def, always(0.1));    // a Goblin
        SpawnerSystem.attemptSpawn(camp, def, always(0.1));    // a Goblin
        expect(SpawnerSystem.spawnerStatus(camp.id)).toMatchObject({ state: 'at_cap', count: 3, cap: 3 });
        expect(SpawnerSystem.attemptSpawn(camp, def, always(0.1))).toBeNull();
        expect(count(GOBLIN) + count(CHIEF)).toBe(3);
    });

    it('spawns for free: nothing is taken from the Bank', () => {
        const camp = buyCamp();
        InventoryManager.addItem('item_oak_wood', 5);
        SpawnerSystem.attemptSpawn(camp, getTokenType(CAMP), always(0.1));
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(5);
    });

    it('a spawned enemy lands with its charges and is marked spawned', () => {
        const camp = buyCamp();
        SpawnerSystem.attemptSpawn(camp, getTokenType(CAMP), always(0.99));
        const chiefToken = BoardState.tokens().find((t) => t.typeId === CHIEF);
        expect(chiefToken.usesRemaining).toBe(2);
        expect(BoardState.originOf(chiefToken)).toBe('spawned');
    });
});
