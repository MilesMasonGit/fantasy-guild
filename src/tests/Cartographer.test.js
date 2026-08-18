import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameState } from '../state/GameState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as Cartographer from '../systems/board/Cartographer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { getMap } from '../config/registries/mapRegistry.js';

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

// The 'Buying (D-150, D-156, D-160)' and '⚠️ Flat within a theme, stepped
// between them (D-166)' suites were emptied by the 2026-08-18 cleanup: every
// case in them priced or purchased a Map, and the re-authored content set has
// no Map costs to price. The empty shells are removed here so vitest does not
// report "No test found in suite". See the Retired Tests Ledger in
// cleanup_phase_brief.md for what each case covered.

describe('Silhouettes — the collection hook (D-159)', () => {
    it('survives a save round trip — discovery is progress, not a session flag', () => {
        Cartographer.markDiscovered('token_forest');
        const back = JSON.parse(JSON.stringify(GameState.serialize())).state;

        expect(back.progress.mapDiscoveries.token_forest).toBe(true);
    });
});
