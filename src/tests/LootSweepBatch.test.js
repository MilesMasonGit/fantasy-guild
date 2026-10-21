import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { SettingsManager } from '../systems/core/SettingsManager.js';
import './fixtures/fixtureItems.js';
import './fixtures/testTokens.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * ⭐ A loot sweep tells the Bank's listeners once per item, not once per pile. Whatever they
 * add up (the catch-up summary's "gained", the item stubs' "+N") comes out the same: each item's
 * one announcement carries the sum of what its piles put in, and the Bank's final count.
 */

/** Every `INVENTORY_UPDATED` payload published during `fn`, in order. */
function bankNews(fn) {
    const seen = [];
    const off = EventBus.subscribe(ENGINE_EVENTS.INVENTORY_UPDATED, (p) => seen.push(p));
    try { fn(); } finally { off(); }
    return seen;
}

/** Per item, what the payloads add up to: what the summary and the stubs count. */
function totals(news) {
    const out = {};
    for (const { itemId, added = 0, removed = 0 } of news) {
        if (!itemId) continue;
        out[itemId] ??= { added: 0, removed: 0 };
        out[itemId].added += added;
        out[itemId].removed += removed;
    }
    return out;
}

const bank = () => Object.fromEntries(Object.entries(GameState.state.inventory.items).map(([id, e]) => [id, e.quantity]));

function scatter() {
    for (let i = 0; i < 30; i++) SpriteLayer.addSprite('item', 'fixture_oak_wood', 1 + (i % 3), null);
    for (let i = 0; i < 10; i++) SpriteLayer.addSprite('item', 'fixture_glowcap', 2, null);
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
});

describe('a sweep announces the Bank once per item', () => {
    it('40 piles of two items: two announcements, each the sum of its piles and the final count', () => {
        scatter();
        const news = bankNews(() => SpriteLayer.collectAll());
        expect(news).toEqual([
            { itemId: 'fixture_oak_wood', amount: 60, added: 60 },
            { itemId: 'fixture_glowcap', amount: 20, added: 20 }
        ]);
        expect(SpriteLayer.getSprites()).toHaveLength(0);
    });

    it('batched and one by one, the Bank ends the same and every sum agrees', () => {
        scatter();
        const batched = bankNews(() => SpriteLayer.collectAll());
        const batchedBank = bank();

        GameState.initNew();
        InventoryManager.init();
        SpriteLayer.init();
        scatter();
        const oneByOne = bankNews(() => {
            for (const sprite of [...SpriteLayer.getSprites()]) SpriteLayer.collectSprite(sprite.id);
        });

        expect(oneByOne).toHaveLength(40);
        expect(batched).toHaveLength(2);
        expect(bank()).toEqual(batchedBank);
        expect(totals(batched)).toEqual(totals(oneByOne));
    });

    it('every pile still says it was collected, before the Bank is told', () => {
        scatter();
        const order = [];
        const offs = [
            EventBus.subscribe(BOARD_EVENTS.SPRITE_COLLECTED, () => order.push('collected')),
            EventBus.subscribe(ENGINE_EVENTS.INVENTORY_UPDATED, () => order.push('bank')),
            EventBus.subscribe(BOARD_EVENTS.SPRITES_CHANGED, () => order.push('floor'))
        ];
        try { SpriteLayer.collectAll(); } finally { offs.forEach(off => off()); }
        expect(order.filter(e => e === 'collected')).toHaveLength(40);
        expect(order.slice(-3)).toEqual(['bank', 'bank', 'floor']);
    });

    it('the tick sweeps batch too', () => {
        SettingsManager.set('gameplay.autoCollectLoot', true);
        SettingsManager.set('gameplay.autoCollectDelayMs', 0);
        scatter();
        const news = bankNews(() => SpriteLayer.tick(5000));
        expect(news.map(n => n.itemId)).toEqual(['fixture_oak_wood', 'fixture_glowcap']);
        SettingsManager.set('gameplay.autoCollectLoot', false);
    });
});

describe('InventoryManager.batch', () => {
    it('a gain and a spend of one item in one batch: one announcement carrying both', () => {
        InventoryManager.addItem('fixture_oak_wood', 10);
        const news = bankNews(() => InventoryManager.batch(() => {
            InventoryManager.addItem('fixture_oak_wood', 5);
            InventoryManager.removeItem('fixture_oak_wood', 3);
            InventoryManager.addItem('fixture_oak_wood', 1);
        }));
        expect(news).toEqual([{ itemId: 'fixture_oak_wood', amount: 13, added: 6, removed: 3 }]);
    });

    it('nested batches announce once, when the outer one ends', () => {
        const news = bankNews(() => InventoryManager.batch(() => {
            InventoryManager.batch(() => InventoryManager.addItem('fixture_oak_wood', 2));
            expect(GameState.state.inventory.items.fixture_oak_wood.quantity).toBe(2);
            InventoryManager.addItem('fixture_oak_wood', 2);
        }));
        expect(news).toEqual([{ itemId: 'fixture_oak_wood', amount: 4, added: 4 }]);
    });

    it('a batch that throws still announces what it changed', () => {
        const news = bankNews(() => {
            expect(() => InventoryManager.batch(() => {
                InventoryManager.addItem('fixture_oak_wood', 2);
                throw new Error('boom');
            })).toThrow('boom');
        });
        expect(news).toEqual([{ itemId: 'fixture_oak_wood', amount: 2, added: 2 }]);
    });

    it('outside a batch every change is announced at once, as before', () => {
        const news = bankNews(() => {
            InventoryManager.addItem('fixture_oak_wood', 2);
            InventoryManager.removeItem('fixture_oak_wood', 1);
        });
        expect(news).toEqual([
            { itemId: 'fixture_oak_wood', amount: 2, added: 2 },
            { itemId: 'fixture_oak_wood', amount: 1, removed: 1 }
        ]);
    });
});
