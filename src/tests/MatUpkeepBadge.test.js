import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { EventBus } from '../systems/core/EventBus.js';
import { BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { computeUpkeepSummary } from '../systems/board/UpkeepSummary.js';
import {
    MatUpkeepBadge, totalPerMinute, formatTotal, POPOVER_WIDTH
} from '../ui/components/board/MatUpkeepBadge.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * Token Lifecycle feedback **B2.2** — the mat top bar's Upkeep badge (FB-29):
 * the total items per minute every ongoing cost takes, with the full Upkeep
 * Summary (slice 8.2) on hover. The summary moved here from the Bank drawer.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

const item = (id, name) => ({
    id, name, type: 'material', sprite: 'wood_oak', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({
    fixture_ub_seed: item('fixture_ub_seed', 'Fixture Badge Seed'),
    fixture_ub_ore: item('fixture_ub_ore', 'Fixture Badge Ore')
});
const SEED = 'fixture_ub_seed';
const ORE = 'fixture_ub_ore';

const tokenDef = (id, name, extra = {}) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 'skill_nature', ...extra
});
registerTokenTypes({
    fixture_ub_sapling: tokenDef('fixture_ub_sapling', 'Fixture Ub Sapling'),
    /** A seed every 20 s = 3 a minute while spawning. */
    fixture_ub_forest: tokenDef('fixture_ub_forest', 'Fixture Ub Forest', {
        spawner: {
            spawns: [{ typeId: 'fixture_ub_sapling', weight: 1 }],
            allowance: 5, intervalMs: 20000,
            upkeep: [{ itemId: SEED, quantity: 1 }]
        }
    }),
    /** An ore every 45 s = 1.333… a minute (float noise if unrounded). */
    fixture_ub_mine: tokenDef('fixture_ub_mine', 'Fixture Ub Mine', {
        spawner: {
            spawns: [{ typeId: 'fixture_ub_sapling', weight: 1 }],
            allowance: 5, intervalMs: 45000,
            upkeep: [{ itemId: ORE, quantity: 1 }]
        }
    })
});

const badgeText = (c) => c.querySelector('[data-mat-upkeep-text]').textContent.replace(/\s+/g, ' ').trim();
const popover = () => document.body.querySelector('[data-mat-upkeep-popover]');
const tileChanged = (instanceId) => act(() => { EventBus.publish(BOARD_EVENTS.TILE_CHANGED, { instanceId }); });

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.heroes = [];
    GameState.state.inventory.maxSlots = 50;
    clearMat();
});

afterEach(() => {
    cleanup();
    resetMatTuning();
    vi.useRealTimers();
});

describe('totalPerMinute / formatTotal', () => {
    it('sums every item row\'s per-minute rate', () => {
        expect(totalPerMinute({ items: [{ perMinute: 3 }, { perMinute: 1.5 }] })).toBe(4.5);
        expect(totalPerMinute({ items: [] })).toBe(0);
        expect(totalPerMinute(null)).toBe(0);
    });

    it('one decimal, trailing .0 dropped, no float noise', () => {
        expect(formatTotal(0)).toBe('0');
        expect(formatTotal(2)).toBe('2');
        expect(formatTotal(2.5)).toBe('2.5');
        expect(formatTotal(3 + 4 / 3)).toBe('4.3');
        expect(formatTotal(0.1 + 0.2)).toBe('0.3');
        expect(formatTotal(0.01)).toBe('<0.1');
    });
});

