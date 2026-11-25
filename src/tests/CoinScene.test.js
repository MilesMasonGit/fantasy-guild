// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn(), recordKill: vi.fn(), recordEnemyKill: vi.fn() }
}));

import { TestDashboard } from '../ui/components/TestDashboard.jsx';
import { GameState } from '../state/GameState.js';
import { EngineBootstrap } from '../systems/core/EngineBootstrap.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { addCoins } from '../systems/inventory/Coins.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as TileModifiers from '../systems/board/TileModifiers.js';
import * as Shop from '../systems/board/Shop.js';
import * as CoinDrops from '../systems/board/CoinDrops.js';
import { getTokenType } from '../config/registries/tokenRegistry.js';

/**
 * The coin eye-check's scene, one click on the QA panel (⚠️ temporary, deleted with the scene once
 * the look is accepted): two coin camps, the left one's goblins in a Counting House's reach, two
 * Shop Tokens asking coins, and a fighter.
 */

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    TileModifiers.clearAll();
    TileModifiers.init();
    EngineBootstrap.createDefaultGameData();
});

afterEach(() => {
    cleanup();
    TileModifiers.teardown();
});

describe('the QA panel\'s coin scene', () => {
    it('sets up the camps, the Counting House, the coin prices and a fighter', () => {
        const heroes = GameState.state.heroes.length;
        const view = render(React.createElement(TestDashboard));
        fireEvent.click(view.getByTitle('Open QA Dashboard'));
        fireEvent.click(view.container.querySelector('[data-qa-coin-scene]'));

        const camps = BoardState.tokens().filter(t => t.typeId === 'qa_coin_camp');
        expect(camps).toHaveLength(2);
        expect(BoardState.tokens().filter(t => t.typeId === 'qa_counting_house')).toHaveLength(1);
        const goblins = BoardState.tokens().filter(t => t.typeId === 'qa_coin_goblin');
        expect(goblins.length).toBeGreaterThanOrEqual(2);
        const def = getTokenType('qa_coin_goblin');
        const drops = goblins.map(g => CoinDrops.killCoins(g.id, def, ''));
        // Some goblins drop 10 (in the house's reach), some drop 5.
        expect(drops).toContain(10);
        expect(drops).toContain(5);
        expect(GameState.state.heroes.length).toBe(heroes + 1);

        InventoryManager.addItem('item_oak_wood', 2);
        expect(Shop.canBuy('qa_coin_foundation')).toMatchObject({ success: false, reason: 'Need 40× Coins' });
        addCoins(40);
        expect(Shop.canBuy('qa_coin_foundation').success).toBe(true);
        expect(Shop.priceLines('qa_coin_farmland').find(l => l.coins)?.need).toBe(25);
    });
});
