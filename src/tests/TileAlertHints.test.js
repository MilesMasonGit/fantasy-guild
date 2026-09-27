import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import './fixtures/testTokens.js';
import { TokenCentreAlert } from '../ui/components/board/TokenEventAlert.jsx';
import { TokenProgressBar } from '../ui/components/board/TokenProgressBar.jsx';
import { ALERT_HINT, ALERT_LABEL, isYellowAlert } from '../ui/components/board/boardConstants.js';
import { ALERT, BOARD_EVENTS } from '../systems/board/boardEvents.js';
import { EngineContext } from '../ui/context/EngineContext';
import { EventBus } from '../systems/core/EventBus.js';
import { GameState } from '../state/GameState.js';
import { InventoryManager } from '../systems/inventory/InventoryManager.js';
import * as BoardState from '../systems/board/BoardState.js';
import * as Placement from '../systems/board/Placement.js';
import * as SpawnerSystem from '../systems/board/SpawnerSystem.js';
import * as StationRecipe from '../systems/board/StationRecipe.js';
import { tokenStartingUses } from '../config/registries/tokenRegistry.js';
import { GEAR_ONLY_ALERTS, workedAlertOf } from '../ui/components/board/centreAlert.js';

/**
 * These tests exist because this feature was written once and never shown.
 *
 * `ALERT_HINT` sat in the tree for weeks as a complete, correct, entirely
 * unread table (CR2-156), while three of the six alert values drew nothing at
 * all on the Token (CR2-155). Both faults were invisible to the suite, because
 * nothing asserted that a blocked Token says anything. So: every alert value
 * the engine can set is pinned here to the sentence the player is shown for it.
 *
 * ⭐ Since B1.1 (TL-14, TL-22) a worked Token's problem is the red or yellow
 * mark at its centre, not a label on the progress bar, and hovering the Token
 * opens the mark's bubble with the hint sentence and the missing requirements.
 */

/** Every alert value that can reach a Token (one enum since CR2-060). */
const ALERT_VALUES = Object.values(ALERT);

/**
 * The worked-Token alerts: every value except "nothing chosen", which the
 * pulsing recipe gear says instead (Token Lifecycle feedback Q2, FB-7). Those
 * two are pinned below to draw nothing.
 */
const MARK_ALERTS = ALERT_VALUES.filter(a => !GEAR_ONLY_ALERTS.has(a));

const tree = (el) => React.createElement(
    EngineContext.Provider,
    { value: { GameState, EventBus } },
    React.createElement(DndContext, null, el)
);

const centre = (props) => React.createElement(TokenCentreAlert, { instanceId: 'tok_1', ...props });

const worked = (alert, extra = {}) => ({ typeId: 'fixture_missing_type', instanceId: 'tok_1', heroId: 'hero_1', alert, ...extra });

const renderMark = (alert, { isHovered = true } = {}) => render(tree(centre({ token: worked(alert), isHovered })));

/** The hover bubble is portalled to the page body, so it is looked up there. */
const hintFor = (alert) => document.querySelector(`[data-tile-alert-hint="${alert}"]`);

beforeEach(() => {
    GameState.initNew();
    InventoryManager.init();
    SpawnerSystem.resetAlerts();
});
afterEach(() => cleanup());

