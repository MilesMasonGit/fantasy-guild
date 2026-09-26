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

    it('reports placed Tokens against the cap', () => {
        placeAt('fixture_not_sold', 100, 100);
        const { placed, cap } = Shop.capStatus();
        expect(placed).toBe(MatCap.placedCount());
        expect(cap).toBe(MatCap.matCap());
    });
});

