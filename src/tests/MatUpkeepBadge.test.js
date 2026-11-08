// @vitest-environment jsdom
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
import { ENGINE_EVENTS } from '../systems/core/engineEvents.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { resetMatTuning } from '../config/matTuning.js';
import { computeUpkeepSummary } from '../systems/board/UpkeepSummary.js';
import {
    MatUpkeepBadge, totalPerMinute, formatTotal, POPOVER_WIDTH
} from '../ui/components/board/MatUpkeepBadge.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';
import { UpkeepSummaryPanel, summarySignature, REFRESH_EVENTS } from '../ui/components/drawer/UpkeepSummaryPanel.jsx';

/**
 * Token Lifecycle feedback **B2.2** — the mat top bar's Upkeep badge: the
 * total items per minute every ongoing cost takes, with the full Upkeep
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
    id, name, type: 'material', sprite: 'i_wood_oak', description: '', tags: [],
    stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
});
registerItems({
    fixture_ub_seed: item('fixture_ub_seed', 'Fixture Badge Seed'),
    fixture_ub_ore: item('fixture_ub_ore', 'Fixture Badge Ore')
});
const SEED = 'fixture_ub_seed';
const ORE = 'fixture_ub_ore';

const tokenDef = (id, name, extra = {}) => ({
    id, name, tokenType: 'resource', rarity: 'common', theme: 'fixture', uses: null, sprite: 's_nature', ...extra
});
registerTokenTypes({
    fixture_ub_sapling: tokenDef('fixture_ub_sapling', 'Fixture Ub Sapling'),
    fixture_ub_hall: tokenDef('fixture_ub_hall', 'Fixture Ub Hall', { trickle: [{ itemId: SEED, quantity: 10 }] }),
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

const badgeText = (c) => {
    const badge = c.querySelector('[data-mat-upkeep-badge]');
    return `${badge.querySelector('[data-item-bar-name]').textContent} ${badge.querySelector('[data-mat-upkeep-count]').textContent}`;
};
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

    it('the panel lists only what consumes: a Hall paying the same item adds no income line', () => {
        InventoryManager.addItem(SEED, 50);
        placeAt('fixture_ub_hall', 300, 300);
        placeAt('fixture_ub_forest', 500, 500);
        const { container } = render(React.createElement(MatUpkeepBadge));
        fireEvent.mouseEnter(container.querySelector('[data-mat-upkeep-badge]'));
        const text = popover().textContent;
        expect(text).toContain('Fixture Badge Seed');
        expect(text).not.toContain('Passive Production');
        expect(text).not.toContain('Fixture Ub Hall');
        expect(text).not.toMatch(/\+\d/);
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

    it('⭐ nothing polls, and a Bank change works nothing out; a mat change does', () => {
        vi.useFakeTimers();
        let reads = 0;
        let total = 0;
        const { container } = render(React.createElement(MatUpkeepBadge, { readTotal: () => { reads++; return total; } }));
        const before = reads;
        total = 2;
        act(() => { vi.advanceTimersByTime(60000); });
        act(() => { EventBus.publish(ENGINE_EVENTS.INVENTORY_UPDATED, {}); });
        expect(reads).toBe(before);
        expect(badgeText(container)).toBe('Upkeep 0/min');

        for (const event of [BOARD_EVENTS.SPAWNER_ALERT_CHANGED, ENGINE_EVENTS.ATLAS_CHANGED]) {
            total += 1;
            act(() => { EventBus.publish(event, {}); });
            expect(badgeText(container)).toBe(`Upkeep ${total}/min`);
        }
        tileChanged('x');
        expect(badgeText(container)).toBe('Upkeep 4/min');
    });

    it('⚠️ a Bank change cannot move the total: a spawner short of its item still counts', () => {
        const forest = placeAt('fixture_ub_forest', 500, 500);
        InventoryManager.addItem(SEED, 50);
        const paying = computeUpkeepSummary();
        InventoryManager.removeItem(SEED, 50);
        const short = computeUpkeepSummary();
        expect(short.items.find(r => r.itemId === SEED).waiting.map(w => w.instanceId)).toEqual([forest.id]);
        expect(totalPerMinute(short)).toBe(totalPerMinute(paying));
    });

    it('a total that moves only by float noise is not drawn again', () => {
        let total = 1.33;
        let commits = 0;
        const { container } = render(React.createElement(React.Profiler, { id: 'badge', onRender: () => { commits++; } },
            React.createElement(MatUpkeepBadge, { readTotal: () => total })));
        const before = commits;
        total = 4 / 3;
        tileChanged('x');
        expect(commits).toBe(before);
        total = 2;
        tileChanged('x');
        expect(commits).toBe(before + 1);
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
        expect(tip.textContent).toContain('Items the mat uses each minute');
        expect(tip.textContent).not.toContain('Passive Production');
        expect(tip.textContent).toContain('Fixture Badge Seed');
        expect(tip.textContent).toContain('3/min');
        expect(tip.textContent).toContain('Waiting: Fixture Ub Forest');
    });

    it('⭐ the hover lists one item bar per item, each with its own rate', () => {
        InventoryManager.addItem(SEED, 50);
        InventoryManager.addItem(ORE, 50);
        placeAt('fixture_ub_forest', 500, 500);
        placeAt('fixture_ub_mine', 900, 500);
        const { container } = render(React.createElement(MatUpkeepBadge));
        fireEvent.mouseEnter(container.querySelector('[data-mat-upkeep-badge]'));
        const bars = [...popover().querySelectorAll('[data-item-id] > [data-item-bar]')];
        const read = bars.map(b => [b.querySelector('[data-item-bar-name]').textContent, b.querySelector('[data-upkeep-rate]').textContent]);
        expect(read.sort()).toEqual([['Fixture Badge Ore', '1.33/min'], ['Fixture Badge Seed', '3/min']]);
    });

    it('the bar reads in the item bar style, and its popover wears the chamfer pixel frame', () => {
        const { container } = render(React.createElement(MatUpkeepBadge));
        const badge = container.querySelector('[data-mat-upkeep-badge]');
        expect(badge.hasAttribute('data-item-bar')).toBe(true);
        fireEvent.mouseEnter(badge);
        expect(popover().getAttribute('data-pixel-frame')).toBe('chamfer');
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

describe('⭐ UpkeepSummaryPanel: drawn again only when what it shows changes', () => {
    const renderPanel = () => {
        const counter = { commits: 0 };
        const view = render(React.createElement(React.Profiler, { id: 'panel', onRender: () => { counter.commits++; } },
            React.createElement(UpkeepSummaryPanel)));
        return { ...view, counter };
    };

    it('summarySignature: equal for the same summary worked out twice, different when a shown number moves', () => {
        InventoryManager.addItem(SEED, 50);
        placeAt('fixture_ub_forest', 500, 500);
        const a = computeUpkeepSummary();
        expect(summarySignature(computeUpkeepSummary())).toBe(summarySignature(a));
        InventoryManager.addItem(SEED, 1);
        expect(summarySignature(computeUpkeepSummary())).not.toBe(summarySignature(a));
    });

    it('a Bank change of an item it does not list draws nothing; one it lists draws once', () => {
        InventoryManager.addItem(SEED, 50);
        placeAt('fixture_ub_forest', 500, 500);
        const { container, counter } = renderPanel();
        const before = counter.commits;
        act(() => { InventoryManager.addItem(ORE, 5); });
        expect(counter.commits).toBe(before);
        act(() => { InventoryManager.addItem(SEED, 5); });
        expect(counter.commits).toBe(before + 1);
        expect(container.textContent).toContain('Bank 55');
    });

    it('nothing polls: with no event, the panel is not worked out again', () => {
        vi.useFakeTimers();
        placeAt('fixture_ub_forest', 500, 500);
        const { counter } = renderPanel();
        const before = counter.commits;
        act(() => { vi.advanceTimersByTime(60000); });
        expect(counter.commits).toBe(before);
    });

    it('hears the Bank and every mat event that can change what it shows', () => {
        expect(REFRESH_EVENTS).toEqual(expect.arrayContaining([
            ENGINE_EVENTS.INVENTORY_UPDATED, BOARD_EVENTS.SPAWNER_ALERT_CHANGED, BOARD_EVENTS.TILE_CHANGED,
            BOARD_EVENTS.TOKEN_PLACED, BOARD_EVENTS.TOKEN_DEPLETED, ENGINE_EVENTS.ATLAS_CHANGED, ENGINE_EVENTS.GAME_LOADED
        ]));
    });
});

describe('the Bank drawer no longer has the Upkeep toggle (B2.2)', () => {
    it('BankTab has no upkeep toggle or summary panel', () => {
        const src = fs.readFileSync(path.resolve(__dirname, '../ui/components/drawer/BankTab.jsx'), 'utf8');
        expect(src).not.toMatch(/upkeep-toggle|showUpkeep|UpkeepSummaryPanel/);
    });
});
