// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import * as MatResize from '../systems/board/MatResize.js';
import * as Landmarks from '../systems/board/Landmarks.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { matW } from '../config/matGeometry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { MatBoard } from '../ui/components/board/MatBoard.jsx';
import { MatCapBadge } from '../ui/components/board/MatCapBadge.jsx';
import { ShopDrawer } from '../ui/components/drawer/ShopDrawer.jsx';
import { DeckDndProvider } from '../ui/dnd/DndKit.jsx';
import { LeaveMatControl } from '../ui/components/drawer/TokenInspection.jsx';
import { sourceCode } from './fixtures/sourceScan.js';
import { placeAt, clearMat } from './fixtures/mat.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

/**
 * ⭐ `state_changed` is retired. Every surface listens to the events that name what it draws,
 * plus `GAME_RESET` for the moments everything may have changed. These are the routes where a
 * surface used to be woken only by the catch-all: each must still redraw without it.
 */

const h = React.createElement;
const withEngine = (el) => h(DndContext, null, el);

beforeEach(() => {
    resetMatTuning();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    clearMat();
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    Landmarks.setLayoutEditing?.(false);
});

describe('nothing listens to state_changed, and the engine stopped saying it', () => {
    it('only its declaration and the one Atlas publish (another lane’s file) still name it', { timeout: 20000 }, () => {
        const named = sourceCode()
            .filter(({ code }) => /STATE_CHANGED|['"]state_changed['"]/.test(code))
            .map(({ file }) => file)
            .sort();
        expect(named).toEqual(['systems/atlas/Atlas.js', 'systems/core/engineEvents.js']);
    });
});

describe('the routes that used to need the catch-all', () => {
    it('the mat redraws a Token the mat edge pulls back in', async () => {
        const t = placeAt('fixture_producer', 600, 400);
        const { container } = render(withEngine(h(MatBoard)));
        const box = () => container.querySelector(`[data-token-overlay="${t.id}"]`).style.left;
        // Somewhere off the mat, as a shrink leaves it; the pull is the mat's own announcement.
        BoardState.setTokenPoint(t.id, matW() + 400, 400);
        const offMat = box();
        await act(async () => { MatResize.fitToMat(); await Promise.resolve(); });
        expect(BoardState.getTokenById(t.id).x).toBeLessThan(matW());
        expect(box()).not.toBe(offMat);
    });

    it('the Token cap badge follows a Token Cap upgrade', async () => {
        const { container } = render(withEngine(h(MatCapBadge)));
        const text = () => container.querySelector('[data-mat-cap-count]').textContent;
        const before = text();
        for (const { itemId, quantity } of GuildUpgradeManager.getNextCost('token_cap')) {
            InventoryManager.addItem(itemId, quantity);
        }
        await act(async () => { expect(GuildUpgradeManager.purchase('token_cap').success).toBe(true); await Promise.resolve(); });
        expect(text()).not.toBe(before);
    });

    it('a Shop row follows floor loot spent by a Token', async () => {
        registerTokenTypes({
            sc_shop: {
                id: 'sc_shop', name: 'Shop Test', tokenType: 'resource', uses: 10,
                shop: { price: [{ itemId: 'fixture_glowcap', quantity: 2 }] },
                config: { cycleTimeMs: 5000, inputs: [], outputs: [] }
            }
        });
        SpriteLayer.addSprite('item', 'fixture_glowcap', 2, null);
        const { container } = render(h(DeckDndProvider, null, h(ShopDrawer, { isOpen: true, onClose: () => {} })));
        const affordable = () => container.querySelector('[data-shop-row="sc_shop"]').getAttribute('data-shop-affordable');
        expect(affordable()).toBe('true');
        await act(async () => { SpriteLayer.consumeFromSprites('fixture_glowcap', 2); await Promise.resolve(); });
        expect(affordable()).toBe('false');
    });

    it('a Token sheet’s Remove control follows the dev layout tool', async () => {
        const t = placeAt('fixture_producer', 600, 400);
        const { container } = render(withEngine(h(LeaveMatControl, { instanceId: t.id })));
        expect(container.querySelector('[data-dev-remove]')).toBeNull();
        await act(async () => { Landmarks.setLayoutEditing(true); await Promise.resolve(); });
        expect(container.querySelector('[data-dev-remove]')).not.toBeNull();
    });

    it('everything re-reads on GAME_RESET: a load onto another mat', async () => {
        const first = placeAt('fixture_producer', 600, 400);
        const { container } = render(withEngine(h(MatBoard)));
        expect(container.querySelector(`[data-token-overlay="${first.id}"]`)).not.toBeNull();
        clearMat();
        const second = placeAt('fixture_station', 900, 500);
        await act(async () => {
            EventBus.publish(ENGINE_EVENTS.GAME_RESET, { reason: 'load' });
            await Promise.resolve();
        });
        expect(container.querySelector(`[data-token-overlay="${first.id}"]`)).toBeNull();
        expect(container.querySelector(`[data-token-overlay="${second.id}"]`)).not.toBeNull();
    });
});
