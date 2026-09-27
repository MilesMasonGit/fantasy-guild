import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { TokenProgressBar } from '../ui/components/board/TokenProgressBar.jsx';
import { ALERT_HINT, ALERT_LABEL } from '../ui/components/board/boardConstants.js';
import { ALERT } from '../systems/board/boardEvents.js';
import { EngineContext } from '../ui/context/EngineContext';
import { EventBus } from '../systems/core/EventBus.js';
import { GEAR_ONLY_ALERTS } from '../ui/components/board/centreAlert.js';

/**
 * These tests exist because this feature was written once and never shown.
 *
 * `ALERT_HINT` sat in the tree for weeks as a complete, correct, entirely
 * unread table (CR2-156), while three of the six alert values drew nothing at
 * all on the Token (CR2-155). Both faults were invisible to the suite, because
 * nothing asserted that a blocked Token says anything. So: every alert value
 * the engine can set is pinned here to the sentence the player is shown for it.
 */

/** Every alert value that can reach a Token (one enum since CR2-060). */
const ALERT_VALUES = Object.values(ALERT);

/**
 * The bar's alerts: every value except "nothing chosen", which the pulsing
 * recipe gear says instead (Token Lifecycle feedback Q2, FB-7). Those two are
 * pinned below to draw nothing on the bar.
 */
const BAR_ALERTS = ALERT_VALUES.filter(a => !GEAR_ONLY_ALERTS.has(a));

const renderBar = (alert) => render(
    React.createElement(
        EngineContext.Provider,
        { value: { EventBus } },
        React.createElement(TokenProgressBar, {
            instanceId: 'tok_1',
            token: { typeId: 'fixture_missing_type', heroId: 'hero_1', alert },
            isHovered: true,
            alert
        })
    )
);

describe('Token alert hints (D-114)', () => {
    it('covers every alert value the engine can set', () => {
        for (const alert of ALERT_VALUES) {
            expect(ALERT_HINT[alert], `no hint for alert "${alert}"`).toBeTruthy();
            expect(ALERT_LABEL[alert], `no bar label for alert "${alert}"`).toBeTruthy();
        }
        // And nothing extra: a hint for a value the engine never sets is a lie.
        expect(Object.keys(ALERT_HINT).sort()).toEqual([...ALERT_VALUES].sort());
    });

    it('pins each alert state to its hint text', () => {
        expect(ALERT_HINT[ALERT.INPUTS])
            .toBe('Waiting for materials — nothing in the Bank or on the board');
        expect(ALERT_HINT[ALERT.ACCESS])
            .toBe('This hero’s skill is too low to work this Token');
        expect(ALERT_HINT[ALERT.UNSKILLED])
            .toBe('This hero doesn’t have the skill for this work — levelling won’t help');
        expect(ALERT_HINT[ALERT.NO_RECIPE])
            .toBe('This station is missing a Token its recipe needs beside it');
        // `unstocked` went with the Managers (SP-55, 9.2).
        expect(ALERT_HINT.unstocked).toBeUndefined();
    });

    it.each(BAR_ALERTS)('shows the hint on hover for "%s"', (alert) => {
        const { container } = renderBar(alert);
        const panel = container.querySelector(`[data-tile-alert-hint="${alert}"]`);
        expect(panel, `no hover panel rendered for "${alert}"`).toBeTruthy();
        expect(panel.textContent).toContain(ALERT_HINT[alert]);
        cleanup();
    });

    it.each(BAR_ALERTS)('draws a warning mark on the bar for "%s"', (alert) => {
        const { container } = renderBar(alert);
        const fill = container.querySelector('[class*="progress-fill--"]');
        expect(fill).toBeTruthy();
        // CR2-155: access, unskilled and unstocked used to fall off the end of
        // renderAlert, leaving the plain white cycle fill mid-countdown.
        expect(fill.className, `"${alert}" left the bar on the normal cycle fill`)
            .not.toContain('progress-fill--white-chroma');
        expect(fill.style.width).toBe('100%');
        expect(container.textContent).toContain(ALERT_LABEL[alert]);
        cleanup();
    });

    it.each([...GEAR_ONLY_ALERTS])('draws nothing on the bar for "%s" — the gear says it (FB-7)', (alert) => {
        const { container } = renderBar(alert);
        expect(container.querySelector(`[data-tile-alert-hint="${alert}"]`)).toBeNull();
        expect(container.querySelector('.progress-fill--red-chroma')).toBeNull();
        expect(container.querySelector('.progress-fill--yellow-chroma')).toBeNull();
        expect(container.textContent).not.toContain(ALERT_LABEL[alert]);
        cleanup();
    });

    it('shows no hint panel when the Token is fine', () => {
        const { container } = render(
            React.createElement(
                EngineContext.Provider,
                { value: { EventBus } },
                React.createElement(TokenProgressBar, {
                    instanceId: 'tok_1',
                    token: { typeId: 'fixture_missing_type', heroId: 'hero_1', alert: null },
                    isHovered: true,
                    alert: null
                })
            )
        );
        expect(container.querySelector('[data-tile-alert-hint]')).toBeNull();
    });
});
