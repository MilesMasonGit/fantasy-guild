import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import './fixtures/testTokens.js';
import { GameState } from '../state/GameState.js';
import * as TimedChanges from '../systems/board/TimedChanges.js';
import * as SpriteLayer from '../systems/board/SpriteLayer.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { registerTokenTypes } from '../config/registries/tokenRegistry.js';
import { registerItems } from '../config/registries/itemRegistry.js';
import { DeckDndContext } from '../ui/dnd/DndKit.jsx';
import {
    TrickleTooltip, TRICKLE_TOOLTIP_REFRESH_MS, liveTrickleLines, hasTrickle
} from '../ui/components/board/TrickleTooltip.jsx';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * Feedback slice Q5b — **the Guild Hall's live trickle tooltip**: hover text,
 * drawn like the flag's tooltip, with a "next in" that ticks while it is shown
 * and never catches the pointer.
 */

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));
vi.mock('../systems/progression/RegistryManager.js', () => ({
    RegistryManager: { recordItemGain: vi.fn() }
}));

registerItems({
    fixture_tt_seed: {
        id: 'fixture_tt_seed', name: 'Tooltip Seed', type: 'material', sprite: 'wood_oak', description: '',
        tags: [], stackable: true, restoreAmount: 0, restoreType: '', regen: 0, equipSlot: '', value: 1
    }
});
registerTokenTypes({
    fixture_tt_hall: {
        id: 'fixture_tt_hall', name: 'Tooltip Hall', tokenType: 'resource', rarity: 'common',
        theme: 'fixture', uses: null, sprite: 'skill_nature',
        trickle: [{ itemId: 'fixture_tt_seed', quantity: 1, everyMs: 300000 }]
    }
});

const tooltip = () => document.body.querySelector('[data-trickle-tooltip]');

beforeEach(() => {
    vi.useFakeTimers();
    GameState.initNew();
    InventoryManager.init();
    SpriteLayer.init();
    GameState.state.heroes = [];
    clearMat();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe('⭐ FB-52: the Hall tooltip', () => {
    it('shows the Token name, the heading and the trickle lines in the game-styled box', () => {
        const hall = placeAt('fixture_tt_hall', 800, 500);
        render(React.createElement(TrickleTooltip, { instanceId: hall.id }));

        const tip = tooltip();
        expect(tip).not.toBeNull();
        expect(tip.getAttribute('role')).toBe('tooltip');
        expect(tip.textContent).toContain('Tooltip Hall');
        expect(tip.textContent).toContain('Trickle income:');
        expect(tip.textContent).toContain('1 Tooltip Seed every 5 min (next in 5 min)');
        // The same wording as hover lines: nothing re-derived here.
        expect(liveTrickleLines(hall.id)).toEqual(['Trickle income:', '1 Tooltip Seed every 5 min (next in 5 min)']);
    });

    it('⚠️ never catches the pointer (drag, click and loot hover-collect stay underneath)', () => {
        const hall = placeAt('fixture_tt_hall', 800, 500);
        render(React.createElement(TrickleTooltip, { instanceId: hall.id }));
        expect(tooltip().className).toContain('pointer-events-none');
        // Above the whole mat, like the flag tooltip — so above every Token.
        expect(tooltip().className).toContain('fixed');
        expect(tooltip().parentElement).toBe(document.body);
    });

    it('⭐ the "next in" ticks live while shown', () => {
        const hall = placeAt('fixture_tt_hall', 800, 500);
        render(React.createElement(TrickleTooltip, { instanceId: hall.id }));
        expect(tooltip().textContent).toContain('next in 5 min)');

        // The game runs 3 seconds; the tooltip re-reads on its own clock.
        TimedChanges.tick(3000);
        act(() => { vi.advanceTimersByTime(TRICKLE_TOOLTIP_REFRESH_MS); });
        expect(tooltip().textContent).toContain('next in 4 min 57 s)');

        TimedChanges.tick(2000);
        act(() => { vi.advanceTimersByTime(TRICKLE_TOOLTIP_REFRESH_MS); });
        expect(tooltip().textContent).toContain('next in 4 min 55 s)');
    });

    it('hides while anything is being dragged, as the flag tooltip does', () => {
        const hall = placeAt('fixture_tt_hall', 800, 500);
        render(React.createElement(
            DeckDndContext.Provider,
            { value: { activePayload: { kind: 'token' }, isDragging: true } },
            React.createElement(TrickleTooltip, { instanceId: hall.id })
        ));
        expect(tooltip()).toBeNull();
    });

    it('draws nothing for a Token with no trickle', () => {
        const plain = placeAt('fixture_producer', 800, 500);
        render(React.createElement(TrickleTooltip, { instanceId: plain.id }));
        expect(tooltip()).toBeNull();
        expect(hasTrickle({ trickle: [] })).toBe(false);
        expect(hasTrickle({ trickle: [{ itemId: 'x', quantity: 1, everyMs: 1 }] })).toBe(true);
        expect(hasTrickle(null)).toBe(false);
    });

    it('hangs under the anchor it is given', () => {
        const anchor = { getBoundingClientRect: () => ({ left: 100, top: 100, right: 200, bottom: 200 }) };
        render(React.createElement(TrickleTooltip, {
            instanceId: 'x',
            readLines: () => ['Trickle income:', 'a line'],
            anchorOf: () => anchor
        }));
        expect(tooltip().style.left).toBe('100px');
        expect(tooltip().style.top).toBe('208px');
    });

    it('is as wide as its longest line, one row each, capped to the window (the flag tooltip keeps a fixed 256 px)', () => {
        render(React.createElement(TrickleTooltip, {
            instanceId: 'x',
            readLines: () => ['Trickle income:', 'a line'],
            anchorOf: () => null
        }));
        const cls = tooltip().className;
        expect(cls).toContain('w-max');
        expect(cls).toContain('whitespace-nowrap');
        expect(cls).toContain('max-w-[calc(100vw-16px)]');
        expect(cls).not.toContain('w-64');
    });
});
