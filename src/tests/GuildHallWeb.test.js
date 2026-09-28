// B9 (TL-23, FB-38, FB-39): the Guild Hall screen draws its upgrades as a web
// around the Hall — nodes joined by lines — with the Effects list on the left.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, fireEvent, act } from '@testing-library/react';
import { GuildHallBoard } from '../ui/components/board/GuildHallBoard.jsx';
import { GuildHallEffectsPanel } from '../ui/components/board/GuildHallEffectsPanel.jsx';
import { InspectionPanel } from '../ui/components/drawer/InspectionPanel.jsx';
import { EngineProvider } from '../ui/context/EngineContext.jsx';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { GUILD_UPGRADES, HALL_NODE, getUpgradeDef, getUpgradeWebLinks } from '../config/guildUpgrades.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), notify: vi.fn()
}));

const withEngine = (el) => React.createElement(EngineProvider, { engine: { GameState, EventBus } }, el);
const renderWeb = (props = {}) => render(withEngine(React.createElement(GuildHallBoard, props)));

const stateOf = (container, id) =>
    container.querySelector(`[data-hall-node="${id}"]`)?.getAttribute('data-node-state');
const litOf = (container, key) =>
    container.querySelector(`[data-hall-link="${key}"]`)?.getAttribute('data-link-lit');

beforeEach(() => {
    GameState.initNew();
    GameState.state.heroes = [];
    GameState.state.progress.guildUpgrades = {};
    InventoryManager.init();
});

describe('the Guild Hall upgrade web', () => {
    it('draws the Hall, one node per upgrade and one line per link', () => {
        const { container } = renderWeb();
        expect(container.querySelector(`[data-hall-node="${HALL_NODE}"]`)).toBeTruthy();
        for (const def of GUILD_UPGRADES) {
            expect(container.querySelector(`[data-hall-node="${def.id}"]`), def.id).toBeTruthy();
        }
        expect(container.querySelectorAll('[data-hall-node]').length).toBe(GUILD_UPGRADES.length + 1);
        const links = getUpgradeWebLinks();
        expect(container.querySelectorAll('[data-hall-link]').length).toBe(links.length);
        for (const { from, to } of links) {
            expect(container.querySelector(`[data-hall-link="${from}:${to}"]`), `${from}:${to}`).toBeTruthy();
        }
        // No tiles anywhere any more.
        expect(container.querySelector('[style*="grid-template-columns"]')).toBeNull();
    });

    it('shows a new game: Hall-linked nodes buyable, the rest locked, nothing lit', () => {
        const { container } = renderWeb();
        for (const id of ['roster_size', 'bank_slots', 'notice_board', 'wishing_well']) {
            expect(stateOf(container, id), id).toBe('buyable');
        }
        expect(stateOf(container, 'bank_tabs')).toBe('locked');
        expect(stateOf(container, 'flag_radius')).toBe('locked');
        expect([...container.querySelectorAll('[data-hall-link]')].every(l => l.getAttribute('data-link-lit') === 'false')).toBe(true);
    });

    it('marks bought, maxed and newly opened nodes, and lights the bought paths', () => {
        GameState.state.progress.guildUpgrades = { bank_slots: 2, notice_board: 3 };
        const { container } = renderWeb();
        expect(stateOf(container, 'bank_slots')).toBe('bought');
        expect(stateOf(container, 'notice_board')).toBe('maxed');
        expect(stateOf(container, 'bank_tabs')).toBe('buyable');     // Bank Slots opened it
        expect(stateOf(container, 'flag_radius')).toBe('buyable');   // so did it here
        expect(stateOf(container, 'roster_size')).toBe('buyable');

        expect(litOf(container, `bank_slots:${HALL_NODE}`)).toBe('true');
        expect(litOf(container, `notice_board:${HALL_NODE}`)).toBe('true');
        expect(litOf(container, 'bank_tabs:bank_slots')).toBe('false');  // only one end bought
        expect(litOf(container, `roster_size:${HALL_NODE}`)).toBe('false');

        // The rank reads on the node's plaque.
        const plaque = container.querySelector('[data-hall-node="bank_slots"]').parentElement;
        expect(plaque.textContent).toContain('II/X');
    });

    it('selects a node by upgrade id, and the Hall closes the screen', () => {
        const onSelectUpgrade = vi.fn();
        const onClose = vi.fn();
        const { container } = renderWeb({ onSelectUpgrade, onClose, selectedUpgradeId: 'roster_size' });
        expect(container.querySelector('[data-hall-node="roster_size"]').getAttribute('data-selected')).toBe('true');

        fireEvent.click(container.querySelector('[data-hall-node="bank_tabs"]'));
        expect(onSelectUpgrade).toHaveBeenCalledWith(getUpgradeDef('bank_tabs'));

        fireEvent.click(container.querySelector(`[data-hall-node="${HALL_NODE}"]`));
        expect(onClose).toHaveBeenCalled();
    });

    it('keeps the tutorial hooks on the Bunk Beds node', () => {
        const { container } = renderWeb();
        const node = container.querySelector('[data-guild-roster-upgrade="true"]');
        expect(node?.getAttribute('data-hall-node')).toBe('roster_size');
        expect(node.id).toBe('guild-roster-upgrade-node');
    });

    it('opens the inspection for a selection made by id, and buying there updates the web', async () => {
        InventoryManager.addItem('item_oak_wood', 10);
        const { container } = render(withEngine(React.createElement(React.Fragment, null,
            React.createElement(GuildHallBoard, {}),
            React.createElement(InspectionPanel, { selection: { type: 'guild_upgrade', id: 'bank_slots', pane: 'guild' } })
        )));
        expect(container.textContent).toContain('Bank Slots');
        expect(stateOf(container, 'bank_tabs')).toBe('locked');

        const button = container.querySelector('#guild-upgrade-button');
        expect(button).toBeTruthy();
        // useGameState re-reads on a microtask, so let it settle.
        await act(async () => { fireEvent.click(button); });

        expect(GuildUpgradeManager.getRank('bank_slots')).toBe(1);
        expect(stateOf(container, 'bank_slots')).toBe('bought');
        expect(stateOf(container, 'bank_tabs')).toBe('buyable');
        expect(litOf(container, `bank_slots:${HALL_NODE}`)).toBe('true');
    });
});

describe('the Effects list sits left of the web (FB-38)', () => {
    it('carries its probe hook', () => {
        const { container } = render(withEngine(React.createElement(GuildHallEffectsPanel)));
        expect(container.querySelector('[data-hall-effects]')).toBeTruthy();
    });

    it('is placed before the web in the layout, whichever side the nav is on', () => {
        const src = readFileSync(resolve(__dirname, '../ui/ReactRoot.jsx'), 'utf8');
        const effects = [...src.matchAll(/<GuildHallEffectsPanel\b[^>]*>/g)];
        expect(effects).toHaveLength(1);
        expect(effects[0][0]).not.toContain('menuRight');
        expect(effects[0].index).toBeLessThan(src.indexOf('<GuildHallBoard'));
        // Rendered on the Guild view alone, not gated on the nav side.
        expect(src).toContain('{isGuildView && <GuildHallEffectsPanel />}');
    });
});
