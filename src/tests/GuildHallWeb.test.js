// @vitest-environment jsdom
// The Guild Hall screen draws its upgrades as a web around the Hall (nodes joined by lines);
// the Hall star shows the Hall's Effects as a popover.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { hallCameraSides } from './fixtures/hallCameraSides.js';
import { resolve } from 'node:path';
import { render, fireEvent, act } from '@testing-library/react';
import { GuildHallBoard } from '../ui/components/board/GuildHallBoard.jsx';
import { effectsPopoverPlace, EFFECTS_POPOVER_W } from '../ui/components/board/GuildHallEffectsPopover.jsx';
import { escapeLayerCount } from '../ui/utils/escapeLayers.js';
import { InspectionPanel } from '../ui/components/drawer/InspectionPanel.jsx';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import { GuildUpgradeManager } from '../systems/progression/GuildUpgradeManager.js';
import { GUILD_UPGRADES, HALL_NODE, getUpgradeDef, getUpgradeWebLinks } from '../config/guildUpgrades.js';
import { useOuterUpgrade, OUTER_UPGRADE_ID as OUTER } from './fixtures/outerUpgrade.js';

vi.mock('../systems/core/NotificationSystem.js', () => ({
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(), notify: vi.fn()
}));

const renderWeb = (props = {}) => render((React.createElement(GuildHallBoard, props)));

const stateOf = (container, id) =>
    container.querySelector(`[data-hall-node="${id}"]`)?.getAttribute('data-node-state');
const litOf = (container, key) =>
    container.querySelector(`[data-hall-link="${key}"]`)?.getAttribute('data-link-lit');

useOuterUpgrade();

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
        for (const id of ['roster_size', 'bank_tabs', 'notice_board', 'wishing_well']) {
            expect(stateOf(container, id), id).toBe('buyable');
        }
        expect(stateOf(container, OUTER)).toBe('locked');
        // Bank Slots is retired (brief 310): no star for it.
        expect(container.querySelector('[data-hall-node="bank_slots"]')).toBeNull();
        // Scouting Flags is retired (brief 260 O2): no star for it.
        expect(container.querySelector('[data-hall-node="flag_radius"]')).toBeNull();
        expect([...container.querySelectorAll('[data-hall-link]')].every(l => l.getAttribute('data-link-lit') === 'false')).toBe(true);
    });

    it('marks bought, maxed and newly opened nodes, and lights the bought paths', () => {
        GameState.state.progress.guildUpgrades = { bank_tabs: 2, notice_board: 3 };
        const { container } = renderWeb();
        expect(stateOf(container, 'bank_tabs')).toBe('bought');
        expect(stateOf(container, 'notice_board')).toBe('maxed');
        expect(stateOf(container, OUTER)).toBe('buyable');     // Bank Tabs opened it
        expect(stateOf(container, 'roster_size')).toBe('buyable');

        expect(litOf(container, `bank_tabs:${HALL_NODE}`)).toBe('true');
        expect(litOf(container, `notice_board:${HALL_NODE}`)).toBe('true');
        expect(litOf(container, `${OUTER}:bank_tabs`)).toBe('false');  // only one end bought
        expect(litOf(container, `roster_size:${HALL_NODE}`)).toBe('false');

        // The rank reads on the star's tag, as `rank/max`.
        const tag = container.querySelector('[data-hall-node="bank_tabs"]').parentElement;
        expect(tag.textContent).toContain('Bank Tabs 2/15');
    });

    it('selects a node by upgrade id', () => {
        const onSelectUpgrade = vi.fn();
        const { container } = renderWeb({ onSelectUpgrade, selectedUpgradeId: 'roster_size' });
        expect(container.querySelector('[data-hall-node="roster_size"]').getAttribute('data-selected')).toBe('true');

        fireEvent.click(container.querySelector('[data-hall-node="bank_tabs"]'));
        expect(onSelectUpgrade).toHaveBeenCalledWith(getUpgradeDef('bank_tabs'));
    });

    it('keeps the tutorial hooks on the Bunk Beds node', () => {
        const { container } = renderWeb();
        const node = container.querySelector('[data-guild-roster-upgrade="true"]');
        expect(node?.getAttribute('data-hall-node')).toBe('roster_size');
        expect(node.id).toBe('guild-roster-upgrade-node');
    });

    it('opens the inspection for a selection made by id, and buying there updates the web', async () => {
        InventoryManager.addItem('item_oak_wood', 10);
        const { container } = render((React.createElement(React.Fragment, null,
            React.createElement(GuildHallBoard, {}),
            React.createElement(InspectionPanel, { selection: { type: 'guild_upgrade', id: 'bank_tabs', pane: 'guild' } })
        )));
        expect(container.textContent).toContain('Bank Tabs');
        expect(stateOf(container, OUTER)).toBe('locked');

        const button = container.querySelector('#guild-upgrade-button');
        expect(button).toBeTruthy();
        // useGameState re-reads on a microtask, so let it settle.
        await act(async () => { fireEvent.click(button); });

        expect(GuildUpgradeManager.getRank('bank_tabs')).toBe(1);
        expect(stateOf(container, 'bank_tabs')).toBe('bought');
        expect(stateOf(container, OUTER)).toBe('buyable');
        expect(litOf(container, `bank_tabs:${HALL_NODE}`)).toBe('true');
    });
});