describe('Token alert hints (D-114)', () => {
    it('covers every alert value the engine can set', () => {
        for (const alert of ALERT_VALUES) {
            expect(ALERT_HINT[alert], `no hint for alert "${alert}"`).toBeTruthy();
            expect(ALERT_LABEL[alert], `no label for alert "${alert}"`).toBeTruthy();
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

    it.each(MARK_ALERTS)('hovering the Token shows the hint for "%s"', (alert) => {
        renderMark(alert);
        const panel = hintFor(alert);
        expect(panel, `no hover bubble rendered for "${alert}"`).toBeTruthy();
        expect(panel.textContent).toContain(ALERT_HINT[alert]);
        expect(panel.textContent).toContain(ALERT_LABEL[alert]);
    });

    it.each(MARK_ALERTS)('draws a centre mark in the right colour for "%s"', (alert) => {
        const { container } = renderMark(alert, { isHovered: false });
        // CR2-155: access, unskilled and unstocked once drew nothing at all.
        const wrap = container.querySelector(`[data-worked-alert="${alert}"]`);
        expect(wrap, `"${alert}" drew no centre mark`).toBeTruthy();
        const mark = wrap.querySelector('[data-alert-kind="problem"]');
        expect(mark.className).toContain('top-1/2');
        const colour = isYellowAlert(alert) ? 'yellow' : 'red';
        expect(mark.getAttribute('data-alert-severity')).toBe(colour);
        expect(mark.querySelector('img').getAttribute('src')).toBe(`/assets/ui/ui_alert_${colour}.png`);
        // Not hovered: no bubble.
        expect(hintFor(alert)).toBeNull();
    });

    it.each([...GEAR_ONLY_ALERTS])('draws nothing for "%s" — the gear says it (FB-7)', (alert) => {
        const { container } = renderMark(alert);
        expect(container.querySelector('[data-worked-alert]')).toBeNull();
        expect(container.querySelector('[data-alert-kind]')).toBeNull();
        expect(hintFor(alert)).toBeNull();
    });

    it('shows no mark and no hint when the Token is fine', () => {
        const { container } = renderMark(null);
        expect(container.querySelector('[data-alert-kind]')).toBeNull();
        expect(document.querySelector('[data-tile-alert-hint]')).toBeNull();
    });
});

describe('B1.1: a worked Token’s problem is the centre mark (TL-14, TL-22)', () => {
    it('inputs is yellow; access and unskilled are red', () => {
        const colourOf = (alert) => {
            const { container } = renderMark(alert, { isHovered: false });
            const sev = container.querySelector('[data-worked-alert] [data-alert-kind="problem"]').getAttribute('data-alert-severity');
            cleanup();
            return sev;
        };
        expect(colourOf(ALERT.INPUTS)).toBe('yellow');
        expect(colourOf(ALERT.ACCESS)).toBe('red');
        expect(colourOf(ALERT.UNSKILLED)).toBe('red');
    });

    it('stays while the problem lasts and goes when it clears — no fade', () => {
        const { container, rerender } = render(tree(centre({ token: worked(ALERT.ACCESS) })));
        const mark = container.querySelector('[data-worked-alert="access"] [data-alert-kind="problem"]');
        expect(mark.style.opacity).toBe('1');
        expect(mark.getAttribute('data-alert-fades')).toBeNull();

        rerender(tree(centre({ token: worked(null) })));
        expect(container.querySelector('[data-worked-alert]')).toBeNull();
        expect(container.querySelector('[data-alert-kind]')).toBeNull();
    });

    it('no hero, no worked mark', () => {
        const { container } = render(tree(centre({ token: worked(ALERT.ACCESS, { heroId: null }), isHovered: true })));
        expect(container.querySelector('[data-alert-kind]')).toBeNull();
        expect(workedAlertOf({ hasHero: false, alert: ALERT.ACCESS })).toBeNull();
    });

    it('with no engine alert, missing requirements still read as a problem', () => {
        expect(workedAlertOf({ hasHero: true, missingType: 'items' })).toBe(ALERT.INPUTS);
        expect(workedAlertOf({ hasHero: true, missingType: 'tokens' })).toBe(ALERT.NO_RECIPE);
        expect(workedAlertOf({ hasHero: true })).toBeNull();
        // Nothing chosen is the gear's, whatever else is missing.
        expect(workedAlertOf({ hasHero: true, alert: ALERT.CHOOSE_RECIPE, missingType: 'items' })).toBeNull();
    });

    it('hovering lists the missing items under the hint', () => {
        const consumer = BoardState.createTokenInstance('fixture_consumer', tokenStartingUses('fixture_consumer'));
        Placement.placeTokenAt(consumer, { x: 560, y: 520 });
        const token = { typeId: consumer.typeId, instanceId: consumer.id, heroId: 'hero_1', alert: ALERT.INPUTS };

        const { container } = render(tree(React.createElement(TokenCentreAlert, { instanceId: consumer.id, token, isHovered: true })));
        expect(container.querySelector('[data-worked-alert="inputs"]')).not.toBeNull();
        const panel = hintFor(ALERT.INPUTS);
        expect(panel.textContent).toContain(ALERT_HINT[ALERT.INPUTS]);
        const list = panel.querySelector('[data-missing-requirements="items"]');
        expect(list).not.toBeNull();
        expect(list.textContent).toContain('Fixture Oak Wood');
    });
    it("lists a station's needs from its chosen recipe, not from MatToken's slim token", () => {
        // ⚠️ MatToken passes a projection without `selectedRecipeId`. Resolved
        // against that, a station has no recipe and the list came back empty
        // (found live in B1.1 on a Furnace; the old bar had the same flaw).
        const kitchen = BoardState.createTokenInstance('fixture_kitchen', tokenStartingUses('fixture_kitchen'));
        Placement.placeTokenAt(kitchen, { x: 560, y: 520 });
        expect(StationRecipe.setSelectedRecipe(kitchen, 'pooled_stew')).toBe(true);
        const token = { typeId: kitchen.typeId, instanceId: kitchen.id, heroId: 'hero_1', alert: ALERT.NO_RECIPE };

        render(tree(React.createElement(TokenCentreAlert, { instanceId: kitchen.id, token, isHovered: true })));
        const list = hintFor(ALERT.NO_RECIPE).querySelector('[data-missing-requirements="tokens"]');
        expect(list).not.toBeNull();
        expect(list.textContent).toContain('Ctx Fixture A');
    });
    // A spawner's live problem winning over a worked one is pinned in
    // CornerCentreBadges, where the spawner fixture lives.
});

describe('B1.1: the bar no longer draws alerts', () => {
    it.each(MARK_ALERTS)('prints no label and no red or yellow fill for "%s"', (alert) => {
        const { container } = render(tree(React.createElement(TokenProgressBar, {
            instanceId: 'tok_1', token: worked(alert), alert
        })));
        expect(container.querySelector('.progress-fill--red-chroma')).toBeNull();
        expect(container.querySelector('.progress-fill--yellow-chroma')).toBeNull();
        expect(container.textContent).not.toContain(ALERT_LABEL[alert]);
        expect(container.querySelector('[data-tile-alert-hint]')).toBeNull();
        // Blocked: the bar steps aside.
        expect(container.firstChild.style.opacity).toBe('0');
    });

    it('ignores progress while blocked, and runs again once the alert clears', () => {
        const { container, rerender } = render(tree(React.createElement(TokenProgressBar, {
            instanceId: 'tok_1', token: worked(ALERT.INPUTS), alert: ALERT.INPUTS
        })));
        act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_1', percent: 50, elapsedMs: 5000, cycleTimeMs: 10000 }); });
        expect(container.firstChild.style.opacity).toBe('0');

        rerender(tree(React.createElement(TokenProgressBar, { instanceId: 'tok_1', token: worked(null), alert: null })));
        act(() => { EventBus.publish(BOARD_EVENTS.PROGRESS, { instanceId: 'tok_1', percent: 50, elapsedMs: 5000, cycleTimeMs: 10000 }); });
        expect(container.firstChild.style.opacity).toBe('1');
        expect(container.textContent).toContain('10s');
    });
});
