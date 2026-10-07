// @vitest-environment jsdom
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
    getUpgradeDef, getLockDetail, getLockReason, isUpgradeAccessible, LOCK_KIND, GUILD_UPGRADES
} from '../config/guildUpgrades.js';
import { selectGuildInspectSelection } from '../ui/guildInspectSelection.js';

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
    it('reports the link kind for an upgrade with no bought linked node', () => {
        const locked = GUILD_UPGRADES.find(d => !isUpgradeAccessible(d.id, {}))?.id;
        expect(locked).toBeTruthy();
        const detail = getLockDetail(locked, {});
        expect(detail).not.toBeNull();
        expect(detail.kind).toBe(LOCK_KIND.LINK);
        // The plain-text helper the purchase path uses is unchanged.
        expect(getLockReason(locked, {})).toBe(detail.text);
    });

    it('returns null for an accessible upgrade', () => {
        const open = GUILD_UPGRADES.find(d => isUpgradeAccessible(d.id, {}))?.id;
        expect(getLockDetail(open, {})).toBeNull();
        expect(getLockReason(open, {})).toBeNull();
    });
});

describe('GuildUpgradeInspection', () => {
    const def = getUpgradeDef('roster_size');
    const lockedId = GUILD_UPGRADES.find(d => !isUpgradeAccessible(d.id, {}))?.id;
    // The panel reads state through useGameState, which insists on an engine.
    const withEngine = (el) => React.createElement(EngineProvider, { engine: { GameState, EventBus } }, el);

    it('offers a way out of the panel', () => {
        // This only proves the X calls whatever `onClose` it was given — it
        // passed while was live, because the bug was never in this leaf
        // component. It is ReactRoot's fallback chain that resurrected the
        // same upgrade after `onClose` ran. See block below for the test
        // that actually covers the bug.
        const onClose = vi.fn();
        const { container } = render(
            withEngine(React.createElement(GuildUpgradeInspection, { upgradeDef: def, onClose }))
        );
        const btn = closeButton(container);
        expect(btn).toBeTruthy();
        fireEvent.click(btn);
        expect(onClose).toHaveBeenCalled();
    });

    it('stays silent about the link lock — the web already shows it', () => {
        const { container } = render(
            withEngine(React.createElement(GuildUpgradeInspection, {
                upgradeDef: getUpgradeDef(lockedId)
            }))
        );
        // It says the upgrade is locked, but does not spell out the link rule.
        expect(container.textContent).toContain('Upgrade Locked');
        expect(container.textContent).not.toContain('Requires a linked upgrade');
        expect(container.textContent).not.toContain('Path to this upgrade is locked');
    });
});

describe('selectGuildInspectSelection — the Guild Hall panel\'s fallback chain (CR3-451)', () => {
    it('returns null once every source is cleared', () => {
        const sel = selectGuildInspectSelection({
            guildPaneSelection: null,
            globalSelection: null,
            selectedUpgradeId: null,
            getUpgradeDefFn: getUpgradeDef
        });
        expect(sel).toBeNull();
    });

    it('falls back to the web\'s last-picked id while it is still set', () => {
        const sel = selectGuildInspectSelection({
            guildPaneSelection: null,
            globalSelection: null,
            selectedUpgradeId: 'roster_size',
            getUpgradeDefFn: getUpgradeDef
        });
        expect(sel?.id).toBe('roster_size');
    });

    it('prefers the pane\'s own explicit selection over the last-picked id', () => {
        const explicit = { type: 'guild_upgrade', id: 'wishing_well', pane: 'guild' };
        const sel = selectGuildInspectSelection({
            guildPaneSelection: explicit,
            globalSelection: null,
            selectedUpgradeId: 'roster_size',
            getUpgradeDefFn: getUpgradeDef
        });
        expect(sel).toBe(explicit);
    });
});

describe('The Guild Hall panel actually closes on Close (CR3-451)', () => {
    // The panel reads state through useGameState, which insists on an engine.
    const withEngine = (el) => React.createElement(EngineProvider, { engine: { GameState, EventBus } }, el);

    // A minimal stand-in for ReactRoot's own wiring: the `selectedUpgradeId`
    // state, the pane-selection state `ui.inspect` would hold, and the same
    // fallback chain and Close handler ReactRoot now uses. If Close only
    // cleared the pane (the pre-fix behaviour), this chain would still pick
    // `selectedUpgradeId` back up and the panel would reappear at once.
    function GuildPaneHarness({ initialUpgradeId = 'roster_size' }) {
        const [selectedUpgradeId, setSelectedUpgradeId] = React.useState(initialUpgradeId);
        const [paneSelection, setPaneSelection] = React.useState(null);

        const selection = selectGuildInspectSelection({
            guildPaneSelection: paneSelection,
            globalSelection: null,
            selectedUpgradeId,
            getUpgradeDefFn: getUpgradeDef
        });

        const handleClose = () => {
            setPaneSelection(null);
            setSelectedUpgradeId(null); // fix
        };

        return selection
            ? React.createElement(GuildUpgradeInspection, { upgradeDef: selection.upgradeDef, onClose: handleClose })
            : React.createElement('div', { 'data-testid': 'guild-panel-empty' }, 'nothing inspected');
    }

    it('disappears after Close, instead of re-showing the same upgrade', () => {
        const { container } = render(withEngine(React.createElement(GuildPaneHarness)));
        expect(closeButton(container)).toBeTruthy();
        fireEvent.click(closeButton(container));
        expect(container.querySelector('[data-testid="guild-panel-empty"]')).not.toBeNull();
        expect(closeButton(container)).toBeFalsy();
    });
});
