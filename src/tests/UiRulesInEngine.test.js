// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { UI_EVENTS } from '../systems/core/engineEvents.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { getUpgradeDef } from '../config/guildUpgrades.js';
import { GuildUpgradeInspection } from '../ui/components/drawer/GuildUpgradeInspection.jsx';
import { sourceCode, setScanTimeout } from './fixtures/sourceScan.js';

setScanTimeout();

vi.mock('../systems/core/NotificationSystem.js', () => ({
    notify: vi.fn(), warning: vi.fn(), info: vi.fn(), success: vi.fn(), error: vi.fn(),
    getQueue: vi.fn(() => [])
}));

/**
 * Three small rules the UI used to work out for itself now come from the engine, so a future
 * rule change (a discount, a new kind of permanent Token) cannot disagree with what the screen
 * shows. The disallow rule's own tests are in `FlagUI.test.js` and `MapModes.test.js`.
 */

describe('permanence: the UI asks Placement.isPermanentToken', () => {
    it('no UI file reads cannotLeaveBoard itself', { timeout: 20000 }, () => {
        const readers = sourceCode()
            .filter(({ file }) => file.startsWith('ui/'))
            .filter(({ code }) => /cannotLeaveBoard/.test(code))
            .map(({ file }) => file);
        expect(readers).toEqual([]);
    });
});

describe('the Hall upgrade button: the engine decides affordability and says a refusal', () => {
    const def = getUpgradeDef('roster_size');
    const mount = () => render(
        React.createElement(GuildUpgradeInspection, { upgradeDef: def })
    );
    const button = (c) => c.querySelector('#guild-upgrade-button');

    beforeEach(() => {
        GameState.initNew();
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it('greys the button whenever GuildUpgradeManager.canAfford says no', () => {
        vi.spyOn(GuildUpgradeManager, 'canAfford').mockReturnValue(false);
        const { container } = mount();
        expect(button(container).disabled).toBe(true);
    });

    it('offers the button whenever GuildUpgradeManager.canAfford says yes', () => {
        vi.spyOn(GuildUpgradeManager, 'canAfford').mockReturnValue(true);
        const { container } = mount();
        expect(button(container).disabled).toBe(false);
    });

    it('a refused purchase is said on screen in the engine’s words', () => {
        vi.spyOn(GuildUpgradeManager, 'canAfford').mockReturnValue(true);
        const purchase = vi.spyOn(GuildUpgradeManager, 'purchase')
            .mockReturnValue({ success: false, error: 'Not enough items: need 5 Oak Wood (have 2)' });
        const said = [];
        const off = EventBus.subscribe(UI_EVENTS.UI_SCREEN_CALLOUT, (p) => said.push(p.text));
        try {
            const { container } = mount();
            fireEvent.click(button(container));
        } finally {
            off();
        }
        expect(purchase).toHaveBeenCalledWith('roster_size');
        expect(said).toEqual(['Not enough items: need 5 Oak Wood (have 2)']);
    });

    it('a purchase that goes through says nothing', () => {
        vi.spyOn(GuildUpgradeManager, 'canAfford').mockReturnValue(true);
        vi.spyOn(GuildUpgradeManager, 'purchase').mockReturnValue({ success: true });
        const said = [];
        const off = EventBus.subscribe(UI_EVENTS.UI_SCREEN_CALLOUT, (p) => said.push(p.text));
        try {
            const { container } = mount();
            fireEvent.click(button(container));
        } finally {
            off();
        }
        expect(said).toEqual([]);
    });
});
