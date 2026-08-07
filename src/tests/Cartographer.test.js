import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as TokenBank from '../systems/board/TokenBank.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Cartographer from '../systems/board/Cartographer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getMap, listMaps } from '../config/registries/mapRegistry.js';

/**
 * The Cartographer — buying Maps.
 *
 * The load-bearing rule is D-166's curve: **a theme's price never rises,
 * however many times you buy it.** That is what lets one system be both the
 * progression ladder and the restocking route without the two fighting.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

vi.mock('../systems/progression/QuestTracker.js', () => ({
    QuestTracker: { processEvent: vi.fn() }
}));

vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const WOODLAND = 'map_woodland';

/** Give the player enough gold and materials to buy `n` Woodland Maps. */
function stockFor(n = 1, mapId = WOODLAND) {
    const def = getMap(mapId);
    GameState.state.currency.gold = def.price * n;
    for (const m of def.materials) InventoryManager.addItem(m.itemId, m.quantity * n);
}

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.inventory.maxSlots = 50;
});

describe('The catalogue (D-99, D-101)', () => {
    it('lists every Map from the very start — nothing is ever locked', () => {
        // Cost is the ONLY gate. Ambition is expensive rather than forbidden,
        // and there are no greyed-out nodes to come back for.
        const rows = Cartographer.catalogue();
        expect(rows).toHaveLength(listMaps().length);
        expect(rows.length).toBeGreaterThan(1);
    });

    it('lists them in price order — the ordering is the whole tutorial', () => {
        const prices = Cartographer.catalogue().map(m => m.price);
        expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    });

    it('shows an unaffordable Map at its real price rather than hiding it', () => {
        GameState.state.currency.gold = 0;
        const rows = Cartographer.catalogue();
        const dearest = rows[rows.length - 1];

        expect(dearest.affordability.success).toBe(false);
        expect(dearest.price).toBeGreaterThan(0);
    });
});

describe('⚠️ Flat within a theme, stepped between them (D-166)', () => {
    it('does not raise the price across repeated purchases', () => {
        // The rule that makes restocking safe to rely on forever. If this ever
        // fails, grinding one theme for supply becomes progressively punishing
        // — exactly what D-166 rejected rising-per-purchase pricing to avoid.
        const price = getMap(WOODLAND).price;
        stockFor(5);

        for (let i = 0; i < 5; i++) {
            expect(Cartographer.catalogue().find(m => m.id === WOODLAND).price).toBe(price);
            expect(Cartographer.buyMap(WOODLAND).success).toBe(true);
        }

        expect(Cartographer.catalogue().find(m => m.id === WOODLAND).price).toBe(price);
        expect(GameState.state.currency.gold).toBe(0);      // exactly 5× the price
    });

    it('steps by an order of magnitude to the next theme', () => {
        const [first, second] = listMaps();
        expect(second.price).toBeGreaterThanOrEqual(first.price * 5);
    });
});

describe('Buying (D-150, D-156, D-160)', () => {
    it('takes gold AND materials, pulling the materials from the Bank', () => {
        const def = getMap(WOODLAND);
        stockFor(1);
        const material = def.materials[0];

        expect(Cartographer.buyMap(WOODLAND).success).toBe(true);

        expect(GameState.state.currency.gold).toBe(0);
        expect(InventoryManager.getItemCount(material.itemId)).toBe(0);
    });

    it('refuses when short on materials, naming what is missing', () => {
        GameState.state.currency.gold = 99999;            // gold is not the problem
        const result = Cartographer.buyMap(WOODLAND);

        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/materials/i);
        expect(result.reason).toMatch(/oak wood/i);
    });

    it('refuses when short on gold, naming the price', () => {
        stockFor(1);
        GameState.state.currency.gold = 0;

        const result = Cartographer.buyMap(WOODLAND);
        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/gold/i);
    });

    it('takes nothing at all when it refuses', () => {
        // A half-paid purchase destroys materials for nothing — the same rule
        // `completeCycle` follows: decide the whole exchange before any of it.
        const def = getMap(WOODLAND);
        for (const m of def.materials) InventoryManager.addItem(m.itemId, m.quantity);
        GameState.state.currency.gold = def.price - 1;
        const material = def.materials[0];

        expect(Cartographer.buyMap(WOODLAND).success).toBe(false);
        expect(InventoryManager.getItemCount(material.itemId)).toBe(material.quantity);
        expect(GameState.state.currency.gold).toBe(def.price - 1);
    });

    it('puts the Map in the TRAY, never the Vault (D-156)', () => {
        stockFor(1);
        Cartographer.buyMap(WOODLAND);

        const tray = BoardState.getTray();
        expect(tray).toHaveLength(1);
        expect(Cartographer.isMap(tray[0])).toBe(true);
        expect(BoardState.getTokenBank()).toEqual({});
    });

    it('refuses to bank a Map even if something tries (D-156)', () => {
        // Enforced as a rule rather than trusted to call sites: a Map is a thing
        // you are about to open, not a thing you keep, and a stockpiling path
        // would turn the Tray's natural cap into no cap at all.
        stockFor(1);
        Cartographer.buyMap(WOODLAND);
        const map = BoardState.takeFromTray(0);

        expect(TokenBank.deposit(map)).toBe(false);
        expect(BoardState.getTokenBank()).toEqual({});
    });

    it('refuses the purchase when the Tray is full, stating the reason (D-160)', () => {
        stockFor(1);
        for (let i = 0; i < BoardState.TRAY_CAPACITY; i++) {
            BoardState.addToTray(BoardState.createTokenInstance('token_sawmill', 800));
        }

        const result = Cartographer.buyMap(WOODLAND);
        expect(result.success).toBe(false);
        expect(result.reason).toMatch(/tray/i);
        expect(GameState.state.currency.gold).toBe(getMap(WOODLAND).price);   // nothing spent
    });
});

describe('Silhouettes — the collection hook (D-159)', () => {
    it('starts with every pool entry undiscovered', () => {
        const woodland = Cartographer.catalogue().find(m => m.id === WOODLAND);
        expect(woodland.pool.every(e => !e.known)).toBe(true);
    });

    it('shows the FULL pool even while undiscovered — the shape is the point', () => {
        const woodland = Cartographer.catalogue().find(m => m.id === WOODLAND);
        expect(woodland.pool).toHaveLength(getMap(WOODLAND).pool.length);
    });

    it('reveals an entry once it has actually come out of a burst', () => {
        // This is what makes restocking deliberate: a player who needs Forests
        // can see which Map yields them (D-154's main mitigation).
        Cartographer.markDiscovered('token_forest');

        const woodland = Cartographer.catalogue().find(m => m.id === WOODLAND);
        const forest = woodland.pool.find(e => e.refId === 'token_forest');
        expect(forest.known).toBe(true);
        expect(woodland.pool.some(e => !e.known)).toBe(true);   // the rest stay hidden
    });

    it('survives a save round trip — discovery is progress, not a session flag', () => {
        Cartographer.markDiscovered('token_forest');
        const back = JSON.parse(JSON.stringify(GameState.serialize())).state;

        expect(back.progress.mapDiscoveries.token_forest).toBe(true);
    });
});