describe('the Hall star shows the Effects as a popover', () => {
    const effects = () => document.body.querySelector('[data-hall-effects]');
    const hallOf = (container) => container.querySelector(`[data-hall-node="${HALL_NODE}"]`);

    it('shows while the Hall star is hovered and hides when the pointer leaves', () => {
        const { container } = renderWeb();
        expect(effects()).toBeNull();
        fireEvent.mouseEnter(hallOf(container));
        expect(effects()).toBeTruthy();
        expect(effects().getAttribute('data-hall-effects-pinned')).toBe('false');
        expect(effects().textContent).toContain('Guild Hall Effects');
        fireEvent.mouseLeave(hallOf(container));
        expect(effects()).toBeNull();
    });

    it('a click pins it open past the pointer leaving, and a second click closes it', () => {
        const onClose = vi.fn();
        const { container } = renderWeb({ onClose });
        fireEvent.mouseEnter(hallOf(container));
        fireEvent.click(hallOf(container));
        fireEvent.mouseLeave(hallOf(container));
        expect(effects()?.getAttribute('data-hall-effects-pinned')).toBe('true');
        fireEvent.mouseEnter(hallOf(container));
        fireEvent.click(hallOf(container));
        expect(effects()).toBeNull();
        // The Hall star no longer leaves the screen.
        expect(onClose).not.toHaveBeenCalled();
    });

    it('Escape closes a pinned popover as its own layer', () => {
        const { container } = renderWeb();
        const before = escapeLayerCount();
        fireEvent.click(hallOf(container));
        expect(escapeLayerCount()).toBe(before + 1);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(effects()).toBeNull();
        expect(escapeLayerCount()).toBe(before);
    });

    it('a press anywhere else closes a pinned popover; a press inside it does not', () => {
        const { container } = renderWeb();
        fireEvent.click(hallOf(container));
        fireEvent.pointerDown(effects());
        expect(effects()).toBeTruthy();
        fireEvent.pointerDown(container.querySelector('[data-hall-node="bank_tabs"]'));
        expect(effects()).toBeNull();
    });

    it('sits right of the star, flips left at the window edge, and stays on the window', () => {
        const star = { left: 900, right: 996, top: 492, height: 96 };
        expect(effectsPopoverPlace(star, EFFECTS_POPOVER_W, 200, 1920, 1080)).toEqual({ left: 1008, top: 440 });
        const nearRight = { left: 1700, right: 1796, top: 492, height: 96 };
        expect(effectsPopoverPlace(nearRight, EFFECTS_POPOVER_W, 200, 1920, 1080).left).toBe(1700 - 12 - EFFECTS_POPOVER_W);
        const nearTop = { left: 900, right: 996, top: 0, height: 96 };
        expect(effectsPopoverPlace(nearTop, EFFECTS_POPOVER_W, 400, 1920, 1080).top).toBe(8);
    });

    it('takes no column of its own: the screen mounts no Effects list beside the web', () => {
        const src = readFileSync(resolve(__dirname, '../ui/ReactRoot.jsx'), 'utf8');
        expect(src).not.toMatch(/GuildHallEffects/);
        // The Hall's screen, which the camera lays only while it is off the mat, holds the web and
        // its details column, and nothing else beside the web.
        const hall = hallCameraSides().hall;
        expect(hall).toContain('<GuildHallBoard');
        expect(hall).toContain('<GuildHallDetails');
        expect(hall.indexOf('<GuildHallBoard')).toBeLessThan(hall.indexOf('<GuildHallDetails'));
    });
});
