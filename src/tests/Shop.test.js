import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as MatCap from '../systems/board/MatCap.js';
import * as Shop from '../systems/board/Shop.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { setMatTuning, resetMatTuning } from '../config/matTuning.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { placeAt } from './fixtures/mat.js';

/**
 * Token Lifecycle slice 5.1 — **the Shop** (SP-12, SP-13, SP-65, SP-67).
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const WOOD = 'item_oak_wood';

registerTokenTypes({
    fixture_shop_forest: {
        id: 'fixture_shop_forest', name: 'Fixture Oak Forest', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 10 }], section: 'logging' }
    },
    fixture_shop_bench: {
        id: 'fixture_shop_bench', name: 'Fixture Bench', size: 1,
        shop: { price: [{ itemId: WOOD, quantity: 2 }, { itemId: 'item_stone', quantity: 1 }], section: 'general' }
    },
    fixture_not_sold: { id: 'fixture_not_sold', name: 'Fixture Not Sold', size: 1 }
});

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
    resetMatTuning();
});

const hall = () => BoardState.tokens().find(t => t.typeId === 'token_guild_hall');
const onMat = (typeId) => BoardState.tokens().filter(t => t.typeId === typeId);

describe('the catalogue', () => {
    it('lists only Tokens with a shop block, grouped by section, General last', () => {
        const groups = Shop.catalogue();
        const all = groups.flatMap(g => g.items.map(i => i.typeId));
        expect(all).toContain('fixture_shop_forest');
        expect(all).toContain('fixture_shop_bench');
        expect(all).not.toContain('fixture_not_sold');

        const logging = groups.find(g => g.section === 'logging');
        expect(logging.items.map(i => i.typeId)).toContain('fixture_shop_forest');
        expect(groups[groups.length - 1].section).toBe('general');
        expect(groups[groups.length - 1].name).toBe('General');
    });

    it('shows have / need against each price line', () => {
        InventoryManager.addItem(WOOD, 4);
        const [line] = Shop.priceLines('fixture_shop_forest');
        expect(line).toMatchObject({ itemId: WOOD, need: 10, have: 4, enough: false });
    });
});

describe('buying', () => {
    it('takes the price and lands the Token beside the Guild Hall as placed', () => {
        InventoryManager.addItem(WOOD, 12);
        const before = MatCap.placedCount();

        const result = Shop.buy('fixture_shop_forest');
        expect(result.success).toBe(true);
        expect(InventoryManager.getItemCount(WOOD)).toBe(2);

        const [forest] = onMat('fixture_shop_forest');
        expect(forest).toBeTruthy();
        expect(forest.origin).toBe('placed');
        expect(MatCap.placedCount()).toBe(before + 1);

        const h = hall();
        const dist = Math.hypot(forest.x - h.x, forest.y - h.y);
        expect(dist).toBeLessThan(400);
    });

    it('with too little wood it refuses, names what is missing, and takes nothing', () => {
        InventoryManager.addItem(WOOD, 7);
        const check = Shop.canBuy('fixture_shop_forest');
        expect(check.success).toBe(false);
        expect(check.reason).toMatch(/3× /);

        const result = Shop.buy('fixture_shop_forest');
        expect(result.success).toBe(false);
        expect(InventoryManager.getItemCount(WOOD)).toBe(7);
        expect(onMat('fixture_shop_forest')).toHaveLength(0);
    });

    it('is all or nothing across several items', () => {
        InventoryManager.addItem(WOOD, 5);
        const result = Shop.buy('fixture_shop_bench');
        expect(result.success).toBe(false);
        expect(InventoryManager.getItemCount(WOOD)).toBe(5);
    });

    it('is refused at the mat cap, and takes nothing', () => {
        InventoryManager.addItem(WOOD, 50);
        placeAt('fixture_not_sold', 100, 100);
        setMatTuning('matCap', MatCap.placedCount());
        expect(MatCap.matCap()).toBe(MatCap.placedCount());
        const result = Shop.buy('fixture_shop_forest');
        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/full/i);
        expect(InventoryManager.getItemCount(WOOD)).toBe(50);
    });

    it('spawned Tokens do not count toward the cap (SP-67)', () => {
        InventoryManager.addItem(WOOD, 10);
        setMatTuning('matCap', MatCap.placedCount() + 1);
        const spawned = BoardState.createTokenInstance('fixture_not_sold', 1, null, BoardState.ORIGIN.SPAWNED);
        BoardState.addToken(spawned, 100, 100);
        expect(Shop.buy('fixture_shop_forest').success).toBe(true);
    });

    it('refuses a Token that is not sold', () => {
        expect(Shop.buy('fixture_not_sold').success).toBe(false);
    });

    it('lands elsewhere on the mat when the area around the Hall is crowded (5.3)', () => {
        InventoryManager.addItem(WOOD, 25);
        const h = hall();
        const hallAt = { x: h.x, y: h.y };
        // Spawned Tokens packed 50 u apart out to 400 u round the Hall — far
        // past nudge reach — so no legal spot exists anywhere near it.
        let crowd = 0;
        for (let dx = -400; dx <= 400; dx += 50) {
            for (let dy = -400; dy <= 400; dy += 50) {
                if (Math.hypot(dx, dy) > 400) continue;
                const t = BoardState.createTokenInstance('fixture_not_sold', 1, null, BoardState.ORIGIN.SPAWNED);
                BoardState.addToken(t, h.x + dx, h.y + dy);
                crowd++;
            }
        }
        const crowdPoints = BoardState.tokens().filter(t => t.typeId === 'fixture_not_sold').map(t => `${t.x},${t.y}`);

        const result = Shop.buy('fixture_shop_forest');
        expect(result.success).toBe(true);
        expect(InventoryManager.getItemCount(WOOD)).toBe(15); // paid once

        const [forest] = onMat('fixture_shop_forest');
        expect(forest.origin).toBe('placed');
        expect(Math.hypot(forest.x - hallAt.x, forest.y - hallAt.y)).toBeGreaterThan(400);
        // Nothing was pushed: the Hall and every crowding Token stayed put.
        expect({ x: hall().x, y: hall().y }).toEqual(hallAt);
        expect(onMat('fixture_not_sold')).toHaveLength(crowd);
        expect(onMat('fixture_not_sold').map(t => `${t.x},${t.y}`)).toEqual(crowdPoints);
    });

    it('refuses on a mat with no legal spot anywhere, and takes nothing (5.3)', () => {
        InventoryManager.addItem(WOOD, 25);
        // The whole mat packed 50 u apart with spawned Tokens (not counted by the cap).
        for (let x = 0; x <= 2000; x += 50) {
            for (let y = 0; y <= 1400; y += 50) {
                const t = BoardState.createTokenInstance('fixture_not_sold', 1, null, BoardState.ORIGIN.SPAWNED);
                BoardState.addToken(t, x, y);
            }
        }
        expect(Shop.canBuy('fixture_shop_forest').success).toBe(true); // the cap is not the reason

        const result = Shop.buy('fixture_shop_forest');
        expect(result.success).toBe(false);
        expect(result.reason).toBe('The mat is full');
        expect(InventoryManager.getItemCount(WOOD)).toBe(25);
        expect(onMat('fixture_shop_forest')).toHaveLength(0);
    });

    it('reports placed Tokens against the cap', () => {
        placeAt('fixture_not_sold', 100, 100);
        const { placed, cap } = Shop.capStatus();
        expect(placed).toBe(MatCap.placedCount());
        expect(cap).toBe(MatCap.matCap());
    });
});

