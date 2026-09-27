import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Shop from '../systems/board/Shop.js';
import * as Charges from '../systems/board/Charges.js';
import * as WorkCheck from '../systems/board/WorkCheck.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { auditLifecycleBlocks } from '../systems/core/lifecycleAudit.js';
import { SKILLS } from '../config/registries/skillRegistry.js';
import { derivedTokenType } from '../config/registries/tokenTypeDerivation.js';

/**
 * Token Lifecycle slice 7.6 — Explore, pinned from the SHIPPED data (authored
 * through the CMS, never by hand).
 *
 * The Oak Forest Map is no longer a Map that bursts: it is an ordinary
 * producer Token (DP-7, SP-54, SP-74). It is bought at the Shop, an Explore
 * hero works it, and each cycle SPENDS 1 Shrimp and 1 Torch from the Bank and
 * rolls a themed loot table. It has 5 charges and vanishes when they run out,
 * so it is bought again. No tool is needed.
 *
 * The numbers are placeholders (TL-5); this pins the shape of the chain.
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

const MAP = 'token_oak_forest_map';
const map = tokens[MAP];

describe('The Explore chain in shipped data (7.6)', () => {
    it('Beeswax Comb is a new live material', () => {
        expect(items.item_beeswax_comb).toMatchObject({ id: 'item_beeswax_comb', name: 'Beeswax Comb', type: 'material' });
    });

    it('the Oak Forest Map is a plain Token now: no Map link, so it cannot burst', () => {
        expect(map.mapId).toBeUndefined();
        expect(map.tokenType).toBe('resource');
        expect(derivedTokenType(map)).toBe('resource');
    });

    it('is worked with Explore, level 1, every 20 s, for 3 XP', () => {
        expect(map.requiresHero).toBe(true);
        expect(map.config).toMatchObject({ skill: 'explore', skillRequired: 1, cycleTimeMs: 20000, xp: 3 });
    });

    it('each cycle spends 1 Shrimp and 1 Torch (SP-74)', () => {
        expect(map.config.inputs).toEqual([
            { itemId: 'item_shrimp', quantity: 1 },
            { itemId: 'item_torch', quantity: 1 },
        ]);
    });

    it('rolls a themed loot table, with a rare Beeswax Comb', () => {
        expect(map.config.outputs.map((o) => [o.itemId, o.chance, o.minQty, o.maxQty])).toEqual([
            ['item_oak_wood', 100, 2, 4],
            ['item_oak_seed', 40, 1, 1],
            ['item_apple_seed', 25, 1, 1],
            ['item_wheat_seed', 25, 1, 1],
            ['item_copper_ore', 25, 1, 2],
            ['item_beeswax_comb', 5, 1, 1],
        ]);
    });

    it('has 5 charges, so it runs out and is bought again (SP-54)', () => {
        expect(map.uses).toBe(5);
    });

    it('needs no tool nearby (TL-2)', () => {
        expect(map.acceptedTokens || []).toEqual([]);
    });

    it('is sold at the Shop for 5 Oak Wood and 1 Torch, in the Explore section', () => {
        expect(map.shop).toEqual({
            price: [{ itemId: 'item_oak_wood', quantity: 5 }, { itemId: 'item_torch', quantity: 1 }],
            section: 'explore',
        });
    });

    it('is the only Map Token reworked (DP-9): the others keep their Map link and are not sold', () => {
        const others = Object.values(tokens).filter((t) => t.mapId);
        expect(others.length).toBeGreaterThan(0);
        for (const t of others) {
            expect(t.id).not.toBe(MAP);
            expect(t.shop, t.id).toBeUndefined();
        }
    });

    it('the lifecycle audit has nothing to say about it', () => {
        const findings = auditLifecycleBlocks({ tokens, items, recipes, skills: SKILLS })
            .filter((f) => f.severity === 'error' || f.entityId === MAP || f.entityId === 'item_beeswax_comb');
        expect(findings).toEqual([]);
    });
});

describe('The Oak Forest Map on the mat', () => {
    beforeEach(() => {
        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        TileModifiers.clearAll();
        TileModifiers.init();
        EngineBootstrap.createDefaultGameData();
        // The Hall alone and an empty Bank: a new game minus the starter set and
        // opening items (Token Lifecycle 10.1), which these tests do not count.
        for (const t of BoardState.tokens()) if (t.typeId !== 'token_guild_hall') BoardState.removeToken(t.id);
        GameState.state.inventory.items = {};
    });

    afterEach(() => {
        TileModifiers.teardown();
    });

    const buyOne = () => {
        InventoryManager.addItem('item_oak_wood', 5);
        InventoryManager.addItem('item_torch', 1);
        const result = Shop.buy(MAP);
        expect(result.success).toBe(true);
        return BoardState.tokens().find((t) => t.typeId === MAP);
    };

    it('is bought with its price and lands with 5 charges', () => {
        const instance = buyOne();
        expect(instance).toBeTruthy();
        expect(instance.usesRemaining).toBe(5);
        expect(InventoryManager.getItemCount('item_oak_wood')).toBe(0);
        expect(InventoryManager.getItemCount('item_torch')).toBe(0);
    });

    it('without a Torch it waits, and says it is missing inputs', () => {
        const instance = buyOne();
        InventoryManager.addItem('item_shrimp', 3);
        const { reason, inputCheck } = WorkCheck.fixableReason(instance.id, instance);
        expect(reason).toBe(ALERT.INPUTS);
        expect(inputCheck.ok).toBe(false);
    });

    it('with supplies it can run, each cycle takes one charge, and it vanishes when spent', () => {
        const instance = buyOne();
        InventoryManager.addItem('item_shrimp', 5);
        InventoryManager.addItem('item_torch', 5);
        expect(WorkCheck.fixableReason(instance.id, instance).reason).toBeNull();

        for (let i = 0; i < 5; i++) {
            const { io } = WorkCheck.fixableReason(instance.id, instance);
            const plan = Charges.planCycle(instance.id, instance, io);
            expect(plan.debits.map((d) => [d.id, d.amount])).toEqual([[instance.id, 1]]);
            Charges.commitPlan(plan);
        }
        expect(BoardState.tokens().some((t) => t.id === instance.id)).toBe(false);
    });
});
