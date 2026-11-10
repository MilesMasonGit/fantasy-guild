// @vitest-environment jsdom
// Covers the two surfaces fixed in the wave-4 small-fixes batch that the
// preview harness cannot reach (no nav bubble opens its drawer there):
// GIModal's close-button decision, and the Guild Hall upgrade panel's exit
// plus its deliberately-silent lock-reason slot.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GIModal } from '../ui/components/base/GIModal.jsx';
import { GuildUpgradeInspection } from '../ui/components/drawer/GuildUpgradeInspection.jsx';
import { HallUpgradeDrawer } from '../ui/components/drawer/HallUpgradeDrawer.jsx';
import {
    getUpgradeDef, getLockDetail, getLockReason, isUpgradeAccessible, LOCK_KIND, GUILD_UPGRADES
} from '../config/guildUpgrades.js';
import { withOuterUpgrade } from './fixtures/outerUpgrade.js';

// Every shipped upgrade joins the Hall, so the locked one is the test star beyond Bank Tabs.
withOuterUpgrade();

const closeButton = (container) =>
    Array.from(container.querySelectorAll('button'))
        .find(b => (b.getAttribute('aria-label') === 'Close' || b.getAttribute('title') === 'Close'));

describe('GIModal — whether a close control is offered', () => {
    it('renders no dismiss control when the caller supplies no onClose', () => {
        render(React.createElement(GIModal, { isOpen: true, title: 'Choose a Save' }, 'body'));
        const header = screen.getByText('Choose a Save').parentElement;
        expect(header.querySelectorAll('button').length).toBe(0);
    });

    it('renders no dismiss control when hideClose is passed, even with an onClose', () => {
        const onClose = vi.fn();
        render(React.createElement(GIModal, { isOpen: true, title: 'Choose a Save', hideClose: true, onClose }, 'body'));
        const header = screen.getByText('Choose a Save').parentElement;
        expect(header.querySelectorAll('button').length).toBe(0);
    });

    it('renders a dismiss control that calls onClose when one is supplied', () => {
        const onClose = vi.fn();
        render(React.createElement(GIModal, { isOpen: true, title: 'Settings', onClose }, 'body'));
        const header = screen.getByText('Settings').parentElement;
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

    it('offers a way out of the drawer', () => {
        const onClose = vi.fn();
        const { container } = render(
            (React.createElement(GuildUpgradeInspection, { upgradeDef: def, onClose }))
        );
        const btn = closeButton(container);
        expect(btn).toBeTruthy();
        fireEvent.click(btn);
        expect(onClose).toHaveBeenCalled();
    });

    it('stays silent about the link lock — the web already shows it', () => {
        const lockedId = GUILD_UPGRADES.find(d => !isUpgradeAccessible(d.id, {}))?.id;
        expect(lockedId).toBeTruthy();
        const { container } = render(
            (React.createElement(GuildUpgradeInspection, {
                upgradeDef: getUpgradeDef(lockedId)
            }))
        );
        // It says the upgrade is locked, but does not spell out the link rule.
        expect(container.textContent).toContain('Locked');
        expect(container.querySelector('#guild-upgrade-button')).toBeNull();
        expect(container.textContent).not.toContain('Requires a linked upgrade');
        expect(container.textContent).not.toContain('Path to this upgrade is locked');
    });
});

describe('The Upgrade drawer closes on its X', () => {
    function HallHarness() {
        const [id, setId] = React.useState('roster_size');
        return React.createElement(HallUpgradeDrawer, { upgradeDef: id ? getUpgradeDef(id) : null, onClose: () => setId(null) });
    }

    it('is gone after its X, and stays gone', async () => {
        const { container } = render(React.createElement(HallHarness));
        expect(container.querySelector('[data-hall-drawer="roster_size"]')).not.toBeNull();
        fireEvent.click(closeButton(container));
        // It slides out, then is gone.
        await waitFor(() => expect(container.querySelector('[data-side-drawer]')).toBeNull());
        expect(container.textContent).toBe('');
    });
});