describe('⭐ MatUpkeepBadge (B2.2, FB-29)', () => {
    it('shows Upkeep 0/min with nothing costing upkeep', () => {
        const { container } = render(React.createElement(MatUpkeepBadge));
        expect(badgeText(container)).toBe('Upkeep 0/min');
    });

    it('the total is the sum of the per-item rates across spawners', () => {
        InventoryManager.addItem(SEED, 50);
        InventoryManager.addItem(ORE, 50);
        placeAt('fixture_ub_forest', 500, 500);
        placeAt('fixture_ub_forest', 1100, 500);
        placeAt('fixture_ub_mine', 800, 900);

        const summary = computeUpkeepSummary();
        expect(summary.items.map(r => r.perMinute).sort()).toEqual([4 / 3, 6].sort());
        const { container } = render(React.createElement(MatUpkeepBadge));
        expect(badgeText(container)).toBe('Upkeep 7.3/min');
    });

    it('updates when a spawner is placed or removed', () => {
        InventoryManager.addItem(SEED, 50);
        const { container } = render(React.createElement(MatUpkeepBadge));
        expect(badgeText(container)).toBe('Upkeep 0/min');

        const a = placeAt('fixture_ub_forest', 500, 500);
        tileChanged(a.id);
        expect(badgeText(container)).toBe('Upkeep 3/min');

        const b = placeAt('fixture_ub_forest', 1100, 500);
        tileChanged(b.id);
        expect(badgeText(container)).toBe('Upkeep 6/min');

        BoardState.removeToken(a.id);
        tileChanged(a.id);
        expect(badgeText(container)).toBe('Upkeep 3/min');
    });

    it('a slow poll catches changes no event announces', () => {
        vi.useFakeTimers();
        let total = 0;
        const { container } = render(React.createElement(MatUpkeepBadge, { readTotal: () => total }));
        total = 2;
        act(() => { vi.advanceTimersByTime(2000); });
        expect(badgeText(container)).toBe('Upkeep 2/min');
    });

    it('⚠️ is never coloured, even with a spawner waiting unpaid (owner)', () => {
        const forest = placeAt('fixture_ub_forest', 500, 500);   // no seeds in the Bank
        const row = computeUpkeepSummary().items.find(r => r.itemId === SEED);
        expect(row.waiting.map(w => w.instanceId)).toEqual([forest.id]);

        const { container } = render(React.createElement(MatUpkeepBadge));
        expect(badgeText(container)).toBe('Upkeep 3/min');
        const badge = container.querySelector('[data-mat-upkeep-badge]');
        expect(badge.outerHTML).not.toMatch(/red|yellow|danger|warn|amber-[4-9]00|orange/);
    });

    it('hover opens the full Upkeep Summary in a portalled popover', () => {
        placeAt('fixture_ub_forest', 500, 500);   // waiting: no seeds
        const { container } = render(React.createElement(MatUpkeepBadge));
        expect(popover()).toBeNull();

        fireEvent.mouseEnter(container.querySelector('[data-mat-upkeep-badge]'));
        const tip = popover();
        expect(tip).not.toBeNull();
        expect(container.contains(tip)).toBe(false);          // portalled to the body
        expect(tip.style.width).toBe(`${POPOVER_WIDTH}px`);
        const panel = tip.querySelector('[data-testid="upkeep-summary"]');
        expect(panel).not.toBeNull();
        expect(panel.className).not.toContain('h-full');
        expect(tip.textContent).toContain('Ongoing costs');
        expect(tip.textContent).toContain('Fixture Badge Seed');
        expect(tip.textContent).toContain('3 / min');
        expect(tip.textContent).toContain('Waiting unpaid: Fixture Ub Forest');
    });

    it('the popover stays while the pointer is over it, and closes after leaving', () => {
        vi.useFakeTimers();
        const { container } = render(React.createElement(MatUpkeepBadge));
        const badge = container.querySelector('[data-mat-upkeep-badge]');
        fireEvent.mouseEnter(badge);
        fireEvent.mouseLeave(badge);
        fireEvent.mouseEnter(popover());
        act(() => { vi.advanceTimersByTime(500); });
        expect(popover()).not.toBeNull();

        fireEvent.mouseLeave(popover());
        act(() => { vi.advanceTimersByTime(500); });
        expect(popover()).toBeNull();
    });
});

describe('the Bank drawer no longer has the Upkeep toggle (B2.2)', () => {
    it('BankTab has no upkeep toggle or summary panel', () => {
        const src = fs.readFileSync(path.resolve(__dirname, '../ui/components/drawer/BankTab.jsx'), 'utf8');
        expect(src).not.toMatch(/upkeep-toggle|showUpkeep|UpkeepSummaryPanel/);
    });
});
