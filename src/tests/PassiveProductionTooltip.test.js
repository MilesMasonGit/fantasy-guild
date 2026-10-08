// @vitest-environment jsdom
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
    PassiveProductionTooltip, PASSIVE_TOOLTIP_REFRESH_MS, livePassiveLines
} from '../ui/components/board/PassiveProductionTooltip.jsx';
import * as PassiveProduction from '../systems/board/PassiveProduction.js';
import { placeAt, clearMat } from './fixtures/mat.js';

/**
 * **The Guild Hall's live Passive Production tooltip** (T-099): hover text,
 * drawn like the flag's tooltip, with the shared timer's "next in" ticking
 * while it is shown, and never catching the pointer.
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
        isGuildHall: true,
        trickle: [{ itemId: 'fixture_tt_seed', quantity: 1, everyMs: 300000 }]
    }
});

const tooltip = () => document.body.querySelector('[data-passive-tooltip]');

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

describe('⭐ the Hall tooltip (FB-52, T-099)', () => {
    it('shows the Token name, the Passive Production heading and what a lap pays', () => {
        const hall = placeAt('fixture_tt_hall', 800, 500);
        render(React.createElement(PassiveProductionTooltip, { instanceId: hall.id }));

        const tip = tooltip();
        expect(tip).not.toBeNull();
        expect(tip.getAttribute('role')).toBe('tooltip');
        expect(tip.textContent).toContain('Tooltip Hall');
        expect(tip.textContent).toContain('Passive Production · next in 5:00');
        expect(tip.textContent).toContain('1 Tooltip Seed');
        expect(tip.textContent.toLowerCase()).not.toContain('trickle');
        // The same wording as the hover lines: nothing re-derived here.
        expect(livePassiveLines(hall.id)).toEqual(['Passive Production · next in 5:00', '1 Tooltip Seed']);
    });

    it("lists the Wishing Well's Water with the Hall's own lines", () => {
        GameState.state.progress.guildUpgrades.wishing_well = 2;
        const hall = placeAt('fixture_tt_hall', 800, 500);
        expect(livePassiveLines(hall.id)).toEqual([
            'Passive Production · next in 5:00', '1 Tooltip Seed', '20 Water (Wishing Well)'
        ]);
    });

    it('⚠️ never catches the pointer (drag, click and loot hover-collect stay underneath)', () => {
        const hall = placeAt('fixture_tt_hall', 800, 500);
        render(React.createElement(PassiveProductionTooltip, { instanceId: hall.id }));
        expect(tooltip().className).toContain('pointer-events-none');
        // Above the whole mat, like the flag tooltip — so above every Token.
        expect(tooltip().className).toContain('fixed');
        expect(tooltip().parentElement).toBe(document.body);
    });

    it('⭐ the "next in" ticks live while shown', () => {
        const hall = placeAt('fixture_tt_hall', 800, 500);
        render(React.createElement(PassiveProductionTooltip, { instanceId: hall.id }));
        expect(tooltip().textContent).toContain('next in 5:00');

        // The game runs 3 seconds; the tooltip re-reads on its own clock.
        TimedChanges.tick(3000);
        act(() => { vi.advanceTimersByTime(PASSIVE_TOOLTIP_REFRESH_MS); });
        expect(tooltip().textContent).toContain('next in 4:57');

        TimedChanges.tick(2000);
        act(() => { vi.advanceTimersByTime(PASSIVE_TOOLTIP_REFRESH_MS); });
        expect(tooltip().textContent).toContain('next in 4:55');
    });

    it('hides while anything is being dragged, as the flag tooltip does', () => {
        const hall = placeAt('fixture_tt_hall', 800, 500);
        render(React.createElement(
            DeckDndContext.Provider,
            { value: { activePayload: { kind: 'token' }, isDragging: true } },
            React.createElement(PassiveProductionTooltip, { instanceId: hall.id })
        ));
        expect(tooltip()).toBeNull();
    });

    it('draws nothing for a Token with no Passive Production', () => {
        const plain = placeAt('fixture_producer', 800, 500);
        render(React.createElement(PassiveProductionTooltip, { instanceId: plain.id }));
        expect(tooltip()).toBeNull();
        expect(PassiveProduction.hasPassiveProduction(plain)).toBe(false);
        expect(PassiveProduction.hasPassiveProduction(null)).toBe(false);
    });

    it('hangs under the anchor it is given', () => {
        const anchor = { getBoundingClientRect: () => ({ left: 100, top: 100, right: 200, bottom: 200 }) };
        render(React.createElement(PassiveProductionTooltip, {
            instanceId: 'x',
            readLines: () => ['Passive Production · next in 5:00', 'a line'],
            anchorOf: () => anchor
        }));
        expect(tooltip().style.left).toBe('100px');
        expect(tooltip().style.top).toBe('208px');
    });

    it('is as wide as its longest line, one row each, capped to the window (the flag tooltip keeps a fixed 256 px)', () => {
        render(React.createElement(PassiveProductionTooltip, {
            instanceId: 'x',
            readLines: () => ['Passive Production · next in 5:00', 'a line'],
            anchorOf: () => null
        }));
        const cls = tooltip().className;
        expect(cls).toContain('w-max');
        expect(cls).toContain('whitespace-nowrap');
        expect(cls).toContain('max-w-[calc(100vw-16px)]');
        expect(cls).not.toContain('w-64');
    });
});
