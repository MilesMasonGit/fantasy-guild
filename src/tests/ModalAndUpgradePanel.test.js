// Covers the two surfaces fixed in the wave-4 small-fixes batch that the
// preview harness cannot reach (no nav bubble opens its drawer there):
// GIModal's close-button decision, and the Guild Hall upgrade panel's exit
// plus its deliberately-silent lock-reason slot.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GIModal } from '../ui/components/base/GIModal.jsx';
import { GuildUpgradeInspection } from '../ui/components/drawer/GuildUpgradeInspection.jsx';
import { EngineProvider } from '../ui/context/EngineContext.jsx';
import { GameState } from '../state/GameState.js';
import { EventBus } from '../systems/core/EventBus.js';
import {
    getUpgradeDef, getLockDetail, getLockReason, isTileAccessible, LOCK_KIND, UPGRADE_TILES
} from '../config/guildUpgrades.js';

const closeButton = (container) =>
    Array.from(container.querySelectorAll('button'))
        .find(b => (b.getAttribute('aria-label') === 'Close' || b.getAttribute('title') === 'Close'));

describe('GIModal — whether a close control is offered', () => {
    it('renders no dismiss control when the caller supplies no onClose', () => {
        render(React.createElement(GIModal, { isOpen: true, title: 'SYSTEM BOOT' }, 'body'));
        const header = screen.getByText('SYSTEM BOOT').parentElement;
        expect(header.querySelectorAll('button').length).toBe(0);
    });

    it('renders no dismiss control when hideClose is passed, even with an onClose', () => {
        const onClose = vi.fn();
        render(React.createElement(GIModal, { isOpen: true, title: 'SYSTEM BOOT', hideClose: true, onClose }, 'body'));
        const header = screen.getByText('SYSTEM BOOT').parentElement;
        expect(header.querySelectorAll('button').length).toBe(0);
    });

    it('renders a dismiss control that calls onClose when one is supplied', () => {
        const onClose = vi.fn();
        render(React.createElement(GIModal, { isOpen: true, title: 'Protocol Settings', onClose }, 'body'));
        const header = screen.getByText('Protocol Settings').parentElement;
        const btn = header.querySelector('button');
        expect(btn).toBeTruthy();
        fireEvent.click(btn);
        expect(onClose).toHaveBeenCalled();
    });
});

describe('guildUpgrades — lock reasons carry their kind', () => {
    it('reports the adjacency kind for a tile with no unlocked neighbour', () => {
        const lockedTile = Number(Object.keys(UPGRADE_TILES).find(t => !isTileAccessible(Number(t), {})));
        expect(Number.isNaN(lockedTile)).toBe(false);
        const detail = getLockDetail(lockedTile, {});
        expect(detail).not.toBeNull();
        expect(detail.kind).toBe(LOCK_KIND.ADJACENCY);
        // The plain-text helper the purchase path uses is unchanged.
        expect(getLockReason(lockedTile, {})).toBe(detail.text);
    });

    it('returns null for an accessible tile', () => {
        const openTile = Number(Object.keys(UPGRADE_TILES).find(t => isTileAccessible(Number(t), {})));
        expect(getLockDetail(openTile, {})).toBeNull();
        expect(getLockReason(openTile, {})).toBeNull();
    });
});

describe('GuildUpgradeInspection', () => {
    const def = getUpgradeDef('roster_size');
    const lockedTile = Number(Object.keys(UPGRADE_TILES).find(t => !isTileAccessible(Number(t), {})));
    // The panel reads state through useGameState, which insists on an engine.
    const withEngine = (el) => React.createElement(EngineProvider, { engine: { GameState, EventBus } }, el);

    it('offers a way out of the panel', () => {
        const onClose = vi.fn();
        const { container } = render(
            withEngine(React.createElement(GuildUpgradeInspection, { upgradeDef: def, tileIndex: 17, onClose }))
        );
        const btn = closeButton(container);
        expect(btn).toBeTruthy();
        fireEvent.click(btn);
        expect(onClose).toHaveBeenCalled();
    });

    it('stays silent about the adjacency lock — the board already shows it', () => {
        const { container } = render(
            withEngine(React.createElement(GuildUpgradeInspection, {
                upgradeDef: getUpgradeDef(UPGRADE_TILES[lockedTile]),
                tileIndex: lockedTile
            }))
        );
        // It says the upgrade is locked, but does not spell out the adjacency rule.
        expect(container.textContent).toContain('Upgrade Locked');
        expect(container.textContent).not.toContain('Requires adjacent upgrade');
        expect(container.textContent).not.toContain('Path to this upgrade is locked');
    });
});
